"use server";

import { AppointmentStatus, AppointmentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { clinicDateKey, zonedDateTimeToUtc } from "@/lib/time/clinic-time";
import { optionalText } from "@/lib/validation/morocco";
import {
  createAppointment,
  transitionAppointment,
} from "@/server/repositories/appointments";

const createSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z.string().trim().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  type: z.enum(["BOOKED", "WALK_IN", "EMERGENCY"]),
  notes: z.string().trim().max(500).optional(),
});

const transitionSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum([
    "SCHEDULED",
    "CONFIRMED",
    "WAITING_ROOM",
    "IN_CONSULTATION",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]),
});

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

async function clinicTimezone(clinicId: string): Promise<string> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { timezone: true },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  return clinic.timezone;
}

export async function createAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = createSchema.parse({
    patientId: value(formData, "patientId"),
    doctorId: value(formData, "doctorId"),
    scheduledAt: value(formData, "scheduledAt"),
    durationMinutes: value(formData, "durationMinutes"),
    type: value(formData, "type"),
    notes: value(formData, "notes"),
  });

  const timezone = await clinicTimezone(ctx.clinicId);
  const type = parsed.type as AppointmentType;

  if (type === AppointmentType.BOOKED && !parsed.scheduledAt) {
    throw new Error("Booked appointments require a scheduled time");
  }

  const scheduledAt = parsed.scheduledAt
    ? zonedDateTimeToUtc(parsed.scheduledAt, timezone)
    : new Date();

  await createAppointment(prisma, ctx, {
    patientId: parsed.patientId,
    doctorId: parsed.doctorId,
    scheduledAt,
    durationMinutes: parsed.durationMinutes,
    type,
    notes: optionalText(parsed.notes),
  });

  revalidatePath("/reception");
  revalidatePath("/agenda");
  revalidatePath("/queue");

  if (type === AppointmentType.BOOKED) {
    redirect(`/agenda?date=${clinicDateKey(scheduledAt, timezone)}`);
  }

  redirect("/queue");
}

export async function transitionAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const parsed = transitionSchema.parse({
    appointmentId: value(formData, "appointmentId"),
    status: value(formData, "status"),
  });

  await transitionAppointment(
    prisma,
    ctx,
    parsed.appointmentId,
    parsed.status as AppointmentStatus,
  );

  revalidatePath("/reception");
  revalidatePath("/agenda");
  revalidatePath("/queue");
}
