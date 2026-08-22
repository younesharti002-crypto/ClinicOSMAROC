import { AppointmentStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, ReadonlySet<AppointmentStatus>> = {
  [AppointmentStatus.SCHEDULED]: new Set([
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ]),
  [AppointmentStatus.CONFIRMED]: new Set([
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ]),
  [AppointmentStatus.WAITING_ROOM]: new Set([
    AppointmentStatus.IN_CONSULTATION,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ]),
  [AppointmentStatus.IN_CONSULTATION]: new Set([AppointmentStatus.COMPLETED]),
  [AppointmentStatus.COMPLETED]: new Set(),
  [AppointmentStatus.CANCELLED]: new Set(),
  [AppointmentStatus.NO_SHOW]: new Set(),
};

export class InvalidAppointmentTransitionError extends Error {
  constructor(current: AppointmentStatus, next: AppointmentStatus) {
    super(`Invalid appointment transition: ${current} -> ${next}`);
    this.name = "InvalidAppointmentTransitionError";
  }
}

export function canTransitionAppointment(
  current: AppointmentStatus,
  next: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].has(next);
}

export function assertAppointmentTransition(
  current: AppointmentStatus,
  next: AppointmentStatus,
): void {
  if (!canTransitionAppointment(current, next)) {
    throw new InvalidAppointmentTransitionError(current, next);
  }
}
