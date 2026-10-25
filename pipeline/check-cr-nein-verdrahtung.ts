/**
 * Verdrahtung: Beide Bau-Stellen, die `crunchyroll-offene.json` anwenden (`09-4-3-katalog.ts`, `09-6-anisearch-wege.ts`),
 * lassen ein überholtes Nein liegen und wenden ein gültiges weiter an. Läuft die echten Bau-Funktionen gegen eine Kulisse
 * (`AK_ROOT` im Wegwerf-Ordner); die Fälle sind Last Boss S2 (Nein vom 28.09. überholt) und Fruits Basket (Nein bleibt).
 *
 * Aufruf: npx tsx pipeline/check-cr-nein-verdrahtung.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const LB = 'https://www.crunchyroll.com/de/series/GT00361955/a-wild-last-boss-appeared'
const FB = 'https://www.crunchyroll.com/fruits-basket'

/** Der Kindprozess: AK_ROOT ist gesetzt, bevor die Bau-Module geladen werden. */
async function kind(): Promise<void> {
  const { ordneCrKatalogZu } = await import('./bau/09-4-3-katalog.ts')
  const { ergaenzeAnisearchWege } = await import('./bau/09-6-anisearch-wege.ts')
  const stand = (b: string) => ({ url: b, seriesId: b === LB ? 'GT00361955' : 'G6ZJMGEXY', katalog: 'de', quelle: 'api', deutschImAngebot: true, geprueftAm: b === LB ? '2026-10-25' : '2026-10-12', staffeln: [] })
  const crDub = {
    scrapedAt: '2026-10-25',
    serien: [
      { ...stand(LB), staffeln: [{ name: 'Staffel 1', deutsch: 12, folgen: 12, kacheln: 12, fremd: 0, deutscheFassung: true }, { name: 'Staffel 2', deutsch: 2, folgen: 5, kacheln: 5, fremd: 0, deutscheFassung: true }] },
      { ...stand(FB), staffeln: [{ name: 'Fruits Basket (2019)', deutsch: 0, folgen: 25 }, { name: 'Fruits Basket Staffel 2', deutsch: 25, folgen: 25, deutscheFassung: true }] },
    ],
  }
  const mach = () =>
    new Map([
      [1, { id: 1, titleEn: 'A Wild Last Boss Appeared! Season 2', jpYear: 2026, streams: [{ platform: 'crunchyroll', url: LB }] }],
      [2, { id: 2, titleEn: 'Fruits Basket', jpYear: 2019, streams: [{ platform: 'crunchyroll', url: FB }] }],
    ])
  const ergebnis: Record<string, unknown> = {}
  const katalog = mach()
  ordneCrKatalogZu({ titles: katalog as never, crDub: structuredClone(crDub) as never, verweiseEntfernt: [] })
  ergebnis['katalog'] = [...katalog.values()].map((t) => [t.id, t.streams.map((s: { platform: string; url: string; dub?: boolean }) => s.dub ?? null)])
  const wege = mach()
  const entfernt: never[] = []
  ergaenzeAnisearchWege({
    verweiseEntfernt: entfernt,
    crDub: structuredClone(crDub) as never,
    usNeinWiderlegt: () => false,
    titles: wege as never,
    anisearch: {},
    belegFuer: () => undefined,
    linkBefunde: {},
    lautPruefungTot: () => false,
    crAdresseZu: () => undefined,
    crKatalogDeutsch: new Set(),
    checks: new Map(),
    adnArchiv: { serien: new Map() } as never,
    adnStreamSchaerfen: () => false,
  })
  ergebnis['entfernt'] = entfernt
  ergebnis['wege'] = [...wege.values()].map((t) => [t.id, t.streams.map((s: { platform: string; url: string; dub?: boolean }) => s.dub ?? null)])
  console.log(JSON.stringify(ergebnis))
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

if (process.argv[2] === '--kind') {
  await kind()
} else {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-nein-verdrahtung-'))
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const offene = {
    [LB]: { herkunft: 'katalog', dub: false, seriesId: 'GT00361955', titel: 'Season 2', geprueftAm: '2026-09-28' },
    [FB]: { herkunft: 'katalog', dub: false, seriesId: 'G6ZJMGEXY', titel: 'Fruits Basket (2019)', geprueftAm: '2026-09-10' },
  }
  writeFileSync(join(wurzel, 'data', 'crunchyroll-offene.json'), JSON.stringify(offene))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const skript = fileURLToPath(import.meta.url)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, '--kind'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, AK_ROOT: wurzel } })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('{')).pop()
  const erg = zeile ? (JSON.parse(zeile) as Record<string, [number, (boolean | null)[]][]>) : undefined
  pruefe('Kindprozess lief', r.status === 0 && Boolean(erg), { status: r.status, err: r.stderr.slice(-400) })
  const dub = (art: string, id: number) => erg?.[art]?.find(([i]) => i === id)?.[1][0]
  pruefe('09-4-3: das überholte Nein (Last Boss S2) setzt kein dub:false', erg?.['katalog']?.find(([i]) => i === 1)?.[1].length === 1 && dub('katalog', 1) !== false, erg)
  pruefe('09-4-3: das gültige Nein (Fruits Basket) wird angewandt', dub('katalog', 2) === false, erg)
  pruefe('09-6: das überholte Nein (Last Boss S2) lässt den Verweis stehen, ohne dub:false', erg?.['wege']?.find(([i]) => i === 1)?.[1].length === 1 && dub('wege', 1) !== false, erg)
  pruefe('09-6: das gültige Nein (Fruits Basket) wird angewandt: der Verweis fliegt raus', erg?.['wege']?.find(([i]) => i === 2)?.[1].length === 0, erg)
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
