/**
 * Vorschaubilder mit geschätzter Uhrzeit werden einmal neu gezeichnet (nicht alle): echter Lauf von `build-og.ts`
 * gegen eine Kulisse im Temp-Ordner (`AK_ROOT`), zwei Läufe hintereinander. Termine in 2999, damit „kommend" fest ist.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { OG_FASSUNG } from './lib/og-fassung.ts'
import { liesSchaetzListe, neuWegenSchaetzung, schreibSchaetzListe } from './lib/og-schaetz.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const release = (slug: string, id: number, zusatz: Record<string, unknown>) => ({
  slug,
  titleId: id,
  name: slug,
  platform: 'netflix',
  platformUrl: 'https://www.netflix.com/title/1',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2999-01-05', time: '17:00', episodeCount: 2, ...zusatz },
  sources: [],
})

const wurzel = mkdtempSync(join(tmpdir(), 'ak-og-schaetz-'))
const og = join(wurzel, 'public', 'og')
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
mkdirSync(og, { recursive: true })
const daten = (name: string, inhalt: unknown) => writeFileSync(join(wurzel, 'public', 'data', name), JSON.stringify(inhalt))
daten('releases.json', [
  release('zeit-est', 900001, { timeEstimated: true }),
  release('zeit-gemessen', 900002, {}),
  release('zeit-termin-est', 900003, { estimated: true }),
  release('zeit-ohne-bild', 900004, {}),
])
daten('titles-core.json', [])
daten('titles.json', [])
daten('meta.json', { belegtCount: 1 })
writeFileSync(join(og, 'fassung.txt'), `${OG_FASSUNG}\n`)
// Die Schriften liegen unter node_modules der Wurzel: Verknüpfung statt Kopie (Windows: Junction, Linux: Symlink).
symlinkSync(resolve(import.meta.dirname, '..', 'node_modules'), join(wurzel, 'node_modules'), 'junction')

function alteBilder(): void {
  for (const slug of ['zeit-est', 'zeit-gemessen', 'zeit-termin-est']) writeFileSync(join(og, `${slug}.jpg`), 'alt')
}
const bild = (slug: string): string => readFileSync(join(og, `${slug}.jpg`), 'latin1').slice(0, 3)
function lauf(): number {
  const skript = resolve(import.meta.dirname, 'build-og.ts')
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) console.error(r.stderr)
  return r.status ?? -1
}

try {
  alteBilder()
  pruefe('Lauf 1 endet mit 0', lauf() === 0)
  pruefe('geschätzte Uhrzeit (timeEstimated): neu gezeichnet', bild('zeit-est') !== 'alt')
  pruefe('estimated-Termin mit Uhrzeit: neu gezeichnet', bild('zeit-termin-est') !== 'alt')
  pruefe('gemessene Uhrzeit: Bild bleibt', bild('zeit-gemessen') === 'alt')
  pruefe('Release ohne Bild: gezeichnet', bild('zeit-ohne-bild') !== 'alt' && existsSync(join(og, 'zeit-ohne-bild.jpg')))
  pruefe('Liste der Bilder mit ≈', readFileSync(join(og, 'schaetz.txt'), 'utf8') === 'zeit-est\nzeit-termin-est\n')
  alteBilder()
  pruefe('Lauf 2 endet mit 0', lauf() === 0)
  pruefe('zweiter Lauf: nichts mehr neu gezeichnet', ['zeit-est', 'zeit-gemessen', 'zeit-termin-est'].every((s) => bild(s) === 'alt'))
} finally {
  unlinkSync(join(wurzel, 'node_modules'))
  rmSync(wurzel, { recursive: true, force: true })
}

const liste = liesSchaetzListe('b\n\na\n')
pruefe('Liste: Leerzeilen weg', liste.size === 2 && liste.has('a'))
pruefe('Liste: sortiert geschrieben', schreibSchaetzListe(liste) === 'a\nb\n')
pruefe('≈ und unbekannt: neu', neuWegenSchaetzung('≈ 17:00 Uhr', 'x', new Set()))
pruefe('≈ und bekannt: nicht neu', !neuWegenSchaetzung('≈ 17:00 Uhr', 'x', new Set(['x'])))
pruefe('ohne ≈: nicht neu', !neuWegenSchaetzung('17:00 Uhr', 'x', new Set()))

if (fehler > 0) {
  console.error(`check-og-schaetz: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-og-schaetz: ok (Lauf 1 zeichnet 2 von 3 vorhandenen und das fehlende, Lauf 2 keins, 5 Listenfälle)')
