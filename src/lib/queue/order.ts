import { AppointmentStatus, AppointmentType } from "@prisma/client";

export type QueueCandidate = {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const BOOKED_SLOT_PROTECTION_MS = 10 * 60 * 1000;

function priorityTimestamp(candidate: QueueCandidate): number {
  if (candidate.type === AppointmentType.EMERGENCY) {
    return candidate.updatedAt.getTime();
  }

  if (candidate.type === AppointmentType.BOOKED) {
    return candidate.scheduledAt.getTime() - BOOKED_SLOT_PROTECTION_MS;
  }

  return candidate.updatedAt.getTime();
}

export function orderQueue<T extends QueueCandidate>(candidates: readonly T[]) {
  return candidates
    .filter((candidate) => candidate.status === AppointmentStatus.WAITING_ROOM)
    .slice()
    .sort((a, b) => {
      const emergencyDelta =
        Number(b.type === AppointmentType.EMERGENCY) -
        Number(a.type === AppointmentType.EMERGENCY);

      if (emergencyDelta !== 0) {
        return emergencyDelta;
      }

      const priorityDelta = priorityTimestamp(a) - priorityTimestamp(b);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const bookedTieBreak =
        Number(b.type === AppointmentType.BOOKED) -
        Number(a.type === AppointmentType.BOOKED);
      if (bookedTieBreak !== 0) {
        return bookedTieBreak;
      }

      const createdDelta = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDelta !== 0) {
        return createdDelta;
      }

      return a.id.localeCompare(b.id);
    })
    .map((candidate, index) => ({
      ...candidate,
      position: index + 1,
    }));
}
