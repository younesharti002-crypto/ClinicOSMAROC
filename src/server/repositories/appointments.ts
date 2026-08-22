import {
  AppointmentStatus,
  AppointmentType,
  Role,
  type PrismaClient,
} from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import { assertAppointmentTransition } from "@/lib/appointments/state-machine";
import { orderQueue } from "@/lib/queue/order";

export type CreateAppointmentInput = {
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  type: AppointmentType;
  notes: string | null;
};

export async function listDoctorsForAgenda(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "agenda:read");

  return db.user.findMany({
    where: {
      clinicId: ctx.clinicId,
      isActive: true,
      role: { in: [Role.DOCTOR, Role.DOCTOR_ADMIN] },
    },
    select: {
      id: true,
      fullName: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });
}

export async function createAppointment(
  db: PrismaClient,
  ctx: AuthContext,
  input: CreateAppointmentInput,
) {
  assertCan(ctx.role, "agenda:write");

  return db.$transaction(async (tx) => {
    const [patient, doctor] = await Promise.all([
      tx.patient.findFirst({
        where: { id: input.patientId, clinicId: ctx.clinicId },
        select: { id: true },
      }),
      tx.user.findFirst({
        where: {
          id: input.doctorId,
          clinicId: ctx.clinicId,
          isActive: true,
          role: { in: [Role.DOCTOR, Role.DOCTOR_ADMIN] },
        },
        select: { id: true },
      }),
    ]);

    if (!patient || !doctor) {
      throw new Error("Patient or doctor not found in clinic");
    }

    const initialStatus =
      input.type === AppointmentType.BOOKED
        ? AppointmentStatus.SCHEDULED
        : AppointmentStatus.WAITING_ROOM;

    const appointment = await tx.appointment.create({
      data: {
        clinicId: ctx.clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        type: input.type,
        status: initialStatus,
        notes: input.notes,
      },
      select: {
        id: true,
        type: true,
        status: true,
        scheduledAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "APPOINTMENT_CREATED",
        entityType: "Appointment",
        entityId: appointment.id,
        metadata: {
          type: appointment.type,
          initialStatus: appointment.status,
        },
      },
    });

    return appointment;
  });
}

function assertTransitionCapability(ctx: AuthContext, next: AppointmentStatus) {
  if (
    next === AppointmentStatus.IN_CONSULTATION ||
    next === AppointmentStatus.COMPLETED
  ) {
    assertCan(ctx.role, "consultation:write");
    return;
  }

  if (next === AppointmentStatus.WAITING_ROOM) {
    assertCan(ctx.role, "queue:manage");
    return;
  }

  assertCan(ctx.role, "agenda:write");
}

export async function transitionAppointment(
  db: PrismaClient,
  ctx: AuthContext,
  appointmentId: string,
  nextStatus: AppointmentStatus,
) {
  assertTransitionCapability(ctx, nextStatus);

  return db.$transaction(async (tx) => {
    const current = await tx.appointment.findFirst({
      where: { id: appointmentId, clinicId: ctx.clinicId },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new Error("Appointment not found");
    }

    assertAppointmentTransition(current.status, nextStatus);

    const updated = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        clinicId: ctx.clinicId,
        status: current.status,
      },
      data: {
        status: nextStatus,
      },
    });

    if (updated.count !== 1) {
      throw new Error("Appointment changed concurrently; retry the operation");
    }

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "APPOINTMENT_STATUS_CHANGED",
        entityType: "Appointment",
        entityId: appointmentId,
        metadata: {
          from: current.status,
          to: nextStatus,
        },
      },
    });

    return { id: appointmentId, status: nextStatus };
  });
}

export async function listAgendaAppointments(
  db: PrismaClient,
  ctx: AuthContext,
  range: { start: Date; end: Date },
  doctorId?: string,
) {
  assertCan(ctx.role, "agenda:read");

  return db.appointment.findMany({
    where: {
      clinicId: ctx.clinicId,
      scheduledAt: { gte: range.start, lt: range.end },
      ...(doctorId ? { doctorId } : {}),
    },
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
      type: true,
      status: true,
      notes: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          cin: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function getReceptionSnapshot(
  db: PrismaClient,
  ctx: AuthContext,
  range: { start: Date; end: Date },
) {
  assertCan(ctx.role, "agenda:read");

  const baseWhere = {
    clinicId: ctx.clinicId,
    scheduledAt: { gte: range.start, lt: range.end },
  } as const;

  const [total, confirmed, waiting, completed, walkIns, emergencies] = await Promise.all([
    db.appointment.count({ where: baseWhere }),
    db.appointment.count({
      where: { ...baseWhere, status: AppointmentStatus.CONFIRMED },
    }),
    db.appointment.count({
      where: { ...baseWhere, status: AppointmentStatus.WAITING_ROOM },
    }),
    db.appointment.count({
      where: { ...baseWhere, status: AppointmentStatus.COMPLETED },
    }),
    db.appointment.count({
      where: { ...baseWhere, type: AppointmentType.WALK_IN },
    }),
    db.appointment.count({
      where: { ...baseWhere, type: AppointmentType.EMERGENCY },
    }),
  ]);

  return { total, confirmed, waiting, completed, walkIns, emergencies };
}

export async function getQueue(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "queue:manage");

  const candidates = await db.appointment.findMany({
    where: {
      clinicId: ctx.clinicId,
      status: AppointmentStatus.WAITING_ROOM,
    },
    select: {
      id: true,
      type: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return orderQueue(candidates);
}
