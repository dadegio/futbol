import assert from "node:assert/strict";
import test from "node:test";
import { kitColorsLikelyClash, selectMatchKits } from "../src/modules/matches/domain/match-kits.ts";

test("preferisce le divise casa quando i colori sono distinguibili", () => {
  const kits = selectMatchKits(
    { colorHex: "#F97316", kitHomeUrl: "/home-a.png", kitAwayUrl: "/away-a.png" },
    { colorHex: "#2563EB", kitHomeUrl: "/home-b.png", kitAwayUrl: "/away-b.png" }
  );
  assert.equal(kits.home.kind, "home");
  assert.equal(kits.away.kind, "home");
  assert.equal(kits.away.url, "/home-b.png");
});

test("usa la trasferta ospite quando le prime divise sono troppo simili", () => {
  const kits = selectMatchKits(
    { colorHex: "#D92323", kitHomeUrl: "/home-a.png" },
    { colorHex: "#C91F2E", kitHomeUrl: "/home-b.png", kitAwayUrl: "/away-b.png" }
  );
  assert.equal(kitColorsLikelyClash("#D92323", "#C91F2E"), true);
  assert.equal(kits.away.kind, "away");
  assert.equal(kits.away.url, "/away-b.png");
});

test("mantiene la prima divisa ospite se non esiste una seconda", () => {
  const kits = selectMatchKits(
    { colorHex: "#111111", kitHomeUrl: "/home-a.png" },
    { colorHex: "#171717", kitHomeUrl: "/home-b.png" }
  );
  assert.equal(kits.away.kind, "home");
  assert.equal(kits.away.url, "/home-b.png");
});
