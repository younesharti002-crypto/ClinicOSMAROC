import {
  AppointmentStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  type PaymentMethod,
  type PrismaClient,
} from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";

export async function getBillingSnapshot(db: PrismaClient, ctx: AuthContext) {
  assertCan(ctx.role, "invoice:read");

  const [toBill, invoices] = await Promise.all([
    db.consultation.findMany({
      where: {
        clinicId: ctx.clinicId,
        invoice: null,
        appointment: { status: AppointmentStatus.COMPLETED },
      },
      select: {
        id: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        doctor: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.invoice.findMany({
      where: { clinicId: ctx.clinicId },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        feuilleDeSoinsGenerated: true,
        patient: { select: { firstName: true, lastName: true } },
        payments: {
          where: { status: PaymentStatus.FINALIZED },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    toBill,
    invoices: invoices.map((invoice) => {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      return {
        ...invoice,
        paid,
        balance: invoice.totalAmount.sub(paid),
      };
    }),
  };
}

export async function createInvoiceForConsultation(
  db: PrismaClient,
  ctx: AuthContext,
  consultationId: string,
  totalAmount: Prisma.Decimal,
) {
  assertCan(ctx.role, "invoice:write");

  if (totalAmount.lte(0)) {
    throw new Error("Invoice total must be greater than zero");
  }

  return db.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: {
        id: consultationId,
        clinicId: ctx.clinicId,
        appointment: { status: AppointmentStatus.COMPLETED },
      },
      select: {
        id: true,
        patientId: true,
        invoice: { select: { id: true } },
      },
    });

    if (!consultation) {
      throw new Error("Completed consultation not found in clinic");
    }

    if (consultation.invoice) {
      return consultation.invoice;
    }

    const invoice = await tx.invoice.create({
      data: {
        clinicId: ctx.clinicId,
        patientId: consultation.patientId,
        consultationId: consultation.id,
        totalAmount,
        status: InvoiceStatus.ISSUED,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: invoice.id,
        metadata: { consultationId: consultation.id },
      },
    });

    return invoice;
  });
}

export async function getInvoice(db: PrismaClient, ctx: AuthContext, invoiceId: string) {
  assertCan(ctx.role, "invoice:read");

  return db.invoice.findFirst({
    where: { id: invoiceId, clinicId: ctx.clinicId },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      feuilleDeSoinsGenerated: true,
      createdAt: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          cin: true,
          insuranceType: true,
          immatriculationNo: true,
          affiliationNo: true,
        },
      },
      consultation: {
        select: {
          id: true,
          createdAt: true,
          doctor: {
            select: {
              id: true,
              fullName: true,
              inpeNumber: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: "asc" },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
          receivedBy: { select: { fullName: true } },
        },
      },
    },
  });
}

export async function recordPayment(
  db: PrismaClient,
  ctx: AuthContext,
  invoiceId: string,
  amount: Prisma.Decimal,
  method: PaymentMethod,
) {
  assertCan(ctx.role, "payment:record");

  if (amount.lte(0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, clinicId: ctx.clinicId },
      select: { id: true, totalAmount: true, status: true },
    });

    if (!invoice || invoice.status === InvoiceStatus.VOID) {
      throw new Error("Invoice not found or void");
    }

    const existing = await tx.payment.aggregate({
      where: {
        clinicId: ctx.clinicId,
        invoiceId: invoice.id,
        status: PaymentStatus.FINALIZED,
      },
      _sum: { amount: true },
    });

    const paidBefore = existing._sum.amount ?? new Prisma.Decimal(0);
    const paidAfter = paidBefore.add(amount);

    if (paidAfter.gt(invoice.totalAmount)) {
      throw new Error("Payment exceeds invoice balance");
    }

    const payment = await tx.payment.create({
      data: {
        clinicId: ctx.clinicId,
        invoiceId: invoice.id,
        receivedById: ctx.userId,
        amount,
        method,
        status: PaymentStatus.FINALIZED,
      },
      select: { id: true, amount: true },
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
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          invoiceId: invoice.id,
          method,
          amount: payment.amount.toFixed(2),
        },
      },
    });

    return payment;
  });
}

export async function markFeuilleDeSoinsGenerated(
  db: PrismaClient,
  ctx: AuthContext,
  invoiceId: string,
) {
  assertCan(ctx.role, "invoice:write");

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, clinicId: ctx.clinicId },
    select: { id: true },
  });

  if (!invoice) {
    throw new Error("Invoice not found in clinic");
  }

  await db.$transaction([
    db.invoice.update({
      where: { id: invoice.id },
      data: { feuilleDeSoinsGenerated: true },
    }),
    db.auditLog.create({
      data: {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        action: "FEUILLE_DE_SOINS_GENERATED",
        entityType: "Invoice",
        entityId: invoice.id,
      },
    }),
  ]);
}

export async function getFeuilleDeSoins(
  db: PrismaClient,
  ctx: AuthContext,
  invoiceId: string,
) {
  assertCan(ctx.role, "invoice:read");

  return db.invoice.findFirst({
    where: { id: invoiceId, clinicId: ctx.clinicId },
    select: {
      id: true,
      totalAmount: true,
      createdAt: true,
      patient: {
        select: {
          firstName: true,
          lastName: true,
          cin: true,
          phone: true,
          insuranceType: true,
          immatriculationNo: true,
          affiliationNo: true,
        },
      },
      clinic: {
        select: {
          name: true,
          phone: true,
          address: true,
          city: true,
          inpeNumber: true,
        },
      },
      consultation: {
        select: {
          createdAt: true,
          doctor: {
            select: { fullName: true, inpeNumber: true },
          },
        },
      },
    },
  });
}
