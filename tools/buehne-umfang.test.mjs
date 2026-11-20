/**
 * Test von tools/buehne-umfang.mjs (Umfang und Scheiben von „Bühne-Messen“ in der PR-Kette): Diff → Mockup-Namen, Scheiben-Aufteilung,
 * der echte Aufrufer `durchlaufe` (Attrappe-Seite) und der Prozess `main` in einem Wegwerf-Repo. Aufruf: node tools/buehne-umfang.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import { angemeldeteNamen, inScheibe, leseScheibe, mockupGewaehlt, mockupsDesDiffs, umgebungsOptionen } from './buehne-umfang.mjs'
import { durchlaufe } from './buehne-seite.mjs'

const anmeldung = (...namen) => `mockup({\n${namen.map((n) => `  name: '${n}',`).join('\n')}\n  titel: 'x',\n  varianten: {\n    name: 'innen',\n  },\n})\n`
const M = (pfad, status = 'M') => ({ status, pfad: `web/buehne/mockups/${pfad}` })

/* Namen: nur oberste Ebene (zwei Leerzeichen), nicht verschachtelte `name:`. */
assert.deepEqual(angemeldeteNamen(anmeldung('a', 'b')), ['a', 'b'])
assert.deepEqual(angemeldeteNamen("    name: 'innen',\n"), [])

const texte = {
  'alpha.tsx': `import './alpha.css'\nimport { T } from './teil.tsx'\n${anmeldung('alpha', 'alpha-zwei')}`,
  'alpha.css': '.a{}',
  'beta.tsx': `import { T } from './teil'\n${anmeldung('beta')}`,
  'teil.tsx': `import { U } from './tief.ts'\nexport const T = 1`,
  'tief.ts': 'export const U = 1',
  'allein.ts': 'export const X = 1',
  'gamma.tsx': anmeldung('gamma'),
  'eltern.tsx': `import { K } from './kind.tsx'\n${anmeldung('eltern')}`,
  'kind.tsx': anmeldung('kind'),
  /* Schlüssel, der nur ein Unterordner-Pfad sein kann: ohne die Ordner-Weiche würde er als Mockup gelten. */
  'unter/gamma.tsx': anmeldung('unter-gamma'),
}

/* Eine Mockup-Datei → ihre Namen; Hilfsdatei → Namen der Importeure (auch mittelbar, mit und ohne Endung); css über den Import. */
assert.deepEqual(mockupsDesDiffs([M('gamma.tsx')], texte), ['gamma'])
assert.deepEqual(mockupsDesDiffs([M('alpha.tsx')], texte), ['alpha', 'alpha-zwei'])
assert.deepEqual(mockupsDesDiffs([M('alpha.css')], texte), ['alpha', 'alpha-zwei'])
assert.deepEqual(mockupsDesDiffs([M('teil.tsx')], texte).sort(), ['alpha', 'alpha-zwei', 'beta'])
assert.deepEqual(mockupsDesDiffs([M('tief.ts')], texte).sort(), ['alpha', 'alpha-zwei', 'beta'])
assert.deepEqual(mockupsDesDiffs([M('gamma.tsx'), M('beta.tsx')], texte).sort(), ['beta', 'gamma'])
/* Ein anmeldendes Mockup, das ein anderes einbindet, kommt mit: Änderung an kind.tsx misst auch eltern, die an eltern.tsx nur eltern. */
assert.deepEqual(mockupsDesDiffs([M('kind.tsx')], texte).sort(), ['eltern', 'kind'])
assert.deepEqual(mockupsDesDiffs([M('eltern.tsx')], texte), ['eltern'])
/* Hinzugefügte Datei zählt wie eine geänderte. */
assert.deepEqual(mockupsDesDiffs([M('gamma.tsx', 'A')], texte), ['gamma'])

