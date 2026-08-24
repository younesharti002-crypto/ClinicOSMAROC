import {
  AppointmentStatus,
  AppointmentType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  type PrismaClient,
} from "@prisma/client";

import type { AuthContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/permissions";
import {
  addDaysDateKey,
  clinicDateKey,
  clinicDayRange,
  zonedDateTimeToUtc,
} from "@/lib/time/clinic-time";

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

export type AnalyticsPaymentTotals = {
  cash: Prisma.Decimal;
  card: Prisma.Decimal;
  cheque: Prisma.Decimal;
  transfer: Prisma.Decimal;
  total: Prisma.Decimal;
};

export type AnalyticsDailyPoint = {
  dateKey: string;
  appointments: number;
  completed: number;
  noShow: number;
  revenue: Prisma.Decimal;
};

export type DoctorPerformance = {
  doctorId: string;
  doctorName: string;
  appointments: number;
  completed: number;
  noShow: number;
  completionRate: number;
};

function emptyPaymentTotals(): AnalyticsPaymentTotals {
  const zero = new Prisma.Decimal(0);
  return {
    cash: zero,
    card: zero,
    cheque: zero,
    transfer: zero,
    total: zero,
  };
}

function addPayment(
  totals: AnalyticsPaymentTotals,
  amount: Prisma.Decimal,
  method: PaymentMethod,
) {
  if (method === PaymentMethod.CASH) totals.cash = totals.cash.add(amount);
  if (method === PaymentMethod.CARD) totals.card = totals.card.add(amount);
  if (method === PaymentMethod.CHEQUE) totals.cheque = totals.cheque.add(amount);
  if (method === PaymentMethod.VIREMENT) totals.transfer = totals.transfer.add(amount);
  totals.total = totals.total.add(amount);
}

function monthRange(monthKey: string, timeZone: string) {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) throw new Error("Invalid analytics month");

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Invalid analytics month");

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const startKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const endKey = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    startKey,
    endKey,
    start: zonedDateTimeToUtc(`${startKey}T00:00`, timeZone),
    end: zonedDateTimeToUtc(`${endKey}T00:00`, timeZone),
  };
}

