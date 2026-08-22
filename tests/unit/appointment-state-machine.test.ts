import { AppointmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  InvalidAppointmentTransitionError,
  assertAppointmentTransition,
  canTransitionAppointment,
} from "@/lib/appointments/state-machine";

describe("appointment state machine", () => {
  it("allows the normal booked appointment path", () => {
    expect(canTransitionAppointment(AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED)).toBe(true);
    expect(canTransitionAppointment(AppointmentStatus.CONFIRMED, AppointmentStatus.WAITING_ROOM)).toBe(true);
    expect(canTransitionAppointment(AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_CONSULTATION)).toBe(true);
    expect(canTransitionAppointment(AppointmentStatus.IN_CONSULTATION, AppointmentStatus.COMPLETED)).toBe(true);
  });

  it("allows arrival directly from scheduled", () => {
    expect(canTransitionAppointment(AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING_ROOM)).toBe(true);
  });

  it("rejects reopening terminal states", () => {
    expect(() =>
      assertAppointmentTransition(AppointmentStatus.COMPLETED, AppointmentStatus.WAITING_ROOM),
    ).toThrow(InvalidAppointmentTransitionError);
    expect(() =>
      assertAppointmentTransition(AppointmentStatus.CANCELLED, AppointmentStatus.SCHEDULED),
    ).toThrow(InvalidAppointmentTransitionError);
  });
});
