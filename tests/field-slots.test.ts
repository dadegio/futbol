import assert from "node:assert/strict";
import test from "node:test";
import {
  findFieldSlot,
  getFieldSlotOccurrences,
  getRoundSlotWeek,
  getSlotWeekWindow,
  isWithinSlotWeek,
} from "../src/modules/fields/domain/field-slots.ts";

const field = {
  id: "germonio",
  name: "Germonio",
  address: "Via Anastasio Germonio 6",
  slots: [
    { id: "wed-20", weekday: 3, hour: 20, minute: 0, durationMinutes: 60 },
    { id: "invalid", weekday: 9, hour: 20, minute: 0, durationMinutes: 60 },
  ],
};

test("settimana slot usa lunedì 00:00 Europe/Rome come confine", () => {
  const week = getSlotWeekWindow(new Date("2026-09-30T18:00:00.000Z"));
  assert.equal(week.startsAt.toISOString(), "2026-09-27T22:00:00.000Z");
  assert.equal(week.endsAt.toISOString(), "2026-10-04T22:00:00.000Z");
  assert.equal(isWithinSlotWeek(new Date("2026-10-04T21:59:59.999Z"), week.startsAt), true);
  assert.equal(isWithinSlotWeek(new Date("2026-10-04T22:00:00.000Z"), week.startsAt), false);
});

test("genera solo occorrenze valide e riconosce uno slot esatto", () => {
  const occurrences = getFieldSlotOccurrences({
    from: new Date("2026-09-27T22:00:00.000Z"),
    weeks: 1,
    fields: [field],
  });
  const first = occurrences.find((slot) => slot.id === "wed-20");

  assert.ok(first);
  assert.equal(first.startsAt.toISOString(), "2026-09-30T18:00:00.000Z");
  assert.equal(first.endsAt.toISOString(), "2026-09-30T19:00:00.000Z");
  assert.equal(occurrences.some((slot) => slot.id === "invalid"), false);
  assert.equal(findFieldSlot(field, first.startsAt)?.id, "wed-20");
  assert.equal(findFieldSlot(field, new Date("2026-09-30T18:00:01.000Z")), null);
});

test("ogni giornata avanza di una settimana di calendario", () => {
  const first = new Date("2026-09-27T22:00:00.000Z");
  const round2 = getRoundSlotWeek(first, 2);
  assert.equal(round2.startsAt.toISOString(), "2026-10-04T22:00:00.000Z");
  assert.equal(round2.endsAt.toISOString(), "2026-10-11T22:00:00.000Z");
});