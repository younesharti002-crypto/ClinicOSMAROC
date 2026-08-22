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
import { processWhatsAppWebhook } from "@/server/services/whatsapp-webhook";

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
      name: "Clinic A",
      slug: "m6-clinic-a",
      phone: "+212600000001",
      address: "Casablanca",
      whatsappEnabled: true,
      whatsappPhoneNumberId: "phone-a",
      whatsappReminderTemplate: "appointment_reminder",
      whatsappLanguageCode: "fr",
    },
  });
  const clinicB = await db.clinic.create({
    data: {
      name: "Clinic B",
      slug: "m6-clinic-b",
      phone: "+212600000002",
      address: "Rabat",
      whatsappEnabled: true,
      whatsappPhoneNumberId: "phone-b",
      whatsappReminderTemplate: "appointment_reminder",
      whatsappLanguageCode: "ar",
    },
  });

  const doctorA = await db.user.create({
    data: {
      clinicId: clinicA.id,
      email: "doctor-a@m6.test",
      passwordHash: "test",
      fullName: "Doctor A",
      role: Role.DOCTOR,
    },
  });
  const doctorB = await db.user.create({
    data: {
      clinicId: clinicB.id,
      email: "doctor-b@m6.test",
      passwordHash: "test",
      fullName: "Doctor B",
      role: Role.DOCTOR,
    },
  });

  const patientA = await db.patient.create({
    data: {
      clinicId: clinicA.id,
      firstName: "Ahmed",
      lastName: "A",
      phone: "+212611111111",
    },
  });
  const patientB = await db.patient.create({
    data: {
      clinicId: clinicB.id,
      firstName: "Sara",
      lastName: "B",
      phone: "+212622222222",
    },
  });

  return { clinicA, clinicB, doctorA, doctorB, patientA, patientB };
}

function webhookPayload(input: {
  phoneNumberId: string;
  messageId: string;
  from: string;
  payload: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: input.phoneNumberId },
              messages: [
                {
                  id: input.messageId,
                  from: input.from,
                  type: "button",
                  button: { payload: input.payload },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("M6 WhatsApp", () => {
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

  it("sends one 24h reminder per appointment and persists the provider id", async () => {
    const { clinicA, doctorA, patientA } = await fixture();
    const now = new Date("2026-08-22T12:00:00Z");
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-23T12:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    const calls: Array<{ phoneNumberId: string; payload: unknown }> = [];
    const sender = async (args: { phoneNumberId: string; payload: unknown }) => {
      calls.push(args);
      return { messageId: "wamid.reminder-1" };
    };

    const first = await sendDueAppointmentReminders(db, now, sender);
    const second = await sendDueAppointmentReminders(db, now, sender);

    expect(first.sent).toBe(1);
    expect(second.skipped).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.phoneNumberId).toBe("phone-a");

    const event = await db.whatsAppEvent.findFirstOrThrow({
      where: {
        clinicId: clinicA.id,
        appointmentId: appointment.id,
        eventType: WhatsAppEventType.REMINDER_SENT,
      },
    });
    expect(event.providerMessageId).toBe("wamid.reminder-1");
    expect(event.status).toBe(WhatsAppStatus.SENT);
  });

  it("routes confirmation by clinic phone-number-id and is idempotent", async () => {
    const { clinicA, clinicB, doctorA, patientA } = await fixture();
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-23T12:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    const payload = webhookPayload({
      phoneNumberId: "phone-a",
      messageId: "wamid.inbound-confirm",
      from: "212611111111",
      payload: `CONFIRM:${appointment.id}`,
    });

    const first = await processWhatsAppWebhook(db, payload);
    const second = await processWhatsAppWebhook(db, payload);

    expect(first.processed).toBe(1);
    expect(second.ignored).toBe(1);

    const updated = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.status).toBe(AppointmentStatus.CONFIRMED);

    const events = await db.whatsAppEvent.findMany({
      where: {
        clinicId: clinicA.id,
        appointmentId: appointment.id,
        eventType: WhatsAppEventType.CONFIRMATION_RECEIVED,
      },
    });
    expect(events).toHaveLength(1);
    expect(
      await db.whatsAppEvent.count({ where: { clinicId: clinicB.id } }),
    ).toBe(0);
  });

  it("allows cancellation after WhatsApp confirmation", async () => {
    const { clinicA, doctorA, patientA } = await fixture();
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-23T12:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    await processWhatsAppWebhook(
      db,
      webhookPayload({
        phoneNumberId: "phone-a",
        messageId: "wamid.confirm-2",
        from: "212611111111",
        payload: `CONFIRM:${appointment.id}`,
      }),
    );
    await processWhatsAppWebhook(
      db,
      webhookPayload({
        phoneNumberId: "phone-a",
        messageId: "wamid.cancel-2",
        from: "212611111111",
        payload: `CANCEL:${appointment.id}`,
      }),
    );

    const updated = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.status).toBe(AppointmentStatus.CANCELLED);
  });

  it("rejects an appointment reply from a different patient phone", async () => {
    const { clinicA, doctorA, patientA } = await fixture();
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-23T12:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    const result = await processWhatsAppWebhook(
      db,
      webhookPayload({
        phoneNumberId: "phone-a",
        messageId: "wamid.wrong-phone",
        from: "212633333333",
        payload: `CONFIRM:${appointment.id}`,
      }),
    );

    expect(result.ignored).toBe(1);
    const unchanged = await db.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(unchanged.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it("updates persisted reminder delivery status without creating clinical payload", async () => {
    const { clinicA, doctorA, patientA } = await fixture();
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        scheduledAt: new Date("2026-08-23T12:00:00Z"),
        type: AppointmentType.BOOKED,
        status: AppointmentStatus.SCHEDULED,
      },
    });
    await db.whatsAppEvent.create({
      data: {
        clinicId: clinicA.id,
        patientId: patientA.id,
        appointmentId: appointment.id,
        providerMessageId: "wamid.delivery-1",
        eventType: WhatsAppEventType.REMINDER_SENT,
        status: WhatsAppStatus.SENT,
        payload: { templateName: "appointment_reminder" },
      },
    });

    await processWhatsAppWebhook(db, {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-a" },
                statuses: [
                  { id: "wamid.delivery-1", status: "delivered" },
                ],
              },
            },
          ],
        },
      ],
    });

    const event = await db.whatsAppEvent.findFirstOrThrow({
      where: {
        clinicId: clinicA.id,
        providerMessageId: "wamid.delivery-1",
      },
    });
    expect(event.status).toBe(WhatsAppStatus.DELIVERED);
    expect(JSON.stringify(event.payload)).not.toContain("diagnosis");
    expect(JSON.stringify(event.payload)).not.toContain("clinicalNotes");
  });
});
