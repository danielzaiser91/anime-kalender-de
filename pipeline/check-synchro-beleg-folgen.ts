/**
 * Zusicherung: Der Auto-Beleg liest das Feld `folgen` des Vorschlags (A1, PR 3197; Anlass Dr. STONE auf Pluto TV: „23 von 24“ wurde als ganzer
 * Titel belegt). Eine Teilangabe wird `dubRanges`, wo die Nummern eindeutig sind, sonst bleibt der Vorschlag mit benanntem Grund liegen.
 * Die beiden Anlassfälle (Dr. STONE und My Hero Academia aus den Artikeln 1068729 und 1066055) stehen wörtlich im Test. Dazu läuft jeder
 * deutsche Vorschlag mit Folgenangabe einzeln durch die Auswahl und wird gegen ein unabhängiges Kriterium gehalten. Diese 67 Vorschläge liegen
 * als Abzug in `tools/synchro-folgen-faelle.json` (unverändert aus dem Vorschlagsbestand des Sammlers, Stand 08.11.2026, ohne gleiche
 * Wiederholungen): die Sammler-Datei selbst liest kein Test der Kette, denn ein Daten-PR des Sammlers startet die Kette nicht neu.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-synchro-beleg-folgen.ts`
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import type { GespeicherterVorschlag } from './lib/anime2you-bestand.ts'
import { gibSynchroBelegeAb } from './lib/synchro-beleg-abgabe.ts'
import { belegZeilen, mitPlattformAusAnbieter, waehleSynchroBelege, type KatalogTitel } from './lib/synchro-beleg-auswahl.ts'
import { folgenUrteil } from './lib/synchro-beleg-folgen.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

// --- Die Anlassfälle wörtlich aus data/proposals/anime2you-extraktion.json (Stand 08.11.2026) ---------------------------------------
const PLUTO_ARTIKEL = 'Pluto TV nimmt zwei Anime-Neuzugänge ins Programm'
const DR_STONE: GespeicherterVorschlag = {
  titel: 'Dr. STONE',
  zitat: 'Darüber hinaus bietet die Plattform seit Kurzem auch die erste Staffel der Adventure-Serie »Dr. STONE« mit deutscher Sprachfassung auf Abruf an. Von den insgesamt 24 Episoden stehen derzeit allerdings nur 23 Folgen zur Verfügung.',
  art: 'start',
  sprache: 'deutsch',
  plattform: null,
  datum: null,
  uhrzeit: null,
  anbieter: 'Pluto TV',
  sender: null,
  wochentage: null,
  folgen: '23 von 24',
  unsicher: null,
  wochentag: null,
  warnungen: ['anbieter „Pluto TV“ steht nur im Artikeltext, nicht im Zitat – gegenlesen'],
  artikelId: '1068729',
  artikel: 'Zwei weitere Anime-Neuzugänge kostenlos auf Deutsch bei Pluto TV',
  quelle: 'https://www.anime2you.de/news/1068729/pluto-tv-dr-stone-und-mehr/',
  veroeffentlicht: '2026-11-06',
  gelesenAm: '2026-11-07',
} as GespeicherterVorschlag
const MHA: GespeicherterVorschlag = {
  ...DR_STONE,
  titel: 'My Hero Academia',
  zitat: 'Darüber hinaus kann die 13-teilige erste Staffel der Actionserie »My Hero Academia« seit Kurzem ebenfalls mit deutscher Synchronisation auf Pluto TV angesehen werden.',
  folgen: '1–13',
  unsicher: 'Ob bei Pluto TV weitere Episoden folgen, ist laut Artikel noch offen.',
  warnungen: [],
  artikelId: '1066055',
  artikel: PLUTO_ARTIKEL,
  quelle: 'https://www.anime2you.de/news/1066055/pluto-tv-black-clover-und-mehr/',
  veroeffentlicht: '2026-10-31',
  gelesenAm: '2026-11-01',
} as GespeicherterVorschlag
const BLACK_CLOVER: GespeicherterVorschlag = {
  ...MHA,
  titel: 'Black Clover',
  zitat: 'Zu den neuesten Anime-Ergänzungen gehören unter anderem die ersten 35 Episoden der Anime-Umsetzung von »Black Clover«, die ab sofort in der deutschen Sprachfassung auf Abruf zur Verfügung stehen.',
  folgen: '1–35',
  unsicher: null,
  warnungen: ['anbieter „Pluto TV“ steht nur im Artikeltext, nicht im Zitat – gegenlesen'],
} as GespeicherterVorschlag

const weg = { platform: 'plutotv' }
/** Der richtige Titel in der Mitte, zwei Fremde davor und danach. */
const katalogFuer = (titel: string, id: number): KatalogTitel[] => [
  { id: id - 1, titleDe: `${titel} Special`, streams: [{ platform: 'primevideo' }] },
  { id, titleDe: titel, streams: [weg] },
  { id: id + 1, titleDe: `${titel}: New World`, streams: [weg] },
]
const lauf = (v: GespeicherterVorschlag, id = 910001) => waehleSynchroBelege([v], katalogFuer(v.titel, id), new Map(), '2026-11-08', 10)

