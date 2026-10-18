/**
 * Test von tools/meldungen-eingrenzen.mjs: das Halbieren (Auswahl, Schwelle, Grenzen) als Einheit, der Ablauf als eigener
 * Prozess auf einer Kulisse im Temp-Ordner (`AK_ROOT`: Git-Repo mit Attrappen von fetch-pruefungen und den Prüfungen).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { einheitenAus, grenzeEin, rotePruefungen } from './meldungen-eingrenzen.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const e = (url) => ({ url, ids: [url.charCodeAt(0)] })
const [a, b, c, d, f] = ['a', 'b', 'c', 'd', 'f'].map(e)
const ohne = (...schlecht) => async (teil) => !teil.some((x) => schlecht.includes(x))

/* Auswahl: eine schlechte Einheit in der Mitte, zwei (Mitte und Ende), keine, eine einzelne. */
assert.deepEqual(await grenzeEin([a, b, c, d, f], ohne(c)), { angenommen: [a, b, d, f], zurueck: [c], versuche: 5 }, 'nur die Mitte zurück')
assert.deepEqual((await grenzeEin([a, b, c, d, f], ohne(b, f))).zurueck, [b, f], 'zwei schlechte: beide zurück, auch die letzte')
assert.deepEqual(await grenzeEin([a, b, c], ohne()), { angenommen: [a, b, c], zurueck: [], versuche: 3 }, 'alle gut: alle angenommen')
assert.deepEqual(await grenzeEin([c], ohne(c)), { angenommen: [], zurueck: [c], versuche: 2 }, 'eine schlechte allein: zurück')
/* Schwelle („höchstens 1 schlechte“): die erste schlechte passt noch, erst die zweite kippt. */
const hoechstensEine = async (teil) => teil.filter((x) => x === b || x === d).length <= 1
assert.deepEqual(await grenzeEin([a, b, c, d, f], hoechstensEine), { angenommen: [a, b, c, f], zurueck: [d], versuche: 5 }, 'Schwelle: nur die kippende zurück')
/* Grenzen: schon der Stand ohne Meldungen ist rot, oder zu viele Versuche. */
assert.equal(await grenzeEin([a, b, c], async () => false), null, 'Grundlauf rot: nichts eingegrenzt')
assert.equal(await grenzeEin([a, b, c, d, f], ohne(c), 4), null, 'mehr als hoechstens Versuche: nichts eingegrenzt')
assert.ok(await grenzeEin([a, b, c, d, f], ohne(c), 5), 'genau hoechstens Versuche reichen')

/* Rote Prüfungen aus beiden Formatzeilen von check-logic-alle.mjs; grüne Testzeilen und Fremdes zählen nicht. */
const liste = 'pipeline/check-a.ts\npipeline/check-b.ts\npipeline/check-c.ts\n'
const einzeln = 'x\n  ✓ pipeline/check-a.ts ist rot (Testtext)\ncheck:logic: pipeline/check-b.ts ist rot (11 von 194 Prüfungen grün gelaufen).\n'
assert.deepEqual(rotePruefungen(einzeln, liste), ['pipeline/check-b.ts'], 'Einzelzeile')
const viele = '  - pipeline/check-a.ts\ncheck:logic: 2 von 194 Prüfungen rot:\n  - pipeline/check-c.ts\n  - pipeline/check-b.ts\n  - tools/fremd.mjs\n'
assert.deepEqual(rotePruefungen(viele, liste), ['pipeline/check-b.ts', 'pipeline/check-c.ts'], 'Aufzählung erst nach der Kopfzeile, nur Listendateien')

/* Einheiten: je Adresse, in Reihenfolge der Antwort. */
const antwort = JSON.stringify({ pruefungen: [{ id: 1, url: 'u1' }, { id: 2, url: 'u2' }, { id: 3, url: 'u1' }] })
assert.deepEqual(einheitenAus(antwort), [{ url: 'u1', ids: [1, 3] }, { url: 'u2', ids: [2] }], 'je Adresse gruppiert')

