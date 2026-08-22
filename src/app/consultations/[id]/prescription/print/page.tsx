import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print-button";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getPrescriptionWorkspace } from "@/server/repositories/prescriptions";

export default async function PrescriptionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("patient:clinical:read");
  const { id } = await params;
  const workspace = await getPrescriptionWorkspace(prisma, ctx, id);

  if (!workspace) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white p-8 text-slate-950 md:p-12 print:p-0">
      <div className="mb-8 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="border-b-2 border-slate-900 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{workspace.clinic.name}</h1>
            <p className="mt-1 text-sm">{workspace.clinic.address}, {workspace.clinic.city}</p>
            <p className="text-sm">Tél: {workspace.clinic.phone}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Dr {workspace.doctor.fullName}</p>
            <p className="text-sm">INPE: {workspace.doctor.inpeNumber ?? workspace.clinic.inpeNumber ?? "—"}</p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p><strong>Patient:</strong> {workspace.patient.firstName} {workspace.patient.lastName}</p>
            <p><strong>CIN:</strong> {workspace.patient.cin ?? "—"}</p>
          </div>
          <p><strong>Date:</strong> {workspace.createdAt.toLocaleDateString("fr-MA")}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-6 text-center text-2xl font-bold">ORDONNANCE</h2>
        <div className="space-y-6">
          {workspace.prescriptions.map((line, index) => (
            <article key={line.id} className="break-inside-avoid">
              <p className="text-lg font-bold">{index + 1}. {line.medicationName}{line.isGeneric ? " — Générique" : ""}</p>
              <p className="mt-1">Posologie: {line.dosage}</p>
              <p>Durée: {line.duration}</p>
              {line.instructions ? <p className="mt-1 text-sm">Instructions: {line.instructions}</p> : null}
            </article>
          ))}
          {workspace.prescriptions.length === 0 ? <p className="text-center text-slate-500">Aucune prescription.</p> : null}
        </div>
      </section>

      <footer className="mt-20 flex justify-end">
        <div className="w-64 border-t border-slate-400 pt-3 text-center text-sm">Signature et cachet du médecin</div>
      </footer>
    </main>
  );
}
