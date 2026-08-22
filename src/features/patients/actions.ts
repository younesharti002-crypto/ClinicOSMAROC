"use server";

import { InsuranceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import {
  normalizeCin,
  normalizeMoroccanPhone,
  optionalText,
} from "@/lib/validation/morocco";
import {
  createPatientAdministrative,
  updatePatientAdministrative,
  type PatientAdministrativeInput,
} from "@/server/repositories/patients";

const patientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(30),
  cin: z.string().trim().max(30).optional(),
  birthDate: z.string().trim().optional(),
  gender: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  insuranceType: z.enum(["NONE", "AMO_CNSS", "AMO_CNOPS", "PRIVATE_MUTUELLE"]),
  immatriculationNo: z.string().trim().max(80).optional(),
  affiliationNo: z.string().trim().max(80).optional(),
});

function formValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function parsePatientInput(formData: FormData): PatientAdministrativeInput {
  const parsed = patientSchema.parse({
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    phone: formValue(formData, "phone"),
    cin: formValue(formData, "cin"),
    birthDate: formValue(formData, "birthDate"),
    gender: formValue(formData, "gender"),
    address: formValue(formData, "address"),
    insuranceType: formValue(formData, "insuranceType"),
    immatriculationNo: formValue(formData, "immatriculationNo"),
    affiliationNo: formValue(formData, "affiliationNo"),
  });

  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    phone: normalizeMoroccanPhone(parsed.phone),
    cin: normalizeCin(parsed.cin),
    birthDate: parsed.birthDate ? new Date(`${parsed.birthDate}T00:00:00.000Z`) : null,
    gender: optionalText(parsed.gender),
    address: optionalText(parsed.address),
    insuranceType: parsed.insuranceType as InsuranceType,
    immatriculationNo: optionalText(parsed.immatriculationNo),
    affiliationNo: optionalText(parsed.affiliationNo),
  };
}

export async function createPatientAction(formData: FormData): Promise<void> {
  const ctx = await requireCapability("patient:demographics:write");
  const patient = await createPatientAdministrative(prisma, ctx, parsePatientInput(formData));

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(formData: FormData): Promise<void> {
  const ctx = await requireCapability("patient:demographics:write");
  const patientId = z.string().uuid().parse(formValue(formData, "patientId"));
  const patient = await updatePatientAdministrative(
    prisma,
    ctx,
    patientId,
    parsePatientInput(formData),
  );

  if (!patient) {
    throw new Error("Patient not found");
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