/* Alles messen (null): Hilfsdatei ohne Importeur, gelöschte Datei, unbekannte Datei, jede Datei außerhalb der Mockups. */
assert.equal(mockupsDesDiffs([M('allein.ts')], texte), null)
assert.equal(mockupsDesDiffs([M('gamma.tsx', 'D')], texte), null)
assert.equal(mockupsDesDiffs([M('fehlt.tsx')], texte), null)
assert.equal(mockupsDesDiffs([{ status: 'M', pfad: 'web/buehne/mockups/unter/x.tsx' }], texte), null)
assert.equal(mockupsDesDiffs([{ status: 'M', pfad: 'web/buehne/mockups/unter/gamma.tsx' }], texte), null, 'Unterordner ist kein Mockup')
/* Fremder Pfad, dessen Rest hinter 19 Zeichen wie eine Mockup-Datei aussieht, zählt nicht. */
assert.equal(mockupsDesDiffs([{ status: 'M', pfad: `${'x'.repeat('web/buehne/mockups/'.length)}gamma.tsx` }], texte), null)
for (const fremd of ['web/src/App.tsx', 'web/buehne/zelle.tsx', 'web/buehne/faelle.json', 'tools/buehne-messen.mjs', '.github/workflows/pr-pruefung.yml', 'package.json', 'shared/logic.ts', 'extension/amazon.css', 'public/data/titles.json']) {
  assert.equal(mockupsDesDiffs([M('gamma.tsx'), { status: 'M', pfad: fremd }], texte), null, `${fremd} neben einem Mockup misst alles`)
  assert.equal(mockupsDesDiffs([{ status: 'M', pfad: fremd }], texte), null, `${fremd} allein misst alles`)
}
/* Text ohne Wirkung neben einem Mockup ändert den Umfang nicht; ein Diff ohne Mockup (nur Text) gibt null (der Job läuft dann ohnehin nicht). */
const text = [{ status: 'M', pfad: 'docs/wissen/karte.md' }, { status: 'A', pfad: 'data/patchnotes/neu.yaml' }, { status: 'M', pfad: '.claude/skills/x/SKILL.md' }]
assert.deepEqual(mockupsDesDiffs([M('gamma.tsx'), ...text], texte), ['gamma'])
assert.equal(mockupsDesDiffs(text, texte), null)
assert.equal(mockupsDesDiffs([], texte), null)

/* Echte Mockup-Dateien: jede Datei des Ordners ordnet sich einem Mockup zu (sonst misst ein Treffer alles). Einzige Ausnahme:
   design-regeln-teile.tsx importiert web/buehne/ausschnitte/design.tsx von außen, ihre Änderung misst bewusst alles. */
const WURZEL = path.resolve(import.meta.dirname, '..')
const ordner = path.join(WURZEL, 'web/buehne/mockups')
const echt = Object.fromEntries(readdirSync(ordner, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => [e.name, readFileSync(path.join(ordner, e.name), 'utf8')]))
const ohne = Object.keys(echt).filter((d) => mockupsDesDiffs([M(d)], echt) === null)
assert.deepEqual(ohne, ['design-regeln-teile.tsx'], `ohne Zuordnung (misst alles): ${ohne.join(', ')}`)
assert.ok(mockupsDesDiffs([M('reihen-box.css')], echt).includes('reihen-box'), 'reihen-box.css gehört zu reihen-box')
assert.ok(mockupsDesDiffs([M('disc-bereich-teile.tsx')], echt).includes('disc-bereich'), 'Hilfsdatei → Mockup')

