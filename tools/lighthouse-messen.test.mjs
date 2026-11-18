/**
 * Gesamtlauf von `lighthouse-messen.mjs` über `main` mit einer Attrappe für `npx` im PATH (liefert einen festen Lighthouse-Bericht):
 * grün in den Grenzen, rot bei gerissener Grenze, rot bei scheiterndem Lighthouse (nie still grün), Ausgabe-JSON und Zusammenfassung geschrieben;
 * Ratsche gegen HEAD^1 in Wegwerf-Repos: gelockert rot, gleich grün, erster PR grün, kein Elternteil rot.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SEITEN } from './lighthouse-grenzen.mjs'

if (process.platform === 'win32') {
  console.log('lighthouse-messen: übersprungen unter Windows (Attrappe ist ein sh-Skript); läuft in der PR-Kette unter Linux')
  process.exit(0)
}

const ordner = mkdtempSync(path.join(tmpdir(), 'lh-messen-'))
const npx = path.join(ordner, 'npx')
writeFileSync(npx, '#!/bin/sh\necho "$*" >> "$LH_AUFRUFE"\nif [ -n "$LH_SCHEITERN" ]; then echo "kaputt" >&2; exit 3; fi\ncat "$LH_BERICHT"\n')
chmodSync(npx, 0o755)

const bericht = (lcp) => ({
  audits: { 'largest-contentful-paint': { numericValue: lcp }, 'cumulative-layout-shift': { numericValue: 0.001 }, 'total-blocking-time': { numericValue: 50 }, 'total-byte-weight': { numericValue: 600000 } },
  categories: { performance: { score: 0.99 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } },
  environment: { benchmarkIndex: 2000 },
})

/** Ein Lauf des Skripts; `wurzel` ist ein Wegwerf-Repo mit Kopie der Werkzeuge (Ratsche liest `HEAD^1` dort), `pr` setzt das PR-Ereignis. */
function lauf(fall, lcp, { scheitern = false, wurzel = path.join(import.meta.dirname, '..'), pr = false } = {}) {
  const datei = path.join(ordner, `${fall}.json`)
  writeFileSync(datei, JSON.stringify(bericht(lcp)))
  const env = { ...process.env, PATH: `${ordner}${path.delimiter}${process.env.PATH}`, LH_BERICHT: datei, LH_AUFRUFE: path.join(ordner, `${fall}.aufrufe`), CHROME_PATH: '/bin/true', GITHUB_STEP_SUMMARY: path.join(ordner, `${fall}.md`) }
  delete env.GITHUB_EVENT_NAME
  if (pr) env.GITHUB_EVENT_NAME = 'pull_request'
  if (scheitern) env.LH_SCHEITERN = '1'
  const ausgabe = path.join(ordner, `${fall}-ergebnis.json`)
  const r = spawnSync(process.execPath, [path.join(wurzel, 'tools', 'lighthouse-messen.mjs'), '--basis', 'http://127.0.0.1:9/', '--profil', 'pr', '--n', '2', '--ausgabe', ausgabe], { env, encoding: 'utf8', timeout: 60000 })
  return { ...r, ausgabe, aufrufe: existsSync(env.LH_AUFRUFE) ? readFileSync(env.LH_AUFRUFE, 'utf8').trim().split('\n') : [], md: existsSync(env.GITHUB_STEP_SUMMARY) ? readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8') : '' }
}

const GRENZEN_TEXT = readFileSync(path.join(import.meta.dirname, 'lighthouse-grenzen.mjs'), 'utf8')

/** Wegwerf-Repo: Commit „main“ mit `alt` als Grenzdatei (fehlt bei undefined), darauf Commit „PR“ mit `neu`; ohne `neu` nur der erste Commit. */
function ratschenRepo(name, alt, neu) {
  const repo = path.join(ordner, name)
  mkdirSync(path.join(repo, 'tools'), { recursive: true })
  for (const d of ['lighthouse-messen.mjs', 'lighthouse-urteil.mjs', 'dist-http.mjs']) copyFileSync(path.join(import.meta.dirname, d), path.join(repo, 'tools', d))
  const git = (...a) => assert.equal(spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: repo, encoding: 'utf8', timeout: 20000 }).status, 0, `git ${a[0]}`)
  const grenzen = path.join(repo, 'tools', 'lighthouse-grenzen.mjs')
  git('init', '-q')
  if (alt !== undefined) writeFileSync(grenzen, alt)
  git('add', '-A')
  git('commit', '-q', '-m', 'main')
  if (neu === undefined) return repo
  writeFileSync(grenzen, neu)
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'PR')
  return repo
}

