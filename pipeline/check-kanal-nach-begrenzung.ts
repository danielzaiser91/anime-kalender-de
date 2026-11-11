/**
 * Bezugswege nach der Begrenzung (11.11.2026): Die Runde „ohne jeden Weg“ (`ergaenzeWegeOhneWeg`) sah bei Titeln nur aus aniSearch noch den vom
 * Namen geratenen Crunchyroll-Stream, den `begrenzeWegeAufBelege` danach entfernt: Re:Zero „Bünde aus Eis“ und Attack on Titan: The Last Attack
 * standen ohne den Crunchyroll-Amazon-Kanal da, obwohl JustWatch ihn mit deutschem Ton führt. Hier läuft `schliesseWegeAb` mit Fixture-Titeln
 * und einer Wegwerf-JustWatch-Datei (Kindprozess, `AK_ROOT` vor dem Import).
 *
 * Aufruf: `npx tsx pipeline/check-kanal-nach-begrenzung.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Title } from '../shared/types.ts'

const CR = (id: number) => `https://www.crunchyroll.com/de/series/GTEST${id}/geraten`
const GTI = (id: number) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.kanal-${id}`
const kanal = (id: number) => ({ anbieter: 'Crunchyroll Amazon Channel', art: 'FLATRATE', audio: ['de', 'en', 'ja'], url: GTI(id) })
const disc = (id: number) => ({ anbieter: 'Thalia', art: 'BUY', audio: [], url: `https://www.thalia.de/shop/home/artikeldetails/A${id}` })
const plain = (id: number) => ({ anbieter: 'Crunchyroll', art: 'FLATRATE', audio: [], url: `https://www.crunchyroll.com/watch/GPLAIN${id}` })

/** Ab 10.000.000 stehen aniSearch-Titel: dort entfernt die Begrenzung jeden Stream ohne Handbeleg. */
const ANLASS = 10_000_501
const OHNE_STREAM = 10_000_502
const MEHRDEUTIG = 10_000_503
const TOT = 10_000_504
const HAND_NEIN = 10_000_505
/** Ohne Stream von Anfang an; die Linkprüfung meldet 404, die Bereinigung nimmt den Weg der ersten Runde wieder heraus. */
const LINK_TOT = 10_000_508
/** Hatte einen Stream und bekam in der ersten Runde schon Wege (fünf Angebote, ein Kanal): der zweite Durchgang legt nichts dazu. */
const BEHALTEN = 9_000_506
/** aniSearch-Titel mit Netflix-Stream: nur die Begrenzung entfernt ihn (die Bereinigung lässt ihn stehen), das prüft die Reihenfolge im Abschluss. */
const NUR_BEGRENZUNG = 10_000_511
/** Zwei Staffeln: der Kanal steht unter beiden / nur unter Staffel 2 (Anlass Goblin Slayer 101165, Staffel 1 ohne Angebote). */
const STAFFEL_BEIDE = 10_000_509
const STAFFEL_ANDERE = 10_000_510
/** Eine Staffel, die den Kanal nicht führt, das Gesamtfeld aber schon: ohne Mehrstaffel-Lage gilt das Gesamtfeld. */
const STAFFEL_EINE = 10_000_512
/** Ohne Stream von Anfang an (erste Runde, nicht der zweite Durchgang), zwei Staffeln: der Kanal nur unter Staffel 2 / unter beiden. */
const START_ANDERE = 10_000_513
const START_BEIDE = 10_000_514
/** Die Folgenzahl des Titels (12) passt zu genau einer JustWatch-Staffel: Staffel 1 führt den Kanal, Staffel 2 (24 Folgen) nicht; der Titel ist Staffel 1. */
const PIN_ERSTE = 10_000_515
const PIN_ZWEITE = 10_000_516
/** Folgezeile der Reihe von START_ANDERE und STAFFEL_ANDERE (gleiche Folgenzahl, später): bestimmt, dass jene Titel Staffel 1 sind (Goblin Slayer II). */
const START_ANDERE_FOLGE = 10_000_518
const STAFFEL_ANDERE_FOLGE = 10_000_519
/** Staffel 1 führt den Kanal, Staffel 2 ist eine leere Sonderstaffel mit 3 Folgen: der Kanal bleibt (Naruto, FLCL, Captain Tsubasa; Prüfer 3463). */
const MINI_LEER = 10_000_520
/** Folgenzahl 26 trifft nur Staffel 1 ohne Kanal; der Kanal steht nur unter Staffel 2 mit 23 Folgen: er fällt (Last Exile). */
const LETZTE_STAFFEL = 10_000_521
const LETZTE_FOLGE = 10_000_522

