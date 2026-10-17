/**
 * Zusicherung: Der Namensvorspann gilt auch im reinen aniSearch-Reihenweg (`REIHEN_QUELLE=anisearch`, Standard seit 12.10.2026) — durch `fuehreReihenZusammenQuelle`, wie `build.ts` ruft.
 * Die Fälle sind die fünf, die im Bestandsbau vom 17.10.2026 übrig blieben (Boonie Bears, Hello Kitty, Carnival Phantasm; Issue #1414), mit erfundenen Kennungen ab 900000.
 * Ziel der Regel darf ein Katalogtitel sein, denn `titles.json` steht beim Katalog-Schritt schon. Die Regel selbst: `check-reihen-namen.ts`; der Bestand: `check-reihen-namen-bestand.ts`.
 */
import { ordner, raeumeAuf } from './lib/pruefliste-umleiten.ts'
import type { KatalogEintrag } from './lib/anilist.ts'
import type { Title } from '../shared/types.ts'
import { ANISEARCH_ID_BASIS } from './bau/anisearch-titel.ts'
import { type ReinQuellen, fuehreReihenZusammenQuelle, reineKatalogReihen } from './bau/anisearch-reihen-rein-bau.ts'
import { katalogAnker } from './bau/anisearch-reihen-pruefliste.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const B = ANISEARCH_ID_BASIS
const zeile = (n: number, titleEn: string, extra: Partial<Title> = {}) => ({ id: B + n, titleEn, streams: [], ...extra }) as unknown as Title
const eintrag = (id: number, romaji: string, rel: number[] = [], englisch: string | null = null) => ({ id, t: [romaji, englisch, null], format: 'TV', jahr: 2000, folgen: 12, rel, eltern: [] }) as unknown as KatalogEintrag

// Hauptbestand: Boonie Bears (zwei Alleinstehende, Ziel im Katalog), Hello Kitty (zwei), Carnival Phantasm (eins, Ziel allein im Katalog), Gegenprobe, Mondlicht (Ziel im Hauptbestand)
const BOONIE_ANKER = B + 900_010
const [BOONIE_1, BOONIE_2, KITTY_1, KITTY_2, CARNIVAL, GLEICH, MOND_KOPF, MOND_TEIL, MOND_SONDER] = [B + 900_011, B + 900_012, B + 900_021, B + 900_022, B + 900_031, B + 900_041, B + 900_051, B + 900_053, B + 900_054]
const [K_BOONIE, K_KITTY, K_KITTY_2, K_CARNIVAL, K_GLEICH_1, K_GLEICH_1B, K_GLEICH_2, K_GLEICH_2B, K_ZETA, K_STERN] = [900_101, 900_102, 900_103, 900_104, 900_105, 900_106, 900_107, 900_108, 900_109, 900_110]
// Zeta: der Katalogtitel hängt über eine aniSearch-Beziehung am Anker (Kennung 900072 ↔ 900071); Stern: der Anker steht schon in einer Reihe (Teil → Kopf)
const [ZETA_ANKER, ZETA_NEU, STERN_KOPF, STERN_TEIL, STERN_NEU] = [B + 900_071, B + 900_073, B + 900_061, B + 900_062, B + 900_063]

const hauptbestand = (): Map<number, Title> =>
  new Map(
    [
      zeile(900_010, 'Boonie Bears: To the Rescue'),
      zeile(900_011, 'Boonie Bears: Blast into the Past'),
      zeile(900_012, 'Boonie Bears: Wild Continent'),
      zeile(900_021, 'Hello Kitty: The Wild Swans'),
      zeile(900_022, 'Hello Kitty: Santa’s Missing Hat'),
      zeile(900_031, 'Carnival Phantasm: Onsei-tsuki Fuuun Illya-jou'),
      zeile(900_041, 'Gleichlauf: Das Finale'),
      zeile(900_051, 'Mondlicht Chronik'),
      zeile(900_053, 'Mondlicht Chronik: Teil Zwei'),
      zeile(900_054, 'Mondlicht Chronik: Sondertitel'),
      zeile(900_061, 'Sterne Saga'),
      zeile(900_062, 'Sterne Saga: Teil Zwei'),
      zeile(900_063, 'Sterne Legende: Spezial'),
      zeile(900_071, 'Zeta Anker'),
      zeile(900_073, 'Zeta Reihe: Neues'),
    ].map((t) => [t.id, t]),
  )