/* Ablauf als Prozess: Attrappe von fetch-pruefungen schreibt je Meldung eine Zeile und scheitert danach an Meldung 5, die Bestandsprüfung ist rot bei Meldung 2. */
const ordner = mkdtempSync(join(tmpdir(), 'eingrenzen-test-'))
const datei = (pfad, text) => {
  mkdirSync(dirname(join(ordner, pfad)), { recursive: true })
  writeFileSync(join(ordner, pfad), text)
}
const git = (...args) => spawnSync('git', args, { cwd: ordner, encoding: 'utf8' })
try {
  const spur = join(ordner, 'spur.txt')
  datei('data/dub-confirmed.yaml', '# Kopf\n')
  for (const p of ['data/anbieter-staffeln.json', 'data/amazon-gti-belegt.json', 'data/meldungs-auffaelligkeiten.json', 'data/meldungen-uebernahme.json']) datei(p, '{}\n')
  datei('daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md', '# Liste\n')
  datei('tools/check-logic-liste.txt', 'pipeline/check-x.ts\n')
  datei('pipeline/fetch-pruefungen.ts', `import { appendFileSync, readFileSync } from 'node:fs'
if (!process.env.LAUF_TOKEN) process.exit(0)
if (process.env.MELDUNGEN_SICHERN) appendFileSync(process.env.MELDUNGEN_SICHERN, 'gesichert')
const ohne = new Set(JSON.parse(readFileSync(process.env.MELDUNGEN_OHNE!, 'utf8')))
const p = JSON.parse(readFileSync(process.env.MELDUNGEN_ANTWORT!, 'utf8')).pruefungen.filter((x: { id: number }) => !ohne.has(x.id))
for (const x of p) appendFileSync('data/dub-confirmed.yaml', 'meldung ' + x.id + '\\n')
appendFileSync('data/meldungen-uebernahme.json', 'x')
appendFileSync('data/cache/pruefungen-abhaken.json', p.map((x: { id: number }) => x.id).join(',') + ';')
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, 'DATEN_WARNUNG=doppelt\\n')
appendFileSync(${JSON.stringify(spur)}, 'fetch ' + process.argv.slice(2).join(' ') + '\\n')
process.exit(p.some((x: { id: number }) => x.id === 5) ? 1 : 0)
`)
  datei('pipeline/check-logic-bestand.ts', `import { readFileSync } from 'node:fs'
const zeilen = readFileSync('data/dub-confirmed.yaml', 'utf8').split('\\n').filter((z) => z.startsWith('meldung'))
process.exit(zeilen.includes('meldung 2') || zeilen.length !== new Set(zeilen).size ? 1 : 0)
`)
  datei('tools/check-logic-alle.mjs', `import { appendFileSync } from 'node:fs'\nappendFileSync(${JSON.stringify(spur)}, 'alle ' + process.argv.slice(2).join(' ').replace(/\\S*eingrenzen-[^ ]*/, 'LISTE') + '\\n')\n`)
  git('init', '-q')
  git('config', 'core.autocrlf', 'false')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'k')
  datei('protokoll.txt', 'check:logic: 1 von 1 Prüfungen rot:\n  - pipeline/check-x.ts\n')
  datei('data/cache/pruefungen-abhaken.json', 'alt;')
  const zeile = (id, url) => ({ id, url })
  datei('antwort.json', JSON.stringify({ pruefungen: [zeile(1, 'u1'), zeile(5, 'u2'), zeile(2, 'u3'), zeile(3, 'u4'), zeile(4, 'u1')] }))
  const envDatei = join(ordner, 'github-env.txt')
  writeFileSync(envDatei, '')
  const env = { ...process.env, AK_ROOT: ordner, GITHUB_ENV: envDatei, MELDUNGEN_SICHERN: join(ordner, 'nie.json') }
  delete env.LAUF_TOKEN
  const lauf = () => spawnSync(process.execPath, [join(tools, 'meldungen-eingrenzen.mjs'), join(ordner, 'protokoll.txt'), join(ordner, 'antwort.json')], {
    cwd: ordner,
    encoding: 'utf8',
    env,
  })
  const r = lauf()
  assert.equal(r.status, 0, `Eingrenzen gelingt: ${r.stderr}`)
  assert.match(r.stdout, /^2 von 5 \(\d+ Versuche\): 5, 2$/m, 'Stdout nennt die zurückgestellten Meldungen, auch die, an der das Nachspiel scheitert')
  assert.match(r.stderr, /^Zurückgestellt: u2 \(Meldung 5\)\r?\nZurückgestellt: u3 \(Meldung 2\)$/m, 'das Protokoll nennt jede Adresse mit ihren Meldungen')
  assert.equal(readFileSync(join(ordner, 'data/dub-confirmed.yaml'), 'utf8'), '# Kopf\nmeldung 1\nmeldung 3\nmeldung 4\n', 'der Rest ist übernommen, einmal')
  assert.equal(readFileSync(join(ordner, 'data/meldungen-uebernahme.json'), 'utf8'), '{}\nx', 'der Stempel stammt nur aus dem letzten Nachspiel')
  assert.equal(readFileSync(join(ordner, 'data/cache/pruefungen-abhaken.json'), 'utf8'), '1,3,4;', 'abgehakt wird nur, was zuletzt übernommen ist')
  assert.equal(readFileSync(envDatei, 'utf8'), '', 'Nachspiele schreiben keine Warnung in GITHUB_ENV')
  const schritte = readFileSync(spur, 'utf8').trim().split('\n')
  assert.ok(!existsSync(env.MELDUNGEN_SICHERN), 'Nachspiele sichern die Antwort nicht erneut')
  assert.ok(schritte.every((s) => /^(fetch --abhaken-spaeter|alle LISTE eingrenzen|alle)$/.test(s)), schritte.join(' | '))
  assert.ok(schritte.includes('alle LISTE eingrenzen'), 'die roten Prüfungen laufen je Versuch')
  assert.equal(schritte.at(-1), 'alle', 'zuletzt läuft check:logic ganz, ohne Liste')

  /* Nichts eingegrenzt: keine einzelne Adresse rot, oder schon der Stand ohne Meldungen rot — Exit 1, nichts auf Stdout. */
  datei('antwort.json', JSON.stringify({ pruefungen: [zeile(1, 'u1'), zeile(3, 'u4')] }))
  const keine = lauf()
  assert.deepEqual([keine.status, keine.stdout], [1, ''], 'keine Adresse rot: Exit 1')
  /* Eine Arbeitsdatei fehlt im Commit: `git checkout` scheitert, kein Versuch zählt als grün. */
  datei('antwort.json', JSON.stringify({ pruefungen: [zeile(1, 'u1'), zeile(2, 'u3'), zeile(5, 'u2')] }))
  git('rm', '-q', '--cached', 'data/meldungs-auffaelligkeiten.json')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'ohne')
  writeFileSync(spur, '')
  const ohneDatei = lauf()
  assert.deepEqual([ohneDatei.status, ohneDatei.stdout, readFileSync(spur, 'utf8')], [1, '', ''], 'Checkout scheitert: Exit 1, kein Nachspiel')
  git('add', 'data/meldungs-auffaelligkeiten.json')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'wieder')
  datei('antwort.json', JSON.stringify({ pruefungen: [zeile(2, 'u3')] }))
  datei('pipeline/check-logic-bestand.ts', 'process.exit(1)\n')
  const grundRot = lauf()
  const vollerStapel = readFileSync(join(ordner, 'data/dub-confirmed.yaml'), 'utf8')
  assert.deepEqual([grundRot.status, grundRot.stdout, vollerStapel], [1, '', '# Kopf\nmeldung 2\n'], 'Stand ohne Meldungen schon rot: Exit 1, voller Stapel')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('meldungen-eingrenzen: ok')
