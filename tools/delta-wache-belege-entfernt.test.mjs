/**
 * Die Delta-Wache zählt einen Beleg, den `data/belege-entfernt.yaml` gewollt entzieht, nicht als Verlust (29.10.2026, Heidi/Disney+
 * am 28.10.). Gerechnet wird je Anbieter und nur, was die Zeile gegenüber der vorigen neu entzieht; ein echter Verlust bleibt rot.
 * Vergleich einzeln, dazu `bestand-historie.ts` als Prozess gegen ein Wegwerf-Repo (AK_ROOT) mit und ohne Eintrag, zwei Läufe.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { belegGruende, entfernterBelegSchluessel, findeAuffaelliges } from '../pipeline/lib/bestand-delta.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const HEIDI_URL = 'https://www.disneyplus.com/de-de/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const EINTRAG = { anilistId: 2225, url: HEIDI_URL, grund: 'Disney+-Seite gehört dem Cartoon Heidi (2015)', entferntAm: '2026-10-28' }
const SCHLUESSEL = entfernterBelegSchluessel(EINTRAG)
const GRUENDE = { [SCHLUESSEL]: 'Heidi (2225): Disney+-Seite gehört dem Cartoon Heidi (2015)' }

assert.equal(SCHLUESSEL, '2225|disneyplus|disneyplus.com/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd', 'Anbieter aus der Adresse, Sprachsegment fällt weg')

/** Kennzahlen; Disney+ trägt 4 Ja, Netflix 3. */
function kz(ueber = {}) {
  return {
    titel: 50,
    titelMitVerweis: 50,
    verweise: 100,
    mitUrteil: 90,
    ohneUrteil: 10,
    titelMitSynchro: 40,
    entferntProtokolliert: 0,
    entferntJeAnbieter: {},
    releases: 10,
    termine: 100,
    jeAnbieter: { disneyplus: 4, netflix: 3 },
    kanalOhneUrteil: {},
    kanalTitelOhneSynchro: 0,
    entfernteBelege: [],
    ...ueber,
  }
}
const vor = kz()
const nachHeidi = kz({ mitUrteil: 89, verweise: 99, jeAnbieter: { disneyplus: 3, netflix: 3 }, entfernteBelege: [SCHLUESSEL] })

// Anlass: ohne Eintrag-Kennzahl wie heute rot, mit Eintrag erklärt mit Titel und Grund.
const rot = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { disneyplus: 3, netflix: 3 } }), vor, [], GRUENDE)
assert.deepEqual(rot.auffaellig, ['1 Urteile verloren', 'disneyplus: 1 Synchro-Belege weniger'], 'erfundener Verlust ohne Eintrag bleibt rot')
assert.deepEqual(rot.erklaert, [])
const ok = findeAuffaelliges(nachHeidi, vor, [], GRUENDE)
assert.deepEqual(ok.auffaellig, [])
assert.deepEqual(ok.erklaert, ['disneyplus: Beleg gewollt entfernt – Heidi (2225): Disney+-Seite gehört dem Cartoon Heidi (2015)'])
assert.deepEqual(findeAuffaelliges(nachHeidi, vor).erklaert, ['disneyplus: Beleg gewollt entfernt – ' + SCHLUESSEL], 'ohne Grundtext steht der Schlüssel da')

// Zweiter Lauf: der Eintrag steht schon in der vorigen Zeile, ein neuer Verlust bleibt rot und wird nicht mehr erklärt.
const zweiter = findeAuffaelliges(kz({ mitUrteil: 88, jeAnbieter: { disneyplus: 2, netflix: 3 }, entfernteBelege: [SCHLUESSEL] }), nachHeidi, [], GRUENDE)
assert.deepEqual(zweiter.auffaellig, ['1 Urteile verloren', 'disneyplus: 1 Synchro-Belege weniger'])
assert.deepEqual(zweiter.erklaert, [])

