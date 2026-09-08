import assert from "node:assert/strict";
import test from "node:test";
import {
  getCaptainBookingWindow,
  getCaptainBookingWindowStatus,
} from "../src/modules/bookings/domain/booking-window.ts";

test("finestra capitani: mercoledì precedente fino a domenica esclusa in Europe/Rome", () => {
  const anchor = new Date("2026-09-30T18:00:00.000Z"); // mer 20:00 CEST
  const window = getCaptainBookingWindow(anchor);

  assert.equal(window.opensAt.toISOString(), "2026-09-22T22:00:00.000Z");
  assert.equal(window.closesAt.toISOString(), "2026-09-26T22:00:00.000Z");

  assert.equal(
    getCaptainBookingWindowStatus(anchor, new Date("2026-09-22T21:59:59.999Z")).isOpen,
    false
  );
  assert.equal(
    getCaptainBookingWindowStatus(anchor, new Date("2026-09-22T22:00:00.000Z")).isOpen,
    true
  );
  assert.equal(
    getCaptainBookingWindowStatus(anchor, new Date("2026-09-26T22:00:00.000Z")).isOpen,
    false
  );
});

test("la finestra resta corretta dopo il passaggio all'ora solare", () => {
  const anchor = new Date("2026-11-04T19:00:00.000Z"); // mer 20:00 CET
  const window = getCaptainBookingWindow(anchor);
  assert.equal(window.opensAt.toISOString(), "2026-10-27T23:00:00.000Z");
  assert.equal(window.closesAt.toISOString(), "2026-10-31T23:00:00.000Z");
});