/**
 * Listen, an die fast jeder PR eine Zeile oder einen Block anhängt, führt `.gitattributes` mit `merge=union` zusammen
 * (sonst kollidiert jeder zweite Main-Merge, Lehre 05.11.2026). Der Test hält die Regel fest und spielt je Datei einen
 * echten Git-Merge in einem Wegwerf-Repo: zwei Zweige hängen je einen Eintrag an, beide müssen drin sein, die Datei parst;
 * als Kontrolle ohne Attribut kollidiert derselbe Merge. Gilt für lokale Merges (Bauer, merge-reihe), nicht für den
 * Servermerge von GitHub. Aufruf: node tools/union-listen.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const yaml = createRequire(join(wurzel, 'package.json'))('yaml')

/** Datei, Kopf, Eintrag A, Eintrag B, Parser (liefert die Einträge). */
const LISTEN = [
  { datei: 'data/dub-confirmed.yaml', kopf: '- anilistId: 1\n  title: "Alt"\n', a: '- anilistId: 2\n  title: "A"\n', b: '- anilistId: 3\n  title: "B"\n', lies: (t) => yaml.parse(t).map((e) => e.title) },
  { datei: 'tools/sammler-lesezugriffe.jsonl', kopf: '{"datei":"x","liest":"y","grund":"alt"}\n', a: '{"datei":"a","liest":"y","grund":"A"}\n', b: '{"datei":"b","liest":"y","grund":"B"}\n', lies: (t) => t.split(/\r?\n/).filter(Boolean).map((z) => JSON.parse(z).grund) },
  { datei: 'tools/bestand-ohne-ausgang.txt', kopf: '# Kopf\npipeline/alt.ts\tgrund alt\n', a: 'pipeline/a.ts\tgrund A\n', b: 'pipeline/b.ts\tgrund B\n', lies: (t) => t.split(/\r?\n/).filter((z) => z &&!z.startsWith('#')).map((z) => z.split('\t')[1]) },
]

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, windowsHide: true })
const versuch = (cwd, ...args) => { try { git(cwd, ...args); return 0 } catch (e) { return e.status ?? 1 } }

/** Beide Zweige hängen ihren Eintrag an; `attribute` ist der Inhalt der .gitattributes im Wegwerf-Repo. */
function mergeLauf(liste, attribute) {
  const dir = mkdtempSync(join(tmpdir(), 'union-listen-'))
  try {
    const pfad = (d) => join(dir, d.replaceAll('/', '_'))
    const datei = pfad(liste.datei)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'config', 'user.email', 't@t')
    git(dir, 'config', 'user.name', 't')
    git(dir, 'config', 'commit.gpgsign', 'false')
    writeFileSync(join(dir, '.gitattributes'), attribute)
    writeFileSync(datei, liste.kopf)
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'basis')
    for (const [zweig, eintrag] of [['a', liste.a], ['b', liste.b]]) {
      git(dir, 'checkout', '-q', '-b', zweig, 'main')
      writeFileSync(datei, liste.kopf + eintrag)
      git(dir, 'commit', '-q', '-am', zweig)
    }
    git(dir, 'checkout', '-q', 'a')
    const rc = versuch(dir, 'merge', '--no-edit', 'b')
    const text = readFileSync(datei, 'utf8')
    return { rc, text, dateiname: liste.datei.replaceAll('/', '_') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const attribute = readFileSync(join(wurzel, '.gitattributes'), 'utf8')
for (const liste of LISTEN) {
  const zeile = attribute.split(/\r?\n/).find((z) => z.startsWith(`${liste.datei} `))
  assert.ok(zeile && /(^|\s)merge=union(\s|$)/.test(zeile), `${liste.datei}: .gitattributes braucht "merge=union"`)

  const kontrolle = mergeLauf(liste, '')
  assert.notEqual(kontrolle.rc, 0, `${liste.datei}: ohne Attribut müsste derselbe Merge kollidieren (Kontrolle)`)

  const union = mergeLauf(liste, `${liste.datei.replaceAll('/', '_')} merge=union\n`)
  assert.equal(union.rc, 0, `${liste.datei}: Merge mit union kollidiert`)
  const eintraege = liste.lies(union.text)
  for (const soll of ['A', 'B']) assert.ok(eintraege.some((e) => e === soll || e === `grund ${soll}`), `${liste.datei}: Eintrag ${soll} fehlt nach dem Merge (${eintraege})`)
  assert.equal(new Set(eintraege).size, eintraege.length, `${liste.datei}: Eintrag doppelt nach dem Merge`)
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(union.text), `${liste.datei}: Konfliktmarken im Ergebnis`)
}
console.log(`union-listen.test: grün (${LISTEN.length} Listen: .gitattributes, Merge ohne Konflikt, Kontrolle ohne Attribut kollidiert)`)
