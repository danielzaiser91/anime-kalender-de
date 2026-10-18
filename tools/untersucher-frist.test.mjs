/**
 * Der Untersucher darf bei rotem Bau nicht elf Stunden `ok` melden (18.10.2026: PR 1464 stand offen, jeder Lauf
 * endete mit `claude=nein` und `ok`). Geprüft: (1) Frist der Liegenbleiber, (2) `untersucher-vorab.mjs` gegen eine
 * gh-Attrappe, (3) der Abmelde-Schritt aus claude-reparatur.yml, mit `run` und `env` aus der YAML.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { markerFuer, offenePrs, liegengebliebenePrs, PR_FRIST_MS, schluesselAusProtokoll } from './untersucher-logik.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const ordner = mkdtempSync(join(tmpdir(), 'untersucher-frist-'))
const JETZT = Date.now() // der Prüfling liest die Uhr selbst; alle Alter sind relativ zu PR_FRIST_MS
const vor = (ms) => new Date(JETZT - ms).toISOString()

try {
  // (1) Frist: Treffer in der Mitte, beide Seiten der Grenze, fremder PR bleibt draußen.
  const prs = [
    { number: 10, title: 'unbeteiligt', body: '', createdAt: vor(1000) },
    { number: 11, title: 'Behebt #500', body: '', createdAt: vor(PR_FRIST_MS + 1000) },
    { number: 12, title: 'Behebt #500', body: '', createdAt: vor(PR_FRIST_MS - 1000) },
    { number: 13, title: 'Behebt #500', body: '', createdAt: vor(2000) },
    { number: 14, title: 'Behebt #500', body: '', createdAt: vor(PR_FRIST_MS * 3) },
  ]
  assert.deepEqual(offenePrs(prs, 500, [], JETZT), [12, 13], 'nur frische PRs halten den Untersucher zurück')
  assert.deepEqual(liegengebliebenePrs(prs, 500, [], JETZT), [11, 14], 'ältere PRs, die den Fehler nennen, liegen')
  assert.deepEqual(liegengebliebenePrs(prs, 999, [], JETZT), [], 'ohne Bezug liegt nichts')

  // (2) Ablauf von untersucher-vorab.mjs gegen die Attrappe.
  const protokollDatei = join(wurzel, 'tools/testdaten/untersucher/38233819404.log')
  const schluessel = schluesselAusProtokoll(readFileSync(protokollDatei, 'utf8')).schluessel
  const antworten = join(ordner, 'antworten.json')
  const attrappe = join(tools, 'untersucher-gh-attrappe.mjs')

  let ausgabeKommentare = ''
  function vorab(prListe) {
    const log = join(ordner, 'gh-protokoll.txt')
    const out = join(ordner, 'ausgabe.txt')
    writeFileSync(log, '')
    writeFileSync(out, '')
    writeFileSync(antworten, JSON.stringify({
      lauf: '777',
      protokollDatei,
      issueNr: 500,
      issues: [{ number: 400, body: 'anderer' }, { number: 500, body: `Lauf 38233819404\n${markerFuer(schluessel)}` }, { number: 600, body: 'noch einer' }],
      issueAnsicht: { body: 'Lauf 38233819404', comments: [] },
      prs: prListe,
    }))
    const r = spawnSync(process.execPath, [join(tools, 'untersucher-vorab.mjs'), '777'], {
      encoding: 'utf8',
      env: { ...process.env, GH_BIN: `${process.execPath}|${attrappe}`, ATTRAPPE_ANTWORTEN: antworten, ATTRAPPE_PROTOKOLL: log, GITHUB_OUTPUT: out, GITHUB_REPOSITORY: 'danielzaiser91/anime-kalender-de' },
    })
    assert.equal(r.status, 0, r.stderr)
    assert.ok(!readFileSync(log, 'utf8').includes('FALSCH'), `Attrappe meldet falschen Aufruf: ${readFileSync(log, 'utf8')}`)
    ausgabeKommentare = readFileSync(log, 'utf8').trim()
    return Object.fromEntries(readFileSync(out, 'utf8').split('\n').filter(Boolean).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1)]))
  }

  const frisch = vorab([
    { number: 1, title: 'fremd', body: '', createdAt: vor(1000) },
    { number: 2, title: 'Behebt #500', body: '', createdAt: vor(60 * 1000) },
    { number: 3, title: 'fremd', body: '', createdAt: vor(1000) },
  ])
  assert.equal(ausgabeKommentare, 'KOMMENTAR issue 500\nKOMMENTAR pr 2', 'Issue und frischer PR bekommen den Lauf-Link')
  assert.equal(frisch.claude, 'nein', 'frischer PR hält den Untersucher zurück')
  assert.match(frisch.grund, /PR #2 behandelt den Fehler schon/, 'der Grund nennt den PR, damit der Abmelde-Schritt ihn zeigen kann')

  const liegt = vorab([
    { number: 1, title: 'fremd', body: '', createdAt: vor(1000) },
    { number: 2, title: 'Behebt #500', body: '', createdAt: vor(PR_FRIST_MS + 60 * 1000) },
    { number: 3, title: 'fremd', body: '', createdAt: vor(1000) },
  ])
  assert.equal(ausgabeKommentare, 'KOMMENTAR issue 500\nKOMMENTAR pr 2', 'auch der liegengebliebene PR bekommt den Lauf-Link')
  assert.equal(liegt.claude, 'ja', 'liegengebliebener PR: der Untersucher arbeitet')
  assert.match(liegt.hinweis, /PR #2 steht seit über 6 Stunden offen/)
  assert.equal(liegt.grund, undefined, 'wer arbeitet, braucht keinen Grund zum Warnen')

  const keiner = vorab([{ number: 1, title: 'fremd', body: '', createdAt: vor(1000) }])
  assert.equal(keiner.claude, 'ja')
  assert.match(keiner.hinweis, /kein offener Pull Request/)

  // (3) Abmelde-Schritt aus der YAML: `run` und `env` stammen aus der Datei, die Ausdrücke setzt der Test.
  const wf = parse(readFileSync(join(wurzel, '.github/workflows/claude-reparatur.yml'), 'utf8'))
  const schritte = wf.jobs.untersuchen.steps.filter((s) => s.name === 'Lauf abmelden')
  assert.equal(schritte.length, 1, 'genau ein Abmelde-Schritt')
  const schritt = schritte[0]
  assert.equal(schritt.env.UNTERSUCHER, '${{ steps.dedupe.outputs.claude }}')
  assert.equal(schritt.env.GRUND, '${{ steps.dedupe.outputs.grund }}')
  assert.match(schritt.env.STATUS, /job\.status == 'success' && 'ok'/)

  const melder = join(ordner, 'melder.sh')
  writeFileSync(melder, '#!/usr/bin/env bash\necho "$@" > "$MELDER_PROTOKOLL"\n')
  function abmelden(status, claude, grund) {
    const protokoll = join(ordner, 'melder-protokoll.txt')
    writeFileSync(protokoll, '')
    const env = { ...process.env, MELDER: melder, MELDER_PROTOKOLL: protokoll, STATUS: status, UNTERSUCHER: claude, GRUND: grund }
    const r = spawnSync('bash', ['-c', schritt.run], { encoding: 'utf8', env })
    assert.equal(r.status, 0, r.stderr)
    return readFileSync(protokoll, 'utf8').trim()
  }
  assert.equal(abmelden('ok', 'nein', 'PR #2 offen'), 'warnung PR #2 offen', 'nichts untersucht: warnung statt ok')
  assert.equal(abmelden('ok', 'ja', ''), 'ok', 'untersucht und fertig: ok')
  assert.equal(abmelden('ok', '', ''), 'ok', 'Vorprüfung ohne Ausgabe: wie bisher ok')
  assert.equal(abmelden('fehler', 'nein', 'PR #2 offen'), 'fehler', 'ein Fehler bleibt ein Fehler')
  assert.equal(abmelden('abgebrochen', 'nein', 'x'), 'abgebrochen', 'Abbruch bleibt Abbruch')
  console.log('untersucher-frist: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
