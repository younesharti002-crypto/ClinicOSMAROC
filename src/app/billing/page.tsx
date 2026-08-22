import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { createInvoiceAction } from "@/features/billing/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getBillingSnapshot } from "@/server/repositories/billing";

export default async function BillingPage() {
  const ctx = await requireCapability("invoice:read");
  const billing = await getBillingSnapshot(prisma, ctx);

  return (
    <AppShell user={ctx} title="Facturation">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold">À encaisser</h2>
            <p className="text-sm text-slate-500">Consultations terminées sans facture.</p>
          </div>

          <div className="space-y-3">
            {billing.toBill.map((consultation) => (
              <article key={consultation.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold">{consultation.patient.firstName} {consultation.patient.lastName}</p>
                <p className="mt-1 text-sm text-slate-600">Dr {consultation.doctor.fullName} · {consultation.patient.phone}</p>
                <p className="text-xs text-slate-500">{consultation.createdAt.toLocaleString("fr-MA")}</p>

                {can(ctx.role, "invoice:write") ? (
                  <form action={createInvoiceAction} className="mt-4 flex items-end gap-2">
                    <input type="hidden" name="consultationId" value={consultation.id} />
                    <label className="flex-1 text-xs font-medium text-slate-600">
                      Montant consultation (MAD)
                      <input
                        required
                        name="totalAmount"
                        inputMode="decimal"
                        placeholder="300.00"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Créer facture</button>
                  </form>
                ) : null}
              </article>
            ))}
            {billing.toBill.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">Aucune consultation à facturer.</div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Factures récentes</h2>
            <p className="text-sm text-slate-500">Paiements et solde restant par facture.</p>
          </div>

          <div className="space-y-3">
            {billing.invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{invoice.patient.firstName} {invoice.patient.lastName}</p>
                    <p className="mt-1 text-xs text-slate-500">Facture {invoice.id.slice(0, 8)} · {invoice.createdAt.toLocaleDateString("fr-MA")}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold">{invoice.totalAmount.toFixed(2)} MAD</p>
                    <p className="text-slate-500">Payé {invoice.paid.toFixed(2)} · Solde {invoice.balance.toFixed(2)}</p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{invoice.status}</span>
                  </div>
                </div>
              </Link>
            ))}
            {billing.invoices.length === 0 ? <p className="text-sm text-slate-500">Aucune facture.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
