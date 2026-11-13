/** Tests für tools/mutationsanker-umhaengen.mjs: totem Anker die einzige Quelldatei mit der `suche` vorschlagen und eintragen. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ankerVorschlaege, umhaengenText, vorschlagZeilen } from './mutationsanker-umhaengen.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}

const m = (datei, suche, name = 'm') => ({ name, datei, suche, ersetze: 'X' })
const text = (liste) => JSON.stringify(liste)
const alleDateien = {
  'alt.ts': 'nichts mehr hier\n',
  'neu.ts': 'einmalige_zeile = 1\ndoppelt = 2\n',
  'zwei.ts': 'doppelt = 2\n',
  'x.test.ts': 'nur_im_test = 3\n',
  'tools/mutationen/l.json': 'einmalige_zeile = 1\n',
  'daten.json': 'einmalige_zeile = 1\n',
}
const lies = (p) => alleDateien[p] ?? null
const dateiListe = () => Object.keys(alleDateien)
const vorschlag = (liste) => ankerVorschlaege(text(liste), lies, dateiListe)

const eindeutig = vorschlag([m('alt.ts', 'einmalige_zeile')])
pruefe('eindeutig: genau ein Kandidat, Testdatei, Liste und JSON zählen nicht', eindeutig.length === 1 && eindeutig[0].kandidaten.join() === 'neu.ts')
pruefe('eindeutig: Meldezeile nennt Alt und Neu', vorschlagZeilen('l.json', eindeutig)[0].includes('alt.ts -> neu.ts'))
const mehr = vorschlag([m('alt.ts', 'doppelt')])
pruefe('mehrdeutig: zwei Kandidaten, Meldung nennt beide', mehr[0].kandidaten.length === 2 && vorschlagZeilen('l.json', mehr)[0].includes('nur gemeldet') && vorschlagZeilen('l.json', mehr)[0].includes('zwei.ts'))
const keiner = vorschlag([m('alt.ts', 'nur_im_test')])
pruefe('kein Treffer (Suche steht nur in Testdatei): kein Vorschlag', keiner[0].kandidaten.length === 0 && vorschlagZeilen('l.json', keiner)[0].includes('kein Treffer'))
pruefe('lebender Anker: kein Eintrag', vorschlag([m('neu.ts', 'doppelt')]).length === 0)
pruefe('Datei fehlt ganz: Vorschlag trotzdem', vorschlag([m('weg.ts', 'einmalige_zeile')])[0]?.kandidaten.join() === 'neu.ts')
pruefe('kaputtes JSON: keine Vorschläge', ankerVorschlaege('{ kaputt', lies, dateiListe).length === 0)

// Eintragen: nur der tote Mutant ändert sich, Layout bleibt byte-gleich.
const vorlage = `[\n  { "name": "tot", "datei": "alt.ts", "suche": "einmalige_zeile", "ersetze": "X" },\n  { "name": "lebt", "datei": "alt.ts", "suche": "nichts", "ersetze": "X" },\n  { "name": "mehr", "datei": "alt.ts", "suche": "doppelt", "ersetze": "X" }\n]\n`
const voll = ankerVorschlaege(vorlage, lies, dateiListe)
const neu = umhaengenText(vorlage, voll)
pruefe('umhängen: genau eine Änderung', neu.geaendert === 1)
pruefe('umhängen: nur die Datei des toten Mutanten wechselt', neu.text === vorlage.replace('"datei": "alt.ts", "suche": "einmalige_zeile"', '"datei": "neu.ts", "suche": "einmalige_zeile"'))
pruefe('umhängen: mehrdeutiger Anker bleibt unverändert', neu.text.includes('"name": "mehr", "datei": "alt.ts"'))
pruefe('umhängen: zweiter Lauf ändert nichts', ankerVorschlaege(neu.text, lies, dateiListe).filter((v) => v.name === 'tot').length === 0)
const zwei = `[\n  { "name": "a", "aenderungen": [{ "datei": "alt.ts", "suche": "einmalige_zeile", "ersetze": "X" }, { "datei": "alt.ts", "suche": "nichts", "ersetze": "X" }] }\n]`
pruefe('zwei Änderungen derselben Datei im Mutanten: nur gemeldet, nichts geschrieben', umhaengenText(zwei, ankerVorschlaege(zwei, lies, dateiListe)).geaendert === 0)
const doppelt = `[\n  { "name": "d", "datei": "alt.ts", "suche": "einmalige_zeile", "ersetze": "X" },\n  { "name": "d", "datei": "alt.ts", "suche": "einmalige_zeile", "ersetze": "Y" }\n]`
pruefe('Name doppelt in der Liste: nichts geschrieben', umhaengenText(doppelt, ankerVorschlaege(doppelt, lies, dateiListe)).geaendert === 0)

// Prozess in einem Wegwerf-Repo: ohne Schalter nur Meldung, mit Schalter wird die Liste geändert.
const wurzel = mkdtempSync(join(tmpdir(), 'mutanker-umh-'))
try {
  const git = (...a) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
    if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`)
  }
  mkdirSync(join(wurzel, 'tools', 'mutationen'), { recursive: true })
  writeFileSync(join(wurzel, 'alt.ts'), 'nichts mehr\n')
  writeFileSync(join(wurzel, 'neu.ts'), 'einmalige_zeile = 1\n')
  writeFileSync(join(wurzel, 'z1.ts'), 'doppelt = 1\n')
  writeFileSync(join(wurzel, 'z2.ts'), 'doppelt = 2\n')
  const listePfad = join(wurzel, 'tools', 'mutationen', 'l.json')
  writeFileSync(listePfad, vorlage)
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'basis')
  const skript = fileURLToPath(new URL('./mutationsanker.mjs', import.meta.url))
  const fahre = (...a) => spawnSync(process.execPath, [skript, 'tools/mutationen/l.json', ...a], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  const nur = fahre()
  pruefe('Prozess ohne Schalter: Exit 1, Vorschlag gemeldet, Liste unverändert', nur.status === 1 && nur.stderr.includes('alt.ts -> neu.ts') && readFileSync(listePfad, 'utf8') === vorlage)
  const mit = fahre('--umhaengen')
  pruefe('Prozess mit Schalter: Zeile „1 Anker umgehängt“ und Liste geändert', /1 Anker umgehängt/.test(mit.stdout) && readFileSync(listePfad, 'utf8') === neu.text)
  const nochmal = fahre('--umhaengen')
  pruefe('Prozess zweiter Lauf: nichts mehr umgehängt, mehrdeutiger bleibt gemeldet', !/umgehängt/.test(nochmal.stdout) && nochmal.stderr.includes('nur gemeldet'))
  // Schalter vor der Liste (A2) und `--alle` (A1): jeweils frische Liste.
  writeFileSync(listePfad, vorlage)
  const vorn = spawnSync(process.execPath, [skript, '--umhaengen', 'tools/mutationen/l.json'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  pruefe('Prozess Schalter vor der Liste: Liste geändert, „1 Anker umgehängt“', /1 Anker umgehängt/.test(vorn.stdout) && readFileSync(listePfad, 'utf8') === neu.text)
  writeFileSync(listePfad, vorlage)
  const alleNur = fahre('--alle')
  pruefe('Prozess --alle ohne Schalter: Exit 1, Liste unverändert', alleNur.status === 1 && alleNur.stderr.includes('alt.ts -> neu.ts') && readFileSync(listePfad, 'utf8') === vorlage)
  const alleMit = spawnSync(process.execPath, [skript, '--alle', '--umhaengen'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  pruefe('Prozess --alle --umhaengen: „1 Anker umgehängt“, Liste geändert', /^1 Anker umgehängt$/m.test(alleMit.stdout) && readFileSync(listePfad, 'utf8') === neu.text)
  pruefe('Prozess --alle --umhaengen: mehrdeutiger nur als →-Zeile', alleMit.stderr.includes('→') && alleMit.stderr.includes('nur gemeldet'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`✗ mutationsanker-umhaengen: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('✓ mutationsanker-umhaengen: alle Fälle grün')
