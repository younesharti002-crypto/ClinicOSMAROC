import {
  AppointmentStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/auth/context";
import { ForbiddenError } from "@/lib/auth/permissions";
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

function ctx(user: {
  id: string;
  clinicId: string;
  role: Role;
  fullName: string;
}): AuthContext {
  return {
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    fullName: user.fullName,
  };
}

async function fixture() {
  const [clinicA, clinicB] = await Promise.all([
    db.clinic.create({
      data: {
        name: "M7 Clinic A",
        slug: "m7-clinic-a",
        phone: "+212600000071",
        address: "Casablanca",
        timezone: TZ,
      },
    }),
    db.clinic.create({
      data: {
        name: "M7 Clinic B",
        slug: "m7-clinic-b",
        phone: "+212600000072",
        address: "Rabat",
        timezone: TZ,
      },
    }),
  ]);

  const [adminA, doctorA, secretaryA, adminB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "admin-a@m7.test",
        passwordHash: "test",
        fullName: "Dr Admin A",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "doctor-a@m7.test",
        passwordHash: "test",
        fullName: "Dr Analytics A",
        role: Role.DOCTOR,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary-a@m7.test",
        passwordHash: "test",
        fullName: "Secretary Analytics A",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "admin-b@m7.test",
        passwordHash: "test",
        fullName: "Dr Admin B",
        role: Role.DOCTOR_ADMIN,
      },
    }),
  ]);

  const [patientA1, patientA2, patientB] = await Promise.all([
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Patient",
        lastName: "A1",
        phone: "+212611111171",
        createdAt: zonedDateTimeToUtc("2026-08-03T10:00", TZ),
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Patient",
        lastName: "A2",
        phone: "+212611111172",
        createdAt: zonedDateTimeToUtc("2026-08-10T10:00", TZ),
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Patient",
        lastName: "B",
        phone: "+212611111173",
        createdAt: zonedDateTimeToUtc("2026-08-04T10:00", TZ),
      },
    }),
  ]);

  await Promise.all([
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA1.id,
        doctorId: doctorA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-05T09:00", TZ),
        status: AppointmentStatus.COMPLETED,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA1.id,
        doctorId: doctorA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-06T09:00", TZ),
        status: AppointmentStatus.NO_SHOW,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA2.id,
        doctorId: doctorA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-07T09:00", TZ),
        status: AppointmentStatus.CANCELLED,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA2.id,
        doctorId: adminA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-22T09:00", TZ),
        status: AppointmentStatus.COMPLETED,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA2.id,
        doctorId: adminA.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-22T10:00", TZ),
        status: AppointmentStatus.WAITING_ROOM,
      },
    }),
    db.appointment.create({
      data: {
        clinicId: clinicB.id,
        patientId: patientB.id,
        doctorId: adminB.id,
        scheduledAt: zonedDateTimeToUtc("2026-08-22T11:00", TZ),
        status: AppointmentStatus.COMPLETED,
      },
    }),
  ]);

  const [invoiceA1, invoiceA2, invoiceA3, invoiceB] = await Promise.all([
    db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA1.id,
        totalAmount: new Prisma.Decimal("500.00"),
        status: InvoiceStatus.ISSUED,
      },
    }),
    db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA2.id,
        totalAmount: new Prisma.Decimal("500.00"),
        status: InvoiceStatus.ISSUED,
      },
    }),
    db.invoice.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA2.id,
        totalAmount: new Prisma.Decimal("999.00"),
        status: InvoiceStatus.ISSUED,
      },
    }),
    db.invoice.create({
      data: {
        clinicId: clinicB.id,
        patientId: patientB.id,
        totalAmount: new Prisma.Decimal("500.00"),
        status: InvoiceStatus.ISSUED,
      },
    }),
  ]);

  await Promise.all([
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceA1.id,
        receivedById: secretaryA.id,
        amount: new Prisma.Decimal("100.00"),
        method: PaymentMethod.CASH,
        status: PaymentStatus.FINALIZED,
        paidAt: zonedDateTimeToUtc("2026-08-05T12:00", TZ),
      },
    }),
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceA2.id,
        receivedById: secretaryA.id,
        amount: new Prisma.Decimal("200.00"),
        method: PaymentMethod.CARD,
        status: PaymentStatus.FINALIZED,
        paidAt: zonedDateTimeToUtc("2026-08-22T12:00", TZ),
      },
    }),
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceA1.id,
        receivedById: adminA.id,
        amount: new Prisma.Decimal("-20.00"),
        method: PaymentMethod.CASH,
        status: PaymentStatus.ADJUSTMENT,
        paidAt: zonedDateTimeToUtc("2026-08-05T13:00", TZ),
      },
    }),
    db.payment.create({
      data: {
        clinicId: clinicA.id,
        invoiceId: invoiceA3.id,
        receivedById: secretaryA.id,
        amount: new Prisma.Decimal("999.00"),
        method: PaymentMethod.CHEQUE,
        status: PaymentStatus.VOIDED,
        paidAt: zonedDateTimeToUtc("2026-08-08T12:00", TZ),
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

  return {
    clinicA,
    clinicB,
    adminA,
    adminB,
    doctorA,
    secretaryA,
  };
}

describe("M7 business analytics", () => {
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

  it("computes clinic-scoped monthly business KPIs and today's operations", async () => {
    const { adminA } = await fixture();
    const analytics = await getBusinessAnalytics(
      db,
      ctx(adminA),
      "2026-08",
      zonedDateTimeToUtc("2026-08-22T15:00", TZ),
    );

    expect(analytics.month.totalAppointments).toBe(5);
    expect(analytics.month.completed).toBe(2);
    expect(analytics.month.noShow).toBe(1);
    expect(analytics.month.cancelled).toBe(1);
    expect(analytics.month.activeAppointments).toBe(4);
    expect(analytics.month.noShowRate).toBe(33.3);
    expect(analytics.month.completionRate).toBe(66.7);
    expect(analytics.month.newPatients).toBe(2);

    expect(analytics.month.revenue.cash.toFixed(2)).toBe("80.00");
    expect(analytics.month.revenue.card.toFixed(2)).toBe("200.00");
    expect(analytics.month.revenue.cheque.toFixed(2)).toBe("0.00");
    expect(analytics.month.revenue.transfer.toFixed(2)).toBe("0.00");
    expect(analytics.month.revenue.total.toFixed(2)).toBe("280.00");

    expect(analytics.today.total).toBe(2);
    expect(analytics.today.completed).toBe(1);
    expect(analytics.today.waiting).toBe(1);
  });

  it("returns doctor operational performance without clinical fields", async () => {
    const { adminA, doctorA } = await fixture();
    const analytics = await getBusinessAnalytics(
      db,
      ctx(adminA),
      "2026-08",
      zonedDateTimeToUtc("2026-08-22T15:00", TZ),
    );

    const doctor = analytics.doctors.find((row) => row.doctorId === doctorA.id);
    const admin = analytics.doctors.find((row) => row.doctorId === adminA.id);

    expect(doctor).toMatchObject({
      appointments: 3,
      completed: 1,
      noShow: 1,
      completionRate: 50,
    });
    expect(admin).toMatchObject({
      appointments: 2,
      completed: 1,
      noShow: 0,
      completionRate: 100,
    });

    const serialized = JSON.stringify(analytics);
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("clinicalNotes");
  });

  it("isolates Clinic A and Clinic B analytics", async () => {
    const { adminA, adminB } = await fixture();
    const [analyticsA, analyticsB] = await Promise.all([
      getBusinessAnalytics(db, ctx(adminA), "2026-08"),
      getBusinessAnalytics(db, ctx(adminB), "2026-08"),
    ]);

    expect(analyticsA.month.revenue.total.toFixed(2)).toBe("280.00");
    expect(analyticsA.month.totalAppointments).toBe(5);
    expect(analyticsB.month.revenue.total.toFixed(2)).toBe("500.00");
    expect(analyticsB.month.totalAppointments).toBe(1);
  });

  it("rejects secretary and non-admin doctor access", async () => {
    const { secretaryA, doctorA } = await fixture();

    await expect(
      getBusinessAnalytics(db, ctx(secretaryA), "2026-08"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      getBusinessAnalytics(db, ctx(doctorA), "2026-08"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects invalid month keys", async () => {
    const { adminA } = await fixture();

    await expect(
      getBusinessAnalytics(db, ctx(adminA), "2026-13"),
    ).rejects.toThrow("Invalid analytics month");
    await expect(
      getBusinessAnalytics(db, ctx(adminA), "August-2026"),
    ).rejects.toThrow("Invalid analytics month");
  });
});
