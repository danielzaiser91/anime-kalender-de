/**
 * Ein entfernter Prime-Verweis sperrt nur seine eigene Amazon-Adresse, nicht jede `watch.amazon.de/detail?gti=…`
 * (Anlass 10.11.2026: Drei kleine Geister 310, Haganai 10719, Laidbackers 104721 u. a. verloren den Stream aus JustWatch, weil zwei
 * entfernte Verweise den Kern `watch.amazon.de/detail` belegten). Die Adressen stehen wörtlich in `data/justwatch-audio.json` und
 * `data/verweise-entfernt.json` (Stand 10.11.2026). Hier läuft die echte `bereinigeWege` gegen eine Wegwerf-Wurzel.
 *
 * Aufruf: npx tsx pipeline/check-weg-nein-gti.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title, WatchLink } from '../shared/types.ts'

const GTI = (n: string) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.${n.repeat(36).slice(0, 8)}-aaaa-bbbb-cccc-${n.repeat(12)}`
const ENTFERNT_1 = GTI('1')
const ENTFERNT_2 = GTI('2')
const FREMD_1 = 'https://www.thalia.de/shop/home/artikeldetails/A1?x=1'

const wurzel = mkdtempSync(join(tmpdir(), 'weg-nein-gti-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })
mkdirSync(join(wurzel, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
const eintrag = (titleId: number, url: string) => ({ titleId, titel: 'x', plattform: 'primevideo', url, grund: 'belegtes Nein', entferntAm: '2026-11-10', letzterWeg: false })
writeFileSync(
  join(wurzel, 'data', 'verweise-entfernt.json'),
  JSON.stringify({ verweise: [eintrag(543, ENTFERNT_1), eintrag(20954, ENTFERNT_2), eintrag(5, FREMD_1)] }),
)
const { bereinigeWege } = await import('./bau/11-3-bereinigung.ts')
const { wegKern } = await import('./lib/weg-kern.ts')

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (name: string, url: string): WatchLink => ({ name, url, kind: 'stream', zugang: 'abo' }) as WatchLink
function laufe(wege: WatchLink[]): string[] {
  const t = { id: 310, jpYear: 1991, streams: [], watchLinks: wege } as unknown as Title
  bereinigeWege({
    titles: new Map([[t.id, t]]),
    anisearch: {},
    istTot: () => false,
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
  })
  return (t.watchLinks ?? []).map((w) => w.url)
}

console.log('wegKern')
pruefe('zwei gti an derselben Adresse: verschiedener Kern', wegKern(ENTFERNT_1) !== wegKern(ENTFERNT_2))
pruefe('Adresse ohne gti: Parameter, Schema, www und Schlussstrich fallen weg', wegKern('https://www.Thalia.de/a/?x=1') === 'thalia.de/a')

console.log('bereinigeWege: Weg nach belegtem Nein')
const andere = GTI('3')
const dritte = GTI('4')
const aus = laufe([weg('Amazon Prime Video', andere), weg('Aniverse Amazon Channel', dritte)])
pruefe('Wege mit anderer gti als die entfernten bleiben beide', aus.length === 2 && aus[0] === andere && aus[1] === dritte, aus)
const gleich = laufe([weg('Amazon Prime Video', ENTFERNT_1), weg('Aniverse Amazon Channel', andere), weg('Amazon Video', ENTFERNT_2)])
pruefe('Weg mit genau der entfernten gti entfällt (beide Einträge), der mit anderer gti bleibt', gleich.length === 1 && gleich[0] === andere, gleich)
const fremd = laufe([weg('Thalia', 'https://thalia.de/shop/home/artikeldetails/A1/'), weg('Thalia', 'https://www.thalia.de/shop/home/artikeldetails/A2')])
pruefe('Adresse ohne gti: gleicher Kern wie ein entfernter Verweis entfällt, anderer bleibt', fremd.length === 1 && fremd[0]!.endsWith('/A2'), fremd)

console.log(`weg-nein-gti: ${faelle} Fälle, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