/* Filter und Scheibe. */
assert.equal(mockupGewaehlt('reihen-box', ''), true)
assert.equal(mockupGewaehlt('reihen-box', 'tv,reihen'), true)
assert.equal(mockupGewaehlt('reihen-box', 'tv,disc'), false)
assert.equal(mockupGewaehlt('reihen-box', ','), false, 'leere Teile treffen nichts')
assert.deepEqual(leseScheibe('2/5'), { k: 1, n: 5 })
for (const ungueltig of ['', undefined, '0/5', '6/5', '1/0', 'a/b', '1-5']) assert.equal(leseScheibe(ungueltig), null, String(ungueltig))
for (const n of [1, 4, 5]) {
  const je = Array.from({ length: n }, (_, k) => [...Array(23).keys()].filter((i) => inScheibe(i, { k, n })))
  assert.deepEqual(je.flat().sort((a, b) => a - b), [...Array(23).keys()], `Scheiben 1..${n} decken jede Einheit genau einmal ab`)
}
assert.equal(inScheibe(7, null), true)
assert.deepEqual(umgebungsOptionen({ BUEHNE_MOCKUPS: 'a,b', BUEHNE_SCHEIBE: '3/5' }), { filter: 'a,b', scheibe: { k: 2, n: 5 } })
assert.deepEqual(umgebungsOptionen({}), { filter: '', scheibe: null })
assert.deepEqual(umgebungsOptionen({ BUEHNE_MOCKUPS: '', BUEHNE_SCHEIBE: '' }), { filter: '', scheibe: null })

/** Attrappe-Seite mit zwei Mockups × zwei Fällen × drei Varianten (12 Einheiten). */
function seite(adressen) {
  return {
    goto: async (url) => { if (url.includes('?')) adressen.push(decodeURIComponent(url.split('#')[1])) },
    locator: () => ({ first: () => ({ waitFor: async () => {} }), waitFor: async () => {}, elementHandles: async () => [] }),
    $$eval: async (sel) => (sel.includes('uebersicht') ? ['alpha', 'beta'] : sel.includes('"Variante"') ? ['A', 'B', 'C'] : sel.includes('"Fall"') ? ['f1', 'f2'] : []),
  }
}
async function einheiten(filter, scheibe) {
  const gesehen = []
  await durchlaufe(seite([]), filter, async (a) => { gesehen.push(`${a.mockup}/${a.fall}/${a.variante}`) }, { scheibe })
  return gesehen
}
const alle = await einheiten('', null)
assert.equal(alle.length, 12)
const scheiben = []
for (let k = 1; k <= 5; k++) scheiben.push(...(await einheiten('', leseScheibe(`${k}/5`))))
assert.deepEqual(scheiben.sort(), [...alle].sort(), 'fünf Scheiben messen jede Einheit genau einmal')
assert.ok((await einheiten('', leseScheibe('1/5'))).length < 12, 'eine Scheibe misst nicht alles')
/* Vorher gehört zur ersten Variante: jede Scheibe nimmt von einer Gruppe (Mockup × Fall) alle Varianten oder keine, die erste immer mit. */
for (let k = 1; k <= 5; k++) {
  const je = new Map()
  for (const e of await einheiten('', leseScheibe(`${k}/5`))) {
    const [m, f, v] = e.split('/')
    je.set(`${m}/${f}`, [...(je.get(`${m}/${f}`) ?? []), v])
  }
  for (const [gruppe, varianten] of je) assert.deepEqual(varianten, ['A', 'B', 'C'], `Scheibe ${k}/5, ${gruppe}: Varianten zusammen`)
}
assert.equal((await einheiten('', leseScheibe('5/5'))).length, 0, '4 Gruppen: die fünfte Scheibe ist leer')
assert.equal((await einheiten('beta', null)).length, 6, 'Filter schränkt ein')
assert.deepEqual((await einheiten('beta,alpha', null)).length, 12, 'kommagetrennter Filter nimmt beide')
const betaScheiben = []
for (let k = 1; k <= 5; k++) betaScheiben.push(...(await einheiten('beta', leseScheibe(`${k}/5`))))
assert.equal(betaScheiben.length, 6, 'Filter und Scheibe zusammen: jede Einheit der gefilterten Mockups einmal')
await assert.rejects(einheiten('gibtsnicht', null), /kein Mockup/)

