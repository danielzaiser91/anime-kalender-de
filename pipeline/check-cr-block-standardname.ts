/**
 * Ein deutscher Block, der nur „Season N“ heißt, trägt das Ja des einen TV-Titels mit dieser Staffelnummer (`cr-block-standardname.ts`, verdrahtet in
 * `09-4-crunchyroll-dub.ts`). Anlass 27.10.2026: Tonikaku Kawaii (AniList 116267) verlor `dub: true`, als der Prüflauf vom 26.10. den Block von
 * „TONIKAWA: Over The Moon For You“ in „Season 1“ umbenannte. Blöcke, Titelnamen, Formate und Folgenzahlen stammen wörtlich aus
 * `data/crunchyroll-dub.json` (Lauf vom 26.10.2026, 05:26 UTC) und `public/data/titles.json`. Die echte Bau-Funktion läuft in einem Kindprozess
 * mit `AK_ROOT` im Wegwerf-Ordner.
 *
 * Aufruf: npx tsx pipeline/check-cr-block-standardname.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { frischesteSerieJeKennung, ordneStandardnamenBloeckeZu, titelFuerStandardnameBlock } from './lib/cr-block-standardname.ts'

const ALT = 'https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you'
const NEU = 'https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you'
const ZWEI_TV = 'https://www.crunchyroll.com/de/series/GFSTAN0001/zwei-tv'
const OHNE_DEUTSCH = 'https://www.crunchyroll.com/de/series/GFSTAN0002/ohne-deutsch'
const ZU_LANG = 'https://www.crunchyroll.com/de/series/GFSTAN0003/zu-lang'
const GENAU = 'https://www.crunchyroll.com/de/series/GFSTAN0004/genau-zwei-mehr'

const nummern = (n: number, ab = 1) => Array.from({ length: n }, (_, i) => ({ nummer: ab + i, laufend: ab + i }))
const block = (name: string, folgen: number, deutsch: number, deutscheFolgen = nummern(deutsch)) => ({ name, folgen, deutsch, kacheln: folgen, deutscheFolgen })
const serie = (url: string, seriesId: string, geprueftAm: string, staffeln: ReturnType<typeof block>[]) => ({
  url,
  seriesId,
  katalog: 'de',
  quelle: 'api',
  geprueftAm,
  deutschImAngebot: true,
  staffeln,
})
const tonikawaFolgen = [...nummern(12), { nummer: null as number | null, laufend: 14 }]
const staffel2 = [{ nummer: 1, laufend: 1 }, ...nummern(12, 1).map((f) => ({ nummer: f.nummer, laufend: f.laufend + 1 }))]
const hsd = block('~High School Days~', 4, 4)

function crDub(neuerName: boolean) {
  return {
    scrapedAt: '2026-10-26T05:26:50.652Z',
    serien: [
      serie(NEU, 'GRWMGGQ86', '2026-10-26', [
        block(neuerName ? 'Season 1' : 'TONIKAWA: Over The Moon For You', 14, 13, tonikawaFolgen as never),
        block('TONIKAWA: Over The Moon For You Staffel 2', 12, 12, staffel2 as never),
        hsd,
      ]),
      serie(ALT, 'GRWMGGQ86', '2026-09-21', [
        block('TONIKAWA: Over The Moon For You', 14, 13, tonikawaFolgen as never),
        block('TONIKAWA: Over The Moon For You Staffel 2', 13, 13),
        block('TONIKAWA: Over The Moon For You  ~High School Days~', 4, 4),
      ]),
      serie(ZWEI_TV, 'GFSTAN0001', '2026-10-26', [block('Season 1', 12, 11), block('Extra', 3, 3)]),
      serie(OHNE_DEUTSCH, 'GFSTAN0002', '2026-10-26', [block('Season 1', 12, 0, []), block('Season 3', 12, 11)]),
      serie(ZU_LANG, 'GFSTAN0003', '2026-10-26', [block('Season 1', 15, 14), block('Extra', 3, 3)]),
      serie(GENAU, 'GFSTAN0004', '2026-10-26', [block('Season 1', 14, 13), block('Extra', 3, 3)]),
    ],
  }
}

type Fake = { id: number; format: string; episodes: number; titleRomaji: string; titleEn?: string; url: string }
const FAKES: Fake[] = [
  { id: 116267, format: 'TV', episodes: 12, titleRomaji: 'Tonikaku Kawaii', titleEn: 'TONIKAWA: Over The Moon For You', url: ALT },
  { id: 127371, format: 'OVA', episodes: 1, titleRomaji: 'Tonikaku Kawaii: SNS', titleEn: 'TONIKAWA: Over The Moon For You ~SNS~', url: ALT },
  { id: 141208, format: 'TV', episodes: 12, titleRomaji: 'Tonikaku Kawaii Season 2', titleEn: 'TONIKAWA: Over The Moon For You Season 2', url: NEU },
  { id: 141212, format: 'SPECIAL', episodes: 1, titleRomaji: 'Tonikaku Kawaii: Seifuku', titleEn: 'TONIKAWA: Over The Moon For You ~Uniform~', url: NEU },
  { id: 166104, format: 'ONA', episodes: 4, titleRomaji: 'Tonikaku Kawaii: Joshikou-hen', titleEn: 'TONIKAWA: Over The Moon For You ~High School Days~', url: NEU },
  { id: 900001, format: 'TV', episodes: 12, titleRomaji: 'Erste Serie', url: ZWEI_TV },
  { id: 900002, format: 'TV', episodes: 12, titleRomaji: 'Zweite Serie', url: ZWEI_TV },
  { id: 900003, format: 'TV', episodes: 12, titleRomaji: 'Ohne Deutsch', url: OHNE_DEUTSCH },
  { id: 900004, format: 'TV', episodes: 12, titleRomaji: 'Zu lang', url: ZU_LANG },
  { id: 900005, format: 'TV', episodes: 12, titleRomaji: 'Genau zwei mehr', url: GENAU },
  { id: 900013, format: 'TV', episodes: 12, titleRomaji: 'Nebentitel drei Season 2', url: OHNE_DEUTSCH },
  { id: 900014, format: 'TV', episodes: 12, titleRomaji: 'Nebentitel vier Season 2', url: ZU_LANG },
  { id: 900015, format: 'TV', episodes: 12, titleRomaji: 'Nebentitel fuenf Season 2', url: GENAU },
]

/** Der Kindprozess: AK_ROOT ist gesetzt, bevor die Bau-Module geladen werden. */
async function kind(neuerName: boolean): Promise<void> {
  const { werteCrunchyrollDubAus } = await import('./bau/09-4-crunchyroll-dub.ts')
  const titles = new Map(FAKES.map((f) => [f.id, { ...f, streams: [{ platform: 'crunchyroll', url: f.url }] }]))
  werteCrunchyrollDubAus({
    crDub: crDub(neuerName) as never,
    titles: titles as never,
    usNeinWiderlegt: () => false,
    verweiseEntfernt: [],
    katalogEintraege: [],
    anisearch: {},
    releases: [],
  })
  console.log('ERGEBNIS ' + JSON.stringify([...titles.values()].map((t) => [t.id, (t.streams[0] as { dub?: boolean }).dub ?? null])))
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function lauf(neuerName: boolean): [number, boolean | null][] | undefined {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-block-standardname-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'cr-katalog-de.json'), JSON.stringify({ geholtAm: '2026-09-09T17:26:33.450Z', eintraege: [] }))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-series-ids.json'), JSON.stringify({ adressen: {} }))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const skript = fileURLToPath(import.meta.url)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, neuerName ? '--kind-neu' : '--kind-alt'], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, AK_ROOT: wurzel },
  })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('ERGEBNIS ')).pop()?.slice(9)
  pruefe(`Kindprozess (${neuerName ? 'Season 1' : 'alter Name'}) lief`, r.status === 0 && Boolean(zeile), { status: r.status, err: r.stderr.slice(-400) })
  return zeile ? (JSON.parse(zeile) as [number, boolean | null][]) : undefined
}

