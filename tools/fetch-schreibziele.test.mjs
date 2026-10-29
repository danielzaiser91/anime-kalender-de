/**
 * Erkennungsprobe von `tools/fetch-schreibziele.mjs`: jede Form, ein Schreibziel zu verstecken, muss das Ziel liefern oder `?` (rot),
 * jede lesende Nutzung von `node:fs` keines. Die Fälle sind Fixtures in einem Wegwerf-Ordner unter `os.tmpdir()`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fetchSchreibziele, zieleAusArgumenten } from './fetch-schreibziele.mjs'

const wurzel = mkdtempSync(join(tmpdir(), 'fetch-schreibziele-'))
const ZIEL = 'data/kennungen.json'
const UTIL = "import { writeFileSync } from 'node:fs'\nexport function writeJson(p: string, d: unknown): void { writeFileSync(p, String(d)) }\n"
const MOD = `import { writeJson } from './util.ts'\nwriteJson('${ZIEL}', {})\n`
let fehler = 0
let nr = 0

/** Legt die Dateien (`name → Text`) in einen frischen Ordner und liefert die Pfade der Ziele, sortiert; `paket` ist der Text der `package.json`. */
function scanne(dateien, paket) {
  const ordner = join(wurzel, `fall-${++nr}`)
  for (const [name, text] of Object.entries({ 'util.ts': UTIL, ...dateien })) {
    mkdirSync(dirname(join(ordner, name)), { recursive: true })
    writeFileSync(join(ordner, name), text)
  }
  if (paket !== undefined) writeFileSync(join(ordner, 'package.json'), paket)
  return fetchSchreibziele(join(ordner, 'fetch.ts'), paket === undefined ? undefined : join(ordner, 'package.json')).map((z) => z.pfad).sort()
}

function erwarte(name, ergebnis, soll) {
  const ok = ergebnis.join() === [...soll].sort().join()
  if (!ok) fehler++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — erkannt: [${ergebnis}], erwartet: [${soll}]`}`)
}

