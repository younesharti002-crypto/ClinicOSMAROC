import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { startConsultationAction } from "@/features/consultations/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getDoctorWorkspace } from "@/server/repositories/consultations";

export default async function DoctorWorkspacePage() {
  const ctx = await requireCapability("consultation:write");
  const [workspace, clinic] = await Promise.all([
    getDoctorWorkspace(prisma, ctx),
    prisma.clinic.findUnique({
      where: { id: ctx.clinicId },
      select: { timezone: true },
    }),
  ]);

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  const formatter = new Intl.DateTimeFormat("fr-MA", {
    timeZone: clinic.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell user={ctx} title="Espace médecin">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Patients en attente</h2>
              <p className="text-sm text-slate-500">Démarrer une consultation crée le dossier EMR et verrouille le passage en consultation.</p>
            </div>
            <Link href="/queue" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              File complète
            </Link>
          </div>

          {workspace.waiting.map((appointment) => (
            <article key={appointment.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{appointment.patient.firstName} {appointment.patient.lastName}</p>
                  <p className="mt-1 text-sm text-slate-600">{appointment.type} · {formatter.format(appointment.scheduledAt)}</p>
                  <p className="text-xs text-slate-500">{appointment.patient.phone} · Dr {appointment.doctor.fullName}</p>
                </div>
                <form action={startConsultationAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                    Démarrer consultation
                  </button>
                </form>
              </div>
            </article>
          ))}

          {workspace.waiting.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
              Aucun patient en attente pour le moment.
            </div>
          ) : null}
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-bold">Consultations en cours</h2>
            <div className="space-y-2">
              {workspace.active.map((consultation) => (
                <Link
                  key={consultation.id}
                  href={`/consultations/${consultation.id}`}
                  className="block rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
                >
                  <p className="font-semibold">{consultation.patient.firstName} {consultation.patient.lastName}</p>
                  <p className="mt-1 text-xs text-slate-600">Ouverte {formatter.format(consultation.createdAt)}</p>
                </Link>
              ))}
              {workspace.active.length === 0 ? <p className="text-sm text-slate-500">Aucune consultation active.</p> : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">Consultations récentes</h2>
            <div className="space-y-2">
              {workspace.recent.map((consultation) => (
                <Link
                  key={consultation.id}
                  href={`/consultations/${consultation.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
                >
                  <p className="font-semibold">{consultation.patient.firstName} {consultation.patient.lastName}</p>
                  <p className="mt-1 text-xs text-slate-500">Terminée · {formatter.format(consultation.updatedAt)}</p>
                </Link>
              ))}
              {workspace.recent.length === 0 ? <p className="text-sm text-slate-500">Aucun historique récent.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
