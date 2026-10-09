/**
 * Zusicherungen zum Herkunftsland (`land`) im Hauptbestand: nur ≠ JP, nur aus AniList, nie bei synthetischer Kennung.
 * Hintergrund: daniel-zum-abarbeiten/berichte/herkunftsland-messung.md (09.10.2026). Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { landAusAnilist, titleFromMedia } from './bau/titel-hilfen.ts'
import { landFehler } from './lib/pruefung.ts'
import type { AniListMedia } from './lib/anilist.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const medium = (id: number, countryOfOrigin?: string | null): AniListMedia => ({
  id, idMal: null, title: { romaji: 'Test', english: null, native: null }, format: 'TV', status: 'FINISHED', episodes: 12,
  duration: 24, season: null, seasonYear: 2020, startDate: { year: 2020, month: 1, day: 1 }, genres: [], tags: [],
  externalLinks: [], studios: { nodes: [] }, coverImage: { large: null, extraLarge: null }, bannerImage: null,
  averageScore: null, isAdult: false, description: null, ...(countryOfOrigin === undefined ? {} : { countryOfOrigin }),
})

pruefe('Land: Japan steht nie im Feld', landAusAnilist('JP').land === undefined)
pruefe('Land: ohne Angabe (null, undefined, leer) bleibt das Feld leer — nichts geraten', [null, undefined, ''].every((c) => landAusAnilist(c).land === undefined))
pruefe('Land: KR, CN, TW werden übernommen', ['KR', 'CN', 'TW'].every((c) => landAusAnilist(c).land === c))
pruefe('Land: Titel aus AniList-Medium mit KR trägt land, mit JP oder ohne Angabe nicht',
  titleFromMedia(medium(1, 'KR'), 'high').land === 'KR' && !('land' in titleFromMedia(medium(2, 'JP'), 'high')) && !('land' in titleFromMedia(medium(3), 'high')))

const mit = (id: number, land: string): [number, Title] => [id, { id, land } as Title]
pruefe('Land-Prüfung: gültige Kürzel ≠ JP bei AniList-Kennung bestehen', landFehler(new Map([mit(1, 'KR'), mit(2, 'CN')])).length === 0)
pruefe('Land-Prüfung: JP im Feld wird gemeldet', landFehler(new Map([mit(1, 'JP')])).length === 1)
pruefe('Land-Prüfung: kleingeschriebenes oder langes Kürzel wird gemeldet', landFehler(new Map([mit(1, 'kr'), mit(2, 'KOR')])).length === 2)
pruefe('Land-Prüfung: synthetische Kennung mit land wird gemeldet (keine Quelle)', landFehler(new Map([mit(10_000_005, 'KR')])).length === 1)

/* Echter Bestand: sobald ein Datenlauf `land` geliefert hat, gilt die Verteilung der Messung (KR 33, CN 28; 09.10.2026) als Untergrenze. */
const datei = 'public/data/titles.json'
if (existsSync(datei)) {
  const titel = JSON.parse(readFileSync(datei, 'utf8')) as Title[]
  const mitLand = titel.filter((t) => t.land !== undefined)
  pruefe('Land (Bestand): kein JP, kein ungültiges Kürzel, keine synthetische Kennung', landFehler(new Map(mitLand.map((t) => [t.id, t]))).length === 0)
  if (mitLand.length > 0) {
    const zahl = (c: string) => mitLand.filter((t) => t.land === c).length
    pruefe('Land (Bestand): Korea und China erreichen die gemessene Untergrenze', zahl('KR') >= 25 && zahl('CN') >= 20, `KR ${zahl('KR')}, CN ${zahl('CN')}`)
  }
}

console.log(fehler ? `\nHerkunftsland: ${fehler} Zusicherung(en) verletzt.` : 'Herkunftsland: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
