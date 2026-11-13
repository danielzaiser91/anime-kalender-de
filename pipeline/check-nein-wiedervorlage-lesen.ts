/**
 * Zusicherungen zu `pipeline/lib/nein-wiedervorlage-lesen.ts`: `adresseJeWeg` nimmt je Titel und Anbieter die zuletzt entfernte
 * Adresse (ohne Datum zählt als ältestes, ohne Adresse zählt nicht); `ladeNeinFaelle` liest an einer Kulisse, fehlende Dateien gelten
 * als leer, die Adresse des Belegs schlägt die entfernte, ein Fall ohne beide bleibt ohne `url`. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adresseJeWeg, ladeNeinFaelle } from './lib/nein-wiedervorlage-lesen.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

// adresseJeWeg
pruefe('leer', [...adresseJeWeg([])], [])
pruefe(
  'zuletzt entfernt gewinnt, unabhängig von der Reihenfolge; ohne Datum ist ältestes; ohne Adresse zählt nicht',
  [
    ...adresseJeWeg([
      { titleId: 1, plattform: 'netflix', url: 'https://neu', entferntAm: '2026-10-09' },
      { titleId: 1, plattform: 'netflix', url: 'https://ohne-datum' },
      { titleId: 1, plattform: 'netflix', url: 'https://alt', entferntAm: '2026-10-05' },
      { titleId: 1, plattform: 'netflix', entferntAm: '2026-12-01' },
      { titleId: 1, plattform: 'crunchyroll', url: 'https://cr', entferntAm: null },
    ]),
  ],
  [
    ['1|netflix', 'https://neu'],
    ['1|crunchyroll', 'https://cr'],
  ],
)

// ladeNeinFaelle
const kulisse = mkdtempSync(join(tmpdir(), 'nein-wiedervorlage-'))
try {
  const jetzt = new Date('2026-11-13T12:00:00Z')
  pruefe('ohne Dateien: keine Fälle', ladeNeinFaelle(kulisse, jetzt), [])
  mkdirSync(join(kulisse, 'data'))
  const nein = (id: number, platform: string, checkedAt: string, url?: string) =>
    [`- anilistId: ${id}`, `  platform: ${platform}`, '  dub: false', `  checkedAt: '${checkedAt}'`, ...(url ? [`  url: ${url}`] : [])].join('\n')
  writeFileSync(
    join(kulisse, 'data/dub-confirmed.yaml'),
    [nein(1, 'netflix', '2026-10-01'), nein(2, 'netflix', '2026-10-01', 'https://beleg'), nein(3, 'netflix', '2026-11-01'), nein(4, 'crunchyroll', '2026-09-01')].join('\n') + '\n',
  )
  pruefe('ohne entfernte Verweise: Fälle ohne url, junge Messung fehlt', ladeNeinFaelle(kulisse, jetzt).map((f) => [f.titleId, f.url ?? null]), [[4, null], [1, null], [2, 'https://beleg']])
  writeFileSync(
    join(kulisse, 'data/verweise-entfernt.json'),
    JSON.stringify({
      verweise: [
        { titleId: 1, plattform: 'netflix', url: 'https://alt', entferntAm: '2026-10-05' },
        { titleId: 1, plattform: 'netflix', url: 'https://neu', entferntAm: '2026-10-09' },
        { titleId: 2, plattform: 'netflix', url: 'https://entfernt', entferntAm: '2026-10-09' },
        { titleId: 4, plattform: 'netflix', url: 'https://anderer-anbieter' },
      ],
    }),
  )
  pruefe(
    'entfernte Adresse ergänzt, Belegadresse schlägt sie, anderer Anbieter zählt nicht',
    ladeNeinFaelle(kulisse, jetzt).map((f) => [f.titleId, f.url ?? null]),
    [[4, null], [1, 'https://neu'], [2, 'https://beleg']],
  )
  writeFileSync(join(kulisse, 'data/verweise-entfernt.json'), '{}')
  pruefe('Datei ohne verweise: wie leer', ladeNeinFaelle(kulisse, jetzt).map((f) => f.url ?? null), [null, null, 'https://beleg'])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-nein-wiedervorlage-lesen: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-nein-wiedervorlage-lesen: alle Zusicherungen grün')
