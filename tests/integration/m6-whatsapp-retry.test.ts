import {
  AppointmentStatus,
  AppointmentType,
  PrismaClient,
  Role,
  WhatsAppEventType,
  WhatsAppStatus,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sendDueAppointmentReminders } from "@/server/services/whatsapp-reminders";

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

describe("M6 WhatsApp reminder retry gate", () => {
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

  it("retries a failed reminder exactly once on the next run without duplicating the event", async () => {
    const clinic = await db.clinic.create({
      data: {
        name: "Retry Clinic",
        slug: "m6-retry-clinic",
        phone: "+212600000041",
        address: "Casablanca",
        timezone: "Africa/Casablanca",
        whatsappEnabled: true,
        whatsappPhoneNumberId: "phone-retry",
        whatsappReminderTemplate: "appointment_reminder",
        whatsappLanguageCode: "fr",
      },
    });
    const doctor = await db.user.create({
      data: {
        clinicId: clinic.id,
        email: "doctor-retry@m6.test",
        passwordHash: "test",
        fullName: "Doctor Retry",
        role: Role.DOCTOR,
      },
    });
    const patient = await db.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Amine",
        lastName: "Retry",
        phone: "+212611111151",
      },
    });
    const now = new Date("2026-08-24T10:00:00Z");
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt: new Date("2026-08-25T10:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    let attempts = 0;
    const payloads: unknown[] = [];
    const sender = async (args: { phoneNumberId: string; payload: unknown }) => {
      attempts += 1;
      payloads.push(args.payload);
      if (attempts === 1) {
        throw new Error("temporary provider failure");
      }
      return { messageId: "wamid.retry-success" };
    };

    const first = await sendDueAppointmentReminders(db, now, sender);
    expect(first).toEqual({ sent: 0, skipped: 0, failed: 1 });

    const failedEvent = await db.whatsAppEvent.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        appointmentId: appointment.id,
        eventType: WhatsAppEventType.REMINDER_SENT,
      },
    });
    expect(failedEvent.status).toBe(WhatsAppStatus.FAILED);
    expect(failedEvent.providerMessageId).toBeNull();
    expect(failedEvent.payload).toMatchObject({
      attemptCount: 1,
      errorCode: "SEND_FAILED",
    });

    const second = await sendDueAppointmentReminders(db, now, sender);
    expect(second).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(attempts).toBe(2);

    const events = await db.whatsAppEvent.findMany({
      where: {
        clinicId: clinic.id,
        appointmentId: appointment.id,
        eventType: WhatsAppEventType.REMINDER_SENT,
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe(WhatsAppStatus.SENT);
    expect(events[0]?.providerMessageId).toBe("wamid.retry-success");
    expect(events[0]?.payload).toMatchObject({ attemptCount: 2 });

    const third = await sendDueAppointmentReminders(db, now, sender);
    expect(third).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(attempts).toBe(2);

    const serializedPayloads = JSON.stringify(payloads);
    expect(serializedPayloads).not.toContain("diagnosis");
    expect(serializedPayloads).not.toContain("clinicalNotes");
    expect(serializedPayloads).not.toContain("allergies");
  });
});
