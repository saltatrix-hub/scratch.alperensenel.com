export function normalizeGuess(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/[^a-zçğıöşü0-9 ]/gi, "").replace(/\s+/g, " ");
}

export function wordParts(word: string): string[] {
  return word.trim().split(/\s+/).filter(Boolean);
}

export function hiddenWord(word: string, revealedParts: boolean[] = []): string {
  return wordParts(word).map((part, index) => revealedParts[index] ? part : "_".repeat(Array.from(part).length)).join(" ");
}

export function revealMatchingParts(word: string, current: boolean[], guess: string) {
  const parts = wordParts(word);
  const normalizedGuess = normalizeGuess(guess);
  const revealedParts = parts.map((part, index) => Boolean(current[index]) || normalizeGuess(part) === normalizedGuess);
  const matched = revealedParts.some((value, index) => value && !current[index]);
  return { revealedParts, matched, complete: revealedParts.length > 1 && revealedParts.every(Boolean) };
}