// --- folgenUrteil: jeder Zweig mit echten Werten aus dem Bestand --------------------------------------------------------------------
const ohne = (f: string | null, z = 'Zitat ohne Angabe zur Länge.') => folgenUrteil(f, z)
const grundVon = (f: string | null, z?: string): string => ('grund' in ohne(f, z) ? (ohne(f, z) as { grund: string }).grund : '')
pruefe('leer/null/Leerzeichen: ganzer Titel', ['ganz' in ohne(null), 'ganz' in ohne(''), 'ganz' in ohne('  ')].every(Boolean))
pruefe('Bereich mit Gedankenstrich (780–877)', JSON.stringify(ohne('780–877')) === '{"von":780,"bis":877}', ohne('780–877'))
pruefe('Bereich mit Bindestrich (14-16)', JSON.stringify(ohne('14-16')) === '{"von":14,"bis":16}', ohne('14-16'))
pruefe('Bereich mit „bis“ (4 bis 6)', JSON.stringify(ohne('4 bis 6')) === '{"von":4,"bis":6}', ohne('4 bis 6'))
pruefe('Bereich mit Zusatz (7 bis 13 (komplett)) bleibt ein Bereich, kein ganzer Titel', JSON.stringify(ohne('7 bis 13 (komplett)')) === '{"von":7,"bis":13}', ohne('7 bis 13 (komplett)'))
pruefe('Bereich aus einer Folge (5–5)', JSON.stringify(ohne('5–5')) === '{"von":5,"bis":5}', ohne('5–5'))
pruefe('Bereich rückwärts (9–3): zurückgestellt', grundVon('9–3').includes('rückwärts'), ohne('9–3'))
pruefe('„ab 1101“: kein Ende, zurückgestellt', grundVon('ab 1101').includes('ohne Ende'), ohne('ab 1101'))
pruefe('„23 von 24“: Teilangabe, zurückgestellt', grundVon('23 von 24').includes('Teilangabe'), ohne('23 von 24'))
pruefe('„Staffel 1 von 4“: nicht eindeutig', grundVon('Staffel 1 von 4').includes('nicht eindeutig'), ohne('Staffel 1 von 4'))
pruefe('„6 und 7“: keine erfundene Spanne, nicht eindeutig', grundVon('6 und 7').includes('nicht eindeutig'), ohne('6 und 7'))
pruefe('„2 (Episode 9 und 10 von Part 4)“: nicht eindeutig', grundVon('2 (Episode 9 und 10 von Part 4)').includes('nicht eindeutig'))
pruefe('„24 (komplett)“: ganzer Titel', 'ganz' in ohne('24 (komplett)'))
pruefe('„komplett“ in Großschrift: ganzer Titel', 'ganz' in ohne('24 (KOMPLETT)'))
pruefe('Zahl „1“ bei laufendem Simulcast: zurückgestellt', grundVon('1', '»Aoashi« – Staffel 2 Episoden: 1 auf Deutsch verfügbar Simulcast: Jeden Sonntag um 11:00 Uhr').includes('ohne Nummern'))
pruefe('Zahl „52“ ohne Komplett-Zusatz: zurückgestellt', grundVon('52', '»Naruto Shippuden« – Staffel 4 Episoden: 52 Sprache: Deutsch').includes('„52“'))
pruefe('Zahl „12“, Zitat „(komplett)“: ganzer Titel', 'ganz' in ohne('12', '»Rooster Fighter« Episoden: 12 (komplett) Sprache: Deutsch'))
pruefe('Zahl „13“, Zitat „13-teilige Serie“: ganzer Titel', 'ganz' in ohne('13', 'Die 13-teilige Serie »Pet« kann ab sofort auch mit deutscher Synchronisation angesehen werden.'))
pruefe('Zahl „12“, Zitat „zwölfteilige Serie“: ganzer Titel', 'ganz' in ohne('12', 'die zwölfteilige Romance-Serie »Honey Lemon Soda«'))
pruefe('Zahlwort „zwölf“, Zitat „zwölfteilig“: ganzer Titel', 'ganz' in ohne('zwölf', 'die zwölfteilige Serie'))
pruefe('„mehrteilig“ im Zitat ist keine Komplett-Angabe', grundVon('3', 'Die mehrteilige Serie ist jetzt auf Deutsch verfügbar.').includes('ohne Nummern'))
pruefe('Zahl in der Folgenangabe, „Komplettbox“ im Zitat ist kein „(komplett)“', grundVon('12', 'Blu-ray-Komplettbox mit allen Episoden').includes('ohne Nummern'))

