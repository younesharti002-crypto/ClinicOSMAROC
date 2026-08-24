import {
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
import { clinicDateKey } from "@/lib/time/clinic-time";
import { recordPayment } from "@/server/repositories/billing";
import {
  closeCashDay,
  getCashDay,
  recordPostCloseAdjustment,
} from "@/server/repositories/cash";

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
  const clinic = await db.clinic.create({
    data: {
      name: "M5 Gate Clinic",
      slug: "m5-gate-clinic",
      phone: "+212600000041",
      address: "Casablanca",
      timezone: "Africa/Casablanca",
    },
  });

  const [secretary, admin, doctor] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinic.id,
        email: "secretary@m5-gate.test",
        passwordHash: "test",
        fullName: "Secretary M5 Gate",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinic.id,
        email: "admin@m5-gate.test",
        passwordHash: "test",
        fullName: "Admin M5 Gate",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinic.id,
        email: "doctor@m5-gate.test",
        passwordHash: "test",
        fullName: "Doctor M5 Gate",
        role: Role.DOCTOR,
      },
    }),
  ]);

  const patient = await db.patient.create({
    data: {
      clinicId: clinic.id,
      firstName: "Cash",
      lastName: "Gate Patient",
      phone: "+212611111151",
    },
  });

  const ctx = (user: typeof secretary): AuthContext => ({
    userId: user.id,
    clinicId: clinic.id,
    role: user.role,
    fullName: user.fullName,
  });

  return {
    clinic,
    patient,
    secretaryCtx: ctx(secretary),
    adminCtx: ctx(admin),
    doctorCtx: ctx(doctor),
  };
}

async function createInvoice(clinicId: string, patientId: string, total = "300.00") {
  return db.invoice.create({
    data: {
      clinicId,
      patientId,
      totalAmount: new Prisma.Decimal(total),
      status: InvoiceStatus.ISSUED,
    },
  });
}

function todayKey() {
  return clinicDateKey(new Date(), "Africa/Casablanca");
}

describe("M5 acceptance gate hardening", () => {
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

  it("keeps daily cash access unavailable to a regular doctor", async () => {
    const { doctorCtx } = await fixture();

    await expect(getCashDay(db, doctorCtx, todayKey())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("audits the official close with immutable reconciliation totals", async () => {
    const { clinic, patient, secretaryCtx } = await fixture();
    const invoice = await createInvoice(clinic.id, patient.id);
    await recordPayment(
      db,
      secretaryCtx,
      invoice.id,
      new Prisma.Decimal("125.00"),
      PaymentMethod.CASH,
    );

    const closing = await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("125.00"),
      card: new Prisma.Decimal(0),
      cheque: new Prisma.Decimal(0),
      transfer: new Prisma.Decimal(0),
      notes: null,
    });

    const audit = await db.auditLog.findFirst({
      where: {
        clinicId: clinic.id,
        action: "CASH_DAY_CLOSED",
        entityId: closing.id,
      },
    });

    expect(audit).not.toBeNull();
    expect(audit?.metadata).toEqual(
      expect.objectContaining({
        businessDate: todayKey(),
        totalTheoretical: "125.00",
        totalActual: "125.00",
        variance: "0.00",
      }),
    );
  });

  it("supports an audited negative admin adjustment without rewriting the official close", async () => {
    const { clinic, patient, secretaryCtx, adminCtx } = await fixture();
    const invoice = await createInvoice(clinic.id, patient.id, "300.00");
    await recordPayment(
      db,
      secretaryCtx,
      invoice.id,
      new Prisma.Decimal("150.00"),
      PaymentMethod.CASH,
    );

    const closing = await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("150.00"),
      card: new Prisma.Decimal(0),
      cheque: new Prisma.Decimal(0),
      transfer: new Prisma.Decimal(0),
      notes: null,
    });

    const adjustment = await recordPostCloseAdjustment(db, adminCtx, {
      invoiceId: invoice.id,
      businessDate: todayKey(),
      amount: new Prisma.Decimal("-50.00"),
      method: PaymentMethod.CASH,
      reason: "Correction validée après clôture",
    });

    const [storedClosing, storedAdjustment, storedInvoice, dynamicDay, audit] =
      await Promise.all([
        db.cashClosing.findUnique({ where: { id: closing.id } }),
        db.payment.findUnique({ where: { id: adjustment.id } }),
        db.invoice.findUnique({ where: { id: invoice.id } }),
        getCashDay(db, secretaryCtx, todayKey()),
        db.auditLog.findFirst({
          where: {
            clinicId: clinic.id,
            action: "POST_CLOSE_PAYMENT_ADJUSTMENT",
            entityId: adjustment.id,
          },
        }),
      ]);

    expect(storedAdjustment?.status).toBe(PaymentStatus.ADJUSTMENT);
    expect(storedInvoice?.status).toBe(InvoiceStatus.ISSUED);
    expect(dynamicDay.theoretical.cash.toFixed(2)).toBe("100.00");
    expect(storedClosing?.theoreticalCash.toFixed(2)).toBe("150.00");
    expect(storedClosing?.actualCash.toFixed(2)).toBe("150.00");
    expect(audit?.metadata).toEqual(
      expect.objectContaining({
        amount: "-50.00",
        reason: "Correction validée après clôture",
      }),
    );
  });
});
