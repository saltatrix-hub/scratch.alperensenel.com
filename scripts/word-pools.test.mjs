import assert from "node:assert/strict";
import { wordAt, wordPoolSize } from "../src/worker/wordPools.ts";

const difficulties = ["easy", "medium", "hard", "apocalypse", "funny"];

for (const difficulty of difficulties) {
  const size = wordPoolSize(difficulty);
  assert.ok(size >= 10_000, `${difficulty} havuzu 10.000 ifadenin altında`);

  const words = new Set();
  for (let index = 0; index < size; index += 1) {
    const word = wordAt(difficulty, index);
    assert.equal(word.trim().split(/\s+/).length, 2, `${difficulty}: iki kelime değil: ${word}`);
    words.add(word);
  }
  assert.equal(words.size, size, `${difficulty} havuzunda mükerrer ifade var`);
}

console.log(JSON.stringify({ ok: true, twoWordPools: true, uniquePerDifficulty: true }));
