import type { InsuranceType } from "@prisma/client";

export type PatientFormValue = {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  cin?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  address?: string | null;
  insuranceType?: InsuranceType;
  immatriculationNo?: string | null;
  affiliationNo?: string | null;
};

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function PatientForm({
  action,
  patient = {},
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  patient?: PatientFormValue;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
      {patient.id ? <input type="hidden" name="patientId" value={patient.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Prénom *
          <input name="firstName" required defaultValue={patient.firstName ?? ""} className={fieldClass} />
        </label>
        <label className="text-sm font-medium">
          Nom *
          <input name="lastName" required defaultValue={patient.lastName ?? ""} className={fieldClass} />
        </label>
        <label className="text-sm font-medium">
          Téléphone marocain *
          <input
            name="phone"
            required
            placeholder="+2126XXXXXXXX"
            defaultValue={patient.phone ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          CIN
          <input name="cin" defaultValue={patient.cin ?? ""} className={fieldClass} />
        </label>
        <label className="text-sm font-medium">
          Date de naissance
          <input
            type="date"
            name="birthDate"
            defaultValue={patient.birthDate?.toISOString().slice(0, 10) ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          Sexe
          <select name="gender" defaultValue={patient.gender ?? ""} className={fieldClass}>
            <option value="">Non renseigné</option>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
            <option value="OTHER">Autre</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        Adresse
        <textarea name="address" defaultValue={patient.address ?? ""} className={fieldClass} rows={2} />
      </label>

      <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-3">
        <label className="text-sm font-medium">
          Couverture
          <select
            name="insuranceType"
            defaultValue={patient.insuranceType ?? "NONE"}
            className={fieldClass}
          >
            <option value="NONE">Aucune</option>
            <option value="AMO_CNSS">AMO CNSS</option>
            <option value="AMO_CNOPS">AMO CNOPS</option>
            <option value="PRIVATE_MUTUELLE">Mutuelle privée</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          N° Immatriculation
          <input
            name="immatriculationNo"
            defaultValue={patient.immatriculationNo ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          N° Affiliation
          <input
            name="affiliationNo"
            defaultValue={patient.affiliationNo ?? ""}
            className={fieldClass}
          />
        </label>
      </div>

      <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
        {submitLabel}
      </button>
    </form>
  );
}
