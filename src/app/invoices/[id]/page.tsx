import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  generateFeuilleDeSoinsAction,
  recordPaymentAction,
} from "@/features/billing/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getInvoice } from "@/server/repositories/billing";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("invoice:read");
  const { id } = await params;
  const invoice = await getInvoice(prisma, ctx, id);

  if (!invoice) {
    notFound();
  }

  const paid = invoice.payments
    .filter((payment) => payment.status === PaymentStatus.FINALIZED)
    .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
  const balance = invoice.totalAmount.sub(paid);

  return (
    <AppShell user={ctx} title={`Facture ${invoice.id.slice(0, 8)}`}>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Patient</p>
                <p className="font-bold">{invoice.patient.firstName} {invoice.patient.lastName}</p>
                <p className="text-sm">{invoice.patient.phone}</p>
                <p className="text-sm">CIN: {invoice.patient.cin ?? "—"}</p>
              </div>
              <div className="md:text-right">
                <p className="text-sm text-slate-500">Montant</p>
                <p className="text-2xl font-bold">{invoice.totalAmount.toFixed(2)} MAD</p>
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{invoice.status}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div><p className="text-xs text-slate-500">Payé</p><p className="font-bold">{paid.toFixed(2)} MAD</p></div>
              <div><p className="text-xs text-slate-500">Solde</p><p className="font-bold">{balance.toFixed(2)} MAD</p></div>
              <div><p className="text-xs text-slate-500">Assurance</p><p className="font-bold">{invoice.patient.insuranceType}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-bold">Paiements</h2>
            <div className="space-y-3">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold">{payment.method} · {payment.amount.toFixed(2)} MAD</p>
                    <p className="text-xs text-slate-500">{payment.paidAt.toLocaleString("fr-MA")} · {payment.receivedBy.fullName}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{payment.status}</span>
                </div>
              ))}
              {invoice.payments.length === 0 ? <p className="text-sm text-slate-500">Aucun paiement enregistré.</p> : null}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          {can(ctx.role, "payment:record") && invoice.status !== InvoiceStatus.PAID && balance.gt(0) ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-bold">Encaisser</h2>
              <form action={recordPaymentAction} className="space-y-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <label className="block text-sm font-medium">Montant (MAD)
                  <input required name="amount" defaultValue={balance.toFixed(2)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-medium">Mode de paiement
                  <select name="method" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="CASH">Espèces</option>
                    <option value="CARD">TPE / Carte</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="VIREMENT">Virement</option>
                  </select>
                </label>
                <button className="w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Enregistrer paiement</button>
              </form>
            </section>
          ) : null}

          {invoice.consultation && can(ctx.role, "invoice:write") ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-lg font-bold">Feuille de soins</h2>
              <p className="mb-4 text-sm text-slate-500">Préremplie avec les données administratives marocaines, médecin/INPE et montant facturé.</p>
              <form action={generateFeuilleDeSoinsAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
                  {invoice.feuilleDeSoinsGenerated ? "Réouvrir la feuille de soins" : "Générer la feuille de soins"}
                </button>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
