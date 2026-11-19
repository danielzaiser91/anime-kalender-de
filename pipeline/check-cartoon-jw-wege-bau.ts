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
    eintrag(15, { anbieterDe: ['Netflix'] }),
    eintrag(16, { anbieterDe: ['Netflix'] }),
    eintrag(17, { anbieterDe: ['Netflix'] }),
    eintrag(18, { anbieterDe: ['Netflix'] }),
  ])),
)
const angebot = (anbieter: string, art: string, pfad: string, audio: string[] = []) => ({ anbieter, art, url: `https://shop.example/${pfad}`, audio })
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
    '-15': { geprueftAm: '2026-11-11', angebote: [angebot('Apple TV', 'BUY', 'apple15', ['en'])] },
    '-16': { geprueftAm: '2026-11-11', angebote: [angebot('Apple TV', 'BUY', 'apple16', ['en'])] },
    '-17': { geprueftAm: '2026-11-11', angebote: [angebot('Apple TV', 'BUY', 'apple17', ['de'])] },
    '-18': {
      geprueftAm: '2026-11-11',
      angebote: [
        angebot('Apple TV', 'BUY', 'apple18', ['de', 'en']),
        angebot('Sky Go', 'FLATRATE', 'sky18', ['de']),
        angebot('Kika', 'FREE', 'kika18'),
        angebot('Thalia', 'BUY', 'thalia18', ['en']),
        angebot('Cinestar', 'CINEMA', 'kino18', ['en']),
        angebot('JustWatch TV', 'FLATRATE', 'jw18', ['en']),
      ],
    },
  }),
)
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
/* Zwei tote Adressen laut Handbeleg „nicht verfügbar“, dazu ein Beleg „verfügbar“ (gilt nicht als tot) (JSON ist gültiges YAML). */
const tot = (id: number, pfad: string, available = false) => ({ anilistId: id, title: `Erfunden ${-id}`, platform: 'primevideo', url: `https://shop.example/${pfad}`, available, checkedAt: '2026-11-11' })
writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), JSON.stringify([tot(-16, 'apple16'), tot(-17, 'apple17'), tot(-15, 'apple15', true)]))

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
  pruefe('Titel mit Stream, JustWatch nennt nur Englisch: Zusatzrunde nimmt Apple TV nicht (Synchro ist nicht Untertitel)', kurz(-15), [])
  pruefe('tote Adresse (Handbeleg), Zusatzrunde: kein Weg', kurz(-16), [])
  pruefe('tote Adresse (Handbeleg), Runde ohne Weg: kein Weg', kurz(-17), [])
  pruefe('Zusatzrunde: Kauf, Abo und gratis; ohne Disc-Händler, Kino und JustWatch-Eigenwerbung', kurz(-18), ['Apple TV|kauf', 'Kika|kostenlos', 'Sky Go|abo'])
  pruefe('Adresse stammt von JustWatch', wege(-11).find((w) => w.name === 'Apple TV')?.url, 'https://shop.example/apple11')
  pruefe('kein Weg trägt ein Sprachurteil', [-11, -12].flatMap(wege).filter((w) => w.dub !== undefined || w.dubRanges !== undefined).length, 0)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('  Cartoon-JustWatch-Wege: 10 Fälle grün')
