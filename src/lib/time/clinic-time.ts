const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

export function clinicDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function zonedDateTimeToUtc(localDateTime: string, timeZone: string): Date {
  const match = LOCAL_DATETIME_PATTERN.exec(localDateTime);
  if (!match) {
    throw new Error("Invalid local datetime");
  }

  const [, year, month, day, hour, minute] = match;
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  );

  let candidate = new Date(naiveUtc);
  let offset = timeZoneOffsetMs(candidate, timeZone);
  candidate = new Date(naiveUtc - offset);

  const correctedOffset = timeZoneOffsetMs(candidate, timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    candidate = new Date(naiveUtc - offset);
  }

  return candidate;
}

export function clinicDayRange(dateKey: string, timeZone: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Invalid date key");
  }

  const start = zonedDateTimeToUtc(`${dateKey}T00:00`, timeZone);
  const endKey = addDaysDateKey(dateKey, 1);
  const end = zonedDateTimeToUtc(`${endKey}T00:00`, timeZone);
  return { start, end };
}

export function addDaysDateKey(dateKey: string, days: number): string {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Invalid date key");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function clinicWeekRange(dateKey: string, timeZone: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Invalid date key");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const startKey = addDaysDateKey(dateKey, -daysSinceMonday);
  const endKey = addDaysDateKey(startKey, 7);

  return {
    startKey,
    endKey,
    start: zonedDateTimeToUtc(`${startKey}T00:00`, timeZone),
    end: zonedDateTimeToUtc(`${endKey}T00:00`, timeZone),
  };
}

export function formatClinicDateTimeInput(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
