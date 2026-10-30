/**
 * Prüft das Werkzeug für die Meldungskopie (`tools/meldungskopie*.mjs`): Auszug nur der drei Meldungstabellen, Kopie mit Indexen und Sicht,
 * Abfrage an einer Wegwerf-Kopie, Holen nur bei neuerem Lauf, Ziehen nur im Lauf, und der Zeitplan hält die Kopie unter 36 Stunden alt.
 * Aufruf: node tools/meldungskopie.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import { fileURLToPath } from 'node:url'
import { TABELLEN, SCHEMA_ABFRAGE, baueKopie, exportArgumente, schemaArgumente, schemaAusJson } from './meldungskopie-bauen.mjs'
import { STAND_MAX_STUNDEN, alterStunden, fuehreAus, fusszeile, istEinzeln } from './meldungskopie-abfrage.mjs'
import { ARTEFAKT, ARTEFAKT_DATEI, DATEINAME, WORKFLOW, holen, lokalerStand } from './meldungskopie-holen.mjs'
import { entschluessle, verschluessle } from './meldungskopie-schluessel.mjs'
import { mitFehlertext, wranglerAus, ziehen } from './meldungskopie-ziehen.mjs'

const WURZEL = join(fileURLToPath(import.meta.url), '..', '..')
const ordner = mkdtempSync(join(tmpdir(), 'meldungskopie-test-'))
const lies = (pfad) => readFileSync(join(WURZEL, pfad), 'utf8')

/** Ein Export im Format von `wrangler d1 export --table …`: Tabellen ohne Indexe, Zeilenumbruch als replace(…, char(10)). */
const EXPORT = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE pruefung (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  titel TEXT,
  gemeldet_am TEXT NOT NULL
);
INSERT INTO "pruefung" ("id","url","titel","gemeldet_am") VALUES(1,'https://y/1',replace('T1\\nzweite Zeile','\\n',char(10)),'2026-10-01');
INSERT INTO "pruefung" ("id","url","titel","gemeldet_am") VALUES(2,'https://y/2','T2','2026-10-02');
CREATE TABLE prime_folge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  uebernommen INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "prime_folge" ("id","url","uebernommen") VALUES(1,'https://x/1',0);
INSERT INTO "prime_folge" ("id","url","uebernommen") VALUES(2,'https://x/1',1);
INSERT INTO "prime_folge" ("id","url","uebernommen") VALUES(3,'https://x/2',0);
CREATE TABLE titel_zeile (
  url TEXT NOT NULL,
  plattform TEXT NOT NULL,
  nr INTEGER NOT NULL,
  daten TEXT NOT NULL,
  PRIMARY KEY (url, plattform)
) WITHOUT ROWID;
INSERT INTO "titel_zeile" ("url","plattform","nr","daten") VALUES('https://d/1','disneyplus',1,'{"t":"Serie","f":[[1,1],[1,2]]}');
`
const SCHEMA = [
  'CREATE INDEX pruefung_url_zeit ON pruefung (url, gemeldet_am DESC)',
  'CREATE INDEX prime_folge_offen ON prime_folge (id) WHERE uebernommen = 0',
  "CREATE VIEW pruefung_titel AS SELECT t.url AS url, json_extract(f.value, '$[1]') AS folge_nr FROM titel_zeile t, json_each(t.daten, '$.f') f",
]
/** Was `wrangler d1 execute --json` ausgibt, mit Banner davor (eine Zeile mit „[“ darin, aber nicht allein). */
const SCHEMA_JSON = `[wrangler:info] Resolved config\n🌀 Executing on remote database\n${JSON.stringify([{ results: SCHEMA.map((sql) => ({ sql })), success: true }], null, 2)}\n`

const kopie = (name, stand, exportSql = EXPORT) => {
  const ziel = join(ordner, name)
  baueKopie({ exportSql, schemaSql: SCHEMA, stand, ziel })
  return ziel
}
const zaehle = (datei, tabelle) => {
  const db = new DatabaseSync(datei, { readOnly: true })
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM ${tabelle}`).get().n
  } finally {
    db.close()
  }
}

