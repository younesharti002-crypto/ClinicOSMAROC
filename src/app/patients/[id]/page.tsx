import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { updateMedicalProfileAction } from "@/features/consultations/actions";
import { updatePatientAction } from "@/features/patients/actions";
import { requireCapability } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import {
  getPatientAdministrativeView,
  getPatientClinicalView,
} from "@/server/repositories/patients";

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

  const clinical = can(ctx.role, "patient:clinical:read")
    ? await getPatientClinicalView(prisma, ctx, id)
    : null;

  return (
    <AppShell user={ctx} title={`${patient.firstName} ${patient.lastName}`}>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div>
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

        {clinical ? (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-bold">Profil médical</h2>
              <form action={updateMedicalProfileAction} className="space-y-4">
                <input type="hidden" name="patientId" value={clinical.id} />
                <label className="block text-sm font-medium">
                  Groupe sanguin
                  <input name="bloodGroup" defaultValue={clinical.bloodGroup ?? ""} maxLength={20} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-medium">
                  Allergies
                  <textarea name="allergies" defaultValue={clinical.allergies ?? ""} maxLength={5000} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
                </label>
                <label className="block text-sm font-medium">
                  Maladies chroniques
                  <textarea name="chronicDiseases" defaultValue={clinical.chronicDiseases ?? ""} maxLength={5000} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
                </label>
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Enregistrer profil médical</button>
              </form>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-bold">Historique clinique</h2>
              <div className="space-y-3">
                {clinical.consultations.map((consultation) => (
                  <Link key={consultation.id} href={`/consultations/${consultation.id}`} className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                    <p className="text-xs text-slate-500">{consultation.createdAt.toLocaleDateString("fr-MA")}</p>
                    <p className="mt-1 text-sm"><strong>Diagnostic:</strong> {consultation.diagnosis ?? "—"}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{consultation.clinicalNotes ?? "Aucune note clinique"}</p>
                  </Link>
                ))}
                {clinical.consultations.length === 0 ? <p className="text-sm text-slate-500">Aucun historique clinique.</p> : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
