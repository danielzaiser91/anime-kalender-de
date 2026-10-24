/**
 * Prüft die Wecker-Wache: Ein roter Start zählt nicht als erledigt (einmal nachholen je Fenster), jeder Workflow des Weckplans steht in der Wache,
 * und der Workflow ruft die Entscheidung wirklich auf. Aufruf: `node tools/wecker-wache-entscheid.test.mjs`
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { entscheide, MAX_STARTS_OHNE_ERFOLG, ROT, ROT_WARTEN_H } from './wecker-wache-entscheid.mjs'

const lies = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')
const JETZT = Date.parse('2026-10-16T12:00:00Z')
const vor = (h, conclusion, status = 'completed') => ({ createdAt: new Date(JETZT - h * 3600e3).toISOString(), conclusion, status })
const ja = (laeufe, frist = 30, ohne = false) => entscheide(laeufe, JETZT, frist, ohne).nachholen

/* ---- Grundverhalten bleibt ---- */
assert.equal(ja([]), true, 'nie gestartet -> starten')
assert.equal(ja([vor(5, 'success'), vor(29, 'success')]), false, 'erfolgreich und rechtzeitig')
assert.equal(ja([vor(31, 'success')]), true, 'Erfolg älter als die Frist')
assert.equal(ja([vor(31, null, 'in_progress'), vor(60, 'success')]), false, 'läuft gerade (auch ein alter Start)')
assert.equal(ja([vor(1, null, 'queued'), vor(40, 'failure')]), false, 'wartender Lauf sperrt das Nachholen')
/* Jeder aktive Zustand sperrt für sich: der wartende Start ist älter als die Frist, ohne Sperre käme ein Doppelstart. */
for (const status of ['in_progress', 'queued', 'pending', 'waiting']) {
  assert.equal(ja([vor(31, null, status), vor(60, 'success')]), false, `${status} sperrt das Nachholen`)
}

/* ---- Der Fall vom 16.10.2026: einziger Lauf rot, nie ein Erfolg ---- */
assert.equal(ja([vor(15, 'failure')]), true, 'roter Start vor 15 h, kein Erfolg -> nachholen (vorher erst nach 30 h)')
assert.equal(ja([vor(ROT_WARTEN_H - 1, 'failure')]), false, 'frisch rot: erst nach der Wartezeit')
assert.equal(ja([vor(ROT_WARTEN_H + 1, 'failure')]), true)
assert.equal(ja([vor(9, 'timed_out'), vor(33, 'success')]), true, 'auch Zeitüberschreitung ist nicht erledigt')

/* ---- Erfolg innerhalb der Frist: Tageslauf ist erledigt, auch wenn der letzte Start rot war ---- */
assert.equal(ja([vor(10, 'failure'), vor(20, 'success')]), false, 'Erfolg vor 20 h, Frist 30 h -> kein Nachholen')
assert.equal(ja([vor(10, 'failure'), vor(31, 'success')]), true, 'Erfolg älter als die Frist, roter Start vor 10 h')

/* ---- Keine Endlosschleife: höchstens ein Nachholversuch je Fenster ---- */
assert.equal(MAX_STARTS_OHNE_ERFOLG, 2)
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure')]), false, 'Original und Nachhol-Start beide rot -> nicht noch einmal')
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure'), vor(32, 'failure'), vor(60, 'success')]), false, 'dauerhaft rot bleibt still bis zur Frist des letzten Starts')
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure'), vor(60, 'success')]), false)
assert.equal(ja([vor(31, 'failure'), vor(50, 'failure')]), true, 'nach der vollen Frist wird wieder gestartet (wie bisher)')

