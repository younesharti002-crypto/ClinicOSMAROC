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

const roleLabels: Record<string, string> = {
  DOCTOR_ADMIN: "Médecin administrateur",
  DOCTOR: "Médecin",
  SECRETARY: "Secrétariat",
};

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
  const clinicMeta = [branding?.specialty, branding?.city].filter(Boolean).join(" · ");
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
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="h-1" style={{ backgroundColor: accentColor }} />

        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={`Logo ${clinicName}`}
                  className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                >
                  {clinicName.trim().charAt(0).toUpperCase() || "C"}
                </div>
              )}

              <div className="min-w-0">
                <Link
                  href={can(user.role, "consultation:write") ? "/doctor" : "/reception"}
                  className="block truncate text-xl font-bold tracking-tight"
                  style={{ color: primaryColor }}
                >
                  {clinicName}
                </Link>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {clinicMeta || "Cabinet médical"}
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Powered by ClinicOS
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                <p className="truncate text-sm font-semibold text-slate-800">{user.fullName}</p>
                <p className="truncate text-xs text-slate-500">{roleLabels[user.role] ?? user.role}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-xl border bg-white px-3.5 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
                  style={{ borderColor: `${primaryColor}33`, color: primaryColor }}
                >
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>

          <nav className="-mx-4 flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:-mx-6 md:px-6" aria-label="Navigation principale">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-7 w-1 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: primaryColor }}>
            {title}
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}