const katalog = (): KatalogEintrag[] => [
  eintrag(K_GLEICH_1, 'Gleichlauf', [K_GLEICH_1B]),
  eintrag(K_GLEICH_1B, 'Gleichlauf Zwei', [K_GLEICH_1]),
  eintrag(K_KITTY, 'Hakuna Kitty', [K_KITTY_2], 'Hello Kitty'),
  eintrag(K_KITTY_2, 'Hello Kitty: Lets Play', [K_KITTY]),
  eintrag(K_BOONIE, 'Kuma Kuma', [], 'Boonie Bears'),
  eintrag(K_ZETA, 'Zeta Reihe'),
  eintrag(K_STERN, 'Sterne Legende'),
  eintrag(K_CARNIVAL, 'Carnival Phantasm'),
  eintrag(K_GLEICH_2, 'Gleichlauf', [K_GLEICH_2B]),
  eintrag(K_GLEICH_2B, 'Gleichlauf Drei', [K_GLEICH_2]),
]
const quellen = (eintraege: KatalogEintrag[] = katalog()): ReinQuellen => ({
  beziehungen: () => ({ kanten: [{ a: 900_071, b: 900_072, art: 'Sequel' }, { a: 900_061, b: 900_062, art: 'Sequel' }, { a: 900_062, b: 900_074, art: 'Sequel' }], namen: new Map() }),
  katalog: () => eintraege,
  hand: () => ({ verbinden: [[K_BOONIE, BOONIE_ANKER], [MOND_KOPF, MOND_TEIL]], trennen: [] }),
  kennungen: (titel) => new Map(titel.flatMap((t): [number, number][] => (t.id >= B ? [[t.id, t.id - B]] : t.id === K_ZETA ? [[t.id, 900_072]] : t.id === K_STERN ? [[t.id, 900_074]] : []))),
})
const args = (titles: Map<number, Title>) => ({ byAniId: {}, byMal: {}, titles, tmdbTitles: {}, anisearch: {} })
const reihe = (m: Map<number, Title>, id: number): number => m.get(id)!.franchiseId ?? id

/** Läuft `f` mit gesetztem (`wert`) bzw. entferntem `REIHEN_QUELLE` und sammelt die Warnungen. */
function mitQuelle<T>(wert: string | undefined, f: () => T): { ergebnis: T; warnungen: string[] } {
  const [vorher, warnAlt, warnungen] = [process.env.REIHEN_QUELLE, console.warn, [] as string[]]
  if (wert === undefined) delete process.env.REIHEN_QUELLE
  else process.env.REIHEN_QUELLE = wert
  console.warn = (...a: unknown[]) => void (a.join(' ').includes('aniSearch-Reihen') && warnungen.push(a.join(' ')))
  try {
    return { ergebnis: f(), warnungen }
  } finally {
    console.warn = warnAlt
    if (vorher === undefined) delete process.env.REIHEN_QUELLE
    else process.env.REIHEN_QUELLE = vorher
  }
}

console.log('\nReiner Weg, Katalog da: Alleinstehende kommen zur Reihe, die ihr Namensvorspann nennt')
{
  const m = hauptbestand()
  const { warnungen } = mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m), quellen()))
  pruefe('Ohne Fehler und ohne Warnung', warnungen.length === 0, warnungen)
  pruefe('Boonie Bears: beide kommen zur Reihe des Ankers (Ziel „Boonie Bears“ steht nur im Katalog)', reihe(m, BOONIE_1) === BOONIE_ANKER && reihe(m, BOONIE_2) === BOONIE_ANKER, [reihe(m, BOONIE_1), reihe(m, BOONIE_2)])
  pruefe('Hello Kitty: beide kommen zur selben Reihe wie der Katalogtitel „Hello Kitty“', reihe(m, KITTY_1) === reihe(m, KITTY_2) && reihe(m, KITTY_1) < B, [reihe(m, KITTY_1), reihe(m, KITTY_2)])
  pruefe('Carnival Phantasm kommt zum alleinstehenden Katalogtitel gleichen Namens', reihe(m, CARNIVAL) === K_CARNIVAL, reihe(m, CARNIVAL))
  pruefe('Heißt der Vorspann zwei Katalogreihen, wird keine geraten', reihe(m, GLEICH) === GLEICH, reihe(m, GLEICH))
  pruefe('Ziel im Hauptbestand: „Mondlicht Chronik: Sondertitel“ kommt zur Reihe des Kopfs', reihe(m, MOND_SONDER) === reihe(m, MOND_KOPF) && reihe(m, MOND_KOPF) === reihe(m, MOND_TEIL), reihe(m, MOND_SONDER))
  pruefe('Der Anker selbst wandert nicht', reihe(m, BOONIE_ANKER) === BOONIE_ANKER)
  pruefe('Zeta: der Katalogtitel hängt über eine Beziehung am Anker, der Alleinstehende kommt zu dessen Reihe', reihe(m, ZETA_NEU) === ZETA_ANKER, reihe(m, ZETA_NEU))
  pruefe('Stern: der Katalogtitel hängt per Beziehung an einem Titel (Teil), der schon in einer Reihe steht; der Alleinstehende kommt zur Reihe des Kopfs', reihe(m, STERN_TEIL) === STERN_KOPF && reihe(m, STERN_NEU) === STERN_KOPF, [reihe(m, STERN_TEIL), reihe(m, STERN_NEU)])

  // Der Katalog-Schritt läuft danach mit den geänderten Ankern: derselbe Katalogtitel muss in derselben Reihe landen (sonst steht der Alleinstehende wieder allein).
  const haupt = [...m.values()]
  const kennung = quellen().kennungen([...katalog(), ...haupt])
  const anker = katalogAnker(katalog(), new Map(haupt.map((t) => [t.id, reihe(m, t.id)])), [], kennung, { katalogWeg: new Map(), zeilenWeg: new Set() }, haupt)
  const spaeter = reineKatalogReihen(katalog(), kennung, anker, new Map(), quellen().beziehungen().kanten, new Map(), quellen().hand()).reihe
  pruefe('Katalog-Schritt: „Boonie Bears“ steht in der Reihe der beiden', spaeter.get(K_BOONIE) === reihe(m, BOONIE_1), spaeter.get(K_BOONIE))
  pruefe('Katalog-Schritt: „Hello Kitty“ steht in der Reihe der beiden', spaeter.get(K_KITTY) === reihe(m, KITTY_1), spaeter.get(K_KITTY))
  pruefe('Katalog-Schritt: „Zeta Reihe“ steht in der Reihe des Alleinstehenden', spaeter.get(K_ZETA) === reihe(m, ZETA_NEU), spaeter.get(K_ZETA))
  pruefe('Katalog-Schritt: „Sterne Legende“ steht in der Reihe des Alleinstehenden', spaeter.get(K_STERN) === reihe(m, STERN_NEU), spaeter.get(K_STERN))
  pruefe('Katalog-Schritt: „Carnival Phantasm“ steht in der Reihe des Alleinstehenden', spaeter.get(K_CARNIVAL) === reihe(m, CARNIVAL), spaeter.get(K_CARNIVAL))
}

