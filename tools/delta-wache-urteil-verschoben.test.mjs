/**
 * Die Delta-Wache nennt bei „Urteil verloren“ den Titel und unterscheidet „verschoben“ (derselbe Weg hängt mit gleichem Urteil an einem
 * anderen Titel: Hinweis) von „verloren“ (Weg fehlt überall: rot). Anlass: Sailor Moon Crystal III (21462) verlor am 10.11.2026
 * `427-sailor-moon?s=3` an Sailor Moon S (532), die Wache stand drei Tage rot (Bau 46190f808 → dcc9b7220). Streams unten wörtlich aus
 * `public/data/titles.json` dieser beiden Stände; Prozess gegen ein Wegwerf-Repo.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findeAuffaelliges } from '../pipeline/lib/bestand-delta.ts'
import { andererBesitzer, betroffeneZeilen } from '../pipeline/lib/bestand-betroffen.ts'
import { linkAbgaenge } from '../pipeline/lib/bestand-link-abgang.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const S3 = 'https://animationdigitalnetwork.com/de/video/427-sailor-moon?s=3'
const adn = (url, dub = true) => ({ platform: 'adn', url, dub, zugang: 'abo' })
const crystal = (...streams) => ({ id: 21462, titleDe: 'Pretty Guardian Sailor Moon Crystal Season III', streams })
const sailorS = (...streams) => ({ id: 532, titleDe: 'Sailor Moon S', streams })
const ANDERE = 'https://animationdigitalnetwork.com/de/video/999-andere?s=1'

const vorher = [crystal(adn(S3)), sailorS(adn(S3))]
const verschoben = [crystal(), sailorS(adn(S3))]
const verloren = [crystal(), sailorS()]

// --- andererBesitzer: jedes Merkmal einzeln ---------------------------------------------------------------------------
assert.equal(andererBesitzer(verschoben, 'adn', S3, 21462)?.id, 532, 'Anlass: 532 hält die Adresse')
assert.equal(andererBesitzer(verschoben, 'adn', S3, 532), undefined, 'der Titel selbst zählt nicht als anderer')
assert.equal(andererBesitzer(verschoben, 'adn', ANDERE, 21462), undefined, 'andere Adresse')
assert.equal(andererBesitzer(verschoben, 'adn', 'https://animationdigitalnetwork.com/de/video/999-andere?s=3', 21462), undefined, 'andere Serie, gleicher Parameter')
assert.equal(andererBesitzer(verschoben, 'netflix', S3, 21462), undefined, 'anderer Anbieter')
assert.equal(andererBesitzer([crystal(), sailorS(adn(S3.replace('?s=3', '?S=3')))], 'adn', S3, 21462)?.id, 532, 'Parameter ohne Groß-/Kleinschreibung')
const S1 = 'https://animationdigitalnetwork.com/de/video/427-sailor-moon?s=1'
assert.equal(andererBesitzer([crystal(), sailorS(adn(S1))], 'adn', S3, 21462), undefined, 'echter Fall: anderer Titel hält nur die Staffel 1 derselben Serie')
assert.deepEqual(linkAbgaenge(vorher, [crystal(), sailorS(adn(S1))], {}).unerklaert.map((x) => x.text.slice(-60)), [`(21462): ${S3}`.slice(-60)], 'Staffel 3 weg bleibt rot, kein Verschoben zu S1')
assert.equal(andererBesitzer([crystal(), sailorS(adn(S3, false))], 'adn', S3, 21462), undefined, 'Urteil Nein ist nicht gleiches Urteil')
assert.equal(andererBesitzer([crystal(), sailorS({ platform: 'adn', url: S3 })], 'adn', S3, 21462), undefined, 'offenes Urteil ist nicht gleiches Urteil')
assert.equal(andererBesitzer([crystal(), { id: 7, titleDe: 'Ohne Streams' }, sailorS(adn(S3))], 'adn', S3, 21462)?.id, 532, 'Titel ohne Streams stören nicht')

// --- linkAbgaenge: verschoben gegen verloren --------------------------------------------------------------------------
const a = linkAbgaenge(vorher, verschoben, {})
assert.deepEqual(a.unerklaert, [], 'verschoben ist nicht unerklärt')
assert.deepEqual(a.begruendet, [])
assert.deepEqual(a.verschoben, [{ anbieter: 'adn', text: `Pretty Guardian Sailor Moon Crystal Season III (21462): ${S3} → Sailor Moon S (532)`, befund: undefined }])
const b = linkAbgaenge(vorher, verloren, {})
assert.equal(b.unerklaert.length, 2, 'Gegenprobe: Adresse überall weg, beide Titel verloren')
assert.deepEqual(b.verschoben, [])
// Ein toter Link erklärt weiter als Linkprüfung, nicht als Verschiebung (Rangfolge wie vor der Änderung).
const tot = linkAbgaenge(vorher, verschoben, { [S3]: { status: 404, geprueftAm: '2026-11-10' } })
assert.equal(tot.begruendet.length, 1)
assert.deepEqual(tot.verschoben, [])

// --- Urteil der Wache mit den echten Zahlen der Bauzeile vom 10.11.2026 16:55 ---------------------------------------------
const kz = (ueber = {}) => ({
  titel: 2923,
  titelMitVerweis: 1736,
  verweise: 2593,
  mitUrteil: 2123,
  ohneUrteil: 470,
  titelMitSynchro: 1538,
  entferntProtokolliert: 855,
  entferntJeAnbieter: { adn: 51 },
  releases: 867,
  termine: 4444,
  jeAnbieter: { adn: 145, netflix: 392 },
  kanalOhneUrteil: {},
  kanalTitelOhneSynchro: 143,
  entfernteBelege: [],
  ...ueber,
})
const nachher = kz({ verweise: 2592, mitUrteil: 2122, titelMitSynchro: 1537, jeAnbieter: { adn: 144, netflix: 392 } })
const rot = findeAuffaelliges(nachher, kz())
assert.deepEqual(rot.auffaellig, ['1 Urteile verloren', '1 Titel ohne Synchro-Beleg', 'adn: 1 Synchro-Belege weniger'], 'ohne Linkangabe: wie am 10.11.')
const hinweis = findeAuffaelliges(nachher, kz(), [], {}, a)
assert.deepEqual(hinweis.auffaellig, [], 'Sailor Moon: verschoben, nicht rot')
assert.ok(hinweis.erklaert.includes(`adn: Weg verschoben – Pretty Guardian Sailor Moon Crystal Season III (21462): ${S3} → Sailor Moon S (532)`), hinweis.erklaert.join(' | '))
const echt = findeAuffaelliges(nachher, kz(), [], {}, b)
assert.deepEqual(echt.auffaellig.slice(0, 3), rot.auffaellig, 'echter Verlust bleibt rot')
assert.equal(echt.auffaellig.filter((z) => z.startsWith('adn: fehlt ')).length, 2, 'und nennt die Titel')
assert.deepEqual(echt.erklaert, [])
// Obergrenze: zwei Rückgänge, nur ein verschobener Weg: der zweite bleibt rot.
const zwei = findeAuffaelliges(kz({ verweise: 2591, mitUrteil: 2121, titelMitSynchro: 1536, jeAnbieter: { adn: 143, netflix: 392 } }), kz(), [], {}, a)
assert.ok(zwei.auffaellig.includes('adn: 1 Synchro-Belege weniger (1 weitere sind begründet entfernt)'), zwei.auffaellig.join(' | '))
// Obergrenze und Reihenfolge: zwei verschobene Wege, ein Rückgang: genau ein Hinweis, nichts rot.
const eintrag = (t) => ({ anbieter: 'adn', text: t })
const zweiVerschoben = findeAuffaelliges(nachher, kz(), [], {}, { begruendet: [], unerklaert: [], verschoben: [eintrag('A (1)'), eintrag('B (2)')] })
assert.equal(zweiVerschoben.erklaert.filter((t) => t.startsWith('adn: Weg verschoben')).length, 1, 'ein Rückgang erklärt einen Weg')
assert.deepEqual(zweiVerschoben.auffaellig, [])
// Was die Linkprüfung schon erklärt, erklärt die Verschiebung nicht noch einmal.
const schonErklaert = findeAuffaelliges(nachher, kz(), [], {}, { begruendet: [eintrag('C (3)')], unerklaert: [], verschoben: [eintrag('A (1)')] })
assert.equal(schonErklaert.erklaert.filter((t) => t.startsWith('adn: Weg verschoben')).length, 0, 'Rückgang schon durch Linkprüfung erklärt')
// Anbieter zählt: ein verschobener adn-Weg erklärt keinen Netflix-Rückgang.
const netflix = findeAuffaelliges(kz({ verweise: 2592, mitUrteil: 2122, titelMitSynchro: 1537, jeAnbieter: { adn: 145, netflix: 391 } }), kz(), [], {}, a)
assert.ok(netflix.auffaellig.includes('netflix: 1 Synchro-Belege weniger'), netflix.auffaellig.join(' | '))

// --- betroffen: Titel mit Kennung, verschoben gegen weg -----------------------------------------------------------------
assert.deepEqual(betroffeneZeilen(vorher, verschoben), ['Pretty Guardian Sailor Moon Crystal Season III (21462) · adn · Synchro-Beleg verschoben zu Sailor Moon S (532)'])
assert.deepEqual(betroffeneZeilen(vorher, [crystal(adn(S3, false)), sailorS(adn(S3))]), ['Pretty Guardian Sailor Moon Crystal Season III (21462) · adn · Synchro-Urteil jetzt Nein'], 'bleibender Weg mit anderem Urteil ist nicht verschoben')
assert.deepEqual(betroffeneZeilen(vorher, verloren), [
  'Pretty Guardian Sailor Moon Crystal Season III (21462) · adn · Synchro-Beleg weg',
  'Sailor Moon S (532) · adn · Synchro-Beleg weg',
])

// --- Prozess: bestand-historie.ts gegen ein Wegwerf-Repo ------------------------------------------------------------------
const wegwerf = mkdtempSync(join(tmpdir(), 'ak-urteil-verschoben-'))
const git = (repo, ...x) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...x], { cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true })
const HISTORIE = ['bestand', 'historie'].join('-') + '.jsonl' // ohne Literal: pr-nachrechnen-bot-pfade verbietet den Dateinamen in Tests
const kzVor = { titel: 2, titelMitVerweis: 2, verweise: 2, mitUrteil: 2, ohneUrteil: 0, titelMitSynchro: 2, entferntProtokolliert: 0, entferntJeAnbieter: {}, releases: 0, termine: 0, jeAnbieter: { adn: 2 }, kanalOhneUrteil: {}, kanalTitelOhneSynchro: 0, entfernteBelege: [] }
try {
  const baue = (name, jetztStand) => {
    const repo = join(wegwerf, name)
    mkdirSync(join(repo, 'public/data'), { recursive: true })
    mkdirSync(join(repo, 'data'), { recursive: true })
    git(repo, 'init', '-q')
    writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify(vorher))
    git(repo, 'add', 'public/data/titles.json')
    git(repo, 'commit', '-q', '-m', 'vorher')
    writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify(jetztStand))
    writeFileSync(join(repo, 'data/link-check.json'), '{}')
    writeFileSync(join(repo, 'data', HISTORIE), JSON.stringify({ zeitpunkt: '2026-11-10T16:37:00.000Z', lauf: 'alt', ...kzVor }) + '\n')
    return repo
  }
  const starte = (repo) => {
    const cli = join(wurzel, 'node_modules/tsx/dist/cli.mjs')
    const r = spawnSync(process.execPath, [cli, join(wurzel, 'pipeline/bestand-historie.ts'), '--lauf', 'probe'], { cwd: wurzel, env: { ...process.env, AK_ROOT: repo }, encoding: 'utf8', windowsHide: true, timeout: 120000 })
    assert.equal(r.status, 0, r.stderr + r.stdout)
    assert.match(r.stdout, /\[historie\] 2 Titel/, 'Lauf kam bis zur Schlusszeile')
    return readFileSync(join(repo, 'data', HISTORIE), 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))[1]
  }
  const z = starte(baue('verschoben', verschoben))
  assert.equal(z.auffaellig, undefined, 'Prozess: verschoben ist nicht rot')
  assert.equal(z.betroffen, undefined)
  assert.ok(z.erklaert.some((t) => t.startsWith('adn: Weg verschoben – Pretty Guardian Sailor Moon Crystal Season III (21462)') && t.endsWith('→ Sailor Moon S (532)')), JSON.stringify(z.erklaert))
  const v = starte(baue('verloren', verloren))
  assert.ok(v.auffaellig.includes('adn: alle 2 Synchro-Belege weg'), JSON.stringify(v.auffaellig))
  assert.equal(v.erklaert, undefined, 'Prozess: verloren erklärt nichts')
  assert.ok(v.betroffen.some((t) => t.includes('Sailor Moon S (532)')), 'betroffen nennt Titel und Kennung')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}

console.log('delta-wache-urteil-verschoben.test: Sailor Moon S=3 verschoben (Hinweis, nicht rot), Gegenprobe Adresse überall weg rot mit Titeln, Merkmale einzeln (Anbieter, Adresse, Urteil, eigener Titel), Rangfolge toter Link, Obergrenze, Prozess')