const ANBIETER = ['Alpha Stream', 'Beta Stream', 'Gamma Stream', 'Delta Stream', 'Epsilon Stream']
const fuenf = ANBIETER.map((anbieter, i) => ({ anbieter, art: 'FLATRATE', audio: ['de'], url: `https://www.example-${i}.de/titel/${BEHALTEN}` }))
/** Folgestaffel ohne eigenen JustWatch-Schlüssel (Goblin Slayer II 129188 unter 101165): die Serie steht unter VORGAENGER, der Kanal nur in Staffel 2. */
const VORGAENGER = 10_000_530
const FOLGESTAFFEL = 10_000_531
/** Gleiche Lage, aber die Folgenzahl des Titels (10) trifft Staffel 2 (12) nicht: kein Weg (Shingeki 3). */
const SERIE_FALSCH = 10_000_532
const FOLGE_FALSCH = 10_000_533

const JW = {
  [VORGAENGER]: { jwId: 'ts-folge-a', angebote: [kanal(VORGAENGER), disc(VORGAENGER)], staffeln: [{ nr: 1, folgen: 12, angebote: [] }, { nr: 2, folgen: 12, angebote: [kanal(VORGAENGER)] }] },
  [SERIE_FALSCH]: { jwId: 'ts-folge-b', angebote: [kanal(SERIE_FALSCH)], staffeln: [{ nr: 1, folgen: 25, angebote: [] }, { nr: 2, folgen: 12, angebote: [kanal(SERIE_FALSCH)] }] },
  [ANLASS]: { angebote: [kanal(ANLASS)] },
  [OHNE_STREAM]: { angebote: [kanal(OHNE_STREAM)] },
  [MEHRDEUTIG]: { angebote: [kanal(MEHRDEUTIG)] },
  [TOT]: { angebote: [kanal(TOT)] },
  [LINK_TOT]: { angebote: [kanal(LINK_TOT)] },
  [HAND_NEIN]: { angebote: [plain(HAND_NEIN)] },
  [BEHALTEN]: { angebote: [kanal(BEHALTEN), ...fuenf] },
  [NUR_BEGRENZUNG]: { angebote: [kanal(NUR_BEGRENZUNG)] },
  [STAFFEL_BEIDE]: { angebote: [kanal(STAFFEL_BEIDE)], staffeln: [{ nr: 1, angebote: [kanal(STAFFEL_BEIDE)] }, { nr: 2, angebote: [kanal(STAFFEL_BEIDE)] }] },
  [STAFFEL_EINE]: { angebote: [kanal(STAFFEL_EINE)], staffeln: [{ nr: 1, angebote: [] }] },
  [STAFFEL_ANDERE]: { angebote: [kanal(STAFFEL_ANDERE), disc(STAFFEL_ANDERE)], staffeln: [{ nr: 1, folgen: 12, angebote: [plain(STAFFEL_ANDERE)] }, { nr: 2, folgen: 12, angebote: [kanal(STAFFEL_ANDERE)] }] },
  [START_ANDERE]: { angebote: [kanal(START_ANDERE), disc(START_ANDERE)], staffeln: [{ nr: 1, folgen: 12, angebote: [plain(START_ANDERE)] }, { nr: 2, folgen: 12, angebote: [kanal(START_ANDERE)] }] },
  [MINI_LEER]: { angebote: [kanal(MINI_LEER)], staffeln: [{ nr: 1, folgen: 12, angebote: [kanal(MINI_LEER)] }, { nr: 2, folgen: 3, angebote: [] }] },
  [LETZTE_STAFFEL]: { angebote: [kanal(LETZTE_STAFFEL), disc(LETZTE_STAFFEL)], staffeln: [{ nr: 1, folgen: 26, angebote: [] }, { nr: 2, folgen: 23, angebote: [kanal(LETZTE_STAFFEL)] }] },
  [PIN_ERSTE]: { jwId: 'ts-pin-erste', angebote: [kanal(PIN_ERSTE)], staffeln: [{ nr: 1, folgen: 12, angebote: [kanal(PIN_ERSTE)] }, { nr: 2, folgen: 24, angebote: [] }] },
  [PIN_ZWEITE]: { jwId: 'ts-pin-zweite', angebote: [kanal(PIN_ZWEITE)], staffeln: [{ nr: 1, folgen: 12, angebote: [kanal(PIN_ZWEITE)] }, { nr: 2, folgen: 24, angebote: [] }] },
  [START_BEIDE]: { angebote: [kanal(START_BEIDE)], staffeln: [{ nr: 1, angebote: [kanal(START_BEIDE)] }, { nr: 2, angebote: [kanal(START_BEIDE)] }] },
}

