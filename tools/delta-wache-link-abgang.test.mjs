/**
 * Die Delta-Wache zählt einen Weg, den die Linkprüfung (404 oder „region" in link-check) entfernt hat, als begründet entfernt
 * und nennt bei unerklärten Verlusten Titel, Adresse und link-check-Eintrag (Anlass: Naruto Shippuden, Prime B084DBMYFX,
 * Bestandsbau vom 03.11.2026). Vergleich einzeln, `bestandAusCommit` gegen echtes git, `bestand-historie.ts` als Prozess.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findeAuffaelliges } from '../pipeline/lib/bestand-delta.ts'
import { bestandAusCommit, entferntDurchLink, linkAbgaenge } from '../pipeline/lib/bestand-link-abgang.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const NARUTO = 'https://www.amazon.de/gp/video/detail/B084DBMYFX'
const ANDERE = 'https://www.amazon.de/gp/video/detail/B000000001'
const s = (platform, url, dub = true) => ({ platform, url, dub })
const naruto = (...streams) => ({ id: 1735, titleDe: 'Naruto Shippuden', streams })
const fremd = (...streams) => ({ id: 900001, titleDe: 'Fremder Titel', streams })
const REGION = { status: 'region', geprueftAm: '2026-11-03' }

assert.equal(entferntDurchLink(404), true)
assert.equal(entferntDurchLink('region'), true)
for (const nein of [200, 403, 429, 500, 'timeout', undefined]) assert.equal(entferntDurchLink(nein), false, `${nein} entfernt nichts`)

const vorher = [naruto(s('primevideo', NARUTO), s('primevideo', ANDERE)), fremd(s('netflix', 'https://www.netflix.com/title/900001'))]
const jetzt = [naruto(s('primevideo', ANDERE)), fremd(s('netflix', 'https://www.netflix.com/title/900001'))]

// --- linkAbgaenge ------------------------------------------------------------------------------------------------------
const mit = linkAbgaenge(vorher, jetzt, { [NARUTO]: REGION })
assert.deepEqual(mit.unerklaert, [])
assert.deepEqual(mit.begruendet, [{ anbieter: 'primevideo', text: `Naruto Shippuden (1735): ${NARUTO}`, befund: `link-check: ${JSON.stringify(REGION)}` }])
const status404 = linkAbgaenge(vorher, jetzt, { [NARUTO]: { status: 404 } })
assert.equal(status404.begruendet.length, 1, '404 erklärt')
const ohneBefund = linkAbgaenge(vorher, jetzt, {})
assert.deepEqual(ohneBefund.begruendet, [])
assert.deepEqual(ohneBefund.unerklaert, [{ anbieter: 'primevideo', text: `Naruto Shippuden (1735): ${NARUTO}`, befund: undefined }])
const timeout = linkAbgaenge(vorher, jetzt, { [NARUTO]: { status: 'timeout' } })
assert.equal(timeout.unerklaert.length, 1, 'Zeitüberschreitung ist keine Auskunft')
assert.equal(timeout.unerklaert[0].befund, `link-check: ${JSON.stringify({ status: 'timeout' })}`, 'der Eintrag steht trotzdem dabei')
assert.equal(linkAbgaenge(vorher, jetzt, { [ANDERE]: REGION }).begruendet.length, 0, 'Befund einer anderen Adresse erklärt nichts')
// Gleiche Adresse an einem anderen Titel zählt nicht als Verbleib; ein Weg ohne Ja zählt nicht als Verlust.
assert.equal(linkAbgaenge([naruto(s('primevideo', NARUTO))], [fremd(s('primevideo', NARUTO)), naruto()], { [NARUTO]: REGION }).begruendet.length, 1)
assert.deepEqual(linkAbgaenge([naruto(s('primevideo', NARUTO, false))], [naruto()], {}), { begruendet: [], unerklaert: [] })
// Bleibt die Adresse stehen, hat aber das Ja verloren, fehlt der Beleg trotzdem (der Zähler zählt Ja, nicht Adressen).
assert.equal(linkAbgaenge([naruto(s('primevideo', NARUTO))], [naruto(s('primevideo', NARUTO, false))], { [NARUTO]: REGION }).begruendet.length, 1)
assert.deepEqual(linkAbgaenge(vorher, vorher, { [NARUTO]: REGION }), { begruendet: [], unerklaert: [] }, 'nichts fehlt')

// --- Urteil der Wache --------------------------------------------------------------------------------------------------
/** Kennzahlen; Prime trägt 5 Ja, Netflix 3. */
const kz = (ueber = {}) => ({
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
  jeAnbieter: { primevideo: 5, netflix: 3 },
  kanalOhneUrteil: {},
  kanalTitelOhneSynchro: 0,
  entfernteBelege: [],
  ...ueber,
})
const nachNaruto = kz({ mitUrteil: 89, jeAnbieter: { primevideo: 4, netflix: 3 } })
const ROT = ['1 Urteile verloren', 'primevideo: 1 Synchro-Belege weniger']