/* ---- Auszug: nur die Meldungstabellen, nur lesend, mit den Argumenten, auf die es ankommt ---- */
assert.deepEqual(TABELLEN, ['pruefung', 'prime_folge', 'titel_zeile'])
assert.deepEqual(exportArgumente('db', '/x/e.sql', 'w.toml'), [
  'd1', 'export', 'db', '--remote', '--config', 'w.toml',
  '--table', 'pruefung', '--table', 'prime_folge', '--table', 'titel_zeile', '--output', '/x/e.sql', '--skip-confirmation',
])
const schemaArgs = schemaArgumente('db', 'w.toml')
assert.deepEqual(schemaArgs.slice(0, 7), ['d1', 'execute', 'db', '--remote', '--config', 'w.toml', '--json'])
assert.equal(schemaArgs.at(-1), SCHEMA_ABFRAGE)
for (const t of [...TABELLEN, 'pruefung_titel']) assert.match(SCHEMA_ABFRAGE, new RegExp(`'${t}'`))
assert.doesNotMatch(SCHEMA_ABFRAGE, /subscribers|push_abo|cr_zugang/)
{
  // Die Abfrage selbst: liefert Indexe und Sicht der Meldungstabellen, aber keinen Index einer fremden Tabelle.
  const db = new DatabaseSync(':memory:')
  db.exec(`${EXPORT}${SCHEMA.join(';')};CREATE TABLE subscribers (email TEXT); CREATE INDEX subscribers_email ON subscribers (email); CREATE TABLE d (x); CREATE VIEW fremd AS SELECT 1 AS x`)
  assert.deepEqual(db.prepare(SCHEMA_ABFRAGE).all().map((z) => z.sql).sort(), [...SCHEMA].sort())
  db.close()
}

/* ---- Schemaabfrage lesen ---- */
assert.deepEqual(schemaAusJson(SCHEMA_JSON), SCHEMA)
assert.throws(() => schemaAusJson('kein JSON'), /keine JSON-Liste/)
assert.throws(() => schemaAusJson(`[\n  { "results": [], "success": true }\n]`), /keine Indexe/)

/* ---- Kopie bauen ---- */
const stand = '2026-10-14T03:00:00.000Z'
const basis = kopie('basis.sqlite', stand)
assert.deepEqual([zaehle(basis, 'pruefung'), zaehle(basis, 'prime_folge'), zaehle(basis, 'titel_zeile')], [2, 3, 1])
assert.equal(lokalerStand(basis), stand)
assert.equal(lokalerStand(join(ordner, 'gibt-es-nicht.sqlite')), '')
{
  const db = new DatabaseSync(basis, { readOnly: true })
  assert.equal(db.prepare("SELECT titel FROM pruefung WHERE id = 1").get().titel, 'T1\nzweite Zeile')
  const indexe = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all().map((z) => z.name).sort()
  assert.deepEqual(indexe, ['prime_folge_offen', 'pruefung_url_zeit'])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pruefung_titel').get().n, 2)
  db.close()
}
// Newsletter-Adressen oder andere Tabellen im Export: abgelehnt, nichts bleibt liegen.
assert.throws(
  () => kopie('fremd.sqlite', stand, `${EXPORT}CREATE TABLE subscribers (email TEXT);\nINSERT INTO "subscribers" ("email") VALUES('a@b.c');\n`),
  /außerhalb der Meldungsdaten: subscribers/,
)
assert.throws(() => kopie('luecke.sqlite', stand, 'PRAGMA defer_foreign_keys=TRUE;'), /Export enthält nicht: pruefung, prime_folge, titel_zeile/)
// Ein zweiter Bau überschreibt statt anzuhängen.
assert.equal(zaehle(kopie('basis.sqlite', stand, EXPORT.replace(/^INSERT INTO "prime_folge".*$/gm, '')), 'prime_folge'), 0)
kopie('basis.sqlite', stand)

