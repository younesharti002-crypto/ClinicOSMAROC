import Link from "next/link";

import { LoginForm } from "@/features/auth/login-form";
import { prisma } from "@/lib/db";
import { getPublicLoginBranding } from "@/server/repositories/branding";

export default async function LoginPage() {
  const branding = await getPublicLoginBranding(prisma);
  const clinicName = branding?.name ?? "ClinicOS Maroc";
  const primaryColor = branding?.brandPrimaryColor ?? "#0F172A";
  const accentColor = branding?.brandAccentColor ?? "#0F766E";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: accentColor }} />
        <div className="p-6">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-3">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={`Logo ${clinicName}`}
                  className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                >
                  {clinicName.trim().charAt(0).toUpperCase() || "C"}
                </div>
              )}
              <div>
                <p className="text-base font-semibold" style={{ color: primaryColor }}>{clinicName}</p>
                <p className="text-xs text-slate-500">
                  {branding?.specialty ? `${branding.specialty} · ` : ""}ClinicOS Maroc
                </p>
              </div>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Connexion</h1>
            <p className="mt-2 text-sm text-slate-600">
              Accès réservé au personnel autorisé de la clinique.
            </p>
          </div>
          <LoginForm />
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              ← Retour au site ClinicOS Maroc
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-6 max-w-md text-center text-xs leading-relaxed text-slate-500">
        <p>© 2026 ClinicOS Maroc — Agence Digital HARTI. Tous droits réservés · جميع الحقوق محفوظة.</p>
        <p className="mt-1 text-[11px] text-slate-400" title="Référence interne du produit">
          Réf. produit : HARTI-CLINICOS-2026-001
        </p>
      </footer>
    </main>
  );
}
