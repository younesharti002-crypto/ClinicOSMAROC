import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { listPatients } from "@/server/repositories/patients";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireCapability("patient:demographics:read");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const patients = await listPatients(prisma, ctx, query);

  return (
    <AppShell user={ctx} title="Patients">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form className="flex max-w-xl flex-1 gap-2" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Nom, téléphone ou CIN"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Rechercher
          </button>
        </form>
        <Link
          href="/patients/new"
          className="rounded-lg bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          + Nouveau patient
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">CIN</th>
                <th className="px-4 py-3">Assurance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="px-4 py-3 font-medium">
                    {patient.firstName} {patient.lastName}
                  </td>
                  <td className="px-4 py-3">{patient.phone}</td>
                  <td className="px-4 py-3">{patient.cin ?? "—"}</td>
                  <td className="px-4 py-3">{patient.insuranceType}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/patients/${patient.id}`} className="font-medium underline">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Aucun patient trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
