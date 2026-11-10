// Test für das Befehls-Register: node .claude/hooks/befehlsregister-test.mjs
// Prüft Maskierung (mit Testgeheimnissen), Pre-Modul im Bündel (Befehl bleibt unverändert, kein updatedInput, deny gewinnt, escalate bleibt),
// Post-Hook (Exit, Zeitlimit), Rotation/Größenbegrenzung, Abfragewerkzeug, Kandidatenregeln und Ende zu Ende mit einem echten Prozess.
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Braucht Daniels Rechner (Werkzeug befehlsregister.mjs, Prozess-Inventur): in der CI übersprungen, die Zeile belegt es.
if (!fs.existsSync('C:/code/ai/__assets/tools/befehlsregister.mjs')) {
  console.log('befehlsregister-test: übersprungen (C:/code/ai/__assets fehlt, läuft nur auf Daniels Rechner)')
  process.exit(0)
}

const HIER = path.dirname(fileURLToPath(import.meta.url))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'befehlsregister-test-'))
process.env.BR_DIR = path.join(TMP, 'befehle') // vor dem Laden der Module: sie lesen den Ort einmal
const require = createRequire(import.meta.url)
const reg = require('./befehlsregister.js')
const { entscheide } = require('./dispatch-pretooluse.js')
const TOOL = 'C:/code/ai/__assets/tools/befehlsregister.mjs'
const werkzeug = await import(pathToFileURL(TOOL).href)
const werkzeugDatei = (name) => import(pathToFileURL(path.join(path.dirname(TOOL), name)).href)
const leer = await werkzeugDatei('befehlsregister-leer.mjs')
const { ordneZu, FENSTER_MS, SCHUB_MS, SEKUNDEN_UNSCHAERFE_MS } = await werkzeugDatei('befehlsregister-zuordnen.mjs')
const { leseProzesse } = await werkzeugDatei('prozess-inventur/wmi.mjs')
const befehleJetzt = () => werkzeug.verbinde(werkzeug.leseZeilen()).befehle
const BASH = 'C:/Program Files/Git/usr/bin/bash.exe'
/** Startet eine Shell wie das Bash-Werkzeug (stdin offen, Befehl im eval, KEINE Marke im Befehl). Die Pre-Zeile steht vorher im Register. */
const starteShell = (cmd) => spawn(BASH, ['-c', `eval '${cmd}' && pwd -P >| /dev/null`], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true })
/** taskkill /T erreicht msys-Kinder nicht; deshalb jedes Mitglied der zugeordneten Bäume einzeln. */
function raeumeTestshells(ids) {
  const zu = ordneZu(leseProzesse(), befehleJetzt())
  const winpids = leer.gruppen(ids, leer.msysProzesse(), zu).flatMap((g) => g.mitglieder.map((p) => p.winpid))
  if (winpids.length) spawnSync('taskkill', ['/F', ...winpids.flatMap((w) => ['/PID', String(w)])], { windowsHide: true })
}

const lies = () => (fs.existsSync(reg.tagesdatei()) ? fs.readFileSync(reg.tagesdatei(), 'utf8').trim().split('\n').map((z) => JSON.parse(z)) : [])
const leere = () => fs.rmSync(process.env.BR_DIR, { recursive: true, force: true })
const bash = (command, extra = {}) => ({ tool_name: 'Bash', session_id: 's1', tool_use_id: 'toolu_T1', cwd: 'C:/x', tool_input: { command, ...extra.ti }, ...extra.rest })
const ok = (name) => console.log(`ok   ${name}`)

// 1. Maskierung: kein Testgeheimnis darf im Klartext bleiben; harmlose Befehle bleiben unverändert
const FAKE = {
  bearer: 'AbCdEf0123456789XyZ', ghp: `ghp_${'a1B2'.repeat(9)}`, sk: `sk-${'q9W8'.repeat(6)}`, akia: 'AKIAABCDEFGHIJKLMNOP',
  flag: 'geheimerwert4711', pw: 'mein geheimes passwort', env: 'umgebungswert8812', hdr: 'schluessel-9981', url: 'hunter2pass',
  xox: 'xoxb-1234567890-abcdefghij', npm: `npm_${'z7Y6'.repeat(8)}`, jwt: 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4',
}
const MASK_FAELLE = [
  `curl -H "Authorization: Bearer ${FAKE.bearer}" https://x.test`, `gh api -H 'Authorization: token ${FAKE.ghp}' /user`,
  `export GITHUB_TOKEN=${FAKE.ghp} && gh pr list`, `openai --key ${FAKE.sk}`, `aws s3 ls # ${FAKE.akia}`,
  `tool --token ${FAKE.flag} run`, `tool --api-key=${FAKE.flag}`, `mysql --password "${FAKE.pw}" db`, `FOO_SECRET=${FAKE.env} node a.js`,
  `curl -H "X-Api-Key: ${FAKE.hdr}" u`, `git clone https://user:${FAKE.url}@host.test/r.git`, `slack ${FAKE.xox}`, `npm publish ${FAKE.npm}`, `curl -H "x: ${FAKE.jwt}" u`,
]
const GEHEIM = Object.values(FAKE).flatMap((v) => (v === FAKE.pw ? ['mein geheimes', 'passwort'] : [v]))
for (const f of MASK_FAELLE) {
  const m = reg.maskiere(f)
  for (const g of GEHEIM) assert.ok(!m.includes(g), `Geheimnis „${g}“ blieb stehen in: ${m}`)
}
for (const harmlos of ['git status --short', 'git log --author=bob --oneline', 'echo "token ist ein Wort"', 'node a.mjs --key-count 3', 'ls -la /c/code']) {
  assert.equal(reg.maskiere(harmlos), harmlos, `harmloser Befehl verändert: ${harmlos}`)
}
ok(`Maskierung: ${MASK_FAELLE.length} Geheimnisformen ohne Klartext, harmlose Befehle unverändert`)

