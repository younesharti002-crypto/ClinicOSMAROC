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
    backgroundImage:
      "linear-gradient(180deg, rgba(248,250,252,0.18) 0%, rgba(248,250,252,0.30) 45%, rgba(248,250,252,0.48) 100%), url('/premium-clinic-bg.svg')",
    backgroundSize: "cover",
    backgroundPosition: "center top",
    backgroundAttachment: "fixed",
    backgroundRepeat: "no-repeat",
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
    <main className="relative min-h-screen bg-slate-100 text-slate-950" style={brandStyle}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(circle at 88% 10%, ${accentColor}26 0, transparent 32%), radial-gradient(circle at 6% 88%, ${primaryColor}20 0, transparent 34%)`,
        }}
        aria-hidden="true"
      />

      <header className="relative z-20 border-b border-white/70 bg-white/82 shadow-[0_10px_34px_rgba(15,23,42,0.09)] backdrop-blur-xl">
        <div className="h-1" style={{ backgroundColor: accentColor }} />

        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={`Logo ${clinicName}`}
                  className="h-12 w-12 shrink-0 rounded-2xl border border-white/80 bg-white/95 object-contain p-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.10)]"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-[0_10px_26px_rgba(15,23,42,0.16)]"
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
              <div className="min-w-0 rounded-xl border border-white/85 bg-white/76 px-3 py-2 text-right shadow-sm backdrop-blur-md">
                <p className="truncate text-sm font-semibold text-slate-800">{user.fullName}</p>
                <p className="truncate text-xs text-slate-500">{roleLabels[user.role] ?? user.role}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-xl border bg-white/78 px-3.5 py-2.5 text-sm font-semibold shadow-sm backdrop-blur-md transition hover:bg-white"
                  style={{ borderColor: `${primaryColor}33`, color: primaryColor }}
                >
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>

          <nav className="-mx-4 flex gap-1 overflow-x-auto border-t border-slate-200/60 px-4 py-2 md:-mx-6 md:px-6" aria-label="Navigation principale">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/85 hover:text-slate-950 hover:shadow-sm"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/65 bg-white/52 px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur-md md:px-5">
          <div className="h-8 w-1 rounded-full shadow-sm" style={{ backgroundColor: accentColor }} aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: primaryColor }}>
            {title}
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}
