/**
 * Prozesstest der Ratschen-Zeile in `check-remake-zaehlung-bestand.ts` (13.11.2026): Das Skript liest `public/data` relativ zum Arbeitsordner und
 * läuft hier als eigener Prozess in einer Wegwerf-Kulisse mit genau 2 doppelten Staffelnummern ohne Neuverfilmung (`data` ist ein Link auf das
 * echte Verzeichnis, weil der Bau-Import Handlisten liest). Die Yaiba-Anlassfälle sind in der Kulisse rot (Exit 1) und hier erlaubt.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FranchiseMember } from '../shared/types.ts'

const REPO = resolve(import.meta.dirname, '..')
const tsx = pathToFileURL(join(REPO, 'node_modules/tsx/dist/esm/index.mjs')).href

/* Drei Fernsehstaffeln, die dritte nennt sich „Staffel 2": die Nummer 2 kommt doppelt vor (Muster Berserk). */
const reihe = (basis: number, name: string): FranchiseMember[] =>
  [
    { id: basis, name, format: 'TV', jpYear: 1997, episodes: 25, jpStart: '1997-10-07' },
    { id: basis + 1, name: `${name} (2016)`, format: 'TV', jpYear: 2016, episodes: 12, jpStart: '2016-07-01' },
    { id: basis + 2, name: `${name}: Staffel 2`, format: 'TV', jpYear: 2017, episodes: 12, jpStart: '2017-04-07', staffelQuelle: 2 },
  ] as FranchiseMember[]

const wurzel = mkdtempSync(join(tmpdir(), 'remake-zaehlung-bestand-'))
let r: { status: number | null; stdout: string; stderr: string }
try {
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  symlinkSync(join(REPO, 'data'), join(wurzel, 'data'))
  writeFileSync(join(wurzel, 'public/data/franchises.json'), JSON.stringify({ 1: reihe(1, 'Alpha'), 10: reihe(10, 'Beta') }))
  writeFileSync(join(wurzel, 'public/data/titles.json'), '[]')
  writeFileSync(join(wurzel, 'public/data/ohne-synchro.json'), '[]')
  r = spawnSync(process.execPath, ['--import', tsx, join(REPO, 'pipeline/check-remake-zaehlung-bestand.ts')], { cwd: wurzel, encoding: 'utf8', timeout: 90_000 })
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

const erwartet = 'Zählung: Bestand 2 liegt unter der Grenze 14, Grenze auf 2 nachziehen'
if (!r.stdout.includes(erwartet)) {
  console.error(`[check-remake-zaehlung-bestand-lauf] Zeile „${erwartet}“ fehlt (Exit ${r.status})\n${r.stdout.slice(-1500)}\n${r.stderr.slice(-1500)}`)
  process.exit(1)
}
console.log('[check-remake-zaehlung-bestand-lauf] 1 Fall grün (Ratschen-Zeile bei Bestand 2 unter Grenze 14 aus dem echten Skript)')
