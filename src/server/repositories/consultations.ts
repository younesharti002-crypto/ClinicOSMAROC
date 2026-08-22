import {
  AppointmentStatus,
  Role,
  type PrismaClient,
} from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { assertAppointmentTransition } from "@/lib/appointments/state-machine";

export type ConsultationClinicalInput = {
  symptoms: string | null;
  diagnosis: string | null;
  clinicalNotes: string | null;
};

export type PatientMedicalProfileInput = {
  bloodGroup: string | null;
  allergies: string | null;
  chronicDiseases: string | null;
};

function doctorScope(ctx: AuthContext) {
  return ctx.role === Role.DOCTOR ? { doctorId: ctx.userId } : {};
}

export async function getDoctorWorkspace(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "consultation:write");
  const scope = doctorScope(ctx);

  const [waiting, active, recent] = await Promise.all([
    db.appointment.findMany({
      where: {
        clinicId: ctx.clinicId,
        status: AppointmentStatus.WAITING_ROOM,
        ...scope,
      },
      select: {
        id: true,
        type: true,
        scheduledAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        doctor: { select: { id: true, fullName: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 20,
    }),
    db.consultation.findMany({
      where: {
        clinicId: ctx.clinicId,
        appointment: { status: AppointmentStatus.IN_CONSULTATION },
        ...scope,
      },
      select: {
        id: true,
        createdAt: true,
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        appointment: { select: { id: true, type: true, scheduledAt: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    db.consultation.findMany({
      where: {
        clinicId: ctx.clinicId,
        appointment: { status: AppointmentStatus.COMPLETED },
        ...scope,
      },
      select: {
        id: true,
        updatedAt: true,
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  return { waiting, active, recent };
}

export async function startConsultation(
  db: PrismaClient,
  ctx: AuthContext,
  appointmentId: string,
) {
  assertCan(ctx.role, "consultation:write");

  return db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,
        clinicId: ctx.clinicId,
        ...doctorScope(ctx),
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        status: true,
        consultation: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found for this doctor and clinic");
    }

    if (appointment.consultation) {
      if (appointment.status === AppointmentStatus.IN_CONSULTATION) {
        return appointment.consultation;
      }
      throw new Error("Appointment already has a consultation");
    }

    assertAppointmentTransition(
      appointment.status,
      AppointmentStatus.IN_CONSULTATION,
    );

    const changed = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        clinicId: ctx.clinicId,
        status: appointment.status,
      },
      data: { status: AppointmentStatus.IN_CONSULTATION },
    });

    if (changed.count !== 1) {
      throw new Error("Appointment changed concurrently; retry the operation");
    }

    const consultation = await tx.consultation.create({
      data: {
        clinicId: ctx.clinicId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
      },
      select: { id: true },
    });

    await tx.auditLog.createMany({
      data: [
        {
          clinicId: ctx.clinicId,
          actorUserId: ctx.userId,
          action: "CONSULTATION_STARTED",
          entityType: "Consultation",
          entityId: consultation.id,
          metadata: { appointmentId: appointment.id },
        },
        {
          clinicId: ctx.clinicId,
          actorUserId: ctx.userId,
          action: "APPOINTMENT_STATUS_CHANGED",
          entityType: "Appointment",
          entityId: appointment.id,
          metadata: {
            from: appointment.status,
            to: AppointmentStatus.IN_CONSULTATION,
          },
        },
      ],
    });

    return consultation;
  });
}

export async function getConsultationWorkspace(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
) {
  assertCan(ctx.role, "patient:clinical:read");

  const consultation = await db.consultation.findFirst({
    where: {
      id: consultationId,
      clinicId: ctx.clinicId,
      ...doctorScope(ctx),
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      symptoms: true,
      diagnosis: true,
      clinicalNotes: true,
      createdAt: true,
      updatedAt: true,
      appointment: {
        select: {
          id: true,
          status: true,
          type: true,
          scheduledAt: true,
        },
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          cin: true,
          birthDate: true,
          gender: true,
          insuranceType: true,
          immatriculationNo: true,
          affiliationNo: true,
          bloodGroup: true,
          allergies: true,
          chronicDiseases: true,
        },
      },
      doctor: { select: { id: true, fullName: true, inpeNumber: true } },
    },
  });

  if (!consultation) {
    return null;
  }

  const history = await db.consultation.findMany({
    where: {
      clinicId: ctx.clinicId,
      patientId: consultation.patientId,
      id: { not: consultation.id },
    },
    select: {
      id: true,
      symptoms: true,
      diagnosis: true,
      clinicalNotes: true,
      createdAt: true,
      doctor: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { consultation, history };
}

async function requireOwnedConsultation(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
) {
  assertCan(ctx.role, "consultation:write");

  const consultation = await db.consultation.findFirst({
    where: {
      id: consultationId,
      clinicId: ctx.clinicId,
      ...doctorScope(ctx),
    },
    select: { id: true, appointmentId: true },
  });

  if (!consultation) {
    throw new Error("Consultation not found for this doctor and clinic");
  }

  return consultation;
}

export async function saveConsultation(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
  input: ConsultationClinicalInput,
) {
  const consultation = await requireOwnedConsultation(db, ctx, consultationId);

  await db.$transaction([
    db.consultation.update({
      where: { id: consultation.id },
      data: input,
    }),
    db.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "CONSULTATION_CLINICAL_UPDATED",
        entityType: "Consultation",
        entityId: consultation.id,
        metadata: {
          fieldsUpdated: ["symptoms", "diagnosis", "clinicalNotes"],
        },
      },
    }),
  ]);
}

export async function updatePatientMedicalProfile(
  db: PrismaClient,
  ctx: AuthContext,
  patientId: string,
  input: PatientMedicalProfileInput,
) {
  assertCan(ctx.role, "consultation:write");

  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: ctx.clinicId },
    select: { id: true },
  });

  if (!patient) {
    throw new Error("Patient not found in clinic");
  }

  await db.$transaction([
    db.patient.update({
      where: { id: patient.id },
      data: input,
    }),
    db.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "PATIENT_MEDICAL_PROFILE_UPDATED",
        entityType: "Patient",
        entityId: patient.id,
        metadata: {
          fieldsUpdated: ["bloodGroup", "allergies", "chronicDiseases"],
        },
      },
    }),
  ]);
}