console.log('\nReiner Weg, Katalog mit einem einzigen Eintrag')
{
  const m = hauptbestand()
  mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m), quellen([eintrag(K_CARNIVAL, 'Carnival Phantasm')])))
  pruefe('Ein einziger Katalogtitel genügt als Ziel', reihe(m, CARNIVAL) === K_CARNIVAL, reihe(m, CARNIVAL))
}

console.log('\nReiner Weg, Katalog leer: nur Ziele im Hauptbestand')
{
  const m = hauptbestand()
  mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m), quellen([])))
  pruefe('Ein Ziel im Hauptbestand gilt weiter', reihe(m, MOND_SONDER) === reihe(m, MOND_KOPF))
  pruefe('Ein Ziel nur im Katalog fehlt, die Alleinstehenden bleiben allein', reihe(m, BOONIE_1) === BOONIE_1 && reihe(m, KITTY_1) === KITTY_1 && reihe(m, CARNIVAL) === CARNIVAL)
}

console.log('\nReiner Weg, Katalog nicht lesbar: Warnung, die Reihen bleiben')
{
  const m = hauptbestand()
  const kaputt: ReinQuellen = { ...quellen(), katalog: () => { throw new Error('Katalog kaputt') } }
  const { warnungen } = mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m), kaputt))
  pruefe('Der Bau läuft weiter und warnt mit dem Grund', warnungen.length === 1 && warnungen[0]!.includes('Katalog kaputt'), warnungen)
  pruefe('Die Reihen aus aniSearch stehen trotzdem', reihe(m, MOND_TEIL) === reihe(m, MOND_KOPF))
}

console.log('\nReiner Weg ohne übergebene Quellen (so ruft build.ts): die Standardquellen laufen')
{
  const m = hauptbestand()
  const { warnungen } = mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m)))
  pruefe('Ohne Warnung', warnungen.length === 0, warnungen)
  pruefe('Ein Ziel im Hauptbestand gilt auch mit den Standardquellen: Sondertitel kommt zum Kopf', reihe(m, MOND_SONDER) === reihe(m, MOND_KOPF), [reihe(m, MOND_SONDER), reihe(m, MOND_KOPF)])
}

console.log('\nRückweg REIHEN_QUELLE=anilist: die Quellen des reinen Wegs werden nicht gelesen')
{
  const m = hauptbestand()
  const gelesen: string[] = []
  const spaeher: ReinQuellen = { beziehungen: () => (gelesen.push('beziehungen'), { kanten: [], namen: new Map() }), katalog: () => (gelesen.push('katalog'), []), hand: () => (gelesen.push('hand'), { verbinden: [], trennen: [] }), kennungen: (titel) => (gelesen.push('kennungen'), new Map(titel.map((t): [number, number] => [t.id, t.id]))) }
  const { warnungen } = mitQuelle('anilist', () => fuehreReihenZusammenQuelle(args(m), spaeher))
  pruefe('Keine Quelle gelesen', gelesen.length === 0, gelesen)
  pruefe('Ohne Katalogkanten bleibt es bei den Reihen des AniList-Wegs: Boonie Bears bleiben allein', reihe(m, BOONIE_1) === BOONIE_1 && reihe(m, BOONIE_2) === BOONIE_2, warnungen)
}

raeumeAuf()
void ordner
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
