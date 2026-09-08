import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeInstagram,
  normalizeUrl,
  parseSponsorCreateInput,
  parseSponsorPatchInput,
} from "../src/modules/sponsors/domain/sponsor-input.ts";
import {
  parseMediaCreateInput,
  parseMediaPatchInput,
} from "../src/modules/media/domain/media-input.ts";

test("sponsor normalizza URL e handle Instagram", () => {
  assert.equal(normalizeUrl("example.com/promo"), "https://example.com/promo");
  assert.equal(normalizeInstagram("@cammino.imperiale"), "https://instagram.com/cammino.imperiale");
  assert.equal(normalizeUrl("non è un url"), undefined);
});

test("creazione sponsor valida email e limita sortOrder", () => {
  const parsed = parseSponsorCreateInput({
    name: " Sponsor Test ",
    websiteUrl: "sponsor.test",
    email: "info@sponsor.test",
    sortOrder: 5000,
  });
  assert.ok("data" in parsed);
  if ("data" in parsed) {
    assert.equal(parsed.data.name, "Sponsor Test");
    assert.equal(parsed.data.websiteUrl, "https://sponsor.test");
    assert.equal(parsed.data.sortOrder, 999);
    assert.equal(parsed.data.active, true);
  }

  assert.deepEqual(
    parseSponsorCreateInput({ name: "Sponsor", email: "email-non-valida" }),
    { error: "Email non valida" }
  );
});

test("patch sponsor applica gli stessi limiti della creazione", () => {
  const parsed = parseSponsorPatchInput({
    category: "x".repeat(120),
    phone: "1".repeat(100),
    contactName: "n".repeat(150),
  });
  assert.ok("data" in parsed);
  if ("data" in parsed) {
    assert.equal(parsed.data.category?.length, 80);
    assert.equal(parsed.data.phone?.length, 80);
    assert.equal(parsed.data.contactName?.length, 120);
  }
});

test("creator non può auto-approvare o mettere in evidenza un media", () => {
  const parsed = parseMediaCreateInput(
    {
      fileUrl: "cdn.example.com/video.mp4",
      status: "APPROVED",
      featured: true,
      type: "VIDEO",
    },
    false
  );
  assert.ok("data" in parsed);
  if ("data" in parsed) {
    assert.equal(parsed.data.fileUrl, "https://cdn.example.com/video.mp4");
    assert.equal(parsed.data.status, "PENDING_REVIEW");
    assert.equal(parsed.data.featured, false);
  }
});

test("media distingue link file non valido da file mancante", () => {
  assert.deepEqual(parseMediaCreateInput({ fileUrl: "url non valida" }, false), {
    error: "Link file non valido",
  });
  assert.deepEqual(parseMediaCreateInput({}, false), {
    error: "Carica un file o inserisci un link valido",
  });
});

test("modifica creator di contenuto approvato lo rimette in revisione", () => {
  const parsed = parseMediaPatchInput({ title: "Titolo aggiornato" }, false, "APPROVED");
  assert.ok("data" in parsed);
  if ("data" in parsed) {
    assert.equal(parsed.data.title, "Titolo aggiornato");
    assert.equal(parsed.data.status, "PENDING_REVIEW");
    assert.equal(parsed.data.featured, false);
  }
});

test("Instagram credito viene normalizzato e validato anche in modifica", () => {
  const valid = parseMediaPatchInput({ creditInstagram: "@creator.test" }, false, "DRAFT");
  assert.ok("data" in valid);
  if ("data" in valid) {
    assert.equal(valid.data.creditInstagram, "https://instagram.com/creator.test");
  }

  assert.deepEqual(
    parseMediaPatchInput({ creditInstagram: "handle non valido !" }, false, "DRAFT"),
    { error: "Instagram credito non valido" }
  );
});