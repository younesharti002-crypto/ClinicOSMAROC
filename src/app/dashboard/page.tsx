import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { clinicDateKey } from "@/lib/time/clinic-time";
import { getBusinessAnalytics } from "@/server/repositories/analytics";

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === Role.DOCTOR) {
    redirect("/doctor");
  }
  if (user.role === Role.SECRETARY) {
    redirect("/reception");
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { timezone: true },
  });
  if (!clinic) throw new Error("Clinic not found");

  const monthKey = clinicDateKey(new Date(), clinic.timezone).slice(0, 7);
  const analytics = await getBusinessAnalytics(prisma, user, monthKey);

  return (
    <AppShell user={user} title="Dashboard">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Situation du cabinet aujourd’hui</p>
              <h2 className="mt-1 text-2xl font-bold">{analytics.clinic.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{analytics.today.dateKey}</p>
            </div>
            <Link href="/analytics" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir les analytics
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Patients aujourd’hui", analytics.today.patients, "patients distincts"],
            ["En attente", analytics.today.waiting, "salle d’attente"],
            ["Consultations terminées", analytics.today.completed, `${analytics.today.consultations} dossier(s) de consultation créé(s)`],
            ["Encaissements aujourd’hui", `${analytics.today.revenue.total.toFixed(2)} MAD`, "paiements finalisés + ajustements"],
          ].map(([label, value, note]) => (
            <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{String(label)}</p>
              <p className="mt-2 text-3xl font-bold">{String(value)}</p>
              <p className="mt-2 text-xs text-slate-500">{String(note)}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Flux des rendez-vous</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Réservés", analytics.today.booked],
                ["Sans RDV", analytics.today.walkIns],
                ["Urgences", analytics.today.emergencies],
                ["No-show", analytics.today.noShow],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{String(label)}</p>
                  <p className="mt-1 text-xl font-bold">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Mois en cours</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Revenu", `${analytics.month.revenue.total.toFixed(2)} MAD`],
                ["Consultations", analytics.month.consultations],
                ["Nouveaux", analytics.month.newPatients],
                ["Récurrents", analytics.month.repeatPatients],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{String(label)}</p>
                  <p className="mt-1 text-xl font-bold">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link href="/reception" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Réception</Link>
          <Link href="/billing" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Facturation</Link>
          <Link href="/cash" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Caisse</Link>
          <Link href="/analytics" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Analytics détaillés</Link>
        </section>
      </div>
    </AppShell>
  );
}
