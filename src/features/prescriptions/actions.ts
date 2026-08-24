"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { optionalText } from "@/lib/validation/morocco";
import {
  addPrescriptionLine,
  removePrescriptionLine,
  updatePrescriptionLine,
} from "@/server/repositories/prescriptions";

const lineFields = {
  medicationName: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(200),
  duration: z.string().trim().min(1).max(200),
  isGeneric: z.enum(["true", "false"]),
  instructions: z.string().max(1000),
} as const;

const addSchema = z.object({
  consultationId: z.string().uuid(),
  ...lineFields,
});

const updateSchema = z.object({
  consultationId: z.string().uuid(),
  prescriptionId: z.string().uuid(),
  ...lineFields,
});

const removeSchema = z.object({
  consultationId: z.string().uuid(),
  prescriptionId: z.string().uuid(),
});

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function lineInput(parsed: {
  medicationName: string;
  dosage: string;
  duration: string;
  isGeneric: "true" | "false";
  instructions: string;
}) {
  return {
    medicationName: parsed.medicationName,
    dosage: parsed.dosage,
    duration: parsed.duration,
    isGeneric: parsed.isGeneric === "true",
    instructions: optionalText(parsed.instructions),
  };
}

export async function addPrescriptionLineAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = addSchema.parse({
    consultationId: value(formData, "consultationId"),
    medicationName: value(formData, "medicationName"),
    dosage: value(formData, "dosage"),
    duration: value(formData, "duration"),
    isGeneric: value(formData, "isGeneric") || "false",
    instructions: value(formData, "instructions"),
  });

  await addPrescriptionLine(
    prisma,
    ctx,
    parsed.consultationId,
    lineInput(parsed),
  );

  revalidatePath(`/consultations/${parsed.consultationId}/prescription`);
}

export async function updatePrescriptionLineAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = updateSchema.parse({
    consultationId: value(formData, "consultationId"),
    prescriptionId: value(formData, "prescriptionId"),
    medicationName: value(formData, "medicationName"),
    dosage: value(formData, "dosage"),
    duration: value(formData, "duration"),
    isGeneric: value(formData, "isGeneric") || "false",
    instructions: value(formData, "instructions"),
  });

  await updatePrescriptionLine(
    prisma,
    ctx,
    parsed.prescriptionId,
    lineInput(parsed),
  );

  revalidatePath(`/consultations/${parsed.consultationId}/prescription`);
  revalidatePath(`/consultations/${parsed.consultationId}/prescription/print`);
}

export async function removePrescriptionLineAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = removeSchema.parse({
    consultationId: value(formData, "consultationId"),
    prescriptionId: value(formData, "prescriptionId"),
  });

  await removePrescriptionLine(prisma, ctx, parsed.prescriptionId);
  revalidatePath(`/consultations/${parsed.consultationId}/prescription`);
  revalidatePath(`/consultations/${parsed.consultationId}/prescription/print`);
}
