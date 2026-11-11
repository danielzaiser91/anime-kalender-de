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

const ANBIETER = ['Alpha Stream', 'Beta Stream', 'Gamma Stream', 'Delta Stream', 'Epsilon Stream']
const fuenf = ANBIETER.map((anbieter, i) => ({ anbieter, art: 'FLATRATE', audio: ['de'], url: `https://www.example-${i}.de/titel/${BEHALTEN}` }))

const JW = {
  [ANLASS]: { angebote: [kanal(ANLASS)] },
  [OHNE_STREAM]: { angebote: [kanal(OHNE_STREAM)] },
  [MEHRDEUTIG]: { angebote: [kanal(MEHRDEUTIG)] },
  [TOT]: { angebote: [kanal(TOT)] },
  [LINK_TOT]: { angebote: [kanal(LINK_TOT)] },
  [HAND_NEIN]: { angebote: [plain(HAND_NEIN)] },
  [BEHALTEN]: { angebote: [kanal(BEHALTEN), ...fuenf] },
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
  pruefe('Titel ohne Stream, dessen Weg die Linkprüfung entfernt hat: der zweite Durchgang bringt ihn nicht zurück', wege(LINK_TOT) === '[]', erg)
  pruefe('Nein-Handbeleg für Crunchyroll: kein Weg', wege(HAND_NEIN) === '[]', erg)
  const alle = ANBIETER.map((a) => `${a}|stream`)
  pruefe('Titel, dessen erste Runde schon Wege lieferte: der zweite Durchgang legt nichts dazu (kein Kanal)', wege(BEHALTEN) === JSON.stringify(alle), erg)
  pruefe('zweiter Abschluss-Lauf ändert nichts', JSON.stringify(erg?.zweiter) === JSON.stringify(erg?.erster), erg)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
