import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  type PrismaClient,
} from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan, ForbiddenError } from "@/lib/auth/permissions";
import {
  clinicDayRange,
  zonedDateTimeToUtc,
} from "@/lib/time/clinic-time";

export type CashActualInput = {
  cash: Prisma.Decimal;
  card: Prisma.Decimal;
  cheque: Prisma.Decimal;
  transfer: Prisma.Decimal;
  notes: string | null;
};

export type CashTotals = {
  cash: Prisma.Decimal;
  card: Prisma.Decimal;
  cheque: Prisma.Decimal;
  transfer: Prisma.Decimal;
  total: Prisma.Decimal;
};

function businessDateValue(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function calculateTotals(
  payments: Array<{ amount: Prisma.Decimal; method: PaymentMethod }>,
): CashTotals {
  const totals = {
    cash: new Prisma.Decimal(0),
    card: new Prisma.Decimal(0),
    cheque: new Prisma.Decimal(0),
    transfer: new Prisma.Decimal(0),
  };

  for (const payment of payments) {
    if (payment.method === PaymentMethod.CASH) totals.cash = totals.cash.add(payment.amount);
    if (payment.method === PaymentMethod.CARD) totals.card = totals.card.add(payment.amount);
    if (payment.method === PaymentMethod.CHEQUE) totals.cheque = totals.cheque.add(payment.amount);
    if (payment.method === PaymentMethod.VIREMENT) totals.transfer = totals.transfer.add(payment.amount);
  }

  return {
    ...totals,
    total: totals.cash.add(totals.card).add(totals.cheque).add(totals.transfer),
  };
}

async function clinicTimezone(db: PrismaClient, clinicId: string): Promise<string> {
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { timezone: true },
  });

  if (!clinic) throw new Error("Clinic not found");
  return clinic.timezone;
}

