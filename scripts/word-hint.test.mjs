import assert from "node:assert/strict";
import { hiddenWord, normalizeGuess, revealMatchingParts } from "../src/shared/word-hint.ts";

assert.equal(normalizeGuess("  KAMP!  "), "kamp");
assert.equal(hiddenWord("kamp çadırı"), "____ ______");

const first = revealMatchingParts("kamp çadırı", [], "Kamp");
assert.equal(first.matched, true);
assert.equal(first.complete, false);
assert.deepEqual(first.revealedParts, [true, false]);
assert.equal(hiddenWord("kamp çadırı", first.revealedParts), "kamp ______");

const duplicate = revealMatchingParts("arı arı", [], "arı");
assert.equal(duplicate.complete, true);
assert.deepEqual(duplicate.revealedParts, [true, true]);

const miss = revealMatchingParts("kamp çadırı", first.revealedParts, "orman");
assert.equal(miss.matched, false);
assert.equal(hiddenWord("kamp çadırı", miss.revealedParts), "kamp ______");

const complete = revealMatchingParts("kamp çadırı", first.revealedParts, "çadırı");
assert.equal(complete.complete, true);
assert.equal(hiddenWord("kamp çadırı", complete.revealedParts), "kamp çadırı");

console.log(JSON.stringify({ ok: true, partialWordHints: true }));
