/**
 * Tests des Kennungsschnitts (`pr-nachrechnen-kennung.mjs`, 13.11.2026, F133): reine Funktionen, die Entscheidung in `bewegtesGelesen`
 * und der ganze Weg über `gitLeser` mit echtem git im Wegwerf-Repo (PR 3618: eine Zeile in data/dub-confirmed.yaml, main bewegt nur Werkzeuge).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BAU_PFAD, ersteNennung, handdatenPr, kennungenAus, kennungenInZeile, kennungsschnitt } from './pr-nachrechnen-kennung.mjs'
import { gitAufruf, gitLeser } from './pr-nachrechnen-leser-git.mjs'
import { bewegtesGelesen, ohneLeser } from './pr-nachrechnen-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Kennungen lesen
const z = (text) => kennungenInZeile(text).join()
pruefe('AniList-ID, auch einstellig, am Schlüssel anilistId', z('+- anilistId: 1663') === '1663' && z('+  anilistId: 21') === '21')
pruefe('Slug und Release-ID, in Flow-Schreibweise und mit Anführungszeichen', z('+- slug: blue-exorcist-vol1') === 'blue-exorcist-vol1' && z("+{ releaseId: 'abc-123', platform: x }") === 'abc-123')
pruefe('ASIN im Text und in der Adresse', z('+  buyUrl: https://www.amazon.de/dp/B0CXYZ1234?tag=x') === 'B0CXYZ1234' && z('+note: B0ABCDEFGH ist es') === 'B0ABCDEFGH')
pruefe('AniList-Adresse', z('+  url: https://anilist.co/anime/98765/Titel') === '98765')
pruefe('keine Kennung: Wahrheitswert, kurzer id-Wert, Datum, Titel, Notiz', z('+  dub: true') === '' && z('+  id: 7') === '' && z("+  checkedAt: '2026-11-13'") === '' && z('+  title: Naruto') === '' && z('+  note: gesehen') === '')
const diff = 'diff --git a/data/x.yaml b/data/x.yaml\n--- a/data/x.yaml\n+++ b/data/x.yaml\n@@ -1,0 +2,2 @@\n+- anilistId: 777\n+  dub: true\n-- anilistId: 888\n'
pruefe('kennungenAus: geänderte Zeilen, + und -, Dateikopf zählt nicht', [...kennungenAus(diff)].sort().join() === '777,888', [...kennungenAus(diff)])
// main-Diff durchsuchen
const md = 'diff --git a/data/kanal-seiten.json b/data/kanal-seiten.json\n--- a/data/kanal-seiten.json\n+++ b/data/kanal-seiten.json\n@@ -1 +1 @@\n-"a": 1120\n+"a": 1121, "id": 777\n'
pruefe('ersteNennung: ganze Zahl in geänderter Zeile', ersteNennung(md, new Set(['777']))?.datei === 'data/kanal-seiten.json')
pruefe('ersteNennung: Teil einer längeren Zahl oder eines Slugs trifft nicht', ersteNennung(md, new Set(['112'])) === null && ersteNennung(md, new Set(['77'])) === null && ersteNennung('+x-777\n+777-y\n+a777\n', new Set(['777'])) === null)
pruefe('ersteNennung: Kennung im Dateipfad', ersteNennung('diff --git a/data/cover/blue-exorcist-vol1.json b/data/cover/blue-exorcist-vol1.json\n', new Set(['blue-exorcist-vol1']))?.datei === 'data/cover/blue-exorcist-vol1.json')
pruefe('ersteNennung: Sonderzeichen im Slug werden maskiert', ersteNennung('+a.b\n', new Set(['a.b']))?.kennung === 'a.b' && ersteNennung('+axb\n', new Set(['a.b'])) === null)
pruefe('ersteNennung: unveränderte Zeilen und Dateikopf-Zeilen zählen nicht', ersteNennung(' kontext 777\n--- a/777\n+++ b/777\n', new Set(['777'])) === null)

// Entscheidung
const K = { kennungen: new Set(['777']), mainDiff: md.replace('777', '999') }
pruefe('fremde Kennung, kein Bau-Code -> aktuell', kennungsschnitt(['tools/cover-vorschau.mjs', 'data/kanal-seiten.json'], K) === null)
pruefe('gleiche Kennung im main-Diff -> Grund mit Kennung und Datei', /^main nennt 777 in data\/kanal-seiten\.json/.test(kennungsschnitt(['data/kanal-seiten.json'], { ...K, mainDiff: md }) ?? ''))
for (const bau of ['pipeline/build.ts', 'pipeline/bau/09-4-crunchyroll-dub.ts', 'shared/logic.ts']) {
  pruefe(`Bau-Code ${bau} bewegt -> Grund`, /Code des Baus/.test(kennungsschnitt([bau], K) ?? ''), kennungsschnitt([bau], K))
}
pruefe('Namensvettern des Bau-Pfads zählen nicht', ['pipeline/build.test.ts', 'pipeline/baumeister.ts', 'pipeline/lib/x.ts', 'shared/logic-hilfe.ts', 'shared/time.ts'].every((b) => !BAU_PFAD.test(b)))
pruefe('keine Kennung im PR-Diff lesbar -> Grund (fail-closed)', /nicht lesbar/.test(kennungsschnitt(['tools/x.mjs'], { kennungen: new Set(), mainDiff: '' }) ?? ''))
pruefe('handdatenPr: YAML unter data/, auch mit Doku und Patch Notes; Code, JSON, package.json nicht', handdatenPr(['data/dub-confirmed.yaml', 'docs/a.md', 'data/patchnotes/x.yaml'], ohneLeser) && handdatenPr(['data/curated/tv-2026.yaml'], ohneLeser) && !handdatenPr(['data/dub-confirmed.yaml', 'tools/a.mjs'], ohneLeser) && !handdatenPr(['data/a.json'], ohneLeser) && !handdatenPr(['data/a.yaml', 'package.json'], ohneLeser) && !handdatenPr(['docs/a.md'], ohneLeser))

// In bewegtesGelesen: der Anlass der bisherigen Auflage (Bau-Leser nennt die bewegte Datei, PR ändert Handdaten) und seine Grenzen
const BEWEGT = 'data/kanal-seiten.json'
const LESER = ['pipeline/lib/leser.ts']
const TEXTE = { 'pipeline/lib/leser.ts': `const d = '${BEWEGT}'\n` }
const lesen = (pr, extra) => bewegtesGelesen({ bewegt: [BEWEGT], pr, leser: LESER, lies: (p) => TEXTE[p] ?? null, paketSkripte: null, ...extra })
const HAND = ['data/dub-confirmed.yaml']
pruefe('ohne Kennungsdaten bleibt die bisherige Auflage: Handdaten + Bau-Leser der bewegten Datei -> Grund', /^der PR ändert data\/dub-confirmed\.yaml/.test(lesen(HAND) ?? ''))
pruefe('mit Kennungsdaten ohne Schnitt -> aktuell', lesen(HAND, { kennung: K }) === null)
pruefe('mit Kennungsdaten und Schnitt -> Grund aus dem Kennungsschnitt', /^main nennt 777/.test(lesen(HAND, { kennung: { ...K, mainDiff: md } }) ?? ''))
pruefe('Kennungsdaten mit Fehler -> bisherige Auflage (Grund)', /^der PR ändert data\/dub-confirmed\.yaml/.test(lesen(HAND, { kennung: { fehler: 'x' } }) ?? ''))
pruefe('PR ändert zusätzlich Code -> kein Kennungsschnitt, bisherige Regeln', /^der PR ändert data\/dub-confirmed\.yaml/.test(lesen([...HAND, 'tools/neu.mjs'], { kennung: K }) ?? ''))
pruefe('PR berührt die bewegte Datei selbst -> Grund trotz Kennungsschnitt', /^der PR berührt data\/kanal-seiten\.json/.test(lesen(['data/kanal-seiten.json'], { kennung: K }) ?? ''))

// Ganzer Weg über gitLeser mit echtem git
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-kennung-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const schreibe = (repo, datei, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, datei)), { recursive: true })
  fs.writeFileSync(path.join(repo, datei), text)
}
const vorher = process.cwd()
try {
  const remote = path.join(wurzel, 'remote.git')
  const arbeit = path.join(wurzel, 'arbeit')
  git(wurzel, 'init', '-q', '--bare', remote)
  git(wurzel, 'init', '-q', '-b', 'main', arbeit)
  git(arbeit, 'remote', 'add', 'origin', remote)
  schreibe(arbeit, 'pipeline/lib/leser.ts', `const d = '${BEWEGT}'\n`)
  schreibe(arbeit, 'pipeline/bau/phase.ts', 'export const p = 1\n')
  schreibe(arbeit, 'tools/cover-vorschau.mjs', 'export const c = 1\n')
  schreibe(arbeit, BEWEGT, '{"a": 1120}\n')
  schreibe(arbeit, 'data/dub-confirmed.yaml', '- anilistId: 1663\n  platform: youtube\n  dub: true\n')
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(arbeit, 'push', '-q', 'origin', 'main')
  const basis = git(arbeit, 'rev-parse', 'main')
  // PR 3618-Form: eine neue Zeile Handbeleg
  git(arbeit, 'checkout', '-q', '-b', 'pr')
  schreibe(arbeit, 'data/dub-confirmed.yaml', '- anilistId: 1663\n  platform: youtube\n  dub: true\n- anilistId: 777777\n  platform: netflix\n  dub: true\n')
  git(arbeit, 'commit', '-q', '-am', 'pr')
  const kopf = git(arbeit, 'rev-parse', 'pr')
  git(arbeit, 'push', '-q', 'origin', 'pr:refs/pull/7/head')
  process.chdir(arbeit)
  const leser = gitLeser(gitAufruf)
  /** main = Basis plus ein Commit; `aenderungen`: Pfad -> Text; liest wie der Dirigent, bewegt = die Pfade. */
  const mitMain = (aenderungen, extra = {}) => {
    git(arbeit, 'checkout', '-q', '-B', 'main', basis)
    for (const [datei, text] of Object.entries(aenderungen)) schreibe(arbeit, datei, text)
    git(arbeit, 'commit', '-q', '-am', 'main')
    git(arbeit, 'push', '-q', '-f', 'origin', 'main')
    return leser(Object.keys(aenderungen), HAND, { nummer: 7, kopf, main: git(arbeit, 'rev-parse', 'main'), basis, ...extra })
  }
  const werkzeug = { 'tools/cover-vorschau.mjs': 'export const c = 2\n' }
  const fremd = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1121, "b": 555}\n' })
  pruefe('echtes git (PR 3618): Handbeleg-PR, main bewegt Werkzeug und eine Datei mit fremder Kennung -> aktuell', fremd === null, fremd)
  const gleich = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1120, "c": 777777}\n' })
  pruefe('echtes git: dieselbe AniList-ID im main-Diff -> Grund mit Kennung und Datei', /^main nennt 777777 in data\/kanal-seiten\.json/.test(gleich ?? ''), gleich)
  const bau = mitMain({ ...werkzeug, 'pipeline/bau/phase.ts': 'export const p = 2\n' })
  pruefe('echtes git: Code des Bau-Pfads bewegt -> Grund', /^main bewegte pipeline\/bau\/phase\.ts, Code des Baus/.test(bau ?? ''), bau)
  const bot = mitMain({ [BEWEGT]: '{"a": 1120, "c": 777777}\n' }, { bot: [BEWEGT] })
  pruefe('echtes git: bewegte Bot-Datei nennt die Kennung -> aktuell wie bisher (Bot-Dateien zählen nicht)', bot === null, bot)
  const beideAn = mitMain({ 'data/dub-confirmed.yaml': '- anilistId: 555\n  platform: x\n  dub: true\n- anilistId: 1663\n  platform: youtube\n  dub: true\n' }, { frei: new Set(HAND) })
  pruefe('echtes git: main und PR ändern dieselbe Handdatei an verschiedenen Stellen (Textmerge frei), andere Kennung -> aktuell', beideAn === null, beideAn)
  const anfasser =mitMain({ 'data/dub-confirmed.yaml': '- anilistId: 1663\n  platform: youtube\n  dub: false\n' })
  pruefe('echtes git: main ändert dieselbe Handdatei -> Grund „der PR berührt“', /^der PR berührt data\/dub-confirmed\.yaml/.test(anfasser ?? ''), anfasser)
  const ohneBasis = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1121, "b": 555}\n' }, { basis: '0'.repeat(40) })
  pruefe('echtes git: Kettenbasis nicht abrufbar -> bisherige Auflage (Grund)', /^der PR ändert data\/dub-confirmed\.yaml/.test(ohneBasis ?? ''), ohneBasis)
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-kennung.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-kennung.test: grün')
