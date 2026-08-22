import { AppointmentStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  finishConsultationAction,
  saveConsultationAction,
  updateMedicalProfileAction,
} from "@/features/consultations/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getConsultationWorkspace } from "@/server/repositories/consultations";

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("patient:clinical:read");
  const { id } = await params;
  const workspace = await getConsultationWorkspace(prisma, ctx, id);

  if (!workspace) {
    notFound();
  }

  const { consultation, history } = workspace;
  const isActive = consultation.appointment?.status === AppointmentStatus.IN_CONSULTATION;
  const formatter = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell user={ctx} title={`Consultation — ${consultation.patient.firstName} ${consultation.patient.lastName}`}>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Dr {consultation.doctor.fullName}</p>
                <p className="text-sm font-medium">{consultation.appointment?.type ?? "Consultation"} · {consultation.appointment?.status ?? "SANS RDV"}</p>
              </div>
              <span className={isActive
                ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"
                : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900"}
              >
                {isActive ? "EN CONSULTATION" : "TERMINÉE"}
              </span>
            </div>

            {isActive ? (
              <form className="space-y-5">
                <input type="hidden" name="consultationId" value={consultation.id} />
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Symptômes / motif clinique</span>
                  <textarea
                    name="symptoms"
                    defaultValue={consultation.symptoms ?? ""}
                    rows={5}
                    maxLength={5000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                    placeholder="Symptômes décrits, motif de consultation, évolution..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Diagnostic</span>
                  <textarea
                    name="diagnosis"
                    defaultValue={consultation.diagnosis ?? ""}
                    rows={4}
                    maxLength={5000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                    placeholder="Diagnostic clinique"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Notes cliniques</span>
                  <textarea
                    name="clinicalNotes"
                    defaultValue={consultation.clinicalNotes ?? ""}
                    rows={7}
                    maxLength={10000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                    placeholder="Examen, observations, conduite à tenir..."
                  />
                </label>

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <button
                    formAction={saveConsultationAction}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                  >
                    Enregistrer
                  </button>
                  <button
                    formAction={finishConsultationAction}
                    className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Terminer la consultation
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5 text-sm">
                <div><p className="font-semibold">Symptômes</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{consultation.symptoms ?? "—"}</p></div>
                <div><p className="font-semibold">Diagnostic</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{consultation.diagnosis ?? "—"}</p></div>
                <div><p className="font-semibold">Notes cliniques</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{consultation.clinicalNotes ?? "—"}</p></div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-bold">Historique des consultations</h2>
            <div className="space-y-4">
              {history.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap justify-between gap-2">
                    <p className="font-semibold">{formatter.format(item.createdAt)}</p>
                    <p className="text-xs text-slate-500">Dr {item.doctor.fullName}</p>
                  </div>
                  <p className="text-sm"><strong>Symptômes:</strong> {item.symptoms ?? "—"}</p>
                  <p className="mt-2 text-sm"><strong>Diagnostic:</strong> {item.diagnosis ?? "—"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600"><strong>Notes:</strong> {item.clinicalNotes ?? "—"}</p>
                </article>
              ))}
              {history.length === 0 ? <p className="text-sm text-slate-500">Aucune consultation antérieure.</p> : null}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-bold">Patient 360</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-slate-500">Téléphone</dt><dd className="font-medium">{consultation.patient.phone}</dd></div>
              <div><dt className="text-slate-500">CIN</dt><dd className="font-medium">{consultation.patient.cin ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Assurance</dt><dd className="font-medium">{consultation.patient.insuranceType}</dd></div>
              <div><dt className="text-slate-500">Immatriculation</dt><dd className="font-medium">{consultation.patient.immatriculationNo ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Affiliation</dt><dd className="font-medium">{consultation.patient.affiliationNo ?? "—"}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-bold">Profil médical</h2>
            <form action={updateMedicalProfileAction} className="space-y-4">
              <input type="hidden" name="patientId" value={consultation.patient.id} />
              <input type="hidden" name="consultationId" value={consultation.id} />
              <label className="block text-sm font-medium">
                Groupe sanguin
                <input
                  name="bloodGroup"
                  defaultValue={consultation.patient.bloodGroup ?? ""}
                  maxLength={20}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium">
                Allergies
                <textarea
                  name="allergies"
                  defaultValue={consultation.patient.allergies ?? ""}
                  maxLength={5000}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Maladies chroniques
                <textarea
                  name="chronicDiseases"
                  defaultValue={consultation.patient.chronicDiseases ?? ""}
                  maxLength={5000}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
              <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
                Mettre à jour le profil médical
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