type Zeile = [number, string[], string[]]

/** Kindprozess: die Bau-Module werden erst nach dem Setzen von `AK_ROOT` geladen. */
async function kind(): Promise<void> {
  const { schliesseWegeAb } = await import('./bau/11-wege-abschluss.ts')
  const titel = (id: number, streams: { platform: string; url: string }[]) => ({ id, streams, keywords: [], genres: [] }) as unknown as Title
  const geraten = (id: number) => [{ platform: 'crunchyroll', url: CR(id) }]
  const titles = new Map<number, Title>([
    [ANLASS, titel(ANLASS, geraten(ANLASS))],
    [OHNE_STREAM, titel(OHNE_STREAM, [])],
    [MEHRDEUTIG, titel(MEHRDEUTIG, geraten(MEHRDEUTIG))],
    [TOT, titel(TOT, geraten(TOT))],
    [LINK_TOT, titel(LINK_TOT, [])],
    [NUR_BEGRENZUNG, { ...titel(NUR_BEGRENZUNG, [{ platform: 'netflix', url: 'https://www.netflix.com/title/81000011' }]), jpYear: 2020 }],
    [STAFFEL_BEIDE, titel(STAFFEL_BEIDE, geraten(STAFFEL_BEIDE))],
    [STAFFEL_ANDERE, { ...titel(STAFFEL_ANDERE, geraten(STAFFEL_ANDERE)), format: 'TV', titleEn: 'Fixture Serie', episodes: 12, franchiseId: 9102, jpYear: 2018 } as Title],
    [STAFFEL_ANDERE_FOLGE, { ...titel(STAFFEL_ANDERE_FOLGE, []), format: 'TV', titleEn: 'Fixture Serie', episodes: 12, franchiseId: 9102, jpYear: 2023 } as Title],
    [STAFFEL_EINE, titel(STAFFEL_EINE, geraten(STAFFEL_EINE))],
    [START_ANDERE, { ...titel(START_ANDERE, []), format: 'TV', titleEn: 'Fixture Serie', episodes: 12, franchiseId: 9101, jpYear: 2018 } as Title],
    [START_ANDERE_FOLGE, { ...titel(START_ANDERE_FOLGE, []), format: 'TV', titleEn: 'Fixture Serie', episodes: 12, franchiseId: 9101, jpYear: 2023 } as Title],
    [MINI_LEER, { ...titel(MINI_LEER, []), episodes: 12 } as Title],
    [LETZTE_STAFFEL, { ...titel(LETZTE_STAFFEL, []), format: 'TV', titleEn: 'Fixture Serie', episodes: 26, franchiseId: 9103, jpYear: 2003 } as Title],
    [LETZTE_FOLGE, { ...titel(LETZTE_FOLGE, []), format: 'TV', titleEn: 'Fixture Serie', episodes: 23, franchiseId: 9103, jpYear: 2008 } as Title],
    [START_BEIDE, titel(START_BEIDE, [])],
    [VORGAENGER, { ...titel(VORGAENGER, []), format: 'TV', titleEn: 'Fixture Folge', episodes: 12, franchiseId: 9105, jpYear: 2018 } as Title],
    [FOLGESTAFFEL, { ...titel(FOLGESTAFFEL, []), format: 'TV', titleEn: 'Fixture Folge', episodes: 12, franchiseId: 9105, jpYear: 2023 } as Title],
    [SERIE_FALSCH, { ...titel(SERIE_FALSCH, []), format: 'TV', titleEn: 'Fixture Falsch', episodes: 25, franchiseId: 9106, jpYear: 2013 } as Title],
    [FOLGE_FALSCH, { ...titel(FOLGE_FALSCH, []), format: 'TV', titleEn: 'Fixture Falsch', episodes: 10, franchiseId: 9106, jpYear: 2018 } as Title],
    [PIN_ERSTE, { ...titel(PIN_ERSTE, []), episodes: 12 } as Title],
    [PIN_ZWEITE, { ...titel(PIN_ZWEITE, geraten(PIN_ZWEITE)), episodes: 12 } as Title],
    [HAND_NEIN, titel(HAND_NEIN, geraten(HAND_NEIN))],
    [BEHALTEN, titel(BEHALTEN, [{ platform: 'netflix', url: 'https://www.netflix.com/title/81000000' }])],
  ])
  const alleChecks = [{ anilistId: HAND_NEIN, platform: 'crunchyroll', dub: false }]
  const abschluss = (): void =>
    schliesseWegeAb({
      titles,
      anisearch: {},
      releases: [],
      zugangJeAdresse: new Map(),
      tmdbMehrdeutig: new Set([String(MEHRDEUTIG)]),
      toteAdressen: new Set(),
      linkBefunde: { [GTI(LINK_TOT)]: { status: 404 } },
      verweiseEntfernt: [],
      crAdresseZu: () => undefined,
      beantworteteSuchen: new Set(),
      suchOffen: [],
      alleChecks: alleChecks as never,
      lautPruefungTot: (url: string) => url === GTI(TOT),
      checksJePlattform: new Map(),
      belegFuer: () => undefined,
    })
  const zeilen = (): Zeile[] =>
    [...titles.values()].map((t) => [t.id, (t.streams ?? []).map((s) => s.platform), (t.watchLinks ?? []).map((w) => `${w.name}|${w.kind}`)])
  abschluss()
  const erster = zeilen()
  abschluss()
  console.log(JSON.stringify({ erster, zweiter: zeilen() }))
}

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

