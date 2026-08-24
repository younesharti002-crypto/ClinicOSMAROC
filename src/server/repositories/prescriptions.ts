import { Role, type PrismaClient } from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";

export type PrescriptionLineInput = {
  medicationName: string;
  dosage: string;
  duration: string;
  isGeneric: boolean;
  instructions: string | null;
};

function doctorScope(ctx: AuthContext) {
  return ctx.role === Role.DOCTOR ? { doctorId: ctx.userId } : {};
}

export async function getPrescriptionWorkspace(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
) {
  assertCan(ctx.role, "patient:clinical:read");

  return db.consultation.findFirst({
    where: {
      id: consultationId,
      clinicId: ctx.clinicId,
      ...doctorScope(ctx),
    },
    select: {
      id: true,
      createdAt: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          cin: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
          inpeNumber: true,
        },
      },
      clinic: {
        select: {
          name: true,
          phone: true,
          address: true,
          city: true,
          inpeNumber: true,
        },
      },
      prescriptions: {
        select: {
          id: true,
          medicationName: true,
          dosage: true,
          duration: true,
          isGeneric: true,
          instructions: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function addPrescriptionLine(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
  input: PrescriptionLineInput,
) {
  assertCan(ctx.role, "prescription:write");

  const consultation = await db.consultation.findFirst({
    where: {
      id: consultationId,
      clinicId: ctx.clinicId,
      ...doctorScope(ctx),
    },
    select: { id: true },
  });

  if (!consultation) {
    throw new Error("Consultation not found for this doctor and clinic");
  }

  return db.$transaction(async (tx) => {
    const line = await tx.prescription.create({
      data: {
        clinicId: ctx.clinicId,
        consultationId: consultation.id,
        ...input,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PRESCRIPTION_LINE_ADDED",
        entityType: "Prescription",
        entityId: line.id,
        metadata: { consultationId: consultation.id },
      },
    });

    return line;
  });
}

export async function updatePrescriptionLine(
  db: PrismaClient,
  ctx: AuthContext,
  prescriptionId: string,
  input: PrescriptionLineInput,
) {
  assertCan(ctx.role, "prescription:write");

  const line = await db.prescription.findFirst({
    where: {
      id: prescriptionId,
      clinicId: ctx.clinicId,
      consultation: {
        clinicId: ctx.clinicId,
        ...doctorScope(ctx),
      },
    },
    select: { id: true, consultationId: true },
  });

  if (!line) {
    throw new Error("Prescription line not found for this doctor and clinic");
  }

  await db.$transaction([
    db.prescription.update({
      where: { id: line.id },
      data: input,
    }),
    db.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PRESCRIPTION_LINE_UPDATED",
        entityType: "Prescription",
        entityId: line.id,
        metadata: {
          consultationId: line.consultationId,
          fieldsUpdated: [
            "medicationName",
            "dosage",
            "duration",
            "isGeneric",
            "instructions",
          ],
        },
      },
    }),
  ]);
}

export async function removePrescriptionLine(
  db: PrismaClient,
  ctx: AuthContext,
  prescriptionId: string,
) {
  assertCan(ctx.role, "prescription:write");

  const line = await db.prescription.findFirst({
    where: {
      id: prescriptionId,
      clinicId: ctx.clinicId,
      consultation: {
        clinicId: ctx.clinicId,
        ...doctorScope(ctx),
      },
    },
    select: { id: true, consultationId: true },
  });

  if (!line) {
    throw new Error("Prescription line not found for this doctor and clinic");
  }

  await db.$transaction([
    db.prescription.delete({ where: { id: line.id } }),
    db.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PRESCRIPTION_LINE_REMOVED",
        entityType: "Prescription",
        entityId: line.id,
        metadata: { consultationId: line.consultationId },
      },
    }),
  ]);
}
