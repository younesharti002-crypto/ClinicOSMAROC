import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { clinicDateKey, clinicDayRange } from "@/lib/time/clinic-time";
import { getQueue, getReceptionSnapshot } from "@/server/repositories/appointments";

export default async function ReceptionPage() {
  const ctx = await requireCapability("agenda:read");
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { timezone: true },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  const dateKey = clinicDateKey(new Date(), clinic.timezone);
  const range = clinicDayRange(dateKey, clinic.timezone);
  const [snapshot, queue] = await Promise.all([
    getReceptionSnapshot(prisma, ctx, range),
    getQueue(prisma, ctx),
  ]);

  const stats = [
    ["RDV aujourd’hui", snapshot.total],
    ["Confirmés", snapshot.confirmed],
    ["En attente", snapshot.waiting],
    ["Terminés", snapshot.completed],
    ["Sans RDV", snapshot.walkIns],
    ["Urgences", snapshot.emergencies],
  ] as const;

  return (
    <AppShell user={ctx} title="Réception">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/patients/new" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          + Patient
        </Link>
        <Link href="/appointments/new?type=BOOKED" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
          + RDV
        </Link>
        <Link href="/appointments/new?type=WALK_IN" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
          + Sans RDV
        </Link>
        <Link href="/appointments/new?type=EMERGENCY" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
          + Urgence
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">File d’attente actuelle</h2>
            <p className="text-sm text-slate-500">Ordre déterministe, urgences prioritaires.</p>
          </div>
          <Link href="/queue" className="text-sm font-semibold underline">Ouvrir la file</Link>
        </div>
        <div className="space-y-2">
          {queue.slice(0, 8).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 font-bold text-white">
                  {entry.position}
                </span>
                <div>
                  <p className="font-semibold">{entry.patient.firstName} {entry.patient.lastName}</p>
                  <p className="text-xs text-slate-500">{entry.type} · Dr {entry.doctor.fullName}</p>
                </div>
              </div>
              {entry.type === "EMERGENCY" ? (
                <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">Urgence</span>
              ) : null}
            </div>
          ))}
          {queue.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Aucun patient en attente.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
