import { AppointmentStatus, AppointmentType } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { transitionAppointmentAction } from "@/features/appointments/actions";
import { startConsultationAction } from "@/features/consultations/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getQueue } from "@/server/repositories/appointments";

function QueueAction({
  appointmentId,
  status,
  label,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  label: string;
}) {
  return (
    <form action={transitionAppointmentAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button
        name="status"
        value={status}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
      >
        {label}
      </button>
    </form>
  );
}

export default async function QueuePage() {
  const ctx = await requireCapability("queue:manage");
  const queue = await getQueue(prisma, ctx);

  return (
    <AppShell user={ctx} title="File d’attente">
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <strong className="text-slate-950">Règle M2:</strong> urgence en premier, RDV protégé autour de son créneau, sans-RDV intercalés selon leur arrivée. La position est calculée à chaque lecture, donc aucun numéro actif ne peut être dupliqué.
      </div>

      <div className="space-y-3">
        {queue.map((entry) => (
          <article
            key={entry.id}
            className={entry.type === AppointmentType.EMERGENCY
              ? "rounded-xl border border-rose-300 bg-rose-50 p-4"
              : "rounded-xl border border-slate-200 bg-white p-4"}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white">
                  {entry.position}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{entry.patient.firstName} {entry.patient.lastName}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{entry.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Dr {entry.doctor.fullName} · {entry.patient.phone}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {can(ctx.role, "consultation:write") ? (
                  <form action={startConsultationAction}>
                    <input type="hidden" name="appointmentId" value={entry.id} />
                    <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                      Démarrer consultation
                    </button>
                  </form>
                ) : null}
                {can(ctx.role, "agenda:write") ? (
                  <>
                    <QueueAction appointmentId={entry.id} status={AppointmentStatus.NO_SHOW} label="Absent" />
                    <QueueAction appointmentId={entry.id} status={AppointmentStatus.CANCELLED} label="Annuler" />
                  </>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
            La file d’attente est vide.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
