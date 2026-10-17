/**
 * Zusicherung: Der Namensvorspann gilt auch im reinen aniSearch-Reihenweg (`REIHEN_QUELLE=anisearch`, Standard seit 12.10.2026) — durch `fuehreReihenZusammenQuelle`, wie `build.ts` ruft.
 * Die Fälle sind die fünf, die im Bestandsbau vom 17.10.2026 übrig blieben (Boonie Bears, Hello Kitty, Carnival Phantasm; Issue #1414), mit erfundenen Kennungen ab 900000.
 * Ziel der Regel darf ein Katalogtitel sein, denn `titles.json` steht beim Katalog-Schritt schon. Die Regel selbst: `check-reihen-namen.ts`; der Bestand: `check-reihen-namen-bestand.ts`.
 */
import { ordner, raeumeAuf } from './lib/pruefliste-umleiten.ts'
import type { KatalogEintrag } from './lib/anilist.ts'
import type { Title } from '../shared/types.ts'
import { ANISEARCH_ID_BASIS } from './bau/anisearch-titel.ts'
import { type ReinQuellen, STANDARD_QUELLEN, fuehreReihenZusammenQuelle, ladeHand, reineKatalogReihen } from './bau/anisearch-reihen-rein-bau.ts'
import { katalogAnker, ladeBeziehungen } from './bau/anisearch-reihen-pruefliste.ts'
import { ladeKatalogEintraege } from './lib/katalog-eingefroren.ts'
import { anisearchKennungen } from './bau/anisearch-kennung.ts'
import { katalogNamen, ladeAnisearchTitel } from './bau/katalog-namen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const B = ANISEARCH_ID_BASIS
const zeile = (n: number, titleEn: string, extra: Partial<Title> = {}) => ({ id: B + n, titleEn, streams: [], ...extra }) as unknown as Title
const eintrag = (id: number, romaji: string, rel: number[] = [], englisch: string | null = null, extra: Partial<KatalogEintrag> = {}) => ({ id, t: [romaji, englisch, null], format: 'TV', jahr: 2000, folgen: 12, rel, eltern: [], ...extra }) as unknown as KatalogEintrag

