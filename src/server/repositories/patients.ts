import type { PrismaClient } from "@prisma/client";

import { assertCan } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/context";

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
      createdAt: true,
      updatedAt: true,
    },
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
