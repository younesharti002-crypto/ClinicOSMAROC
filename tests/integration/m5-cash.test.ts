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
  const clinicA = await db.clinic.create({
    data: {
      name: "M5 Clinic A",
      slug: "m5-clinic-a",
      phone: "+212600000031",
      address: "Casablanca",
      timezone: "Africa/Casablanca",
    },
  });
  const clinicB = await db.clinic.create({
    data: {
      name: "M5 Clinic B",
      slug: "m5-clinic-b",
      phone: "+212600000032",
      address: "Rabat",
      timezone: "Africa/Casablanca",
    },
  });

  const [secretaryA, adminA, secretaryB] = await Promise.all([
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "secretary-a@m5.test",
        passwordHash: "test",
        fullName: "Secretary A M5",
        role: Role.SECRETARY,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicA.id,
        email: "admin-a@m5.test",
        passwordHash: "test",
        fullName: "Admin A M5",
        role: Role.DOCTOR_ADMIN,
      },
    }),
    db.user.create({
      data: {
        clinicId: clinicB.id,
        email: "secretary-b@m5.test",
        passwordHash: "test",
        fullName: "Secretary B M5",
        role: Role.SECRETARY,
      },
    }),
  ]);

  const [patientA, patientB] = await Promise.all([
    db.patient.create({
      data: {
        clinicId: clinicA.id,
        firstName: "Cash",
        lastName: "Patient A",
        phone: "+212611111141",
      },
    }),
    db.patient.create({
      data: {
        clinicId: clinicB.id,
        firstName: "Cash",
        lastName: "Patient B",
        phone: "+212611111142",
      },
    }),
  ]);

  const secretaryCtx: AuthContext = {
    userId: secretaryA.id,
    clinicId: clinicA.id,
    role: Role.SECRETARY,
    fullName: secretaryA.fullName,
  };
  const adminCtx: AuthContext = {
    userId: adminA.id,
    clinicId: clinicA.id,
    role: Role.DOCTOR_ADMIN,
    fullName: adminA.fullName,
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
    patientA,
    patientB,
    secretaryCtx,
    adminCtx,
    secretaryBCtx,
  };
}

