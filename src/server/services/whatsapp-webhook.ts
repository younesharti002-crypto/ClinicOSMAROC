import {
  AppointmentStatus,
  Prisma,
  type PrismaClient,
  WhatsAppEventType,
  WhatsAppStatus,
} from "@prisma/client";

import { normalizeMoroccanPhone } from "@/lib/validation/morocco";

type AnyRecord = Record<string, unknown>;

type ParsedAction = {
  action: "CONFIRM" | "CANCEL";
  appointmentId: string;
};

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeInboundPhone(value: string): string | null {
  try {
    const candidate = value.startsWith("212") ? `+${value}` : value;
    return normalizeMoroccanPhone(candidate);
  } catch {
    return null;
  }
}

function mapDeliveryStatus(value: string): WhatsAppStatus | null {
  switch (value.toLowerCase()) {
    case "sent":
      return WhatsAppStatus.SENT;
    case "delivered":
      return WhatsAppStatus.DELIVERED;
    case "read":
      return WhatsAppStatus.READ;
    case "failed":
      return WhatsAppStatus.FAILED;
    default:
      return null;
  }
}

function extractReplyPayload(message: AnyRecord): string | null {
  if (isRecord(message.button)) {
    const payload = asString(message.button.payload);
    if (payload) return payload;
  }

  if (isRecord(message.interactive) && isRecord(message.interactive.button_reply)) {
    const id = asString(message.interactive.button_reply.id);
    if (id) return id;
  }

  return null;
}

export function parseAppointmentReply(message: unknown): ParsedAction | null {
  if (!isRecord(message)) return null;
  const payload = extractReplyPayload(message);
  if (!payload) return null;

  const match = /^(CONFIRM|CANCEL):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
    payload,
  );
  if (!match) return null;

  return {
    action: match[1].toUpperCase() as ParsedAction["action"],
    appointmentId: match[2],
  };
}

async function persistUnmatchedInbound(
  db: PrismaClient,
  input: {
    clinicId: string;
    providerMessageId: string;
    patientId?: string | null;
    reason: string;
  },
) {
  try {
    await db.whatsAppEvent.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId ?? null,
        providerMessageId: input.providerMessageId,
        eventType: WhatsAppEventType.WEBHOOK_RECEIVED,
        status: WhatsAppStatus.RECEIVED,
        payload: { reason: input.reason },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

async function applyAppointmentReply(
  db: PrismaClient,
  input: {
    clinicId: string;
    providerMessageId: string;
    from: string;
    parsed: ParsedAction;
  },
) {
  const normalizedFrom = normalizeInboundPhone(input.from);
  if (!normalizedFrom) {
    await persistUnmatchedInbound(db, {
      clinicId: input.clinicId,
      providerMessageId: input.providerMessageId,
      reason: "INVALID_SENDER_PHONE",
    });
    return "ignored" as const;
  }

  const appointment = await db.appointment.findFirst({
    where: {
      id: input.parsed.appointmentId,
      clinicId: input.clinicId,
    },
    select: {
      id: true,
      status: true,
      patient: { select: { id: true, phone: true } },
    },
  });

  if (!appointment || appointment.patient.phone !== normalizedFrom) {
    await persistUnmatchedInbound(db, {
      clinicId: input.clinicId,
      providerMessageId: input.providerMessageId,
      reason: "APPOINTMENT_OR_PATIENT_MISMATCH",
    });
    return "ignored" as const;
  }

  const eventType =
    input.parsed.action === "CONFIRM"
      ? WhatsAppEventType.CONFIRMATION_RECEIVED
      : WhatsAppEventType.CANCELLATION_RECEIVED;

  try {
    return await db.$transaction(async (tx) => {
      await tx.whatsAppEvent.create({
        data: {
          clinicId: input.clinicId,
          patientId: appointment.patient.id,
          appointmentId: appointment.id,
          providerMessageId: input.providerMessageId,
          eventType,
          status: WhatsAppStatus.RECEIVED,
          payload: { action: input.parsed.action },
        },
      });

      let targetStatus: AppointmentStatus | null = null;
      if (
        input.parsed.action === "CONFIRM" &&
        appointment.status === AppointmentStatus.SCHEDULED
      ) {
        targetStatus = AppointmentStatus.CONFIRMED;
      }
      if (
        input.parsed.action === "CANCEL" &&
        [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED].includes(
          appointment.status,
        )
      ) {
        targetStatus = AppointmentStatus.CANCELLED;
      }

      if (!targetStatus) {
        return "recorded" as const;
      }

      const updated = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          clinicId: input.clinicId,
          status: appointment.status,
        },
        data: { status: targetStatus },
      });

      if (updated.count === 1) {
        await tx.auditLog.create({
          data: {
            clinicId: input.clinicId,
            actorUserId: null,
            action:
              targetStatus === AppointmentStatus.CONFIRMED
                ? "WHATSAPP_APPOINTMENT_CONFIRMED"
                : "WHATSAPP_APPOINTMENT_CANCELLED",
            entityType: "Appointment",
            entityId: appointment.id,
            metadata: {
              source: "WHATSAPP",
              from: appointment.status,
              to: targetStatus,
            },
          },
        });
        return "updated" as const;
      }

      return "recorded" as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate" as const;
    }
    throw error;
  }
}