/* ---- Abgebrochen (gewollt: D1-Tageslimit, Sperre) zählt nie als rot, nur bei ohne-abbruch als Nicht-Start ---- */
const abbruch = [vor(5, 'cancelled'), vor(40, 'success')]
assert.equal(ja(abbruch, 30, false), false, 'abgebrochener Start zählt als Start (wie bisher)')
assert.equal(ja(abbruch, 30, true), true, 'mit ohne-abbruch zählt er nicht')
assert.equal(ja([vor(5, 'cancelled'), vor(12, 'failure')], 30, true), true, 'ohne-abbruch: der rote Start davor entscheidet')
assert.equal(ja([vor(7, 'cancelled'), vor(40, 'success')]), false, 'Abbruch nach der Wartezeit wird nicht nachgeholt')
assert.equal(ja([vor(7, 'cancelled')]), false, 'Abbruch ohne je einen Erfolg wird nicht nachgeholt')

/* ---- Jeder Ausgang einmal jenseits jeder Wartezeit (7 h > ROT_WARTEN_H, 31 h > Frist), letzter Erfolg 60 h alt ---- */
const ausgaenge = [
  ['success', 'completed', false, true],
  ['failure', 'completed', true, true],
  ['cancelled', 'completed', false, true],
  ['timed_out', 'completed', true, true],
  ['startup_failure', 'completed', true, true],
  ['skipped', 'completed', false, true],
  [null, 'in_progress', false, false],
]
for (const [conclusion, status, bei7, bei31] of ausgaenge) {
  assert.equal(ja([vor(7, conclusion, status), vor(60, 'success')]), bei7, `${conclusion ?? status} vor 7 h`)
  assert.equal(ja([vor(31, conclusion, status), vor(60, 'success')]), bei31, `${conclusion ?? status} vor 31 h`)
}
assert.deepEqual(ROT, ['failure', 'timed_out', 'startup_failure'])
assert.equal(ja([]), true, 'kein Start')
assert.equal(ja([vor(7, 'skipped'), vor(60, 'success')]), false, 'übersprungen ist kein Fehler: kein Nachholen nach der Wartezeit')

/* ---- Auswahl mit zweitem Kandidaten: der Treffer steht nicht vorn ---- */
assert.equal(ja([vor(7, 'failure'), vor(31, 'success'), vor(32, 'success')]), true, 'der neueste Erfolg zählt, nicht der älteste')
assert.equal(ja([vor(1, 'success'), vor(40, null, 'in_progress')]), false, 'ein laufender Start weiter hinten sperrt ebenfalls')
assert.equal(ja([vor(7, 'failure'), vor(60, 'success'), vor(70, null, 'in_progress')]), false, 'ein weiter hinten laufender Start sperrt das Nachholen')

/* ---- Frist wie bisher: ganze Stunden, 30,5 h bei Frist 30 sind noch rechtzeitig (floor(h) > max) ---- */
assert.equal(ja([vor(30.5, 'success')]), false, '30,5 h bei Frist 30 h: noch nicht überfällig')
assert.equal(ja([vor(31, 'success')]), true, '31 h bei Frist 30 h: überfällig')

/* ---- Ein aktiver Lauf auf Platz 7 sperrt (--limit 10 der Wache); Wartezeit als Zahl ---- */
assert.equal(ja([...[40, 41, 42, 43, 44, 45].map((h) => vor(h, 'success')), vor(50, null, 'in_progress')]), false, 'aktiver Lauf weit hinten sperrt')
assert.equal(ja([vor(5, 'failure')]), false, 'roter Start vor 5 h: Wartezeit 6 h noch nicht um')

/* ---- Grenzen der Rot-Regel: Erfolgsfrist ohne Abrunden, Wartezeit exakt ---- */
assert.equal(ja([vor(10, 'failure'), vor(30, 'success')]), false, 'Erfolg genau 30 h alt: noch innerhalb der Frist')
assert.equal(ja([vor(10, 'failure'), vor(30.5, 'success')]), true, 'Erfolg 30,5 h alt: außerhalb der Frist')
assert.equal(ja([vor(ROT_WARTEN_H, 'failure')]), false, 'roter Start genau an der Wartezeit: noch nicht')