// Hauptbestand: Boonie Bears (zwei Alleinstehende, Ziel im Katalog), Hello Kitty (zwei), Carnival Phantasm (eins, Ziel allein im Katalog), Gegenprobe, Mondlicht (Ziel im Hauptbestand)
const BOONIE_ANKER = B + 900_010
const [BOONIE_1, BOONIE_2, KITTY_1, KITTY_2, CARNIVAL, GLEICH, MOND_KOPF, MOND_TEIL, MOND_SONDER] = [B + 900_011, B + 900_012, B + 900_021, B + 900_022, B + 900_031, B + 900_041, B + 900_051, B + 900_053, B + 900_054]
const [K_BOONIE, K_KITTY, K_KITTY_2, K_CARNIVAL, K_GLEICH_1, K_GLEICH_1B, K_GLEICH_2, K_GLEICH_2B, K_ZETA, K_STERN] = [900_101, 900_102, 900_103, 900_104, 900_105, 900_106, 900_107, 900_108, 900_109, 900_110]
// Zeta: der Katalogtitel hängt über eine aniSearch-Beziehung am Anker (Kennung 900072 ↔ 900071); Stern: der Anker steht schon in einer Reihe (Teil → Kopf)
const [ZETA_ANKER, ZETA_NEU, STERN_KOPF, STERN_TEIL, STERN_NEU] = [B + 900_071, B + 900_073, B + 900_061, B + 900_062, B + 900_063]
// Ziele, deren Name nur in `ohne-synchro.json` steht (`katalogNamen`): AniList-`latein` (Hello Jadoo, Bestand 17.10.2026), aniSearch-Englisch, -Synonym, belegter deutscher Titel; Nebel: unbelegter Titel zählt nicht
const [JADOO, PIXEL, LOTUS, DRACHE, FLUSS, NEBEL] = [B + 900_081, B + 900_082, B + 900_083, B + 900_084, B + 900_086, B + 900_085]
const [K_JADOO, K_PIXEL, K_LOTUS, K_DRACHE, K_NEBEL, K_FLUSS] = [900_111, 900_112, 900_113, 900_114, 900_115, 900_116]
// Sternenfahrt: der deutsche Name kommt aus den Synonymen und dem deutschen Namen des Reihenkopfs; „Sternenfahrt“ allein nennt zwei Reihen
const [SF_KOPF, SF_FILM, SF_SERIE] = [B + 900_091, B + 900_093, B + 900_094]
const [K_SF, K_SF2, K_SFX1, K_SFX2] = [900_117, 900_118, 900_119, 900_120]
// Wolke: ein AniList-Titel des Hauptbestands steht auch im Katalog (unter anderem Namen); als Ziel gilt sein Name im Hauptbestand
const [WOLKE, WOLKE_NEU] = [900_130, B + 900_131]

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
      zeile(900_081, 'Hello Jadoo: The Little Mermaid'),
      zeile(900_082, 'Pixel Planet: Der Film'),
      zeile(900_083, 'Tales of the Lotus: Special'),
      zeile(900_084, 'Drachenwald: Rückkehr'),
      zeile(900_085, 'Nebelland: Spezial'),
      zeile(900_086, 'Flusstal: Finale'),
      zeile(900_091, 'Star Voyage', { titleDe: 'Sternenfahrt' }),
      zeile(900_093, 'Sternenfahrt: Der Film - Bonus'),
      zeile(900_094, 'Sternenfahrt: Die Serie - Extra'),
      { id: WOLKE, titleEn: 'Wolkenreich', streams: [] } as unknown as Title,
      zeile(900_131, 'Wolkenreich: Special'),
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
  eintrag(K_SFX1, 'Sternenfahrt', [K_SFX2]),
  eintrag(K_JADOO, 'Annyeong Jaduya', [], null, { latein: 'Hello Jadoo' }),
  eintrag(K_PIXEL, 'Pikuseru Wakusei'),
  eintrag(K_SF, 'Hoshi Tabi Gekijouban'),
  eintrag(K_LOTUS, 'Renge Monogatari'),
  eintrag(K_DRACHE, 'Ryuu no Mori'),
  eintrag(K_SF2, 'Hoshi Tabi Series', [], null, { synonyme: ['Sternenfahrt: Die Serie'] }),
  eintrag(K_NEBEL, 'Kiri no Kuni'),
  eintrag(WOLKE, 'Kumo no Kuni'),
  eintrag(K_FLUSS, 'Kawa no Tani'),
  eintrag(K_SFX2, 'Sternenfahrt Zwei', [K_SFX1]),
  eintrag(K_CARNIVAL, 'Carnival Phantasm'),
  eintrag(K_GLEICH_2, 'Gleichlauf', [K_GLEICH_2B]),
  eintrag(K_GLEICH_2B, 'Gleichlauf Drei', [K_GLEICH_2]),
]
const quellen = (eintraege: KatalogEintrag[] = katalog()): ReinQuellen => ({
  beziehungen: () => ({ kanten: [{ a: 900_071, b: 900_072, art: 'Sequel' }, { a: 900_061, b: 900_062, art: 'Sequel' }, { a: 900_062, b: 900_074, art: 'Sequel' }, { a: 900_091, b: 900_097, art: 'Sequel' }, { a: 900_091, b: 900_098, art: 'Sequel' }], namen: new Map() }),
  katalog: () => eintraege,
  hand: () => ({ verbinden: [[K_BOONIE, BOONIE_ANKER], [MOND_KOPF, MOND_TEIL]], trennen: [] }),
  kennungen: (titel) => new Map(titel.flatMap((t): [number, number][] => (t.id >= B ? [[t.id, t.id - B]] : KATALOG_KENNUNG.has(t.id) ? [[t.id, KATALOG_KENNUNG.get(t.id)!]] : []))),
  anisearchTitel: () => ({
    [K_PIXEL]: { englisch: 'Pixel Planet' },
    [K_LOTUS]: { synonyme: ['Sakura', 'Tales of the Lotus'] },
    [K_DRACHE]: { titel: 'Drachenwald', quelle: 'sprachblock' },
    [K_SF]: { synonyme: ['Hoshi Tabi Movie', 'Sternenfahrt: Der Film'] },
    [K_NEBEL]: { titel: 'Nebelland', quelle: 'ueberschrift' },
    [K_FLUSS]: { titel: 'Flusstal', quelle: 'synonym' },
  }),
})
const KATALOG_KENNUNG = new Map([[K_ZETA, 900_072], [K_STERN, 900_074], [K_SF, 900_097], [K_SF2, 900_098]])
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
  pruefe('Hello Jadoo: Ziel nur über AniList-`latein` benannt', reihe(m, JADOO) === K_JADOO, reihe(m, JADOO))
  pruefe('Ziel nur über aniSearch-Englisch benannt', reihe(m, PIXEL) === K_PIXEL, reihe(m, PIXEL))
  pruefe('Ziel nur über ein englisches aniSearch-Synonym benannt', reihe(m, LOTUS) === K_LOTUS, reihe(m, LOTUS))
  pruefe('Ziel nur über einen deutschen Titel aus dem Sprachblock benannt', reihe(m, DRACHE) === K_DRACHE, reihe(m, DRACHE))
  pruefe('Ziel nur über einen deutschen Titel aus den aniSearch-Synonymen (`quelle: synonym`) benannt', reihe(m, FLUSS) === K_FLUSS, reihe(m, FLUSS))
  pruefe('Eine Überschrift unbekannter Sprache benennt kein Ziel', reihe(m, NEBEL) === NEBEL, reihe(m, NEBEL))
  pruefe('Deutscher Name aus aniSearch-Synonymen und dem deutschen Namen des Reihenkopfs', reihe(m, SF_FILM) === SF_KOPF, reihe(m, SF_FILM))
  pruefe('Deutscher Name aus AniList-Synonymen und dem deutschen Namen des Reihenkopfs', reihe(m, SF_SERIE) === SF_KOPF, reihe(m, SF_SERIE))
  pruefe('Steht ein Titel im Hauptbestand und im Katalog, gilt sein Name im Hauptbestand', reihe(m, WOLKE_NEU) === WOLKE, reihe(m, WOLKE_NEU))

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

