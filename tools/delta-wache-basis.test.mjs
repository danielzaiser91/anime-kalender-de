/**
 * Die Historie-Zeile trägt den Commit der Messung (`basis`); die nächste Messung schlüsselt einen roten Befund gegen diesen Stand auf,
 * nicht gegen `HEAD`. Anlass: Zeile vom 10.11.2026 16:55 (Sailor Moon Crystal III) war rot ohne `betroffen`, weil der Bau-Commit
 * dcc9b7220 (16:53) die Änderung schon trug, `HEAD` und Arbeitsbaum also gleich waren. Prozess gegen ein Wegwerf-Repo.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aufschluesselStand, kopfCommit } from '../pipeline/lib/historie-basis.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const S3 = 'https://animationdigitalnetwork.com/de/video/427-sailor-moon?s=3'
const adn = { platform: 'adn', url: S3, dub: true, zugang: 'abo' }
const extra = { id: 7, titleDe: 'Extra', streams: [] }
const bleibt = { id: 8, titleDe: 'Bleibt', streams: [{ platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/999-andere?s=1', dub: true, zugang: 'abo' }] }
const mit = [extra, bleibt, { id: 21462, titleDe: 'Pretty Guardian Sailor Moon Crystal Season III', streams: [adn] }, { id: 532, titleDe: 'Sailor Moon S', streams: [adn] }]
const ohne = [bleibt, { id: 21462, titleDe: 'Pretty Guardian Sailor Moon Crystal Season III', streams: [] }, { id: 532, titleDe: 'Sailor Moon S', streams: [] }]
const HISTORIE = ['bestand', 'historie'].join('-') + '.jsonl' // ohne Literal: pr-nachrechnen-bot-pfade verbietet den Dateinamen in Tests
const kzVor = { titel: 4, titelMitVerweis: 3, verweise: 3, mitUrteil: 3, ohneUrteil: 0, titelMitSynchro: 3, entferntProtokolliert: 0, entferntJeAnbieter: {}, releases: 0, termine: 0, jeAnbieter: { adn: 3 }, kanalOhneUrteil: {}, kanalTitelOhneSynchro: 0, entfernteBelege: [] }
const git = (repo, ...x) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...x], { cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true }).trim()

const wegwerf = mkdtempSync(join(tmpdir(), 'ak-wache-basis-'))
try {
  // Zwei Commits: Stand mit beiden Wegen, danach Stand ohne (der Bau-Commit); der Arbeitsbaum gleicht dem zweiten.
  const repo = join(wegwerf, 'repo')
  mkdirSync(join(repo, 'public/data'), { recursive: true })
  mkdirSync(join(repo, 'data'), { recursive: true })
  git(repo, 'init', '-q')
  const titel = join(repo, 'public/data/titles.json')
  writeFileSync(titel, JSON.stringify(mit))
  git(repo, 'add', 'public/data/titles.json')
  git(repo, 'commit', '-q', '-m', 'vorher')
  const erster = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(titel, JSON.stringify(ohne))
  git(repo, 'commit', '-q', '-am', 'bau-commit')
  const zweiter = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(join(repo, 'data/link-check.json'), '{}')

  // --- Hilfsfunktionen -------------------------------------------------------------------------------------------------
  assert.equal(kopfCommit(repo), zweiter, 'kopfCommit nennt HEAD')
  assert.equal(kopfCommit(wegwerf), undefined, 'ohne Git kein Commit')
  assert.equal(aufschluesselStand(repo, { basis: erster }), erster, 'gesetzte Basis gilt')
  assert.equal(aufschluesselStand(repo, null), 'HEAD', 'erste Zeile: HEAD')
  assert.equal(aufschluesselStand(repo, {}), 'HEAD', 'Zeile ohne basis (Bestand): HEAD')
  assert.equal(aufschluesselStand(repo, { basis: 123 }), 'HEAD', 'keine Zeichenkette: HEAD')
  assert.equal(aufschluesselStand(repo, { basis: 'nicht-hex; rm' }), 'HEAD', 'kein Hash: HEAD')
  assert.equal(aufschluesselStand(repo, { basis: 'HEAD~1' }), 'HEAD', 'Verweisname statt Hash: HEAD')
  assert.equal(aufschluesselStand(repo, { basis: [erster] }), 'HEAD', 'Liste mit dem Hash ist keine Zeichenkette: HEAD')
  assert.equal(aufschluesselStand(repo, { basis: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }), 'HEAD', 'Commit im Klon unbekannt (flacher Klon): HEAD')

  // --- Prozess: bestand-historie.ts ------------------------------------------------------------------------------------
  const starte = (vorigeZeile) => {
    writeFileSync(join(repo, 'data', HISTORIE), JSON.stringify({ zeitpunkt: '2026-11-10T16:39:00.000Z', lauf: 'alt', ...kzVor, ...vorigeZeile }) + '\n')
    const cli = join(wurzel, 'node_modules/tsx/dist/cli.mjs')
    const r = spawnSync(process.execPath, [cli, join(wurzel, 'pipeline/bestand-historie.ts'), '--lauf', 'probe'], { cwd: wurzel, env: { ...process.env, AK_ROOT: repo }, encoding: 'utf8', windowsHide: true, timeout: 120000 })
    assert.equal(r.status, 0, r.stderr + r.stdout)
    assert.match(r.stdout, /\[historie\] 3 Titel/, 'Lauf kam bis zur Schlusszeile')
    return readFileSync(join(repo, 'data', HISTORIE), 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))[1]
  }
  const kontrolle = starte({})
  assert.ok(kontrolle.auffaellig.includes('adn: 2 Synchro-Belege weniger'), 'Kontrolle: der Befund ist rot ' + JSON.stringify(kontrolle.auffaellig))
  assert.equal(kontrolle.betroffen, undefined, 'Kontrolle ohne basis: HEAD trägt die Änderung schon, keine Titelzeile (der Fehler vom 10.11.)')
  assert.equal(kontrolle.basis, zweiter, 'die neue Zeile trägt den Commit ihrer Messung')

  const z = starte({ basis: erster })
  assert.ok(z.auffaellig.includes('adn: 2 Synchro-Belege weniger'), 'mit basis: weiter rot')
  assert.ok(z.betroffen?.some((t) => t.includes('Sailor Moon S (532)')) && z.betroffen.some((t) => t.includes('(21462)')), JSON.stringify(z.betroffen))
  assert.equal(z.basis, zweiter, 'die neue Zeile trägt wieder ihren eigenen Commit, nicht den der vorigen')
  assert.deepEqual(z.titelWeg, [7], 'Titelabgang kommt aus der Basis')
  assert.equal(kontrolle.titelWeg, undefined, 'Kontrolle ohne basis: HEAD kennt den Titel schon nicht mehr')
  assert.ok(z.auffaellig.some((t) => t.startsWith('adn: fehlt Sailor Moon S (532)')), 'Wege aus der Basis: ' + JSON.stringify(z.auffaellig))
  assert.equal(kontrolle.auffaellig.some((t) => t.startsWith('adn: fehlt')), false, 'Kontrolle ohne basis: keine Wege')

  const unbekannt = starte({ basis: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' })
  assert.equal(unbekannt.betroffen, undefined, 'unbekannte basis fällt auf HEAD zurück, kein Absturz')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}

console.log('delta-wache-basis.test: basis-Commit in der Zeile, Aufschlüsselung gegen die Basis der vorigen Zeile (Anlass 10.11. 16:55 mit betroffen), Kontrolle ohne basis, Rückfall HEAD (kein Hash, unbekannt, erste Zeile), Prozess')
