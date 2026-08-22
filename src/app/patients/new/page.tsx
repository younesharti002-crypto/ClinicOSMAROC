import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { createPatientAction } from "@/features/patients/actions";
import { requireCapability } from "@/lib/auth/context";

export default async function NewPatientPage() {
  const ctx = await requireCapability("patient:demographics:write");

  return (
    <AppShell user={ctx} title="Nouveau patient">
      <div className="max-w-4xl">
        <PatientForm action={createPatientAction} submitLabel="Créer le patient" />
      </div>
    </AppShell>
  );
}
