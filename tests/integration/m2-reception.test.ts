import {
  AppointmentStatus,
  AppointmentType,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
import { InvalidAppointmentTransitionError } from "@/lib/appointments/state-machine";
import {
  createAppointment,
  getQueue,
  transitionAppointment,
} from "@/server/repositories/appointments";
import { listPatients } from "@/server/repositories/patients";

const db = new PrismaClient();

async function resetDatabase() {
  await db.whatsAppEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.cashClosing.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.prescription.deleteMany();
  await db.consultation.deleteMany();
  await db.appointment.deleteMany();
  await db.patient.deleteMany();
  await db.user.deleteMany();
  await db.clinic.deleteMany();
}

async function fixture() {
  const clinicA = await db.clinic.create({
    data: {
      name: "Clinic A",
      slug: "m2-clinic-a",
      phone: "+212600000001",
      address: "Casablanca",
    },
  });
  const clinicB = await db.clinic.create({
    data: {
      name: "Clinic B",
      slug: "m2-clinic-b",
      phone: "+212600000002",
      address: "Rabat",
    },
  });

  const secretaryA = await db.user.create({
    data: {
      clinicId: clinicA.id,
      email: "secretary-a@m2.test",
      passwordHash: "test",
      fullName: "Secretary A",
      role: Role.SECRETARY,
    },
  });
  const doctorA = await db.user.create({
    data: {
      clinicId: clinicA.id,
      email: "doctor-a@m2.test",
      passwordHash: "test",
      fullName: "Doctor A",
      role: Role.DOCTOR,
    },
  });
  const doctorB = await db.user.create({
    data: {
      clinicId: clinicB.id,
      email: "doctor-b@m2.test",
      passwordHash: "test",
      fullName: "Doctor B",
      role: Role.DOCTOR,
    },
  });

  const patientA = await db.patient.create({
    data: {
      clinicId: clinicA.id,
      firstName: "Ahmed",
      lastName: "A",
      phone: "+212611111111",
    },
  });
  const patientB = await db.patient.create({
    data: {
      clinicId: clinicB.id,
      firstName: "Sara",
      lastName: "B",
      phone: "+212622222222",
    },
  });

  const secretaryCtx: AuthContext = {
    userId: secretaryA.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretaryA.fullName,
  };
  const doctorCtx: AuthContext = {
    userId: doctorA.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR,
    fullName: doctorA.fullName,
  };

  return { clinicA, clinicB, secretaryA, doctorA, doctorB, patientA, patientB, secretaryCtx, doctorCtx };
}

describe("M2 reception flow", () => {
  beforeAll(async () => {
    await db.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("keeps patient search tenant-scoped", async () => {
    const { secretaryCtx, patientA, patientB } = await fixture();
    const patients = await listPatients(db, secretaryCtx, "", 100);

    expect(patients.map((patient) => patient.id)).toContain(patientA.id);
    expect(patients.map((patient) => patient.id)).not.toContain(patientB.id);
  });

  it("keeps secretary patient projections administrative-only", async () => {
    const { secretaryCtx, patientA } = await fixture();
    const patients = await listPatients(db, secretaryCtx, "", 100);
    const projected = patients.find((patient) => patient.id === patientA.id);

    expect(projected).toBeDefined();
    expect(projected).not.toHaveProperty("bloodGroup");
    expect(projected).not.toHaveProperty("allergies");
    expect(projected).not.toHaveProperty("chronicDiseases");
    expect(projected).not.toHaveProperty("consultations");
    expect(projected).not.toHaveProperty("diagnosis");
    expect(projected).not.toHaveProperty("clinicalNotes");
  });

  it("rejects cross-tenant patient or doctor when creating an appointment", async () => {
    const { secretaryCtx, patientA, patientB, doctorA, doctorB } = await fixture();

    await expect(
      createAppointment(db, secretaryCtx, {
        patientId: patientB.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-22T14:00:00Z"),
        durationMinutes: 20,
        type: AppointmentType.BOOKED,
        notes: null,
      }),
    ).rejects.toThrow("Patient or doctor not found in clinic");

    await expect(
      createAppointment(db, secretaryCtx, {
        patientId: patientA.id,
        doctorId: doctorB.id,
        scheduledAt: new Date("2026-08-22T14:00:00Z"),
        durationMinutes: 20,
        type: AppointmentType.BOOKED,
        notes: null,
      }),
    ).rejects.toThrow("Patient or doctor not found in clinic");
  });

  it("moves a booked appointment into the queue when reception marks the patient arrived", async () => {
    const { secretaryCtx, patientA, doctorA } = await fixture();
    const booked = await createAppointment(db, secretaryCtx, {
      patientId: patientA.id,
      doctorId: doctorA.id,
      scheduledAt: new Date("2026-08-22T14:00:00Z"),
      durationMinutes: 20,
      type: AppointmentType.BOOKED,
      notes: null,
    });

    expect(booked.status).toBe(AppointmentStatus.SCHEDULED);

    const arrived = await transitionAppointment(
      db,
      secretaryCtx,
      booked.id,
      AppointmentStatus.WAITING_ROOM,
    );

    expect(arrived.status).toBe(AppointmentStatus.WAITING_ROOM);

    const queue = await getQueue(db, secretaryCtx);
    expect(queue.map((entry) => entry.id)).toContain(booked.id);
    expect(queue.find((entry) => entry.id === booked.id)?.position).toBe(1);
  });

  it("creates walk-ins directly in the waiting room and prioritizes emergencies", async () => {
    const { secretaryCtx, patientA, doctorA, clinicA } = await fixture();
    const secondPatient = await db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Emergency",
        lastName: "Patient",
        phone: "+212633333333",
      },
    });

    const walkIn = await createAppointment(db, secretaryCtx, {
      patientId: patientA.id,
      doctorId: doctorA.id,
      scheduledAt: new Date("2026-08-22T13:00:00Z"),
      durationMinutes: 20,
      type: AppointmentType.WALK_IN,
      notes: null,
    });
    const emergency = await createAppointment(db, secretaryCtx, {
      patientId: secondPatient.id,
      doctorId: doctorA.id,
      scheduledAt: new Date("2026-08-22T13:05:00Z"),
      durationMinutes: 20,
      type: AppointmentType.EMERGENCY,
      notes: null,
    });

    expect(walkIn.status).toBe(AppointmentStatus.WAITING_ROOM);
    expect(emergency.status).toBe(AppointmentStatus.WAITING_ROOM);

    const queue = await getQueue(db, secretaryCtx);
    expect(queue[0]?.id).toBe(emergency.id);
    expect(queue.map((entry) => entry.position)).toEqual([1, 2]);
  });

  it("rejects invalid transitions and prevents secretary from starting consultation", async () => {
    const { secretaryCtx, patientA, doctorA } = await fixture();
    const walkIn = await createAppointment(db, secretaryCtx, {
      patientId: patientA.id,
      doctorId: doctorA.id,
      scheduledAt: new Date("2026-08-22T13:00:00Z"),
      durationMinutes: 20,
      type: AppointmentType.WALK_IN,
      notes: null,
    });

    await expect(
      transitionAppointment(db, secretaryCtx, walkIn.id, AppointmentStatus.CONFIRMED),
    ).rejects.toBeInstanceOf(InvalidAppointmentTransitionError);

    await expect(
      transitionAppointment(db, secretaryCtx, walkIn.id, AppointmentStatus.IN_CONSULTATION),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an authorized doctor start a consultation from the queue", async () => {
    const { secretaryCtx, doctorCtx, patientA, doctorA } = await fixture();
    const walkIn = await createAppointment(db, secretaryCtx, {
      patientId: patientA.id,
      doctorId: doctorA.id,
      scheduledAt: new Date("2026-08-22T13:00:00Z"),
      durationMinutes: 20,
      type: AppointmentType.WALK_IN,
      notes: null,
    });

    const updated = await transitionAppointment(
      db,
      doctorCtx,
      walkIn.id,
      AppointmentStatus.IN_CONSULTATION,
    );

    expect(updated.status).toBe(AppointmentStatus.IN_CONSULTATION);
  });
});
