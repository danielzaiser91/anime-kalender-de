// Test für d1-sperre.js (Plan-Tor + Freigabe + Tagesbudget): node .claude/hooks/d1-sperre-test.mjs
// Liest Schema und Migrationen aus C:/code/ai/anime-kalender-de/worker; Zustandsdateien in state/d1-test/ (danach gelöscht).
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
// Braucht Daniels Rechner (Werkzeug d1-schutz, Zustandsordner unter ~/.claude): in der CI übersprungen, die Zeile belegt es.
if (!existsSync('C:/code/ai/__assets/tools/d1-schutz/zustand.mjs')) {
  console.log('d1-sperre-test: übersprungen (C:/code/ai/__assets fehlt, läuft nur auf Daniels Rechner)')
  process.exit(0)
}
const { sqlHash } = await import('file:///C:/code/ai/__assets/tools/d1-schutz/zustand.mjs')
const { pruefe } = createRequire(import.meta.url)('./d1-sperre.js')

const ORDNER = 'C:/Users/ih/.claude/hooks/state/d1-test'
const WORKER = 'C:\\code\\ai\\anime-kalender-de\\worker'
const ALT = 'C:/code/ai/__assets/tools/d1-schutz/beispiele/titel-zeile-einspielen-alt.sql'
const JETZT = Date.parse('2026-10-14T12:00:00Z')
const vor = (min) => new Date(JETZT - min * 60_000).toISOString()

const GROESSEN = { stand: vor(60), tabellen: { pruefung: 25_000, prime_folge: 70_000, monitor_alarm: 40, vorfall: 3_000 } }
const VERBRAUCH = { stand: vor(5), gelesen: 500_000, geschrieben: 5_000 }
const freigabe = (sql, extra = {}) => [{ hash: sqlHash(sql), begruendung: 'Hochrechnung 400.000 aus Probelauf LIMIT 5 × 6', gelesen: 400_000, geschrieben: 500, erteilt: vor(60), ...extra }]
const altSql = readFileSync(ALT, 'utf8')
const KORRELIERT = 'SELECT p.id, (SELECT count(*) FROM prime_folge f WHERE f.titel = p.titel) FROM pruefung p LIMIT 100'
const KLEIN_KORRELIERT = 'SELECT (SELECT count(*) FROM monitor_alarm b WHERE b.grund = a.grund) FROM monitor_alarm a'
const remote = (sql) => `npx wrangler d1 execute DB --remote --config wrangler.toml --command "${sql}"`
const datei = (f) => `npx wrangler d1 execute DB --remote --config wrangler.toml --file ${f}`
// Eigener Worker-Ordner mit Tabelle nur_hier (Schema-Wahl über --config bzw. cwd) und ein kaputter (migrations ist eine Datei).
const TW = 'C:/Users/ih/.claude/hooks/state/d1-test-worker'
const KAPUTT = 'C:/Users/ih/.claude/hooks/state/d1-test-kaputt'
const SCHEMA_TW = [
  'CREATE TABLE nur_hier (id INTEGER PRIMARY KEY AUTOINCREMENT, x TEXT);',
  'CREATE UNIQUE INDEX nur_hier_x ON nur_hier (x);',
  'CREATE TABLE zwei (id INTEGER PRIMARY KEY, x TEXT);',
  'CREATE INDEX zwei_x ON zwei (x);',
].join('\n')
const werte = (n) => `INSERT INTO monitor_alarm (grund) VALUES ${Array.from({ length: n }, (_, i) => `('a${i}')`).join(', ')}`

