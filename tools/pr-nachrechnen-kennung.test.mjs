/**
 * Tests des Kennungsschnitts (`pr-nachrechnen-kennung.mjs`, 13.11.2026, F133): reine Funktionen, die Entscheidung in `bewegtesGelesen`
 * und der ganze Weg über `gitLeser` mit echtem git im Wegwerf-Repo (PR 3618: eine Zeile in data/dub-confirmed.yaml, main bewegt nur Werkzeuge).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BAU_PFAD, eintragsKennungen, ersteNennung, handdatenDateien, handdatenSchnitt, kennungenAus, kennungenInZeile, kennungenMitEintrag, kennungsschnitt } from './pr-nachrechnen-kennung.mjs'
import { gitAufruf, gitLeser } from './pr-nachrechnen-leser-git.mjs'
import { bewegtesGelesen, ohneLeser } from './pr-nachrechnen-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Importzyklus-Probe: jedes Modul der Familie lässt sich allein als Einstieg laden (13.11.2026: der Zyklus leser-git -> kennung -> textmerge -> leser-git
// brach nur den Start über pr-nachrechnen.mjs, kein Einzeltest sah es). Die Probe importiert in einem frischen Prozess, also in der Reihenfolge des Betriebs.
{
  const probeOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-einstieg-'))
  fs.writeFileSync(path.join(probeOrdner, 'probe.mjs'), 'await import(process.argv[2])\n')
  try {
    for (const modul of ['pr-nachrechnen.mjs', 'pr-nachrechnen-leser-git.mjs', 'pr-nachrechnen-kennung.mjs', 'pr-nachrechnen-textmerge.mjs', 'pr-nachrechnen-hunks.mjs']) {
      const r = spawnSync(process.execPath, [path.join(probeOrdner, 'probe.mjs'), new URL(`./${modul}`, import.meta.url).href], { encoding: 'utf8', timeout: 60000, windowsHide: true })
      pruefe(`Einstieg ${modul} lädt allein (kein Importzyklus)`, r.status === 0, (r.stderr ?? '').split('\n').find((z) => /Error/.test(z)))
    }
  } finally {
    fs.rmSync(probeOrdner, { recursive: true, force: true })
  }
}

// Kennungen lesen
const z = (text) => kennungenInZeile(text).join()
pruefe('AniList-ID, auch einstellig, am Schlüssel anilistId', z('+- anilistId: 1663') === '1663' && z('+  anilistId: 21') === '21')
pruefe('Slug und Release-ID, in Flow-Schreibweise und mit Anführungszeichen', z('+- slug: blue-exorcist-vol1') === 'blue-exorcist-vol1' && z("+{ releaseId: 'abc-123', platform: x }") === 'abc-123')
pruefe('ASIN im Text und in der Adresse', z('+  buyUrl: https://www.amazon.de/dp/B0CXYZ1234?tag=x') === 'B0CXYZ1234' && z('+note: B0ABCDEFGH ist es') === 'B0ABCDEFGH')
pruefe('AniList-Adresse', z('+  url: https://anilist.co/anime/98765/Titel') === '98765')
pruefe('lange Zahl ohne Schlüssel (remake-von-hand, TMDB-Pfad), Jahre und Datumsteile nicht', z('+- remake: 143277') === '143277' && z('+  tmdb: movie/290462 # TMDB') === '290462' && z("+  tag: 2026-11-03 # 2026") === '' && z('+  folgen: 73') === '' && z('+  x: 1234') === '')
pruefe('keine Kennung: Wahrheitswert, kurzer id-Wert, Datum, Titel, Notiz', z('+  dub: true') === '' && z('+  id: 7') === '' && z("+  checkedAt: '2026-11-13'") === '' && z('+  title: Naruto') === '' && z('+  note: gesehen') === '')
const diff = 'diff --git a/data/x.yaml b/data/x.yaml\n--- a/data/x.yaml\n+++ b/data/x.yaml\n@@ -1,0 +2,2 @@\n+- anilistId: 777\n+  dub: true\n-- anilistId: 888\n'
pruefe('kennungenAus: geänderte Zeilen, + und -, Dateikopf zählt nicht', [...kennungenAus(diff)].sort().join() === '777,888', [...kennungenAus(diff)])
// Kennung steht in einer unveränderten Zeile des Eintrags (Rückrechnung 13.11.2026: PR 3548 ändert nur `title:`, PR 3766 nur `hinweis:` und `time:`)
const EINTRAEGE = '- anilistId: 13018\n  title: alt\n  platform: netflix\n- slug: steel-ball-run\n  hinweis: x\n  sources:\n    - https://a.example/\n# Kommentar\n- anilistId: 99\n  title: dritter\n'
pruefe('eintragsKennungen: Zeile mitten im Eintrag liefert die Kennung seiner ersten Zeile', eintragsKennungen(EINTRAEGE, 2, 2).join() === '13018')
pruefe('eintragsKennungen: Zeile unter der Kennung, verschachtelte Liste gehört zum Eintrag', eintragsKennungen(EINTRAEGE, 7, 7).join() === 'steel-ball-run')
pruefe('eintragsKennungen: nur der berührte Eintrag, Nachbarn nicht', !eintragsKennungen(EINTRAEGE, 2, 2).includes('steel-ball-run') && !eintragsKennungen(EINTRAEGE, 10, 10).includes('13018'))
pruefe('eintragsKennungen: Bereich über zwei Einträge nennt beide', eintragsKennungen(EINTRAEGE, 3, 5).sort().join() === '13018,steel-ball-run')
pruefe('eintragsKennungen: Zeile hinter dem Ende oder leerer Text -> leer', eintragsKennungen(EINTRAEGE, 99, 99).length === 0 && eintragsKennungen('', 1, 1).length === 0)
{
  const alt = '- anilistId: 13018\n  title: alt\n'
  const neu = '- anilistId: 13018\n  title: neu\n'
  const d = 'diff --git a/data/x.yaml b/data/x.yaml\n--- a/data/x.yaml\n+++ b/data/x.yaml\n@@ -2 +2 @@\n-  title: alt\n+  title: neu\n'
  const m = kennungenMitEintrag(d, (seite) => (seite === 'alt' ? alt : neu))
  pruefe('kennungenMitEintrag: geänderte title-Zeile ohne eigene Kennung -> Kennung des Eintrags', [...m].join() === '13018', [...m])
  pruefe('kennungenMitEintrag: ohne lesbare Dateien nur die geänderten Zeilen', kennungenMitEintrag(d, () => '').size === 0)
  const loeschen = 'diff --git a/data/x.yaml b/data/x.yaml\n@@ -3 +2,0 @@\n-  note: q\n'
  const nurAlt = kennungenMitEintrag(loeschen, (seite) => (seite === 'alt' ? '- x: 1\n  anilistId: 4711\n  note: q\n' : ''))
  const nurNeu = kennungenMitEintrag(loeschen, (seite) => (seite === 'neu' ? '- x: 1\n  anilistId: 4711\n' : ''))
  pruefe('kennungenMitEintrag: Eintrag der alten Seite und der neuen Seite zählen je für sich', [...nurAlt].join() === '4711' && [...nurNeu].join() === '4711', [[...nurAlt], [...nurNeu]])
}
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
pruefe('handdatenDateien: nur YAML unter data/ (auch curated/), Doku, Patch Notes, Code, JSON, package.json nicht', handdatenDateien(['data/dub-confirmed.yaml', 'docs/a.md', 'data/patchnotes/x.yaml', 'tools/a.mjs', 'data/a.json', 'package.json', 'data/curated/tv-2026.yaml'], ohneLeser).join() === 'data/dub-confirmed.yaml,data/curated/tv-2026.yaml')
pruefe('handdatenSchnitt: nicht anwendbar ohne Kennungsdaten, mit Fehler, ohne Handdaten', handdatenSchnitt(undefined, ['data/dub-confirmed.yaml'], []) === undefined && handdatenSchnitt({ fehler: 'x' }, ['data/dub-confirmed.yaml'], []) === undefined && handdatenSchnitt({ kennungen: new Set(['1']), mainDiff: '' }, ['tools/a.mjs'], []) === undefined)

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
// Gemischter PR (PR 3618: Handbeleg plus Code): der Handdaten-Anteil läuft durch den Kennungsschnitt, der Code-Anteil weiter durch die Leser-Regeln.
TEXTE['tools/liest.mjs'] = `const d = '${BEWEGT}'\n`
pruefe('PR mit Handdaten und fremdem Code, Kennung fremd -> aktuell (PR 3618)', lesen([...HAND, 'tools/neu.mjs'], { kennung: K }) === null)
pruefe('PR mit Handdaten und Code, der die bewegte Datei liest -> Grund aus der Leser-Regel', /^der PR liest data\/kanal-seiten\.json \(tools\/liest\.mjs\)/.test(lesen([...HAND, 'tools/liest.mjs'], { kennung: K }) ?? ''), lesen([...HAND, 'tools/liest.mjs'], { kennung: K }))
pruefe('PR mit Handdaten und Code, gleiche Kennung -> Grund aus dem Kennungsschnitt vor dem Code-Anteil', /^main nennt 777/.test(lesen([...HAND, 'tools/neu.mjs'], { kennung: { ...K, mainDiff: md } }) ?? ''))
pruefe('PR mit Handdaten und einer Daten-JSON: die JSON läuft weiter durch die alte Datenkanal-Regel', /^der PR ändert data\/zugang\.json/.test(lesen([...HAND, 'data/zugang.json'], { kennung: K }) ?? ''), lesen([...HAND, 'data/zugang.json'], { kennung: K }))
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
  const anfasser = mitMain({ 'data/dub-confirmed.yaml': '- anilistId: 1663\n  platform: youtube\n  dub: false\n' })
  pruefe('echtes git: main ändert dieselbe Handdatei -> Grund „der PR berührt“', /^der PR berührt data\/dub-confirmed\.yaml/.test(anfasser ?? ''), anfasser)
  const ohneBasis = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1121, "b": 555}\n' }, { basis: '0'.repeat(40) })
  pruefe('echtes git: Kettenbasis nicht abrufbar -> bisherige Auflage (Grund)', /^der PR ändert data\/dub-confirmed\.yaml/.test(ohneBasis ?? ''), ohneBasis)
  // PR 3548-Form: geändert wird nur `dub:`, die AniList-ID steht in der unveränderten Zeile darüber
  git(arbeit, 'checkout', '-q', '-B', 'pr2', basis)
  schreibe(arbeit, 'data/dub-confirmed.yaml', '- anilistId: 1663\n  platform: youtube\n  dub: false\n')
  git(arbeit, 'commit', '-q', '-am', 'pr2')
  const zweiter = { nummer: 8, kopf: git(arbeit, 'rev-parse', 'pr2') }
  git(arbeit, 'push', '-q', 'origin', 'pr2:refs/pull/8/head')
  const eintragFremd = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1121}\n' }, zweiter)
  pruefe('echtes git (PR 3548): nur `dub:` geändert, Kennung im Eintrag, main nennt sie nicht -> aktuell', eintragFremd === null, eintragFremd)
  const eintragGleich = mitMain({ ...werkzeug, [BEWEGT]: '{"a": 1120, "x": 1663}\n' }, zweiter)
  pruefe('echtes git (PR 3548): dieselbe Kennung des Eintrags im main-Diff -> Grund', /^main nennt 1663 in data\/kanal-seiten\.json/.test(eintragGleich ?? ''), eintragGleich)
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-kennung.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-kennung.test: grün')
