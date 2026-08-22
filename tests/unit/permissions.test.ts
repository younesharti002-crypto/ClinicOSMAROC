import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { can } from "@/lib/auth/permissions";

describe("RBAC capabilities", () => {
  it("prevents secretary access to clinical records", () => {
    expect(can(Role.SECRETARY, "patient:clinical:read")).toBe(false);
    expect(can(Role.SECRETARY, "consultation:write")).toBe(false);
    expect(can(Role.SECRETARY, "prescription:write")).toBe(false);
  });

  it("allows secretary reception and cash capabilities", () => {
    expect(can(Role.SECRETARY, "patient:demographics:read")).toBe(true);
    expect(can(Role.SECRETARY, "agenda:write")).toBe(true);
    expect(can(Role.SECRETARY, "queue:manage")).toBe(true);
    expect(can(Role.SECRETARY, "payment:record")).toBe(true);
    expect(can(Role.SECRETARY, "cash:close")).toBe(true);
  });

  it("reserves staff and settings management for doctor admin", () => {
    expect(can(Role.DOCTOR_ADMIN, "staff:manage")).toBe(true);
    expect(can(Role.DOCTOR_ADMIN, "clinic:settings:manage")).toBe(true);
    expect(can(Role.DOCTOR, "staff:manage")).toBe(false);
    expect(can(Role.SECRETARY, "staff:manage")).toBe(false);
  });
});
