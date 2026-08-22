import { PaymentStatus } from "@prisma/client";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import {
  addDaysDateKey,
  clinicDateKey,
} from "@/lib/time/clinic-time";
import { getCashDay } from "@/server/repositories/cash";

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireCapability("cash:close");
  const params = await searchParams;
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { timezone: true },
  });

  if (!clinic) throw new Error("Clinic not found");

  const today = clinicDateKey(new Date(), clinic.timezone);
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;
  const day = await getCashDay(prisma, ctx, dateKey);
  const previousDate = addDaysDateKey(dateKey, -1);
  const nextDate = addDaysDateKey(dateKey, 1);

  const officialDiff = day.closing
    ? !day.theoretical.cash.eq(day.closing.theoreticalCash) ||
      !day.theoretical.card.eq(day.closing.theoreticalCard) ||
      !day.theoretical.cheque.eq(day.closing.theoreticalCheque) ||
      !day.theoretical.transfer.eq(day.closing.theoreticalTransfer)
    : false;

  return (
    <AppShell user={ctx} title="Caisse journalière">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Link href={`/cash?date=${previousDate}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">←</Link>
          <form method="get" className="flex items-center gap-2">
            <input type="date" name="date" defaultValue={dateKey} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Afficher</button>
          </form>
          <Link href={`/cash?date=${nextDate}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">→</Link>
        </div>

        {!day.closing ? (
          <Link href={`/cash/closing?date=${dateKey}`} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Clôturer la caisse
          </Link>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900">CLÔTURÉE · VERROUILLÉE</span>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Espèces", day.theoretical.cash],
          ["TPE / Carte", day.theoretical.card],
          ["Chèques", day.theoretical.cheque],
          ["Virement", day.theoretical.transfer],
          ["Total", day.theoretical.total],
        ].map(([label, amount]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{String(label)}</p>
            <p className="mt-2 text-xl font-bold">{typeof amount === "string" ? amount : amount.toFixed(2)} MAD</p>
          </div>
        ))}
      </section>

      {day.closing ? (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-emerald-950">Clôture officielle</h2>
              <p className="mt-1 text-sm text-emerald-900">
                Clôturée par {day.closing.closedBy.fullName} · {day.closing.closedAt.toLocaleString("fr-MA")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-800">Écart officiel</p>
              <p className="text-2xl font-bold text-emerald-950">{day.closing.variance.toFixed(2)} MAD</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Espèces", day.closing.theoreticalCash, day.closing.actualCash],
              ["TPE / Carte", day.closing.theoreticalCard, day.closing.actualCard],
              ["Chèques", day.closing.theoreticalCheque, day.closing.actualCheque],
              ["Virement", day.closing.theoreticalTransfer, day.closing.actualTransfer],
            ].map(([label, theoretical, actual]) => (
              <div key={String(label)} className="rounded-lg bg-white/80 p-3 text-sm">
                <p className="font-semibold">{String(label)}</p>
                <p className="mt-1 text-slate-600">Théorique: {typeof theoretical === "string" ? theoretical : theoretical.toFixed(2)} MAD</p>
                <p className="text-slate-600">Réel: {typeof actual === "string" ? actual : actual.toFixed(2)} MAD</p>
              </div>
            ))}
          </div>

          {day.closing.notes ? <p className="mt-4 text-sm text-emerald-950"><strong>Motif / notes:</strong> {day.closing.notes}</p> : null}

          {officialDiff ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Ajustement post-clôture détecté.</strong> Les totaux dynamiques ci-dessus incluent les ajustements contrôlés, mais la clôture officielle reste inchangée et verrouillée.
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Mouvements du jour</h2>
            <p className="text-sm text-slate-500">Paiements finalisés et ajustements contrôlés.</p>
          </div>
          <p className="text-sm font-semibold">{day.payments.length} mouvement(s)</p>
        </div>

        <div className="space-y-2">
          {day.payments.map((payment) => (
            <article key={payment.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{payment.invoice.patient.firstName} {payment.invoice.patient.lastName}</p>
                <p className="text-xs text-slate-500">Facture {payment.invoice.id.slice(0, 8)} · {payment.receivedBy.fullName} · {payment.paidAt.toLocaleString("fr-MA")}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={payment.status === PaymentStatus.ADJUSTMENT
                  ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900"
                  : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold"}
                >
                  {payment.status}
                </span>
                <span className="font-medium">{payment.method}</span>
                <span className="font-bold">{payment.amount.toFixed(2)} MAD</span>
              </div>
            </article>
          ))}
          {day.payments.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun mouvement pour cette date.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