/* ---- Kommandozeile als eigener Prozess: Argumente, Ausgabe, echte Uhrzeit ---- */
const lauf = (laeufe, ...argumente) => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./wecker-wache-entscheid.mjs', import.meta.url)), ...argumente], { input: JSON.stringify(laeufe), encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}
const jetzt = Date.now()
const echt = (h, conclusion, status = 'completed') => ({ createdAt: new Date(jetzt - h * 3600e3).toISOString(), conclusion, status })
assert.match(lauf([echt(1, 'success'), echt(25, 'success'), echt(49, 'success')], '30'), /^nein [^\n]+\n$/, 'rechtzeitig -> nein')
assert.match(lauf([echt(40, 'success'), echt(64, 'success'), echt(88, 'success')], '30'), /^ja [^\n]+\n$/, 'überfällig -> ja')
assert.match(lauf([echt(5, 'cancelled'), echt(40, 'success'), echt(64, 'success')], '30'), /^nein /, 'Abbruch zählt als Start')
assert.match(lauf([echt(5, 'cancelled'), echt(40, 'success'), echt(64, 'success')], '30', 'ohne-abbruch'), /^ja /, 'ohne-abbruch: Abbruch zählt nicht')
assert.match(lauf([echt(8, 'failure'), echt(60, 'success'), echt(80, 'success')], '30'), /^ja /, 'roter Start -> ja')
assert.match(lauf([], '30'), /^ja nie gestartet\n$/)
/* Die Frist kommt aus dem Argument: Stunden-, Wochen- und Monatslauf (Werte der Wache) in beide Richtungen. */
assert.match(lauf([echt(5, 'success'), echt(6, 'success'), echt(7, 'success')], '3'), /^ja /, 'Frist 3 h, letzter Start vor 5 h')
assert.match(lauf([echt(2, 'success'), echt(3, 'success'), echt(4, 'success')], '3'), /^nein /, 'Frist 3 h, letzter Start vor 2 h')
assert.match(lauf([echt(40, 'success'), echt(64, 'success'), echt(88, 'success')], '192'), /^nein /, 'Frist 192 h, Start vor 40 h')
assert.match(lauf([echt(200, 'success'), echt(300, 'success'), echt(400, 'success')], '192'), /^ja /, 'Frist 192 h, Start vor 200 h')
assert.match(lauf([echt(300, 'success'), echt(500, 'success'), echt(700, 'success')], '744'), /^nein /, 'Frist 744 h, Start vor 300 h')