const wirft = (grund: string) => (): never => {
  throw new Error(grund)
}
for (const [teil, kaputt] of [
  ['Katalog', { katalog: wirft('Katalog kaputt') }],
  ['Kennungen der Vorschau', { kennungen: wirft('Katalog kaputt') }],
  ['aniSearch-Titel', { anisearchTitel: wirft('Katalog kaputt') }],
] as const) {
  console.log(`\nReiner Weg, ${teil} nicht lesbar: Warnung, die Reihen und die Ziele im Hauptbestand bleiben`)
  const m = hauptbestand()
  const { warnungen } = mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m), { ...quellen(), ...kaputt }))
  pruefe('Der Bau läuft weiter und warnt mit dem Grund', warnungen.length === 1 && warnungen[0]!.includes('Katalog kaputt'), warnungen)
  pruefe('Die Reihen aus aniSearch stehen trotzdem', reihe(m, MOND_TEIL) === reihe(m, MOND_KOPF))
  pruefe('Ein Ziel im Hauptbestand gilt weiter: Sondertitel kommt zum Kopf', reihe(m, MOND_SONDER) === reihe(m, MOND_KOPF), reihe(m, MOND_SONDER))
  pruefe('Ziele nur im Katalog entfallen', reihe(m, BOONIE_1) === BOONIE_1 && reihe(m, JADOO) === JADOO, [reihe(m, BOONIE_1), reihe(m, JADOO)])
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
  const spaeher: ReinQuellen = { beziehungen: () => (gelesen.push('beziehungen'), { kanten: [], namen: new Map() }), katalog: () => (gelesen.push('katalog'), []), hand: () => (gelesen.push('hand'), { verbinden: [], trennen: [] }), kennungen: (titel) => (gelesen.push('kennungen'), new Map(titel.map((t): [number, number] => [t.id, t.id]))), anisearchTitel: () => (gelesen.push('anisearchTitel'), {}) }
  const { warnungen } = mitQuelle('anilist', () => fuehreReihenZusammenQuelle(args(m), spaeher))
  pruefe('Keine Quelle gelesen', gelesen.length === 0, gelesen)
  pruefe('Ohne Katalogkanten bleibt es bei den Reihen des AniList-Wegs: Boonie Bears bleiben allein', reihe(m, BOONIE_1) === BOONIE_1 && reihe(m, BOONIE_2) === BOONIE_2, warnungen)
}

console.log('\nNamen eines Katalogtitels: ein deutscher Titel, der nur den englischen oder Romaji-Namen wiederholt, entfällt')
{
  const belegt = (titel: string) => ({ titel, quelle: 'sprachblock' })
  pruefe('gleich dem englischen', katalogNamen(eintrag(1, 'Romaji', [], 'English'), belegt('English'), undefined).titleDe === undefined)
  pruefe('gleich dem Romaji-Namen', katalogNamen(eintrag(1, 'Romaji', [], 'English'), belegt('Romaji'), undefined).titleDe === undefined)
  pruefe('ein neuer Name bleibt', katalogNamen(eintrag(1, 'Romaji', [], 'English'), belegt('Deutsch'), undefined).titleDe === 'Deutsch')
}

console.log('\nStandardquellen sind die echten Ladefunktionen (in CI ist `data/cache` leer, ein Datentest griffe dort nicht)')
{
  pruefe('katalog: ladeKatalogEintraege', STANDARD_QUELLEN.katalog === ladeKatalogEintraege)
  pruefe('beziehungen: ladeBeziehungen', STANDARD_QUELLEN.beziehungen === ladeBeziehungen)
  pruefe('kennungen: anisearchKennungen', STANDARD_QUELLEN.kennungen === anisearchKennungen)
  pruefe('anisearchTitel: ladeAnisearchTitel', STANDARD_QUELLEN.anisearchTitel === ladeAnisearchTitel)
  const hand = ladeHand()
  pruefe('hand: liefert ladeHand() (Handdatei nicht leer)', hand.verbinden.length > 0 && JSON.stringify(STANDARD_QUELLEN.hand()) === JSON.stringify(hand))
}

console.log('\nOhne übergebene Quellen gelten genau die Standardquellen (auch ihr Katalog)')
{
  const echt = { ...STANDARD_QUELLEN }
  Object.assign(STANDARD_QUELLEN, quellen())
  const m = hauptbestand()
  try {
    mitQuelle(undefined, () => fuehreReihenZusammenQuelle(args(m)))
  } finally {
    Object.assign(STANDARD_QUELLEN, echt)
  }
  pruefe('Ziel nur im Katalog der Standardquellen: Boonie Bears kommen zum Anker', reihe(m, BOONIE_1) === BOONIE_ANKER && reihe(m, JADOO) === K_JADOO, [reihe(m, BOONIE_1), reihe(m, JADOO)])
}

raeumeAuf()
void ordner
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