// --- Anlassfälle durch die Auswahl ---------------------------------------------------------------------------------------------------
const ds = lauf(DR_STONE)
pruefe('Dr. STONE (23 von 24, Pluto TV): kein Beleg', ds.belege.length === 0, ds.belege)
pruefe('Dr. STONE: benannter Grund, berechtigt (nicht strittig)', ds.zurueck.length === 1 && ds.zurueck[0]!.grund.includes('„23 von 24“') && ds.zurueck[0]!.strittig === false, ds.zurueck)
pruefe('Dr. STONE ohne die Teilangabe wäre ein ganzer Beleg (die Sperre kommt von `folgen`, nicht von der Kulisse)', lauf({ ...DR_STONE, folgen: null }).belege.length === 1 && lauf({ ...DR_STONE, folgen: null }).belege[0]!.bereich === undefined)
pruefe('My Hero Academia (Artikel 1066055) wie gespeichert: wegen „unsicher“ kein Beleg', lauf(MHA).belege.length === 0)
const mha = lauf({ ...MHA, unsicher: null }).belege[0]
pruefe('My Hero Academia ohne den Unsicher-Vermerk: Beleg nur für die Folgen 1 bis 13', JSON.stringify(mha?.bereich) === '{"von":1,"bis":13}' && mha?.anilistId === 910001, mha)
const bc = lauf(BLACK_CLOVER, 910101).belege[0]
pruefe('Black Clover (1–35): Bereich 1 bis 35, nicht der ganze Titel', JSON.stringify(bc?.bereich) === '{"von":1,"bis":35}', bc)
pruefe('Ein Bereich-Beleg gehört dem richtigen Titel unter dreien', bc?.anilistId === 910101 && bc.titel === 'Black Clover')

// --- YAML des Belegs: dubRanges nur beim Bereich, gültig und mit Nummern aus dem Artikel ----------------------------------------
const gelesen = (b: NonNullable<typeof mha>) => yaml.load(belegZeilen(b, '2026-11-08').join('\n')) as { dub: boolean; dubRanges?: { from: number; to: number; dub: boolean }[]; note: string }[]
pruefe('Bereich-Beleg als YAML: dub true und genau ein Bereich 1–13 mit dub true', JSON.stringify(gelesen(mha!)[0]!.dubRanges) === '[{"from":1,"to":13,"dub":true}]' && gelesen(mha!)[0]!.dub === true, gelesen(mha!))
pruefe('Bereich-Beleg: die Notiz nennt die Teilangabe', gelesen(mha!)[0]!.note.includes('Nur die Folgen 1 bis 13'), gelesen(mha!)[0]!.note)
const ganz = lauf({ ...DR_STONE, folgen: '24 (komplett)' }).belege[0]
pruefe('Ganzer Beleg als YAML: kein dubRanges, Notiz ohne Folgenzusatz', !!ganz && gelesen(ganz)[0]!.dubRanges === undefined && !gelesen(ganz)[0]!.note.includes('Nur die Folgen'), ganz)