// 2. Pre-Modul über das Bündel: Befehl bleibt unverändert (kein updatedInput, sonst lehnt der Auto-Modus parallele Aufrufe ab),
// nie permissionDecision; die Zeile trägt den Befehl, über den das Werkzeug den Prozess findet
leere()
let d = entscheide(bash('echo hi', { ti: { timeout: 5000, description: 'x' } }))
assert.equal(d, null, 'weder updatedInput noch Entscheidung')
let z = lies()[0]
assert.deepEqual([z.ev, z.agent, z.typ, z.id, z.sid, z.to, z.bg, z.cwd], ['pre', 'haupt', 'haupt', 'toolu_T1', 's1', 5000, undefined, undefined])
reg.pruefe(bash(`echo ${'x'.repeat(5000)}`))
assert.equal(lies().at(-1).cmd.length, 200, 'Befehl wird auf 200 Zeichen gekürzt (schlanke Zeile)')
assert.equal(z.mod, undefined, 'kein Vermerk „geändert“: der Befehl wird nie geändert')
ok('Pre: Befehl unverändert, kein permissionDecision, Hauptsitzung = haupt')

// 2b. Auch Befehle mit offenem Ende (&&, |, Zeilenfortsetzung) und schon vorhandener Marke bleiben unberührt
const OFFENE_ENDEN = ['echo a &&', 'echo a |', 'echo a \\', 'echo a ||', '# br:toolu_T1\necho a']
for (const f of OFFENE_ENDEN) {
  leere()
  assert.equal(entscheide(bash(f)), null, `Befehl verändert: ${JSON.stringify(f)}`)
  assert.equal(lies()[0].cmd, f, 'Befehl steht unverändert in der Zeile')
}
ok(`Pre: ${OFFENE_ENDEN.length} Befehle mit offenem Ende oder Marke unberührt`)

leere()
entscheide(bash('echo a', { rest: { agent_id: 'agent123', agent_type: 'bauer' }, ti: { run_in_background: true } }))
z = lies()[0]
assert.deepEqual([z.agent, z.typ, z.bg], ['agent123', 'bauer', true])
ok('Pre: Subagent mit agent_id/agent_type und run_in_background')

// 3. Geheimnis landet nie im Register, der echte Befehl bleibt unmaskiert
leere()
d = entscheide(bash(`tool --token ${FAKE.flag}`))
assert.equal(d, null, 'der auszuführende Befehl darf nicht verändert werden')
assert.ok(!fs.readFileSync(reg.tagesdatei(), 'utf8').includes(FAKE.flag))
ok('Register enthält kein Geheimnis, der Befehl bleibt unverändert')

// 4. deny anderer Module gewinnt (kein updatedInput, Zeile `deny`). Seit 13.10. sperrt guard auch Server (deny statt escalate).
leere()
d = entscheide(bash('powershell -c ls'))
assert.equal(d.permissionDecision, 'deny')
assert.equal(d.updatedInput, undefined)
assert.deepEqual(lies().map((x) => x.ev), ['pre', 'deny'])
ok('Bündel: deny gewinnt, kein updatedInput')

// 5. Nicht-Bash wird nicht protokolliert, Bash auch ohne tool_use_id
leere()
assert.equal(reg.pruefe({ tool_name: 'Read', tool_input: { file_path: 'x' } }), null)
assert.equal(lies().length, 0, 'Nicht-Bash ohne Zeile')
assert.equal(reg.pruefe(bash('echo b', { rest: { tool_use_id: undefined } })), null)
assert.equal(lies().filter((x) => x.cmd === 'echo b').length, 1, 'ohne tool_use_id wird trotzdem protokolliert')
ok('Nicht-Bash ignoriert, Bash ohne tool_use_id protokolliert')

// 6. Post-Hook als echter Prozess: Erfolg, Fehler mit Exit-Code, Zeitlimit-Verschiebung
leere()
const post = (ev) => spawnSync(process.execPath, [path.join(HIER, 'befehlsregister-post.js')], { input: JSON.stringify({ tool_name: 'Bash', session_id: 's1', ...ev }), env: process.env, encoding: 'utf8' })
post({ hook_event_name: 'PostToolUse', tool_use_id: 'toolu_OK', duration_ms: 12, tool_response: JSON.stringify({ stdout: 'x', interrupted: false }) })
post({ hook_event_name: 'PostToolUseFailure', tool_use_id: 'toolu_F', agent_id: 'ag1', agent_type: 'bauer', error: 'Exit code 3', duration_ms: 40 })
post({ hook_event_name: 'PostToolUse', tool_use_id: 'toolu_BG', duration_ms: 120000, tool_response: JSON.stringify({ backgroundTaskId: 'b1', timedOutAfterMs: 120000 }) })
const p = Object.fromEntries(lies().map((x) => [x.id, x]))
assert.deepEqual(Object.keys(p.toolu_OK), ['t', 'ev', 'id', 'dur', 'exit'], 'schlanke Post-Zeile ohne Agent, Sitzung und leere Felder')
assert.deepEqual([p.toolu_OK.exit, p.toolu_OK.dur, p.toolu_OK.bgTask], [0, 12, undefined])
assert.deepEqual([p.toolu_F.exit, p.toolu_F.dur], [3, 40])
assert.deepEqual([p.toolu_BG.bgTask, p.toolu_BG.zeitlimitMs], ['b1', 120000])
assert.equal(post({ tool_name: 'Edit' }).status, 0)
ok('Post: Exit aus „Exit code N“, Dauer, Zeitlimit-Ereignis (backgroundTaskId, timedOutAfterMs)')

