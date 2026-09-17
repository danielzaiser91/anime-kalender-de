/**
 * **Neue JustWatch-Daten entfernen nichts von selbst** (Daniel, 17.09.2026: „es kann ja
 * sein das es legitim ist, aber zur sicherheit handprüfen").
 *
 * Seit dem 17.09.2026 fragt der Wochenlauf JustWatch zu allen Titeln, nicht mehr nur zu
 * offenen. Am selben Abend zeigte Daniels Gegenprobe, dass JustWatch einem Angebot die
 * falsche Amazon-Kennung geben kann (Pokémon Weiß → Schwarz). Zwei Läufe machen aus
 * JustWatch-Daten ein Nein, das einen Verweis entfernt:
 *
 * - `kanal-gegenprobe.ts`: Kanal-Meldung ohne Deutsch + JustWatch ohne Deutsch
 * - `fetch-crunchyroll-offene.ts`: nicht im deutschen Katalog + JustWatch ohne Crunchyroll
 *
 * Für einen Titel, den JustWatch in den letzten `FRISCH_TAGE` Tagen erstmals beantwortet
 * hat, entsteht dort kein Nein, sondern ein Eintrag in `data/justwatch-handpruefung.json`
 * und in der Liste `daniel-zum-abarbeiten/20-justwatch-handpruefung.md`. Ältere Einträge
 * haben sich bewährt und wirken wie bisher.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './util.ts'

export const FRISCH_TAGE = 28
/** Ab diesem Tag fragt der Lauf alle Titel; Einträge davor tragen kein `erstAm`. */
const UMBAU = '2026-09-17'

export function jwFrisch(e: { erstAm?: string; geprueftAm?: string } | undefined, heute: string): boolean {
  if (!e) return false
  const erst = e.erstAm ?? ((e.geprueftAm ?? '') >= UMBAU ? e.geprueftAm : undefined)
  if (!erst) return false
  return (Date.parse(heute) - Date.parse(erst)) / 86_400_000 < FRISCH_TAGE
}

export interface Handpruefung {
  titleId: number
  titel: string
  plattform: string
  url?: string
  /** Was der Lauf gefolgert hätte. */
  folgerung: string
  jwPfad?: string
  seit: string
}

const DATEI = resolve(ROOT, 'data/justwatch-handpruefung.json')
const LISTE = resolve(ROOT, 'daniel-zum-abarbeiten/20-justwatch-handpruefung.md')

/**
 * Vermerkt Fälle einer Quelle. Die Fälle derselben Quelle werden ersetzt (der Lauf kennt
 * seinen ganzen Stand), die der anderen bleiben.
 */
export function handpruefungSchreiben(
  quelle: 'kanal' | 'crunchyroll',
  faelle: Handpruefung[],
  /** `true`: der Lauf kennt seinen ganzen Stand. Sonst werden Fälle ergänzt und nach der Frist verworfen. */
  ersetzen: boolean,
  heute: string,
): void {
  const bisher = existsSync(DATEI)
    ? (JSON.parse(readFileSync(DATEI, 'utf8')) as Record<string, Handpruefung[]>)
    : {}
  const schluessel = (f: Handpruefung) => `${f.titleId}|${f.url ?? ''}`
  const alt = new Map((bisher[quelle] ?? []).map((f) => [schluessel(f), f]))
  const neu = new Map(faelle.map((f) => [schluessel(f), { ...f, seit: alt.get(schluessel(f))?.seit ?? f.seit }]))
  if (!ersetzen) {
    /* Nach der Frist wirkt die Folgerung ohnehin automatisch — dann gehört der Fall nicht mehr hierher. */
    for (const [k, f] of alt) {
      if (neu.has(k)) continue
      if ((Date.parse(heute) - Date.parse(f.seit)) / 86_400_000 < FRISCH_TAGE + 7) neu.set(k, f)
    }
  }
  bisher[quelle] = [...neu.values()]
  writeFileSync(DATEI, JSON.stringify(bisher, null, 2) + '\n')
  const zeilen = [
    '# JustWatch-Folgerungen zur Handprüfung',
    '',
    `Neue JustWatch-Daten entfernen in den ersten ${FRISCH_TAGE} Tagen nichts von selbst. Diese Fälle hätte ein Lauf als „kein Deutsch" bzw. „nicht mehr da" gewertet. Je Zeile: Link öffnen und sagen, ob die Folgerung stimmt.`,
    '',
    '| Titel | Anbieter | Folgerung | Link | JustWatch | seit |',
    '|---|---|---|---|---|---|',
  ]
  for (const [q, liste] of Object.entries(bisher)) {
    for (const f of liste) {
      zeilen.push(
        `| [${f.titel}](https://anime-kalender.de/#/datenbank?t=${f.titleId}) | ${f.plattform} (${q}) | ${f.folgerung} | ${f.url ? `[öffnen](${f.url})` : '—'} | ${f.jwPfad ? `[JustWatch](https://www.justwatch.com${f.jwPfad})` : '—'} | ${f.seit} |`,
      )
    }
  }
  writeFileSync(LISTE, zeilen.join('\n') + '\n')
}
