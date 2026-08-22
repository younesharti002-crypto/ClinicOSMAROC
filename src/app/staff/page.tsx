import { Role } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { createStaffAction, setStaffActiveAction } from "@/features/admin/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { listStaff } from "@/server/repositories/admin";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const roleLabel: Record<Role, string> = {
  [Role.DOCTOR_ADMIN]: "Médecin administrateur",
  [Role.DOCTOR]: "Médecin",
  [Role.SECRETARY]: "Secrétaire",
};

export default async function StaffPage({ searchParams }: PageProps) {
  const user = await requireCapability("staff:manage");
  const [staff, params] = await Promise.all([listStaff(prisma, user), searchParams]);

  return (
    <AppShell user={user} title="Équipe">
      <div className="space-y-6">
        {params.success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {params.success}
          </div>
        ) : null}
        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Ajouter un membre</h2>
            <p className="mt-1 text-sm text-slate-500">
              Le rôle est appliqué côté serveur. Aucun membre ne peut choisir sa clinique ou ses permissions.
            </p>
          </div>

          <form action={createStaffAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">
              Nom complet
              <input name="fullName" required minLength={2} maxLength={120} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              E-mail
              <input name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Mot de passe initial
              <input name="password" type="password" required minLength={12} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Rôle
              <select name="role" defaultValue={Role.SECRETARY} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option value={Role.SECRETARY}>Secrétaire</option>
                <option value={Role.DOCTOR}>Médecin</option>
                <option value={Role.DOCTOR_ADMIN}>Médecin administrateur</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Téléphone
              <input name="phone" placeholder="+212..." className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              INPE
              <input name="inpeNumber" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Ajouter à l’équipe
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Membres de la clinique</h2>
            <p className="mt-1 text-sm text-slate-500">{staff.length} compte(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Membre</th>
                  <th className="px-5 py-3">Rôle</th>
                  <th className="px-5 py-3">Contact / INPE</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-4">
                      <div className="font-medium">{member.fullName}</div>
                      <div className="text-slate-500">{member.email}</div>
                    </td>
                    <td className="px-5 py-4">{roleLabel[member.role]}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{member.phone ?? "—"}</div>
                      <div>{member.inpeNumber ? `INPE ${member.inpeNumber}` : ""}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {member.isActive ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <form action={setStaffActiveAction}>
                        <input type="hidden" name="staffUserId" value={member.id} />
                        <input type="hidden" name="nextActive" value={member.isActive ? "false" : "true"} />
                        <button
                          type="submit"
                          disabled={member.id === user.userId && member.isActive}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {member.isActive ? "Désactiver" : "Réactiver"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
