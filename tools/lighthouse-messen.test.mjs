/**
 * Gesamtlauf von `lighthouse-messen.mjs` über `main` mit einer Attrappe für `npx` im PATH (liefert einen festen Lighthouse-Bericht):
 * grün in den Grenzen, rot bei gerissener Grenze, rot bei scheiterndem Lighthouse (nie still grün), Ausgabe-JSON und Zusammenfassung geschrieben.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

function lauf(fall, lcp, scheitern) {
  const datei = path.join(ordner, `${fall}.json`)
  writeFileSync(datei, JSON.stringify(bericht(lcp)))
  const env = { ...process.env, PATH: `${ordner}${path.delimiter}${process.env.PATH}`, LH_BERICHT: datei, LH_AUFRUFE: path.join(ordner, `${fall}.aufrufe`), CHROME_PATH: '/bin/true', GITHUB_STEP_SUMMARY: path.join(ordner, `${fall}.md`) }
  delete env.GITHUB_EVENT_NAME
  if (scheitern) env.LH_SCHEITERN = '1'
  const ausgabe = path.join(ordner, `${fall}-ergebnis.json`)
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, 'lighthouse-messen.mjs'), '--basis', 'http://127.0.0.1:9/', '--profil', 'pr', '--n', '2', '--ausgabe', ausgabe], { env, encoding: 'utf8', timeout: 60000 })
  return { ...r, ausgabe, aufrufe: existsSync(env.LH_AUFRUFE) ? readFileSync(env.LH_AUFRUFE, 'utf8').trim().split('\n') : [], md: existsSync(env.GITHUB_STEP_SUMMARY) ? readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8') : '' }
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

  const kaputt = lauf('kaputt', 900, true)
  assert.equal(kaputt.status, 1, 'Lighthouse scheitert: Exit 1, nie still grün')
  assert.match(kaputt.stderr, /Lighthouse http:\/\/127\.0\.0\.1:9\/: Exit 3/, 'Fehler mit Adresse und Exit-Code')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('lighthouse-messen: 11 Zusicherungen ✓')
