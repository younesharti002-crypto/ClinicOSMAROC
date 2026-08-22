"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { optionalText } from "@/lib/validation/morocco";
import {
  finishConsultation,
  saveConsultation,
  startConsultation,
  updatePatientMedicalProfile,
} from "@/server/repositories/consultations";

const idSchema = z.string().uuid();

const clinicalSchema = z.object({
  consultationId: idSchema,
  symptoms: z.string().max(5000),
  diagnosis: z.string().max(5000),
  clinicalNotes: z.string().max(10000),
});

const medicalProfileSchema = z.object({
  patientId: idSchema,
  consultationId: idSchema.optional(),
  bloodGroup: z.string().max(20),
  allergies: z.string().max(5000),
  chronicDiseases: z.string().max(5000),
});

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function parseClinical(formData: FormData) {
  const parsed = clinicalSchema.parse({
    consultationId: value(formData, "consultationId"),
    symptoms: value(formData, "symptoms"),
    diagnosis: value(formData, "diagnosis"),
    clinicalNotes: value(formData, "clinicalNotes"),
  });

  return {
    consultationId: parsed.consultationId,
    input: {
      symptoms: optionalText(parsed.symptoms),
      diagnosis: optionalText(parsed.diagnosis),
      clinicalNotes: optionalText(parsed.clinicalNotes),
    },
  };
}

export async function startConsultationAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const appointmentId = idSchema.parse(value(formData, "appointmentId"));
  const consultation = await startConsultation(prisma, ctx, appointmentId);

  revalidatePath("/queue");
  revalidatePath("/doctor");
  revalidatePath("/agenda");
  redirect(`/consultations/${consultation.id}`);
}

export async function saveConsultationAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = parseClinical(formData);
  await saveConsultation(prisma, ctx, parsed.consultationId, parsed.input);

  revalidatePath(`/consultations/${parsed.consultationId}`);
  revalidatePath("/doctor");
}

export async function finishConsultationAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = parseClinical(formData);
  await finishConsultation(prisma, ctx, parsed.consultationId, parsed.input);

  revalidatePath("/queue");
  revalidatePath("/doctor");
  revalidatePath("/agenda");
  revalidatePath("/reception");
  redirect("/doctor");
}

export async function updateMedicalProfileAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = medicalProfileSchema.parse({
    patientId: value(formData, "patientId"),
    consultationId: value(formData, "consultationId") || undefined,
    bloodGroup: value(formData, "bloodGroup"),
    allergies: value(formData, "allergies"),
    chronicDiseases: value(formData, "chronicDiseases"),
  });

  await updatePatientMedicalProfile(prisma, ctx, parsed.patientId, {
    bloodGroup: optionalText(parsed.bloodGroup),
    allergies: optionalText(parsed.allergies),
    chronicDiseases: optionalText(parsed.chronicDiseases),
  });

  revalidatePath(`/patients/${parsed.patientId}`);
  if (parsed.consultationId) {
    revalidatePath(`/consultations/${parsed.consultationId}`);
  }
}
