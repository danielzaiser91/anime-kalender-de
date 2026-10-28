/**
 * Deutscher Block „Staffel N“ (N ≥ 2) einer Crunchyroll-Serie belegt die Folgestaffel, die noch keinen Crunchyroll-Weg hat
 * (`cr-folgestaffel.ts`, verdrahtet in `09-4-crunchyroll-dub.ts`). Anlass 28.10.2026: The Detective Is Already Dead Staffel 2 (AniList 152677)
 * lief seit 14:30 deutsch und stand als „nur Untertitel“ ohne Link. Serie, Blöcke und Titel stammen wörtlich aus `data/crunchyroll-dub.json`
 * (Lauf vom 28.10.2026) und `public/data/titles.json` (Bau c654d8768); nur die Folgenliste von Staffel 1 ist durchgezählt statt abgeschrieben.
 * Die echte Bau-Funktion läuft in einem Kindprozess mit `AK_ROOT` im Wegwerf-Ordner.
 *
 * Aufruf: npx tsx pipeline/check-cr-folgestaffel.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { folgestaffelTitel, ordneFolgestaffelBloeckeZu } from './lib/cr-folgestaffel.ts'

const URL_DT = 'https://www.crunchyroll.com/de/the-detective-is-already-dead'
const nummern = (n: number, ab = 1) => Array.from({ length: n }, (_, i) => ({ nummer: ab + i, laufend: ab + i, guid: `G${ab + i}` }))
const block = (name: string, folgen: number, deutsch: number, deutscheFolgen = nummern(deutsch)) => ({ name, folgen, deutsch, kacheln: folgen, fremd: folgen - deutsch, deutscheFolgen })
const serie = (staffeln: ReturnType<typeof block>[], zusatz = {}) => ({
  url: URL_DT,
  seriesId: 'G24H1N334',
  quelle: 'api',
  katalog: 'de',
  geprueftAm: '2026-10-28',
  deutschImAngebot: true,
  staffeln,
  ...zusatz,
})
const echt = () => serie([block('Staffel 1', 12, 12), block('Staffel 2', 4, 1, [{ nummer: 1, laufend: 1, guid: 'GE00389819DEDE' }])])

const titel = (id: number, zusatz: Record<string, unknown> = {}) => ({
  id,
  format: 'TV',
  episodes: 13,
  franchiseId: 128712,
  streams: [] as Record<string, unknown>[],
  ...zusatz,
})
const s1 = () => titel(128712, { titleRomaji: 'Tantei wa mou, Shindeiru.', titleEn: 'The Detective Is Already Dead', episodes: 12, streams: [{ platform: 'crunchyroll', url: URL_DT, dub: true }] })
const s2 = () => titel(152677, { titleRomaji: 'Tantei wa mou, Shindeiru. Season 2', titleEn: 'The Detective Is Already Dead Season 2' })

async function kind(): Promise<void> {
  const { werteCrunchyrollDubAus } = await import('./bau/09-4-crunchyroll-dub.ts')
  const titles = new Map([s1(), s2()].map((t) => [t.id, t]))
  werteCrunchyrollDubAus({
    crDub: { scrapedAt: '2026-10-28T00:00:00Z', serien: [echt()] } as never,
    titles: titles as never,
    usNeinWiderlegt: () => false,
    verweiseEntfernt: [],
    katalogEintraege: [],
    anisearch: {},
    releases: [],
  })
  console.log('ERGEBNIS ' + JSON.stringify(titles.get(152677)!.streams))
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function prozess(): void {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-folgestaffel-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'cr-katalog-de.json'), JSON.stringify({ geholtAm: '2026-09-09T17:26:33.450Z', eintraege: [] }))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-series-ids.json'), JSON.stringify({ adressen: {} }))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const r = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--kind'], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, AK_ROOT: wurzel },
  })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('ERGEBNIS ')).pop()?.slice(9)
  pruefe('Kindprozess lief bis zum Ende', r.status === 0 && Boolean(zeile), { status: r.status, err: r.stderr.slice(-400) })
  const wege = zeile ? (JSON.parse(zeile) as { url?: string; dub?: boolean; dubRanges?: unknown }[]) : []
  pruefe('Staffel 2 (152677) bekommt die Serienadresse und dub: true', wege.length === 1 && wege[0]!.url === URL_DT && wege[0]!.dub === true, wege)
  pruefe('Staffel 2: nur Folge 1 deutsch steht als Bereich 1–1', JSON.stringify(wege[0]?.dubRanges) === '[{"from":1,"to":1,"dub":true}]', wege)
}

const gib = (b: ReturnType<typeof block>, gruppe = [s1()], alle: ReturnType<typeof titel>[] = [s1(), s2()]) => folgestaffelTitel(b as never, gruppe as never, alle as never)
const eins = block('Staffel 2', 4, 1)

/** Jede Abweisung der Regel und des Läufers einzeln. */
function direkt(): void {
  pruefe('Regel: „Staffel 2“ mit 1 deutscher Folge von 4 trifft Season 2 (13 Folgen)', gib(eins)?.id === 152677)
  pruefe('Regel: „Season 2“ statt „Staffel 2“ trifft ebenso', gib(block('Season 2', 4, 1))?.id === 152677)
  pruefe('Regel: „Staffel 1“ ist keine Folgestaffel', gib(block('Staffel 1', 4, 1)) === null)
  pruefe('Regel: Name mit Zusatz („Foo Staffel 2“) ist kein Standardname', gib(block('Foo Staffel 2', 4, 1)) === null)
  pruefe('Regel: ohne deutsche Folge kein Treffer', gib(block('Staffel 2', 4, 0, [])) === null)
  pruefe('Regel: Block mit mehr Folgen (14) als der Titel (13): kein Treffer', gib(block('Staffel 2', 14, 1)) === null)
  pruefe('Regel: genau so viele Folgen wie der Titel (13): Treffer', gib(block('Staffel 2', 13, 1))?.id === 152677)
  pruefe('Regel: deutsche Folge hinter dem Ende des Titels: kein Treffer', gib(block('Staffel 2', 4, 1, nummers(14))) === null)
  pruefe('Regel: Gruppe trägt Staffel 2 schon: kein Treffer', gib(eins, [s1(), s2()]) === null)
  pruefe('Regel: zwei Kandidaten für Staffel 2: mehrdeutig', gib(eins, [s1()], [s1(), s2(), titel(900001, { titleRomaji: 'Foo Season 2', format: 'TV' })]) === null)
  pruefe('Regel: Kandidat mit eigenem Crunchyroll-Weg bleibt unberührt', gib(eins, [s1()], [s1(), titel(152677, { titleRomaji: 'X Season 2', streams: [{ platform: 'crunchyroll', url: '' }] })]) === null)
  pruefe('Regel: OVA mit Staffelnummer ist kein Kandidat', gib(eins, [s1()], [s1(), titel(152677, { titleRomaji: 'X Season 2', format: 'OVA' })]) === null)
  pruefe('Regel: andere Reihe ist kein Kandidat', gib(eins, [s1()], [s1(), titel(152677, { titleRomaji: 'X Season 2', franchiseId: 5 })]) === null)
  pruefe('Regel: Kandidat ohne Folgenzahl: kein Treffer', gib(eins, [s1()], [s1(), titel(152677, { titleRomaji: 'X Season 2', episodes: undefined })]) === null)

  const lauf = (zusatz: { handNein?: Set<string>; serien?: unknown[] } = {}) => {
    const t2 = s2()
    const titles = new Map([[128712, s1()], [152677, t2]])
    const nachUrl = new Map([[URL_DT, [titles.get(128712)!]]])
    const gesetzt = ordneFolgestaffelBloeckeZu({
      crDub: { scrapedAt: '', serien: zusatz.serien ?? [echt()] } as never,
      nachUrl: nachUrl as never,
      titles: titles as never,
      handNein: zusatz.handNein ?? new Set(),
    })
    return { gesetzt, t2, nachUrl }
  }
  const normal = lauf()
  pruefe('Läufer: setzt 152677 und trägt den Titel in nachUrl ein', normal.gesetzt.join() === '152677' && normal.nachUrl.get(URL_DT)!.length === 2, normal.gesetzt)
  pruefe('Läufer: Handbeleg „nein“ für Titel und Adresse hält zurück', lauf({ handNein: new Set(['152677|crunchyroll']) }).gesetzt.length === 0)
  pruefe('Läufer: US-Katalog zählt nicht', lauf({ serien: [{ ...echt(), katalog: 'us' }] }).gesetzt.length === 0)
  pruefe('Läufer: Serie ohne deutsches Angebot zählt nicht', lauf({ serien: [{ ...echt(), deutschImAngebot: false }] }).gesetzt.length === 0)
  pruefe('Läufer: Serie mit „nichtVerfuegbar“ zählt nicht', lauf({ serien: [{ ...echt(), nichtVerfuegbar: true }] }).gesetzt.length === 0)
  const zwei = lauf({ serien: [echt(), { ...echt(), geprueftAm: '2026-10-01', staffeln: [block('Staffel 1', 12, 12)] }] })
  pruefe('Läufer: gilt der jüngste Abruf je Kennung (der ältere ohne Staffel 2 stört nicht)', zwei.gesetzt.join() === '152677', zwei.gesetzt)
}

function nummers(n: number) {
  return nummern(1, n)
}

if (process.argv[2] === '--kind') await kind()
else {
  prozess()
  direkt()
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
