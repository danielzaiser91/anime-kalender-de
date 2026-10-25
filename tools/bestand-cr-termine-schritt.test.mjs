/**
 * Ablauftest des Schritts „Crunchyroll-Folgen im Kalender prüfen" aus bestand-bauen.yml (`run` und `env` aus der YAML, npm als Attrappe)
 * und der Prüfung selbst als Prozess (`--stand`, Wegwerf-Ordner). Anlass (25.10.2026): Last Boss S2 #1–2 und Apothekerin S3 #49
 * fehlten Tage, niemand merkte es. Rot hier: Warnung statt Abbruch, der Bau liefert seine Daten trotzdem aus.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const wf = parse(readFileSync(join(wurzel, '.github/workflows/bestand-bauen.yml'), 'utf8'))
const alle = wf.jobs.bauen.steps
const schritte = alle.filter((s) => s.name === 'Crunchyroll-Folgen im Kalender prüfen')
assert.equal(schritte.length, 1, 'genau ein Schritt')
const schritt = schritte[0]
const ordner = mkdtempSync(join(tmpdir(), 'cr-termine-schritt-'))

/** `npmAusgabe`: was die Attrappe von `check:cr-termine` druckt; `exit`: ihr Exit-Code. */
function lauf({ npmAusgabe, exit, vorher = '' }) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'bin'), { recursive: true })
  const envDatei = join(arbeit, 'github-env.txt')
  writeFileSync(envDatei, '')
  writeFileSync(join(arbeit, 'ausgabe.txt'), npmAusgabe)
  const npm = join(arbeit, 'bin', 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash\n[ "$2" = check:cr-termine ] || exit 9\ncat "${join(arbeit, 'ausgabe.txt')}"\nexit ${exit}\n`)
  chmodSync(npm, 0o755)
  const env = { ...process.env, ...schritt.env, RUNNER_TEMP: arbeit, GITHUB_ENV: envDatei, PATH: `${join(arbeit, 'bin')}${delimiter}${process.env.PATH}` }
  if (vorher) env.DATEN_WARNUNG = vorher
  else delete env.DATEN_WARNUNG
  const r = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  return { status: r.status, ausgabe: r.stdout, env: readFileSync(envDatei, 'utf8').trim() }
}

/** Die Prüfung selbst: Wegwerf-Ordner mit Titel, Release und Katalog; `serieId` des Katalogs verweist auf den Crunchyroll-Weg. */
function pruefung(releaseSlug, { folgeTag = '2026-10-20', start = '2026-10-20', stand = '2026-10-25T12:00:00Z', fremd = false } = {}) {
  const d = join(ordner, `daten-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(d, 'public/data'), { recursive: true })
  mkdirSync(join(d, 'data'), { recursive: true })
  const titel = { id: 900001, franchiseId: 900001, streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/G900SERIE' }] }
  writeFileSync(join(d, 'public/data/titles.json'), JSON.stringify({ titles: [titel] }))
  const release = releaseSlug && {
    slug: releaseSlug,
    titleId: fremd ? 900002 : 900001,
    platform: 'crunchyroll',
    kind: 'weekly',
    date: '2999-01-01',
    time: '18:00',
    schedule: { weekday: 5, firstEpisodeNumber: 1, firstEpisodeDate: start, episodes: 12, time: '18:00' },
  }
  writeFileSync(join(d, 'public/data/releases.json'), JSON.stringify({ releases: release ? [release] : [] }))
  const folge = { serieId: 'G900SERIE', serie: 'Testserie', staffel: 'Staffel 1', nummer: 1, verfuegbarAb: `${folgeTag}T16:00:00Z` }
  writeFileSync(join(d, 'data/crunchyroll-neu.json'), JSON.stringify({ folgen: [folge] }))
  const tsx = join(wurzel, 'node_modules/tsx/dist/cli.mjs')
  const skript = join(tools, 'cr-termine-vorschau.ts')
  const r = spawnSync(process.execPath, [tsx, skript, '--wie-gebaut', '--streng', '--stand', stand], { cwd: d, encoding: 'utf8' })
  return { status: r.status, ausgabe: r.stdout }
}

