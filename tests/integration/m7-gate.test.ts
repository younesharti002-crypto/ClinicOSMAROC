import {
  AppointmentStatus,
  AppointmentType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { zonedDateTimeToUtc } from "@/lib/time/clinic-time";
import { getBusinessAnalytics } from "@/server/repositories/analytics";

const db = new PrismaClient();
const TZ = "Africa/Casablanca";

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

function auth(user: { id: string; clinicId: string; fullName: string; role: Role }): AuthContext {
  return {
    userId: user.id,
    clinicId: user.clinicId,
    fullName: user.fullName,
    role: user.role,
  };
}

async function fixture() {
  const [clinicA, clinicB] = await Promise.all([
    db.clinic.create({
      data: {
        name: "M7 Gate Clinic A",
        slug: "m7-gate-a",
        phone: "+212600000081",
        address: "Casablanca",
        timezone: TZ,
      },
    }),
    db.clinic.create({
      data: {
        name: "M7 Gate Clinic B",
        slug: "m7-gate-b",
        phone: "+212600000082",
        address: "Rabat",
        timezone: TZ,
      },
    }),
  ]);

  const [adminA, doctorA, secretaryA, adminB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "admin-a@m7-gate.test",
        passwordHash: "test",
        fullName: "Admin A",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor-a@m7-gate.test",
        passwordHash: "test",
        fullName: "Doctor A",
        role: Role.DOCTOR,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary-a@m7-gate.test",
        passwordHash: "test",
        fullName: "Secretary A",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "admin-b@m7-gate.test",
        passwordHash: "test",
        fullName: "Admin B",
        role: Role.DOCTOR_ADMIN,
      },
    }),
  ]);

  const [newPatient, repeatPatient, patientB] = await Promise.all([
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "New",
        lastName: "Patient",
        phone: "+212611111181",
        createdAt: zonedDateTimeToUtc("2026-08-20T10:00", TZ),
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Repeat",
        lastName: "Patient",
        phone: "+212611111182",
        createdAt: zonedDateTimeToUtc("2026-07-10T10:00", TZ),
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Other",
        lastName: "Clinic",
        phone: "+212611111183",
        createdAt: zonedDateTimeToUtc("2026-08-20T10:00", TZ),
      },
    }),
  ]);

  const [booked, walkIn] = await Promise.all([
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: newPatient.id,
        doctorId: doctorA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-22T09:00", TZ),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.COMPLETED,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: repeatPatient.id,
        doctorId: doctorA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-22T10:00", TZ),
        type: AppointmentType.WALK_IN,
        status: AppointmentStatus.WAITING_ROOM,
      },
    }),
  ]);

  await db.appointment.create({
    data: {
      clinicId: clinicB.id,
      patientId: patientB.id,
      doctorId: adminB.id,
      scheduledAt: zonedDateTimeToUtc("2026-08-22T11:00", TZ),
      type: AppointmentType.EMERGENCY,
      status: AppointmentStatus.COMPLETED,
    },
  });

  await db.consultation.create({
    data: {
      clinicId: clinicA.id,
      appointmentId: booked.id,
      patientId: newPatient.id,
      doctorId: doctorA.id,
      diagnosis: "Sensitive diagnosis must never appear in analytics",
      clinicalNotes: "Sensitive clinical note",
      createdAt: zonedDateTimeToUtc("2026-08-22T09:10", TZ),
    },
  });

  const [invoiceToday, invoiceEarlier, invoiceB] = await Promise.all([
    db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: newPatient.id,
        totalAmount: new Prisma.Decimal("100.00"),
        status: InvoiceStatus.PAID,
      },
    }),
    db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: repeatPatient.id,
        totalAmount: new Prisma.Decimal("50.00"),
        status: InvoiceStatus.PAID,
      },
    }),
    db.invoice.create({
      data: {
        clinicId: clinicB.id,
        patientId: patientB.id,
        totalAmount: new Prisma.Decimal("500.00"),
        status: InvoiceStatus.PAID,
      },
    }),
  ]);

  await Promise.all([
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceToday.id,
        receivedById: secretaryA.id,
        amount: new Prisma.Decimal("100.00"),
        method: PaymentMethod.CASH,
        status: PaymentStatus.FINALIZED,
        paidAt: zonedDateTimeToUtc("2026-08-22T12:00", TZ),
      },
    }),
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceEarlier.id,
        receivedById: secretaryA.id,
        amount: new Prisma.Decimal("50.00"),
        method: PaymentMethod.CARD,
        status: PaymentStatus.FINALIZED,
        paidAt: zonedDateTimeToUtc("2026-08-10T12:00", TZ),
      },
    }),
    db.payment.create({
      data: {
        clinicId: clinicB.id,
        invoiceId: invoiceB.id,
        receivedById: adminB.id,
        amount: new Prisma.Decimal("500.00"),
        method: PaymentMethod.VIREMENT,
        status: PaymentStatus.FINALIZED,
        paidAt: zonedDateTimeToUtc("2026-08-22T12:00", TZ),
      },
    }),
  ]);

  return { clinicA, clinicB, adminA, adminB, doctorA, secretaryA, booked, walkIn };
}

describe("M7 complete dashboard and analytics gate", () => {
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

  it("exposes the complete current-day and monthly business KPI set", async () => {
    const { adminA } = await fixture();
    const analytics = await getBusinessAnalytics(
      db,
      auth(adminA),
      "2026-08",
      zonedDateTimeToUtc("2026-08-22T15:00", TZ),
    );

    expect(analytics.today.patients).toBe(2);
    expect(analytics.today.booked).toBe(1);
    expect(analytics.today.walkIns).toBe(1);
    expect(analytics.today.waiting).toBe(1);
    expect(analytics.today.completed).toBe(1);
    expect(analytics.today.consultations).toBe(1);
    expect(analytics.today.revenue.cash.toFixed(2)).toBe("100.00");
    expect(analytics.today.revenue.total.toFixed(2)).toBe("100.00");

    expect(analytics.month.booked).toBe(1);
    expect(analytics.month.walkIns).toBe(1);
    expect(analytics.month.consultations).toBe(1);
    expect(analytics.month.uniquePatients).toBe(2);
    expect(analytics.month.newPatients).toBe(1);
    expect(analytics.month.repeatPatients).toBe(1);
    expect(analytics.month.revenue.total.toFixed(2)).toBe("150.00");
  });

  it("keeps business analytics tenant-scoped and free of clinical payload", async () => {
    const { adminA, adminB } = await fixture();
    const [analyticsA, analyticsB] = await Promise.all([
      getBusinessAnalytics(db, auth(adminA), "2026-08", zonedDateTimeToUtc("2026-08-22T15:00", TZ)),
      getBusinessAnalytics(db, auth(adminB), "2026-08", zonedDateTimeToUtc("2026-08-22T15:00", TZ)),
    ]);

    expect(analyticsA.today.revenue.total.toFixed(2)).toBe("100.00");
    expect(analyticsA.month.revenue.total.toFixed(2)).toBe("150.00");
    expect(analyticsB.today.revenue.total.toFixed(2)).toBe("500.00");
    expect(analyticsB.month.revenue.total.toFixed(2)).toBe("500.00");
    expect(analyticsB.today.patients).toBe(1);

    const serialized = JSON.stringify(analyticsA);
    expect(serialized).not.toContain("Sensitive diagnosis");
    expect(serialized).not.toContain("Sensitive clinical note");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("clinicalNotes");
  });
});
