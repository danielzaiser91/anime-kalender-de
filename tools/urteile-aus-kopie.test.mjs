/**
 * Prüft `tools/urteile-aus-kopie.mjs` mit einer synthetischen Mini-Kopie und einem Mini-Baum: Der Vorlader beantwortet beide
 * Worker-Seiten aus der SQLite-Datei (Prozess mit echtem Kind), der Lauf schreibt nur in die Wegwerf-Wurzel, Filter und Vergleich
 * rechnen je Schlüssel, Fehler (fehlende Kopie, fehlende Eingabe, Absturz des Laufs) werden laut.
 * Aufruf: node tools/urteile-aus-kopie.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EINGABEN, antworte, d1Attrappe, filtere, oeffneKopie, vergleiche, zaehle } from './urteile-aus-kopie.mjs'

const TOOL = join(dirname(fileURLToPath(import.meta.url)), 'urteile-aus-kopie.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'urteile-kopie-test-'))
/* Aufräumen auch bei fehlgeschlagener Zusicherung (der Exit-Handler läuft in beiden Fällen). */
process.on('exit', () => rmSync(ordner, { recursive: true, force: true }))
/* Die Kindläufe bekommen einen eigenen Temp-Ordner: parallele Läufe anderer Tests zählen nicht mit. */
const eigenesTmp = join(ordner, 'tmp')
mkdirSync(eigenesTmp)
const schreibe = (pfad, text) => {
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, text)
}

/* Reine Teile: Filter, Vergleich, Zählung (verschiedene Werte, damit vertauschte Argumente auffallen). */
const alt = { '1|adn|1': { urteil: 'deutsch' }, '1|adn|2': { urteil: 'deutsch' }, '2|netflix|1': { urteil: 'kein deutsch', grund: 'x' } }
const neu = { '1|adn|1': { urteil: 'deutsch' }, '1|adn|2': { urteil: 'kein deutsch' }, '3|adn|1': { urteil: 'deutsch' } }
assert.deepEqual(vergleiche(alt, neu), { neu: ['3|adn|1'], weg: ['2|netflix|1'], anders: ['1|adn|2'] })
assert.deepEqual(vergleiche(neu, alt), { neu: ['2|netflix|1'], weg: ['3|adn|1'], anders: ['1|adn|2'] })
assert.deepEqual(vergleiche({ a: { urteil: 'x', grund: 'g' } }, { a: { urteil: 'x', grund: 'h' } }).anders, ['a'])
assert.deepEqual(Object.keys(filtere(neu, '1', undefined)), ['1|adn|1', '1|adn|2'])
assert.deepEqual(Object.keys(filtere(neu, '1,3', 'adn')), ['1|adn|1', '1|adn|2', '3|adn|1'])
assert.deepEqual(Object.keys(filtere(alt, undefined, 'netflix')), ['2|netflix|1'])
assert.equal(Object.keys(filtere(alt, '9', undefined)).length, 0)
assert.deepEqual(zaehle(alt), { deutsch: 2, 'kein deutsch (x)': 1 })

/* Abfrage-Adressen: Meldungen, Rohfolgen, unbekannt; die D1-Attrappe liest nur. */
const db = new DatabaseSync(':memory:')
db.exec("CREATE TABLE t (a INTEGER, b TEXT); INSERT INTO t VALUES (1,'x'),(2,'y')")
const d1 = d1Attrappe(db)
assert.deepEqual((await d1.prepare('SELECT b FROM t WHERE a = ?').bind(2).first()).b, 'y')
assert.equal(await d1.prepare('SELECT b FROM t WHERE a = ?').bind(9).first(), null)
assert.deepEqual((await d1.prepare('SELECT a FROM t ORDER BY a').raw()), [[1], [2]])
const fns = {
  allePruefungen: async (_e, nach) => ({ zeilen: [{ nach }], weiter: null }),
  alleRohfolgen: async (_e, nach) => ({ zeilen: [{ roh: nach }], weiter: 7 }),
}
const bei = (q) => antworte(new URL(`https://x/pruefung?${q}`), {}, fns)
assert.deepEqual(await bei('alle=1&nach=5'), { status: 200, body: '{"pruefungen":[{"nach":5}],"weiter":null}' })
assert.deepEqual(await bei('rohfolgen=1&alle=1&nach=3'), { status: 200, body: '{"folgen":[{"roh":3}],"weiter":7}' })
assert.equal((await bei('rohfolgen=1')).status, 404)
assert.equal((await bei('offen=1')).status, 404)

