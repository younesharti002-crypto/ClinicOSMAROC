import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) {
    return false;
  }

  const expectedHex = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const providedHex = signatureHeader.slice("sha256=".length);

  if (!/^[a-f0-9]{64}$/i.test(providedHex)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expectedHex, "hex"),
    Buffer.from(providedHex, "hex"),
  );
}
