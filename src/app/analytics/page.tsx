import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { clinicDateKey } from "@/lib/time/clinic-time";
import { getBusinessAnalytics } from "@/server/repositories/analytics";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-MA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function percentWidth(value: number, maximum: number) {
  if (maximum <= 0) return "0%";
  return `${Math.max(2, Math.round((value / maximum) * 100))}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireCapability("analytics:business");
  const params = await searchParams;
  const defaultMonth = clinicDateKey(new Date(), "Africa/Casablanca").slice(0, 7);
  const monthKey = params.month && MONTH_PATTERN.test(params.month) ? params.month : defaultMonth;
  const analytics = await getBusinessAnalytics(prisma, ctx, monthKey);

  const activeDays = analytics.daily.filter(
    (day) => day.appointments > 0 || !day.revenue.eq(0),
  );
  const maxDailyRevenue = activeDays.reduce(
    (max, day) => Math.max(max, Number(day.revenue.toFixed(2))),
    0,
  );
  const maxMethodRevenue = Math.max(
    Number(analytics.month.revenue.cash.toFixed(2)),
    Number(analytics.month.revenue.card.toFixed(2)),
    Number(analytics.month.revenue.cheque.toFixed(2)),
    Number(analytics.month.revenue.transfer.toFixed(2)),
    0,
  );

  const paymentMethods = [
    ["Espèces", analytics.month.revenue.cash],
    ["TPE / Carte", analytics.month.revenue.card],
    ["Chèque", analytics.month.revenue.cheque],
    ["Virement", analytics.month.revenue.transfer],
  ] as const;

  return (
    <AppShell user={ctx} title="Analytics">
      <div className="space-y-6">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Période analysée</p>
            <p className="text-lg font-bold capitalize">{monthLabel(monthKey)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/analytics?month=${shiftMonth(monthKey, -1)}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              ← Mois précédent
            </Link>
            <form className="flex items-center gap-2">
              <input
                type="month"
                name="month"
                defaultValue={monthKey}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                Afficher
              </button>
            </form>
            <Link
              href={`/analytics?month=${shiftMonth(monthKey, 1)}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              Mois suivant →
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Encaissements nets</p>
            <p className="mt-2 text-3xl font-bold">{analytics.month.revenue.total.toFixed(2)} MAD</p>
            <p className="mt-2 text-xs text-slate-500">Paiements finalisés + ajustements audités</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Consultations terminées</p>
            <p className="mt-2 text-3xl font-bold">{analytics.month.completed}</p>
            <p className="mt-2 text-xs text-slate-500">Taux de réalisation {analytics.month.completionRate}%</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">No-show</p>
            <p className="mt-2 text-3xl font-bold">{analytics.month.noShowRate}%</p>
            <p className="mt-2 text-xs text-slate-500">{analytics.month.noShow} absence(s) enregistrée(s)</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Nouveaux patients</p>
            <p className="mt-2 text-3xl font-bold">{analytics.month.newPatients}</p>
            <p className="mt-2 text-xs text-slate-500">Créés pendant la période</p>
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Aujourd’hui · {analytics.today.dateKey}</h2>
              <p className="text-sm text-slate-500">Vue opérationnelle du cabinet</p>
            </div>
            <p className="text-2xl font-bold">{analytics.today.total} RDV</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
            {[
              ["Planifiés", analytics.today.scheduled],
              ["Confirmés", analytics.today.confirmed],
              ["En attente", analytics.today.waiting],
              ["En consultation", analytics.today.inConsultation],
              ["Terminés", analytics.today.completed],
              ["No-show", analytics.today.noShow],
              ["Annulés", analytics.today.cancelled],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Encaissements par mode</h2>
            <p className="mb-5 text-sm text-slate-500">Répartition nette sur la période sélectionnée</p>
            <div className="space-y-4">
              {paymentMethods.map(([label, amount]) => {
                const numeric = Number(amount.toFixed(2));
                return (
                  <div key={label}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{label}</span>
                      <span>{amount.toFixed(2)} MAD</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: percentWidth(Math.max(0, numeric), maxMethodRevenue) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Activité du mois</h2>
            <p className="mb-5 text-sm text-slate-500">Jours avec rendez-vous ou encaissement</p>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {activeDays.map((day) => {
                const revenue = Number(day.revenue.toFixed(2));
                return (
                  <div key={day.dateKey} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">{day.dateKey}</span>
                      <span>{day.revenue.toFixed(2)} MAD</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: percentWidth(Math.max(0, revenue), maxDailyRevenue) }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {day.appointments} RDV · {day.completed} terminé(s) · {day.noShow} no-show
                    </p>
                  </div>
                );
              })}
              {activeDays.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune activité sur cette période.</p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold">Performance des médecins</h2>
            <p className="text-sm text-slate-500">Volumes administratifs uniquement — aucune donnée clinique exposée.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Médecin</th>
                  <th className="px-3 py-3 text-right">RDV</th>
                  <th className="px-3 py-3 text-right">Terminés</th>
                  <th className="px-3 py-3 text-right">No-show</th>
                  <th className="px-3 py-3 text-right">Réalisation</th>
                </tr>
              </thead>
              <tbody>
                {analytics.doctors.map((doctor) => (
                  <tr key={doctor.doctorId} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-semibold">{doctor.doctorName}</td>
                    <td className="px-3 py-3 text-right">{doctor.appointments}</td>
                    <td className="px-3 py-3 text-right">{doctor.completed}</td>
                    <td className="px-3 py-3 text-right">{doctor.noShow}</td>
                    <td className="px-3 py-3 text-right font-semibold">{doctor.completionRate}%</td>
                  </tr>
                ))}
                {analytics.doctors.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Aucun médecin actif.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">RDV du mois</p>
            <p className="mt-1 text-2xl font-bold">{analytics.month.totalAppointments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">RDV actifs hors annulations</p>
            <p className="mt-1 text-2xl font-bold">{analytics.month.activeAppointments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Annulations</p>
            <p className="mt-1 text-2xl font-bold">{analytics.month.cancelled}</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