/* Mini-Baum: Eingaben, zwei Worker-Dateien (Prozess-Test mit echtem Kind) und ein Läufer, der beide Seiten abruft. */
const baum = join(ordner, 'baum')
schreibe(join(baum, 'package.json'), '{"type":"module"}')
for (const teile of EINGABEN) schreibe(join(baum, ...teile), '{}')
schreibe(join(baum, 'worker', 'src', 'titelzeile-lesen.ts'), "export async function allePruefungen(env, nach) { const { results } = await env.DB.prepare('SELECT adresse, urteil FROM m WHERE id > ?').bind(nach).all(); return { zeilen: results, weiter: null } }\n")
schreibe(join(baum, 'worker', 'src', 'rohfolgen-seiten.ts'), "export async function alleRohfolgen(env, nach) { return { zeilen: [{ nach }], weiter: null } }\n")
schreibe(
  join(baum, 'pipeline', 'fetch-urteile.ts'),
  `import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const a = await (await fetch('https://w/pruefung?alle=1&nach=0')).json()
const r = await (await fetch('https://w/pruefung?rohfolgen=1&alle=1&nach=0')).json()
for (const d of [['data', 'dub-confirmed.yaml'], ['public', 'data', 'titles.json']]) if (!existsSync(join(process.env.AK_ROOT, ...d))) throw new Error('Eingabe fehlt in der Wurzel: ' + d.join('/'))
mkdirSync(join(process.env.AK_ROOT, 'data'), { recursive: true })
const u = {}
for (const z of a.pruefungen) u[z.adresse + '|primevideo|1'] = { urteil: z.urteil }
u['9|adn|' + r.folgen.length] = { urteil: 'unbekannt' }
writeFileSync(join(process.env.AK_ROOT, 'data', 'urteile.json'), JSON.stringify(u))
`,
)
const kopie = join(ordner, 'meldungen.sqlite')
const k = new DatabaseSync(kopie)
k.exec("CREATE TABLE m (id INTEGER, adresse TEXT, urteil TEXT); INSERT INTO m VALUES (1,'111','deutsch'),(2,'222','kein deutsch'),(3,'333','deutsch')")
k.close()

const fahre = (...args) =>
  spawnSync(process.execPath, [TOOL, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, TMPDIR: eigenesTmp, TEMP: eigenesTmp, TMP: eigenesTmp },
  })
const wurzeln = () => readdirSync(eigenesTmp).filter((n) => n.startsWith('urteile-kopie-'))

/* Schreibschutz: die geöffnete Kopie lehnt ein INSERT ab und bleibt unverändert. */
const geschuetzt = await oeffneKopie(kopie)
assert.throws(() => geschuetzt.prepare("INSERT INTO m VALUES (4,'444','deutsch')").run(), /readonly/i)
assert.equal(geschuetzt.prepare('SELECT count(*) AS n FROM m').get().n, 3)
geschuetzt.close()

const vor = wurzeln().length
const lauf = fahre('--baum', baum, '--kopie', kopie)
assert.equal(lauf.status, 0, lauf.stderr)
assert.deepEqual(Object.keys(JSON.parse(lauf.stdout)).sort(), ['111|primevideo|1', '222|primevideo|1', '333|primevideo|1', '9|adn|1'])
assert.match(lauf.stderr, /2 Seiten aus /)
assert.match(lauf.stderr, /4 Urteile: 2 deutsch, 1 kein deutsch, 1 unbekannt/)
assert.equal(wurzeln().length, vor, 'Wegwerf-Wurzel bleibt liegen')

const gefiltert = fahre('--baum', baum, '--kopie', kopie, '--titel', '222,9', '--anbieter', 'primevideo')
assert.deepEqual(Object.keys(JSON.parse(gefiltert.stdout)), ['222|primevideo|1'])

const vglDatei = join(ordner, 'vergleich.json')
writeFileSync(vglDatei, JSON.stringify({ '111|primevideo|1': { urteil: 'kein deutsch' }, '7|adn|1': { urteil: 'deutsch' } }))
const mitVergleich = fahre('--baum', baum, '--kopie', kopie, '--vergleich', vglDatei, '--aus', join(ordner, 'aus.json'))
assert.equal(mitVergleich.status, 0, mitVergleich.stderr)
assert.match(mitVergleich.stderr, /gegen Vergleich: 3 neu, 1 weg, 1 anders/)
assert.equal(Object.keys(JSON.parse(readFileSync(join(ordner, 'aus.json'), 'utf8'))).length, 4)
assert.match(mitVergleich.stderr, /^ {2}anders: 111\|primevideo\|1$/m)
assert.match(mitVergleich.stderr, /^ {2}weg: 7\|adn\|1$/m)
assert.match(mitVergleich.stderr, /^ {2}neu: 222\|primevideo\|1$/m)

/* Fehlerfälle: laut statt still. */
const ohneKopie = fahre('--baum', baum, '--kopie', join(ordner, 'gibt-es-nicht.sqlite'))
assert.notEqual(ohneKopie.status, 0)
assert.match(ohneKopie.stderr, /Meldungskopie fehlt/)
const ohneEingabe = join(ordner, 'baum-leer')
schreibe(join(ohneEingabe, 'pipeline', 'fetch-urteile.ts'), '')
const e = fahre('--baum', ohneEingabe, '--kopie', kopie)
assert.notEqual(e.status, 0)
assert.match(e.stderr, /Eingabe fehlt im Baum: data.folgen/)
assert.equal(existsSync(join(ordner, 'baum-leer', 'data', 'urteile.json')), false)
schreibe(join(baum, 'pipeline', 'fetch-urteile.ts'), 'throw new Error("kaputt")\n')
const absturz = fahre('--baum', baum, '--kopie', kopie)
assert.notEqual(absturz.status, 0)
assert.match(absturz.stderr, /fetch-urteile endete mit 1/)
assert.equal(wurzeln().length, vor, 'Wegwerf-Wurzel nach Absturz liegen geblieben')

console.log('urteile-aus-kopie.test: ok (Filter, Vergleich, Zählung, Seiten aus der Kopie, Schreibschutz, Differenzzeilen, Wegwerf-Wurzel, 3 Fehlerfälle)')
