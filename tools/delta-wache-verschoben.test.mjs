/**
 * Die Delta-Wache zählt Titel, die in `ohne-synchro.json` gewandert sind, als verschoben (begründet, namentlich genannt),
 * nicht als „Titel weniger“ (28.10.2026; Anlass PR 2144: Madoka Walpurgisnacht, Rascal Dear Friend, Beerus). Wirklich
 * verschwundene Titel bleiben rot. Dazu `titelAusCommit` gegen echtes git und `bestand-historie.ts` als Prozess.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findeAuffaelliges } from '../pipeline/lib/bestand-delta.ts'
import { titelAusCommit, verschobeneTitel } from '../pipeline/lib/bestand-verschoben.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const t = (id, titleDe) => ({ id, titleDe })

/** Kennzahlen; `titel` verschieden vom Rest, damit vertauschte Argumente auffallen. */
const kz = (titel) => ({
  titel,
  titelMitVerweis: 90,
  verweise: 200,
  mitUrteil: 150,
  ohneUrteil: 50,
  titelMitSynchro: 80,
  entferntProtokolliert: 10,
  releases: 10,
  termine: 100,
  jeAnbieter: {},
})

// --- verschobeneTitel ------------------------------------------------------------------------------------------------
{
  const vorher = [t(1, 'Madoka Walpurgisnacht'), t(2, 'Beerus'), t(3, 'Weg'), t(4, 'Bleibt'), t(5, 'In beiden')]
  const jetzt = [t(4, 'Bleibt'), t(5, 'In beiden')]
  const ohne = [t(2, 'Beerus'), t(1, 'Madoka Walpurgisnacht'), t(5, 'In beiden'), t(9, 'Nie im Hauptbestand')]
  assert.deepEqual(verschobeneTitel(vorher, jetzt, ohne), ['Madoka Walpurgisnacht', 'Beerus'], 'nur weg aus Haupt und in ohne-synchro')
  assert.deepEqual(verschobeneTitel(vorher, jetzt, []), [], 'ohne ohne-synchro-Eintrag ist nichts verschoben')
  assert.deepEqual(verschobeneTitel([], jetzt, ohne), [], 'leerer Vorgängerstand')
}

// --- Urteil der Wache ------------------------------------------------------------------------------------------------
{
  const namen = ['Madoka Walpurgisnacht', 'Rascal Dear Friend', 'Beerus']
  const ok = findeAuffaelliges(kz(97), kz(100), namen)
  assert.deepEqual(ok.auffaellig, [], 'drei verschoben, drei weniger: nicht rot')
  assert.equal(ok.erklaert.length, 1)
  assert.match(ok.erklaert[0], /^3 Titel verschoben nach ohne-synchro: Madoka Walpurgisnacht, Rascal Dear Friend, Beerus$/)

  const echt = findeAuffaelliges(kz(97), kz(100), [])
  assert.deepEqual(echt.auffaellig, ['3 Titel weniger'], 'wirklich weg bleibt rot')
  assert.deepEqual(echt.erklaert, [])

  const teil = findeAuffaelliges(kz(95), kz(100), ['Beerus'])
  assert.deepEqual(teil.auffaellig, ['4 Titel weniger'], 'ein verschoben, vier weg: vier bleiben rot')
  assert.match(teil.erklaert[0], /^1 Titel verschoben nach ohne-synchro: Beerus$/)

  const netto = findeAuffaelliges(kz(99), kz(100), namen)
  assert.deepEqual(netto.auffaellig, [], 'Zuwachs gleicht aus: nie mehr erklärt als netto fehlt')
  assert.match(netto.erklaert[0], /^1 Titel verschoben/)

  const mehr = findeAuffaelliges(kz(102), kz(100), namen)
  assert.deepEqual(mehr.auffaellig, [], 'Zuwachs ist nie auffällig')
  assert.deepEqual(mehr.erklaert, [], 'ohne Rückgang wird nichts als verschoben gemeldet')

  const gleich = findeAuffaelliges(kz(100), kz(100), namen)
  assert.deepEqual(gleich.erklaert, [])
}

// --- titelAusCommit gegen echtes git ---------------------------------------------------------------------------------
const wegwerf = mkdtempSync(join(tmpdir(), 'ak-verschoben-'))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, windowsHide: true, stdio: 'pipe' })
try {
  const repo = join(wegwerf, 'repo')
  mkdirSync(join(repo, 'public/data'), { recursive: true })
  mkdirSync(join(repo, 'data'), { recursive: true })
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.email', 'a@b.c')
  git(repo, 'config', 'user.name', 'x')
  assert.deepEqual(titelAusCommit(repo), [], 'ohne Commit: leer')
  writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify([t(1, 'Madoka Walpurgisnacht'), t(2, 'Beerus'), t(3, 'Weg'), t(4, 'Bleibt')]))
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'alt')
  assert.deepEqual(titelAusCommit(repo).map((x) => x.id), [1, 2, 3, 4], 'liest den Stand von HEAD')
  assert.deepEqual(titelAusCommit(join(wegwerf, 'kein-repo-xyz')), [], 'kein Repo: leer')

  // --- Prozess: bestand-historie.ts schreibt die Zeile mit den Namen --------------------------------------------------
  writeFileSync(join(repo, 'public/data/titles.json'), JSON.stringify([t(4, 'Bleibt')]))
  writeFileSync(join(repo, 'public/data/ohne-synchro.json'), JSON.stringify([t(2, 'Beerus'), t(1, 'Madoka Walpurgisnacht')]))
  const alt = { ...kz(4), zeitpunkt: '2026-10-28T00:00:00.000Z', lauf: 'alt' }
  alt.titel = 4
  writeFileSync(join(repo, 'data/bestand-historie.jsonl'), JSON.stringify(alt) + '\n')
  const lauf = spawnSync(process.execPath, [join(wurzel, 'node_modules/tsx/dist/cli.mjs'), join(wurzel, 'pipeline/bestand-historie.ts'), '--lauf', 'probe'], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: repo },
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(lauf.status, 0, lauf.stderr + lauf.stdout)
  const zeilen = readFileSync(join(repo, 'data/bestand-historie.jsonl'), 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))
  const neu = zeilen[1]
  assert.equal(neu.titel, 1)
  assert.equal(neu.delta.titel, -3, 'vier Titel vorher in der Historie, einer jetzt')
  assert.equal(neu.auffaellig.filter((a) => /Titel weniger/.test(a)).join(), '1 Titel weniger', 'zwei verschoben (Madoka, Beerus), Titel 3 echt weg')
  assert.match(neu.erklaert[0], /^2 Titel verschoben nach ohne-synchro: Madoka Walpurgisnacht, Beerus$/)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}

console.log('delta-wache-verschoben: verschoben nach ohne-synchro begründet und namentlich, echt Verschwundenes rot (git und Prozess)')
