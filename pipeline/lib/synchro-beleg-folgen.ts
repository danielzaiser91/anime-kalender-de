/**
 * **Welche Folgen deckt die Synchro-Aussage eines Vorschlags?** (Auto-Beleg, `synchro-beleg-auswahl.ts`; Anlass Dr. STONE auf Pluto TV: „23 von 24“
 * wurde als ganzer Titel belegt). Das Feld `folgen` des Vorschlags ist freier Text „wie genannt“ (`anime2you-extraktion-anleitung.md`).
 * Ein Beleg gilt dem ganzen Titel nur, wo der Artikel das sagt; eine Teilangabe wird zum Bereich (`dubRanges`), wo die Nummern eindeutig sind,
 * sonst bleibt der Vorschlag liegen. Nie eine Folgennummer erfinden.
 *
 * - leer: der Artikel nennt keine Folgen, das Zitat gilt dem Titel (bisheriges Verhalten).
 * - `a–b`, `a-b`, `a bis b` (a ≤ b): genau diese Folgen.
 * - `N (komplett)`, oder eine Zahl, deren Zitat die Serie als komplett oder N-teilig nennt: ganzer Titel.
 * - `ab N` (kein Ende), `X von Y` (die fehlenden Folgen sind unbekannt), eine Zahl ohne Komplett-Zusatz („Episoden: 1 verfügbar“ bei laufendem
 *   Simulcast) und alles andere: zurückgestellt, mit Grund.
 */
export type FolgenUrteil = { ganz: true } | { von: number; bis: number } | { grund: string }

const BEREICH = /^(\d+)\s*(?:[–-]|bis)\s*(\d+)(?:\s*\(komplett\))?$/i
const OFFENES_ENDE = /^ab\s+\d+$/i
const TEILMENGE = /^\d+\s+von\s+\d+$/i
const NUR_ZAHL = /^(?:\d+|\p{L}+)(?:\s*\(komplett\))?$/iu
const ZAHLWORT = 'ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|\\p{L}+zehn|\\p{L}*zig'
/** Das Zitat nennt die Serie als Ganzes: „12 (komplett)“, „13-teilige Serie“, „zwölfteilige Serie“ (nicht „mehrteilig“). */
const SERIE_KOMPLETT = new RegExp(`\\(komplett\\)|(?:\\d+-|${ZAHLWORT})teilig`, 'iu')

export function folgenUrteil(folgen: string | null, zitat: string): FolgenUrteil {
  const f = (folgen ?? '').trim()
  if (!f) return { ganz: true }
  const bereich = BEREICH.exec(f)
  if (bereich) {
    const [von, bis] = [Number(bereich[1]), Number(bereich[2])]
    return von <= bis ? { von, bis } : { grund: `Folgenbereich „${f}“ läuft rückwärts` }
  }
  if (OFFENES_ENDE.test(f)) return { grund: `Folgen „${f}“ ohne Ende: keine Obergrenze genannt` }
  if (TEILMENGE.test(f)) return { grund: `Teilangabe „${f}“: welche Folgen fehlen, steht nicht im Artikel` }
  if (!NUR_ZAHL.test(f)) return { grund: `Folgenangabe „${f}“ nicht eindeutig (keine Nummern)` }
  if (/komplett/i.test(f) || SERIE_KOMPLETT.test(zitat)) return { ganz: true }
  return { grund: `Folgenzahl „${f}“ ohne Nummern und ohne „komplett“ im Zitat: Teilbestand möglich` }
}
