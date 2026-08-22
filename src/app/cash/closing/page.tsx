import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { closeCashDayAction } from "@/features/cash/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { clinicDateKey } from "@/lib/time/clinic-time";
import { getCashDay } from "@/server/repositories/cash";

export default async function CashClosingPage({
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

  if (day.closing) {
    return (
      <AppShell user={ctx} title="Clôture de caisse">
        <div className="max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-bold text-emerald-950">Cette journée est déjà clôturée et verrouillée.</h2>
          <p className="mt-2 text-sm text-emerald-900">ClinicOS n’autorise pas une réouverture silencieuse. Toute correction passe par un ajustement administrateur audité.</p>
          <Link href={`/cash?date=${dateKey}`} className="mt-5 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Retour à la caisse
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={ctx} title={`Clôturer la caisse — ${dateKey}`}>
      <div className="max-w-3xl">
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          La clôture est <strong>officielle et définitive</strong>. Les montants réels sont comparés méthode par méthode. Si un montant réel diffère du théorique, un motif est obligatoire.
        </div>

        <form action={closeCashDayAction} className="rounded-xl border border-slate-200 bg-white p-5">
          <input type="hidden" name="businessDate" value={dateKey} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Espèces — théorique {day.theoretical.cash.toFixed(2)} MAD
              <input
                required
                name="actualCash"
                inputMode="decimal"
                defaultValue={day.theoretical.cash.toFixed(2)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              TPE / Carte — théorique {day.theoretical.card.toFixed(2)} MAD
              <input
                required
                name="actualCard"
                inputMode="decimal"
                defaultValue={day.theoretical.card.toFixed(2)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Chèques — théorique {day.theoretical.cheque.toFixed(2)} MAD
              <input
                required
                name="actualCheque"
                inputMode="decimal"
                defaultValue={day.theoretical.cheque.toFixed(2)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Virement — théorique {day.theoretical.transfer.toFixed(2)} MAD
              <input
                required
                name="actualTransfer"
                inputMode="decimal"
                defaultValue={day.theoretical.transfer.toFixed(2)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">Total théorique</p>
            <p className="mt-1 text-2xl font-bold">{day.theoretical.total.toFixed(2)} MAD</p>
          </div>

          <label className="mt-5 block text-sm font-medium">
            Motif / notes d’écart
            <textarea
              name="notes"
              rows={4}
              maxLength={1000}
              className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              placeholder="Obligatoire si un montant réel diffère du théorique..."
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
              Confirmer et verrouiller la journée
            </button>
            <Link href={`/cash?date=${dateKey}`} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
