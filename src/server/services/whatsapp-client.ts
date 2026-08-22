type SendTemplateArgs = {
  phoneNumberId: string;
  payload: unknown;
};

export type WhatsAppSendResult = {
  messageId: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for live WhatsApp delivery`);
  }
  return value;
}

export async function sendWhatsAppTemplate(
  args: SendTemplateArgs,
): Promise<WhatsAppSendResult> {
  const accessToken = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const graphVersion = requiredEnv("WHATSAPP_GRAPH_VERSION");

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${args.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`WhatsApp send failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    messages?: Array<{ id?: string }>;
  };
  const messageId = data.messages?.[0]?.id;

  if (!messageId) {
    throw new Error("WhatsApp send response did not include a message id");
  }

  return { messageId };
}
