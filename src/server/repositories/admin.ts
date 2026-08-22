import bcrypt from "bcryptjs";
import { Role, type PrismaClient } from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";

export type CreateStaffInput = {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  phone: string | null;
  inpeNumber: string | null;
};

export type ClinicSettingsInput = {
  name: string;
  phone: string;
  address: string;
  city: string;
  inpeNumber: string | null;
  specialty: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandAccentColor: string;
  timezone: "Africa/Casablanca";
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappReminderTemplate: string | null;
  whatsappLanguageCode: "fr" | "ar";
};

const staffSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  inpeNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const clinicSettingsSelect = {
  id: true,
  name: true,
  slug: true,
  phone: true,
  address: true,
  city: true,
  inpeNumber: true,
  specialty: true,
  email: true,
  website: true,
  logoUrl: true,
  brandPrimaryColor: true,
  brandAccentColor: true,
  timezone: true,
  whatsappEnabled: true,
  whatsappPhoneNumberId: true,
  whatsappReminderTemplate: true,
  whatsappLanguageCode: true,
  updatedAt: true,
} as const;

export async function listStaff(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "staff:manage");

  return db.user.findMany({
    where: { clinicId: ctx.clinicId },
    select: staffSelect,
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { fullName: "asc" }],
  });
}

export async function createStaff(
  db: PrismaClient,
  ctx: AuthContext,
  input: CreateStaffInput,
) {
  assertCan(ctx.role, "staff:manage");
  const passwordHash = await bcrypt.hash(input.password, 12);

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) throw new Error("Cette adresse e-mail est déjà utilisée");

    const user = await tx.user.create({
      data: {
        clinicId: ctx.clinicId,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        phone: input.phone,
        inpeNumber: input.inpeNumber,
        isActive: true,
      },
      select: staffSelect,
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "STAFF_CREATED",
        entityType: "User",
        entityId: user.id,
        metadata: { role: user.role },
      },
    });

    return user;
  });
}

export async function setStaffActive(
  db: PrismaClient,
  ctx: AuthContext,
  staffUserId: string,
  isActive: boolean,
) {
  assertCan(ctx.role, "staff:manage");

  if (staffUserId === ctx.userId && !isActive) {
    throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  }

  return db.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: staffUserId, clinicId: ctx.clinicId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) throw new Error("Membre introuvable dans cette clinique");

    if (
      target.role === Role.DOCTOR_ADMIN &&
      target.isActive &&
      !isActive
    ) {
      const otherActiveAdmins = await tx.user.count({
        where: {
          clinicId: ctx.clinicId,
          role: Role.DOCTOR_ADMIN,
          isActive: true,
          id: { not: target.id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw new Error("La clinique doit conserver au moins un administrateur actif");
      }
    }

    const changed = await tx.user.updateMany({
      where: { id: target.id, clinicId: ctx.clinicId },
      data: { isActive },
    });
    if (changed.count !== 1) throw new Error("Le compte a changé; réessayez");

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
        entityType: "User",
        entityId: target.id,
        metadata: { role: target.role },
      },
    });

    return { id: target.id, isActive };
  });
}

export async function getClinicSettings(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "clinic:settings:manage");

  return db.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: clinicSettingsSelect,
  });
}

export async function updateClinicSettings(
  db: PrismaClient,
  ctx: AuthContext,
  input: ClinicSettingsInput,
) {
  assertCan(ctx.role, "clinic:settings:manage");

  if (
    input.whatsappEnabled &&
    (!input.whatsappPhoneNumberId || !input.whatsappReminderTemplate)
  ) {
    throw new Error(
      "Le Phone Number ID et le template sont requis avant d’activer WhatsApp",
    );
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.clinic.findUnique({
      where: { id: ctx.clinicId },
      select: { id: true },
    });
    if (!existing) throw new Error("Clinique introuvable");

    const clinic = await tx.clinic.update({
      where: { id: ctx.clinicId },
      data: input,
      select: clinicSettingsSelect,
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "CLINIC_SETTINGS_UPDATED",
        entityType: "Clinic",
        entityId: ctx.clinicId,
        metadata: {
          fields: [
            "name",
            "phone",
            "address",
            "city",
            "inpeNumber",
            "specialty",
            "email",
            "website",
            "logoUrl",
            "brandPrimaryColor",
            "brandAccentColor",
            "timezone",
            "whatsappEnabled",
            "whatsappPhoneNumberId",
            "whatsappReminderTemplate",
            "whatsappLanguageCode",
          ],
        },
      },
    });

    return clinic;
  });
}