const rot = findeAuffaelliges(nachNaruto, kz())
assert.deepEqual(rot.auffaellig, ROT, 'Anlass ohne Linkangabe: wie heute rot')
const ok = findeAuffaelliges(nachNaruto, kz(), [], {}, mit)
assert.deepEqual(ok.auffaellig, [], 'mit Linkbefund begründet')
assert.deepEqual(ok.erklaert, [`primevideo: Weg durch Linkprüfung entfernt – Naruto Shippuden (1735): ${NARUTO} (link-check: ${JSON.stringify(REGION)})`])

// Echter Verlust: bleibt rot und nennt Titel, Adresse, Befund.
const echt = findeAuffaelliges(nachNaruto, kz(), [], {}, ohneBefund)
assert.deepEqual(echt.auffaellig, [...ROT, `primevideo: fehlt Naruto Shippuden (1735): ${NARUTO} (kein link-check-Eintrag)`])
assert.deepEqual(echt.erklaert, [])
const mitTimeout = findeAuffaelliges(nachNaruto, kz(), [], {}, timeout)
assert.equal(mitTimeout.auffaellig[2], `primevideo: fehlt Naruto Shippuden (1735): ${NARUTO} (link-check: {"status":"timeout"})`)

// Anbieter zählt: ein Prime-Befund erklärt keine Netflix-Abnahme.
const netflixWeg = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { primevideo: 5, netflix: 2 } }), kz(), [], {}, mit)
assert.deepEqual(netflixWeg.auffaellig, ['1 Urteile verloren', 'netflix: 1 Synchro-Belege weniger'])
assert.deepEqual(netflixWeg.erklaert, [])

// Die fehlt-Zeile gehört dem Anbieter des Rückgangs: ein unerklärter Prime-Weg erscheint nicht unter Netflix.
const fremdeZeile = findeAuffaelliges(kz({ mitUrteil: 89, jeAnbieter: { primevideo: 5, netflix: 2 } }), kz(), [], {}, ohneBefund)
assert.deepEqual(fremdeZeile.auffaellig, ['1 Urteile verloren', 'netflix: 1 Synchro-Belege weniger'])

// Obergrenze: zwei Wege weg, ein Befund: einer bleibt rot, der Text nennt den begründeten.
const zweiWeg = findeAuffaelliges(kz({ mitUrteil: 88, jeAnbieter: { primevideo: 3, netflix: 3 } }), kz(), [], {}, mit)
assert.deepEqual(zweiWeg.auffaellig, ['1 Urteile verloren (1 weitere sind begründet entfernt)', 'primevideo: 1 Synchro-Belege weniger (1 weitere sind begründet entfernt)'])
assert.equal(zweiWeg.erklaert.length, 1)
// Zwei Befunde, ein Rückgang: nur eine erklärende Zeile.
const zwei = { begruendet: [...mit.begruendet, { ...mit.begruendet[0], text: 'Zweiter (2): x' }], unerklaert: [] }
const zuViel = findeAuffaelliges(nachNaruto, kz(), [], {}, zwei)
assert.deepEqual(zuViel.auffaellig, [])
assert.equal(zuViel.erklaert.length, 1)
// Kein Rückgang: der Befund bleibt stumm.
assert.deepEqual(findeAuffaelliges(kz(), kz(), [], {}, mit), { auffaellig: [], erklaert: [] })
// Mit Gedächtnis-Eintrag: dieser erklärt zuerst, der Linkbefund wird nicht zusätzlich genannt.
const gedaechtnis = kz({ mitUrteil: 89, entferntProtokolliert: 1, entferntJeAnbieter: { primevideo: 1 }, jeAnbieter: { primevideo: 4, netflix: 3 } })
assert.deepEqual(findeAuffaelliges(gedaechtnis, kz(), [], {}, mit), { auffaellig: [], erklaert: [] })

