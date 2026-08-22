"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { normalizeMoroccanPhone, optionalText } from "@/lib/validation/morocco";
import {
  createStaff,
  setStaffActive,
  updateClinicSettings,
} from "@/server/repositories/admin";

const staffSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(200),
  fullName: z.string().trim().min(2).max(120),
  role: z.nativeEnum(Role),
  phone: z.string().max(40).optional().default(""),
  inpeNumber: z.string().max(80).optional().default(""),
});

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());

const clinicSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().min(5).max(40),
  address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(120),
  inpeNumber: z.string().max(80).optional().default(""),
  specialty: z.string().trim().max(160).optional().default(""),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .default("")
    .refine((value) => value === "" || z.string().email().safeParse(value).success),
  website: z.string().trim().max(240).optional().default(""),
  logoUrl: z.string().trim().max(500).optional().default(""),
  brandPrimaryColor: hexColor,
  brandAccentColor: hexColor,
  timezone: z.literal("Africa/Casablanca"),
  whatsappEnabled: z.boolean(),
  whatsappPhoneNumberId: z.string().max(80).optional().default(""),
  whatsappReminderTemplate: z.string().max(160).optional().default(""),
  whatsappLanguageCode: z.enum(["fr", "ar"]),
});

function redirectWithMessage(path: string, kind: "success" | "error", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${path}?${params.toString()}`);
}

function normalizeOptionalUrl(value: string): string | null {
  const raw = optionalText(value);
  if (!raw) return null;

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL invalide");
  }
  return url.toString();
}

export async function createStaffAction(formData: FormData): Promise<never> {
  const ctx = await requireCapability("staff:manage");
  const parsed = staffSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    phone: formData.get("phone") ?? "",
    inpeNumber: formData.get("inpeNumber") ?? "",
  });

  if (!parsed.success) {
    redirectWithMessage("/staff", "error", "Vérifiez les informations du membre");
  }

  let phone: string | null = null;
  try {
    const rawPhone = optionalText(parsed.data.phone);
    phone = rawPhone ? normalizeMoroccanPhone(rawPhone) : null;
  } catch {
    redirectWithMessage("/staff", "error", "Numéro de téléphone marocain invalide");
  }

  try {
    await createStaff(prisma, ctx, {
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      phone,
      inpeNumber: optionalText(parsed.data.inpeNumber),
    });
  } catch (error) {
    redirectWithMessage(
      "/staff",
      "error",
      error instanceof Error ? error.message : "Impossible de créer le membre",
    );
  }

  revalidatePath("/staff");
  redirectWithMessage("/staff", "success", "Membre ajouté");
}

export async function setStaffActiveAction(formData: FormData): Promise<never> {
  const ctx = await requireCapability("staff:manage");
  const staffUserId = z.string().uuid().safeParse(formData.get("staffUserId"));
  const nextActive = z.enum(["true", "false"]).safeParse(formData.get("nextActive"));

  if (!staffUserId.success || !nextActive.success) {
    redirectWithMessage("/staff", "error", "Action invalide");
  }

  try {
    await setStaffActive(
      prisma,
      ctx,
      staffUserId.data,
      nextActive.data === "true",
    );
  } catch (error) {
    redirectWithMessage(
      "/staff",
      "error",
      error instanceof Error ? error.message : "Impossible de modifier le compte",
    );
  }

  revalidatePath("/staff");
  redirectWithMessage("/staff", "success", "Compte mis à jour");
}

export async function updateClinicSettingsAction(formData: FormData): Promise<never> {
  const ctx = await requireCapability("clinic:settings:manage");
  const parsed = clinicSettingsSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    inpeNumber: formData.get("inpeNumber") ?? "",
    specialty: formData.get("specialty") ?? "",
    email: formData.get("email") ?? "",
    website: formData.get("website") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
    brandPrimaryColor: formData.get("brandPrimaryColor"),
    brandAccentColor: formData.get("brandAccentColor"),
    timezone: formData.get("timezone"),
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    whatsappPhoneNumberId: formData.get("whatsappPhoneNumberId") ?? "",
    whatsappReminderTemplate: formData.get("whatsappReminderTemplate") ?? "",
    whatsappLanguageCode: formData.get("whatsappLanguageCode"),
  });

  if (!parsed.success) {
    redirectWithMessage("/settings/clinic", "error", "Vérifiez les paramètres de la clinique");
  }

  let phone: string;
  let website: string | null;
  let logoUrl: string | null;
  try {
    phone = normalizeMoroccanPhone(parsed.data.phone);
    website = normalizeOptionalUrl(parsed.data.website);
    logoUrl = normalizeOptionalUrl(parsed.data.logoUrl);
  } catch {
    redirectWithMessage(
      "/settings/clinic",
      "error",
      "Vérifiez le téléphone, le site web et l’URL du logo",
    );
  }

  try {
    await updateClinicSettings(prisma, ctx, {
      name: parsed.data.name,
      phone,
      address: parsed.data.address,
      city: parsed.data.city,
      inpeNumber: optionalText(parsed.data.inpeNumber),
      specialty: optionalText(parsed.data.specialty),
      email: optionalText(parsed.data.email)?.toLowerCase() ?? null,
      website,
      logoUrl,
      brandPrimaryColor: parsed.data.brandPrimaryColor,
      brandAccentColor: parsed.data.brandAccentColor,
      timezone: parsed.data.timezone,
      whatsappEnabled: parsed.data.whatsappEnabled,
      whatsappPhoneNumberId: optionalText(parsed.data.whatsappPhoneNumberId),
      whatsappReminderTemplate: optionalText(parsed.data.whatsappReminderTemplate),
      whatsappLanguageCode: parsed.data.whatsappLanguageCode,
    });
  } catch (error) {
    redirectWithMessage(
      "/settings/clinic",
      "error",
      error instanceof Error ? error.message : "Impossible de mettre à jour la clinique",
    );
  }

  revalidatePath("/settings/clinic");
  revalidatePath("/dashboard");
  revalidatePath("/reception");
  revalidatePath("/doctor");
  redirectWithMessage("/settings/clinic", "success", "Paramètres enregistrés");
}
