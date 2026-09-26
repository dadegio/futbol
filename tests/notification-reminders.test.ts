import test from "node:test";
import assert from "node:assert/strict";
import {
  isRomeSunday,
  nextWeekRomeDateKeys,
  romeDateKey,
} from "../src/modules/notifications/domain/reminder-window.ts";

test("riconosce la domenica in Europe/Rome anche con ora UTC diversa", () => {
  assert.equal(isRomeSunday(new Date("2026-09-27T17:00:00.000Z")), true);
  assert.equal(isRomeSunday(new Date("2026-09-28T17:00:00.000Z")), false);
});

test("la domenica genera la finestra lunedì-domenica successiva", () => {
  assert.deepEqual(
    nextWeekRomeDateKeys(new Date("2026-09-27T17:00:00.000Z")),
    [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]
  );
});

test("romeDateKey usa il giorno locale e non quello UTC", () => {
  assert.equal(
    romeDateKey(new Date("2026-09-27T22:30:00.000Z")),
    "2026-09-28"
  );
});