// --- Schreibweg: Bereich landet in der Belegdatei, Dr. STONE nicht -----------------------------------------------------------------
const wurzel = mkdtempSync(join(tmpdir(), 'synchro-folgen-'))
try {
  const belegDatei = join(wurzel, 'dub.yaml')
  const katalogDatei = join(wurzel, 'titles.json')
  writeFileSync(belegDatei, '# Handbelege\n')
  writeFileSync(katalogDatei, JSON.stringify([...katalogFuer('My Hero Academia', 910201), ...katalogFuer('Dr. STONE', 910301)]))
  const erg = gibSynchroBelegeAb({ vorschlaege: [{ ...MHA, unsicher: null }, DR_STONE], belegDatei, katalogDateien: [katalogDatei], heute: '2026-11-08', log: () => {}, warn: () => {} })
  const datei = yaml.load(readFileSync(belegDatei, 'utf8')) as { anilistId: number; dubRanges?: unknown }[]
  pruefe('Schreibweg: genau ein Block (My Hero Academia) mit Bereich, Dr. STONE fehlt', erg.belege.length === 1 && datei.length === 1 && datei[0]!.anilistId === 910201 && JSON.stringify(datei[0]!.dubRanges) === '[{"from":1,"to":13,"dub":true}]', datei)
  pruefe('Schreibweg: Dr. STONE steht als zurückgestellt mit der Teilangabe im Grund', erg.zurueck.some((z) => z.titel === 'Dr. STONE' && z.grund.includes('23 von 24')), erg.zurueck)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// --- Jeder gespeicherte Vorschlag, einzeln, gegen ein unabhängiges Kriterium -------------------------------------------------------
const alle = JSON.parse(readFileSync(fileURLToPath(new URL('../tools/synchro-folgen-faelle.json', import.meta.url)), 'utf8')) as GespeicherterVorschlag[]
pruefe('Abzug der gespeicherten Vorschläge ist nicht leer (sonst prüft die Schleife nichts)', alle.length > 0)
let gesehen = 0
let teilangaben = 0
let beleg = 0
alle.forEach((roh, i) => {
  const v = mitPlattformAusAnbieter(roh)
  if (!v.plattform) return
  gesehen++
  const e = waehleSynchroBelege([roh], [{ id: 920000 + i, titleDe: v.titel, streams: [{ platform: v.plattform }] }], new Map(), '2026-11-08', 10)
  const f = (roh.folgen ?? '').trim()
  const range = /^(\d+)\s*(?:–|-|bis)\s*(\d+)/.exec(f)
  const teil = /\bvon\b|^ab\b|^Staffel|\(Episode/i.test(f)
  if (teil || range) teilangaben++
  if (!e.belege.length) return
  beleg++
  const b = e.belege[0]!
  const wo = `${roh.artikelId} ${roh.titel} folgen=${JSON.stringify(roh.folgen)}`
  pruefe(`Alle Vorschläge: Teilangabe ergibt keinen ganzen Beleg (${wo})`, !teil)
  if (range) pruefe(`Alle Vorschläge: Bereich im Beleg gleich dem Artikel (${wo})`, b.bereich?.von === Number(range[1]) && b.bereich?.bis === Number(range[2]), b.bereich)
  else pruefe(`Alle Vorschläge: kein Bereich ohne Bereichsangabe (${wo})`, b.bereich === undefined, b.bereich)
  if (f && !range) pruefe(`Alle Vorschläge: Zahl nur mit „(komplett)“ oder N-teilig im Text (${wo})`, /komplett|teilig/i.test(`${f} ${roh.zitat}`))
})
console.log(`check-synchro-beleg-folgen: ${faelle} Fälle ${fehler ? 'FEHLER' : 'ok'} (Anlass Dr. STONE 23 von 24 und My Hero Academia; ${gesehen} Vorschläge des Abzugs einzeln geprüft, davon ${teilangaben} mit Teilangabe, ${beleg} wären ein Beleg).`)
if (fehler) process.exit(1)
