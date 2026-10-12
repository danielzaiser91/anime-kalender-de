#!/usr/bin/env node
/**
 * Hält zwei Stände von `public/data/franchises.json` gegeneinander — alle Reihen auf einmal statt
 * Stichproben: Reihenname, Anzahl Titel, Reihenfolge der Glieder, Beschriftung ("Staffel 2 - Teil 1")
 * und Staffelstand ("2/4") je Glied, so wie die Reihen-Box sie zeigt.
 *
 * Beschriftung und Staffelstand sind Rechnungen aus `shared/titles.ts`; sie werden je Stand mit dem
 * Code des jeweiligen Commits berechnet (`git archive … shared`, Ablage `$TMPDIR/reihen-vergleich/`).
 * So zeigt der Vergleich auch eine Regeländerung bei unveränderten Daten. Gebaut wird nichts: ein Lauf
 * dauert Sekunden, `bau-vergleich.mjs` ist für Umbauten von `pipeline/build.ts`.
 *
 * Aufruf:
 *   node tools/reihen-vergleich.mjs [basis] [kandidat] [--json]    Vorgabe: origin/main gegen HEAD
 * Exit 0 = gleich, 1 = verschieden (wie `bau-vergleich.mjs`).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'
import { beschreibeReihen, berechneReihen, vergleicheReihen } from './reihen-vergleich-logik.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const ABLAGE = join(tmpdir(), 'reihen-vergleich')
const git = (...args) => execFileSync('git', ['-C', WURZEL, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

/** Lädt `shared/titles.ts` aus dem Commit `sha`; die Ablage je Commit wird wiederverwendet. */
async function ladeTitelModul(sha) {
  const ordner = join(ABLAGE, sha.slice(0, 12))
  if (!existsSync(join(ordner, 'shared/titles.ts'))) {
    mkdirSync(ordner, { recursive: true })
    git('archive', '--format=tar', `--output=${join(ordner, 'shared.tar')}`, sha, 'shared')
    // Relativ zum Ordner: ein Laufwerksbuchstabe im Pfad hielte GNU-tar für einen Rechnernamen.
    execFileSync('tar', ['-xf', 'shared.tar'], { cwd: ordner })
  }
  return tsImport(pathToFileURL(join(ordner, 'shared/titles.ts')).href, import.meta.url)
}

async function stand(sha) {
  const lies = (datei) => JSON.parse(git('show', `${sha}:public/data/${datei}`))
  const titelDe = new Map(lies('titles.json').map((t) => [t.id, t.titleDe]))
  return berechneReihen(lies('franchises.json'), titelDe, await ladeTitelModul(sha))
}

const json = process.argv.includes('--json')
const [basisName, kandidatName] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const basis = git('rev-parse', basisName ?? 'origin/main')
const kandidat = git('rev-parse', kandidatName ?? 'HEAD')
const v = vergleicheReihen(await stand(basis), await stand(kandidat))
const gleich = !v.neu.length && !v.weg.length && !v.geaendert.length
if (json) console.log(JSON.stringify({ basis, kandidat, gleich, ...v }, null, 2))
else if (gleich) console.log(`gleich: ${v.gleich} Reihen, ${kandidat.slice(0, 12)} gegen ${basis.slice(0, 12)}`)
else {
  for (const zeile of beschreibeReihen(v)) console.log(zeile)
  console.log(`VERSCHIEDEN — ${kandidat.slice(0, 12)} gegen ${basis.slice(0, 12)}`)
}
process.exit(gleich ? 0 : 1)
