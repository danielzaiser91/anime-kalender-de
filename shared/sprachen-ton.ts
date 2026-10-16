/**
 * Nennt eine Liste gemeldeter Tonspuren Deutsch? Die Erzeuger schreiben es verschieden:
 * Prime Namen (`"Deutsch"`, `extension/amazon-leser.js`), Netflix `code|name` (`"de|Deutsch"`, `extension/melder.js`),
 * Disney+ nur Codes (`"de"`, `extension/disney-leser.js`).
 */
export function hatDeutschenTon(sprachen: readonly string[]): boolean {
  return sprachen.some((s) => /^de(?:[-_|]|$)/i.test(s) || /deutsch|german/i.test(s))
}
