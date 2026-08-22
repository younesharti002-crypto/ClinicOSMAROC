import { AppointmentStatus, AppointmentType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { orderQueue, type QueueCandidate } from "@/lib/queue/order";

function candidate(
  id: string,
  type: AppointmentType,
  scheduledAt: string,
  updatedAt: string,
  status = AppointmentStatus.WAITING_ROOM,
): QueueCandidate {
  return {
    id,
    type,
    status,
    scheduledAt: new Date(scheduledAt),
    updatedAt: new Date(updatedAt),
    createdAt: new Date(updatedAt),
  };
}

describe("smart queue ordering", () => {
  it("prioritizes emergencies and interleaves booked and walk-in patients deterministically", () => {
    const queue = orderQueue([
      candidate("walk-old", AppointmentType.WALK_IN, "2026-08-22T13:00:00Z", "2026-08-22T13:00:00Z"),
      candidate("booked", AppointmentType.BOOKED, "2026-08-22T14:00:00Z", "2026-08-22T13:40:00Z"),
      candidate("walk-recent", AppointmentType.WALK_IN, "2026-08-22T13:55:00Z", "2026-08-22T13:55:00Z"),
      candidate("emergency", AppointmentType.EMERGENCY, "2026-08-22T14:10:00Z", "2026-08-22T14:10:00Z"),
    ]);

    expect(queue.map((entry) => entry.id)).toEqual([
      "emergency",
      "walk-old",
      "booked",
      "walk-recent",
    ]);
    expect(queue.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
  });

  it("excludes non-waiting appointments from the active queue", () => {
    const queue = orderQueue([
      candidate(
        "cancelled",
        AppointmentType.BOOKED,
        "2026-08-22T14:00:00Z",
        "2026-08-22T13:45:00Z",
        AppointmentStatus.CANCELLED,
      ),
      candidate("waiting", AppointmentType.WALK_IN, "2026-08-22T14:00:00Z", "2026-08-22T13:50:00Z"),
    ]);

    expect(queue.map((entry) => entry.id)).toEqual(["waiting"]);
  });
});