export async function getCashDay(
  db: PrismaClient,
  ctx: AuthContext,
  dateKey: string,
) {
  assertCan(ctx.role, "cash:close");
  const timezone = await clinicTimezone(db, ctx.clinicId);
  const range = clinicDayRange(dateKey, timezone);
  const businessDate = businessDateValue(dateKey);

  const [payments, closing] = await Promise.all([
    db.payment.findMany({
      where: {
        clinicId: ctx.clinicId,
        paidAt: { gte: range.start, lt: range.end },
        status: { in: [PaymentStatus.FINALIZED, PaymentStatus.ADJUSTMENT] },
      },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        paidAt: true,
        invoice: {
          select: {
            id: true,
            patient: { select: { firstName: true, lastName: true } },
          },
        },
        receivedBy: { select: { fullName: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    db.cashClosing.findUnique({
      where: {
        clinicId_businessDate: {
          clinicId: ctx.clinicId,
          businessDate,
        },
      },
      select: {
        id: true,
        businessDate: true,
        theoreticalCash: true,
        theoreticalCard: true,
        theoreticalCheque: true,
        theoreticalTransfer: true,
        actualCash: true,
        actualCard: true,
        actualCheque: true,
        actualTransfer: true,
        totalTheoretical: true,
        totalActual: true,
        variance: true,
        notes: true,
        closedAt: true,
        isLocked: true,
        closedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return {
    dateKey,
    timezone,
    theoretical: calculateTotals(payments),
    payments,
    closing,
  };
}

export async function closeCashDay(
  db: PrismaClient,
  ctx: AuthContext,
  dateKey: string,
  actual: CashActualInput,
) {
  assertCan(ctx.role, "cash:close");
  const timezone = await clinicTimezone(db, ctx.clinicId);
  const range = clinicDayRange(dateKey, timezone);
  const businessDate = businessDateValue(dateKey);

  for (const amount of [actual.cash, actual.card, actual.cheque, actual.transfer]) {
    if (amount.lt(0)) throw new Error("Actual cash totals cannot be negative");
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const existing = await tx.cashClosing.findUnique({
          where: {
            clinicId_businessDate: {
              clinicId: ctx.clinicId,
              businessDate,
            },
          },
          select: { id: true },
        });

        if (existing) throw new Error("Cash day already closed");

        const payments = await tx.payment.findMany({
          where: {
            clinicId: ctx.clinicId,
            paidAt: { gte: range.start, lt: range.end },
            status: { in: [PaymentStatus.FINALIZED, PaymentStatus.ADJUSTMENT] },
          },
          select: { amount: true, method: true },
        });

        const theoretical = calculateTotals(payments);
        const totalActual = actual.cash
          .add(actual.card)
          .add(actual.cheque)
          .add(actual.transfer);
        const variance = totalActual.sub(theoretical.total);
        const methodMismatch =
          !actual.cash.eq(theoretical.cash) ||
          !actual.card.eq(theoretical.card) ||
          !actual.cheque.eq(theoretical.cheque) ||
          !actual.transfer.eq(theoretical.transfer);

        if (methodMismatch && !actual.notes?.trim()) {
          throw new Error("A reason is required when cash totals differ");
        }

        const closing = await tx.cashClosing.create({
          data: {
            clinicId: ctx.clinicId,
            closedById: ctx.userId,
            businessDate,
            theoreticalCash: theoretical.cash,
            theoreticalCard: theoretical.card,
            theoreticalCheque: theoretical.cheque,
            theoreticalTransfer: theoretical.transfer,
            actualCash: actual.cash,
            actualCard: actual.card,
            actualCheque: actual.cheque,
            actualTransfer: actual.transfer,
            totalTheoretical: theoretical.total,
            totalActual,
            variance,
            notes: actual.notes,
            isLocked: true,
          },
          select: { id: true, variance: true, isLocked: true },
        });

        await tx.auditLog.create({
          data: {
            clinicId: ctx.clinicId,
            actorUserId: ctx.userId,
            action: "CASH_DAY_CLOSED",
            entityType: "CashClosing",
            entityId: closing.id,
            metadata: {
              businessDate: dateKey,
              totalTheoretical: theoretical.total.toFixed(2),
              totalActual: totalActual.toFixed(2),
              variance: variance.toFixed(2),
            },
          },
        });

        return closing;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Cash day already closed");
    }
    throw error;
  }
}

export async function recordPostCloseAdjustment(
  db: PrismaClient,
  ctx: AuthContext,
  input: {
    invoiceId: string;
    businessDate: string;
    amount: Prisma.Decimal;
    method: PaymentMethod;
    reason: string;
  },
) {
  if (ctx.role !== Role.DOCTOR_ADMIN) {
    throw new ForbiddenError("Only DOCTOR_ADMIN can create post-close adjustments");
  }

  if (input.amount.eq(0)) throw new Error("Adjustment amount cannot be zero");
  if (input.reason.trim().length < 5) throw new Error("Adjustment reason is required");

  const timezone = await clinicTimezone(db, ctx.clinicId);
  const businessDate = businessDateValue(input.businessDate);
  const paidAt = zonedDateTimeToUtc(`${input.businessDate}T12:00`, timezone);

  return db.$transaction(
    async (tx) => {
      const closing = await tx.cashClosing.findUnique({
        where: {
          clinicId_businessDate: {
            clinicId: ctx.clinicId,
            businessDate,
          },
        },
        select: { id: true, isLocked: true },
      });

      if (!closing?.isLocked) {
        throw new Error("Post-close adjustment requires a locked cash day");
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, clinicId: ctx.clinicId },
        select: { id: true, totalAmount: true, status: true },
      });

      if (!invoice || invoice.status === InvoiceStatus.VOID) {
        throw new Error("Invoice not found or void");
      }

      const aggregate = await tx.payment.aggregate({
        where: {
          clinicId: ctx.clinicId,
          invoiceId: invoice.id,
          status: { in: [PaymentStatus.FINALIZED, PaymentStatus.ADJUSTMENT] },
        },
        _sum: { amount: true },
      });
      const paidBefore = aggregate._sum.amount ?? new Prisma.Decimal(0);
      const paidAfter = paidBefore.add(input.amount);

      if (paidAfter.lt(0) || paidAfter.gt(invoice.totalAmount)) {
        throw new Error("Adjustment would make invoice reconciliation invalid");
      }

      const payment = await tx.payment.create({
        data: {
          clinicId: ctx.clinicId,
          invoiceId: invoice.id,
          receivedById: ctx.userId,
          amount: input.amount,
          method: input.method,
          status: PaymentStatus.ADJUSTMENT,
          paidAt,
        },
        select: { id: true },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: paidAfter.gte(invoice.totalAmount)
            ? InvoiceStatus.PAID
            : InvoiceStatus.ISSUED,
        },
      });

      await tx.auditLog.create({
        data: {
          clinicId: ctx.clinicId,
          actorUserId: ctx.userId,
          action: "POST_CLOSE_PAYMENT_ADJUSTMENT",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            invoiceId: invoice.id,
            cashClosingId: closing.id,
            businessDate: input.businessDate,
            method: input.method,
            amount: input.amount.toFixed(2),
            reason: input.reason.trim(),
          },
        },
      });

      return payment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
