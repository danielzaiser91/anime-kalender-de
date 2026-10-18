/**
 * Zusicherung: Eine Meldung an einer gti-Adresse (`watch.amazon.de/detail?gti=…`) ohne `titel_id` trifft nur den Titel mit
 * genau dieser Kennung (18.10.2026: ohne die Kennung im Schlüssel traf sie jeden Titel mit gti-Weg). Der Lauf liest dazu eine
 * erfundene Meldung gegen eine Attrappe des Bestands (`tools/meldung-gti-mock.mjs`), geschrieben wird nichts (`--trocken`).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { schluesselAdresse } from './lib/zuordnung.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-gti-mock.mjs')).href
const fehler: string[] = []

const A = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.5482d2e9-157c-411c-b5c3-7f3210286c90'
const B = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.2b4f6080-5781-4c1d-9fb8-c5b84c3c7531'
if (schluesselAdresse(A) === schluesselAdresse(B)) fehler.push('zwei gti-Kennungen teilen sich einen Schlüssel')
if (schluesselAdresse(A) !== schluesselAdresse(`http://www.watch.amazon.de/detail?ref_=x&gti=AMZN1.DV.GTI.5482D2E9-157C-411C-B5C3-7F3210286C90`)) {
  fehler.push('dieselbe gti-Kennung mit anderem Protokoll, Parameter oder Groß-/Kleinschreibung ergibt einen anderen Schlüssel')
}

const lauf = spawnSync(
  process.execPath,
  [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts'), '--trocken'],
  { cwd: wurzel, encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: 'test' } },
)
const titel = [...lauf.stdout.matchAll(/^- anilistId: (\d+)$/gm)].map((t) => t[1])
if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}`)
if (titel.join() !== '2') fehler.push(`Beleg für Titel ${titel.join(', ') || 'keinen'} statt nur für Titel 2`)
if (fehler.length) {
  console.error(`check-meldung-gti: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-meldung-gti: gti-Meldung ohne titel_id trifft nur ihren Titel (2 von 3).')