try {
  const gut = lauf('gut', 900)
  assert.equal(gut.status, 0, `in den Grenzen: Exit 0\n${gut.stdout}${gut.stderr}`)
  assert.equal(gut.aufrufe.length, 2 * Object.keys(SEITEN).length, 'je Seite n Läufe')
  assert.ok(gut.aufrufe.every((a) => /^-y lighthouse@\d+\.\d+\.\d+ http:\/\/127\.0\.0\.1:9\//.test(a)), 'feste Lighthouse-Fassung, Adresse der Basis')
  assert.ok(gut.aufrufe.some((a) => a.includes('#/datenbank?t=21')), 'Hash-Adresse der Titelseite')
  assert.match(gut.md, /✓ alle Grenzen gehalten/, 'Zusammenfassung geschrieben')
  const json = JSON.parse(readFileSync(gut.ausgabe, 'utf8'))
  assert.equal(json.ergebnis.Kalender.lcp, 900, 'Median im Ausgabe-JSON')
  assert.equal(json.laeufe.Titel.length, 2, 'Einzelläufe im Ausgabe-JSON')

  const rot = lauf('rot', 30000)
  assert.equal(rot.status, 1, 'LCP über der Grenze: Exit 1')
  assert.match(rot.stdout, /✖ Kalender: lcp 30000 > 2500/, 'Verstoß benannt')

  const kaputt = lauf('kaputt', 900, { scheitern: true })
  assert.equal(kaputt.status, 1, 'Lighthouse scheitert: Exit 1, nie still grün')
  assert.match(kaputt.stderr, /Lighthouse http:\/\/127\.0\.0\.1:9\/: Exit 3/, 'Fehler mit Adresse und Exit-Code')

  // Ratsche über main: der PR lockert eine Grenze gegenüber HEAD^1 (Kalender-LCP 2500 → 2600) — Messung grün, Urteil trotzdem rot.
  const gelockert = GRENZEN_TEXT.replace('lcp: 2500,', 'lcp: 2600,')
  assert.notEqual(gelockert, GRENZEN_TEXT, 'Attrappe: Kalender-LCP 2500 steht in der Grenzdatei')
  const locker = lauf('locker', 900, { wurzel: ratschenRepo('locker', GRENZEN_TEXT, gelockert), pr: true })
  assert.equal(locker.status, 1, `gelockerte Grenze im PR: Exit 1\n${locker.stdout}`)
  assert.match(locker.stdout, /Ratsche gelockert: pr\/Kalender\/lcp: 2500 → 2600/, 'Lockerung benannt')
  assert.equal(lauf('gleich', 900, { wurzel: ratschenRepo('gleich', GRENZEN_TEXT, GRENZEN_TEXT), pr: true }).status, 0, 'unverändert im PR: grün')
  assert.equal(lauf('locker-ohne-pr', 900, { wurzel: ratschenRepo('locker2', GRENZEN_TEXT, gelockert) }).status, 0, 'außerhalb eines PR (Tageslauf) keine Ratsche')
  const erst = lauf('erst', 900, { wurzel: ratschenRepo('erst', undefined, GRENZEN_TEXT), pr: true })
  assert.equal(erst.status, 0, 'Grenzdatei fehlt auf main (erster PR): grün')
  assert.match(erst.stdout, /fehlt auf main \(erster PR\)/, 'und sagt es')
  const ohneEltern = lauf('ohne-eltern', 900, { wurzel: ratschenRepo('ohne-eltern', GRENZEN_TEXT), pr: true })
  assert.equal(ohneEltern.status, 1, 'kein Elternteil lesbar: Exit 1 statt stiller Ausfall der Ratsche')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('lighthouse-messen: 20 Zusicherungen ✓')
