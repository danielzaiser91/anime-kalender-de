// Prüft pipeline/lib/meldungen-stapel.ts: Sichern, Nachspielen und Weglassen des Meldungsstapels sowie den Übernahme-Stempel.
// Eigener Prozess mit tsx; `AK_ROOT` lenkt den Stempel in einen Wegwerf-Ordner. Der Prozess läuft in einem zweiten leeren
// Ordner, nie im Repo: ein Pfad, der `AK_ROOT` übergeht, schreibt dann ins Leere statt in den echten Stempel (18.10.2026).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const TSX = pathToFileURL(createRequire(join(wurzel, 'package.json')).resolve('tsx/esm')).href
const MODUL = pathToFileURL(join(wurzel, 'pipeline/lib/meldungen-stapel.ts')).href
const skript = `
const { ladeMeldungen, legeAbhakenAb } = await import(${JSON.stringify(MODUL)})
const [ort, briefkasten, status] = process.argv.slice(1)
const abrufe = []
globalThis.fetch = async (u, o) => (abrufe.push(String(u) + ' ' + o?.headers?.Authorization), new Response(briefkasten, { status: Number(status) }))
const fall = async (env) => {
  for (const k of ['MELDUNGEN_ANTWORT', 'MELDUNGEN_SICHERN', 'MELDUNGEN_OHNE']) delete process.env[k]
  Object.assign(process.env, env)
  const r = await ladeMeldungen('https://briefkasten/pruefung', 'geheim')
  return { status: r.status, text: await r.text(), abrufe: abrufe.splice(0) }
}
const ergebnis = {
  direkt: await fall({}),
  gesichert: await fall({ MELDUNGEN_SICHERN: ort + '/gesichert.json' }),
  nachspiel: await fall({ MELDUNGEN_ANTWORT: ort + '/antwort.json' }),
  ohne: await fall({ MELDUNGEN_ANTWORT: ort + '/antwort.json', MELDUNGEN_OHNE: ort + '/ohne.json' }),
  sichernOhne: await fall({ MELDUNGEN_SICHERN: ort + '/beides.json', MELDUNGEN_OHNE: ort + '/ohne.json' }),
}
legeAbhakenAb(ort + '/cache/tief/abhaken.json', new Set([7, 8, 9]))
console.log(JSON.stringify(ergebnis))
`
const BRIEFKASTEN = JSON.stringify({ pruefungen: [{ id: 1 }, { id: 2 }, { id: 3 }] })
function lauf(status) {
  const ort = mkdtempSync(join(tmpdir(), 'meldungen-stapel-'))
  mkdirSync(join(ort, 'data'))
  writeFileSync(join(ort, 'antwort.json'), JSON.stringify({ pruefungen: [{ id: 4 }, { id: 5 }, { id: 6 }] }))
  writeFileSync(join(ort, 'ohne.json'), '[5, 2]')
  mkdirSync(join(ort, 'arbeit'))
  const r = spawnSync(process.execPath, ['--import', TSX, '--input-type=module', '-e', skript, ort, BRIEFKASTEN, String(status)], {
    cwd: join(ort, 'arbeit'),
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: ort },
  })
  assert.equal(r.status, 0, r.stderr)
  const lies = (p) => (existsSync(join(ort, p)) ? readFileSync(join(ort, p), 'utf8') : null)
  const dateien = { gesichert: lies('gesichert.json'), beides: lies('beides.json'), abhaken: lies('cache/tief/abhaken.json'), stempel: lies('data/meldungen-uebernahme.json') }
  rmSync(ort, { recursive: true, force: true })
  return { ...JSON.parse(r.stdout), dateien }
}

const vorher = Date.now()
const ok = lauf(200)
const ADRESSE = ['https://briefkasten/pruefung Bearer geheim']
assert.deepEqual(ok.direkt, { status: 200, text: BRIEFKASTEN, abrufe: ADRESSE }, 'ohne Schalter: Briefkasten unverändert')
assert.deepEqual(ok.gesichert, { status: 200, text: BRIEFKASTEN, abrufe: ADRESSE }, 'SICHERN: Antwort unverändert weitergereicht')
assert.equal(ok.dateien.gesichert, BRIEFKASTEN, 'SICHERN legt die Antwort ab')
assert.deepEqual(ok.nachspiel.abrufe, [], 'ANTWORT: kein Abruf')
assert.deepEqual(JSON.parse(ok.nachspiel.text).pruefungen.map((p) => p.id), [4, 5, 6], 'ANTWORT: die Datei statt des Briefkastens')
assert.deepEqual(JSON.parse(ok.ohne.text).pruefungen.map((p) => p.id), [4, 6], 'OHNE: Meldung 5 aus der Mitte fehlt')
assert.deepEqual(JSON.parse(ok.sichernOhne.text).pruefungen.map((p) => p.id), [1, 3], 'OHNE am Briefkasten: Meldung 2 fehlt')
assert.equal(ok.dateien.beides, BRIEFKASTEN, 'gesichert wird die ganze Antwort, nicht die gefilterte')
assert.equal(ok.dateien.abhaken, '[7,8,9]', 'Kennungen fürs Abhaken, Ordner angelegt')
const stempel = JSON.parse(ok.dateien.stempel)
assert.equal(stempel.meldungen, 3, 'Stempel zählt die Übernommenen')
assert.ok(Date.parse(stempel.zuletzt) >= vorher - 1000 && Date.parse(stempel.zuletzt) <= Date.now(), `Stempel trägt die Zeit: ${stempel.zuletzt}`)
assert.ok(ok.dateien.stempel.endsWith('}\n'), 'Stempel endet mit Zeilenumbruch')

const kaputt = lauf(503)
assert.equal(kaputt.gesichert.status, 503, 'Fehlerantwort bleibt eine Fehlerantwort')
assert.equal(kaputt.dateien.gesichert, null, 'eine Fehlerantwort wird nicht gesichert')
assert.equal(kaputt.sichernOhne.status, 503, 'auch mit OHNE')
console.log('meldungen-stapel.test: 14 Zusicherungen grün.')
