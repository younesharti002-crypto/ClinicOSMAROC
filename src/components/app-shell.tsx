import Link from "next/link";

import type { AuthContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { logoutAction } from "@/features/auth/actions";

const navigation = [
  ["Réception", "/reception"],
  ["Patients", "/patients"],
  ["Agenda", "/agenda"],
  ["File d’attente", "/queue"],
] as const;

export function AppShell({
  user,
  title,
  children,
}: {
  user: AuthContext;
  title: string;
  children: React.ReactNode;
}) {
  const links = can(user.role, "consultation:write")
    ? [["Médecin", "/doctor"] as const, ...navigation]
    : navigation;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <Link href={can(user.role, "consultation:write") ? "/doctor" : "/reception"} className="text-lg font-bold tracking-tight">
              ClinicOS Maroc
            </Link>
            <p className="text-xs text-slate-500">{user.fullName} · {user.role}</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