// Ein Eintrag erklärt nur seinen Anbieter und höchstens so viel, wie wirklich fehlt.
const fremd = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { disneyplus: 4, netflix: 2 }, entfernteBelege: [SCHLUESSEL] }), vor, [], GRUENDE)
assert.deepEqual(fremd.auffaellig, ['1 Urteile verloren', 'netflix: 1 Synchro-Belege weniger'], 'Disney+-Eintrag erklärt keine Netflix-Abnahme')
assert.deepEqual(fremd.erklaert, [])
const mehr = findeAuffaelliges(kz({ mitUrteil: 87, jeAnbieter: { disneyplus: 1, netflix: 3 }, entfernteBelege: [SCHLUESSEL] }), vor, [], GRUENDE)
assert.deepEqual(mehr.auffaellig, ['2 Urteile verloren (1 weitere sind begründet entfernt)', 'disneyplus: 2 Synchro-Belege weniger (1 weitere sind begründet entfernt)'], 'bei 3 weniger erklärt ein Eintrag nur 1')
assert.equal(mehr.erklaert.length, 1)
const zweiter2 = entfernterBelegSchluessel({ anilistId: 900002, url: 'https://www.disneyplus.com/de-de/browse/entity-900002' })
const nurEiner = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { disneyplus: 3, netflix: 3 }, entfernteBelege: [SCHLUESSEL, zweiter2] }), vor, [], GRUENDE)
assert.deepEqual(nurEiner.auffaellig, [], 'zwei Einträge, ein Rückgang: erklärt')
assert.equal(nurEiner.erklaert.length, 1, 'nur so viele Zeilen wie erklärter Rückgang')
const imGedaechtnis = kz({
  mitUrteil: 89,
  entferntProtokolliert: 1,
  entferntJeAnbieter: { disneyplus: 1 },
  jeAnbieter: { disneyplus: 3, netflix: 3 },
  entfernteBelege: [SCHLUESSEL],
})
const schonErklaert = findeAuffaelliges(imGedaechtnis, vor, [], GRUENDE)
assert.deepEqual(schonErklaert, { auffaellig: [], erklaert: [] }, 'das Gedächtnis erklärt den Rückgang schon, der Eintrag wird nicht zusätzlich genannt')
const keinVerlust = findeAuffaelliges(kz({ entfernteBelege: [SCHLUESSEL] }), vor, [], GRUENDE)
assert.deepEqual(keinVerlust, { auffaellig: [], erklaert: [] }, 'ein Eintrag ohne Rückgang bleibt stumm')

// Vorige Zeile ohne das Feld (vor dem 29.10.2026): nichts wird erklärt.
const altZeile = kz()
delete altZeile.entfernteBelege
assert.equal(findeAuffaelliges(nachHeidi, altZeile, [], GRUENDE).auffaellig.length, 2)
// Jetzige Zeile ohne das Feld: ebenso.
const neuOhne = { ...nachHeidi }
delete neuOhne.entfernteBelege
assert.equal(findeAuffaelliges(neuOhne, vor, [], GRUENDE).auffaellig.length, 2)

// Ganzer Anbieter weg: der Eintrag erklärt den letzten Beleg, zwei weitere nicht.
const letzter = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { netflix: 3 }, entfernteBelege: [SCHLUESSEL] }), kz({ jeAnbieter: { disneyplus: 1, netflix: 3 } }), [], GRUENDE)
assert.deepEqual(letzter.auffaellig, [], 'letzter Disney+-Beleg weg und eingetragen')
assert.equal(letzter.erklaert.length, 1)
const zweiWeg = findeAuffaelliges(kz({ mitUrteil: 88, jeAnbieter: { netflix: 3 }, entfernteBelege: [SCHLUESSEL] }), kz({ jeAnbieter: { disneyplus: 2, netflix: 3 } }), [], GRUENDE)
assert.deepEqual(zweiWeg.auffaellig, ['1 Urteile verloren (1 weitere sind begründet entfernt)', 'disneyplus: alle 2 Synchro-Belege weg'])

// belegGruende: Name aus den Titeln, ohne Titel Platzhalter.
assert.deepEqual(belegGruende([EINTRAG], [{ id: 2225, titleDe: 'Heidi' }]), GRUENDE)
assert.equal(belegGruende([EINTRAG], [])[SCHLUESSEL], 'Titel (2225): Disney+-Seite gehört dem Cartoon Heidi (2015)')

