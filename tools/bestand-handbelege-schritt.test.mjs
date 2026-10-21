/**
 * Ablauftest des Schritts „Neue Handbelege prüfen" aus bestand-bauen.yml (`run` und `env` aus der YAML, git/npm/npx als Attrappen).
 * Anlass (18.10.2026): `check:logic` war rot, die Warnung der Statusanzeige blieb ohne Grund („Neue Meldungen zurückgestellt: "),
 * weil nur nach `✖` gesucht wurde. Der Grund muss aus echter `check:logic`-Ausgabe (Zeile aus check-logic-alle.mjs) kommen.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const tools = dirname(fileURLToPath(import.meta.url))
const wf = parse(readFileSync(join(tools, '../.github/workflows/bestand-bauen.yml'), 'utf8'))
const schritte = wf.jobs.bauen.steps.filter((s) => s.name === 'Neue Handbelege prüfen')
assert.equal(schritte.length, 1, 'genau ein Schritt „Neue Handbelege prüfen"')
const schritt = schritte[0]
const einarbeiten = wf.jobs.bauen.steps.filter((s) => s.name === 'Meldungen aus der Erweiterung einarbeiten')
assert.equal(einarbeiten.length, 1, 'genau ein Schritt „Meldungen aus der Erweiterung einarbeiten"')
assert.ok(wf.jobs.bauen.steps.indexOf(einarbeiten[0]) < wf.jobs.bauen.steps.indexOf(schritt), 'gesichert wird vor der Prüfung')
const ANTWORT = einarbeiten[0].env.MELDUNGEN_SICHERN

const GESTERN = '[{"url":"u","ids":[1],"grund":"x","seit":"T"}]'
const ordner = mkdtempSync(join(tmpdir(), 'handbelege-schritt-'))

function attrappe(name, text) {
  const datei = join(ordner, 'bin', name)
  writeFileSync(datei, `#!/usr/bin/env bash\n${text}\n`)
  chmodSync(datei, 0o755)
}

/** Lauf mit: diff (Änderung an dub-confirmed.yaml da?), logic (npm run check:logic), bestand (npx tsx …). */
function lauf({ diff, logic, bestand, vorher = '', eingrenzen = 'exit 1' }) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'tools'), { recursive: true })
  copyFileSync(join(tools, 'pruefgrund.sh'), join(arbeit, 'tools/pruefgrund.sh'))
  const spur = join(arbeit, 'spur.txt')
  const envDatei = join(arbeit, 'github-env.txt')
  writeFileSync(spur, '')
  writeFileSync(envDatei, '')
  mkdirSync(join(arbeit, 'data/cache/quittung-offen'), { recursive: true })
  writeFileSync(join(arbeit, 'data/cache/quittung-offen/pruefungen-abhaken.json'), '[1]')
  writeFileSync(join(arbeit, 'data/meldungen-zurueckgestellt.json'), GESTERN)
  mkdirSync(join(ordner, 'bin'), { recursive: true })
  attrappe('git', `echo "git $*" >> "${spur}"\n[ "$1 $2" = "diff --quiet" ] && exit ${diff ? 1 : 0}\nexit 0`)
  attrappe('npm', `echo "npm $*" >> "${spur}"\n${logic}`)
  attrappe('npx', `echo "npx $*" >> "${spur}"\n${bestand}`)
  attrappe('node', `echo "node $*" >> "${spur}"\n${eingrenzen}`)
  const env = { ...process.env, ...schritt.env, GITHUB_ENV: envDatei, PATH: `${join(ordner, 'bin')}${delimiter}${process.env.PATH}` }
  if (vorher) env.DATEN_WARNUNG = vorher
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  assert.equal(r.status, 0, `Schritt endet grün: ${r.stderr}`)
  const abhaken = existsSync(join(arbeit, 'data/cache/quittung-offen/pruefungen-abhaken.json'))
  const zurueck = readFileSync(join(arbeit, 'data/meldungen-zurueckgestellt.json'), 'utf8')
  return { env: readFileSync(envDatei, 'utf8').trim(), spur: readFileSync(spur, 'utf8'), ausgabe: r.stdout, abhaken, zurueck }
}

const ROT = 'echo "[check:logic 12/194] pipeline/check-x.ts"; echo "Error: Ursache steht vorn"; for i in $(seq 1 160); do echo "[check:logic $i/194] fremde Ausgabe"; done; echo "check:logic: pipeline/check-x.ts ist rot (11 von 194 Prüfungen grün gelaufen)."; echo "Weitere Fehler dahinter bleiben verdeckt."; echo "npm error done"; exit 1'
const GRUEN = 'exit 0'

