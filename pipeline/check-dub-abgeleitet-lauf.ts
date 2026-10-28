/**
 * Verdrahtung: `auslieferungsInvarianten()` (Schritt 13-5 des Baus) bricht bei einem falschen `dubAbgeleitet` in `titles.json` ab.
 * Der echte Aufrufer läuft gegen eine Kulisse (`AK_ROOT` im Wegwerf-Ordner, Handdaten des Repos nur gelesen), ohne die Funktion
 * `dubAbgeleitetFehler` selbst anzufassen. Läuft in `check:logic`.
 */
import { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kulisse = mkdtempSync(join(tmpdir(), 'dub-abgeleitet-'))
const handDaten = join(kulisse, 'data')
mkdirSync(join(kulisse, 'public', 'data'), { recursive: true })
symlinkSync(join(repo, 'data'), handDaten, 'junction')

const titel = (streams: object[]): string => JSON.stringify([{ id: 900001, slug: 'x', streams }])
const netflix = { platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true, dubAbgeleitet: 'joyn-pauschal' }
const joyn = { platform: 'joyn', url: 'https://www.joyn.de/serien/naruto', dub: true, dubAbgeleitet: 'joyn-pauschal' }

process.env.AK_ROOT = kulisse
let verletzt = 0
try {
  const { auslieferungsInvarianten } = await import(pathToFileURL(join(repo, 'pipeline', 'bau', 'auslieferung-pruefen.ts')).href)
  const lauf = (streams: object[], datei = 'titles.json'): string[] => {
    for (const d of ['titles.json', 'cartoons.json']) writeFileSync(join(kulisse, 'public', 'data', d), titel(d === datei ? streams : []))
    return (auslieferungsInvarianten([]) as string[]).filter((f) => f.includes('dubAbgeleitet'))
  }
  const falsch = lauf([netflix])
  if (falsch.length !== 1) {
    verletzt++
    console.error(`  ✖ joyn-pauschal an Netflix: erwartet 1 Fehler aus dem Aufrufer, gefunden ${JSON.stringify(falsch)}`)
  } else console.log('  ✓ Aufrufer meldet joyn-pauschal an Netflix')
  const richtig = lauf([joyn])
  if (richtig.length !== 0) {
    verletzt++
    console.error(`  ✖ Joyn mit Kennzeichen: erwartet keinen Fehler, gefunden ${JSON.stringify(richtig)}`)
  } else console.log('  ✓ Aufrufer lässt Joyn mit Kennzeichen durch')
  const cartoon = lauf([netflix], 'cartoons.json')
  if (cartoon.length !== 1) {
    verletzt++
    console.error(`  ✖ Kennzeichen in cartoons.json: erwartet 1 Fehler aus dem Aufrufer, gefunden ${JSON.stringify(cartoon)}`)
  } else console.log('  ✓ Aufrufer prüft auch cartoons.json')
} finally {
  if (lstatSync(handDaten).isSymbolicLink()) unlinkSync(handDaten)
  rmSync(kulisse, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('\ncheck-dub-abgeleitet-lauf: 3 Prüfungen ok')