// 7. Rotation: Dateien über 14 Tage verschwinden spätestens am nächsten Post-Lauf; Größenbegrenzung je Tag
const alt = path.join(process.env.BR_DIR, '2020-01-01.jsonl')
const jung = path.join(process.env.BR_DIR, `${new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)}.jsonl`)
fs.writeFileSync(alt, '{}\n')
fs.writeFileSync(jung, '{}\n')
fs.utimesSync(path.join(process.env.BR_DIR, '.rotation'), new Date(Date.now() - 25 * 3600000), new Date(Date.now() - 25 * 3600000))
post({ hook_event_name: 'PostToolUse', tool_use_id: 'toolu_R', tool_response: '{}' })
assert.ok(!fs.existsSync(alt), 'alte Tagesdatei wurde nicht gelöscht')
assert.ok(fs.existsSync(jung), 'junge Tagesdatei fälschlich gelöscht')
for (const n of ['2020-01-01.jsonl', '2020-01-01.2.jsonl', '2020-01-01.grenze']) fs.writeFileSync(path.join(process.env.BR_DIR, n), '{}\n')
assert.deepEqual(reg.rotiere(Date.now()), [], 'zweiter Lauf am selben Tag darf nicht erneut aufräumen')
assert.deepEqual(reg.rotiere(Date.now() + 25 * 3600000).sort(), ['2020-01-01.2.jsonl', '2020-01-01.grenze', '2020-01-01.jsonl'], 'nach 25 h muss die Rotation wieder greifen, auch für Folgedateien und Grenzmarke')
ok('Rotation: >14 Tage weg (täglich), auch Folgedateien und Grenzmarke')

// 7b. Keine stille Grenze (13.10.: ab 16:58 blind): volle Tagesdatei → Folgedatei, die `suche` sofort findet; erst wenn alle
// Folgedateien voll sind, fehlt der Eintrag, und dann meldet `kandidaten` (Wächter) die Grenzmarke.
leere()
fs.mkdirSync(process.env.BR_DIR, { recursive: true })
const voll = (datei) => {
  fs.writeFileSync(datei, '')
  fs.truncateSync(datei, reg.MAX_TAGESDATEI + 1)
}
voll(reg.tagesdatei())
const preNachGrenze = { t: new Date().toISOString(), ev: 'pre', id: 'toolu_NACHGRENZE', agent: 'agG', typ: 'bauer', cmd: 'echo nach der Grenze' }
assert.equal(reg.schreibe(preNachGrenze), true, 'volle Tagesdatei: Eintrag muss in die Folgedatei')
assert.ok(fs.existsSync(reg.tagesdatei().replace(/\.jsonl$/, '.2.jsonl')), 'Folgedatei <Tag>.2.jsonl fehlt')
const sucheNach = execFileSync(process.execPath, [TOOL, 'suche', 'nach der Grenze', '--seit', '2h'], { env: process.env, encoding: 'utf8' })
assert.match(sucheNach, /1 Treffer von 1 Befehlen/, `suche --seit 2h findet den Eintrag nach der Grenze nicht: ${sucheNach}`)
for (let n = 2; n <= reg.MAX_FOLGEDATEIEN; n++) voll(reg.tagesdatei().replace(/\.jsonl$/, `.${n}.jsonl`))
assert.equal(reg.schreibe(preNachGrenze), false)
const grenzText = execFileSync(process.execPath, [TOOL, 'kandidaten', '--still'], { env: { ...process.env, BR_NAME: '^keinprozess$' }, encoding: 'utf8' })
assert.match(grenzText, /Register-Grenze am \d{4}-\d{2}-\d{2} erreicht/, `kandidaten meldet die Grenze nicht: ${grenzText}`)
leere()
ok('Grenze: Folgedatei sofort lesbar (suche --seit 2h), alle voll → Grenzmarke in kandidaten')