/** Die reine Regel und der Läufer ohne Kindprozess: jede Abweisung einzeln. */
function direkt(): void {
  const tv = { id: 1, format: 'TV', episodes: 12, streams: [] } as never
  const gib = (b: ReturnType<typeof block>) => titelFuerStandardnameBlock(b as never, [tv])
  pruefe('Regel: 12 von 12 deutsch, Block „Season 1“ mit 12 Folgen passt', gib(block('Season 1', 12, 12)) !== null)
  pruefe('Regel: Block mit 11 Folgen für einen Titel mit 12: kein Treffer', gib(block('Season 1', 11, 11)) === null)
  pruefe('Regel: Block mit Zusatz im Namen („Foo Season 1“) ist kein Standardname', gib(block('Foo Season 1', 12, 12)) === null)
  pruefe('Regel: Block ohne deutsche Folge: kein Treffer', gib(block('Season 1', 12, 0, [])) === null)
  pruefe('Regel: alle laufenden Nummern hinter dem Ende des Titels: kein Treffer', gib(block('Season 1', 12, 12, nummern(12, 13))) === null)
  const us = { ...crDub(true).serien[2]!, katalog: 'us' }
  const ohneAngebot = { ...crDub(true).serien[3]!, deutschImAngebot: false }
  const kennungen = frischesteSerieJeKennung({ scrapedAt: '', serien: [us, ohneAngebot] } as never)
  pruefe('Läufer: US-Katalog und fehlendes deutsches Angebot zählen nicht', kennungen.size === 0, [...kennungen.keys()])
  const fertig = { id: 5, format: 'TV', episodes: 12, streams: [{ platform: 'crunchyroll', url: GENAU, dub: false }] }
  const gesetzt = ordneStandardnamenBloeckeZu({ crDub: crDub(true) as never, nachUrl: new Map([[GENAU, [fertig as never]]]) })
  pruefe('Läufer: ein vorhandenes Urteil (dub: false) wird nicht überschrieben', gesetzt.length === 0 && fertig.streams[0]!.dub === false, gesetzt)
}

if (process.argv[2] === '--kind-neu') await kind(true)
else if (process.argv[2] === '--kind-alt') await kind(false)
else {
  const neu = lauf(true)
  const alt = lauf(false)
  const dub = (erg: typeof neu, id: number) => erg?.find(([i]) => i === id)?.[1]
  pruefe('Tonikaku Kawaii (12 Folgen), Block „Season 1“ 14/13: Ja', dub(neu, 116267) === true, neu)
  pruefe('Tonikaku Kawaii mit dem alten Blocknamen: weiter Ja', dub(alt, 116267) === true, alt)
  pruefe('Zwei TV-Titel ohne Staffelnummer an „Season 1“: mehrdeutig, kein Ja', dub(neu, 900001) === null && dub(neu, 900002) === null, neu)
  pruefe('„Season 1“ ohne deutsche Folge: kein Ja', dub(neu, 900003) !== true, neu)
  pruefe('Block hat 3 Folgen mehr als der Titel: kein Ja', dub(neu, 900004) === null, neu)
  pruefe('Block hat genau 2 Folgen mehr als der Titel: Ja', dub(neu, 900005) === true, neu)
  direkt()
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