/* ---- Abfrage: eine Anweisung liefert Zeilen, mehrere laufen alle, die Kopie bleibt unverändert ---- */
assert.equal(istEinzeln('SELECT 1'), true)
assert.equal(istEinzeln('SELECT 1;\n'), true)
assert.equal(istEinzeln("SELECT 'a;b' AS x"), true)
assert.equal(istEinzeln('-- erst; dann\nSELECT 1'), true)
assert.equal(istEinzeln('SELECT 1; DELETE FROM prime_folge'), false)
assert.equal(istEinzeln("SELECT '; DROP' ; DELETE FROM prime_folge"), false)
const jetzt = new Date(Date.parse(stand) + 3 * 3_600_000)
const zeilen = fuehreAus(basis, 'SELECT url, COUNT(*) AS n FROM prime_folge GROUP BY url ORDER BY url', jetzt)
assert.equal(zeilen.art, 'zeilen')
assert.deepEqual(zeilen.zeilen.map((z) => ({ ...z })), [{ url: 'https://x/1', n: 2 }, { url: 'https://x/2', n: 1 }])
assert.equal(zeilen.stand, stand)
assert.equal(zeilen.alterStunden, 3)
// Die erste Anweisung ist ein SELECT: ohne Prüfung auf mehrere Anweisungen entfiele das DELETE still.
const skript = fuehreAus(basis, "SELECT 1; DELETE FROM prime_folge WHERE id <= 2; INSERT INTO titel_zeile (url, plattform, nr, daten) VALUES ('u', 'p', 2, '{}')", jetzt)
assert.equal(skript.art, 'aenderung')
assert.deepEqual({ ...skript.differenz }, { pruefung: 0, prime_folge: -2, titel_zeile: 1 })
assert.equal(skript.geaendert, 3)
assert.equal(zaehle(basis, 'prime_folge'), 3)
assert.equal(zaehle(basis, 'titel_zeile'), 1)
const update = fuehreAus(basis, "WITH n(i) AS (SELECT 1) UPDATE prime_folge SET uebernommen = 1 WHERE id IN (SELECT i FROM n)", jetzt)
assert.deepEqual([update.art, update.geaendert], ['aenderung', 1])
// Nur Kommentar, leer oder `;`: klare Meldung statt "statement has been finalized" (nachgestellt 30.10.2026 mit "-- nur kommentar").
for (const leer of ['-- nur kommentar', '/* x */', '  ', ';', '-- a\n;']) {
  assert.throws(() => fuehreAus(basis, leer, jetzt), /Keine SQL-Anweisung/, leer)
}
assert.equal(fuehreAus(basis, "SELECT ';' AS x -- ende", jetzt).gesamt, 1)

/* ---- Stand: 36 Stunden sind noch frisch, danach steht die Warnung in der Fußzeile ---- */
const alt = (stunden) => fuehreAus(basis, 'SELECT 1 AS x', new Date(Date.parse(stand) + stunden * 3_600_000))
assert.equal(alterStunden(stand, new Date(Date.parse(stand) + 90 * 60_000)), 1.5)
assert.equal(STAND_MAX_STUNDEN, 36)
assert.doesNotMatch(fusszeile(alt(36)), /ÄLTER/)
assert.match(fusszeile(alt(36.01)), /ÄLTER ALS 36 h/)
assert.match(fusszeile(alt(2)), /1 Zeilen in \d+ ms · Kopie vom 2026-10-14T03:00:00.000Z \(vor 2.0 h\)/)
assert.match(fusszeile(skript), /3 Zeilen geändert, Differenz \{"pruefung":0,"prime_folge":-2,"titel_zeile":1\}/)

