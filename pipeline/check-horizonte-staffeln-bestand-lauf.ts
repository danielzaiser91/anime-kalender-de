/**
 * Prozesstest von `check-horizonte-staffeln-bestand.ts`: das echte Skript läuft als eigener Prozess in einer Wegwerf-Kulisse (Arbeitsordner mit
 * eigenen `data/wikipedia-folgen.json`, `data/toggo.json`, `public/data/folgen/*`), je Fall wird genau eine Größe verfälscht. Die Staffelgrenzen
 * kommen aus der echten `data/curated/horizonte-staffeln.yaml`. Dazu: der Wächter steht in der Bestandsliste. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = resolve(import.meta.dirname, '..')
const tsx = pathToFileURL(join(REPO, 'node_modules/tsx/dist/esm/index.mjs')).href
const SKRIPT = 'pipeline/check-horizonte-staffeln-bestand.ts'
const ID = '158871'

type Kulisse = { wiki?: number[]; toggo?: number[]; s?: number | null; kopf?: number }
const GUT: Required<Kulisse> = { wiki: [45, 44, 47, 23], toggo: [45, 44, 47, 1], s: 4, kopf: 137 }

/** Folgen je Staffel → Wikipedia-Zeilen mit `st` bzw. TOGGO-Einträge. */
const wikiFolgen = (je: number[]) => je.flatMap((n) => Array.from({ length: n }, (_, i) => ({ st: i + 1 })))
const toggoFolgen = (je: number[]) => je.flatMap((n, s) => Array.from({ length: n }, (_, i) => ({ staffel: s + 1, folge: i + 1 })))

function lauf(k: Kulisse): { status: number | null; aus: string } {
  const w = { ...GUT, ...k }
  const wurzel = mkdtempSync(join(tmpdir(), 'horizonte-bestand-'))
  try {
    mkdirSync(join(wurzel, 'data'))
    mkdirSync(join(wurzel, 'public/data/folgen'), { recursive: true })
    writeFileSync(join(wurzel, 'data/wikipedia-folgen.json'), JSON.stringify({ titel: k.wiki === undefined && 'wiki' in k ? {} : { [ID]: { folgen: wikiFolgen(w.wiki) } } }))
    writeFileSync(join(wurzel, 'data/toggo.json'), JSON.stringify({ titel: { [ID]: { folgen: toggoFolgen(w.toggo) } } }))
    if (w.s !== null) writeFileSync(join(wurzel, `public/data/folgen/${ID}.json`), JSON.stringify({ f: [], de: [], s: Array.from({ length: w.s }, (_, i) => [i + 1, 1]) }))
    writeFileSync(join(wurzel, 'public/data/folgen/zaehlung.json'), JSON.stringify({ [ID]: [w.kopf, w.kopf] }))
    const r = spawnSync(process.execPath, ['--import', tsx, join(REPO, SKRIPT)], { cwd: wurzel, encoding: 'utf8', timeout: 90_000 })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

let fehler = 0
function fall(name: string, k: Kulisse, exit: 0 | 1, zeile: string, ohne?: string): void {
  const r = lauf(k)
  const ok = r.status === exit && r.aus.includes(zeile) && (!ohne || !r.aus.includes(ohne)) && !r.aus.includes('ENOENT')
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}: Exit ${r.status}, erwartet ${exit} mit „${zeile}“\n${r.aus.slice(-1200)}`)
}

fall('Quellen und Bestand passen', {}, 0, 'check-horizonte-staffeln-bestand: ok', '⚠ WARNUNG')
fall('Wikipedia zählt Staffel 2 anders: rot', { wiki: [45, 45, 46, 23] }, 1, 'Staffel 2: 44 Folgen, de.wikipedia 45')
fall('TOGGO zählt Staffel 3 anders: rot', { toggo: [45, 44, 48, 1] }, 1, 'Staffel 3: 47 Folgen, TOGGO 48')
fall('TOGGO führt Staffel 5: Warnzeile, grün', { toggo: [45, 44, 47, 24, 1] }, 0, '⚠ WARNUNG Horizonte-Staffeln: TOGGO führt Staffel 5')
fall('Wikipedia ohne den Titel: Warnzeile, grün', { wiki: undefined }, 0, '⚠ WARNUNG Horizonte-Staffeln: de.wikipedia')
fall('Detaildatei fehlt: Meldung statt Absturz', { s: null }, 1, `Detaildatei public/data/folgen/${ID}.json fehlt`)
fall('Detaildatei ohne Staffeln: rot', { s: 0 }, 1, 'Detaildatei trägt 0 Staffeln')
fall('Kopfzählung unter der letzten belegten Folge: rot', { kopf: 122 }, 1, 'Kopfzählung 122 Folgen, belegt sind 137')
fall('Kopfzählung genau an der letzten belegten Folge: grün', { kopf: 137 }, 0, 'check-horizonte-staffeln-bestand: ok')

const liste = readFileSync(join(REPO, 'tools/check-bestand-liste.txt'), 'utf8').split('\n').map((z) => z.trim())
if (liste.includes(SKRIPT)) console.log('  ✓ Wächter steht in tools/check-bestand-liste.txt')
else {
  fehler++
  console.error(`  ✖ ${SKRIPT} fehlt in tools/check-bestand-liste.txt`)
}

if (fehler) process.exit(1)
console.log('check-horizonte-staffeln-bestand-lauf: ok (9 Fälle und Listeneintrag)')