async function processDeliveryStatuses(
  db: PrismaClient,
  clinicId: string,
  statuses: unknown[],
) {
  let processed = 0;

  for (const rawStatus of statuses) {
    if (!isRecord(rawStatus)) continue;
    const providerMessageId = asString(rawStatus.id);
    const statusValue = asString(rawStatus.status);
    if (!providerMessageId || !statusValue) continue;

    const mapped = mapDeliveryStatus(statusValue);
    if (!mapped) continue;

    await db.whatsAppEvent.upsert({
      where: {
        clinicId_providerMessageId: {
          clinicId,
          providerMessageId,
        },
      },
      create: {
        clinicId,
        providerMessageId,
        eventType: WhatsAppEventType.DELIVERY_STATUS,
        status: mapped,
        payload: { providerStatus: statusValue },
      },
      update: {
        status: mapped,
        payload: { providerStatus: statusValue },
      },
    });
    processed += 1;
  }

  return processed;
}

export async function processWhatsAppWebhook(
  db: PrismaClient,
  payload: unknown,
) {
  if (!isRecord(payload)) {
    return { processed: 0, ignored: 0 };
  }

  let processed = 0;
  let ignored = 0;

  for (const rawEntry of asArray(payload.entry)) {
    if (!isRecord(rawEntry)) continue;

    for (const rawChange of asArray(rawEntry.changes)) {
      if (!isRecord(rawChange) || !isRecord(rawChange.value)) continue;
      const value = rawChange.value;
      const metadata = isRecord(value.metadata) ? value.metadata : null;
      const phoneNumberId = metadata
        ? asString(metadata.phone_number_id)
        : null;
      if (!phoneNumberId) {
        ignored += 1;
        continue;
      }

      const clinic = await db.clinic.findUnique({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true, whatsappEnabled: true },
      });
      if (!clinic?.whatsappEnabled) {
        ignored += 1;
        continue;
      }

      processed += await processDeliveryStatuses(
        db,
        clinic.id,
        asArray(value.statuses),
      );

      for (const rawMessage of asArray(value.messages)) {
        if (!isRecord(rawMessage)) continue;
        const providerMessageId = asString(rawMessage.id);
        const from = asString(rawMessage.from);
        if (!providerMessageId || !from) {
          ignored += 1;
          continue;
        }

        const parsed = parseAppointmentReply(rawMessage);
        if (!parsed) {
          const normalizedFrom = normalizeInboundPhone(from);
          const patient = normalizedFrom
            ? await db.patient.findFirst({
                where: { clinicId: clinic.id, phone: normalizedFrom },
                select: { id: true },
              })
            : null;
          await persistUnmatchedInbound(db, {
            clinicId: clinic.id,
            providerMessageId,
            patientId: patient?.id,
            reason: "UNSUPPORTED_INBOUND_MESSAGE",
          });
          ignored += 1;
          continue;
        }

        const result = await applyAppointmentReply(db, {
          clinicId: clinic.id,
          providerMessageId,
          from,
          parsed,
        });
        if (result === "ignored" || result === "duplicate") {
          ignored += 1;
        } else {
          processed += 1;
        }
      }
    }
  }

  return { processed, ignored };
}