try {
  assert.equal(schritt['continue-on-error'], true, 'ein Scheitern hält den Bau nicht an')
  const namen = alle.map((s) => s.name)
  const i = namen.indexOf(schritt.name)
  assert.ok(i > namen.indexOf('Datensatz bauen'), 'läuft nach dem Bau')
  assert.ok(i < namen.indexOf('Änderungen committen'), 'läuft vor dem Commit (rollt der zurück, ist der Lauf ohnehin rot)')
  assert.equal(schritt.run.match(/npm run check:cr-termine/g)?.length, 1, 'ruft genau die Prüfung')

  const gruen = lauf({ npmAusgabe: 'ok    2026-10-20 Testserie\n0 deutsche Folge(n) ohne Termin\n', exit: 0 })
  assert.equal(gruen.status, 0, 'keine fehlende Folge: Exit 0')
  assert.equal(gruen.env, '', 'keine fehlende Folge: keine Warnung')

  const rot = lauf({ npmAusgabe: 'FEHLT 2026-10-24 Last Boss | Staffel 2 #1\nok    2026-10-24 X\nFEHLT 2026-10-23 Apothekerin | Staffel 3 #49\n2 deutsche Folge(n) ohne Termin\n', exit: 1 })
  assert.notEqual(rot.status, 0, 'fehlende Folge: der Schritt endet rot')
  assert.equal(rot.env, 'DATEN_WARNUNG=Crunchyroll-Folgen ohne Termin (2): Last Boss | Staffel 2 #1;Apothekerin | Staffel 3 #49', 'Warnung nennt Zahl und Folgen')
  assert.match(rot.ausgabe, /^FEHLT 2026-10-24 Last Boss/m, 'Rohausgabe steht im Schrittlog')

  const eins = lauf({ npmAusgabe: 'FEHLT 2026-10-24 Solo | Staffel 1 #1\n1 deutsche Folge(n) ohne Termin\n', exit: 1 })
  assert.equal(eins.env, 'DATEN_WARNUNG=Crunchyroll-Folgen ohne Termin (1): Solo | Staffel 1 #1', 'genau eine fehlende Folge')

  const viele = lauf({ npmAusgabe: [1, 2, 3, 4].map((n) => `FEHLT 2026-10-24 S${n} | Staffel 1 #1\n`).join('') + '4 deutsche Folge(n) ohne Termin\n', exit: 1 })
  assert.equal(viele.env, 'DATEN_WARNUNG=Crunchyroll-Folgen ohne Termin (4): S1 | Staffel 1 #1;S2 | Staffel 1 #1;S3 | Staffel 1 #1', 'Zahl ist 4, genannt werden drei')

  const absturz = lauf({ npmAusgabe: 'Error: kaputt\n', exit: 1 })
  assert.notEqual(absturz.status, 0, 'Absturz ohne FEHLT-Zeile: Schritt rot')
  assert.equal(absturz.env, 'DATEN_WARNUNG=Crunchyroll-Folgen ohne Termin (0): Prüfung nicht lesbar', 'Absturz heißt „nicht lesbar“, nicht „0 fehlen“')

  const mitVorher = lauf({ npmAusgabe: 'FEHLT 2026-10-24 Solo | Staffel 1 #1\n', exit: 1, vorher: 'Anderes' })
  assert.equal(mitVorher.env, 'DATEN_WARNUNG=Anderes · Crunchyroll-Folgen ohne Termin (1): Solo | Staffel 1 #1', 'vorhandene Warnung bleibt vorn')

  // Die Prüfung selbst, Datenfälle: Termin vorhanden / fehlt.
  const dabei = pruefung('crunchyroll-g900serie')
  assert.equal(dabei.status, 0, `Folge hat Termin: Exit 0 (${dabei.ausgabe})`)
  assert.match(dabei.ausgabe, /^0 deutsche Folge\(n\) ohne Termin$/m)
  const fehlt = pruefung('')
  assert.equal(fehlt.status, 1, 'Folge ohne Termin: Exit 1')
  assert.match(fehlt.ausgabe, /^FEHLT 2026-10-20 Testserie \| Staffel 1 #1$/m, 'FEHLT-Zeile im Format, das der Schritt liest')
  assert.match(fehlt.ausgabe, /^1 deutsche Folge\(n\) ohne Termin$/m)
  // Fenster: genau 14 Tage zählt, 15 nicht; Toleranz genau ±1 Tag; fremder Titel zählt nicht; das Fenster folgt --stand, nicht der Uhr.
  assert.equal(pruefung('', { folgeTag: '2026-10-11' }).status, 1, 'Folge 14 Tage vor dem Stand zählt noch')
  assert.equal(pruefung('', { folgeTag: '2026-10-10' }).status, 0, 'Folge 15 Tage vor dem Stand zählt nicht mehr')
  assert.equal(pruefung('', { stand: '2999-12-31T00:00:00Z' }).status, 0, 'Fenster folgt --stand, nicht der Uhr')
  assert.equal(pruefung('crunchyroll-g900serie', { start: '2026-10-21' }).status, 0, 'Termin einen Tag danach trifft')
  assert.equal(pruefung('crunchyroll-g900serie', { start: '2026-10-19' }).status, 0, 'Termin einen Tag davor trifft')
  assert.equal(pruefung('crunchyroll-g900serie', { start: '2026-10-22' }).status, 1, 'Termin zwei Tage danach trifft nicht')
  assert.equal(pruefung('crunchyroll-g900serie', { start: '2026-10-18' }).status, 1, 'Termin zwei Tage davor trifft nicht')
  assert.equal(pruefung('crunchyroll-fremd', { fremd: true }).status, 1, 'Termin eines fremden Titels am selben Tag zählt nicht')
  console.log('bestand-cr-termine-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