const fs = (zeilen) => ({ 'fetch.ts': zeilen.join('\n') + '\n' })
const GEFUNDEN = [ZIEL]
const OFFEN = ['?']
try {
  console.log('Erkannt mit festem Pfad')
  erwarte('Helfer mit Text', scanne(fs([`import { writeJson } from './util.ts'`, `writeJson('${ZIEL}', {})`])), GEFUNDEN)
  erwarte('writeFileSync mit const', scanne(fs([`import { writeFileSync } from 'node:fs'`, `const P = '${ZIEL}'`, 'writeFileSync(P, "")'])), GEFUNDEN)
  erwarte('appendFileSync', scanne(fs([`import { appendFileSync } from 'node:fs'`, `appendFileSync('${ZIEL}', '')`])), GEFUNDEN)
  erwarte('Namensraum-Import fs.writeFileSync', scanne(fs([`import * as fsx from 'node:fs'`, `fsx.writeFileSync('${ZIEL}', '')`])), GEFUNDEN)
  erwarte('Standard-Import fs.writeFileSync', scanne(fs([`import fsx from 'fs'`, `fsx.writeFileSync('${ZIEL}', '')`])), GEFUNDEN)
  erwarte('writeFile aus node:fs/promises', scanne(fs([`import { writeFile } from 'node:fs/promises'`, `void writeFile('${ZIEL}', '')`])), GEFUNDEN)
  erwarte('Alias writeJson as speichere', scanne(fs([`import { writeJson as speichere } from './util.ts'`, `speichere('${ZIEL}', {})`])), GEFUNDEN)
  erwarte('Alias von writeFileSync', scanne(fs([`import { writeFileSync as w } from 'node:fs'`, `w('${ZIEL}', '')`])), GEFUNDEN)
  erwarte('renameSync nennt Quelle und Ziel', scanne(fs([`import { renameSync } from 'node:fs'`, `renameSync('data/kennungen.tmp', '${ZIEL}')`])), ['data/kennungen.tmp', ZIEL])
  erwarte('copyFileSync nennt beide Pfade', scanne(fs([`import { copyFileSync } from 'node:fs'`, `copyFileSync('a.json', '${ZIEL}')`])), ['a.json', ZIEL])
  erwarte('rmSync', scanne(fs([`import { rmSync } from 'node:fs'`, `rmSync('${ZIEL}')`])), GEFUNDEN)
  erwarte('util.writeJson über Namensraum', scanne(fs([`import * as util from './util.ts'`, `util.writeJson('${ZIEL}', {})`])), GEFUNDEN)
  erwarte('clearDir', scanne(fs([`import { clearDir } from './util.ts'`, `clearDir('${ZIEL}')`])), GEFUNDEN)
  erwarte('Schreibaufruf im Argument eines Schreibaufrufs', scanne(fs([`import { writeJson } from './util.ts'`, `import { writeFileSync } from 'node:fs'`, `writeJson('data/a.json', writeFileSync('${ZIEL}', ''))`])), ['data/a.json', ZIEL])
  erwarte('Modul über import', scanne({ ...fs([`import './mod.ts'`]), 'mod.ts': MOD }), GEFUNDEN)
  erwarte('Modul über export * from', scanne({ ...fs([`export * from './mod.ts'`]), 'mod.ts': MOD }), GEFUNDEN)
  erwarte('Modul über export { } from', scanne({ ...fs([`export { x } from './mod.ts'`]), 'mod.ts': MOD }), GEFUNDEN)
  erwarte('Modul über import() ohne Bindung am Schreiber', scanne({ ...fs([`const { x } = await import('./mod.ts')`, 'void x']), 'mod.ts': MOD }), GEFUNDEN)
  erwarte('Helfer aus import() mit Alias', scanne(fs([`const { writeJson: w } = await import('./util.ts')`, `w('${ZIEL}', {})`])), GEFUNDEN)
  erwarte('Helfer aus import() als Namensraum', scanne(fs([`const u = await import('./util.ts')`, `u.writeJson('${ZIEL}', {})`])), GEFUNDEN)

  console.log('Nicht auflösbar: ?')
  erwarte('Pfad aus let', scanne(fs([`import { writeJson } from './util.ts'`, `let p = '${ZIEL}'`, 'writeJson(p, {})'])), OFFEN)
  erwarte('const von einer inneren Variable gleichen Namens verdeckt', scanne(fs([`import { writeJson } from './util.ts'`, `const P = 'data/alt.json'`, `export function f() { const P = '${ZIEL}'; writeJson(P, {}) }`])), OFFEN)
  erwarte('Pfad berechnet', scanne(fs([`import { writeFileSync } from 'node:fs'`, 'writeFileSync(ziel(), "")'])), OFFEN)
  erwarte('Pfad als Vorlage mit Platzhalter', scanne(fs([`import { writeJson } from './util.ts'`, 'writeJson(`data/${1}.json`, {})'])), OFFEN)
  erwarte('Schreibname von fs ohne Argument', scanne(fs([`import * as fsx from 'node:fs'`, 'fsx.writeFileSync()'])), OFFEN)
  erwarte('fs-Funktion zugewiesen', scanne(fs([`import { writeFileSync } from 'node:fs'`, 'const w = writeFileSync', 'void w'])), OFFEN)
  erwarte('fs-Funktion als Argument', scanne(fs([`import { writeFileSync } from 'node:fs'`, 'void [1].map(writeFileSync)'])), OFFEN)
  erwarte('Namensraum zugewiesen', scanne(fs([`import * as fsx from 'node:fs'`, 'const f = fsx', 'void f'])), OFFEN)
  erwarte('Namensraum mit Klammerzugriff', scanne(fs([`import * as fsx from 'node:fs'`, `fsx['writeFileSync']('${ZIEL}', '')`])), OFFEN)
  erwarte('fs.promises.writeFile', scanne(fs([`import * as fsx from 'node:fs'`, `void fsx.promises.writeFile('${ZIEL}', '')`])), OFFEN)
  erwarte('Helfer-Namensraum zugewiesen', scanne(fs([`import * as util from './util.ts'`, 'const u = util', 'void u'])), OFFEN)
  erwarte('Helfer zugewiesen', scanne(fs([`import { writeJson } from './util.ts'`, 'const w = writeJson', 'void w'])), OFFEN)
  erwarte('import() von node:fs', scanne(fs([`const f = await import('node:fs')`, 'void f'])), OFFEN)
  erwarte('import() von node:child_process', scanne(fs([`const c = await import('node:child_process')`, 'void c'])), OFFEN)
  erwarte('import() mit berechnetem Namen', scanne(fs(['const m = await import(`./${1}.ts`)', 'void m'])), OFFEN)
  erwarte('import() ohne Bindung an einen Namen', scanne(fs([`void import('./util.ts')`])), OFFEN)
  erwarte('import() mit Rest-Destrukturierung', scanne(fs([`const { ...alle } = await import('./util.ts')`, 'void alle'])), OFFEN)
  erwarte('export * as aus einem Modul', scanne(fs([`export * as u from './util.ts'`])), OFFEN)
  erwarte('export von writeJson unter anderem Namen', scanne(fs([`export { writeJson as speichere } from './util.ts'`])), OFFEN)
  erwarte('export * from node:fs', scanne(fs([`export * from 'node:fs'`])), OFFEN)
  erwarte('require', scanne(fs([`const f = require('node:fs')`, 'void f'])), OFFEN)
  erwarte('createRequire', scanne(fs([`import { createRequire } from 'node:module'`, 'void createRequire'])), ['?', '?'])
  erwarte('globalThis[...]', scanne(fs(["void globalThis['process']"])), OFFEN)
  erwarte('child_process', scanne(fs([`import { execSync } from 'node:child_process'`, 'execSync("")'])), OFFEN)
  erwarte('Import = require', scanne(fs([`import fsx = require('node:fs')`, 'void fsx'])), OFFEN)
  erwarte('relatives Modul fehlt', scanne(fs([`import './gibt-es-nicht.ts'`])), OFFEN)

  console.log('Lesen und Fremdes bleibt leer')
  erwarte('readFileSync und existsSync', scanne(fs([`import { readFileSync, existsSync } from 'node:fs'`, `if (existsSync('${ZIEL}')) readFileSync('${ZIEL}')`])), [])
  erwarte('Lesefunktion unter Alias', scanne(fs([`import { readFileSync as lies } from 'node:fs'`, `lies('${ZIEL}')`])), [])
  erwarte('Namensraum nur lesend', scanne(fs([`import * as fsx from 'node:fs'`, `fsx.readFileSync('${ZIEL}')`])), [])
  erwarte('readFile aus fs/promises', scanne(fs([`import { readFile } from 'node:fs/promises'`, `void readFile('${ZIEL}')`])), [])
  erwarte('Helfer-Definition selbst', scanne(fs(["import './util.ts'"])), [])
  erwarte('anderer Aufruf über den Helfer-Namensraum', scanne(fs([`import * as util from './util.ts'`, `util.leseJson('${ZIEL}')`])), [])
  erwarte('Helfer ohne Import (lokal definiert) mit Text', scanne(fs([`writeJson('${ZIEL}', {})`])), GEFUNDEN)
  erwarte('fremdes Paket ohne Schreiben', scanne(fs([`import ts from 'typescript'`, 'void ts'])), [])
  erwarte('fs-Name als Eigenschaft eines anderen Objekts', scanne(fs([`import { writeJson } from './util.ts'`, 'const o = { writeJson: 1 }', 'void o.writeJson'])), [])

  console.log('data:fetch startet genau die Startdatei')
  const stand = fs([`import { writeJson } from './util.ts'`, `writeJson('${ZIEL}', {})`])
  const paket = (befehl) => JSON.stringify({ scripts: { 'data:fetch': befehl } })
  erwarte('tsx fetch.ts', scanne(stand, paket('tsx fetch.ts')), GEFUNDEN)
  erwarte('ein zweiter Einstieg', scanne(stand, paket('tsx fetch.ts && tsx anderes.ts')), ['?', ZIEL])
  erwarte('anderer Einstieg', scanne(stand, paket('tsx andere.ts')), ['?', ZIEL])
  erwarte('Skript fehlt', scanne(stand, JSON.stringify({ scripts: {} })), ['?', ZIEL])
  erwarte('package.json kaputt', scanne(stand, '{'), ['?', ZIEL])

  console.log('Kommandozeile: Standard-Start mit package.json, eigener Start ohne')
  const wurzelMit = (befehl) => {
    const ordner = join(wurzel, `cli-${++nr}`)
    mkdirSync(join(ordner, 'pipeline'), { recursive: true })
    writeFileSync(join(ordner, 'pipeline/fetch.ts'), `import { writeJson } from './util.ts'\nwriteJson('${ZIEL}', {})\n`)
    writeFileSync(join(ordner, 'pipeline/util.ts'), UTIL)
    writeFileSync(join(ordner, 'package.json'), paket(befehl))
    return ordner
  }
  const pfade = (z) => z.map((x) => x.pfad).sort()
  erwarte('ohne Argument, Skript stimmt', pfade(zieleAusArgumenten([], wurzelMit('tsx pipeline/fetch.ts'))), GEFUNDEN)
  erwarte('ohne Argument, Skript startet anderes', pfade(zieleAusArgumenten([], wurzelMit('tsx pipeline/anders.ts'))), ['?', ZIEL])
  const eigenerStart = wurzelMit('tsx pipeline/anders.ts')
  erwarte('eigener Start, package.json bleibt ungeprüft', pfade(zieleAusArgumenten([join(eigenerStart, 'pipeline/fetch.ts')], eigenerStart)), GEFUNDEN)
  erwarte('eigener Start mit eigener package.json', pfade(zieleAusArgumenten([join(eigenerStart, 'pipeline/fetch.ts'), join(eigenerStart, 'package.json')], eigenerStart)), ['?', ZIEL])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(fehler ? `fetch-schreibziele: ${fehler} rot.` : 'fetch-schreibziele: grün.')
process.exit(fehler ? 1 : 0)