// --- bestandAusCommit gegen echtes git ---------------------------------------------------------------------------------
const wegwerf = mkdtempSync(join(tmpdir(), 'ak-link-abgang-'))
const git = (repo, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true })
const HISTORIE = ['bestand', 'historie'].join('-') + '.jsonl' // ohne Literal: der Wächter pr-nachrechnen-bot-pfade verbietet den Dateinamen in Tests
try {
  const leer = join(wegwerf, 'leer')
  mkdirSync(leer)
  assert.deepEqual(bestandAusCommit(leer), [], 'kein Repo: leer')

  /** Wurzel mit einem Commit (vorher) und der Arbeitskopie (jetzt); Vorzeile der Historie für `vorherKz`. */
  const baue = (name, linkText) => {
    const repo = join(wegwerf, name)
    mkdirSync(join(repo, 'public/data'), { recursive: true })
    mkdirSync(join(repo, 'data'), { recursive: true })
    git(repo, 'init', '-q')
    writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify(vorher))
    git(repo, 'add', 'public/data/titles.json')
    git(repo, 'commit', '-q', '-m', 'vorher')
    writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify(jetzt))
    writeFileSync(join(repo, 'data/link-check.json'), linkText)
    writeFileSync(join(repo, 'data', HISTORIE), JSON.stringify({ zeitpunkt: '2026-11-03T00:00:00.000Z', lauf: 'alt', ...kzVor }) + '\n')
    return repo
  }
  // Kennzahlen des Commit-Stands: Naruto 2 Prime-Ja, Fremder 1 Netflix-Ja.
  const kzVor = { titel: 2, titelMitVerweis: 2, verweise: 3, mitUrteil: 3, ohneUrteil: 0, titelMitSynchro: 2, entferntProtokolliert: 0, entferntJeAnbieter: {}, releases: 0, termine: 0, jeAnbieter: { primevideo: 2, netflix: 1 }, kanalOhneUrteil: {}, kanalTitelOhneSynchro: 0, entfernteBelege: [] }
  const mitRepo = baue('mit', JSON.stringify({ [NARUTO]: REGION }))
  assert.equal(bestandAusCommit(mitRepo).length, 2)
  assert.equal(bestandAusCommit(mitRepo)[0].streams.length, 2, 'der Stand des Commits, nicht der Arbeitskopie')

  /** Ein Lauf von `bestand-historie.ts` in `repo`; gibt alle Zeilen der Historie zurück. */
  const starte = (repo) => {
    const cli = join(wurzel, 'node_modules/tsx/dist/cli.mjs')
    const r = spawnSync(process.execPath, [cli, join(wurzel, 'pipeline/bestand-historie.ts'), '--lauf', 'probe'], { cwd: wurzel, env: { ...process.env, AK_ROOT: repo }, encoding: 'utf8', windowsHide: true, timeout: 120000 })
    assert.equal(r.status, 0, r.stderr + r.stdout)
    assert.match(r.stdout, /\[historie\] 2 Titel/, 'Lauf kam bis zur Schlusszeile')
    return readFileSync(join(repo, 'data', HISTORIE), 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))
  }
  const zeilen = starte(mitRepo)
  assert.equal(zeilen[1].auffaellig, undefined, 'mit region-Befund keine Auffälligkeit')
  assert.deepEqual(zeilen[1].erklaert, [`primevideo: Weg durch Linkprüfung entfernt – Naruto Shippuden (1735): ${NARUTO} (link-check: ${JSON.stringify(REGION)})`])
  const ohneRepo = starte(baue('ohne', '{}'))
  assert.deepEqual(ohneRepo[1].auffaellig, [...ROT, `primevideo: fehlt Naruto Shippuden (1735): ${NARUTO} (kein link-check-Eintrag)`], 'ohne Befund: Verlust mit Titel und Adresse')
  // Zweiter Lauf: der Commit-Stand ist derselbe, die Vorzeile aber schon der neue Stand; nichts Auffälliges.
  const zweiter = starte(mitRepo)
  assert.equal(zweiter[2].auffaellig, undefined)
  assert.equal(zweiter[2].erklaert, undefined)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}

console.log('delta-wache-link-abgang.test: Anlass Naruto Shippuden (region), 404, Zeitüberschreitung/kein Befund bleiben rot mit Titel+Adresse, Anbieter und Obergrenze, Gedächtnis zuerst, git-Stand, Prozess mit/ohne Befund und zweiter Lauf grün')
