import { AppShell } from "@/components/app-shell";
import { updateClinicSettingsAction } from "@/features/admin/actions";
import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getClinicSettings } from "@/server/repositories/admin";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ClinicSettingsPage({ searchParams }: PageProps) {
  const user = await requireCapability("clinic:settings:manage");
  const [clinic, params] = await Promise.all([
    getClinicSettings(prisma, user),
    searchParams,
  ]);

  if (!clinic) {
    throw new Error("Clinique introuvable");
  }

  return (
    <AppShell user={user} title="Paramètres de la clinique">
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

        <form action={updateClinicSettingsAction} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Identité du cabinet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Le slug tenant reste fixe pour éviter les changements d’identité accidentels.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">
                Nom de la clinique
                <input name="name" required defaultValue={clinic.name} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Slug
                <input value={clinic.slug} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-500" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Téléphone
                <input name="phone" required defaultValue={clinic.phone} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Ville
                <input name="city" required defaultValue={clinic.city} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium md:col-span-2">
                Adresse
                <input name="address" required defaultValue={clinic.address} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                INPE clinique / médecin responsable
                <input name="inpeNumber" defaultValue={clinic.inpeNumber ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Fuseau horaire
                <input name="timezone" value="Africa/Casablanca" readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-600" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">WhatsApp de la clinique</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ici on enregistre uniquement la configuration non secrète propre à cette clinique. Les tokens Meta restent dans les secrets du déploiement et ne sont jamais stockés dans la base.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-medium md:col-span-2">
                <input name="whatsappEnabled" type="checkbox" defaultChecked={clinic.whatsappEnabled} className="h-4 w-4" />
                Activer les rappels WhatsApp pour cette clinique
              </label>
              <label className="space-y-1 text-sm font-medium">
                Phone Number ID
                <input name="whatsappPhoneNumberId" defaultValue={clinic.whatsappPhoneNumberId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Template reminder approuvé
                <input name="whatsappReminderTemplate" defaultValue={clinic.whatsappReminderTemplate ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Langue du template
                <select name="whatsappLanguageCode" defaultValue={clinic.whatsappLanguageCode === "ar" ? "ar" : "fr"} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                </select>
              </label>
            </div>
          </section>

          <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Enregistrer les paramètres
          </button>
        </form>
      </div>
    </AppShell>
  );
}
