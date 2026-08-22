import {
  AppointmentStatus,
  AppointmentType,
  InsuranceType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
import { clinicDateKey } from "@/lib/time/clinic-time";
import { getBusinessAnalytics } from "@/server/repositories/analytics";
import {
  createAppointment,
  getQueue,
  transitionAppointment,
} from "@/server/repositories/appointments";
import {
  createInvoiceForConsultation,
  markFeuilleDeSoinsGenerated,
  recordPayment,
} from "@/server/repositories/billing";
import { closeCashDay } from "@/server/repositories/cash";
import {
  finishConsultation,
  saveConsultation,
  startConsultation,
} from "@/server/repositories/consultations";
import {
  createPatientAdministrative,
  getPatientAdministrativeView,
  getPatientClinicalView,
} from "@/server/repositories/patients";
import { addPrescriptionLine } from "@/server/repositories/prescriptions";

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
  const [clinicA, clinicB] = await Promise.all([
    db.clinic.create({
      data: {
        name: "M8 Clinic A",
        slug: "m8-clinic-a",
        phone: "+212600000081",
        address: "Casablanca",
        timezone: "Africa/Casablanca",
      },
    }),
    db.clinic.create({
      data: {
        name: "M8 Clinic B",
        slug: "m8-clinic-b",
        phone: "+212600000082",
        address: "Rabat",
        timezone: "Africa/Casablanca",
      },
    }),
  ]);

  const [admin, doctor, secretary, secretaryB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "admin@m8.test",
        passwordHash: "test",
        fullName: "Admin M8",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor@m8.test",
        passwordHash: "test",
        fullName: "Doctor M8",
        role: Role.DOCTOR,
        inpeNumber: "INPE-M8",
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary@m8.test",
        passwordHash: "test",
        fullName: "Secretary M8",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "secretary-b@m8.test",
        passwordHash: "test",
        fullName: "Secretary B M8",
        role: Role.SECRETARY,
      },
    }),
  ]);

  const adminCtx: AuthContext = {
    userId: admin.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR_ADMIN,
    fullName: admin.fullName,
  };
  const doctorCtx: AuthContext = {
    userId: doctor.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR,
    fullName: doctor.fullName,
  };
  const secretaryCtx: AuthContext = {
    userId: secretary.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretary.fullName,
  };
  const secretaryBCtx: AuthContext = {
    userId: secretaryB.id,
    clinicId: clinicB.id,
    role: Role.SECRETARY,
    fullName: secretaryB.fullName,
  };

  return {
    clinicA,
    clinicB,
    doctor,
    adminCtx,
    doctorCtx,
    secretaryCtx,
    secretaryBCtx,
  };
}

describe("M8 release acceptance flow", () => {
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

  it("runs patient -> RDV -> queue -> consultation -> prescription -> billing -> cash close -> analytics with tenant/RBAC gates", async () => {
    const {
      clinicA,
      doctor,
      adminCtx,
      doctorCtx,
      secretaryCtx,
      secretaryBCtx,
    } = await fixture();

    const patient = await createPatientAdministrative(db, secretaryCtx, {
      cin: "AB123456",
      firstName: "Patient",
      lastName: "Acceptance",
      phone: "+212611111181",
      birthDate: null,
      gender: null,
      address: "Casablanca",
      insuranceType: InsuranceType.AMO_CNSS,
      immatriculationNo: "IMM-M8",
      affiliationNo: "AFF-M8",
    });

    const appointment = await createAppointment(db, secretaryCtx, {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: new Date(),
      durationMinutes: 20,
      type: AppointmentType.BOOKED,
      notes: null,
    });

    await transitionAppointment(
      db,
      secretaryCtx,
      appointment.id,
      AppointmentStatus.CONFIRMED,
    );
    await transitionAppointment(
      db,
      secretaryCtx,
      appointment.id,
      AppointmentStatus.WAITING_ROOM,
    );

    const queue = await getQueue(db, secretaryCtx);
    expect(queue.some((item) => item.id === appointment.id)).toBe(true);

    const consultation = await startConsultation(db, doctorCtx, appointment.id);
    const clinicalInput = {
      symptoms: "Fièvre et fatigue",
      diagnosis: "Diagnostic de test M8",
      clinicalNotes: "Note clinique strictement médicale M8",
    };
    await saveConsultation(db, doctorCtx, consultation.id, clinicalInput);

    await addPrescriptionLine(db, doctorCtx, consultation.id, {
      medicationName: "Paracétamol",
      dosage: "1 comprimé",
      duration: "3 jours",
      isGeneric: true,
      instructions: "Après repas",
    });

    await finishConsultation(db, doctorCtx, consultation.id, clinicalInput);

    const invoice = await createInvoiceForConsultation(
      db,
      secretaryCtx,
      consultation.id,
      new Prisma.Decimal("300.00"),
    );
    await markFeuilleDeSoinsGenerated(db, secretaryCtx, invoice.id);
    await recordPayment(
      db,
      secretaryCtx,
      invoice.id,
      new Prisma.Decimal("300.00"),
      PaymentMethod.CASH,
    );

    const dateKey = clinicDateKey(new Date(), clinicA.timezone);
    const closing = await closeCashDay(db, secretaryCtx, dateKey, {
      cash: new Prisma.Decimal("300.00"),
      card: new Prisma.Decimal("0.00"),
      cheque: new Prisma.Decimal("0.00"),
      transfer: new Prisma.Decimal("0.00"),
      notes: null,
    });
    expect(closing.isLocked).toBe(true);

    const lockedDayInvoice = await db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: patient.id,
        totalAmount: new Prisma.Decimal("100.00"),
        status: InvoiceStatus.ISSUED,
      },
    });
    await expect(
      recordPayment(
        db,
        secretaryCtx,
        lockedDayInvoice.id,
        new Prisma.Decimal("100.00"),
        PaymentMethod.CASH,
      ),
    ).rejects.toThrow("Cash day is closed");

    const analytics = await getBusinessAnalytics(
      db,
      adminCtx,
      dateKey.slice(0, 7),
    );
    expect(analytics.month.completed).toBe(1);
    expect(analytics.month.revenue.total.toFixed(2)).toBe("300.00");

    const secretaryPatient = await getPatientAdministrativeView(
      db,
      secretaryCtx,
      patient.id,
    );
    expect(secretaryPatient).not.toBeNull();
    expect(secretaryPatient).not.toHaveProperty("diagnosis");
    expect(secretaryPatient).not.toHaveProperty("clinicalNotes");

    await expect(
      getPatientClinicalView(db, secretaryCtx, patient.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const crossTenantPatient = await getPatientAdministrativeView(
      db,
      secretaryBCtx,
      patient.id,
    );
    expect(crossTenantPatient).toBeNull();

    const storedConsultation = await db.consultation.findFirst({
      where: { id: consultation.id, clinicId: clinicA.id },
      select: { diagnosis: true, clinicalNotes: true },
    });
    expect(storedConsultation?.diagnosis).toBe(clinicalInput.diagnosis);
    expect(storedConsultation?.clinicalNotes).toBe(clinicalInput.clinicalNotes);
  });
});
