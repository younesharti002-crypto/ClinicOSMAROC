import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { transitionAppointmentAction } from "@/features/appointments/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import {
  addDaysDateKey,
  clinicDateKey,
  clinicDayRange,
  clinicWeekRange,
} from "@/lib/time/clinic-time";
import {
  listAgendaAppointments,
  listDoctorsForAgenda,
} from "@/server/repositories/appointments";

function TransitionButton({
  appointmentId,
  status,
  children,
  emphasis = false,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <form action={transitionAppointmentAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button
        name="status"
        value={status}
        className={
          emphasis
            ? "rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
            : "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
        }
      >
        {children}
      </button>
    </form>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; doctorId?: string }>;
}) {
  const ctx = await requireCapability("agenda:read");
  const params = await searchParams;
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { timezone: true },
  });
  if (!clinic) throw new Error("Clinic not found");

  const today = clinicDateKey(new Date(), clinic.timezone);
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;
  const view = params.view === "week" ? "week" : "day";
  const weekRange = view === "week" ? clinicWeekRange(dateKey, clinic.timezone) : null;
  const range = weekRange ?? clinicDayRange(dateKey, clinic.timezone);
  const doctorId = params.doctorId || undefined;

  const [appointments, doctors] = await Promise.all([
    listAgendaAppointments(prisma, ctx, { start: range.start, end: range.end }, doctorId),
    listDoctorsForAgenda(prisma, ctx),
  ]);

  const delta = view === "week" ? 7 : 1;
  const previousDate = addDaysDateKey(dateKey, -delta);
  const nextDate = addDaysDateKey(dateKey, delta);
  const formatter = new Intl.DateTimeFormat("fr-MA", {
    timeZone: clinic.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell user={ctx} title="Agenda">
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link href={`/agenda?date=${previousDate}&view=${view}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">←</Link>
          <Link href={`/agenda?date=${today}&view=${view}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Aujourd’hui</Link>
          <Link href={`/agenda?date=${nextDate}&view=${view}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">→</Link>
          <Link href={`/agenda?date=${dateKey}&view=day`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Jour</Link>
          <Link href={`/agenda?date=${dateKey}&view=week`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Semaine</Link>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="view" value={view} />
          <label className="text-xs font-medium text-slate-600">
            Médecin
            <select name="doctorId" defaultValue={doctorId ?? ""} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Tous</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
            </select>
          </label>
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Filtrer</button>
        </form>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {view === "week" && weekRange ? `${weekRange.startKey} → ${addDaysDateKey(weekRange.endKey, -1)}` : dateKey}
        </p>
        {can(ctx.role, "agenda:write") ? (
          <Link href="/appointments/new?type=BOOKED" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">+ RDV</Link>
        ) : null}
      </div>

      <div className="space-y-3">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{appointment.patient.firstName} {appointment.patient.lastName}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{appointment.type}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{appointment.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{formatter.format(appointment.scheduledAt)} · Dr {appointment.doctor.fullName} · {appointment.durationMinutes} min</p>
                <p className="text-xs text-slate-500">{appointment.patient.phone}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {can(ctx.role, "agenda:write") && appointment.status === AppointmentStatus.SCHEDULED ? (
                  <TransitionButton appointmentId={appointment.id} status={AppointmentStatus.CONFIRMED}>Confirmer</TransitionButton>
                ) : null}
                {can(ctx.role, "queue:manage") && [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED].includes(appointment.status) ? (
                  <TransitionButton appointmentId={appointment.id} status={AppointmentStatus.WAITING_ROOM} emphasis>Arrivé</TransitionButton>
                ) : null}
                {can(ctx.role, "agenda:write") && [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED].includes(appointment.status) ? (
                  <>
                    <TransitionButton appointmentId={appointment.id} status={AppointmentStatus.NO_SHOW}>Absent</TransitionButton>
                    <TransitionButton appointmentId={appointment.id} status={AppointmentStatus.CANCELLED}>Annuler</TransitionButton>
                  </>
                ) : null}
                {appointment.status === AppointmentStatus.WAITING_ROOM ? (
                  <Link href="/queue" className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold">Voir file</Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">Aucun rendez-vous sur cette période.</div>
        ) : null}
      </div>
    </AppShell>
  );
}
