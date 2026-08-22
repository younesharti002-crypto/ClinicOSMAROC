import type { CSSProperties } from "react";
import Link from "next/link";

import type { AuthContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/features/auth/actions";
import { getClinicBranding } from "@/server/repositories/branding";

const navigation = [
  { label: "Réception", href: "/reception" },
  { label: "Patients", href: "/patients" },
  { label: "Agenda", href: "/agenda" },
  { label: "File d’attente", href: "/queue" },
] as const;

type BrandStyle = CSSProperties & {
  "--clinic-primary": string;
  "--clinic-accent": string;
};

export async function AppShell({
  user,
  title,
  children,
}: {
  user: AuthContext;
  title: string;
  children: React.ReactNode;
}) {
  const links: Array<{ label: string; href: string }> = [];
  const branding = await getClinicBranding(prisma, user);
  const clinicName = branding?.name ?? "ClinicOS Maroc";
  const primaryColor = branding?.brandPrimaryColor ?? "#0F172A";
  const accentColor = branding?.brandAccentColor ?? "#0F766E";
  const brandStyle: BrandStyle = {
    "--clinic-primary": primaryColor,
    "--clinic-accent": accentColor,
  };

  if (can(user.role, "consultation:write")) {
    links.push({ label: "Médecin", href: "/doctor" });
  }

  links.push(...navigation);

  if (can(user.role, "invoice:read")) {
    links.push({ label: "Facturation", href: "/billing" });
  }

  if (can(user.role, "cash:close")) {
    links.push({ label: "Caisse", href: "/cash" });
  }

  if (can(user.role, "analytics:business")) {
    links.push({ label: "Analytics", href: "/analytics" });
  }

  if (can(user.role, "staff:manage")) {
    links.push({ label: "Équipe", href: "/staff" });
  }

  if (can(user.role, "clinic:settings:manage")) {
    links.push({ label: "Paramètres", href: "/settings/clinic" });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950" style={brandStyle}>
      <header className="border-b border-slate-200 border-t-4 bg-white" style={{ borderTopColor: accentColor }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={`Logo ${clinicName}`}
                className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-contain p-1"
              />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white"
                style={{ backgroundColor: primaryColor }}
                aria-hidden="true"
              >
                {clinicName.trim().charAt(0).toUpperCase() || "C"}
              </div>
            )}
            <div>
              <Link
                href={can(user.role, "consultation:write") ? "/doctor" : "/reception"}
                className="text-lg font-bold tracking-tight"
                style={{ color: primaryColor }}
              >
                {clinicName}
              </Link>
              <p className="text-xs text-slate-500">
                {branding?.specialty ? `${branding.specialty} · ` : ""}ClinicOS Maroc
              </p>
              <p className="text-xs text-slate-400">{user.fullName} · {user.role}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map(({ label, href }) => (
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
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: primaryColor }}>{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