// 8. Abfragen: Verbinden, suche, Filter, Statistik
leere()
const t0 = Date.now() - 3 * 3600000
const pre = (id, agent, typ, cmd, min, extra = {}) => ({ t: new Date(t0 + min * 60000).toISOString(), ev: 'pre', sid: agent === 'haupt' ? 'sA' : 'sB', id, agent, typ, cmd, bg: false, ...extra })
const post2 = (id, agent, min, extra) => ({ t: new Date(t0 + min * 60000 + 1000).toISOString(), ev: 'post', id, agent, dur: 100, exit: 0, ...extra })
const zeilen = [
  pre('toolu_1', 'haupt', 'haupt', 'git status', 0), post2('toolu_1', 'haupt', 0),
  pre('toolu_2', 'ag1', 'bauer', 'node build.mjs', 1), post2('toolu_2', 'ag1', 1, { exit: 2, dur: 900 }),
  pre('toolu_3', 'ag1', 'bauer', 'node lang.mjs', 2), post2('toolu_3', 'ag1', 2, { bgTask: 'b9', zeitlimitMs: 120000, dur: 120000 }),
  pre('toolu_4', 'ag1', 'bauer', 'sleep 900', 3),
  { t: new Date(t0 + 4 * 60000).toISOString(), ev: 'deny', id: 'toolu_5', agent: 'ag2', typ: 'pruefer', grund: 'x' }, pre('toolu_5', 'ag2', 'pruefer', 'powershell x', 4),
]
const { befehle, enden } = werkzeug.verbinde(zeilen)
assert.equal(befehle.length, 5)
assert.deepEqual(werkzeug.sucheBefehle(befehle, 'node').map((b) => b.id), ['toolu_2', 'toolu_3'])
assert.deepEqual(werkzeug.sucheBefehle(befehle, '', { agent: 'bauer' }).length, 3)
assert.deepEqual(werkzeug.sucheBefehle(befehle, '', { agent: 'haupt' }).map((b) => b.id), ['toolu_1'])
assert.deepEqual(werkzeug.sucheBefehle(befehle, '', { session: 'sA' }).map((b) => b.id), ['toolu_1'])
assert.deepEqual(werkzeug.sucheBefehle(befehle, '', { offen: true }).map((b) => b.id), ['toolu_4'], 'offen = ohne post und ohne deny')
assert.doesNotThrow(() => werkzeug.sucheBefehle(befehle, '[kaputt('), 'ungültige Regex wird wörtlich gesucht')
assert.ok(Math.abs(werkzeug.seitZeit('2h', 1000000000) - (1000000000 - 7200000)) < 1)
const st = werkzeug.statistik(befehle)
const bauer = st.get('bauer:ag1')
assert.deepEqual([bauer.anzahl, bauer.exitFehl, bauer.zeitlimit, bauer.offen], [3, 1, 1, 1])
assert.equal(st.get('pruefer:ag2').gesperrt, 1)
ok('Abfragen: verbinden, suche, Filter agent/session/offen, Statistik')

// 9. Kandidatenregeln (reine Funktion, Prozessliste übergeben)
const jetzt = t0 + 100 * 60000
const proz = (id, pid = 100, ppid = 1) => ({ pid, ppid, name: 'bash.exe', start: t0, id })
const k = (z2, p2, e2) => {
  const v = werkzeug.verbinde(z2)
  return werkzeug.findeKandidaten(v.befehle, e2 ?? v.enden, p2, jetzt)
}
const ende = (agent, min) => ({ t: new Date(t0 + min * 60000).toISOString(), ev: 'agent-ende', agent, typ: 'bauer' })
const jung2 = (id, agent, min, extra) => pre(id, agent, agent === 'haupt' ? 'haupt' : 'bauer', 'sleep 9', min, extra)
assert.equal(k([jung2('t1', 'ag1', 95), ende('ag1', 97)], [proz('t1')]).length, 1, 'Agent beendet, Prozess lebt: sofort melden')
const hinweis = k([jung2('t1', 'ag1', 95), ende('ag1', 97)], [proz('t1')])[0].kill
assert.match(hinweis, /befehlsregister\.mjs beenden --id t1$/)
assert.ok(!/taskkill/.test(hinweis), 'taskkill //T erreicht msys-Kinder nicht')
assert.equal(k([jung2('t1', 'ag1', 95), ende('ag1', 97)], []).length, 0, 'Prozess tot: kein Kandidat')
assert.equal(k([jung2('t1', 'ag1', 95), ende('ag1', 90)], [proz('t1')]).length, 0, 'Ende lag vor dem Befehl (Agent-ID wiederverwendet?): kein Kandidat')
assert.equal(k([jung2('t1', 'ag1', 95), post2('t1', 'ag1', 95), ende('ag1', 97)], [proz('t1')]).length, 0, 'regulär beendeter Befehl: kein Kandidat')
assert.equal(k([jung2('t1', 'haupt', 50)], [proz('t1')]).length, 1, 'Vordergrund > 15 min: Frist um')
assert.equal(k([jung2('t1', 'haupt', 90)], [proz('t1')]).length, 0, 'Vordergrund 10 min: noch in der Frist')
assert.equal(k([jung2('t1', 'haupt', 60, { bg: true })], [proz('t1')]).length, 0, 'Hintergrund 40 min: noch in der Frist')
assert.equal(k([jung2('t1', 'haupt', 30, { bg: true })], [proz('t1')]).length, 1, 'Hintergrund 70 min: Frist um')
assert.equal(k([jung2('t1', 'haupt', 70), post2('t1', 'haupt', 70, { bgTask: 'b' })], [proz('t1')]).length, 0, 'ins Hintergrund verschoben 30 min: Hintergrundfrist')
assert.equal(k([jung2('t1', 'haupt', 30), post2('t1', 'haupt', 30, { bgTask: 'b' })], [proz('t1')]).length, 1, 'ins Hintergrund verschoben 70 min: Frist um')
assert.equal(k([jung2('t1', 'haupt', 50), { t: new Date(t0).toISOString(), ev: 'deny', id: 't1' }], [proz('t1')]).length, 0, 'gesperrter Befehl: kein Kandidat')
assert.equal(k([jung2('t1', 'ag1', 95), ende('ag1', 97)], [proz('t1', 100, 1), proz('t1', 101, 100)])[0].pid, 100, 'Wurzel der Subshell-Gruppe')
ok('Kandidatenregeln: Agent-Ende, Frist Vordergrund/Hintergrund, Zeitlimit, tot, gesperrt, Wurzelprozess')