async function invoice(clinicId: string, patientId: string, total = "500.00") {
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

describe("M5 daily cash closing and lock", () => {
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

  it("calculates theoretical totals by payment method and clinic", async () => {
    const { clinicA, patientA, secretaryCtx, secretaryBCtx } = await fixture();
    const invoices = await Promise.all([
      invoice(clinicA.id, patientA.id),
      invoice(clinicA.id, patientA.id),
      invoice(clinicA.id, patientA.id),
      invoice(clinicA.id, patientA.id),
    ]);

    await recordPayment(db, secretaryCtx, invoices[0].id, new Prisma.Decimal("100.00"), PaymentMethod.CASH);
    await recordPayment(db, secretaryCtx, invoices[1].id, new Prisma.Decimal("200.00"), PaymentMethod.CARD);
    await recordPayment(db, secretaryCtx, invoices[2].id, new Prisma.Decimal("50.00"), PaymentMethod.CHEQUE);
    await recordPayment(db, secretaryCtx, invoices[3].id, new Prisma.Decimal("25.00"), PaymentMethod.VIREMENT);

    const dayA = await getCashDay(db, secretaryCtx, todayKey());
    const dayB = await getCashDay(db, secretaryBCtx, todayKey());

    expect(dayA.theoretical.cash.toFixed(2)).toBe("100.00");
    expect(dayA.theoretical.card.toFixed(2)).toBe("200.00");
    expect(dayA.theoretical.cheque.toFixed(2)).toBe("50.00");
    expect(dayA.theoretical.transfer.toFixed(2)).toBe("25.00");
    expect(dayA.theoretical.total.toFixed(2)).toBe("375.00");
    expect(dayB.theoretical.total.toFixed(2)).toBe("0.00");
  });

  it("closes equal totals, locks the day, and rejects duplicate closing", async () => {
    const { clinicA, patientA, secretaryCtx } = await fixture();
    const cashInvoice = await invoice(clinicA.id, patientA.id);
    await recordPayment(db, secretaryCtx, cashInvoice.id, new Prisma.Decimal("120.00"), PaymentMethod.CASH);

    const closing = await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("120.00"),
      card: new Prisma.Decimal("0.00"),
      cheque: new Prisma.Decimal("0.00"),
      transfer: new Prisma.Decimal("0.00"),
      notes: null,
    });

    expect(closing.isLocked).toBe(true);
    expect(closing.variance.toFixed(2)).toBe("0.00");

    await expect(
      closeCashDay(db, secretaryCtx, todayKey(), {
        cash: new Prisma.Decimal("120.00"),
        card: new Prisma.Decimal("0.00"),
        cheque: new Prisma.Decimal("0.00"),
        transfer: new Prisma.Decimal("0.00"),
        notes: null,
      }),
    ).rejects.toThrow("Cash day already closed");
  });

  it("requires a reason for method mismatch even when grand total is unchanged", async () => {
    const { clinicA, patientA, secretaryCtx } = await fixture();
    const cashInvoice = await invoice(clinicA.id, patientA.id);
    const cardInvoice = await invoice(clinicA.id, patientA.id);
    await recordPayment(db, secretaryCtx, cashInvoice.id, new Prisma.Decimal("100.00"), PaymentMethod.CASH);
    await recordPayment(db, secretaryCtx, cardInvoice.id, new Prisma.Decimal("100.00"), PaymentMethod.CARD);

    await expect(
      closeCashDay(db, secretaryCtx, todayKey(), {
        cash: new Prisma.Decimal("150.00"),
        card: new Prisma.Decimal("50.00"),
        cheque: new Prisma.Decimal("0.00"),
        transfer: new Prisma.Decimal("0.00"),
        notes: null,
      }),
    ).rejects.toThrow("A reason is required when cash totals differ");
  });

  it("blocks normal payments after the business day is closed", async () => {
    const { clinicA, patientA, secretaryCtx } = await fixture();
    const paidInvoice = await invoice(clinicA.id, patientA.id);
    const unpaidInvoice = await invoice(clinicA.id, patientA.id);
    await recordPayment(db, secretaryCtx, paidInvoice.id, new Prisma.Decimal("80.00"), PaymentMethod.CASH);

    await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("80.00"),
      card: new Prisma.Decimal("0.00"),
      cheque: new Prisma.Decimal("0.00"),
      transfer: new Prisma.Decimal("0.00"),
      notes: null,
    });

    await expect(
      recordPayment(db, secretaryCtx, unpaidInvoice.id, new Prisma.Decimal("50.00"), PaymentMethod.CASH),
    ).rejects.toThrow("Cash day is closed; use an admin adjustment");
  });

  it("allows only DOCTOR_ADMIN to make an audited post-close adjustment without changing official close", async () => {
    const { clinicA, patientA, secretaryCtx, adminCtx } = await fixture();
    const targetInvoice = await invoice(clinicA.id, patientA.id, "300.00");
    await recordPayment(db, secretaryCtx, targetInvoice.id, new Prisma.Decimal("100.00"), PaymentMethod.CASH);

    const official = await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("100.00"),
      card: new Prisma.Decimal("0.00"),
      cheque: new Prisma.Decimal("0.00"),
      transfer: new Prisma.Decimal("0.00"),
      notes: null,
    });

    await expect(
      recordPostCloseAdjustment(db, secretaryCtx, {
        invoiceId: targetInvoice.id,
        businessDate: todayKey(),
        amount: new Prisma.Decimal("50.00"),
        method: PaymentMethod.CASH,
        reason: "Correction contrôlée",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const adjustment = await recordPostCloseAdjustment(db, adminCtx, {
      invoiceId: targetInvoice.id,
      businessDate: todayKey(),
      amount: new Prisma.Decimal("50.00"),
      method: PaymentMethod.CASH,
      reason: "Correction après clôture validée par administrateur",
    });

    const [storedAdjustment, storedClosing, audit, dynamicDay] = await Promise.all([
      db.payment.findUnique({ where: { id: adjustment.id } }),
      db.cashClosing.findUnique({ where: { id: official.id } }),
      db.auditLog.findFirst({
        where: {
          clinicId: clinicA.id,
          action: "POST_CLOSE_PAYMENT_ADJUSTMENT",
          entityId: adjustment.id,
        },
      }),
      getCashDay(db, secretaryCtx, todayKey()),
    ]);

    expect(storedAdjustment?.status).toBe(PaymentStatus.ADJUSTMENT);
    expect(storedClosing?.theoreticalCash.toFixed(2)).toBe("100.00");
    expect(storedClosing?.actualCash.toFixed(2)).toBe("100.00");
    expect(storedClosing?.variance.toFixed(2)).toBe("0.00");
    expect(dynamicDay.theoretical.cash.toFixed(2)).toBe("150.00");
    expect(audit?.metadata).toBeTruthy();
  });

  it("keeps locked cash days isolated per clinic", async () => {
    const { clinicA, patientA, secretaryCtx, secretaryBCtx } = await fixture();
    const targetInvoice = await invoice(clinicA.id, patientA.id);
    await recordPayment(db, secretaryCtx, targetInvoice.id, new Prisma.Decimal("60.00"), PaymentMethod.CASH);
    await closeCashDay(db, secretaryCtx, todayKey(), {
      cash: new Prisma.Decimal("60.00"),
      card: new Prisma.Decimal("0.00"),
      cheque: new Prisma.Decimal("0.00"),
      transfer: new Prisma.Decimal("0.00"),
      notes: null,
    });

    const otherClinicDay = await getCashDay(db, secretaryBCtx, todayKey());
    expect(otherClinicDay.closing).toBeNull();
    expect(otherClinicDay.theoretical.total.toFixed(2)).toBe("0.00");
  });
});
