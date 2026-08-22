"use server";

import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import {
  createInvoiceForConsultation,
  markFeuilleDeSoinsGenerated,
  recordPayment,
} from "@/server/repositories/billing";

const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d{1,2})?$/, "Montant invalide")
  .transform((value) => new Prisma.Decimal(value.replace(",", ".")));

const createInvoiceSchema = z.object({
  consultationId: z.string().uuid(),
  totalAmount: moneySchema,
});

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneySchema,
  method: z.enum(["CASH", "CARD", "CHEQUE", "VIREMENT"]),
});

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = createInvoiceSchema.parse({
    consultationId: value(formData, "consultationId"),
    totalAmount: value(formData, "totalAmount"),
  });

  const invoice = await createInvoiceForConsultation(
    prisma,
    ctx,
    parsed.consultationId,
    parsed.totalAmount,
  );

  revalidatePath("/billing");
  redirect(`/invoices/${invoice.id}`);
}

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = paymentSchema.parse({
    invoiceId: value(formData, "invoiceId"),
    amount: value(formData, "amount"),
    method: value(formData, "method"),
  });

  await recordPayment(
    prisma,
    ctx,
    parsed.invoiceId,
    parsed.amount,
    parsed.method as PaymentMethod,
  );

  revalidatePath(`/invoices/${parsed.invoiceId}`);
  revalidatePath("/billing");
}

export async function generateFeuilleDeSoinsAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const invoiceId = z.string().uuid().parse(value(formData, "invoiceId"));

  await markFeuilleDeSoinsGenerated(prisma, ctx, invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/documents/feuille-de-soins/${invoiceId}`);
}
