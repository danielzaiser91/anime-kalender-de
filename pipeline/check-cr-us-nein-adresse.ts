/**
 * Zusicherungen zu `lib/cr-us-nein-adresse.ts`: `deutschBelegtSerie()` nennt nur Serien des deutschen Katalogs mit Kennung und mindestens
 * einer Staffel mit deutscher Folge; `istDeutscheAdresse()` erkennt nur Crunchyroll-Adressen mit Pfad `/de/`. Läuft in `check:logic`.
 */
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { deutschBelegtSerie, istDeutscheAdresse } from './lib/cr-us-nein-adresse.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const serie = (seriesId: string | undefined, katalog: string | undefined, deutsch: number[] | undefined) => ({
  ...(seriesId ? { seriesId } : {}),
  ...(katalog ? { katalog } : {}),
  ...(deutsch ? { staffeln: deutsch.map((d) => ({ deutsch: d })) } : {}),
})
const daten = (serien: ReturnType<typeof serie>[]) => ({ scrapedAt: '2026-10-24', serien }) as unknown as CrDubData

pruefe('leer', [...deutschBelegtSerie(daten([]))], [])
pruefe(
  'nur deutscher Katalog mit deutscher Folge',
  [
    ...deutschBelegtSerie(
      daten([
        serie('GDE1', 'de', [0, 3]), // zweite Staffel deutsch
        serie('GDE2', 'de', [0, 0]), // SNAFU: keine deutsche Folge
        serie('GUS1', 'us', [12]), // US-Katalog zählt nicht
        serie('GOHNE', undefined, [5]), // ohne Katalog
        serie(undefined, 'de', [5]), // ohne Kennung
        serie('GLEER', 'de', []), // keine Staffeln
        serie('GNICHTS', 'de', undefined), // Staffeln fehlen
        serie('GDE1', 'de', [1]), // doppelt
        serie('GDE3', 'de', [1]),
      ]),
    ),
  ],
  ['GDE1', 'GDE3'],
)
pruefe('Katalog genau „de“', [...deutschBelegtSerie(daten([serie('GA', 'DE', [1]), serie('GB', 'de-DE', [1])]))], [])

const ja = [
  'https://www.crunchyroll.com/de/series/GDE1/snafu',
  'https://crunchyroll.com/de/watch/G123',
  'http://www.crunchyroll.com/de/',
]
const nein = [
  'https://www.crunchyroll.com/series/GDE1/snafu', // US/ohne Sprache
  'https://www.crunchyroll.com/fr/series/GDE1',
  'https://www.crunchyroll.com/de', // ohne Schrägstrich danach
  'https://www.crunchyroll.com/deutsch/series/x',
  'https://www.crunchyroll.com/series/x/de/',
  'https://beta.crunchyroll.com/de/series/x',
  'https://www.crunchyroll.com.evil.example/de/x',
  'https://evilcrunchyroll.com/de/x',
  'ftp://www.crunchyroll.com/de/x',
  ' https://www.crunchyroll.com/de/x',
  '',
]
for (const u of ja) pruefe(`deutsche Adresse: ${u}`, istDeutscheAdresse(u), true)
for (const u of nein) pruefe(`keine deutsche Adresse: ${JSON.stringify(u)}`, istDeutscheAdresse(u), false)

if (fehler) {
  console.error(`check-cr-us-nein-adresse: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-cr-us-nein-adresse: ok')