if (process.argv[2] === '--kind') {
  await kind()
} else {
  console.log('\nBezugswege nach der Begrenzung (Wege-Abschluss mit Wegwerf-JustWatch-Datei):')
  const wurzel = mkdtempSync(join(tmpdir(), 'kanal-nach-begrenzung-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(JW))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  writeFileSync(join(wurzel, 'data', 'shop-wege-falsches-ziel.yaml'), '[]\n')
  const skript = fileURLToPath(import.meta.url)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, '--kind'], { encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, AK_ROOT: wurzel } })
  rmSync(wurzel, { recursive: true, force: true })
  const json = r.stdout.split('\n').filter((z) => z.startsWith('{')).pop()
  const erg = json ? (JSON.parse(json) as { erster: Zeile[]; zweiter: Zeile[] }) : undefined
  pruefe('Kindprozess lief bis zum Ende', r.status === 0 && Boolean(erg), { status: r.status, err: r.stderr.slice(-600) })
  const von = (id: number) => erg?.erster.find(([i]) => i === id)
  const wege = (id: number) => JSON.stringify(von(id)?.[2])
  const kanalWeg = '["Crunchyroll Amazon Channel|stream"]'
  pruefe('geratener Stream fällt, danach kommt der Kanal-Weg (Anlassfall Re:Zero „Bünde aus Eis“)', wege(ANLASS) === kanalWeg && von(ANLASS)?.[1].length === 0, erg)
  pruefe('Titel ohne Stream von Anfang an: derselbe Weg, genau einmal (erste Runde)', wege(OHNE_STREAM) === kanalWeg, erg)
  pruefe('mehrdeutige TMDB-Zuordnung: kein Weg', wege(MEHRDEUTIG) === '[]', erg)
  pruefe('tote Adresse: kein Weg', wege(TOT) === '[]', erg)
  pruefe('Stream fällt erst durch die Begrenzung (nicht durch die Bereinigung): der Kanal-Weg kommt danach (Reihenfolge im Abschluss)', wege(NUR_BEGRENZUNG) === kanalWeg && von(NUR_BEGRENZUNG)?.[1].length === 0, erg)
  pruefe('zwei Staffeln, Kanal unter beiden: Weg bleibt', wege(STAFFEL_BEIDE) === kanalWeg, erg)
  pruefe('eine Staffel ohne den Kanal, Gesamtfeld mit: Weg bleibt (kein Mehrstaffel-Fall)', wege(STAFFEL_EINE) === kanalWeg, erg)
  pruefe('zwei Staffeln, Kanal nur unter Staffel 2 (Goblin Slayer, Staffel 1): nur der Disc-Händler (Kauf), kein Kanal', wege(STAFFEL_ANDERE) === '["Thalia|buy"]', erg)
  pruefe('Titel ohne Stream, dessen Weg die Linkprüfung entfernt hat: der zweite Durchgang bringt ihn nicht zurück', wege(LINK_TOT) === '[]', erg)
  pruefe('Nein-Handbeleg für Crunchyroll: kein Weg', wege(HAND_NEIN) === '[]', erg)
  const alle = ANBIETER.map((a) => `${a}|stream`)
  pruefe('Titel, dessen erste Runde schon Wege lieferte: der zweite Durchgang legt nichts dazu (kein Kanal)', wege(BEHALTEN) === JSON.stringify(alle), erg)
  pruefe('ohne Stream von Anfang an, zwei Staffeln, Kanal nur unter Staffel 2: erste Runde legt nur den Disc-Händler an (Staffelbezug)', wege(START_ANDERE) === '["Thalia|buy"]', erg)
  pruefe('ohne Stream von Anfang an, Kanal unter beiden Staffeln: Weg bleibt', wege(START_BEIDE) === kanalWeg, erg)
  pruefe('Folgenzahl des Titels passt nur zu Staffel 1, die den Kanal führt: Weg bleibt (erste Runde, Staffel des Titels)', wege(PIN_ERSTE) === kanalWeg, erg)
  pruefe('dasselbe nach der Begrenzung (zweiter Durchgang)', wege(PIN_ZWEITE) === kanalWeg, erg)
  pruefe('leere Sonderstaffel (3 Folgen) widerlegt den Kanal nicht: Weg bleibt (erste Runde)', wege(MINI_LEER) === kanalWeg, erg)
  pruefe('Folgenzahl trifft nur Staffel 1 ohne den Kanal (Last Exile): nur der Disc-Händler', wege(LETZTE_STAFFEL) === '["Thalia|buy"]', erg)
  pruefe('Folgestaffel ohne eigenen Schlüssel (Goblin Slayer II): der Kanal aus Staffel 2 der Serie, Staffel 1 der Reihe bleibt ohne', wege(FOLGESTAFFEL) === kanalWeg && wege(VORGAENGER) === '["Thalia|buy"]', erg)
  pruefe('Folgenzahl trifft die Staffel der Nummer nicht (Shingeki 3): kein Weg', wege(FOLGE_FALSCH) === '[]', erg)
  pruefe('zweiter Abschluss-Lauf ändert nichts', JSON.stringify(erg?.zweiter) === JSON.stringify(erg?.erster), erg)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
