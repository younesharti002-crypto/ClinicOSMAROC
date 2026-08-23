import { AppointmentStatus } from "@prisma/client";
import Link from "next/link";
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

const appointmentTypeLabels: Record<string, string> = {
  BOOKED: "Sur rendez-vous",
  WALK_IN: "Sans rendez-vous",
};

const insuranceLabels: Record<string, string> = {
  AMO_CNSS: "AMO · CNSS",
  AMO_CNOPS: "AMO · CNOPS",
  PRIVATE_MUTUELLE: "Mutuelle privée",
  NONE: "Sans assurance",
};

function doctorLabel(fullName: string) {
  const name = fullName.trim();
  return /^dr\.?\s/i.test(name) ? name : `Dr ${name}`;
}

function patientAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

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
  const age = patientAge(consultation.patient.birthDate);
  const appointmentType = appointmentTypeLabels[consultation.appointment?.type ?? ""] ?? "Consultation";
  const insurance = insuranceLabels[consultation.patient.insuranceType] ?? consultation.patient.insuranceType;
  const doctor = doctorLabel(consultation.doctor.fullName);
  const formatter = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <AppShell user={ctx} title="Consultation médicale">
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: "var(--clinic-accent)" }} />
        <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ backgroundColor: "var(--clinic-primary)" }}
              aria-hidden="true"
            >
              {consultation.patient.firstName.charAt(0)}{consultation.patient.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Patient</p>
              <h2 className="mt-1 truncate text-2xl font-bold text-slate-950">
                {consultation.patient.firstName} {consultation.patient.lastName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>{consultation.patient.phone}</span>
                <span>CIN {consultation.patient.cin ?? "—"}</span>
                {age !== null ? <span>{age} ans</span> : null}
                <span>{insurance}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {appointmentType}
            </span>
            {consultation.appointment?.scheduledAt ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {formatter.format(consultation.appointment.scheduledAt)}
              </span>
            ) : null}
            <span
              className={isActive
                ? "rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900"
                : "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900"}
            >
              {isActive ? "En consultation" : "Consultation terminée"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.72fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">{doctor}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {consultation.doctor.inpeNumber ? `INPE ${consultation.doctor.inpeNumber}` : "Dossier clinique sécurisé"}
                </p>
              </div>
              <Link
                href={`/consultations/${consultation.id}/prescription`}
                className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50"
                style={{ borderColor: "var(--clinic-accent)", color: "var(--clinic-primary)" }}
              >
                Ordonnance
              </Link>
            </div>

            {isActive ? (
              <form className="space-y-0">
                <input type="hidden" name="consultationId" value={consultation.id} />

                <div className="border-b border-slate-100 p-5 md:p-6">
                  <label className="block">
                    <span className="block text-base font-bold text-slate-900">Motif & symptômes</span>
                    <span className="mt-1 block text-xs text-slate-500">Motif de consultation, symptômes décrits et évolution.</span>
                    <textarea
                      name="symptoms"
                      defaultValue={consultation.symptoms ?? ""}
                      rows={5}
                      maxLength={5000}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Décrire le motif de consultation, les symptômes et leur évolution..."
                    />
                  </label>
                </div>

                <div className="border-b border-slate-100 p-5 md:p-6">
                  <label className="block">
                    <span className="block text-base font-bold text-slate-900">Diagnostic</span>
                    <span className="mt-1 block text-xs text-slate-500">Synthèse clinique réservée au professionnel de santé.</span>
                    <textarea
                      name="diagnosis"
                      defaultValue={consultation.diagnosis ?? ""}
                      rows={4}
                      maxLength={5000}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Diagnostic clinique..."
                    />
                  </label>
                </div>

                <div className="p-5 md:p-6">
                  <label className="block">
                    <span className="block text-base font-bold text-slate-900">Notes cliniques</span>
                    <span className="mt-1 block text-xs text-slate-500">Examen, observations et conduite à tenir.</span>
                    <textarea
                      name="clinicalNotes"
                      defaultValue={consultation.clinicalNotes ?? ""}
                      rows={7}
                      maxLength={10000}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Examen clinique, observations, conduite à tenir..."
                    />
                  </label>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6">
                  <button
                    formAction={saveConsultationAction}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    Enregistrer
                  </button>
                  <button
                    formAction={finishConsultationAction}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
                    style={{ backgroundColor: "var(--clinic-primary)" }}
                  >
                    Terminer la consultation
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid gap-0 divide-y divide-slate-100">
                <div className="p-5 md:p-6">
                  <p className="text-sm font-bold text-slate-900">Motif & symptômes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{consultation.symptoms ?? "—"}</p>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-sm font-bold text-slate-900">Diagnostic</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{consultation.diagnosis ?? "—"}</p>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-sm font-bold text-slate-900">Notes cliniques</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{consultation.clinicalNotes ?? "—"}</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Historique des consultations</h2>
                <p className="mt-1 text-xs text-slate-500">Dernières consultations de ce patient dans la clinique.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{history.length}</span>
            </div>
            <div className="space-y-3">
              {history.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{formatter.format(item.createdAt)}</p>
                    <p className="text-xs text-slate-500">{doctorLabel(item.doctor.fullName)}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600">
                    <p><strong className="text-slate-800">Symptômes :</strong> {item.symptoms ?? "—"}</p>
                    <p><strong className="text-slate-800">Diagnostic :</strong> {item.diagnosis ?? "—"}</p>
                    <p className="whitespace-pre-wrap"><strong className="text-slate-800">Notes :</strong> {item.clinicalNotes ?? "—"}</p>
                  </div>
                </article>
              ))}
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Aucune consultation antérieure.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Dossier patient</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Patient 360</h2>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex items-start justify-between gap-3 py-3"><dt className="text-slate-500">Téléphone</dt><dd className="text-right font-semibold text-slate-800">{consultation.patient.phone}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="text-slate-500">CIN</dt><dd className="text-right font-semibold text-slate-800">{consultation.patient.cin ?? "—"}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="text-slate-500">Assurance</dt><dd className="text-right font-semibold text-slate-800">{insurance}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="text-slate-500">Immatriculation</dt><dd className="text-right font-semibold text-slate-800">{consultation.patient.immatriculationNo ?? "—"}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="text-slate-500">Affiliation</dt><dd className="text-right font-semibold text-slate-800">{consultation.patient.affiliationNo ?? "—"}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Informations médicales</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Profil médical</h2>
            </div>
            <form action={updateMedicalProfileAction} className="space-y-4">
              <input type="hidden" name="patientId" value={consultation.patient.id} />
              <input type="hidden" name="consultationId" value={consultation.id} />
              <label className="block text-sm font-semibold text-slate-700">
                Groupe sanguin
                <input
                  name="bloodGroup"
                  defaultValue={consultation.patient.bloodGroup ?? ""}
                  maxLength={20}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 font-normal outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Ex. O+"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Allergies
                <textarea
                  name="allergies"
                  defaultValue={consultation.patient.allergies ?? ""}
                  maxLength={5000}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 font-normal outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Allergies connues..."
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Maladies chroniques
                <textarea
                  name="chronicDiseases"
                  defaultValue={consultation.patient.chronicDiseases ?? ""}
                  maxLength={5000}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 font-normal outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Antécédents et maladies chroniques..."
                />
              </label>
              <button
                className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50"
                style={{ borderColor: "var(--clinic-accent)", color: "var(--clinic-primary)" }}
              >
                Mettre à jour le profil médical
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
