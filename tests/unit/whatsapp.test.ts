import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyMetaWebhookSignature } from "@/lib/whatsapp/signature";
import {
  buildReminderTemplatePayload,
  normalizeWhatsAppRecipient,
} from "@/lib/whatsapp/template";
import { parseAppointmentReply } from "@/server/services/whatsapp-webhook";

const appointmentId = "11111111-1111-4111-8111-111111111111";

describe("WhatsApp helpers", () => {
  it("verifies Meta HMAC signatures", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const secret = "test-app-secret";
    const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(
      verifyMetaWebhookSignature(rawBody, `sha256=${digest}`, secret),
    ).toBe(true);
    expect(
      verifyMetaWebhookSignature(`${rawBody}x`, `sha256=${digest}`, secret),
    ).toBe(false);
    expect(verifyMetaWebhookSignature(rawBody, null, secret)).toBe(false);
  });

  it("builds a reminder template without clinical data", () => {
    const payload = buildReminderTemplatePayload({
      to: "+212611111111",
      templateName: "appointment_reminder",
      languageCode: "fr",
      patientName: "Ahmed Test",
      clinicName: "Clinic A",
      appointmentDate: "23 août 2026",
      appointmentTime: "15:00",
      appointmentId,
    });

    expect(payload.to).toBe("212611111111");
    expect(JSON.stringify(payload)).toContain(`CONFIRM:${appointmentId}`);
    expect(JSON.stringify(payload)).toContain(`CANCEL:${appointmentId}`);
    expect(JSON.stringify(payload)).not.toContain("diagnosis");
    expect(JSON.stringify(payload)).not.toContain("clinicalNotes");
    expect(normalizeWhatsAppRecipient("+212600000000")).toBe("212600000000");
  });

  it("parses confirmation and cancellation quick replies", () => {
    expect(
      parseAppointmentReply({
        button: { payload: `CONFIRM:${appointmentId}` },
      }),
    ).toEqual({ action: "CONFIRM", appointmentId });

    expect(
      parseAppointmentReply({
        interactive: {
          button_reply: { id: `CANCEL:${appointmentId}` },
        },
      }),
    ).toEqual({ action: "CANCEL", appointmentId });

    expect(parseAppointmentReply({ text: { body: "hello" } })).toBeNull();
  });
});