/* ---- Aufruf auf der Kommandozeile ---- */
// Nie die geerbte Umgebung: in CI (deploy.yml, check:workflows) stehen GITHUB_ACTIONS und LAUF_TOKEN darin, auf Daniels Rechner eine wrangler-Anmeldung.
const UMGEBUNG = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_ACTIONS: '', LAUF_TOKEN: '', CLOUDFLARE_API_TOKEN: '' }
const cli = (...args) => spawnSync(process.execPath, [join(WURZEL, 'tools/meldungskopie.mjs'), ...args], { encoding: 'utf8', cwd: WURZEL, env: UMGEBUNG })
const lauf = cli('abfrage', 'SELECT id FROM prime_folge ORDER BY id', '--kopie', basis, '--max', '2')
assert.equal(lauf.status, 0, lauf.stderr)
assert.deepEqual(lauf.stdout.trim().split('\n'), ['{"id":1}', '{"id":2}'])
assert.match(lauf.stderr, /… 1 weitere Zeilen \(--max 2\)/)
const sqlDatei = join(ordner, 'x.sql')
writeFileSync(sqlDatei, 'SELECT COUNT(*) AS n FROM pruefung;\n')
assert.equal(cli('abfrage', '--datei', sqlDatei, '--kopie', basis).stdout.trim(), '{"n":2}')
{
  // Bricht an der ersten Sperre ab, bevor wrangler startet; im CI-Lauf mit geerbter Umgebung stünde hier eine andere Meldung.
  const nie = join(ordner, 'nie.enc')
  const gesperrt = cli('ziehen', '--ziel', nie)
  assert.equal(gesperrt.status, 1, 'ziehen ohne GITHUB_ACTIONS liest die echte D1 nicht')
  assert.match(gesperrt.stderr, /^ziehen liest die echte D1 und läuft nur im Lauf meldungskopie\.yml/)
  assert.equal(existsSync(nie), false)
}
const viele = cli('abfrage', 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 250) SELECT i FROM n', '--kopie', basis)
assert.equal(viele.stdout.trim().split('\n').length, 200, 'ohne --max höchstens 200 Zeilen')
assert.match(viele.stderr, /… 50 weitere Zeilen \(--max 200\)/)
{
  // Großes Ergebnis: 200.000 Zeilen à 2 KB bei 64 MB Heap; `all()` stürzte ab, gestreamt bleibt der Speicher klein und die Gesamtzahl stimmt.
  const gross = 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 200000) SELECT i, hex(zeroblob(1000)) AS d FROM n'
  const l = spawnSync(process.execPath, ['--max-old-space-size=64', join(WURZEL, 'tools/meldungskopie.mjs'), 'abfrage', gross, '--kopie', basis, '--max', '3'], { encoding: 'utf8', cwd: WURZEL, env: UMGEBUNG })
  assert.equal(l.status, 0, l.stderr.slice(-300))
  assert.equal(l.stdout.trim().split('\n').length, 3)
  assert.match(l.stderr, /… 199997 weitere Zeilen \(--max 3\)/)
  assert.match(l.stderr, /200000 Zeilen in \d+ ms/)
}
assert.equal(cli().status, 2)

/* ---- Holen: nur wenn der jüngste erfolgreiche Lauf neuer ist als die vorhandene Kopie; das Artefakt ist verschlüsselt ---- */
const TOKEN = 'lauf-token-fuer-den-test'
const MIT_TOKEN = { LAUF_TOKEN: TOKEN }
function gh(laeufe, aufrufe, quelle) {
  return (args) => {
    aufrufe.push(args)
    if (args[0] === 'run' && args[1] === 'list') {
      assert.deepEqual(args.slice(2), ['--workflow', WORKFLOW, '--status', 'success', '--limit', '1', '--json', 'databaseId,createdAt'])
      return JSON.stringify(laeufe)
    }
    assert.deepEqual([args[0], args[1], args[2], args[3], args[4], args[5]], ['run', 'download', '777', '--name', ARTEFAKT, '--dir'])
    writeFileSync(join(args[6], ARTEFAKT_DATEI), verschluessle(readFileSync(quelle), TOKEN))
    return ''
  }
}
const neu = kopie('neu.sqlite', '2026-10-15T03:00:00.000Z')
const ziel = join(ordner, 'cache', DATEINAME)
let aufrufe = []
const lauf1 = { databaseId: 777, createdAt: '2026-10-15T02:59:40Z' }
assert.deepEqual(holen({ gh: gh([lauf1], aufrufe, neu), ziel, umgebung: MIT_TOKEN }), { art: 'geholt', stand: '2026-10-15T03:00:00.000Z', lauf: 777 })
assert.equal(lokalerStand(ziel), '2026-10-15T03:00:00.000Z')
assert.equal(aufrufe.length, 2)
assert.equal(existsSync(aufrufe[1][6]), false, 'der Download-Ordner ist danach weg')
// Gleicher Lauf nochmal: nichts laden (der Stand wird nach dem Start des Laufs genommen, ist also nie älter als dessen createdAt).
aufrufe = []
assert.equal(holen({ gh: gh([lauf1], aufrufe, neu), ziel, umgebung: MIT_TOKEN }).art, 'aktuell')
assert.equal(aufrufe.length, 1)
// Die vorhandene Kopie ist älter als der Lauf: laden.
copyFileSync(basis, ziel)
aufrufe = []
assert.equal(holen({ gh: gh([lauf1], aufrufe, neu), ziel, umgebung: MIT_TOKEN }).art, 'geholt')
assert.equal(aufrufe.length, 2)
// Ohne Token oder mit falschem Token: Abbruch, kein gh-Aufruf bzw. die vorhandene Kopie bleibt.
aufrufe = []
assert.throws(() => holen({ gh: gh([lauf1], aufrufe, neu), ziel, umgebung: {} }), /LAUF_TOKEN fehlt/)
assert.equal(aufrufe.length, 0)
copyFileSync(basis, ziel)
const falsch = []
assert.throws(() => holen({ gh: gh([lauf1], falsch, neu), ziel, umgebung: { LAUF_TOKEN: 'falsch' } }), /nicht entschlüsseln/)
assert.equal(lokalerStand(ziel), stand, 'ein misslungenes Entschlüsseln lässt die vorhandene Kopie stehen')
assert.equal(existsSync(falsch[1][6]), false, 'auch nach dem Abbruch ist der Download-Ordner weg')
assert.throws(() => holen({ gh: gh([], [], neu), ziel, umgebung: MIT_TOKEN }), /Noch kein erfolgreicher Lauf von meldungskopie\.yml/)

