import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { updatePatientAction } from "@/features/patients/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getPatientAdministrativeView } from "@/server/repositories/patients";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("patient:demographics:read");
  const { id } = await params;
  const patient = await getPatientAdministrativeView(prisma, ctx, id);

  if (!patient) {
    notFound();
  }

  return (
    <AppShell user={ctx} title={`${patient.firstName} ${patient.lastName}`}>
      <div className="max-w-4xl">
        {can(ctx.role, "patient:demographics:write") ? (
          <PatientForm
            action={updatePatientAction}
            patient={patient}
            submitLabel="Enregistrer les informations administratives"
          />
        ) : (
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
            <p><span className="text-slate-500">Téléphone:</span> {patient.phone}</p>
            <p><span className="text-slate-500">CIN:</span> {patient.cin ?? "—"}</p>
            <p><span className="text-slate-500">Assurance:</span> {patient.insuranceType}</p>
            <p><span className="text-slate-500">Immatriculation:</span> {patient.immatriculationNo ?? "—"}</p>
            <p><span className="text-slate-500">Affiliation:</span> {patient.affiliationNo ?? "—"}</p>
            <p><span className="text-slate-500">Adresse:</span> {patient.address ?? "—"}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
