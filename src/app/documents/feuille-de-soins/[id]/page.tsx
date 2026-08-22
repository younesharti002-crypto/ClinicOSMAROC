import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print-button";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getFeuilleDeSoins } from "@/server/repositories/billing";

export default async function FeuilleDeSoinsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCapability("invoice:read");
  const { id } = await params;
  const document = await getFeuilleDeSoins(prisma, ctx, id);

  if (!document) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white p-8 text-slate-950 md:p-12 print:p-0">
      <div className="mb-8 flex justify-end print:hidden">
        <PrintButton label="Imprimer / Enregistrer PDF" />
      </div>

      <header className="border-b-2 border-slate-900 pb-5 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide">Feuille de soins — Cabinet médical</p>
        <h1 className="mt-2 text-2xl font-bold">{document.clinic.name}</h1>
        <p className="mt-1 text-sm">{document.clinic.address}, {document.clinic.city} · {document.clinic.phone}</p>
      </header>

      <section className="mt-8 grid gap-5 border border-slate-900 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Assuré / Patient</p>
          <p className="mt-2 text-lg font-bold">{document.patient.firstName} {document.patient.lastName}</p>
          <p className="mt-2 text-sm"><strong>CIN:</strong> {document.patient.cin ?? "—"}</p>
          <p className="text-sm"><strong>Téléphone:</strong> {document.patient.phone}</p>
          <p className="text-sm"><strong>Organisme:</strong> {document.patient.insuranceType}</p>
          <p className="text-sm"><strong>N° Immatriculation:</strong> {document.patient.immatriculationNo ?? "—"}</p>
          <p className="text-sm"><strong>N° Affiliation:</strong> {document.patient.affiliationNo ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Médecin traitant</p>
          <p className="mt-2 text-lg font-bold">Dr {document.consultation?.doctor.fullName ?? "—"}</p>
          <p className="mt-2 text-sm"><strong>INPE:</strong> {document.consultation?.doctor.inpeNumber ?? document.clinic.inpeNumber ?? "—"}</p>
          <p className="text-sm"><strong>Date de consultation:</strong> {document.consultation?.createdAt.toLocaleDateString("fr-MA") ?? "—"}</p>
        </div>
      </section>

      <section className="mt-8 border border-slate-900 p-5">
        <h2 className="text-sm font-bold uppercase">Acte / facturation</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Référence facture</p>
            <p className="font-semibold">{document.id}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Montant</p>
            <p className="text-xl font-bold">{document.totalAmount.toFixed(2)} MAD</p>
          </div>
        </div>
        <div className="mt-8 h-16 border-b border-dotted border-slate-400 text-sm text-slate-500">Observations / acte médical:</div>
      </section>

      <footer className="mt-14 grid gap-12 sm:grid-cols-2">
        <div className="border-t border-slate-500 pt-3 text-center text-sm">Signature de l’assuré</div>
        <div className="border-t border-slate-500 pt-3 text-center text-sm">Signature et cachet du médecin</div>
      </footer>
    </main>
  );
}