/* ---- Ziehen: nur im Lauf, nur lesend, Stand ist der Beginn des Zugriffs ---- */
function wrangler(aufrufe) {
  return (args) => {
    aufrufe.push(args)
    assert.ok(args.includes('--remote'))
    assert.equal(args[0], 'd1')
    if (args[1] === 'export') {
      writeFileSync(args[args.indexOf('--output') + 1], EXPORT)
      return 'Done!'
    }
    return SCHEMA_JSON
  }
}
const ohneLauf = []
for (const umgebung of [{ LAUF_TOKEN: TOKEN }, { LAUF_TOKEN: TOKEN, GITHUB_ACTIONS: 'false' }]) {
  assert.throws(() => ziehen({ wrangler: wrangler(ohneLauf), ziel: join(ordner, 'a.enc'), umgebung }), /läuft nur im Lauf meldungskopie\.yml/)
}
assert.equal(ohneLauf.length, 0)
// Im Lauf, aber ohne Schlüssel: kein D1-Zugriff und keine Datei zum Hochladen.
const CF = { CLOUDFLARE_API_TOKEN: 'cf-token-fuer-den-test' }
assert.throws(() => ziehen({ wrangler: wrangler(ohneLauf), ziel: join(ordner, 'a.enc'), umgebung: { GITHUB_ACTIONS: 'true', ...CF } }), /LAUF_TOKEN fehlt/)
assert.equal(ohneLauf.length, 0)
// Im Lauf, aber ohne Cloudflare-Token: wrangler startet nicht (es nähme sonst die Anmeldung des Rechners).
assert.throws(() => ziehen({ wrangler: wrangler(ohneLauf), ziel: join(ordner, 'a.enc'), umgebung: { GITHUB_ACTIONS: 'true', ...MIT_TOKEN } }), /CLOUDFLARE_API_TOKEN fehlt/)
assert.equal(ohneLauf.length, 0)
assert.equal(existsSync(join(ordner, 'a.enc')), false)
const IM_LAUF = { GITHUB_ACTIONS: 'true', ...MIT_TOKEN, ...CF }
const exportOrdner = (aufrufe) => {
  const a = aufrufe.find((x) => x[1] === 'export')
  return dirname(a[a.indexOf('--output') + 1])
}
// Bricht der Zugriff mittendrin ab, bleibt kein Klartext liegen und keine Datei zum Hochladen.
const abgebrochen = []
const scheitert = (args) => {
  const aus = wrangler(abgebrochen)(args)
  return args[1] === 'export' ? assert.fail('Export gescheitert') : aus
}
assert.throws(() => ziehen({ wrangler: scheitert, ziel: join(ordner, 'c.enc'), umgebung: IM_LAUF }), /Export gescheitert/)
assert.equal(existsSync(exportOrdner(abgebrochen)), false, 'der Klartext-Export ist nach dem Abbruch weg')
assert.equal(existsSync(join(ordner, 'c.enc')), false)
const gezogen = []
const zeitpunkt = new Date('2026-10-16T03:00:07.000Z')
const gebaut = ziehen({ wrangler: wrangler(gezogen), ziel: join(ordner, 'b.enc'), umgebung: IM_LAUF, jetzt: zeitpunkt })
assert.deepEqual(gebaut, { pruefung: 2, prime_folge: 3, titel_zeile: 1 })
// Schema vor dem Export: ein laufender Export blockiert die D1 für die Schemaabfrage (15.10.2026).
assert.deepEqual(gezogen.map((a) => a[1]), ['execute', 'export'])
assert.equal(existsSync(exportOrdner(gezogen)), false, 'Klartext-Export und -Kopie liegen nach dem Lauf nicht mehr auf der Platte')
// Die Datei zum Hochladen ist Geheimtext (weder SQLite-Kopf noch Klartext aus dem Export); entschlüsselt hat sie Indexe und Sicht.
const hochzuladen = readFileSync(join(ordner, 'b.enc'))
assert.equal(hochzuladen.includes('SQLite format 3'), false)
assert.equal(hochzuladen.includes('zweite Zeile'), false)
const entpackt = join(ordner, 'b.sqlite')
writeFileSync(entpackt, entschluessle(hochzuladen, TOKEN))
assert.equal(lokalerStand(entpackt), '2026-10-16T03:00:07.000Z')
{
  const db = new DatabaseSync(entpackt, { readOnly: true })
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").get().n, 2)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pruefung_titel').get().n, 2)
  db.close()
}