// 9b. Zuordnung Prozess → Befehl ohne Marke (reine Funktion, befehlsregister-zuordnen.mjs; Werte fest eingetragen, nicht aus dem Modul)
assert.deepEqual([FENSTER_MS, SCHUB_MS, SEKUNDEN_UNSCHAERFE_MS], [30000, 3000, 1000], 'Grenzen des Moduls (Test trägt sie fest)')
const Z0 = Date.parse('2026-11-10T12:00:00.000Z')
const zeile = (id, agent, cmd, dt = 0, extra = {}) => ({ id, pre: { t: new Date(Z0 + dt).toISOString(), agent, typ: 'bauer', cmd }, ...extra })
// Kommandozeile wie das Bash-Werkzeug sie baut (gemessen 10.11.2026): `'` im Befehl wird zu `'\"'\"'`, danach `< /dev/null && pwd -P`
const kommando = (cmd) => `"C:\\Program Files\\Git\\bin\\bash.exe" -c "source snap.sh && eval '${cmd.replaceAll("'", "'\\\"'\\\"'")}' < /dev/null && pwd -P >| /tmp/cwd"`
const shellZ = (pid, cmd, dt = 1000) => ({ pid, start: Z0 + dt, cmd: kommando(cmd) })
const zuord = (prozesse, befehle) => Object.fromEntries(ordneZu(prozesse, befehle))
assert.deepEqual(zuord([shellZ(1, `echo "a b" 'c'`)], [zeile('t1', 'ag1', `echo "a b" 'c'`)]), { 1: 't1' }, 'Anführungszeichen und Escapes stören nicht')
// echte Kommandozeile (Auszug, 10.11.2026): `'` im Befehl als `'\"'\"'`, `"` als `\"`
const ECHT = `bash -c "source /c/Users/ih/.claude/shell-snapshots/s.sh 2>/dev/null || true && eval 'sed -i '\\\"'\\\"'s/sleep 6/sleep 8/'\\\"'\\\"' \\\"C:/x/p3.mjs\\\"; (sleep 9 >/dev/null 2>&1 &) ; sleep 1' < /dev/null && pwd -P >| /c/tmp/claude-4109-cwd"`
assert.deepEqual(zuord([{ pid: 7, start: Z0 + 1000, cmd: ECHT }], [zeile('t7', 'ag1', `sed -i 's/sleep 6/sleep 8/' "C:/x/p3.mjs"; (sleep 9 >/dev/null 2>&1 &) ; sleep 1`)]), { 7: 't7' }, 'echte Kommandozeile')
assert.deepEqual(zuord([shellZ(1, 'sleep 9 | cat'), shellZ(2, 'sleep 9')], [zeile('t1', 'ag1', 'sleep 9'), zeile('t2', 'ag1', 'sleep 9 | cat')]), { 1: 't2', 2: 't1' }, 'vollständiger Befehl ist kein Anfang eines längeren')
assert.deepEqual(zuord([shellZ(1, 'cat > x.mjs')], [zeile('t1', 'ag1', 'cat')]), {}, 'Anfang eines längeren Befehls ohne Kürzung passt nicht')
assert.deepEqual(zuord([{ pid: 2, start: Z0 + 1000, cmd: 'node x.mjs' }], [zeile('t2', 'ag1', 'x.mjs')]), {}, 'ohne Shell-Kommandozeile (eval) keine Zuordnung')
// Zeitfenster: genau an den Rändern und eins daneben
const eins = (dt) => zuord([shellZ(1, 'sleep 5', dt)], [zeile('t1', 'ag1', 'sleep 5')])
assert.deepEqual([eins(FENSTER_MS), eins(FENSTER_MS + 1), eins(-SEKUNDEN_UNSCHAERFE_MS), eins(-SEKUNDEN_UNSCHAERFE_MS - 1)], [{ 1: 't1' }, {}, { 1: 't1' }, {}], 'Fenster nach/vor der Pre-Zeile')
// gekürzte Befehle (200 Zeichen) gelten als Anfang, kürzere müssen vollständig passen; maskierte als Anfang vor der Maske
const lang = (n) => `echo ${'a'.repeat(n - 5)}`
assert.deepEqual([zuord([shellZ(1, `${lang(200)}b`)], [zeile('t1', 'ag1', lang(200))]), zuord([shellZ(1, `${lang(199)}b`)], [zeile('t1', 'ag1', lang(199))])], [{ 1: 't1' }, {}], 'Länge 200 = gekürzt, 199 = vollständig')
assert.deepEqual(zuord([shellZ(1, 'tool --token geheim123 run')], [zeile('t1', 'ag1', 'tool --token ***')]), { 1: 't1' }, 'maskierter Befehl')
// Auslöser: verschiedene Auslöser kurz hintereinander mit demselben Text bleiben unzugeordnet, sonst gewinnt die jüngste Zeile
const P = (dt) => [shellZ(1, 'date', dt)]
const A = (dt) => zeile('ta', 'agA', 'date', dt)
assert.deepEqual([zuord(P(4000), [A(0), zeile('tb', 'agB', 'date', SCHUB_MS)]), zuord(P(4000), [A(0), zeile('tb', 'agB', 'date', SCHUB_MS + 1)])], [{}, { 1: 'tb' }], 'Schub: 3000 ms mehrdeutig, 3001 ms jüngste Zeile')
assert.deepEqual(zuord(P(4000), [A(0), zeile('tb', 'agA', 'date', 1000)]), { 1: 'tb' }, 'gleicher Auslöser: jüngste Zeile')
assert.deepEqual([zuord(P(11000), [A(0), zeile('tb', 'agB', 'date', 10000)]), zuord(P(1000), [A(0), zeile('tb', 'agB', 'date', 10000)])], [{ 1: 'tb' }, { 1: 'ta' }], 'spätere Zeile gehört nicht zum früheren Prozess')
assert.deepEqual(zuord(P(1000), [zeile('ta', 'agA', 'date', 0, { deny: { t: 'x' } })]), {}, 'gesperrter Befehl lief nie')
// alte Marke gilt nur für bekannte Ids
assert.deepEqual(zuord([{ pid: 1, start: 0, cmd: 'bash -c "eval \'x\' # br:toolu_alt"' }], [zeile('toolu_alt', 'ag1', 'ganz anders')]), { 1: 'toolu_alt' }, 'Marke aus der Zeit vor dem Umbau')
assert.deepEqual(zuord([{ pid: 1, start: 0, cmd: 'grep "# br:toolu_fremd" x' }], [zeile('toolu_alt', 'ag1', 'ganz anders')]), {}, 'Marke ohne Eintrag im Register zählt nicht')
ok('Zuordnung ohne Marke: Befehlstext + Startzeit, Fenster, Kürzung, Maske, Auslöser-Schub, gesperrt, alte Marke')

