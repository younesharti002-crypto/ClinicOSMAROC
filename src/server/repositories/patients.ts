import type { InsuranceType, PrismaClient } from "@prisma/client";

import { assertCan } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/context";

export type PatientAdministrativeInput = {
  cin: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: Date | null;
  gender: string | null;
  address: string | null;
  insuranceType: InsuranceType;
  immatriculationNo: string | null;
  affiliationNo: string | null;
};

const administrativeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  cin: true,
  birthDate: true,
  gender: true,
  address: true,
  insuranceType: true,
  immatriculationNo: true,
  affiliationNo: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listPatients(
  db: PrismaClient,
  ctx: AuthContext,
  query = "",
  limit = 50,
) {
  assertCan(ctx.role, "patient:demographics:read");
  const normalizedQuery = query.trim();

  return db.patient.findMany({
    where: {
      clinicId: ctx.clinicId,
      ...(normalizedQuery
        ? {
            OR: [
              { firstName: { contains: normalizedQuery, mode: "insensitive" as const } },
              { lastName: { contains: normalizedQuery, mode: "insensitive" as const } },
              { phone: { contains: normalizedQuery } },
              { cin: { contains: normalizedQuery, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: administrativeSelect,
    orderBy: [{ updatedAt: "desc" }, { lastName: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function createPatientAdministrative(
  db: PrismaClient,
  ctx: AuthContext,
  input: PatientAdministrativeInput,
) {
  assertCan(ctx.role, "patient:demographics:write");

  return db.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        clinicId: ctx.clinicId,
        ...input,
      },
      select: administrativeSelect,
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PATIENT_CREATED",
        entityType: "Patient",
        entityId: patient.id,
        metadata: { source: "M2_RECEPTION" },
      },
    });

    return patient;
  });
}

export async function updatePatientAdministrative(
  db: PrismaClient,
  ctx: AuthContext,
  patientId: string,
  input: PatientAdministrativeInput,
) {
  assertCan(ctx.role, "patient:demographics:write");

  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.patient.findFirst({
      where: { id: patientId, clinicId: ctx.clinicId },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    const result = await tx.patient.updateMany({
      where: { id: patientId, clinicId: ctx.clinicId },
      data: input,
    });

    if (result.count !== 1) {
      return false;
    }

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PATIENT_ADMIN_UPDATED",
        entityType: "Patient",
        entityId: patientId,
        metadata: {
          source: "M2_RECEPTION",
          fields: Object.keys(input),
        },
      },
    });

    return true;
  });

  if (!updated) {
    return null;
  }

  return getPatientAdministrativeView(db, ctx, patientId);
}

export async function getPatientAdministrativeView(
  db: PrismaClient,
  ctx: AuthContext,
  patientId: string,
) {
  assertCan(ctx.role, "patient:demographics:read");

  return db.patient.findFirst({
    where: {
      id: patientId,
      clinicId: ctx.clinicId,
    },
    select: administrativeSelect,
  });
}

export async function getPatientClinicalView(
  db: PrismaClient,
  ctx: AuthContext,
  patientId: string,
) {
  assertCan(ctx.role, "patient:clinical:read");

  return db.patient.findFirst({
    where: {
      id: patientId,
      clinicId: ctx.clinicId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      cin: true,
      birthDate: true,
      gender: true,
      address: true,
      insuranceType: true,
      immatriculationNo: true,
      affiliationNo: true,
      bloodGroup: true,
      allergies: true,
      chronicDiseases: true,
      consultations: {
        where: {
          clinicId: ctx.clinicId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          doctorId: true,
          symptoms: true,
          diagnosis: true,
          clinicalNotes: true,
          createdAt: true,
        },
      },
    },
  });
}
