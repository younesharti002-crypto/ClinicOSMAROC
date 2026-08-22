import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "@/lib/security/headers";

describe("M8 security headers", () => {
  it("blocks framing, MIME sniffing and dangerous browser capabilities", () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders(false).map(({ key, value }) => [key, value]),
    );

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
  });

  it("adds HSTS only for production responses", () => {
    const development = buildSecurityHeaders(false);
    const production = buildSecurityHeaders(true);

    expect(development.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
    expect(production.some((header) => header.key === "Strict-Transport-Security")).toBe(true);
  });
});