// 9c. Prozess-Inventur: ein langer Vergleich eines lebenden Agenten bleibt ohne Marke im Befehl geschützt (lebenderAgent über die Zuordnung)
const { lebenderAgent } = await werkzeugDatei('prozess-inventur/zuordnung.mjs')
const VERGLEICH = 'timeout 1800 node tools/bau-vergleich.mjs a b'
const spitze = { pid: 300, ppid: 905, name: 'timeout.exe', start: Z0 + 1000, cmd: VERGLEICH }
const wartendeShell = (cmd) => [{ pid: 210, ppid: 100, name: 'bash.exe', start: Z0 + 1000, cmd: kommando(cmd) }, { pid: 211, ppid: 210, name: 'bash.exe', start: Z0 + 1000, cmd: kommando(cmd) }, { pid: 212, ppid: 211, name: 'conhost.exe', start: Z0 + 1000, cmd: '' }]
const geschuetzt = (prozesse, befehle, enden = new Map()) => lebenderAgent([spitze, ...prozesse], befehle, enden)([spitze])
assert.equal(geschuetzt(wartendeShell(VERGLEICH), [zeile('tv', 'ag1', VERGLEICH)]), true, 'Shell ohne Marke, Agent lebt: geschützt')
assert.equal(geschuetzt(wartendeShell(VERGLEICH), [zeile('tv', 'ag1', VERGLEICH)], new Map([['ag1', new Date(Z0 + 60000).toISOString()]])), false, 'Agent beendet: nicht geschützt')
assert.equal(geschuetzt(wartendeShell('anderer Befehl'), [zeile('tv', 'ag1', VERGLEICH)]), false, 'anderer Befehlstext: nicht geschützt')
assert.equal(geschuetzt(wartendeShell(VERGLEICH), [zeile('tv', 'haupt', VERGLEICH)]), false, 'Hauptsitzung: nicht geschützt')
ok('Inventur: lebenderAgent erkennt die wartende Shell ohne Marke über Befehlstext und Startzeit')

// 10. Ende zu Ende mit echter Shell ohne Marke im Befehl: WMI + Zuordnung (Befehlstext, Startzeit) finden sie, `kandidaten` meldet PID
leere()
fs.mkdirSync(process.env.BR_DIR, { recursive: true })
const jetztIso = new Date().toISOString()
fs.writeFileSync(reg.tagesdatei(), JSON.stringify({ t: jetztIso, ev: 'pre', id: 'toolu_ENDETESTLIVE', agent: 'agLive', typ: 'bauer', cmd: 'sleep 90', bg: false }) + '\n')
const kind = starteShell('sleep 90')
const lebt = (pid) => werkzeug.markenProzesse(befehleJetzt()).some((x) => x.pid === pid)
try {
  await new Promise((r) => setTimeout(r, 1200))
  assert.ok(lebt(kind.pid), 'die Zuordnung findet die Shell nicht über Befehlstext und Startzeit')
  const ohneEnde = execFileSync(process.execPath, [TOOL, 'kandidaten'], { env: process.env, encoding: 'utf8' })
  assert.match(ohneEnde, /keine Kandidaten/, 'laufender Befehl innerhalb der Frist ohne Agentenende ist kein Kandidat')
  fs.appendFileSync(reg.tagesdatei(), JSON.stringify({ t: jetztIso, ev: 'agent-ende', agent: 'agLive', typ: 'bauer' }) + '\n')
  const mit = execFileSync(process.execPath, [TOOL, 'kandidaten'], { env: process.env, encoding: 'utf8' })
  assert.ok(mit.includes(`PID ${kind.pid}`) && mit.includes('befehlsregister.mjs beenden --id toolu_ENDETESTLIVE') && !mit.includes('taskkill'), `Kandidat fehlt: ${mit}`)
  assert.ok(lebt(kind.pid), 'kandidaten darf nichts beenden')
  assert.equal(execFileSync(process.execPath, [TOOL, 'kandidaten', '--still'], { env: { ...process.env, BR_DIR: path.join(TMP, 'leer') }, encoding: 'utf8' }), '', '--still: ohne Kandidaten keine Ausgabe')
} finally {
  raeumeTestshells(['toolu_ENDETESTLIVE'])
}
await new Promise((r) => setTimeout(r, 800))
assert.ok(!lebt(kind.pid), 'Testprozess lebt noch (WMI)')
ok('Ende zu Ende: echte Shell ohne Marke, Kandidat mit beenden-Hinweis, danach per WMI beendet bestätigt')

