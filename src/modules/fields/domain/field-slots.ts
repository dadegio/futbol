const ROME_TIME_ZONE = "Europe/Rome";

export type FieldSlotDefinition = {
  id?: string;
  weekday: number;
  hour: number;
  minute: number;
  durationMinutes: number;
};

export type FieldDefinition = {
  id: string;
  name: string;
  address: string;
  slots: FieldSlotDefinition[];
};

export type FieldSlotOccurrence = FieldSlotDefinition & {
  key: string;
  venueKey: string;
  venueName: string;
  address: string;
  startsAt: Date;
  endsAt: Date;
};

export type SlotWeekWindow = {
  startsAt: Date;
  endsAt: Date;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getRomeParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
    weekday: WEEKDAY_INDEX[value("weekday")] ?? 0,
  };
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = wantedAsUtc;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = getRomeParts(new Date(candidate));
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    candidate -= representedAsUtc - wantedAsUtc;
  }

  return new Date(candidate);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

function isValidSlotDefinition(slot: FieldSlotDefinition) {
  return (
    Number.isInteger(slot.weekday) &&
    slot.weekday >= 0 &&
    slot.weekday <= 6 &&
    Number.isInteger(slot.hour) &&
    slot.hour >= 0 &&
    slot.hour <= 23 &&
    Number.isInteger(slot.minute) &&
    slot.minute >= 0 &&
    slot.minute <= 59 &&
    Number.isInteger(slot.durationMinutes) &&
    slot.durationMinutes > 0 &&
    slot.durationMinutes <= 24 * 60
  );
}

export function getSlotWeekWindow(anchor: Date): SlotWeekWindow {
  if (Number.isNaN(anchor.getTime())) {
    throw new Error("Data settimana non valida");
  }

  const parts = getRomeParts(anchor);
  const daysSinceMonday = (parts.weekday + 6) % 7;
  const monday = addCalendarDays(
    parts.year,
    parts.month,
    parts.day,
    -daysSinceMonday
  );
  const nextMonday = addCalendarDays(
    monday.year,
    monday.month,
    monday.day,
    7
  );

  return {
    startsAt: zonedDateTimeToUtc(monday.year, monday.month, monday.day, 0, 0),
    endsAt: zonedDateTimeToUtc(
      nextMonday.year,
      nextMonday.month,
      nextMonday.day,
      0,
      0
    ),
  };
}

/**
 * La data scelta dall'admin identifica la prima settimana del calendario.
 * Gli slot dei campi possono essere configurati anche in un secondo momento.
 */
export function getFirstFullSlotWeek(from: Date): SlotWeekWindow {
  return getSlotWeekWindow(from);
}

export function getRoundSlotWeek(
  firstWeekStart: Date,
  round: number
): SlotWeekWindow {
  const first = getSlotWeekWindow(firstWeekStart);
  const firstParts = getRomeParts(first.startsAt);
  const roundMonday = addCalendarDays(
    firstParts.year,
    firstParts.month,
    firstParts.day,
    Math.max(0, Math.trunc(round) - 1) * 7
  );

  return getSlotWeekWindow(
    zonedDateTimeToUtc(
      roundMonday.year,
      roundMonday.month,
      roundMonday.day,
      0,
      0
    )
  );
}

export function getSlotWeekDistance(from: Date, to: Date) {
  const fromWeek = getSlotWeekWindow(from);
  const toWeek = getSlotWeekWindow(to);
  const fromParts = getRomeParts(fromWeek.startsAt);
  const toParts = getRomeParts(toWeek.startsAt);
  const fromDay = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toDay = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  const days = Math.round((toDay - fromDay) / 86_400_000);

  return Math.trunc(days / 7);
}

export function shiftSlotWeek(anchor: Date, weeks: number): SlotWeekWindow {
  if (!Number.isInteger(weeks)) {
    throw new Error("Spostamento settimane non valido");
  }

  const week = getSlotWeekWindow(anchor);
  const parts = getRomeParts(week.startsAt);
  const shiftedMonday = addCalendarDays(
    parts.year,
    parts.month,
    parts.day,
    weeks * 7
  );

  return getSlotWeekWindow(
    zonedDateTimeToUtc(
      shiftedMonday.year,
      shiftedMonday.month,
      shiftedMonday.day,
      0,
      0
    )
  );
}

export function isWithinSlotWeek(date: Date, weekStart: Date) {
  const week = getSlotWeekWindow(weekStart);
  const timestamp = date.getTime();
  return timestamp >= week.startsAt.getTime() && timestamp < week.endsAt.getTime();
}

export function getFieldSlotOccurrences({
  from,
  weeks,
  fields,
}: {
  from: Date;
  weeks: number;
  fields: FieldDefinition[];
}): FieldSlotOccurrence[] {
  const safeWeeks = Math.min(Math.max(Math.trunc(weeks), 1), 60);
  const firstDay = getRomeParts(from);
  const occurrences: FieldSlotOccurrence[] = [];

  for (let offset = 0; offset <= safeWeeks * 7; offset += 1) {
    const date = addCalendarDays(firstDay.year, firstDay.month, firstDay.day, offset);

    for (const field of fields) {
      for (const slot of field.slots) {
        if (!isValidSlotDefinition(slot) || slot.weekday !== date.weekday) continue;

        const startsAt = zonedDateTimeToUtc(
          date.year,
          date.month,
          date.day,
          slot.hour,
          slot.minute
        );

        if (startsAt.getTime() < from.getTime()) continue;

        occurrences.push({
          ...slot,
          key: slot.id ?? `${field.id}:${slot.weekday}-${slot.hour}-${slot.minute}`,
          venueKey: field.id,
          venueName: field.name,
          address: field.address,
          startsAt,
          endsAt: new Date(startsAt.getTime() + slot.durationMinutes * 60_000),
        });
      }
    }
  }

  return occurrences.sort((left, right) => {
    const byDate = left.startsAt.getTime() - right.startsAt.getTime();
    return byDate || left.venueName.localeCompare(right.venueName);
  });
}

export function findFieldSlot(
  field: FieldDefinition,
  startsAt: Date
): FieldSlotOccurrence | null {
  if (Number.isNaN(startsAt.getTime())) return null;

  const parts = getRomeParts(startsAt);
  const definition = field.slots.find(
    (slot) =>
      isValidSlotDefinition(slot) &&
      slot.weekday === parts.weekday &&
      slot.hour === parts.hour &&
      slot.minute === parts.minute
  );

  if (
    !definition ||
    parts.second !== 0 ||
    startsAt.getUTCMilliseconds() !== 0
  ) {
    return null;
  }

  return {
    ...definition,
    key:
      definition.id ??
      `${field.id}:${definition.weekday}-${definition.hour}-${definition.minute}`,
    venueKey: field.id,
    venueName: field.name,
    address: field.address,
    startsAt,
    endsAt: new Date(
      startsAt.getTime() + definition.durationMinutes * 60_000
    ),
  };
}
