/**
 * Zusicherungen zu `serienMitDeutsch()` aus `lib/cr-dub-katalog.ts` an Katalogen in einem Temp-Ordner: nur Serien mit `de-DE` in
 * `audio` (genau dieser Code, nicht `de`), ohne `audio` keine; Liste oder `{ eintraege }`; fehlende Datei ergibt eine leere Menge;
 * gelesen wird einmal je Prozess (zweiter Aufruf mit anderem Pfad liefert dieselbe Menge). Weil das Modul sich die Menge merkt,
 * läuft jede Form in einem eigenen Prozess. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const modul = pathToFileURL(join(wurzel, 'pipeline/lib/cr-dub-katalog.ts')).href
const ordner = mkdtempSync(join(tmpdir(), 'ak-cr-dub-katalog-'))

/** Ruft `serienMitDeutsch` in einem frischen Prozess für jeden Pfad nacheinander und gibt die Mengen als sortierte Listen zurück. */
function inEigenemProzess(...pfade: string[]): string[][] | string {
  const code = `const { serienMitDeutsch } = await import(${JSON.stringify(modul)}); const p = ${JSON.stringify(pfade)};
const m = p.map((x) => serienMitDeutsch(x)); console.log(JSON.stringify({ listen: m.map((s) => [...s].sort()), gleich: m.every((s) => s === m[0]) }))`
  const r = spawnSync(process.execPath, [tsx, '--input-type=module', '-e', code], { encoding: 'utf8' })
  if (r.status !== 0) return `Exit ${r.status}: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}`
  const aus = JSON.parse(r.stdout.trim().split('\n').at(-1)!) as { listen: string[][]; gleich: boolean }
  if (!aus.gleich) return 'zweiter Aufruf lieferte eine andere Menge'
  return aus.listen
}

try {
  const eintraege = [
    { id: 'G1', audio: ['ja-JP', 'de-DE'] },
    { id: 'G2', audio: ['ja-JP'] },
    { id: 'G3', audio: ['de'] },
    { id: 'G4' },
    { id: 'G5', audio: ['de-DE'] },
    { id: 'G6', audio: ['DE-de', 'en-US'] },
  ]
  const liste = join(ordner, 'liste.json')
  const umschlag = join(ordner, 'umschlag.json')
  const anderer = join(ordner, 'anderer.json')
  writeFileSync(liste, JSON.stringify(eintraege))
  writeFileSync(umschlag, JSON.stringify({ stand: '2026-11-12', eintraege }))
  writeFileSync(anderer, JSON.stringify([{ id: 'X1', audio: ['de-DE'] }]))
  writeFileSync(join(ordner, 'leer-umschlag.json'), JSON.stringify({ stand: '2026-11-12' }))

  pruefe('Liste: nur genau de-DE', inEigenemProzess(liste), [['G1', 'G5']])
  pruefe('Umschlag mit eintraege', inEigenemProzess(umschlag), [['G1', 'G5']])
  pruefe('Umschlag ohne eintraege', inEigenemProzess(join(ordner, 'leer-umschlag.json')), [[]])
  pruefe('fehlende Datei', inEigenemProzess(join(ordner, 'gibt-es-nicht.json')), [[]])
  pruefe('gemerkt: zweiter Pfad liefert dieselbe Menge', inEigenemProzess(liste, anderer), [
    ['G1', 'G5'],
    ['G1', 'G5'],
  ])
  pruefe('gemerkt auch nach leerem Ergebnis', inEigenemProzess(join(ordner, 'gibt-es-nicht.json'), anderer), [[], []])
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-cr-dub-katalog: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-cr-dub-katalog: ok')