// 11. nach-agent.mjs (SubagentStop) schreibt die Zeile `agent-ende`
leere()
const NA = 'C:/code/ai/__assets/tools/prozess-inventur/nach-agent.mjs'
const env = { ...process.env, INVENTUR_DATEN: path.join(TMP, 'inv'), INVENTUR_BERICHT: path.join(TMP, 'inv-bericht.md') }
execFileSync(process.execPath, [NA, '--hook'], { env, input: JSON.stringify({ agent_type: 'bauer', agent_id: 'agEnde1', session_id: 's9' }), encoding: 'utf8', windowsHide: true })
const en = lies().find((x) => x.ev === 'agent-ende')
assert.deepEqual([en.agent, en.typ, en.sid], ['agEnde1', 'bauer', 's9'])
ok('SubagentStop: agent-ende mit agent_id im Register')

// 12. Wächter (UserPromptSubmit) meldet den Kandidaten, gedrosselt; ohne Fix (kein Aufruf) bliebe die Meldung aus
leere()
fs.mkdirSync(process.env.BR_DIR, { recursive: true })
const zl = [{ ev: 'pre', id: 'toolu_WAECHTERLIVE', agent: 'agW', typ: 'bauer', cmd: 'sleep 91', bg: false }, { ev: 'agent-ende', agent: 'agW', typ: 'bauer' }]
fs.writeFileSync(reg.tagesdatei(), zl.map((x) => JSON.stringify({ t: new Date().toISOString(), ...x })).join('\n') + '\n')
const kind2 = starteShell('sleep 91')
try {
  await new Promise((r) => setTimeout(r, 1200))
  const wenv = { ...process.env, WAECHTER_STATE: path.join(TMP, 'waechter-state') }
  const wlauf = () => execFileSync(process.execPath, [path.join(HIER, 'prozess-waechter.js')], { env: wenv, encoding: 'utf8', windowsHide: true })
  const erste = wlauf()
  assert.ok(erste.includes('[Befehls-Register]') && erste.includes(`PID ${kind2.pid}`), `Wächter meldet nicht: ${erste}`)
  assert.ok(!wlauf().includes('[Befehls-Register]'), 'zweite Meldung innerhalb von 5 min darf nicht erscheinen (Drossel)')
} finally {
  raeumeTestshells(['toolu_WAECHTERLIVE'])
}
await new Promise((r) => setTimeout(r, 800))
assert.ok(!werkzeug.markenProzesse(befehleJetzt()).some((x) => x.pid === kind2.pid), 'Testprozess des Wächtertests lebt noch (WMI)')
ok('Wächter: Kandidat gemeldet, danach gedrosselt')

// 13. Leere Prozesse (Fälle vom 13.10.: `cat > datei` ohne Eingabe, Agent fertig, Shell hängt stundenlang)
const STDIN_FAELLE = [[['cat'], true], [['cat', 'x.txt'], false], [['head', '-n', '3'], true], [['grep', 'x'], true], [['grep', 'x', 'f.txt'], false],
  [['tee', 'f.txt'], true], [['sleep', '120'], false], [['tail', '-f', 'f.txt'], false], [['C:\\Program Files\\nodejs\\node.exe', '-e', 'x'], false]]
for (const [args, soll] of STDIN_FAELLE) assert.equal(leer.liestStdin(args), soll, `liestStdin(${args.join(' ')})`)
ok('stdin-Leser: cat/head -n 3/grep x/tee ja; mit Datei-Operand, sleep, tail -f datei, node nein')
const shellP = { pid: 1, ppid: 0, winpid: 11, comm: 'bash', state: 'S', cpu: 50, args: ['bash'] }
const catP = { pid: 2, ppid: 1, winpid: 12, comm: 'cat', state: 'S', cpu: 46, args: ['cat'] }
const urteil = (catNachher, fd = 'pipe:[0]') => leer.urteile([{ id: 'x', wurzel: shellP, mitglieder: [shellP, catP], leser: [catP] }], [shellP, { ...catP, ...catNachher }], new Map([[2, fd]]), 1500)[0]
assert.equal(urteil({ cpu: 61 }).leer, true, 'wartendes cat mit +15 ms (gemessen 14.10.) gilt als leer')
assert.equal(urteil({ cpu: 46 + 1400, state: 'R' }).leer, false, 'cat mit Arbeit ist aktiv')
assert.equal(urteil({ cpu: 46 }, 'pipe:[4294983556]').leer, false, 'cat hinter einer Pipe ist kein Werkzeug-stdin')
assert.equal(leer.urteile([{ id: 'x', wurzel: shellP, mitglieder: [shellP, catP], leser: [catP] }], [], new Map(), 1500)[0].grund, 'schon beendet')
ok('Urteil leer: Rauschen bis 15 ms zählt nicht, Arbeit und fremde Pipe schon, verschwundener Baum = schon beendet')
await testAufraeumen()

