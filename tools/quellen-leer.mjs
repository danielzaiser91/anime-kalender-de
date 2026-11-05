/**
 * „Grün, aber leer“: eine Quelle, deren Läufe ohne Fehler enden, aber seit Tagen 0 Treffer melden.
 * Die Frist-Prüfung (`quellen-fristen.mjs`) sieht das nicht, weil jeder grüne Lauf `lastOk` auffrischt.
 * `leerSeit` in `data/source-health.json` setzt `pipeline/lib/health.ts`.
 */

const TAG_MS = 86_400_000
/** Ab so vielen Tagen durchgehender Leere wird gemeldet (Tageslauf: 3 Läufe in Folge reichen, ein leerer Lauf nicht). */
export const LEER_TAGE = 3

/**
 * Quellen, bei denen 0 Treffer der Normalfall ist — Grund je Zeile (Gemessen: 18 Tage Verlauf in `git log -p -- data/source-health.json`, 05.11.2026).
 * Alles, was hier fehlt, wird gemeldet.
 */
export const LEER_OK = {
  'youtube-check': 'Warteschlange leer: alle YouTube-Verweise geprüft (Anlass 29.08.2026)',
  'motn-changes': 'Änderungs-Feed der letzten Tage: „nichts geändert“ ist die übliche Antwort (Anlass 27.08.2026)',
  messbelege: 'keine verpassten Termine offen: Warteschlange leer ist der Normalfall',
  rohfolgen: 'Briefkasten leer: Daniel hat nichts gemeldet (Anlass 29.08.2026)',
  vorfaelle: '0 Vorfälle ist der Normalfall',
}

/** Eine Zeile je Quelle, die seit mehr als `LEER_TAGE` Tagen grün, aber leer ist und nicht in `ok` steht; nach Name sortiert. */
export function leerZeilen(gesundheit, jetztMs, ok = LEER_OK, tage = LEER_TAGE) {
  return Object.keys(gesundheit)
    .sort()
    .filter((name) => !(name in ok))
    .map((name) => ({ name, seitMs: Date.parse(gesundheit[name]?.leerSeit ?? '') }))
    .filter(({ seitMs }) => Number.isFinite(seitMs) && (jetztMs - seitMs) / TAG_MS > tage)
    .map(({ name, seitMs }) => `${name}: grün, aber leer — seit ${((jetztMs - seitMs) / TAG_MS).toFixed(1)} Tagen 0 Treffer ohne Fehler`)
}
