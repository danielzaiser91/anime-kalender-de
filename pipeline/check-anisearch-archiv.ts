/**
 * Zusicherung: Die Vorrangliste für aniSearch-Archivseiten ordnet Hauptbestand vor Katalog, kennt reine aniSearch-Titel (Kennung ab 10.000.000),
 * hebt geteilte Kennungen nicht in den Cache und merkt sich nur endgültige Auskünfte; der Lauf pausiert nach einer Sperre, statt abzubrechen.
 * Regel und Anlass: `lib/anisearch-archiv-vorrang.ts`, `lib/anisearch-sperre.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-archiv.ts`
 */
import { archivLuecken, verbinde, zurueckgestellt, type Zeile } from './lib/anisearch-archiv-vorrang.ts'
import { nachFehlern, PAUSEN_MIN } from './lib/anisearch-sperre.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const BASIS = 10_000_000
const JETZT = Date.parse('2026-10-10T12:00:00Z')
/** Kennungen, zu denen es sicher keine Archivdatei gibt. */
const A = 99_999_001
const B = 99_999_002
const C = 99_999_003
const GETEILT = 99_999_004
/** Eine Kennung, deren Archivseite im Repo liegt (Cowboy Bebop). */
const DA = 1572

console.log('\naniSearch-Archivseiten: Vorrang und Lücken:')
{
  const haupt: Zeile[] = [
    { id: 1, anisearchId: A },
    { id: 2, anisearchId: DA },
    { id: BASIS + B },
    { id: 3, anisearchId: GETEILT },
    { id: 4, anisearchId: GETEILT },
    { id: 5 },
  ]
  const katalog: Zeile[] = [
    { id: 11, anisearchId: C, titleDe: undefined, dubConfidence: 'low' },
    { id: 12, anisearchId: 99_999_005, titleDe: 'Mit Titel', dubConfidence: 'high' },
    { id: BASIS + 99_999_006 },
    { id: 13, anisearchId: A },
  ]
  const l = archivLuecken({ haupt, katalog, bruecke: {}, mitTermin: new Set([BASIS + B]), hatCache: (id) => id === 2, weg: {}, jetztMs: JETZT })
  const hauptIds = l.haupt.map((a) => a.asId)
  pruefe('Hauptbestand: Titel mit Termin zuerst, dann AniList-Titel vor reinen aniSearch-Titeln', hauptIds[0] === B && hauptIds[1] === A, hauptIds)
  pruefe('Hauptbestand: vorhandene Archivseite mit Cache-Eintrag ist keine Lücke', !hauptIds.includes(DA), hauptIds)
  pruefe('Hauptbestand: ein AniList-Titel mit Archivdatei, aber ohne Cache-Eintrag bleibt Lücke', archivLuecken({ haupt: [{ id: 2, anisearchId: DA }], katalog: [], bruecke: {}, mitTermin: new Set(), hatCache: () => false, weg: {}, jetztMs: JETZT }).haupt.length === 1)
  pruefe('Reiner aniSearch-Titel (10M+) kennt seine Kennung ohne Brücke und füllt keinen Cache', l.haupt.find((a) => a.asId === B)?.titelIds.length === 0)
  pruefe('Geteilte Kennung: eine Seite, kein Cache-Schlüssel (gehört keinem Titel allein)', l.haupt.filter((a) => a.asId === GETEILT).length === 1 && l.haupt.find((a) => a.asId === GETEILT)?.titelIds.length === 0)
  pruefe('Titel ohne Kennung bleibt draußen', l.haupt.length === 3, hauptIds)
  pruefe('Katalog: deutscher Titel und sichere Synchro zuerst', l.katalog[0]?.asId === 99_999_005, l.katalog.map((a) => a.asId))
  pruefe('Katalog: eine Kennung aus dem Hauptbestand steht dort, nicht noch einmal im Katalog', !l.katalog.some((a) => a.asId === A))
  pruefe('Katalog: der AniList-Titel mit eigener Kennung füllt seinen Cache', l.katalog.find((a) => a.asId === C)?.titelIds[0] === 11)
  const zusammen = verbinde(l.haupt, l.katalog, l.haupt)
  pruefe('Zusammengeführt: jede Kennung genau einmal, Hauptbestand vorn', new Set(zusammen.map((a) => a.asId)).size === zusammen.length && zusammen[0]?.asId === B)
}

console.log('\naniSearch-Archivseiten: endgültige Auskünfte:')
{
  const tag = 86_400_000
  const weg = { [A]: { code: 404, am: new Date(JETZT - 30 * tag).toISOString() }, [B]: { code: 200, am: new Date(JETZT - 30 * tag).toISOString() } }
  pruefe('404 vor 30 Tagen: noch zurückgestellt', zurueckgestellt(weg, A, JETZT))
  pruefe('Seite ohne Archivabschnitte vor 30 Tagen: wieder dran (14-Tage-Frist)', !zurueckgestellt(weg, B, JETZT))
  pruefe('Unbekannte Kennung: nie zurückgestellt', !zurueckgestellt(weg, C, JETZT))
  const l = archivLuecken({ haupt: [{ id: 1, anisearchId: A }], katalog: [], bruecke: {}, mitTermin: new Set(), hatCache: () => false, weg, jetztMs: JETZT })
  pruefe('Eine zurückgestellte Kennung steht nicht in der Liste', l.haupt.length === 0)
}

console.log('\naniSearch-Abruf: Pause statt Abbruch:')
{
  const fruehe = 5 * 60 * 60_000
  pruefe('Unter der Fehlergrenze läuft der Lauf weiter', nachFehlern(4, 5, 0, fruehe).art === 'weiter')
  const erste = nachFehlern(5, 5, 0, fruehe)
  pruefe('Fünf Fehlschläge mit Frist: erste Pause', erste.art === 'pause' && erste.minuten === PAUSEN_MIN[0], erste)
  const dritte = nachFehlern(5, 5, 2, fruehe)
  pruefe('Die Pausen werden länger', dritte.art === 'pause' && dritte.minuten === PAUSEN_MIN[2], dritte)
  pruefe('Sind die Pausen aufgebraucht, endet der Lauf', nachFehlern(5, 5, PAUSEN_MIN.length, fruehe).art === 'ende')
  pruefe('Ohne Frist endet der Lauf sofort (kurzer Schritt im Tageslauf)', nachFehlern(5, 5, 0).art === 'ende')
  pruefe('Reicht die Frist für die Pause nicht, endet der Lauf', nachFehlern(5, 5, 0, 5 * 60_000).art === 'ende')
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
