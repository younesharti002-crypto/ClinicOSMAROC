import {
  AppointmentStatus,
  AppointmentType,
  Prisma,
  type PrismaClient,
  WhatsAppEventType,
  WhatsAppStatus,
} from "@prisma/client";

import { buildReminderTemplatePayload } from "@/lib/whatsapp/template";
import {
  sendWhatsAppTemplate,
  type WhatsAppSendResult,
} from "@/server/services/whatsapp-client";

type ReminderSender = (args: {
  phoneNumberId: string;
  payload: unknown;
}) => Promise<WhatsAppSendResult>;

function appointmentDisplayParts(date: Date, timeZone: string) {
  const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
    timeZone,
    dateStyle: "medium",
  });
  const timeFormatter = new Intl.DateTimeFormat("fr-MA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

async function claimReminderEvent(
  db: PrismaClient,
  input: {
    clinicId: string;
    patientId: string;
    appointmentId: string;
    templateName: string;
    languageCode: string;
  },
) {
  try {
    return await db.whatsAppEvent.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        eventType: WhatsAppEventType.REMINDER_SENT,
        status: WhatsAppStatus.PENDING,
        payload: {
          templateName: input.templateName,
          languageCode: input.languageCode,
        },
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

export async function sendDueAppointmentReminders(
  db: PrismaClient,
  now = new Date(),
  sender: ReminderSender = sendWhatsAppTemplate,
) {
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const clinics = await db.clinic.findMany({
    where: {
      whatsappEnabled: true,
      whatsappPhoneNumberId: { not: null },
      whatsappReminderTemplate: { not: null },
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      whatsappPhoneNumberId: true,
      whatsappReminderTemplate: true,
      whatsappLanguageCode: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const clinic of clinics) {
    if (!clinic.whatsappPhoneNumberId || !clinic.whatsappReminderTemplate) {
      continue;
    }

    const appointments = await db.appointment.findMany({
      where: {
        clinicId: clinic.id,
        type: AppointmentType.BOOKED,
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
        },
        scheduledAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        scheduledAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    for (const appointment of appointments) {
      const claim = await claimReminderEvent(db, {
        clinicId: clinic.id,
        patientId: appointment.patient.id,
        appointmentId: appointment.id,
        templateName: clinic.whatsappReminderTemplate,
        languageCode: clinic.whatsappLanguageCode,
      });

      if (!claim) {
        skipped += 1;
        continue;
      }

      const display = appointmentDisplayParts(
        appointment.scheduledAt,
        clinic.timezone,
      );
      const payload = buildReminderTemplatePayload({
        to: appointment.patient.phone,
        templateName: clinic.whatsappReminderTemplate,
        languageCode: clinic.whatsappLanguageCode,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        clinicName: clinic.name,
        appointmentDate: display.date,
        appointmentTime: display.time,
        appointmentId: appointment.id,
      });

      try {
        const result = await sender({
          phoneNumberId: clinic.whatsappPhoneNumberId,
          payload,
        });

        await db.whatsAppEvent.update({
          where: { id: claim.id },
          data: {
            providerMessageId: result.messageId,
            status: WhatsAppStatus.SENT,
          },
        });
        sent += 1;
      } catch {
        await db.whatsAppEvent.update({
          where: { id: claim.id },
          data: {
            status: WhatsAppStatus.FAILED,
            payload: {
              templateName: clinic.whatsappReminderTemplate,
              languageCode: clinic.whatsappLanguageCode,
              errorCode: "SEND_FAILED",
            },
          },
        });
        failed += 1;
      }
    }
  }

  return { sent, skipped, failed };
}
