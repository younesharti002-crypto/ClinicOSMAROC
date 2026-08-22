import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  addPrescriptionLineAction,
  removePrescriptionLineAction,
} from "@/features/prescriptions/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getPrescriptionWorkspace } from "@/server/repositories/prescriptions";

export default async function PrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("prescription:write");
  const { id } = await params;
  const workspace = await getPrescriptionWorkspace(prisma, ctx, id);

  if (!workspace) {
    notFound();
  }

  return (
    <AppShell user={ctx} title={`Ordonnance — ${workspace.patient.firstName} ${workspace.patient.lastName}`}>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Lignes de prescription</h2>
              <p className="text-sm text-slate-500">Aucune recommandation médicamenteuse autonome n’est générée par ClinicOS.</p>
            </div>
            <Link href={`/consultations/${id}/prescription/print`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
              Aperçu imprimable
            </Link>
          </div>

          <div className="space-y-3">
            {workspace.prescriptions.map((line, index) => (
              <article key={line.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{index + 1}. {line.medicationName} {line.isGeneric ? "(Générique)" : ""}</p>
                    <p className="mt-1 text-sm text-slate-700">Posologie: {line.dosage}</p>
                    <p className="text-sm text-slate-700">Durée: {line.duration}</p>
                    {line.instructions ? <p className="mt-2 text-sm text-slate-500">{line.instructions}</p> : null}
                  </div>
                  <form action={removePrescriptionLineAction}>
                    <input type="hidden" name="consultationId" value={id} />
                    <input type="hidden" name="prescriptionId" value={line.id} />
                    <button className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700">Supprimer</button>
                  </form>
                </div>
              </article>
            ))}
            {workspace.prescriptions.length === 0 ? <p className="text-sm text-slate-500">Aucune ligne ajoutée.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold">Ajouter un médicament</h2>
          <form action={addPrescriptionLineAction} className="space-y-4">
            <input type="hidden" name="consultationId" value={id} />
            <label className="block text-sm font-medium">Médicament
              <input required name="medicationName" maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium">Posologie
              <input required name="dosage" maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Ex: 1 comprimé matin et soir" />
            </label>
            <label className="block text-sm font-medium">Durée
              <input required name="duration" maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Ex: 7 jours" />
            </label>
            <label className="block text-sm font-medium">Instructions
              <textarea name="instructions" maxLength={1000} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="isGeneric" value="true" /> Médicament générique
            </label>
            <button className="w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Ajouter à l’ordonnance</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
