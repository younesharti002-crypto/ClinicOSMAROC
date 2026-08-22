import { logoutAction } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/context";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">ClinicOS Maroc</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              Bonjour {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">Rôle: {user.role}</p>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
            >
              Se déconnecter
            </button>
          </form>
        </header>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Foundation M1</h2>
          <p className="mt-2 text-sm text-slate-600">
            Authentification, isolation par clinique et RBAC sont en cours de validation avant l&apos;ouverture des modules de réception.
          </p>
        </section>
      </div>
    </main>
  );
}
