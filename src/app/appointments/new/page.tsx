import { AppointmentType } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { createAppointmentAction } from "@/features/appointments/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { formatClinicDateTimeInput } from "@/lib/time/clinic-time";
import { listDoctorsForAgenda } from "@/server/repositories/appointments";
import { listPatients } from "@/server/repositories/patients";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; patientId?: string }>;
}) {
  const ctx = await requireCapability("agenda:write");
  const params = await searchParams;
  const requestedType = Object.values(AppointmentType).includes(params.type as AppointmentType)
    ? (params.type as AppointmentType)
    : AppointmentType.BOOKED;

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { timezone: true },
  });
  if (!clinic) throw new Error("Clinic not found");

  const [patients, doctors] = await Promise.all([
    listPatients(prisma, ctx, "", 100),
    listDoctorsForAgenda(prisma, ctx),
  ]);

  const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  const defaultDateTime = formatClinicDateTimeInput(new Date(), clinic.timezone);

  return (
    <AppShell user={ctx} title="Nouveau passage / rendez-vous">
      <form action={createAppointmentAction} className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Type
            <select name="type" defaultValue={requestedType} className={fieldClass}>
              <option value="BOOKED">Rendez-vous</option>
              <option value="WALK_IN">Sans RDV</option>
              <option value="EMERGENCY">Urgence</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Durée estimée
            <select name="durationMinutes" defaultValue="20" className={fieldClass}>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">
          Patient
          <select name="patientId" required defaultValue={params.patientId ?? ""} className={fieldClass}>
            <option value="" disabled>Sélectionner un patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName} · {patient.phone}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Médecin
          <select name="doctorId" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Sélectionner un médecin</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Date et heure
          <input
            type="datetime-local"
            name="scheduledAt"
            defaultValue={defaultDateTime}
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Obligatoire pour un RDV. Pour Sans RDV/Urgence, l’heure d’arrivée est utilisée.
          </span>
        </label>

        <label className="block text-sm font-medium">
          Note administrative
          <textarea name="notes" rows={3} maxLength={500} className={fieldClass} />
        </label>

        <button className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
          Enregistrer
        </button>
      </form>
    </AppShell>
  );
}