/* ---- Verdrahtung: Wache kennt jeden Workflow des Weckplans und ruft die Entscheidung auf ---- */
const wache = parse(lies('.github/workflows/wecker-wache.yml'))
const schritte = wache.jobs.wache.steps
const nachholen = schritte.find((s) => s.id === 'nachholen')
assert.equal(wache.jobs.wache.if, undefined, 'Job „wache“ läuft immer (übersprungen zählt als bestanden)')
assert.equal(wache.jobs.wache['continue-on-error'], undefined, 'Job „wache“ darf nicht rot verschluckt werden')
assert.deepEqual(wache.on.schedule, [{ cron: '37 */3 * * *' }], 'GitHubs eigener Cron, alle 3 h')
const FRISTEN = 'refresh-hourly.yml:3 refresh-data.yml:30 refresh-weekly.yml:192 adn-laufende.yml:9 claude-verpasst-recherche.yml:30 claude-anime2you-extraktion.yml:30 claude-wache-urteil.yml:30 anisearch-katalog.yml:30 ladezeiten.yml:30 offizielle-news.yml:30 meldungskopie.yml:30 tonspuren-monatlich.yml:744:ohne-abbruch'
/* Der ganze run-Block ohne Kommentare und Leerzeilen, Zeile für Zeile: nichts davor (exit 0), nichts dazwischen, nichts am Ende. */
const SOLL = [
  `PLAN="${FRISTEN}"`,
  'nachgeholt=0',
  'for eintrag in $PLAN; do',
  'wf="${eintrag%%:*}"; rest="${eintrag#*:}"; max="${rest%%:*}"; ohne=""; case "$rest" in *:ohne-abbruch) ohne=1;; esac',
  'laeufe="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow "$wf" --limit 10 --json createdAt,conclusion,status)"',
  'urteil="$(printf \'%s\' "$laeufe" | node tools/wecker-wache-entscheid.mjs "$max" ${ohne:+ohne-abbruch})"',
  'printf \'%-34s %s (Frist %s h)\\n\' "$wf" "$urteil" "$max"',
  'if [ "${urteil%% *}" = "ja" ]; then',
  'echo "::warning title=Wecker überfällig::$wf: ${urteil#ja } — wird jetzt gestartet; Cloudflare-Wecker prüfen (worker/src/wecker.ts, Secret GITHUB_WECKER_TOKEN)"',
  'gh workflow run "$wf" --repo "$GITHUB_REPOSITORY" --ref main',
  'nachgeholt=$((nachgeholt + 1))',
  'fi',
  'done',
  'echo "Nachgeholt: $nachgeholt" | tee -a "$GITHUB_STEP_SUMMARY"',
  'echo "nachgeholt=$nachgeholt" >> "$GITHUB_OUTPUT"',
]
const IST = nachholen.run.split('\n').map((z) => z.trim()).filter((z) => z !== '' && !z.startsWith('#'))
assert.deepEqual(IST, SOLL, 'run-Block der Wache weicht ab')
assert.equal(nachholen.if, undefined, 'Schritt „nachholen“ läuft immer')
assert.equal(nachholen['continue-on-error'], undefined)
/* Jeder andere Zugriffsweg (shell, working-directory, env, timeout-minutes, defaults) könnte den geprüften run-Block umgehen. */
assert.deepEqual(Object.keys(nachholen).sort(), ['id', 'name', 'run'], 'Schritt „nachholen“ hat nur id, name, run')
assert.equal(wache.defaults, undefined, 'keine Workflow-defaults (shell)')
assert.equal(wache.jobs.wache.defaults, undefined, 'keine Job-defaults (shell)')
assert.deepEqual(wache.jobs.wache.env, { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }, 'Job-env genau das Token')
const plan = nachholen.run.match(/PLAN="([^"]+)"/)[1].split(' ').map((e) => e.split(':')[0])
const weckplan = [...lies('shared/weckplan.ts').matchAll(/\{ workflow: '([^']+)'/g)].map((m) => m[1])
assert.ok(weckplan.length >= 12)
for (const w of weckplan) assert.ok(plan.includes(w), `${w} steht im Weckplan, fehlt aber in der Wecker-Wache`)
for (const w of plan) assert.ok(weckplan.includes(w), `${w} steht in der Wecker-Wache, fehlt aber im Weckplan`)
/* Handlauf um 12 Uhr + Wecker um 03 Uhr des Folgetags = 15 h: der Mindestabstand darf den Wecker-Start nicht sperren (16.10.2026 fehlte er so). */
const mk = lies('shared/weckplan.ts').match(/workflow: 'meldungskopie\.yml', stunden: \[3\], abstandMin: (\d+)/)
assert.ok(mk && Number(mk[1]) < 15 * 60, `Mindestabstand meldungskopie.yml ${mk?.[1]} min muss unter 15 h liegen`)
const checkout = schritte.findIndex((s) => s.uses?.startsWith('actions/checkout'))
assert.ok(checkout >= 0 && checkout < schritte.indexOf(nachholen), 'Checkout liegt vor dem Schritt, der das Skript ruft')
assert.equal(schritte[checkout].if, undefined, 'Checkout läuft immer')
assert.deepEqual(schritte[checkout].with, { 'sparse-checkout': 'tools/lauf-melden.sh\ntools/wecker-wache-entscheid.mjs\n' }, 'Checkout: nur diese zwei Dateien, kein ref')

console.log('wecker-wache-entscheid: ok')
