import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/context";
import {
  getPatientAdministrativeView,
  getPatientClinicalView,
} from "@/server/repositories/patients";

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

describe("tenant isolation and clinical projections", () => {
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

  it("prevents Clinic A from reading Clinic B patient by id", async () => {
    const clinicA = await db.clinic.create({
      data: {
        name: "Clinic A",
        slug: "clinic-a",
        phone: "+212600000001",
        address: "Casablanca",
      },
    });
    const clinicB = await db.clinic.create({
      data: {
        name: "Clinic B",
        slug: "clinic-b",
        phone: "+212600000002",
        address: "Rabat",
      },
    });

    const patientB = await db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Patient",
        lastName: "B",
        phone: "+212611111111",
      },
    });

    const secretaryCtx: AuthContext = {
      userId: "00000000-0000-4000-8000-000000000001",
      clinicId: clinicA.id,
      role: Role.SECRETARY,
      fullName: "Secretary A",
    };

    const result = await getPatientAdministrativeView(db, secretaryCtx, patientB.id);
    expect(result).toBeNull();
  });

  it("never returns clinical fields in the secretary patient projection", async () => {
    const clinic = await db.clinic.create({
      data: {
        name: "Clinic A",
        slug: "clinic-a",
        phone: "+212600000001",
        address: "Casablanca",
      },
    });

    const doctor = await db.user.create({
      data: {
        clinicId: clinic.id,
        email: "doctor@clinic-a.test",
        passwordHash: "test-only",
        fullName: "Doctor A",
        role: Role.DOCTOR,
      },
    });

    const patient = await db.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Ahmed",
        lastName: "Test",
        phone: "+212622222222",
        allergies: "Penicillin",
        chronicDiseases: "Hypertension",
      },
    });

    await db.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        doctorId: doctor.id,
        symptoms: "Headache",
        diagnosis: "Private diagnosis",
        clinicalNotes: "Private clinical note",
      },
    });

    const secretaryCtx: AuthContext = {
      userId: "00000000-0000-4000-8000-000000000002",
      clinicId: clinic.id,
      role: Role.SECRETARY,
      fullName: "Secretary A",
    };

    const result = await getPatientAdministrativeView(db, secretaryCtx, patient.id);

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("allergies");
    expect(result).not.toHaveProperty("chronicDiseases");
    expect(result).not.toHaveProperty("consultations");
    expect(result).not.toHaveProperty("diagnosis");
    expect(result).not.toHaveProperty("clinicalNotes");
  });

  it("rejects secretary clinical access and permits an authorized doctor", async () => {
    const clinic = await db.clinic.create({
      data: {
        name: "Clinic A",
        slug: "clinic-a",
        phone: "+212600000001",
        address: "Casablanca",
      },
    });

    const doctor = await db.user.create({
      data: {
        clinicId: clinic.id,
        email: "doctor@clinic-a.test",
        passwordHash: "test-only",
        fullName: "Doctor A",
        role: Role.DOCTOR,
      },
    });

    const patient = await db.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Sara",
        lastName: "Test",
        phone: "+212633333333",
      },
    });

    await db.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        doctorId: doctor.id,
        diagnosis: "Authorized doctor only",
        clinicalNotes: "Sensitive",
      },
    });

    const secretaryCtx: AuthContext = {
      userId: "00000000-0000-4000-8000-000000000003",
      clinicId: clinic.id,
      role: Role.SECRETARY,
      fullName: "Secretary A",
    };

    await expect(
      getPatientClinicalView(db, secretaryCtx, patient.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const doctorCtx: AuthContext = {
      userId: doctor.id,
      clinicId: clinic.id,
      role: Role.DOCTOR,
      fullName: doctor.fullName,
    };

    const clinicalRecord = await getPatientClinicalView(db, doctorCtx, patient.id);

    expect(clinicalRecord?.consultations[0]?.diagnosis).toBe("Authorized doctor only");
    expect(clinicalRecord?.consultations[0]?.clinicalNotes).toBe("Sensitive");
  });
});
