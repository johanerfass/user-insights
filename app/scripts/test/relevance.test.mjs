import test from "node:test";
import assert from "node:assert/strict";
import { mentionsVoi } from "../lib/relevance.mjs";

/*
 * Every "should be dropped" case below is a real post pulled from a live
 * Mastodon hashtag sample on 24 Aug 2026, where a bare /\bvoi\b/ match was
 * wrong half the time.
 */

test("mentionsVoi: keeps posts with an unambiguous Voi marker", () => {
  assert.ok(mentionsVoi("Flight mode has been unlocked! #voi #VoiBikes"));
  assert.ok(mentionsVoi("#VoiBikes seem to have borked iOS app after an update"));
  assert.ok(mentionsVoi("Thieves have been nicking batteries from Voi e-scooters"));
  assert.ok(mentionsVoi("Has anyone tried the voi app in Bristol?"));
  assert.ok(mentionsVoi("cheers @voi for sorting the refund"));
});

test("mentionsVoi: keeps a bare mention when the context is micromobility", () => {
  assert.ok(mentionsVoi("there aren't enough parking areas for #Voi bikes in Edinburgh"));
  assert.ok(
    mentionsVoi("Elsparkcykeljätten Lime får inte fortsätta. Från 1 juli blir det Voi och Bolt")
  );
  assert.ok(mentionsVoi("Voi startet sein Leihradangebot in Berlin, Räder stehen im Gehweg"));
  assert.ok(mentionsVoi("Duisburg: Scooter blockieren Ampel – #Dott #Voi #Lime"));
});

test("mentionsVoi: drops a bare mention with no micromobility context", () => {
  // "voi" = you (plural) in Romanian, in a devotional post.
  assert.equal(mentionsVoi("Nu vă știu pe voi, depărtați-vă de la Mine"), false);
  // "voi" = butter in Finnish.
  assert.equal(mentionsVoi("ensin paistan paahtoleivät voi ja munat"), false);
});

test("mentionsVoi: drops the unrelated voi.id news site", () => {
  assert.equal(mentionsVoi("China tests 6G, the internet of the future - VOI.id"), false);
  assert.equal(
    mentionsVoi("#Technologie #Innovation #VOI voi.id/fr/teknologi/abc scooter bike"),
    false
  );
});

test("mentionsVoi: drops Vietnamese elephants", () => {
  assert.equal(mentionsVoi("bất ngờ gặp một con voi ngà lệch đang đi dạo"), false);
  assert.equal(mentionsVoi("Du khách bị chỉ trích vì cho voi uống bia"), false);
  assert.equal(mentionsVoi("đàn voi rừng giữa rừng xanh Đồng Nai"), false);
});

test("mentionsVoi: a bare #voi needs context in languages where 'voi' is a word", () => {
  // Norwegian: #VOI here really is the company.
  assert.ok(mentionsVoi("Fire kalde Voi ligg nedi vannet. #VOI #Trondheim", { language: "nb" }));
  // Romanian: same bare hashtag, but "voi" is everyday vocabulary.
  assert.equal(
    mentionsVoi("Nu tot cel ce-Mi zice Mie. #voi #ortodox", { language: "ro" }),
    false
  );
  // A specific marker still wins, even in an ambiguous language.
  assert.ok(mentionsVoi("Ho provato #VoiBikes a Milano, voi che ne pensate?", { language: "it" }));
});

test("mentionsVoi: requireContext:false allows a bare mention for topical feeds", () => {
  // A Google News "Voi scooter" search has already constrained the topic, so a
  // headline needs no extra keyword.
  assert.ok(
    mentionsVoi("Voi invests £3m for safety improvements across Northamptonshire", {
      requireContext: false,
    })
  );
  // Exclusions still apply in the looser mode.
  assert.equal(mentionsVoi("con voi in the jungle", { requireContext: false }), false);
});

test("mentionsVoi: does not match voi inside other words, and handles empty input", () => {
  assert.equal(mentionsVoi("avoid the void with your voice"), false);
  assert.equal(mentionsVoi(""), false);
  assert.equal(mentionsVoi(null), false);
  assert.equal(mentionsVoi(undefined), false);
});
