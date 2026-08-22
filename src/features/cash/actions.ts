"use server";

import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { optionalText } from "@/lib/validation/morocco";
import {
  closeCashDay,
  recordPostCloseAdjustment,
} from "@/server/repositories/cash";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const nonNegativeMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d{1,2})?$/, "Montant invalide")
  .transform((value) => new Prisma.Decimal(value.replace(",", ".")));

const signedMoneySchema = z
  .string()
  .trim()
  .regex(/^-?\d+(?:[.,]\d{1,2})?$/, "Montant invalide")
  .transform((value) => new Prisma.Decimal(value.replace(",", ".")));

const closeSchema = z.object({
  businessDate: dateKeySchema,
  actualCash: nonNegativeMoneySchema,
  actualCard: nonNegativeMoneySchema,
  actualCheque: nonNegativeMoneySchema,
  actualTransfer: nonNegativeMoneySchema,
  notes: z.string().max(1000),
});

const adjustmentSchema = z.object({
  invoiceId: z.string().uuid(),
  businessDate: dateKeySchema,
  amount: signedMoneySchema,
  method: z.enum(["CASH", "CARD", "CHEQUE", "VIREMENT"]),
  reason: z.string().trim().min(5).max(1000),
});

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function closeCashDayAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = closeSchema.parse({
    businessDate: value(formData, "businessDate"),
    actualCash: value(formData, "actualCash"),
    actualCard: value(formData, "actualCard"),
    actualCheque: value(formData, "actualCheque"),
    actualTransfer: value(formData, "actualTransfer"),
    notes: value(formData, "notes"),
  });

  await closeCashDay(prisma, ctx, parsed.businessDate, {
    cash: parsed.actualCash,
    card: parsed.actualCard,
    cheque: parsed.actualCheque,
    transfer: parsed.actualTransfer,
    notes: optionalText(parsed.notes),
  });

  revalidatePath("/cash");
  revalidatePath("/cash/closing");
  revalidatePath("/billing");
  redirect(`/cash?date=${parsed.businessDate}`);
}

export async function recordPostCloseAdjustmentAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = adjustmentSchema.parse({
    invoiceId: value(formData, "invoiceId"),
    businessDate: value(formData, "businessDate"),
    amount: value(formData, "amount"),
    method: value(formData, "method"),
    reason: value(formData, "reason"),
  });

  await recordPostCloseAdjustment(prisma, ctx, {
    invoiceId: parsed.invoiceId,
    businessDate: parsed.businessDate,
    amount: parsed.amount,
    method: parsed.method as PaymentMethod,
    reason: parsed.reason,
  });

  revalidatePath(`/invoices/${parsed.invoiceId}`);
  revalidatePath("/billing");
  revalidatePath("/cash");
}
