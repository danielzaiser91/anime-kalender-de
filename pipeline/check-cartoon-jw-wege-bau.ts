/**
 * Ablauftest zu `schreibeCartoons` (`bau/nebendateien.ts`): Cartoons bekommen Kauf-, Leih- und Abo-Wege aus JustWatch als `watchLinks`,
 * mit denselben Riegeln wie Anime (`bau/cartoon-jw-wege.ts`). Kulisse im Temp-Ordner (`AK_ROOT`), erfundene Titel, erfundene JustWatch-Zeilen.
 * Fängt, wenn der Aufruf im Bau entfällt, ein Riegel (Disc-Händler, Kino, eigene Plattform, ohne Treffer) fällt oder ein Weg ein `dub` bekommt.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-jw-wege-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })

const eintrag = (tmdbId: number, o: Record<string, unknown>) => [
  String(-tmdbId),
  { id: -tmdbId, tmdbId, titleEn: `Erfunden ${tmdbId}`, genres: ['Animation'], anbieterDe: [], land: ['US'], studios: ['Beispielstudio'], keywords: [], geholtAm: '2026-10-16', ...o },
]
writeFileSync(
  join(wurzel, 'data', 'cartoons.json'),
  JSON.stringify(Object.fromEntries([
    eintrag(11, { anbieterDe: ['Netflix'] }),
    eintrag(12, {}),
    eintrag(13, { anbieterDe: ['Netflix'] }),
    eintrag(14, { anbieterDe: ['Netflix'] }),
  ])),
)
const angebot = (anbieter: string, art: string, pfad: string) => ({ anbieter, art, url: `https://shop.example/${pfad}`, audio: [] })
writeFileSync(
  join(wurzel, 'data', 'justwatch-audio.json'),
  JSON.stringify({
    '-11': {
      geprueftAm: '2026-11-11',
      angebote: [
        angebot('Netflix', 'FLATRATE', 'netflix11'),
        angebot('Apple TV', 'BUY', 'apple11'),
        angebot('Sky Go', 'FLATRATE', 'sky11'),
        angebot('Thalia', 'BUY', 'thalia11'),
        angebot('Cinestar', 'CINEMA', 'kino11'),
      ],
    },
    '-12': { geprueftAm: '2026-11-11', angebote: [angebot('Apple TV', 'RENT', 'apple12')] },
    '-13': { geprueftAm: '2026-11-11', ohneTreffer: true, angebote: [] },
  }),
)
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

type Weg = { name: string; url: string; zugang?: string; dub?: unknown; dubRanges?: unknown }
let verletzt = 0
function pruefe(was: string, ist: unknown, soll: unknown) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  if (!gleich) verletzt++
  console.log(`  ${gleich ? '✓' : '✖'} ${was}${gleich ? '' : ` — erwartet ${JSON.stringify(soll)}, gefunden ${JSON.stringify(ist)}`}`)
}
try {
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  schreibeCartoons()
  const titel = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as { id: number; watchLinks?: Weg[] }[]
  const wege = (id: number) => titel.find((t) => t.id === id)?.watchLinks ?? []
  const kurz = (id: number) => wege(id).map((w) => `${w.name}|${w.zugang}`).sort()
  pruefe('mit Stream: Apple TV (Kauf) und Sky Go (Abo), kein Netflix, kein Disc-Händler, kein Kino', kurz(-11), ['Apple TV|kauf', 'Sky Go|abo'])
  pruefe('ohne Stream: Leihe wird Kaufweg bei Apple TV', kurz(-12), ['Apple TV|kauf'])
  pruefe('JustWatch ohne Treffer: kein Weg', kurz(-13), [])
  pruefe('ohne JustWatch-Zeile: kein Weg', kurz(-14), [])
  pruefe('Adresse stammt von JustWatch', wege(-11).find((w) => w.name === 'Apple TV')?.url, 'https://shop.example/apple11')
  pruefe('kein Weg trägt ein Sprachurteil', [-11, -12].flatMap(wege).filter((w) => w.dub !== undefined || w.dubRanges !== undefined).length, 0)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('  Cartoon-JustWatch-Wege: 6 Fälle grün')