/* ---- Zeitplan: eine Änderung ist spätestens nach 33 Stunden in der Kopie, die Grenze der Fußzeile ist 36 ---- */
const plan = lies('shared/weckplan.ts').match(/\{ workflow: 'meldungskopie\.yml', stunden: \[(\d+)\], abstandMin: (\d+) \}/)
assert.ok(plan, 'meldungskopie.yml steht im Weckplan: täglich zu einer Stunde')
const abstand = Number(plan[2]) / 60
assert.ok(abstand <= 24 && abstand > 12, `Mindestabstand ${abstand} h: höchstens ein Tag, sonst fiele ein Tageslauf aus`)
const nachholen = Number(lies('.github/workflows/wecker-wache.yml').match(/meldungskopie\.yml:(\d+)/)?.[1])
const wachTakt = Number(lies('.github/workflows/wecker-wache.yml').match(/cron: '\d+ \*\/(\d+) \* \* \*'/)?.[1])
assert.ok(nachholen > 0 && wachTakt > 0, 'wecker-wache holt meldungskopie.yml nach')
assert.ok(nachholen + wachTakt <= STAND_MAX_STUNDEN, `Nachholen nach ${nachholen} h im ${wachTakt}-h-Takt: spätestens ${nachholen + wachTakt} h, Grenze ${STAND_MAX_STUNDEN} h`)
assert.equal(Number(lies('tools/wache-fristen.mjs').match(/'meldungskopie\.yml': (\d+)/)?.[1]), STAND_MAX_STUNDEN)

