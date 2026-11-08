/**
 * Was als Streaming-Weg zählt (06.11.2026): ein Eintrag in `streams` oder ein `watchLinks`-Eintrag mit `kind: 'stream'`.
 * Ein `watchLinks`-Eintrag mit `kind: 'buy'` ist ein Kauf-/Disc-Weg, kein Stream.
 * Gemeinsame Quelle für `pipeline/check-qualitaet.ts` und `tools/datenqualitaet-messen.mjs`.
 */

/** @param {{ streams?: unknown[], watchLinks?: { kind?: string }[] }} t */
export function hatStreamingWeg(t) {
  return Boolean(t.streams?.length) || (t.watchLinks ?? []).some((w) => w.kind === 'stream')
}

/** Kein Streaming-Weg, aber ein Kauf-/Disc-Weg. */
export function nurKaufWeg(t) {
  return !hatStreamingWeg(t) && Boolean(t.watchLinks?.length)
}
