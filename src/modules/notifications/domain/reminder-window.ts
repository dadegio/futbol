const ROME_TIME_ZONE = "Europe/Rome";

type RomeDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
};

function romeParts(value: Date): RomeDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(value);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    weekday: pick("weekday"),
  };
}

function calendarKeyFromUtcDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function romeDateKey(value: Date) {
  const { year, month, day } = romeParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isRomeSunday(value: Date) {
  return romeParts(value).weekday === "Sun";
}

export function nextWeekRomeDateKeys(value: Date) {
  const parts = romeParts(value);
  const weekdayIndex = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }[parts.weekday] ?? 0;

  const daysUntilNextMonday =
    weekdayIndex === 0 ? 1 : ((8 - weekdayIndex) % 7 || 7);
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base + (daysUntilNextMonday + index) * 86_400_000);
    return calendarKeyFromUtcDate(date);
  });
}

export function formatRomeMatchDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