/* ---- Lauf: Name und Datei des Artefakts sind die, die „holen“ erwartet; das Token fehlt nicht still ---- */
const yml = lies('.github/workflows/meldungskopie.yml')
assert.equal(ARTEFAKT_DATEI, 'meldungen.sqlite.enc')
assert.match(yml, new RegExp(`name: ${ARTEFAKT}\\n\\s+path: ${ARTEFAKT_DATEI.replaceAll('.', '\\.')}\\n`))
assert.match(yml, /node tools\/meldungskopie\.mjs ziehen --ziel meldungen\.sqlite\.enc/)
assert.match(yml, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/, 'der Export braucht Schreibrecht: nicht das Lese-Token')
assert.doesNotMatch(yml.replace(/^#.*$/gm, ''), /ANALYTICS/)
assert.match(yml, /LAUF_TOKEN: \$\{\{ secrets\.LAUF_TOKEN \}\}/)
assert.doesNotMatch(yml, /exit 0/, 'ohne Token wird der Lauf rot, nicht still grün (sonst findet "holen" einen Lauf ohne Artefakt)')
// Zugriffsstufe: der Lauf darf am Repo nur lesen, und das Artefakt liegt höchstens 3 Tage (betrieb.md, Abschnitt Meldungskopie).
const workflow = parse(yml)
assert.deepEqual(workflow.permissions, { contents: 'read' })
assert.deepEqual(Object.values(workflow.jobs).map((j) => j.permissions), [undefined], 'kein Job weitet die Rechte aus')
const hochladen = workflow.jobs.kopie.steps.filter((s) => s.uses?.startsWith('actions/upload-artifact'))
assert.deepEqual(hochladen.map((s) => s.with['retention-days']), [3])

// wrangler --json meldet Fehler auf stdout; das Protokoll muss den Grund tragen (15.10.2026: nur "Command failed").
const kaputt = Object.assign(new Error('Command failed: wrangler d1 execute'), { stdout: '{"error":{"text":"D1_ERROR: Grund-Text"}}', stderr: '' })
assert.throws(
  () => mitFehlertext(() => { throw kaputt })(['d1']),
  /Command failed: wrangler d1 execute\nAusgabe von wrangler: .*Grund-Text/s,
)
assert.throws(() => mitFehlertext(() => { throw new Error('nur Meldung') })(['d1']), (f) => f.message === 'nur Meldung')
assert.equal(mitFehlertext((a) => a.join('+'))(['x', 'y']), 'x+y')

// Das echte Startprogramm (wie `ziehen` es im Lauf nutzt) trägt die stdout-Ausgabe eines scheiternden wrangler in den Fehler.
const falscheWurzel = join(ordner, 'wurzel')
mkdirSync(join(falscheWurzel, 'node_modules/wrangler/bin'), { recursive: true })
writeFileSync(join(falscheWurzel, 'node_modules/wrangler/bin/wrangler.js'), 'console.log(JSON.stringify({ error: { text: "D1_ERROR: echter Grund" } }))\nprocess.exit(1)\n')
assert.throws(() => wranglerAus(falscheWurzel)(['d1', 'execute']), /echter Grund/)

// Die ganze Verdrahtung: eine Kopie der Werkzeug-Dateien mit falschem wrangler, aufgerufen wie im Lauf (`ziehen --ziel …`).
const werkzeug = join(ordner, 'werkzeug')
mkdirSync(join(werkzeug, 'tools'), { recursive: true })
for (const datei of readdirSync(join(WURZEL, 'tools')).filter((d) => /^meldungskopie.*\.mjs$/.test(d) && !d.endsWith('.test.mjs'))) {
  copyFileSync(join(WURZEL, 'tools', datei), join(werkzeug, 'tools', datei))
}
cpSync(join(falscheWurzel, 'node_modules'), join(werkzeug, 'node_modules'), { recursive: true })
const imLauf = spawnSync(process.execPath, [join(werkzeug, 'tools/meldungskopie.mjs'), 'ziehen', '--ziel', join(ordner, 'v.enc')], {
  encoding: 'utf8',
  env: { ...UMGEBUNG, GITHUB_ACTIONS: 'true', LAUF_TOKEN: TOKEN, ...CF },
})
assert.equal(imLauf.status, 1)
assert.match(imLauf.stderr, /echter Grund/, 'der Fehlertext von wrangler erreicht das Protokoll des Laufs')
assert.equal(existsSync(join(ordner, 'v.enc')), false)

// Die Ausgabe von wrangler wird auf 2000 Zeichen gekürzt (Protokoll bleibt lesbar), der Anfang bleibt.
const lang = Object.assign(new Error('kaputt'), { stdout: `ANFANG${'x'.repeat(3000)}ENDMARKE`, stderr: '' })
assert.throws(() => mitFehlertext(() => { throw lang })([]), (f) => f.message.includes('ANFANG') && !f.message.includes('ENDMARKE') && f.message.length < 2100)

// Ein roter Lauf erscheint in der Laufstatus-App: nur bei Fehlschlag, nie selbst rot machend (der Lauf vom 15.10.2026 blieb dort unsichtbar).
const meldung = workflow.jobs.kopie.steps.filter((s) => /lauf-melden\.sh fehler/.test(s.run ?? ''))
assert.equal(meldung.length, 1)
assert.equal(meldung[0].if, 'failure()')
assert.equal(meldung[0]['continue-on-error'], true)
assert.equal(meldung[0].env.LAUF_TOKEN, '${{ secrets.LAUF_TOKEN }}')
// Ein Schritt vor dem Ziehen sähe dessen Fehlschlag nie: der Melder steht direkt hinter "Kopie ziehen und bauen".
const schritte = workflow.jobs.kopie.steps
const ziehSchritt = schritte.findIndex((s) => /meldungskopie\.mjs ziehen/.test(s.run ?? ''))
assert.ok(ziehSchritt >= 0)
assert.equal(schritte.indexOf(meldung[0]), ziehSchritt + 1)

rmSync(ordner, { recursive: true, force: true })
console.log('meldungskopie.test: ok')
