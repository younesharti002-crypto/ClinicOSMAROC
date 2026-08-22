import {
  AppointmentStatus,
  AppointmentType,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
import { createAppointment } from "@/server/repositories/appointments";
import {
  finishConsultation,
  getConsultationWorkspace,
  startConsultation,
  updatePatientMedicalProfile,
} from "@/server/repositories/consultations";

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
      name: "M3 Clinic A",
      slug: "m3-clinic-a",
      phone: "+212600000011",
      address: "Casablanca",
    },
  });
  const clinicB = await db.clinic.create({
    data: {
      name: "M3 Clinic B",
      slug: "m3-clinic-b",
      phone: "+212600000012",
      address: "Rabat",
    },
  });

  const [secretary, doctorA, doctorOther, doctorB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary@m3.test",
        passwordHash: "test",
        fullName: "Secretary M3",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor-a@m3.test",
        passwordHash: "test",
        fullName: "Doctor A M3",
        role: Role.DOCTOR,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor-other@m3.test",
        passwordHash: "test",
        fullName: "Doctor Other M3",
        role: Role.DOCTOR,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "doctor-b@m3.test",
        passwordHash: "test",
        fullName: "Doctor B M3",
        role: Role.DOCTOR,
      },
    }),
  ]);

  const [patientA, patientB] = await Promise.all([
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Patient",
        lastName: "A",
        phone: "+212611111121",
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Patient",
        lastName: "B",
        phone: "+212611111122",
      },
    }),
  ]);

  const secretaryCtx: AuthContext = {
    userId: secretary.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretary.fullName,
  };
  const doctorCtx: AuthContext = {
    userId: doctorA.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR,
    fullName: doctorA.fullName,
  };
  const doctorOtherCtx: AuthContext = {
    userId: doctorOther.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR,
    fullName: doctorOther.fullName,
  };
  const doctorBCtx: AuthContext = {
    userId: doctorB.id,
    clinicId: clinicB.id,
    role: Role.DOCTOR,
    fullName: doctorB.fullName,
  };

  return {
    clinicA,
    clinicB,
    secretary,
    doctorA,
    doctorOther,
    doctorB,
    patientA,
    patientB,
    secretaryCtx,
    doctorCtx,
    doctorOtherCtx,
    doctorBCtx,
  };
}

async function waitingAppointment(
  secretaryCtx: AuthContext,
  patientId: string,
  doctorId: string,
) {
  return createAppointment(db, secretaryCtx, {
    patientId,
    doctorId,
    scheduledAt: new Date("2026-08-22T14:00:00Z"),
    durationMinutes: 20,
    type: AppointmentType.WALK_IN,
    notes: null,
  });
}

describe("M3 doctor consultation and EMR", () => {
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

  it("blocks secretary from starting or reading a clinical consultation", async () => {
    const { secretaryCtx, doctorA, patientA } = await fixture();
    const appointment = await waitingAppointment(secretaryCtx, patientA.id, doctorA.id);

    await expect(
      startConsultation(db, secretaryCtx, appointment.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const created = await db.consultation.create({
      data: {
        clinicId: secretaryCtx.clinicId,
        patientId: patientA.id,
        doctorId: doctorA.id,
      },
    });

    await expect(
      getConsultationWorkspace(db, secretaryCtx, created.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("starts a consultation transactionally and links it to the waiting appointment", async () => {
    const { secretaryCtx, doctorCtx, doctorA, patientA } = await fixture();
    const appointment = await waitingAppointment(secretaryCtx, patientA.id, doctorA.id);

    const consultation = await startConsultation(db, doctorCtx, appointment.id);
    const [storedAppointment, storedConsultation] = await Promise.all([
      db.appointment.findUnique({ where: { id: appointment.id } }),
      db.consultation.findUnique({ where: { id: consultation.id } }),
    ]);

    expect(storedAppointment?.status).toBe(AppointmentStatus.IN_CONSULTATION);
    expect(storedConsultation?.appointmentId).toBe(appointment.id);
    expect(storedConsultation?.clinicId).toBe(doctorCtx.clinicId);
    expect(storedConsultation?.doctorId).toBe(doctorA.id);
  });

  it("does not let a doctor start another doctor's appointment", async () => {
    const { secretaryCtx, doctorCtx, doctorOther, patientA } = await fixture();
    const appointment = await waitingAppointment(secretaryCtx, patientA.id, doctorOther.id);

    await expect(
      startConsultation(db, doctorCtx, appointment.id),
    ).rejects.toThrow("Appointment not found for this doctor and clinic");
  });

  it("finishes consultation, stores clinical fields, and completes appointment", async () => {
    const { secretaryCtx, doctorCtx, doctorA, patientA } = await fixture();
    const appointment = await waitingAppointment(secretaryCtx, patientA.id, doctorA.id);
    const consultation = await startConsultation(db, doctorCtx, appointment.id);

    await finishConsultation(db, doctorCtx, consultation.id, {
      symptoms: "Fièvre et toux",
      diagnosis: "Diagnostic test",
      clinicalNotes: "Note clinique confidentielle",
    });

    const [storedAppointment, storedConsultation] = await Promise.all([
      db.appointment.findUnique({ where: { id: appointment.id } }),
      db.consultation.findUnique({ where: { id: consultation.id } }),
    ]);

    expect(storedAppointment?.status).toBe(AppointmentStatus.COMPLETED);
    expect(storedConsultation?.diagnosis).toBe("Diagnostic test");
    expect(storedConsultation?.clinicalNotes).toBe("Note clinique confidentielle");
  });

  it("keeps consultation and medical profile tenant-scoped", async () => {
    const { secretaryCtx, doctorCtx, doctorBCtx, doctorA, patientA } = await fixture();
    const appointment = await waitingAppointment(secretaryCtx, patientA.id, doctorA.id);
    const consultation = await startConsultation(db, doctorCtx, appointment.id);

    expect(await getConsultationWorkspace(db, doctorBCtx, consultation.id)).toBeNull();

    await expect(
      updatePatientMedicalProfile(db, doctorBCtx, patientA.id, {
        bloodGroup: "A+",
        allergies: "Private",
        chronicDiseases: null,
      }),
    ).rejects.toThrow("Patient not found in clinic");
  });

  it("lets the authorized doctor update the patient medical profile", async () => {
    const { doctorCtx, patientA } = await fixture();

    await updatePatientMedicalProfile(db, doctorCtx, patientA.id, {
      bloodGroup: "O+",
      allergies: "Pénicilline",
      chronicDiseases: "HTA",
    });

    const patient = await db.patient.findUnique({ where: { id: patientA.id } });
    expect(patient?.bloodGroup).toBe("O+");
    expect(patient?.allergies).toBe("Pénicilline");
    expect(patient?.chronicDiseases).toBe("HTA");
  });
});
