/**
 * Die Aufrufformen aus Runde 1 von PR 1426, die der statische Wächter nicht erkennt (17.10.2026), echt ausgeführt:
 * Vor der Freigabe durch `commit-data.sh` quittiert keine davon etwas, weil die Sperre im Skript sitzt
 * (`pipeline/lib/spaeter-quittieren.ts`, `pipeline/lib/schalter.ts`), nicht in der Schreibweise des Schritts.
 * Kontrolle: Nach der Freigabe quittiert die schlichte Form wirklich (sonst bewiese das Schweigen nichts).
 * Abrufe zeichnet `tools/quittung-aufzeichner-mock.mjs` auf (per NODE_OPTIONS in jedem Node-Prozess der Kette);
 * der Worker ist eine nicht erreichbare Adresse. Die beiden `pnpm`-Formen fehlen: pnpm ist nicht überall installiert.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const wurzel = join(import.meta.dirname, '..')
const kulisse = mkdtempSync(join(tmpdir(), 'quittung-umgehungen-'))
const offen = join(kulisse, 'data/cache/quittung-offen')
const frei = join(kulisse, 'data/cache/quittung-frei')
const R = 'rohfolgen-abhaken.ts'

/** [Name, Befehl, Unterordner] — Name gleich der Form im Prüferkommentar, wo sie dort steht. */
const FORMEN = [
  ['npm --prefix . run', `npm --prefix . run data:rohfolgen-abhaken`],
  ['npm run --silent', `npm run --silent data:rohfolgen-abhaken`],
  ['npm -s run', `npm -s run data:rohfolgen-abhaken`],
  ['env X=1', `env X=1 npm run data:rohfolgen-abhaken`],
  ['timeout 60', `timeout 60 npm run data:rohfolgen-abhaken`],
  ['Unterschale', `(npm run data:rohfolgen-abhaken)`],
  ['if', `if true; then npm run data:rohfolgen-abhaken; fi`],
  ['bash -c npm', `bash -c "npm run data:rohfolgen-abhaken"`],
  ['bash -c npx', `bash -c 'npx tsx pipeline/${R}'`],
  ['npm run "…"', `npm run "data:rohfolgen-abhaken"`],
  ['npx tsx "…"', `npx tsx "pipeline/${R}"`],
  ['Umleitung ohne Leerraum', `npx tsx pipeline/${R}>"$AK_ROOT/log.txt"`],
  ['$PWD', `npx tsx $PWD/pipeline/${R}`],
  ['cd pipeline &&', `cd pipeline && npx tsx ${R}`],
  ['working-directory: pipeline', `npx tsx ${R}`, 'pipeline'],
  ['node --import', `node --import tsx --import ./tools/quittung-aufzeichner-mock.mjs pipeline/${R}`],
  ['vorfaelle -- "--nur-loeschen"', `npm run data:vorfaelle -- "--nur-loeschen"`],
  ['vorfaelle -- --nur-loeschen=1', `npm run data:vorfaelle -- --nur-loeschen=1`],
  ['pruefungen --abhaken-spaeter ohne --', `npm run data:pruefungen --abhaken-spaeter`],
  ['pruefungen --nur-abhaken ohne --', `npm run data:pruefungen --nur-abhaken`],
  // Formen, die auch eine Textregel („jede Zeile mit rohfolgen-abhaken …") nicht sähe.
  ['Variable', `S=abhaken; npm run "data:rohfolgen-$S"`],
  ['eval', `eval "npm run data:rohfolgen-ab""haken"`],
  ['Skriptdatei', `bash "$AK_ROOT/schritt.sh"`],
]

const umgebung = (aufzeichnung) => ({
  ...process.env,
  AK_ROOT: kulisse,
  AK_AUFZEICHNUNG: aufzeichnung,
  LAUF_TOKEN: 'test',
  LAUF_WORKER: 'http://127.0.0.1:9',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${pathToFileURL(join(wurzel, 'tools/quittung-aufzeichner-mock.mjs')).href}`,
})

function fuehreAus(name, befehl, ordner = '.') {
  const aufzeichnung = join(kulisse, `${name.replaceAll(/\W+/g, '-')}.jsonl`)
  return new Promise((fertig) => {
    const kind = spawn('bash', ['-c', befehl], { cwd: join(wurzel, ordner), env: umgebung(aufzeichnung), stdio: ['ignore', 'ignore', 'pipe'] })
    let fehler = ''
    kind.stderr.on('data', (d) => (fehler += d))
    kind.on('close', (status) => {
      const zeilen = existsSync(aufzeichnung) ? readFileSync(aufzeichnung, 'utf8').trim().split('\n').filter(Boolean).map((z) => JSON.parse(z)) : []
      fertig({ name, status, fehler, quittiert: zeilen.filter((z) => z.methode === 'POST' || z.methode === 'DELETE') })
    })
  })
}

try {
  mkdirSync(offen, { recursive: true })
  for (const datei of ['rohfolgen-abhaken.json', 'vorfaelle-loeschen.json', 'pruefungen-abhaken.json']) writeFileSync(join(offen, datei), '[1]')
  writeFileSync(join(kulisse, 'schritt.sh'), 'npm run data:rohfolgen-abhaken\n')
  const ergebnisse = []
  for (let i = 0; i < FORMEN.length; i += 5) ergebnisse.push(...(await Promise.all(FORMEN.slice(i, i + 5).map((f) => fuehreAus(...f)))))
  for (const e of ergebnisse) assert.deepEqual(e.quittiert, [], `${e.name} quittiert vor der Freigabe (Exit ${e.status}): ${e.fehler.slice(-300)}`)
  // Ein geschluckter Schalter oder einer mit Wert bricht ab, statt still den anderen Zweig zu nehmen.
  for (const name of ['vorfaelle -- --nur-loeschen=1', 'pruefungen --abhaken-spaeter ohne --', 'pruefungen --nur-abhaken ohne --']) {
    const e = ergebnisse.find((x) => x.name === name)
    assert.ok(e.status !== 0 && e.fehler.includes('✖'), `${name} läuft durch oder scheitert anders (Exit ${e.status}): ${e.fehler.slice(-300)}`)
  }
  assert.ok(existsSync(join(offen, 'rohfolgen-abhaken.json')), 'eine Form hat den Merker angefasst')

  // Kontrolle: nach der Freigabe quittiert die schlichte Form (Abruf an die nicht erreichbare Adresse, aufgezeichnet).
  mkdirSync(frei, { recursive: true })
  renameSync(join(offen, 'rohfolgen-abhaken.json'), join(frei, 'rohfolgen-abhaken.json'))
  const kontrolle = await fuehreAus('kontrolle', `npm run data:rohfolgen-abhaken`)
  assert.equal(kontrolle.quittiert.length, 1, `Kontrolle quittiert nicht: ${kontrolle.fehler.slice(-300)}`)
  // Die Adresse ist nicht erreichbar: Der Merker bleibt für den nächsten Lauf liegen.
  assert.ok(existsSync(join(frei, 'rohfolgen-abhaken.json')), 'ein Netzfehler hat den Merker gelöscht')
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
console.log(`quittung-umgehungen.test: ${FORMEN.length} Formen quittieren vor der Freigabe nichts, Kontrolle quittiert.`)
