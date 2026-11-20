/**
 * Wächter für das öffentliche Repo: keine getrackte Datei trägt eine gmail/googlemail-Adresse, den Nachnamen oder die
 * private Domain des Betreibers, außer den zugelassenen Stellen (Impressum, Datenschutz, Lizenz, Autorfeld der Mod,
 * Wächter-Tests mit ihren Mustern, Portfolio-Überwachung). Ein einziger `git grep` über alles; Exit 1 heißt keine Treffer.
 * Riegel gegen „liest nichts“: ein Wegwerf-Repo mit eingeschleuster Datei muss anschlagen, und die zugelassene LICENSE
 * des echten Repos muss gefunden werden. Groß-/Kleinschreibung steht in den Zeichenklassen, denn `derNamenloseDaniel`
 * (GitHub-Login) ist öffentlich und darf nicht treffen.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MUSTER = '@([Gg][Mm][Aa][Ii][Ll]|[Gg]oogle[Mm]ail)\\.com|Zaiser|daniel-zaiser\\.de'

/** Zugelassene Dateien mit Grund. */
export const ZUGELASSEN = {
  'web/src/components/impressum-anbieter.tsx': 'Impressum',
  'web/src/components/Datenschutz.tsx': 'Datenschutzerklärung',
  'web/src/components/StaticViews.tsx': 'Impressum-Anbieter',
  LICENSE: 'Urheberzeile',
  '.claude/mods/arbeitsliste/.claude-plugin/plugin.json': 'Autorfeld der Mod',
  'pipeline/check-privatkennungen.ts': 'trägt die Muster selbst',
  'pipeline/check-interne-angaben.ts': 'Wächter-Test mit Namensmuster',
  'pipeline/check-folge-zwoelf-hinweis.ts': 'Wächter-Test mit Namensmuster',
  'tools/claude-global-privat.test.mjs': 'Wächter-Test, Fall „Portfolio-Repo“',
  'worker/src/sites.ts': 'Portfolio-Überwachung, funktional (Adresse der überwachten Seite)',
}

/** Ein Aufruf von `git grep`: getrackte Textdateien (ohne node_modules) mit Treffer; Exit 1 = keine. */
export function suche(wurzel: string): string[] {
  try {
    const aus = execFileSync('git', ['-C', wurzel, 'grep', '-I', '-l', '-E', MUSTER, '--', '.', ':!node_modules'], {
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      maxBuffer: 16 << 20,
    })
    return aus.split('\n').filter(Boolean)
  } catch (e: any) {
    if (e.status === 1) return []
    throw e
  }
}

/** Treffer, die nicht zugelassen sind. */
export function unzulaessige(treffer: string[]) {
  return treffer.filter((p: string) => !(p in ZUGELASSEN))
}

// Fälle der reinen Funktion
assert.deepEqual(unzulaessige(['LICENSE', 'fremd/x.md']), ['fremd/x.md'])
assert.deepEqual(unzulaessige(['worker/src/sites.ts']), [])
assert.deepEqual(unzulaessige([]), [])
// Ein Fehler von git (kein Repo, Exit 128) ist nie „keine Treffer“.
assert.throws(() => suche(join(tmpdir(), 'privat-wache-gibt-es-nicht')))

// Riegel: Wegwerf-Repo mit eingeschleusten Kennungen (aus Teilen gebaut, ohne ausgeschriebene Adresse)
const git = (dir: string, ...a: string[]) => execFileSync('git', ['-C', dir, ...a], { timeout: 30000, windowsHide: true, stdio: 'pipe' })
const probe = mkdtempSync(join(tmpdir(), 'privat-wache-'))
try {
  git(probe, 'init', '-q')
  mkdirSync(join(probe, 'node_modules'))
  const fall = {
    'adresse.md': `x@${['g', 'mail'].join('')}.com`,
    'google.md': `y@${['google', 'mail'].join('')}.com`,
    'name.md': ['Da', 'niel ', 'Za', 'iser'].join(''),
    'domain.md': ['daniel', 'zaiser'].join('-') + '.de',
    'node_modules/ausgenommen.md': `z@${['g', 'mail'].join('')}.com`,
    'login.md': 'derNamenloseDaniel/anime-kalender-de',
    'sauber.md': 'kontakt@anime-kalender.de',
  }
  for (const [p, t] of Object.entries(fall)) writeFileSync(join(probe, p), t)
  git(probe, 'add', '-f', '.')
  assert.deepEqual(suche(probe).sort(), ['adresse.md', 'domain.md', 'google.md', 'name.md'], 'Probe: jede Form schlägt an, Login, Projektadresse und node_modules nicht')
} finally {
  rmSync(probe, { recursive: true, force: true })
}

// Echter Lauf
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const treffer = suche(wurzel)
assert.ok(treffer.includes('LICENSE'), 'Riegel: die zugelassene LICENSE muss gefunden werden, sonst liest die Suche nichts')
const verletzt = unzulaessige(treffer)
assert.deepEqual(verletzt, [], `Privatkennung in getrackten Dateien: ${verletzt.join(', ')}`)
console.log(`check-privatkennungen: ok (${treffer.length} zugelassene Treffer, 0 unzulässige, Probe-Repo schlägt an)`)