export async function finishConsultation(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
  input: ConsultationClinicalInput,
) {
  assertCan(ctx.role, "consultation:write");

  return db.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: {
        id: consultationId,
        clinicId: ctx.clinicId,
        ...doctorScope(ctx),
      },
      select: {
        id: true,
        appointmentId: true,
        appointment: { select: { id: true, status: true } },
      },
    });

    if (!consultation) {
      throw new Error("Consultation not found for this doctor and clinic");
    }

    if (!consultation.appointment) {
      throw new Error("M3 finish flow requires an appointment-linked consultation");
    }

    assertAppointmentTransition(
      consultation.appointment.status,
      AppointmentStatus.COMPLETED,
    );

    await tx.consultation.update({
      where: { id: consultation.id },
      data: input,
    });

    const changed = await tx.appointment.updateMany({
      where: {
        id: consultation.appointment.id,
        clinicId: ctx.clinicId,
        status: AppointmentStatus.IN_CONSULTATION,
      },
      data: { status: AppointmentStatus.COMPLETED },
    });

    if (changed.count !== 1) {
      throw new Error("Appointment changed concurrently; retry the operation");
    }

    await tx.auditLog.createMany({
      data: [
        {
          clinicId: ctx.clinicId,
          actorUserId: ctx.userId,
          action: "CONSULTATION_COMPLETED",
          entityType: "Consultation",
          entityId: consultation.id,
          metadata: { appointmentId: consultation.appointment.id },
        },
        {
          clinicId: ctx.clinicId,
          actorUserId: ctx.userId,
          action: "APPOINTMENT_STATUS_CHANGED",
          entityType: "Appointment",
          entityId: consultation.appointment.id,
          metadata: {
            from: consultation.appointment.status,
            to: AppointmentStatus.COMPLETED,
          },
        },
      ],
    });

    return { id: consultation.id, status: AppointmentStatus.COMPLETED };
  });
}
