/**
 * Ablauftest zu `schreibeCartoons` (`bau/nebendateien.ts`): Der Bau schreibt keinen Cartoon ohne Aufnahmebeleg nach `public/data/cartoons.json`
 * (Regel: `lib/cartoon-aufnahme.ts`). Läuft auf einer Kulisse im Temp-Ordner (`AK_ROOT`), nicht auf dem Bestand; erfundene Titel.
 * Fängt, wenn der Filter im Bau entfällt oder wirkungslos wird; der Bestandsteil steht in `check-cartoon-aufnahme-bestand.ts`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-aufnahme-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })

const eintrag = (tmdbId: number, o: Record<string, unknown>) => [
  String(-tmdbId),
  { id: -tmdbId, tmdbId, titleEn: `Erfunden ${tmdbId}`, genres: ['Animation'], anbieterDe: [], land: ['US'], studios: [], keywords: [], geholtAm: '2026-10-16', ...o },
]
const roh = Object.fromEntries([
  eintrag(1, {}),
  eintrag(2, { netzwerk: 'YouTube', studios: ['Kanal'] }),
  eintrag(3, { netzwerk: 'Netflix' }),
  eintrag(4, { studios: ['Beispielstudio'] }),
  eintrag(6, { studios: ['Independent'] }),
  eintrag(5, { anbieterDe: ['Netflix'], netzwerk: 'YouTube' }),
])
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(roh))
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

let verletzt = 0
try {
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  schreibeCartoons()
  const ids = (JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as { id: number }[]).map((t) => t.id).sort((a, b) => b - a)
  const soll = [-3, -4, -5]
  if (JSON.stringify(ids) !== JSON.stringify(soll)) {
    verletzt++
    console.error(`  ✖ Bau schreibt nur Cartoons mit Aufnahmebeleg — erwartet ${soll}, gefunden ${ids}`)
  } else {
    console.log('  ✓ Bau schreibt nur Cartoons mit Aufnahmebeleg (ohne Beleg und Webkanal fehlen)')
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