// [Name, Befehl, Zustand, gesperrt?, Pflichttext im Grund]
const FAELLE = [
  ['alte Einspiel-SQL lokal', `npx wrangler d1 execute DB --local --file ${ALT}`, {}, false],
  ['alte Einspiel-SQL remote: Zwischenindex', datei(ALT), { GROESSEN, VERBRAUCH }, true, 'Zwischenindex'],
  ['alte Einspiel-SQL remote: korreliert', datei(ALT), { GROESSEN, VERBRAUCH }, true, 'korrelierte Unterabfrage'],
  ['alte Einspiel-SQL ohne Größenliste: Volldurchlauf prime_folge', datei(ALT), { VERBRAUCH }, true, 'Volldurchlauf prime_folge (Größe unbekannt)'],
  ['alte Einspiel-SQL ohne Größenliste: Volldurchlauf pruefung', datei(ALT), { VERBRAUCH }, true, 'Volldurchlauf pruefung (Größe unbekannt)'],
  ['Migration 051 (Index auf prime_folge)', datei('migrations/051-prime-folge-offen-id.sql'), { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX auf prime_folge'],
  ['Migration 053 (Index auf pruefung)', datei('migrations/053-pruefung-folge-index.sql'), { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX auf pruefung'],
  ['Migration 055 (Index auf titel_zeile, Größe unbekannt)', datei('migrations/055-titel-zeile.sql'), { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX auf titel_zeile'],
  ['Migration 054 (zwei Spalten) frei', datei('migrations/054-pruefung-rohfolge.sql'), { GROESSEN, VERBRAUCH }, false],
  ['Migration 054 ohne gemessenen Verbrauch', datei('migrations/054-pruefung-rohfolge.sql'), { GROESSEN }, true, 'kein gemessener Tagesverbrauch'],
  ['Schlüsselzugriff frei, auch ohne Verbrauch', remote('SELECT * FROM pruefung WHERE id = 5'), {}, false],
  ['Schlüsselzugriff frei bei knappem Budget', remote('SELECT * FROM titel_zeile WHERE url = \'x\' AND plattform = \'disneyplus\''), { VERBRAUCH: { ...VERBRAUCH, gelesen: 4_900_000 } }, false],
  ['LIMIT 5 ohne WHERE auf kleiner Tabelle', remote('SELECT * FROM monitor_alarm LIMIT 5'), { GROESSEN }, false],
  ['LIMIT 5 ohne WHERE auf Tabelle unbekannter Größe', remote('SELECT * FROM monitor_alarm LIMIT 5'), { VERBRAUCH }, true, 'Volldurchlauf monitor_alarm'],
  ['korrelierte Abfrage mit LIMIT 100', remote(KORRELIERT), { GROESSEN, VERBRAUCH }, true, 'korrelierte Unterabfrage'],
  ['Volldurchlauf 70.000 ungeordnet frei', remote('SELECT * FROM prime_folge WHERE titel LIKE \'%9%\' LIMIT 5'), { GROESSEN, VERBRAUCH }, false],
  ['Volldurchlauf 70.000 sortiert zählt doppelt', remote('SELECT * FROM prime_folge ORDER BY gemeldet_am DESC LIMIT 5'), { GROESSEN, VERBRAUCH }, true, 'Zwischentabelle'],
  ['Join zweier Volldurchläufe multipliziert', remote('SELECT 1 FROM pruefung a, monitor_alarm b WHERE a.titel || b.grund = \'x\''), { GROESSEN, VERBRAUCH }, true, 'Volldurchlauf pruefung (≈25.000 Zeilen) × monitor_alarm'],
  ['Freigabe mit passendem Hash', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql) }, false],
  ['Freigabe, SQL danach geändert', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql + '\nSELECT 1;') }, true, 'Plan-Tor sperrt'],
  ['Freigabe ohne Begründung', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql, { begruendung: ' ' }) }, true, 'Plan-Tor sperrt'],
  ['Freigabe 23 h alt gilt noch', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql, { erteilt: vor(23 * 60) }) }, false],
  ['Freigabe 25 h alt gilt nicht mehr', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql, { erteilt: vor(25 * 60) }) }, true, 'Plan-Tor sperrt'],
  ['Freigabe, Hochrechnung sprengt das Budget', datei(ALT), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, gelesen: 2_700_000 }, FREIGABEN: freigabe(altSql) }, true, 'Tagesbudget'],
  ['Freigabe, Schreib-Hochrechnung sprengt das Budget', datei(ALT), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 59_600 }, FREIGABEN: freigabe(altSql) }, true, 'geschrieben'],
  ['count(*) mittelgroß bei Verbrauch 500.000', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH }, false],
  ['count(*) mittelgroß bei Verbrauch 2,99 Mio.', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, gelesen: 2_990_000 } }, true, 'Tagesbudget'],
  ['Schreiben bei 61.000 geschriebenen Zeilen', remote('UPDATE pruefung SET uebernommen = 1 WHERE id = 5'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 61_000 } }, true, 'geschrieben'],
  ['Verbrauch 29 min alt gilt noch', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, stand: vor(29) } }, false],
  ['Verbrauch 31 min alt gilt nicht mehr', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, stand: vor(31) } }, true, 'älter als 30 Minuten'],
  ['Größenliste 6 Tage alt gilt noch', remote('SELECT count(*) FROM pruefung'), { GROESSEN: { ...GROESSEN, stand: vor(6 * 1440) }, VERBRAUCH }, false],
  ['Größenliste 8 Tage alt gilt nicht mehr', remote('SELECT count(*) FROM pruefung'), { GROESSEN: { ...GROESSEN, stand: vor(8 * 1440) }, VERBRAUCH }, true, 'älter als 7 Tage'],
  ['UPDATE ohne WHERE', remote('UPDATE monitor_alarm SET grund = 1'), { GROESSEN, VERBRAUCH }, true, 'UPDATE ohne WHERE'],
  ['DELETE ohne WHERE', remote('DELETE FROM monitor_alarm'), { GROESSEN, VERBRAUCH }, true, 'DELETE ohne WHERE'],
  ['INSERT mit 501 VALUES-Zeilen', remote(werte(501)), { GROESSEN, VERBRAUCH }, true, '501 VALUES-Zeilen'],
  ['INSERT mit 500 VALUES-Zeilen', remote(werte(500)), { GROESSEN, VERBRAUCH }, false],
  ['Migration buchen (d1_migrations)', remote("INSERT INTO d1_migrations (name) VALUES ('055-titel-zeile.sql')"), { VERBRAUCH }, false],
  ['d1 export --remote', 'npx wrangler d1 export DB --remote --output x.sql', { GROESSEN, VERBRAUCH }, true, 'export'],
  ['migrations apply --remote', 'CI=true npx wrangler d1 migrations apply DB --remote --config wrangler.toml', { GROESSEN, VERBRAUCH }, true, 'migrations apply'],
  ['migrations list --remote frei', 'npx wrangler d1 migrations list DB --remote --config wrangler.toml', {}, false],
  ['insights frei', 'npx wrangler d1 insights DB --config wrangler.toml --json', {}, false],
  ['--preview zählt wie --remote', datei('migrations/053-pruefung-folge-index.sql').replace('--remote', '--preview'), { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['--command=… und wrangler.js direkt', `node node_modules/wrangler/bin/wrangler.js d1 execute DB --remote "--command=${KORRELIERT}"`, { GROESSEN, VERBRAUCH }, true, 'korrelierte'],
  ['cd ins Worker-Verzeichnis, Umgebungsvariable davor', 'cd /c/code/ai/anime-kalender-de/worker && CI=true npx wrangler d1 execute DB --remote --file migrations/051-prime-folge-offen-id.sql 2>&1 </dev/null | tail -3', { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX', 'C:\\code\\ai'],
  ['bash -c mit Aufruf', `bash -c "${datei('migrations/053-pruefung-folge-index.sql')}"`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['Variable im SQL nicht auswertbar', 'npx wrangler d1 execute DB --remote --command "$SQL"', { GROESSEN, VERBRAUCH }, true, 'nicht auswertbar'],
  ['$(…) im Dateinamen nicht auswertbar', 'npx wrangler d1 execute DB --remote --file $(ls *.sql)', { GROESSEN, VERBRAUCH }, true, 'nicht auswertbar'],
  ['eval mit Aufruf nicht auswertbar', `eval "${datei('x.sql')}"`, { GROESSEN, VERBRAUCH }, true, 'nicht auswertbar'],
  ['fehlende SQL-Datei', datei('gibt-es-nicht.sql'), { GROESSEN, VERBRAUCH }, true, 'nicht lesbar'],
  ['grep nach dem Befehlstext frei', 'grep -n "wrangler d1 execute DB --remote --file x.sql" docs/wissen/betrieb.md', {}, false],
  ['Heredoc-Inhalt wird nicht ausgeführt', "cat > x.txt <<'EOF'\nnpx wrangler d1 execute DB --remote --command \"DELETE FROM pruefung\"\nEOF\necho fertig", {}, false],
  ['Zeichenkette mit Semikolon: zweite Anweisung zählt', remote("SELECT 'a;b' FROM pruefung WHERE id = 1; DELETE FROM monitor_alarm"), { GROESSEN, VERBRAUCH }, true, 'DELETE ohne WHERE'],
  ['Zeichenkette mit Semikolon allein frei', remote("SELECT 'a;b' FROM pruefung WHERE id = 1"), {}, false],
  ['Kommentar mit ; DELETE frei', remote('SELECT * FROM pruefung WHERE id = 1 -- ; DELETE FROM monitor_alarm'), {}, false],
  ['WITH … DELETE ohne WHERE', remote('WITH x AS (SELECT 1) DELETE FROM monitor_alarm'), { GROESSEN, VERBRAUCH }, true, 'DELETE ohne WHERE'],
  ['derselbe Alias für zwei Tabellen zählt die größere', remote('SELECT a.id FROM pruefung a WHERE a.id = 1 UNION ALL SELECT a.id FROM monitor_alarm a'), { GROESSEN }, true, 'kein gemessener Tagesverbrauch'],
  ['JOIN ohne Alias verschluckt den nächsten Alias nicht', remote('SELECT 1 FROM monitor_alarm JOIN monitor_alarm m LIMIT 5'), { GROESSEN }, false],
  ['sqlite_sequence ohne Größenliste frei', remote('SELECT name, seq FROM sqlite_sequence'), {}, false],
  ['pragma_table_info frei', remote("SELECT name FROM pragma_table_info('pruefung')"), {}, false],
  ['neue Tabelle im selben Text ist bekannt', remote('CREATE TABLE neu_t (id INTEGER PRIMARY KEY); SELECT * FROM neu_t'), { GROESSEN, VERBRAUCH }, true, 'Volldurchlauf neu_t'],
  ['CTE mit Alias frei', remote('WITH x AS MATERIALIZED (SELECT id FROM monitor_alarm) SELECT * FROM x a, x b'), { GROESSEN }, false],
  ['Herestring davor, gefährlicher Aufruf danach', `cat <<< "x" && ${datei('migrations/053-pruefung-folge-index.sql')}`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['# Kommentar mit wrangler frei', 'echo hi # npx wrangler d1 execute DB --remote --command "DELETE FROM pruefung"', {}, false],
  ['Leerzeichen per Backslash im Dateinamen', datei(`${TW}/mit\\ leer.sql`), {}, false],
  ['\\" in doppelten Quotes', `npx wrangler d1 execute DB --remote --command "SELECT * FROM pruefung WHERE \\"titel\\" = 'x' AND id = 1"`, {}, false],
  ['Freigabe ohne Hochrechnung', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql, { gelesen: undefined }) }, true, 'Plan-Tor sperrt'],
  ['Fehler in der Prüfung sperrt', `npx wrangler d1 execute DB --remote --config ${KAPUTT}/wrangler.toml --command "SELECT * FROM pruefung WHERE id = 1"`, {}, true, 'Prüfung gescheitert'],
  ['Schema aus --config, cwd woanders', `npx wrangler d1 execute DB --remote --config ${TW}/wrangler.toml --command "SELECT * FROM nur_hier WHERE id = 1"`, {}, false, null, 'C:\\'],
  ['Schema aus dem cwd', 'npx wrangler d1 execute DB --remote --command "SELECT * FROM nur_hier WHERE id = 1"', {}, false, null, TW],
  ['Umgebungsvariable vor bash -c', `CI=1 bash -c "${datei('migrations/053-pruefung-folge-index.sql')}"`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['d1_migrations lesen ohne Größenliste frei', remote('SELECT name FROM d1_migrations'), {}, false],
  ['PRAGMA frei ohne Verbrauch', remote('PRAGMA table_info(pruefung)'), {}, false],
  ['WHERE nur in der Unterabfrage', remote('UPDATE monitor_alarm SET grund = (SELECT titel FROM pruefung WHERE id = 1)'), { GROESSEN, VERBRAUCH }, true, 'UPDATE ohne WHERE'],
  ['WHERE nur in einer Zeichenkette', remote("UPDATE monitor_alarm SET grund = 'WHERE (x'"), { GROESSEN, VERBRAUCH }, true, 'UPDATE ohne WHERE'],
  ['unbekannte Tabelle sperrt', remote('SELECT * FROM gibt_es_nicht WHERE id = 1'), {}, true, 'Plan nicht ermittelbar'],
  ['eine kleine Lesung frei', remote('SELECT count(*) FROM vorfall'), { GROESSEN }, false],
  ['zwei kleine Lesungen summieren sich', remote('SELECT count(*) FROM vorfall; SELECT count(*) FROM vorfall'), { GROESSEN }, true, 'kein gemessener Tagesverbrauch'],
  ['Unterabfrage ohne Namen frei', remote('SELECT * FROM (SELECT id FROM monitor_alarm ORDER BY grund LIMIT 3) LIMIT 5'), { GROESSEN }, false],
  ['/* */-Kommentar mit ; DELETE frei', remote('SELECT * FROM pruefung WHERE id = 1 /* ; DELETE FROM monitor_alarm */'), {}, false],
  ['UPDATE mit Alias', remote('UPDATE monitor_alarm AS m SET grund = 1 WHERE m.grund = 2'), { GROESSEN, VERBRAUCH }, false],
  ['300 VALUES-Zeilen mit zwei Spalten frei', remote(`INSERT INTO monitor_alarm (url, grund) VALUES ${Array.from({ length: 300 }, (_, i) => `('u${i}', 'a${i}')`).join(', ')}`), { GROESSEN, VERBRAUCH }, false],
  ['Verbrauchsdatei ohne Zahlen', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH: { stand: vor(5) } }, true, 'kein gemessener Tagesverbrauch'],
  ['Freigabe ohne Schreib-Hochrechnung', datei(ALT), { GROESSEN, VERBRAUCH, FREIGABEN: freigabe(altSql, { geschrieben: undefined }) }, true, 'Plan-Tor sperrt'],
  ['count(*) mittelgroß bei Verbrauch 2,97 Mio. frei', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, gelesen: 2_970_000 } }, false],
  ['Schreiben bei 59.000 geschriebenen Zeilen frei', remote('UPDATE pruefung SET uebernommen = 1 WHERE id = 5'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 59_000 } }, false],
  ['Freigabe einer kleinen Abfrage braucht trotzdem Verbrauch', remote(KLEIN_KORRELIERT), { GROESSEN, FREIGABEN: freigabe(KLEIN_KORRELIERT) }, true, 'kein gemessener Tagesverbrauch'],
  ['Herestring, gefährlicher Aufruf in der nächsten Zeile', `cat <<< "x"\n${datei('migrations/053-pruefung-folge-index.sql')}`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['<<- mit eingerückter Endmarke', `cat <<-EOF\n\tx\n\tEOF\n${datei('migrations/053-pruefung-folge-index.sql')}`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX'],
  ['Zeilenumbruch trennt Befehle (cd)', `true\ncd /c/code/ai/anime-kalender-de/worker\n${datei('migrations/051-prime-folge-offen-id.sql')}`, { GROESSEN, VERBRAUCH }, true, 'CREATE INDEX', 'C:\\code\\ai'],
  ['# mitten im Wort ist kein Kommentar', `echo a#b && ${remote('DELETE FROM pruefung')}`, { GROESSEN, VERBRAUCH }, true, 'DELETE ohne WHERE'],
]

// Lücken aus der Prüfung vom 14.10.2026, 14:51 (Gegenproben d1p/proben.mjs, dazu je Zweig ein eigener Fall).
// PROBE ist der Zustand der Gegenproben: große Tabellen, Verbrauch gemessen.
const GROSS = { stand: vor(60), tabellen: { pruefung: 500_000, prime_folge: 700_000, monitor_alarm: 40 } }
const PROBE = { GROESSEN: GROSS, VERBRAUCH }
const M51 = 'migrations/051-prime-folge-offen-id.sql'
const M53 = datei('migrations/053-pruefung-folge-index.sql')
const plain = (sql) => `npx wrangler d1 execute DB --remote --command "${sql}"`
const NL = '\n'
const LUECKEN = [
  // Flaggen vor d1, Aufrufe ohne wrangler-Wort
  ['globale Flagge vor d1', `npx wrangler --config wrangler.toml d1 execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX'],
  ['Flagge zwischen d1 und execute', `npx wrangler d1 --config wrangler.toml execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX'],
  ['-c ist --config (Schema daraus)', `npx wrangler -c ${KAPUTT}/wrangler.toml d1 execute DB --remote --command "SELECT * FROM pruefung WHERE id = 1"`, {}, true, 'Prüfung gescheitert'],
  ['--cwd setzt den Ordner für --file', `npx wrangler --cwd /c/code/ai/anime-kalender-de/worker d1 execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX', 'C:\\'],
  ['zweites wrangler-Wort (npx -p wrangler wrangler)', `npx -p wrangler@4 wrangler d1 execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX'],
  ['Hülle ohne wrangler-Wort (node cf.cjs d1)', `node cf.cjs d1 execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX'],
  // Hüllen
  ['bash -lc', `bash -lc "${M53}"`, PROBE, true, 'CREATE INDEX'],
  ['sh -ec', `sh -ec "${M53}"`, PROBE, true, 'CREATE INDEX'],
  ['timeout vor bash -c', `timeout 60 bash -c "${M53}"`, PROBE, true, 'CREATE INDEX'],
  ['bash mit Heredoc', `bash <<'EOF2'${NL}${M53}${NL}EOF2`, PROBE, true, 'CREATE INDEX'],
  ['bash-Heredoc mit Schlüsselzugriff frei', `bash <<'EOF2'${NL}${remote('SELECT * FROM pruefung WHERE id = 1')}${NL}EOF2`, {}, false],
  ['Heredoc per Pipe in bash nicht auswertbar', `cat <<'EOF2' | bash${NL}${M53}${NL}EOF2`, PROBE, true, 'nicht auswertbar'],
  ['cmd //c', `cmd //c "${M53}"`, PROBE, true, 'CREATE INDEX'],
  ['bash -c "$CMD" nicht auswertbar', `CMD="${M53}" && bash -c "$CMD"`, PROBE, true, 'nicht auswertbar'],
  ['$CMD als Befehl nicht auswertbar', `CMD="${M53}" && $CMD`, PROBE, true, 'nicht auswertbar'],
  ['npm run db:init:remote', 'npm run db:init:remote', PROBE, true, 'CREATE INDEX'],
  ['npm run lokal frei', 'npm run db:init', PROBE, false],
  ['npm run … -- --remote', 'npm run db:init -- --remote', PROBE, true, 'CREATE INDEX'],
  ['npm --prefix worker run', 'npm --prefix worker run db:init:remote', PROBE, true, 'CREATE INDEX', 'C:\\code\\ai\\anime-kalender-de'],
  ['npm run: pre-Skript', 'npm run hallo', PROBE, true, 'DELETE ohne WHERE', TW],
  ['npm run: Skript ruft Skript', 'npm run kette', PROBE, true, 'DELETE ohne WHERE', TW],
  ['npm run: Skript ruft sich selbst', 'npm run schleife', PROBE, true, 'Skripttiefe', TW],
  ['npm run: unbekanntes Skript frei', 'npm run gibt-es-nicht', PROBE, false, null, TW],
  ['npm run: post-Skript', 'npm run nachher', PROBE, true, 'DELETE ohne WHERE', TW],
  ['npm run-script', 'npm run-script loesche', PROBE, true, 'DELETE ohne WHERE', TW],
  ['npm run --prefix worker <skript>', 'npm run --prefix worker db:init:remote', PROBE, true, 'CREATE INDEX', 'C:\\code\\ai\\anime-kalender-de'],
  ['npm run aus einem Unterordner', 'npm run db:init:remote', PROBE, true, 'CREATE INDEX', `${WORKER}\\migrations`],
  ['npm-Argumente mit Leerzeichen und Quote bleiben ein Wort', `npm run lokal -- --remote --command "SELECT * FROM nur_hier WHERE id = 1 AND x = 'a b'"`, {}, false, null, TW],
  ['unsichere Flagge zwischen wrangler und d1', 'npx wrangler --config "$C" d1 execute DB --remote --command "SELECT * FROM pruefung WHERE id = 1"', PROBE, true, 'nicht auswertbar'],
  ['ein Alias, zwei Tabellen: Schlüssel muss in beiden eindeutig sein', `npx wrangler d1 execute DB --remote --config ${TW}/wrangler.toml --command "SELECT a.id FROM nur_hier a WHERE a.x = 'q' UNION ALL SELECT a.id FROM zwei a WHERE a.x = 'q'"`, {}, true, 'Größe unbekannt'],
  ['REPLACE … VALUES zählt ins Schreibbudget', remote(werte(300).replace('INSERT', 'REPLACE')), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 59_800 } }, true, 'geschrieben'],
  ['Schlüssel-UPDATE zählt eine Zeile', remote('UPDATE pruefung SET uebernommen = 1 WHERE id = 5'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 60_000 } }, true, 'geschrieben'],
  // Bereichszugriffe zählen wie Volldurchläufe; nur Gleichheit auf eindeutigem Schlüssel bleibt klein
  ['Bereich auf Primärschlüssel', plain('SELECT * FROM prime_folge WHERE id > 0'), PROBE, true, 'prime_folge über Index-Bereich'],
  ['Bereich auf Index', plain("SELECT * FROM pruefung WHERE gemeldet_am > '2000'"), PROBE, true, 'pruefung über Index-Bereich'],
  ['BETWEEN', plain('SELECT * FROM prime_folge WHERE id BETWEEN 1 AND 1000000'), PROBE, true, 'prime_folge'],
  ['IN (SELECT …) mit Bereich', plain('SELECT * FROM monitor_alarm WHERE id IN (SELECT id FROM prime_folge WHERE id > 0)'), PROBE, true, 'prime_folge'],
  ['Join über Index vervielfacht', plain('SELECT count(*) FROM pruefung a JOIN pruefung b ON b.url = a.url WHERE a.id < 1000000'), PROBE, true, '× pruefung'],
  ['Gleichheit auf nicht eindeutigem Index zählt voll', plain("SELECT * FROM subscribers WHERE confirm_token = 'x'"), PROBE, true, 'subscribers über Index-Bereich'],
  ['Gleichheit auf UNIQUE-Spalte frei', plain("SELECT * FROM subscribers WHERE email = 'x'"), {}, false],
  ['Gleichheit auf UNIQUE INDEX frei', plain("SELECT * FROM subscribers WHERE feed_token = 'x'"), {}, false],
  ['halber Primärschlüssel (WITHOUT ROWID) zählt voll', plain("SELECT * FROM titel_zeile WHERE url = 'x'"), PROBE, true, 'titel_zeile über Index-Bereich'],
  ['ganzer Primärschlüssel (WITHOUT ROWID) frei', plain("SELECT * FROM titel_zeile WHERE url = 'x' AND plattform = 'y'"), {}, false],
  // Wartung
  ['ANALYZE', plain('ANALYZE'), PROBE, true, 'Wartung'],
  ['PRAGMA optimize', plain('PRAGMA optimize'), PROBE, true, 'Wartung'],
  ['PRAGMA integrity_check', plain('PRAGMA integrity_check'), PROBE, true, 'Wartung'],
  ['PRAGMA quick_check', plain('PRAGMA quick_check'), PROBE, true, 'Wartung'],
  ['REINDEX', plain('REINDEX'), PROBE, true, 'Wartung'],
  ['ANALYZE mit Freigabe frei', plain('ANALYZE'), { ...PROBE, FREIGABEN: freigabe('ANALYZE') }, false],
  // Schreibmenge
  ['UPDATE-Bereich 700.000', plain('UPDATE prime_folge SET uebernommen = 1 WHERE id > 0'), PROBE, true, 'prime_folge'],
  ['DELETE-Bereich', plain('DELETE FROM prime_folge WHERE id > 0'), PROBE, true, 'prime_folge'],
  ['INSERT … SELECT-Bereich', plain('INSERT INTO monitor_alarm (grund) SELECT titel FROM pruefung WHERE id > 0'), PROBE, true, 'pruefung'],
  ['UPDATE-Bereich zählt ins Schreibbudget', plain('UPDATE pruefung SET uebernommen = 1 WHERE id > 0'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 40_000 } }, true, 'geschrieben'],
  ['UPDATE-Bereich unter dem Schreibbudget frei', plain('UPDATE pruefung SET uebernommen = 1 WHERE id > 0'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 30_000 } }, false],
  ['DELETE-Bereich zählt ins Schreibbudget', plain('DELETE FROM pruefung WHERE id > 0'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 40_000 } }, true, 'geschrieben'],
  ['INSERT … SELECT zählt ins Schreibbudget', plain('INSERT INTO monitor_alarm (grund) SELECT titel FROM pruefung WHERE id > 0'), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 40_000 } }, true, 'geschrieben'],
  ['VALUES-Zeilen zählen ins Schreibbudget', remote(werte(300)), { GROESSEN, VERBRAUCH: { ...VERBRAUCH, geschrieben: 59_800 } }, true, 'geschrieben'],
  // Größenliste
  ['negative Größe sperrt', plain('SELECT * FROM prime_folge ORDER BY gemeldet_am'), { GROESSEN: { ...GROESSEN, tabellen: { ...GROESSEN.tabellen, prime_folge: -1 } }, VERBRAUCH }, true, 'ungültig'],
  ['Größe als Text sperrt', plain('SELECT count(*) FROM pruefung'), { GROESSEN: { ...GROESSEN, tabellen: { ...GROESSEN.tabellen, pruefung: '25000' } }, VERBRAUCH }, true, 'ungültig'],
  // Übrige Gegenproben (waren schon richtig, bleiben es)
  ['npm exec --', `npm exec -- wrangler d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['node cf.cjs mit wrangler.js', `node cf.cjs node_modules/wrangler/bin/wrangler.js d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['node-mit-token.cjs npx', `node node-mit-token.cjs npx wrangler d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['Zeilenfortsetzung', `npx wrangler d1 execute DB \\${NL}  --remote \\${NL}  --file ${M51}`, PROBE, true],
  ['--file=', `npx wrangler d1 execute DB --remote --file=${M51}`, PROBE, true],
  ['wrangler@4', `npx wrangler@4.120.0 d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['timeout davor', `timeout 60 npx wrangler d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['pushd', `pushd /c/code/ai/anime-kalender-de/worker && npx wrangler d1 execute DB --remote --file ${M51}`, PROBE, true, null, 'C:/code/ai'],
  ['Zeilenumbruch im --command', `npx wrangler d1 execute DB --remote --command "SELECT 1 -- x${NL}FROM prime_folge"`, PROBE, true],
  ['--remote am Ende', `npx wrangler d1 execute DB --file ${M51} --remote`, PROBE, true],
  ['Wrangler groß geschrieben', `npx Wrangler d1 execute DB --remote --file ${M51}`, PROBE, true],
  ['--local frei', `npx wrangler d1 execute DB --local --file ${M51}`, PROBE, false],
  ['d1 info frei', 'npx wrangler d1 info DB --config wrangler.toml', PROBE, false],
  ['d1 list frei', 'npx wrangler d1 list', PROBE, false],
  ['cat sql frei', `cat ${M51}`, PROBE, false],
  ['grep sql frei', `grep -n "CREATE INDEX" ${M51}`, PROBE, false],
  ['git commit mit Befehl im Text frei', `git commit -m "docs: wrangler d1 execute DB --remote --file ${M51} gesperrt"`, PROBE, false],
  ['git commit mehrzeilig frei', `git commit -m "fix${NL}${NL}npx wrangler d1 migrations apply DB --remote"`, PROBE, false],
  ['echo frei', 'echo "npx wrangler d1 export DB --remote"', PROBE, false],
  ['gh pr create body frei', `gh pr create --title x --body "wrangler d1 execute --remote --command 'DELETE FROM pruefung'"`, PROBE, false],
  ['grep ohne Quotes frei', 'grep -n wrangler d1 --remote docs/x.md', PROBE, false],
  ['d1 insights frei', 'npx wrangler d1 insights DB --json', PROBE, false],
]

// Zweite Prüfung vom 14.10.2026, 16:07 (d1pruef/probe.mjs, Nummern wie dort); Bedrohung: Versehen, nicht Absicht.
const DEL = '--command "DELETE FROM pruefung"'
const Q = "npx wrangler d1 execute DB --remote --command 'DELETE FROM pruefung'"
const REK = 'WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n < 50000000) SELECT p.* FROM r JOIN pruefung p ON p.id = r.n'
const ROH = 'C:/code/ai/anime-kalender-de'
const RUNDE2 = [
  ['P1 d""1', `npx wrangler d""1 execute DB --remote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ["P2 --rem''ote", `npx wrangler d1 execute DB --rem''ote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P3 Backslash vor --remote', `npx wrangler d1 execute DB \\-\\-remote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ["P4 $'--remote'", `npx wrangler d1 execute DB $'--remote' ${DEL}`, PROBE, true, 'nicht auswertbar'],
  ['P5 R=--remote; $R', `R=--remote; npx wrangler d1 execute DB $R ${DEL}`, PROBE, true, 'nicht auswertbar'],
  ['P6 --remote=true vor d1', `npx wrangler --remote=true d1 execute DB ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P7 bash -c --', `bash -c -- "${Q}"`, PROBE, true, 'DELETE ohne WHERE'],
  ['P8 bash <<<', `bash <<< "${Q}"`, PROBE, true, 'DELETE ohne WHERE'],
  ['P9 | bash /dev/stdin', `echo "${Q}" | bash /dev/stdin`, PROBE, true, 'nicht auswertbar'],
  ['P10 source <(…) bekannte Grenze', `source <(echo "${Q}")`, PROBE, false],
  ['P11 env -S bekannte Grenze', `env -S "${Q}"`, PROBE, false],
  ['P12 node -e execSync bekannte Grenze', `node -e "require('child_process').execSync(\\"${Q}\\")"`, PROBE, false],
  ['P13 --command doppelt', `npx wrangler d1 execute DB --remote --command "SELECT * FROM pruefung WHERE id = 1" ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P14 cd "$D" vor --file', `D=${TW}/b; cd "$D" && npx wrangler d1 execute DB --remote --file x.sql`, PROBE, true, 'cd mit $-Variable', `${TW}/a`],
  ['P15 rekursive CTE mit Schlüssel-Join', plain(REK), PROBE, true, 'rekursive CTE'],
  ['P16 PRAGMA main.integrity_check', plain('PRAGMA main.integrity_check'), PROBE, true, 'Wartung'],
  ['P17 pragma_quick_check als Tabelle', plain('SELECT * FROM pragma_quick_check'), PROBE, true, 'pragma_quick_check'],
  ['P18 wrangler.cmd Pfad', `node_modules/.bin/wrangler.cmd d1 execute DB --remote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P19 sh -c einfach', `sh -c '${Q.replace(/'/g, '"')}'`, PROBE, true, 'DELETE ohne WHERE'],
  ['P20 Subshell', `(cd /c/code/ai/anime-kalender-de/worker && npx wrangler d1 execute DB --remote ${DEL})`, PROBE, true, 'DELETE ohne WHERE'],
  ['P21 $( … )', `echo $(npx wrangler d1 execute DB --remote ${DEL})`, PROBE, true, 'DELETE ohne WHERE'],
  ['P22 Backtick', 'echo `npx wrangler d1 execute DB --remote ' + DEL + '`', PROBE, true, 'nicht auswertbar'],
  ['P23 npm exec ohne --', `npm exec wrangler d1 execute DB --remote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P24 env davor', `env CI=1 npx wrangler d1 execute DB --remote ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['P25 Kette ; und &&', `git status; true && npx wrangler d1 execute DB ${DEL} --remote`, PROBE, true, 'DELETE ohne WHERE'],
  ['P26 --command mit DELETE in zweiter Zeile', `npx wrangler d1 execute DB --remote --command "SELECT * FROM pruefung WHERE id = 1;${NL}DELETE FROM pruefung"`, PROBE, true, 'DELETE ohne WHERE'],
  ['P27 lokal DELETE frei', `npx wrangler d1 execute DB --local ${DEL}`, PROBE, false],
  ['P28 ohne Flagge frei', `npx wrangler d1 execute DB ${DEL}`, PROBE, false],
  ['P29 Schlüssel remote frei', 'npx wrangler d1 execute DB --remote --command "SELECT * FROM pruefung WHERE id = 1"', {}, false],
  ['P30 git status frei', 'git status', PROBE, false],
  ['P31 gh pr view frei', 'gh pr view 1229 --json body', PROBE, false],
  ['P32 npm run check:vor-commit frei', 'npm run check:vor-commit', PROBE, false, null, ROH],
  ['P33 npm run check:logic frei', 'npm run check:logic', PROBE, false, null, ROH],
  ['P34 xargs grep nach Doku-Text frei', 'git diff --name-only | xargs grep -ln "wrangler d1 execute DB --remote"', PROBE, false],
  ['P35 for-Schleife mit $f frei', 'for f in docs/*.md; do grep -c "d1 execute --remote" $f; done', PROBE, false],
  ['P36 npm run db:init lokal frei', 'npm run db:init', PROBE, false],
  // eigene Gegenproben zu den neuen Zweigen
  ["$'d1' nach wrangler", `npx wrangler $'d1' execute DB --remote ${DEL}`, PROBE, true, 'nicht auswertbar'],
  ['$-Variable ohne --local und ohne --remote', 'npx wrangler d1 execute DB --command "$SQL"', PROBE, true, 'nicht auswertbar'],
  ['Hülle ohne wrangler mit $-Variable', 'node cf.cjs d1 execute DB $ZIEL --file x.sql', PROBE, true, 'nicht auswertbar'],
  ['d1 als Ordnername mit $-Variable frei', 'cp d1 "$ZIEL"', PROBE, false],
  ['--remote=false frei', `npx wrangler d1 execute DB --remote=false ${DEL}`, PROBE, false],
  ['echo ohne Quotes frei', `echo npx wrangler d1 execute DB --remote ${DEL}`, PROBE, false],
  ['printf mit $-Variable frei', `printf '%s' $X npx wrangler d1 execute DB --remote ${DEL}`, PROBE, false],
  ['xargs vor wrangler nicht auswertbar', `ls | xargs npx wrangler d1 execute DB --remote --file`, PROBE, true, 'nicht auswertbar'],
  ['xargs bash -c prüft den Text', `ls | xargs bash -c "${Q}"`, PROBE, true, 'DELETE ohne WHERE'],
  ['--file doppelt', `npx wrangler d1 execute DB --remote --file "${TW}/mit leer.sql" --file ${M51}`, PROBE, true, 'CREATE INDEX'],
  ['cd wörtlich vor --file', `cd ${TW}/b && npx wrangler d1 execute DB --remote --file x.sql`, PROBE, true, 'DELETE ohne WHERE', `${TW}/a`],
  ['cd "$D", dann cd absolut', `cd "$D" && cd /c/code/ai/anime-kalender-de/worker && npx wrangler d1 execute DB --remote --file ${M51}`, PROBE, true, 'CREATE INDEX', `${TW}/a`],
  ['cd "$D", dann cd relativ', `cd "$D" && cd b && npx wrangler d1 execute DB --remote --file x.sql`, PROBE, true, 'cd mit $-Variable', TW],
  ['cd "$D", --file absolut frei', `cd "$D" && npx wrangler d1 execute DB --remote --file "${TW}/mit leer.sql"`, {}, false],
  ['cd "$D", dann bash -c mit --file', `cd "$D" && bash -c "npx wrangler d1 execute DB --remote --file x.sql"`, PROBE, true, 'cd mit $-Variable', `${TW}/a`],
  ['cd "$D", dann npm run: bekannte Grenze', 'cd "$D" && npm run loesche', PROBE, false],
  ['bash -c -- mit $-Variable', 'bash -c -- "$CMD wrangler d1 --remote"', PROBE, true, 'nicht auswertbar'],
  ['bash <<< mit $-Variable', 'bash <<< "$X d1 --remote"', PROBE, true, 'nicht auswertbar'],
  ['cat <<< bleibt frei', `cat <<< "${Q}"`, PROBE, false],
  ['bash datei.sh bekannte Grenze', `bash x.sh # ${Q}`, PROBE, false],
  ['PRAGMA table_info frei', plain('PRAGMA table_info(pruefung)'), {}, false],
  ['PRAGMA main.table_info gesperrt', plain('PRAGMA main.table_info(pruefung)'), PROBE, true, 'PRAGMA main.table_info: Wartung'],
  ['PRAGMA foreign_key_check gesperrt', plain('PRAGMA foreign_key_check'), PROBE, true, 'PRAGMA foreign_key_check'],
  ['pragma_foreign_key_check gesperrt', plain('SELECT * FROM pragma_foreign_key_check'), PROBE, true, 'pragma_foreign_key_check'],
  ['pragma_table_info neben pragma_quick_check gesperrt', plain("SELECT * FROM pragma_table_info('pruefung'), pragma_quick_check"), PROBE, true, 'pragma_quick_check'],
  ['PRAGMA table_list frei', plain('PRAGMA table_list'), {}, false],
  ['PRAGMA index_list frei', plain('PRAGMA index_list(pruefung)'), {}, false],
  ['PRAGMA index_info frei', plain('PRAGMA index_info(pruefung_folge)'), {}, false],
  ['PRAGMA foreign_key_list frei', plain('PRAGMA foreign_key_list(pruefung)'), {}, false],
  ['Herestring gilt nur für ein Wort', 'cat <<< x && bash "$S" # d1 --remote', PROBE, false],
  ['xargs -0 grep frei', 'git diff -z --name-only | xargs -0 grep -ln "wrangler d1 execute DB --remote"', PROBE, false],
  ['Flagge ohne Wert am Ende frei', 'npx wrangler d1 execute DB --remote --file', PROBE, false],
  ['Herestring-Marke endet am Wort, | bash danach gesperrt', `cat <<< x && echo "${Q}" | bash`, PROBE, true, 'nicht auswertbar'],
  ['wrangler.cmd mit --remote vor d1', `node_modules/.bin/wrangler.cmd --remote d1 execute DB ${DEL}`, PROBE, true, 'DELETE ohne WHERE'],
  ['rekursive CTE über sqlite_master', plain('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n < 5) SELECT name FROM r, sqlite_master'), PROBE, true, 'Volldurchlauf sqlite_master'],
  ['rekursive CTE ohne Tabelle frei', plain('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n < 10) SELECT n FROM r'), {}, false],
]

// Dritte Prüfung vom 14.10.2026 (d1pruef/probe2.mjs): Fehlalarme bei lokalen Aufrufen mit `$` und bei `$.` in SQL.
// Dazu je Sperrregel der Gegenfall „lokal, sonst gleich“: wörtliches --local ohne --remote ist frei (wrangler lehnt beide zugleich ab).
const QL = Q.replace('--remote', '--local')
const lokal = (sql) => `npx wrangler d1 execute DB --local --command "${sql}"`
const RUNDE3 = [
  ['Q25 lokal mit Schleife und "$f" frei', 'for f in migrations/*.sql; do npx wrangler d1 execute DB --local --file "$f"; done', PROBE, false],
  ['Q26 lokal --file "$F" frei', 'npx wrangler d1 execute DB --local --file "$F"', PROBE, false],
  ["Q31 json_extract '$.de' mit Schlüssel frei", plain("SELECT json_extract(sprachen, '$.de') FROM pruefung WHERE id = 1"), {}, false],
  ['$. ohne Quotes ist wörtlich', 'npx wrangler d1 execute DB --remote --command SELECT\\ 1\\ AS\\ \\"x$.y\\"', {}, false],
  ['$1 in SQL bleibt Variable', plain('SELECT * FROM pruefung WHERE id = $1'), PROBE, true, 'nicht auswertbar'],
  ['${X} in SQL bleibt Variable', plain('SELECT * FROM pruefung WHERE id = ${X}'), PROBE, true, 'nicht auswertbar'],
  ['$_ in SQL bleibt Variable', plain('SELECT * FROM pruefung WHERE id = $_'), PROBE, true, 'nicht auswertbar'],
  ['$- in SQL bleibt Variable', plain('SELECT * FROM pruefung WHERE id = $-'), PROBE, true, 'nicht auswertbar'],
  ['$ am Ende ist wörtlich', plain('SELECT * FROM pruefung WHERE id = 1 -- $'), {}, false],
  ['$X in einfachen Quotes ist wörtlich', "npx wrangler d1 execute DB --remote --command 'SELECT * FROM pruefung WHERE id = $X'", {}, false],
  ['--local mit --remote zugleich bleibt geprüft', 'npx wrangler d1 execute DB --local --remote --file "$F"', PROBE, true, 'nicht auswertbar'],
  ['--local mit $-Remote-Form bleibt geprüft', `npx wrangler d1 execute DB --local $'--remote' ${DEL}`, PROBE, true, 'nicht auswertbar'],
  ["$'--local' ist kein wörtliches --local", `npx wrangler d1 execute DB $'--local' --file "$F"`, PROBE, true, 'nicht auswertbar'],
  ['--local im zweiten Befehl gilt nicht für den ersten', 'npx wrangler d1 execute DB $X; npx wrangler d1 execute DB --local --file x.sql', PROBE, true, 'nicht auswertbar'],
  // Gegenfälle zu den Sperrregeln aus Runde 2 (P-Nummern wie dort)
  ['P1 lokal: d""1', `npx wrangler d""1 execute DB --local ${DEL}`, PROBE, false],
  ["P2 lokal: --loc''al", `npx wrangler d1 execute DB --loc''al ${DEL}`, PROBE, false],
  ['P3 lokal: Backslash vor --local', `npx wrangler d1 execute DB \\-\\-local ${DEL}`, PROBE, false],
  ["P4 lokal: $'…' neben --local", `npx wrangler d1 execute DB --local $'--json' ${DEL}`, PROBE, false],
  ['P5 lokal: $R neben --local', `R=--json; npx wrangler d1 execute DB --local $R ${DEL}`, PROBE, false],
  ['P6 lokal: --local vor d1', `npx wrangler --local d1 execute DB ${DEL}`, PROBE, false],
  ['P7 lokal: bash -c --', `bash -c -- "${QL}"`, PROBE, false],
  ['P8 lokal: bash <<<', `bash <<< "${QL}"`, PROBE, false],
  ['P9 lokal: | bash /dev/stdin', `echo "${QL}" | bash /dev/stdin`, PROBE, false],
  ['P13 lokal: --command doppelt', `npx wrangler d1 execute DB --local --command "SELECT 1" ${DEL}`, PROBE, false],
  ['P14 lokal: cd "$D" vor --file', `D=${TW}/b; cd "$D" && npx wrangler d1 execute DB --local --file x.sql`, PROBE, false, null, `${TW}/a`],
  ['P15 lokal: rekursive CTE', lokal(REK), PROBE, false],
  ['P16 lokal: PRAGMA main.integrity_check', lokal('PRAGMA main.integrity_check'), PROBE, false],
  ['P17 lokal: pragma_quick_check', lokal('SELECT * FROM pragma_quick_check'), PROBE, false],
  ['P18 lokal: wrangler.cmd', `node_modules/.bin/wrangler.cmd d1 execute DB --local ${DEL}`, PROBE, false],
  ['P19 lokal: sh -c', `sh -c '${QL.replace(/'/g, '"')}'`, PROBE, false],
  ['P20 lokal: Subshell', `(cd /c/code/ai/anime-kalender-de/worker && npx wrangler d1 execute DB --local ${DEL})`, PROBE, false],
  ['P21 lokal: $( … )', `echo $(npx wrangler d1 execute DB --local ${DEL})`, PROBE, false],
  ['P22 lokal: Backtick', 'echo `npx wrangler d1 execute DB --local ' + DEL + '`', PROBE, false],
  ['P23 lokal: npm exec', `npm exec wrangler d1 execute DB --local ${DEL}`, PROBE, false],
  ['P24 lokal: env davor', `env CI=1 npx wrangler d1 execute DB --local ${DEL}`, PROBE, false],
  ['P25 lokal: Kette', `git status; true && npx wrangler d1 execute DB ${DEL} --local`, PROBE, false],
  ['P26 lokal: DELETE in zweiter Zeile', `npx wrangler d1 execute DB --local --command "SELECT 1;${NL}DELETE FROM pruefung"`, PROBE, false],
  ["lokal: $'d1' nach wrangler", `npx wrangler $'d1' execute DB --local ${DEL}`, PROBE, false],
  ['lokal: $-Variable als --command', 'npx wrangler d1 execute DB --local --command "$SQL"', PROBE, false],
  ['lokal: Hülle ohne wrangler mit $-Variable', 'node cf.cjs d1 execute DB $ZIEL --local --file x.sql', PROBE, false],
  ['lokal: xargs vor wrangler', 'ls | xargs npx wrangler d1 execute DB --local --file', PROBE, false],
  ['lokal: eval mit $-Variable', 'eval "npx wrangler d1 execute DB --local --file $f"', PROBE, false],
  ['lokal: $W als Befehl', `$W d1 execute DB --local ${DEL}`, PROBE, false],
  ['lokal: xargs bash -c', `ls | xargs bash -c "${QL}"`, PROBE, false],
  ['lokal: --file doppelt', `npx wrangler d1 execute DB --local --file "${TW}/mit leer.sql" --file ${M51}`, PROBE, false],
  ['lokal: cd "$D", dann cd relativ', 'cd "$D" && cd b && npx wrangler d1 execute DB --local --file x.sql', PROBE, false, null, TW],
  ['lokal: cd "$D", dann bash -c', 'cd "$D" && bash -c "npx wrangler d1 execute DB --local --file $f"', PROBE, false, null, `${TW}/a`],
  ['lokal: bash -c -- mit $-Variable', 'bash -c -- "$CMD wrangler d1 --local"', PROBE, false],
  ['lokal: bash <<< mit $-Variable', 'bash <<< "$X d1 --local"', PROBE, false],
  ['bash -c mit $-Befehl neben lokalem Aufruf bleibt gesperrt', 'bash -c "npx wrangler d1 execute DB --local --file x.sql; $CMD" # d1', PROBE, true, 'nicht auswertbar'],
  ['lokal: PRAGMA foreign_key_check', lokal('PRAGMA foreign_key_check'), PROBE, false],
  ['lokal: rekursive CTE über sqlite_master', lokal('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n < 5) SELECT name FROM r, sqlite_master'), PROBE, false],
  ['lokal: Herestring, dann | bash', `cat <<< x && echo "${QL}" | bash`, PROBE, false],
  ['"$(…)" in Anführungszeichen nicht auswertbar', 'npx wrangler d1 execute DB --remote --command "SELECT $(cat q)"', PROBE, true, 'nicht auswertbar'],
  ['"$$" in Anführungszeichen nicht auswertbar', 'npx wrangler d1 execute DB --remote --command "SELECT $$"', PROBE, true, 'nicht auswertbar'],
  ['Dateiname d1-limit.ts mit $-Variable ist kein D1-Aufruf', 'M=sed; $M -n 1p worker/src/d1-limit.ts', PROBE, false],
  ['lokal: bash -c mit $-Aufruf und weiterem Befehl', 'bash -c "npx wrangler d1 execute DB --local --command \\"$X\\"; echo fertig"', PROBE, false],
  ['eval mit lokalem und entferntem $-Aufruf gesperrt', `eval 'npx wrangler d1 execute DB --local --command "$X"; npx wrangler d1 execute DB --remote --command "$Y"'`, PROBE, true, 'nicht auswertbar'],
]

// Commit-Nachrichten und Heredocs (20.10.2026): Text als Daten ist frei, was die Shell ausführt (`$(…)`, Backtick, unquotierter Heredoc, Hüllen) bleibt geprüft.
const WTXT = 'npx wrangler d1 execute DB --remote --command $G'
const WSUB = `npx wrangler d1 execute DB --remote --command "$G"`
const MSG = `Hook: "${WTXT}" (don't) sperrt nicht mehr`
const NZ = (text) => `git commit -m "$(cat <<'EOF'\n${text}\nEOF\n)"`
const RUNDE4 = [
  ['Daten: commit -m mit wrangler-Text und $G', `git commit -m "fix: ${WTXT}"`, {}, false],
  ['Daten: commit mit Heredoc-Nachricht, Anführungszeichen, Apostroph und Klammer darin', NZ(`${MSG} )`), {}, false],
  ['Daten: gh pr create --body mit Heredoc-Nachricht und Anführungszeichen', `gh pr create --title t --body "$(cat <<'EOF'\n${MSG}\nEOF\n)"`, {}, false],
  ['Daten: commit -F - mit quotiertem Heredoc', `git commit -F - <<'EOF'\n${MSG}\nEOF`, {}, false],
  ['Daten: cat > Datei mit quotiertem Heredoc', `cat > f.md <<'EOF'\n${MSG}\nEOF`, {}, false],
  ['Daten: cat > Datei mit unquotiertem Heredoc ohne Ersetzung', `cat > f.md <<EOF\n${MSG}\nEOF`, {}, false],
  ['Daten: quotierter Heredoc mit $(…) und Backtick im Text wird nicht ausgeführt', `cat > f.md <<'EOF'\nx $(${WSUB}) \`${WSUB}\`\nEOF`, {}, false],
  ['Daten: Heredoc-Nachricht mit einzelner ) und danach wrangler-Text', NZ(`Klammer ) danach ${WTXT}`), {}, false],
  ['Daten: Heredoc-Nachricht mit einzelnem Anführungszeichen und wrangler-Text', NZ(`5" Zoll ${WTXT}`), {}, false],
  ['Daten: Heredoc-Nachricht mit einzelnem Apostroph und wrangler-Text', NZ(`it's ${WTXT} x`), {}, false],
  ['Daten: Heredoc-Nachricht mit ) und danach einzelnem Anführungszeichen vor wrangler-Text', NZ(`Klammer ) 5" Zoll ${WTXT}`), {}, false],
  ['Daten: ")" in Quotes im $(…), danach wrangler-Text bloß', `git commit -m "$(echo ")" ; echo ${WTXT})"`, {}, false],
  ['Daten: maskierte Klammer im $(…), danach Anführungszeichen und wrangler-Text', `git commit -m "$(echo \\) 5" Zoll ${WTXT})"`, {}, false],
  ['Daten: ")" in Quotes im $(…) schließt nicht', `git commit -m "$(echo ")"; echo "${WTXT}")"`, {}, false],
  ["Daten: ')' in einfachen Quotes im $(…) schließt nicht", `git commit -m "$(echo ')'; echo "${WTXT}")"`, {}, false],
  ['Daten: verschachtelte Quotes und $(…) im $(…)', `git commit -m "$(echo "a $(echo "b") ${WTXT}")"`, {}, false],
  ['Daten: verschachtelte Klammer im $(…)', `git commit -m "$(echo $(date) ; echo ${WTXT})" -m "x" && echo "${WTXT}"`, {}, false],
  ['Daten: Herestring im $(…)', `git commit -m "$(cat <<< x)" && echo "${WTXT}"`, {}, false],
  ['Daten: Backtick-Ersetzung mit harmlosem Inhalt', 'git commit -m "x `date` y ' + WTXT + '"', {}, false],
  ['Daten: Nachricht fertig, danach harmloser Befehl', `${NZ(MSG)} && git push`, {}, false],
  ['Gegen: cat <<EOF | bash führt den Text aus', `cat <<EOF | bash\n${WTXT}\nEOF`, {}, true, 'nicht auswertbar'],
  ['Gegen: bash -c führt den Text aus', `bash -c "${WSUB}"`, {}, true, 'nicht auswertbar'],
  ['Gegen: eval führt den Text aus', `eval "${WTXT}"`, {}, true, 'nicht auswertbar'],
  ['Gegen: xargs führt den Text aus', `echo x | xargs ${WTXT}`, {}, true, 'nicht auswertbar'],
  ['Gegen: sh <<EOF führt den Text aus', `sh <<EOF\n${WTXT}\nEOF`, {}, true, 'nicht auswertbar'],
  ['Gegen: $(…) in Commit-Nachricht führt aus', `git commit -m "x $(${WSUB})"`, {}, true, 'nicht auswertbar'],
  ['Gegen: Backtick in Commit-Nachricht führt aus', 'git commit -m "x `' + WSUB + '`"', {}, true, 'nicht auswertbar'],
  ['Gegen: $(…) in gh --body führt aus', `gh pr create --body "$(${WSUB})"`, {}, true, 'nicht auswertbar'],
  ['Gegen: $(…) in echo "…" führt aus', `echo "$(${WSUB})"`, {}, true, 'nicht auswertbar'],
  ['Gegen: unquotierter Heredoc (commit -F -) führt $(…) aus', `git commit -F - <<EOF\nx $(${WSUB})\nEOF`, {}, true, 'nicht auswertbar'],
  ['Gegen: unquotierter Heredoc (cat >) führt Backtick aus', 'cat > f <<EOF\nx `' + WSUB + '`\nEOF', {}, true, 'nicht auswertbar'],
  ['Gegen: $(…) nach der Heredoc-Nachricht im selben $(…)', NZ(MSG).replace('\nEOF\n)', `\nEOF\n${WSUB}\n)`), {}, true, 'nicht auswertbar'],
  ['Gegen: verschachteltes "$(…)" in $(…)', `git commit -m "$(echo "$(${WSUB})")"`, {}, true, 'nicht auswertbar'],
  ['Gegen: Aufruf nach der Nachricht', `${NZ(MSG)}; ${WSUB}`, {}, true, 'nicht auswertbar'],
  ['Gegen: sechsfach verschachteltes $(…) ist nicht auswertbar', 'echo "$(echo "$(echo "$(echo "$(echo "$(echo "$(echo d1 --remote)")")")")")"', {}, true, 'Skripttiefe'],
  ['Gegen: wörtlicher Aufruf in $(…) wird geprüft (Volldurchlauf ohne Größenliste)', `git commit -m "$(npx wrangler d1 execute DB --remote --command 'SELECT * FROM pruefung')"`, {}, true],
]

// Weitere D1: ticket-board (echte Konfiguration, kein schema.sql, migrations_dir = migrationen) und ein Ordner mit eigener Test-Kennung.
const BOARD = 'C:/code/ai/ticket-board/cloud'
const BOARD_ID = '9fcbb2a7-acb4-43cb-b4a1-6a18bf04a2b7'
const FIX = 'C:/Users/ih/.claude/hooks/state/d1-test-fix'
const FIX_ID = 'test-fix-0000'
const board = (sql, ziel = '--remote') => `npx wrangler d1 execute ticket-board ${ziel} --config wrangler.toml --command "${sql}"`
const VOLL = "SELECT * FROM tickets WHERE titel LIKE '%x%' LIMIT 5"
const BG = { stand: vor(60), tabellen: { tickets: 50_000 } }
const BV = { stand: vor(5), gelesen: 100_000, geschrieben: 100 }
const RUNDE5 = [
  ['Board: Schlüsselzugriff frei ohne Zustand', board('SELECT * FROM tickets WHERE id = 5'), {}, false, '', BOARD],
  ['Board: --local frei', board(VOLL, '--local'), {}, false, '', BOARD],
  ['Board: Volldurchlauf ohne Größenliste gesperrt (Kalender-Größen gelten nicht)', board(VOLL), { GROESSEN, VERBRAUCH }, true, 'Volldurchlauf tickets (Größe unbekannt)', BOARD],
  ['Board: Volldurchlauf mit Board-Größen und Board-Verbrauch frei', board(VOLL), { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, false, '', BOARD],
  ['Board: Kalender-Verbrauch zählt nicht für das Board', board(VOLL), { BOARD_GROESSEN: BG, VERBRAUCH }, true, 'kein gemessener Tagesverbrauch', BOARD],
  ['Board: Budget des Boards ist erschöpft', board(VOLL), { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: { ...BV, gelesen: 2_990_000 } }, true, 'Tagesbudget', BOARD],
  ['Board: Budget des Boards sperrt nur das Board (Kalender frei)', remote('SELECT count(*) FROM pruefung'), { GROESSEN, VERBRAUCH, BOARD_VERBRAUCH: { ...BV, gelesen: 2_990_000 } }, false, '', WORKER],
  ['Kalender: Board-Verbrauch zählt nicht für den Kalender', remote("SELECT * FROM pruefung WHERE titel LIKE '%x%' LIMIT 5"), { GROESSEN, BOARD_VERBRAUCH: BV }, true, 'kein gemessener Tagesverbrauch', WORKER],
  ['Board: Ordner über den Namen gefunden (cwd fremd), Board-Schema gilt', board(VOLL).replace(' --config wrangler.toml', ''), { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, false, '', 'C:\\code\\ai'],
  ['Board: Kalender-Tabelle gibt es im Board nicht (Kalender-Schema gilt dort nicht)', board('SELECT * FROM pruefung'), { GROESSEN, VERBRAUCH, BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, true, '', BOARD],
  ['Board: migrations apply bleibt gesperrt', 'CI=true npx wrangler d1 migrations apply ticket-board --remote --config wrangler.toml', { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, true, 'migrations apply', BOARD],
  ['Board: export bleibt gesperrt', 'npx wrangler d1 export ticket-board --remote --output x.sql', { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, true, 'export', BOARD],
  ['Board: Index auf großer Tabelle gesperrt', board('CREATE INDEX t_x ON tickets(titel)'), { BOARD_GROESSEN: BG, BOARD_VERBRAUCH: BV }, true, 'CREATE INDEX auf tickets', BOARD],
  ['Fix-Ordner (toml mit migrations_dir, kein schema.sql): Volldurchlauf ohne Größen gesperrt', `npx wrangler d1 execute x --remote --config ${FIX}/wrangler.toml --command "SELECT * FROM fix_tabelle WHERE a LIKE '%x%'"`, { VERBRAUCH }, true, 'Volldurchlauf fix_tabelle', WORKER],
  ['Fix-Ordner: mit eigenen Größen und eigenem Verbrauch frei', `npx wrangler d1 execute x --remote --config ${FIX}/wrangler.toml --command "SELECT * FROM fix_tabelle WHERE a LIKE '%x%'"`, { FIX_GROESSEN: { stand: vor(60), tabellen: { fix_tabelle: 50_000 } }, FIX_VERBRAUCH: BV }, false, '', WORKER],
]

function testWorker() {
  mkdirSync(`${FIX}/mig`, { recursive: true })
  writeFileSync(`${FIX}/mig/0001.sql`, 'CREATE TABLE fix_tabelle (id INTEGER PRIMARY KEY, a TEXT);')
  writeFileSync(`${FIX}/wrangler.toml`, `name = "fix"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "fix"\ndatabase_id = "${FIX_ID}"\nmigrations_dir = "mig"\n`)
  mkdirSync(`${TW}/migrations`, { recursive: true })
  writeFileSync(`${TW}/schema.sql`, SCHEMA_TW)
  writeFileSync(`${TW}/wrangler.toml`, 'name = "test"\n')
  writeFileSync(`${TW}/mit leer.sql`, 'SELECT * FROM pruefung WHERE id = 1')
  mkdirSync(`${TW}/a`, { recursive: true })
  mkdirSync(`${TW}/b`, { recursive: true })
  writeFileSync(`${TW}/a/x.sql`, 'SELECT * FROM pruefung WHERE id = 1')
  writeFileSync(`${TW}/b/x.sql`, 'DELETE FROM pruefung')
  const loesche = 'npx wrangler d1 execute DB --remote --config wrangler.toml --command "DELETE FROM monitor_alarm"'
  const skripte = {
    loesche,
    kette: 'npm run loesche',
    prehallo: loesche,
    hallo: 'echo hallo',
    nachher: 'echo nachher',
    postnachher: loesche,
    schleife: 'npm run schleife',
    lokal: 'npx wrangler d1 execute DB --config wrangler.toml',
  }
  writeFileSync(`${TW}/package.json`, JSON.stringify({ scripts: skripte }))
  mkdirSync(KAPUTT, { recursive: true })
  writeFileSync(`${KAPUTT}/schema.sql`, SCHEMA_TW)
  writeFileSync(`${KAPUTT}/migrations`, 'keine Mappe')
  writeFileSync(`${KAPUTT}/wrangler.toml`, 'name = "test"\n')
}

function zustand({ GROESSEN: g, VERBRAUCH: v, FREIGABEN: f, BOARD_GROESSEN, BOARD_VERBRAUCH, FIX_GROESSEN, FIX_VERBRAUCH }) {
  rmSync(ORDNER, { recursive: true, force: true })
  mkdirSync(ORDNER, { recursive: true })
  for (const [id, gr, ve] of [[BOARD_ID, BOARD_GROESSEN, BOARD_VERBRAUCH], [FIX_ID, FIX_GROESSEN, FIX_VERBRAUCH]]) {
    if (gr) writeFileSync(`${ORDNER}/d1-groessen-${id}.json`, JSON.stringify(gr))
    if (ve) writeFileSync(`${ORDNER}/d1-verbrauch-${id}.json`, JSON.stringify(ve))
  }
  if (g) writeFileSync(`${ORDNER}/d1-groessen.json`, JSON.stringify(g))
  if (v) writeFileSync(`${ORDNER}/d1-verbrauch.json`, JSON.stringify(v))
  if (f) writeFileSync(`${ORDNER}/d1-freigaben.json`, JSON.stringify(f))
}

let fehler = 0
testWorker()
// Nach `cd "$D"` darf keine package.json aus dem Prozessordner gelesen werden; hier liegt eine mit `loesche`.
const vorher = process.cwd()
process.chdir(TW)
const ALLE = [...FAELLE, ...LUECKEN, ...RUNDE2, ...RUNDE3, ...RUNDE4, ...RUNDE5]
for (const [name, befehl, z, soll, text, cwd] of ALLE) {
  zustand(z)
  const grund = pruefe({ tool_name: 'Bash', cwd: cwd ?? WORKER, tool_input: { command: befehl } }, { ordner: ORDNER, jetzt: JETZT })
  const ist = grund !== null
  const textOk = !text || (grund ?? '').includes(text)
  if (ist !== soll || !textOk) {
    fehler++
    console.log(`FEHLER ${name} (gesperrt: ${ist}, erwartet: ${soll}${text ? `, Text „${text}“: ${textOk}` : ''})\n${grund ?? ''}`)
  } else console.log(`ok     ${name}`)
}
process.chdir(vorher)
for (const d of [ORDNER, TW, KAPUTT, FIX]) rmSync(d, { recursive: true, force: true })
console.log(fehler ? `${fehler} Fehler` : `alle ${ALLE.length} Fälle ok`)
process.exit(fehler ? 1 : 0)
