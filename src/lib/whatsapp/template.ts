export type ReminderTemplateInput = {
  to: string;
  templateName: string;
  languageCode: string;
  patientName: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentId: string;
};

export function normalizeWhatsAppRecipient(phone: string): string {
  return phone.replace(/^\+/, "");
}

export function buildReminderTemplatePayload(input: ReminderTemplateInput) {
  return {
    messaging_product: "whatsapp",
    to: normalizeWhatsAppRecipient(input.to),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.patientName },
            { type: "text", text: input.clinicName },
            { type: "text", text: input.appointmentDate },
            { type: "text", text: input.appointmentTime },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [
            { type: "payload", payload: `CONFIRM:${input.appointmentId}` },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [
            { type: "payload", payload: `CANCEL:${input.appointmentId}` },
          ],
        },
      ],
    },
  } as const;
}