try {
  const keinDiff = lauf({ diff: false, logic: ROT, bestand: GRUEN })
  assert.equal(keinDiff.env, '', 'ohne Änderung an dub-confirmed.yaml keine Warnung')
  assert.ok(!keinDiff.spur.includes('npm'), 'ohne Änderung wird nichts geprüft')
  assert.equal(keinDiff.zurueck, GESTERN, 'ohne Änderung bleiben die Zurückgestellten')

  const gruen = lauf({ diff: true, logic: GRUEN, bestand: GRUEN })
  assert.equal(gruen.env, '', 'beide Prüfungen grün: keine Warnung')
  assert.ok(!gruen.spur.includes('checkout'), 'grün: nichts zurückgenommen')
  assert.equal(gruen.zurueck, '[]\n', 'ganzer Stapel grün: nichts mehr zurückgestellt')

  const rot = lauf({ diff: true, logic: ROT, bestand: GRUEN })
  assert.match(rot.env, /^DATEN_WARNUNG=Neue Meldungen zurückgestellt: .*pipeline\/check-x\.ts ist rot/, 'check:logic ohne ✖: Grund steht in der Warnung')
  assert.ok(rot.spur.includes('git checkout -- data/dub-confirmed.yaml'), 'Meldungen werden zurückgenommen')
  assert.ok(rot.spur.includes(`node tools/meldungen-eingrenzen.mjs /tmp/logic.txt ${ANTWORT}\n`), 'eingegrenzt wird auf der gesicherten Antwort')
  assert.ok(rot.spur.includes('git checkout -- data/meldungen-uebernahme.json\n'), 'nichts eingegrenzt: der Übernahme-Stempel geht mit zurück')
  assert.ok(rot.spur.includes('git checkout -- data/anbieter-staffeln.json\n'), 'nichts eingegrenzt: die Staffelaufteilung geht mit zurück')
  assert.equal(rot.abhaken, false, 'nichts eingegrenzt: nichts wird abgehakt')
  assert.equal(rot.zurueck, GESTERN, 'nichts eingegrenzt: die Zurückgestellten des Vortags bleiben gelistet')
  assert.match(rot.ausgabe, /^check:logic: pipeline\/check-x\.ts ist rot \(/m, 'die Prüfausgabe steht im Schrittprotokoll, nicht nur im Grund')
  assert.match(rot.ausgabe, /^Error: Ursache steht vorn$/m, 'die Ursache steht im Schrittprotokoll, auch wenn danach über 150 Zeilen fremder Ausgabe folgen')
  assert.match(rot.ausgabe, /^::group::/m, 'das Protokoll steht in einer Gruppe')
  assert.match(rot.ausgabe, /^::endgroup::$/m, 'die Gruppe wird geschlossen')

  const bestandRot = lauf({ diff: true, logic: GRUEN, bestand: 'echo "  ✖ Titel 5 fehlt"; exit 1' })
  assert.match(bestandRot.env, /Neue Meldungen zurückgestellt: ✖ Titel 5 fehlt/, 'zweite Prüfung rot: Grund aus ihrer ✖-Zeile')

  const mitVorher = lauf({ diff: true, logic: ROT, bestand: GRUEN, vorher: 'Anderes' })
  assert.match(mitVorher.env, /^DATEN_WARNUNG=Anderes · Neue Meldungen zurückgestellt: /, 'vorhandene Warnung bleibt vorn')
  const EINGEGRENZT = 'echo "2 von 5 (7 Versuche): 24542, 24543"; exit 0'
  const eingegrenzt = lauf({ diff: true, logic: ROT, bestand: GRUEN, eingrenzen: EINGEGRENZT, vorher: 'Anderes' })
  const ZURUECK = /^DATEN_WARNUNG=Anderes · Meldungen zurückgestellt: 2 von 5 \(7 Versuche\): 24542, 24543 — .*pipeline\/check-x\.ts ist rot/
  assert.match(eingegrenzt.env, ZURUECK, 'eingegrenzt: Kennungen und Grund in der Warnung')
  assert.equal(eingegrenzt.env.split('\n').length, 1, 'eingegrenzt: genau eine Warnung')
  assert.ok(!eingegrenzt.spur.includes('checkout'), 'eingegrenzt: der übernommene Rest bleibt')
  assert.equal(eingegrenzt.abhaken, true, 'eingegrenzt: der Rest wird nach dem Commit abgehakt')
  assert.equal(eingegrenzt.zurueck, GESTERN, 'eingegrenzt: die Datei schreibt das Werkzeug, der Schritt setzt sie nicht zurück')
  console.log('bestand-handbelege-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