/** Startet Shells wie das Bash-Werkzeug (stdin offen, keine Marke), räumt Agent agX auf und prüft, was überlebt. */
async function testAufraeumen() {
  leere()
  fs.mkdirSync(process.env.BR_DIR, { recursive: true })
  const T = TMP.replaceAll('\\', '/')
  const faelle = [
    ['toolu_LEERCAT', 'agX', `cat > ${T}/x.mjs 2>/dev/null; echo weiter > ${T}/weiter.txt`],
    ['toolu_LEERSLEEP', 'agX', 'sleep 60'],
    ['toolu_LEERPIPE', 'agX', 'sleep 60 | cat'],
    ['toolu_LEERFREMD', 'agY', `cat > ${T}/y.mjs`],
  ]
  // Die Pre-Zeile entsteht vor dem Start der Shell (wie im Hook); der Prozess findet sie über Befehlstext und Startzeit.
  fs.writeFileSync(reg.tagesdatei(), faelle.map(([id, agent, cmd], i) => JSON.stringify({ t: new Date(Date.now() + i).toISOString(), ev: 'pre', id, agent, typ: 'bauer', cmd })).join('\n') + '\n')
  const kinder = faelle.map(([, , cmd]) => starteShell(cmd))
  const lebend = () => new Set(leer.msysProzesse().map((p) => p.winpid))
  try {
    await new Promise((r) => setTimeout(r, 2500))
    const aus = execFileSync(process.execPath, [TOOL, 'aufraeumen', '--agent', 'agX', '--beenden'], { env: process.env, encoding: 'utf8' })
    assert.match(aus, /LEERCAT beendet · wartet auf stdin \(cat\)/, `cat > datei nicht beendet: ${aus}`)
    assert.match(aus, /EERSLEEP bleibt · ruht, aber kein stdin-Leser/, aus)
    assert.match(aus, /LEERPIPE bleibt/, `cat hinter einer Pipe gilt nicht als leer: ${aus}`)
    assert.ok(!aus.includes('EERFREMD'), 'fremde Agent-ID darf nicht geprüft werden')
    const jetzt = lebend()
    assert.deepEqual(kinder.map((k) => jetzt.has(k.pid)), [false, true, true, true], 'nur die cat-Shell von agX darf fehlen')
    await new Promise((r) => setTimeout(r, 500))
    assert.ok(!fs.existsSync(path.join(TMP, 'weiter.txt')), 'Befehlskette lief nach dem Beenden weiter (Wurzel zuerst beenden)')
    const auf = lies().find((x) => x.ev === 'aufgeraeumt')
    assert.deepEqual([auf.agent, auf.befehle, auf.lebend, auf.beendet.length, auf.beendet[0].uebrig.length], ['agX', 3, 3, 1, 0])
    ok('aufraeumen: cat > datei von agX beendet (samt Kette), sleep, Pipe-cat und fremde Agent-ID bleiben; Zeile aufgeraeumt')
    await testBeenden()
    await testNachAgentRaeumt(lebend)
  } finally {
    raeumeTestshells(faelle.map(([id]) => id))
  }
}

/** `beenden --id` (Hinweis von `kandidaten`) beendet Shell UND msys-Kind (sleep), auch ohne stdin-Leser. */
async function testBeenden() {
  const id = 'toolu_BEENDENSLEEP'
  fs.appendFileSync(reg.tagesdatei(), JSON.stringify({ t: new Date().toISOString(), ev: 'pre', id, agent: 'agB', typ: 'bauer', cmd: 'sleep 60' }) + '\n')
  const kind = starteShell('sleep 60')
  try {
    await new Promise((r) => setTimeout(r, 2500))
    const sleeps = leer.gruppen([id], leer.msysProzesse(), ordneZu(leseProzesse(), befehleJetzt())).flatMap((g) => g.mitglieder).filter((p) => p.comm === 'sleep')
    assert.equal(sleeps.length, 1, 'Testaufbau: sleep-Kind der Shell nicht gefunden')
    const aus = execFileSync(process.execPath, [TOOL, 'beenden', '--id', id.slice(-8)], { env: process.env, encoding: 'utf8' })
    assert.match(aus, /DENSLEEP beendet/, aus)
    const danach = new Set(leer.msysProzesse().map((p) => p.winpid))
    assert.ok(!danach.has(sleeps[0].winpid), 'sleep-Kind lebt nach beenden weiter')
    assert.ok(!danach.has(kind.pid), 'Shell lebt nach beenden weiter')
    assert.match(execFileSync(process.execPath, [TOOL, 'beenden', '--id', id], { env: process.env, encoding: 'utf8' }), /kein lebender msys-Prozess/)
    ok('beenden --id: Shell und msys-Kind sleep beendet, zweiter Aufruf meldet schon beendet')
  } finally {
    raeumeTestshells([id])
  }
}

/** SubagentStop (nach-agent.mjs --hook) räumt selbst auf: cat-Shell des beendeten Agenten ist danach weg. */
async function testNachAgentRaeumt(lebend) {
  const cmd = `cat > ${TMP.replaceAll('\\', '/')}/z.mjs`
  fs.appendFileSync(reg.tagesdatei(), JSON.stringify({ t: new Date().toISOString(), ev: 'pre', id: 'toolu_LEERHOOK', agent: 'agHook', typ: 'bauer', cmd }) + '\n')
  const kind = starteShell(cmd)
  try {
    await new Promise((r) => setTimeout(r, 2500))
    assert.ok(lebend().has(kind.pid), 'Testshell startet nicht')
    const env = { ...process.env, INVENTUR_DATEN: path.join(TMP, 'inv'), INVENTUR_BERICHT: path.join(TMP, 'inv-bericht.md') }
    const aus = execFileSync(process.execPath, [NA, '--hook'], { env, input: JSON.stringify({ agent_type: 'bauer', agent_id: 'agHook', session_id: 's9' }), encoding: 'utf8', windowsHide: true })
    assert.match(aus, /LEERHOOK beendet · wartet auf stdin/, `SubagentStop räumt nicht auf: ${aus}`)
    assert.ok(!lebend().has(kind.pid), 'cat-Shell lebt nach SubagentStop weiter')
    ok('SubagentStop: nach-agent.mjs beendet die leere cat-Shell des Agenten')
  } finally {
    raeumeTestshells(['toolu_LEERHOOK'])
  }
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log('befehlsregister-test: alle Prüfungen bestanden')