/* Verdrahtung im Workflow: fünf Scheiben 1/5..5/5 (je genau einmal), Umfang-Schritt vor dem Messschritt, beide Umgebungsvariablen am Messschritt. */
{
  const job = parse(readFileSync(path.join(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8')).jobs.aussehen
  const messen = job.strategy.matrix.include.filter((e) => e.befehl === 'npm run check:buehne-messen')
  assert.deepEqual(messen.map((e) => e.scheibe), ['1/5', '2/5', '3/5', '4/5', '5/5'])
  assert.equal(new Set(messen.map((e) => e.teil)).size, 5, 'je Scheibe ein eigener Jobname')
  const schritte = job.steps
  const umfang = schritte.findIndex((s) => s.id === 'umfang')
  const messschritt = schritte.findIndex((s) => s.run === '${{ matrix.befehl }}')
  assert.ok(umfang > 0 && umfang < messschritt, 'Umfang vor der Messung')
  assert.match(schritte[umfang].run, /^node tools\/buehne-umfang\.mjs HEAD\^1 HEAD \| tee -a "\$GITHUB_OUTPUT"$/)
  assert.match(schritte[umfang].if, /matrix\.scheibe/)
  assert.deepEqual(schritte[messschritt].env, { BUEHNE_MOCKUPS: '${{ steps.umfang.outputs.mockups }}', BUEHNE_SCHEIBE: '${{ matrix.scheibe }}' })
}

/* Prozess `main` im Wegwerf-Repo: Mockup-Diff → Namen; Oberflächen-Diff → leer (alles); kaputter Ref → leer, Exit 0. */
const wurzel = mkdtempSync(path.join(tmpdir(), 'buehne-umfang-'))
try {
  mkdirSync(path.join(wurzel, 'tools'), { recursive: true })
  mkdirSync(path.join(wurzel, 'web/buehne/mockups'), { recursive: true })
  mkdirSync(path.join(wurzel, 'web/src'), { recursive: true })
  copyFileSync(path.join(WURZEL, 'tools/buehne-umfang.mjs'), path.join(wurzel, 'tools/buehne-umfang.mjs'))
  const schreibe = (p, t) => writeFileSync(path.join(wurzel, p), t)
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
  const lauf = (a, b) => spawnSync(process.execPath, ['tools/buehne-umfang.mjs', a, b], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
  schreibe('web/buehne/mockups/eins.tsx', anmeldung('eins'))
  schreibe('web/buehne/mockups/zwei.tsx', anmeldung('zwei'))
  schreibe('web/src/a.ts', 'a')
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'basis')
  schreibe('web/buehne/mockups/zwei.tsx', `${anmeldung('zwei')}// neu\n`)
  git('commit', '-q', '-am', 'mockup')
  schreibe('web/src/a.ts', 'b')
  git('commit', '-q', '-am', 'app')
  const nurMockup = lauf('HEAD~2', 'HEAD~1')
  assert.equal(nurMockup.status, 0, nurMockup.stderr)
  assert.equal(nurMockup.stdout.trim(), 'mockups=zwei')
  const mitApp = lauf('HEAD~2', 'HEAD')
  assert.equal(mitApp.status, 0, mitApp.stderr)
  assert.equal(mitApp.stdout.trim(), 'mockups=', 'Oberflächen-Diff misst alles')
  const kaputt = lauf('gibt-es-nicht', 'HEAD')
  assert.equal(kaputt.status, 0, kaputt.stderr)
  assert.equal(kaputt.stdout.trim(), 'mockups=')
  assert.match(kaputt.stderr, /alles messen/)
  assert.equal(spawnSync(process.execPath, ['tools/buehne-umfang.mjs'], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 30_000 }).status, 2)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log('ok  buehne-umfang: Diff→Mockups (Hilfsdatei, css, mittelbar, Löschung, Fremddatei), Scheiben, durchlaufe mit Filter und Scheibe, Prozess main (3 Fälle)')
