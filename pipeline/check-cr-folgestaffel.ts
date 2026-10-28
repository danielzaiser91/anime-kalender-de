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

/** Bau-Lauf im Kindprozess; `nein` legt einen Handbeleg „dub: false“ für Staffel 2 an. */
function prozess(nein: boolean): { url?: string; dub?: boolean; dubRanges?: unknown }[] {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-folgestaffel-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'cr-katalog-de.json'), JSON.stringify({ geholtAm: '2026-09-09T17:26:33.450Z', eintraege: [] }))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-series-ids.json'), JSON.stringify({ adressen: {} }))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const beleg = [{ anilistId: 152677, platform: 'crunchyroll', dub: false, checkedAt: '2026-10-28', url: URL_DT }]
  if (nein) writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), JSON.stringify(beleg))
  const r = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--kind'], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, AK_ROOT: wurzel },
  })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('ERGEBNIS ')).pop()?.slice(9)
  pruefe(`Kindprozess lief bis zum Ende (Handbeleg nein: ${nein})`, r.status === 0 && Boolean(zeile), { status: r.status, err: r.stderr.slice(-400) })
  return zeile ? (JSON.parse(zeile) as { url?: string; dub?: boolean; dubRanges?: unknown }[]) : []
}

function prozessFaelle(): void {
  const wege = prozess(false)
  pruefe('Staffel 2 (152677) bekommt die Serienadresse und dub: true', wege.length === 1 && wege[0]!.url === URL_DT && wege[0]!.dub === true, wege)
  pruefe('Staffel 2: nur Folge 1 deutsch steht als Bereich 1–1', JSON.stringify(wege[0]?.dubRanges) === '[{"from":1,"to":1,"dub":true}]', wege)
  const mitNein = prozess(true)
  pruefe('Staffel 2 mit Handbeleg „nein“ (aus der Datei im Bau gelesen): kein Weg', mitNein.length === 0, mitNein)
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
  const ohneNr = titel(900002, { titleRomaji: 'Foo', format: 'TV' })
  pruefe('Regel: Block „Staffel 1“ trifft keinen Titel „Season 1“ (Nummer ab 2)', gib(block('Staffel 1', 4, 1), [titel(900003, { titleRomaji: 'Foo Season 2' })], [titel(900001, { titleRomaji: 'Foo Season 1' })]) === null)
  pruefe('Regel: TV ohne Staffelnummer im Namen ist kein Kandidat für Staffel 2', gib(eins, [s1()], [s1(), ohneNr]) === null)
  pruefe('Regel: ein OVA „Season 2“ in der Gruppe sperrt die TV-Staffel 2 nicht', gib(eins, [s1(), titel(900004, { titleRomaji: 'Foo Season 2', format: 'OVA' })])?.id === 152677)
  pruefe('Regel: Kandidat ohne Folgenzahl: kein Treffer', gib(eins, [s1()], [s1(), titel(152677, { titleRomaji: 'X Season 2', episodes: undefined })]) === null)

  const lauf = (zusatz: { handNein?: Set<string>; serien?: unknown[]; adresse?: string } = {}) => {
    const t2 = s2()
    const titles = new Map([[128712, s1()], [152677, t2]])
    const nachUrl = new Map([[zusatz.adresse ?? URL_DT, [titles.get(128712)!]]])
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
  const fremdeSprache = 'https://www.crunchyroll.com/de/fr/series/G24H1N334/the-detective-is-already-dead'
  pruefe('Läufer: Adresse des Titels nur über die Serienkennung zuordenbar (Sprachcode fr): trifft', lauf({ adresse: fremdeSprache }).gesetzt.join() === '152677')
  pruefe('Läufer: fremde Kennung trifft nicht', lauf({ adresse: 'https://www.crunchyroll.com/de/series/GXXXXXXXX/anderes' }).gesetzt.length === 0)
  bereicheFaelle(lauf)
}

type Lauf = (zusatz?: { serien?: unknown[] }) => { gesetzt: number[]; t2: ReturnType<typeof s2> }

/** Bereiche der Folgen: Lücke, Nummer 0 und null, doppelte Nummer, vollständig deutsch. */
function bereicheFaelle(lauf: Lauf): void {
  const mit = (deutscheFolgen: { nummer: number | null; laufend: number; guid: string }[], folgen = 13) =>
    lauf({ serien: [serie([block('Staffel 1', 12, 12), block('Staffel 2', folgen, deutscheFolgen.length, deutscheFolgen as never)])] })
  const wege = (l: ReturnType<Lauf>) => JSON.stringify((l.t2.streams[0] as { dubRanges?: unknown }).dubRanges)
  const f = (nummer: number | null, laufend = 1) => ({ nummer, laufend, guid: `G${nummer}x${laufend}` })
  pruefe('Bereiche: 1, 2 und 4 ergeben zwei Bereiche', wege(mit([f(1), f(2, 2), f(4, 4)])) === '[{"from":1,"to":2,"dub":true},{"from":4,"to":4,"dub":true}]', wege(mit([f(1), f(2, 2), f(4, 4)])))
  pruefe('Bereiche: Nummer 0 und fehlende Nummer fallen weg', wege(mit([f(0), f(null, 2), f(1, 3)])) === '[{"from":1,"to":1,"dub":true}]', wege(mit([f(0), f(null, 2), f(1, 3)])))
  pruefe('Bereiche: doppelte Nummer zählt einmal', wege(mit([f(2), f(2, 2), f(3, 3)])) === '[{"from":2,"to":3,"dub":true}]', wege(mit([f(2), f(2, 2), f(3, 3)])))
  pruefe('Bereiche: unsortiert 3, 1, 2 ergibt einen Bereich', wege(mit([f(3), f(1, 2), f(2, 3)])) === '[{"from":1,"to":3,"dub":true}]', wege(mit([f(3), f(1, 2), f(2, 3)])))
  const alle = mit(Array.from({ length: 13 }, (_, i) => f(i + 1, i + 1)))
  pruefe('Bereiche: alle 13 Folgen deutsch: Verweis ohne Bereiche', alle.gesetzt.join() === '152677' && alle.t2.streams[0]!.dubRanges === undefined, alle.t2.streams)
  const nur = mit([f(null)])
  pruefe('Bereiche: nur eine Folge ohne Nummer: Verweis ohne Bereiche', nur.gesetzt.join() === '152677' && nur.t2.streams[0]!.dubRanges === undefined, nur.t2.streams)
}

function nummers(n: number) {
  return nummern(1, n)
}

if (process.argv[2] === '--kind') await kind()
else {
  prozessFaelle()
  direkt()
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