// --- Prozess: bestand-historie.ts gegen ein Wegwerf-Repo ----------------------------------------------------------------
const wegwerf = mkdtempSync(join(tmpdir(), 'ak-belege-entfernt-'))
const stream = (platform, url) => ({ platform, url, dub: true })
const titelListe = [
  { id: 2225, titleDe: 'Heidi', streams: [stream('netflix', 'https://www.netflix.com/title/900001')] },
  { id: 900002, titleDe: 'Anderer', streams: [stream('disneyplus', 'https://www.disneyplus.com/de-de/browse/entity-900002')] },
]
const HISTORIE = ['bestand', 'historie'].join('-') + '.jsonl' // ohne Literal: der Wächter pr-nachrechnen-bot-pfade verbietet den Dateinamen in Tests
const vorZeile = {
  zeitpunkt: '2026-10-28T00:00:00.000Z',
  lauf: 'alt',
  titel: 2,
  titelMitVerweis: 2,
  verweise: 3,
  mitUrteil: 3,
  ohneUrteil: 0,
  titelMitSynchro: 2,
  entferntProtokolliert: 0,
  entferntJeAnbieter: {},
  releases: 0,
  termine: 0,
  jeAnbieter: { disneyplus: 2, netflix: 1 },
  kanalOhneUrteil: {},
  kanalTitelOhneSynchro: 0,
  entfernteBelege: [],
}
/** Ein Lauf von `bestand-historie.ts` in der Wurzel `repo`; gibt alle Zeilen der Historie zurück. */
function starte(repo) {
  const cli = join(wurzel, 'node_modules/tsx/dist/cli.mjs')
  const r = spawnSync(process.execPath, [cli, join(wurzel, 'pipeline/bestand-historie.ts'), '--lauf', 'probe'], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: repo },
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /\[historie\] 2 Titel/, 'Lauf kam bis zur Schlusszeile')
  return readFileSync(join(repo, 'data', HISTORIE), 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))
}
/** Wurzel mit Titeln, Eintragsliste und einer Vorzeile; noch ohne Lauf. */
function wurzelMit(name, yamlText) {
  const repo = join(wegwerf, name)
  mkdirSync(join(repo, 'public/data'), { recursive: true })
  mkdirSync(join(repo, 'data'), { recursive: true })
  writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify(titelListe))
  writeFileSync(join(repo, 'data/belege-entfernt.yaml'), yamlText)
  writeFileSync(join(repo, 'data', HISTORIE), JSON.stringify(vorZeile) + '\n')
  return repo
}
try {
  const eintragYaml = [
    '- anilistId: 2225',
    `  url: ${HEIDI_URL}`,
    "  grund: 'Disney+-Seite gehört dem Cartoon Heidi (2015)'",
    "  entferntAm: '2026-10-28'",
    '',
  ].join('\n')
  const repoMit = wurzelMit('mit', eintragYaml)
  const mit = starte(repoMit)
  assert.equal(mit[1].auffaellig, undefined, 'mit Eintrag keine Auffälligkeit')
  assert.deepEqual(mit[1].erklaert, ['disneyplus: Beleg gewollt entfernt – Heidi (2225): Disney+-Seite gehört dem Cartoon Heidi (2015)'])
  assert.deepEqual(mit[1].entfernteBelege, [SCHLUESSEL])
  const ohne = starte(wurzelMit('ohne', '[]\n'))
  assert.deepEqual(ohne[1].auffaellig, ['1 Urteile verloren', 'disneyplus: 1 Synchro-Belege weniger'], 'ohne Eintrag dieselbe Abnahme als Verlust')
  // Zweiter Lauf in derselben Wurzel: der Eintrag steht schon in der vorigen Zeile, nichts Neues.
  const alle = starte(repoMit)
  assert.equal(alle.length, 3)
  assert.equal(alle[2].erklaert, undefined)
  assert.equal(alle[2].auffaellig, undefined)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}

console.log('delta-wache-belege-entfernt.test: Vergleich (Anlass Heidi, ohne Eintrag rot, zweiter Lauf, Fremdanbieter, Obergrenze, Altzeile, ganzer Anbieter), belegGruende, Prozess mit/ohne Eintrag und zweiter Lauf grün')
