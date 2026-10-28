/**
 * Eine Crunchyroll-Serie mit neuer deutscher Folge, an deren Kennung noch kein Titel hängt, bekommt im Bestandsbau ihren Weg
 * (`lib/cr-neue-serie.ts`, verdrahtet in `bau/09-4-crunchyroll-dub.ts`). Anlass 28.10.2026: Magic Knight Rayearth (2026), Serie
 * GT00383994, stand als Ankündigung ohne Stream (AniList 178868); deutsche Folge 1 (GE00385869DEDE, 15:15 UTC) blieb ohne Weg und
 * Synchro. Folge und Titelfelder stammen wörtlich aus `data/crunchyroll-neu.json` und `public/data/titles.json` (Stand 28.10.2026).
 * Die echte Bau-Funktion läuft in einem Kindprozess mit `AK_ROOT` im Wegwerf-Ordner.
 *
 * Aufruf: npx tsx pipeline/check-cr-neue-serie.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neueSerienZeilen, ordneNeueSerienZu, type NeueSerienFolge } from './lib/cr-neue-serie.ts'

const URL_RAY = 'https://www.crunchyroll.com/de/series/GT00383994'
const FOLGE: NeueSerienFolge & Record<string, unknown> = {
  guid: 'GE00385869DEDE',
  serieId: 'GT00383994',
  serie: 'Magic Knight Rayearth (2026)',
  staffelId: 'GS00384031DEDE',
  staffel: 'Staffel 1',
  nummer: 1,
  titel: 'Aus einer anderen Welt',
  ausstrahlung: '2026-10-07T00:00:00.000Z',
  verfuegbarAb: '2026-10-28T15:15:00.000Z',
  gesehenAm: '2026-10-28',
}
const DETECTIVE: NeueSerienFolge = { serieId: 'G24H1N334', serie: 'The Detective Is Already Dead', staffelId: 'GS1', staffel: 'Staffel 2', nummer: 1, verfuegbarAb: '2026-10-28T12:30:00.000Z' }

type T = { id: number; titleEn: string; titleRomaji: string; titleDe?: string; streams: Record<string, unknown>[] }
const rayearth = (): T => ({ id: 178868, titleEn: 'Magic Knight Rayearth (2026)', titleRomaji: 'Magic Knight Rayearth (2026)', titleDe: 'Magic Knight Rayearth', streams: [] })
const rayearthAlt = (): T => ({ id: 3000, titleEn: 'Magic Knight Rayearth', titleRomaji: 'Mahou Kishi Rayearth', streams: [] })

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lauf = (folgen: NeueSerienFolge[], titles: T[], nein: string[] = [], nachUrl = new Map<string, never[]>()) => {
  const aus = ordneNeueSerienZu({ folgen, titles: titles as never, nachUrl: nachUrl as never, handNein: new Set(nein) })
  return { aus, nachUrl }
}

function direkt(): void {
  const t = rayearth()
  const { aus, nachUrl } = lauf([FOLGE], [t, rayearthAlt()])
  pruefe('Rayearth (2026): bekommt Adresse, dub: true und Bereich 1–1', JSON.stringify(t.streams) === JSON.stringify([{ platform: 'crunchyroll', url: URL_RAY, dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }]), t.streams)
  pruefe('Rayearth: Zuordnung gemeldet und in nachUrl eingetragen', aus.zugeordnet.length === 1 && aus.zugeordnet[0]!.titelId === 178868 && nachUrl.get(URL_RAY)?.length === 1, aus)
  const alt = rayearthAlt()
  lauf([FOLGE], [rayearth(), alt])
  pruefe('Der Titel der alten Serie (1994) bleibt ohne Weg', alt.streams.length === 0, alt.streams)

  const zweiter = lauf([FOLGE], [t])
  pruefe('Zweiter Lauf: Kennung hängt schon am Titel, nichts doppelt', t.streams.length === 1 && zweiter.aus.zugeordnet.length === 0 && zweiter.aus.offen.length === 0, t.streams)

  const bekannt = { ...rayearth(), streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/G24H1N334/x' }] }
  const d = lauf([DETECTIVE], [bekannt, { id: 5, titleEn: 'The Detective Is Already Dead', titleRomaji: 'x', streams: [] }])
  pruefe('Serie, deren Kennung an einem Titel hängt (Detective): unberührt, nicht offen', d.aus.zugeordnet.length === 0 && d.aus.offen.length === 0)

  const ueberUrl = rayearth()
  const nurNachUrl = lauf([FOLGE], [ueberUrl], [], new Map([[URL_RAY, []]]))
  pruefe('Kennung nur in nachUrl (an keinem Stream): nichts doppelt angelegt', ueberUrl.streams.length === 0 && nurNachUrl.aus.zugeordnet.length === 0, ueberUrl.streams)
  const fremderWeg = { ...rayearth(), streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GANDERE/x' }] }
  const mitWeg = lauf([FOLGE], [fremderWeg])
  pruefe('Titel mit anderem Crunchyroll-Weg bekommt keinen zweiten', fremderWeg.streams.length === 1 && mitWeg.aus.offen[0]?.grund === 'kein Titel gleichen Namens', mitWeg.aus)
  const nurRomaji = { ...rayearth(), titleEn: 'Anderer Name', titleDe: undefined }
  lauf([FOLGE], [nurRomaji])
  pruefe('Name nur im Romaji-Titel gleich: Treffer', nurRomaji.streams.length === 1, nurRomaji.streams)

  const zwei = lauf([FOLGE], [rayearth(), { ...rayearth(), id: 178869 }])
  pruefe('Zwei Titel gleichen Namens: kein Weg, benannt offen', zwei.aus.zugeordnet.length === 0 && zwei.aus.offen[0]?.grund === '2 Titel gleichen Namens', zwei.aus)
  const keiner = lauf([FOLGE], [rayearthAlt()])
  pruefe('Kein Titel gleichen Namens: benannt offen', keiner.aus.offen.length === 1 && keiner.aus.offen[0]!.grund === 'kein Titel gleichen Namens', keiner.aus)
  const gemischt = lauf([FOLGE, { ...FOLGE, staffelId: 'GS2', nummer: 2 }], [rayearth()])
  pruefe('Funde aus zwei Staffeln: kein Weg, benannt offen', gemischt.aus.zugeordnet.length === 0 && gemischt.aus.offen[0]?.grund === 'Funde aus mehreren Staffeln', gemischt.aus)
  const hand = rayearth()
  const mitNein = lauf([FOLGE], [hand], ['178868|crunchyroll'])
  pruefe('Handbeleg „nein“ zum Weg: kein Weg', hand.streams.length === 0 && mitNein.aus.zugeordnet.length === 0, mitNein.aus)
  const bereiche = rayearth()
  lauf([FOLGE, { ...FOLGE, nummer: 2 }, { ...FOLGE, nummer: 4 }, { ...FOLGE, nummer: 2 }], [bereiche])
  pruefe('Bereiche: 1,2,4 (2 doppelt) → 1–2 und 4–4', JSON.stringify(bereiche.streams[0]?.dubRanges) === '[{"from":1,"to":2,"dub":true},{"from":4,"to":4,"dub":true}]', bereiche.streams)
  const ohneNr = rayearth()
  lauf([{ ...FOLGE, nummer: undefined }], [ohneNr])
  pruefe('Folge ohne Nummer: Weg mit dub: true, ohne Bereiche', ohneNr.streams.length === 1 && !('dubRanges' in ohneNr.streams[0]!), ohneNr.streams)
  const zeilen = neueSerienZeilen(lauf([FOLGE, DETECTIVE], [rayearth()]).aus)
  pruefe('Logzeilen: eine Zuordnung, eine benannte offene Serie', zeilen.length === 2 && zeilen[0]!.startsWith('1 neue') && zeilen[1]!.includes('The Detective Is Already Dead (G24H1N334, kein Titel gleichen Namens)'), zeilen)
  pruefe('Leere Eingabe: keine Zeilen', neueSerienZeilen(lauf([], [rayearth()]).aus).length === 0)
}

async function kind(): Promise<void> {
  const { werteCrunchyrollDubAus } = await import('./bau/09-4-crunchyroll-dub.ts')
  const titles = new Map([rayearth()].map((t) => [t.id, t]))
  werteCrunchyrollDubAus({
    crDub: { scrapedAt: '2026-10-28T00:00:00Z', serien: [{ url: 'https://www.crunchyroll.com/de/series/GFREMD1/x', seriesId: 'GFREMD1', quelle: 'api', katalog: 'de', geprueftAm: '2026-10-28', deutschImAngebot: false, staffeln: [] }] } as never,
    titles: titles as never,
    usNeinWiderlegt: () => false,
    verweiseEntfernt: [],
    katalogEintraege: [],
    anisearch: {},
    releases: [],
  })
  console.log('ERGEBNIS ' + JSON.stringify(titles.get(178868)!.streams))
}

/** Bau-Lauf im Kindprozess; `nein` legt einen Handbeleg „dub: false“ für Rayearth an. */
function prozess(nein: boolean): Record<string, unknown>[] {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-neue-serie-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'cr-katalog-de.json'), JSON.stringify({ geholtAm: '2026-09-09T17:26:33.450Z', eintraege: [] }))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-series-ids.json'), JSON.stringify({ adressen: {} }))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  writeFileSync(join(wurzel, 'data', 'crunchyroll-neu.json'), JSON.stringify({ geholtAm: '2026-10-28T19:00:00Z', folgen: [FOLGE] }))
  if (nein) writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), JSON.stringify([{ anilistId: 178868, platform: 'crunchyroll', dub: false, checkedAt: '2026-10-28', url: URL_RAY }]))
  const r = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--kind'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, AK_ROOT: wurzel } })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('ERGEBNIS ')).pop()?.slice(9)
  pruefe(`Kindprozess lief bis zum Ende (Handbeleg nein: ${nein})`, r.status === 0 && Boolean(zeile), { status: r.status, err: r.stderr.slice(-400) })
  return zeile ? (JSON.parse(zeile) as Record<string, unknown>[]) : []
}

if (process.argv.includes('--kind')) {
  await kind()
} else {
  direkt()
  const wege = prozess(false)
  pruefe('Bau (09-4): Rayearth bekommt Serienadresse, dub: true, Bereich 1–1', wege.length === 1 && wege[0]!.url === URL_RAY && wege[0]!.dub === true && JSON.stringify(wege[0]!.dubRanges) === '[{"from":1,"to":1,"dub":true}]', wege)
  const mitNein = prozess(true)
  pruefe('Bau (09-4): Handbeleg „nein“ aus der Datei gelesen: kein Weg', mitNein.length === 0, mitNein)
  if (fehler) {
    console.error(`✗ ${fehler} Fall/Fälle verletzt`)
    process.exit(1)
  }
  console.log('Wächter Crunchyroll neue Serie: alle Fälle ok (Direktfälle, Bau-Kindprozess mit und ohne Handbeleg)')
}