function statusCount(
  rows: Array<{ status: AppointmentStatus; _count: { _all: number } }>,
  status: AppointmentStatus,
) {
  return rows.find((row) => row.status === status)?._count._all ?? 0;
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildDateKeys(startKey: string, endKey: string) {
  const keys: string[] = [];
  let cursor = startKey;
  while (cursor < endKey) {
    keys.push(cursor);
    cursor = addDaysDateKey(cursor, 1);
  }
  return keys;
}

function typeCount(
  rows: Array<{ type: AppointmentType }>,
  type: AppointmentType,
) {
  return rows.filter((row) => row.type === type).length;
}

export async function getBusinessAnalytics(
  db: PrismaClient,
  ctx: AuthContext,
  monthKey: string,
  now = new Date(),
) {
  assertCan(ctx.role, "analytics:business");

  const clinic = await db.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { id: true, name: true, timezone: true },
  });
  if (!clinic) throw new Error("Clinic not found");

  const period = monthRange(monthKey, clinic.timezone);
  const todayKey = clinicDateKey(now, clinic.timezone);
  const todayRange = clinicDayRange(todayKey, clinic.timezone);

  const [
    todayStatuses,
    todayAppointments,
    todayPayments,
    todayConsultations,
    monthStatuses,
    monthPayments,
    monthAppointments,
    monthConsultations,
    activePatients,
    doctors,
  ] = await Promise.all([
    db.appointment.groupBy({
      by: ["status"],
      where: {
        clinicId: ctx.clinicId,
        scheduledAt: { gte: todayRange.start, lt: todayRange.end },
      },
      _count: { _all: true },
    }),
    db.appointment.findMany({
      where: {
        clinicId: ctx.clinicId,
        scheduledAt: { gte: todayRange.start, lt: todayRange.end },
      },
      select: { patientId: true, type: true },
    }),
    db.payment.findMany({
      where: {
        clinicId: ctx.clinicId,
        paidAt: { gte: todayRange.start, lt: todayRange.end },
        status: { in: [PaymentStatus.FINALIZED, PaymentStatus.ADJUSTMENT] },
      },
      select: { amount: true, method: true },
    }),
    db.consultation.count({
      where: {
        clinicId: ctx.clinicId,
        createdAt: { gte: todayRange.start, lt: todayRange.end },
      },
    }),
    db.appointment.groupBy({
      by: ["status"],
      where: {
        clinicId: ctx.clinicId,
        scheduledAt: { gte: period.start, lt: period.end },
      },
      _count: { _all: true },
    }),
    db.payment.findMany({
      where: {
        clinicId: ctx.clinicId,
        paidAt: { gte: period.start, lt: period.end },
        status: { in: [PaymentStatus.FINALIZED, PaymentStatus.ADJUSTMENT] },
      },
      select: { amount: true, method: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    }),
    db.appointment.findMany({
      where: {
        clinicId: ctx.clinicId,
        scheduledAt: { gte: period.start, lt: period.end },
      },
      select: {
        patientId: true,
        doctorId: true,
        scheduledAt: true,
        status: true,
        type: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.consultation.count({
      where: {
        clinicId: ctx.clinicId,
        createdAt: { gte: period.start, lt: period.end },
      },
    }),
    db.patient.findMany({
      where: {
        clinicId: ctx.clinicId,
        appointments: {
          some: {
            scheduledAt: { gte: period.start, lt: period.end },
          },
        },
      },
      select: { id: true, createdAt: true },
    }),
    db.user.findMany({
      where: {
        clinicId: ctx.clinicId,
        isActive: true,
        role: { in: [Role.DOCTOR_ADMIN, Role.DOCTOR] },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const todayRevenue = emptyPaymentTotals();
  for (const payment of todayPayments) {
    addPayment(todayRevenue, payment.amount, payment.method);
  }

  const revenue = emptyPaymentTotals();
  for (const payment of monthPayments) {
    addPayment(revenue, payment.amount, payment.method);
  }

  const completed = statusCount(monthStatuses, AppointmentStatus.COMPLETED);
  const noShow = statusCount(monthStatuses, AppointmentStatus.NO_SHOW);
  const cancelled = statusCount(monthStatuses, AppointmentStatus.CANCELLED);
  const totalAppointments = monthStatuses.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  const dailyMap = new Map<string, AnalyticsDailyPoint>();
  for (const dateKey of buildDateKeys(period.startKey, period.endKey)) {
    dailyMap.set(dateKey, {
      dateKey,
      appointments: 0,
      completed: 0,
      noShow: 0,
      revenue: new Prisma.Decimal(0),
    });
  }

  for (const appointment of monthAppointments) {
    const dateKey = clinicDateKey(appointment.scheduledAt, clinic.timezone);
    const point = dailyMap.get(dateKey);
    if (!point) continue;
    point.appointments += 1;
    if (appointment.status === AppointmentStatus.COMPLETED) point.completed += 1;
    if (appointment.status === AppointmentStatus.NO_SHOW) point.noShow += 1;
  }

  for (const payment of monthPayments) {
    const dateKey = clinicDateKey(payment.paidAt, clinic.timezone);
    const point = dailyMap.get(dateKey);
    if (!point) continue;
    point.revenue = point.revenue.add(payment.amount);
  }

  const doctorRows: DoctorPerformance[] = doctors.map((doctor) => {
    const appointments = monthAppointments.filter(
      (appointment) => appointment.doctorId === doctor.id,
    );
    const doctorCompleted = appointments.filter(
      (appointment) => appointment.status === AppointmentStatus.COMPLETED,
    ).length;
    const doctorNoShow = appointments.filter(
      (appointment) => appointment.status === AppointmentStatus.NO_SHOW,
    ).length;
    const attendedDenominator = doctorCompleted + doctorNoShow;

    return {
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      appointments: appointments.length,
      completed: doctorCompleted,
      noShow: doctorNoShow,
      completionRate: rate(doctorCompleted, attendedDenominator),
    };
  });

  const newPatients = activePatients.filter(
    (patient) => patient.createdAt >= period.start && patient.createdAt < period.end,
  ).length;
  const repeatPatients = activePatients.length - newPatients;

  return {
    clinic: {
      id: clinic.id,
      name: clinic.name,
      timezone: clinic.timezone,
    },
    period: {
      monthKey,
      startKey: period.startKey,
      endKey: period.endKey,
    },
    today: {
      dateKey: todayKey,
      total: todayStatuses.reduce((sum, row) => sum + row._count._all, 0),
      patients: new Set(todayAppointments.map((appointment) => appointment.patientId)).size,
      booked: typeCount(todayAppointments, AppointmentType.BOOKED),
      walkIns: typeCount(todayAppointments, AppointmentType.WALK_IN),
      emergencies: typeCount(todayAppointments, AppointmentType.EMERGENCY),
      scheduled: statusCount(todayStatuses, AppointmentStatus.SCHEDULED),
      confirmed: statusCount(todayStatuses, AppointmentStatus.CONFIRMED),
      waiting: statusCount(todayStatuses, AppointmentStatus.WAITING_ROOM),
      inConsultation: statusCount(todayStatuses, AppointmentStatus.IN_CONSULTATION),
      completed: statusCount(todayStatuses, AppointmentStatus.COMPLETED),
      noShow: statusCount(todayStatuses, AppointmentStatus.NO_SHOW),
      cancelled: statusCount(todayStatuses, AppointmentStatus.CANCELLED),
      consultations: todayConsultations,
      revenue: todayRevenue,
    },
    month: {
      totalAppointments,
      booked: typeCount(monthAppointments, AppointmentType.BOOKED),
      walkIns: typeCount(monthAppointments, AppointmentType.WALK_IN),
      emergencies: typeCount(monthAppointments, AppointmentType.EMERGENCY),
      completed,
      noShow,
      cancelled,
      activeAppointments: totalAppointments - cancelled,
      noShowRate: rate(noShow, completed + noShow),
      completionRate: rate(completed, completed + noShow),
      consultations: monthConsultations,
      uniquePatients: activePatients.length,
      newPatients,
      repeatPatients,
      revenue,
    },
    daily: Array.from(dailyMap.values()),
    doctors: doctorRows,
  };
}
