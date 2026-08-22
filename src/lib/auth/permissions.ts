import { Role } from "@prisma/client";

export type Capability =
  | "patient:demographics:read"
  | "patient:demographics:write"
  | "patient:clinical:read"
  | "consultation:write"
  | "prescription:write"
  | "agenda:read"
  | "agenda:write"
  | "queue:manage"
  | "invoice:read"
  | "invoice:write"
  | "payment:record"
  | "cash:close"
  | "analytics:business"
  | "staff:manage"
  | "clinic:settings:manage";

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  [Role.DOCTOR_ADMIN]: new Set<Capability>([
    "patient:demographics:read",
    "patient:demographics:write",
    "patient:clinical:read",
    "consultation:write",
    "prescription:write",
    "agenda:read",
    "agenda:write",
    "queue:manage",
    "invoice:read",
    "invoice:write",
    "payment:record",
    "cash:close",
    "analytics:business",
    "staff:manage",
    "clinic:settings:manage",
  ]),
  [Role.DOCTOR]: new Set<Capability>([
    "patient:demographics:read",
    "patient:clinical:read",
    "consultation:write",
    "prescription:write",
    "agenda:read",
    "queue:manage",
    "invoice:read",
  ]),
  [Role.SECRETARY]: new Set<Capability>([
    "patient:demographics:read",
    "patient:demographics:write",
    "agenda:read",
    "agenda:write",
    "queue:manage",
    "invoice:read",
    "invoice:write",
    "payment:record",
    "cash:close",
  ]),
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) {
    throw new ForbiddenError(`Role ${role} cannot perform ${capability}`);
  }
}
