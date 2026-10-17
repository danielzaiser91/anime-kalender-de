/**
 * Statusfarben nur über Tokens (docs/wissen/design-regeln.md, Abschnitt 5; 14.10.2026): Grün, Rot und Gelb gibt es in `web/src`
 * nur als `ak-gut*`, `ak-fehler*` und `ak-warnung*`. Der Wächter `design-klassen.mjs` lässt bis zur Grenzdatei noch Altbestand zu,
 * die Grenze sinkt aber erst im Bestandsbau — bis dahin hält diese Prüfung die vier Palettenfarben bei null.
 * Dazu die Zuordnungen, an denen die Bedeutung hängt (Pille, Patch Notes, Kino-Knopf, Sprache offen).
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abweichungen } from './ansicht-statusfarben.mjs'
import { fundstellen } from './design-klassen.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = join(wurzel, 'web', 'src')
const STATUS_PALETTE = ['amber-', 'emerald-', 'rose-', 'red-']

/** Fundstellen der vier Palettenfarben in einem Quellbaum. */
function statusFunde(ordner) {
  const funde = fundstellen(ordner)
  return STATUS_PALETTE.flatMap((name) => funde[name].map((f) => `${f} ${name}`))
}

const lies = (pfad) => readFileSync(join(quelle, pfad), 'utf8')

// Gegenprobe: das Zählen sieht jede der vier Farben, auch in .ts und .css.
const probe = mkdtempSync(join(tmpdir(), 'design-status-'))
try {
  mkdirSync(join(probe, 'a'), { recursive: true })
  writeFileSync(join(probe, 'a', 'x.tsx'), '<b className="text-amber-400 bg-emerald-500/10 text-rose-300">x</b>\n')
  writeFileSync(join(probe, 'a', 'y.ts'), "export const k = 'border-red-500'\n")
  writeFileSync(join(probe, 'a', 'z.css'), '.a { color: var(--c); } /* rose-700 */\n')
  assert.equal(statusFunde(probe).length, 5, 'vier Farben in .tsx, .ts und .css werden gesehen')
  writeFileSync(join(probe, 'a', 'x.tsx'), '<b className="text-ak-favorit-text bg-ak-gut-grund text-ak-fehler-text">x</b>\n')
  writeFileSync(join(probe, 'a', 'y.ts'), "export const k = 'border-ak-fehler'\n")
  writeFileSync(join(probe, 'a', 'z.css'), '.a { color: var(--ak-gut); }\n')
  assert.equal(statusFunde(probe).length, 0, 'mit Tokens bleibt es grün')
} finally {
  rmSync(probe, { recursive: true })
}

assert.deepEqual(statusFunde(quelle), [], 'amber-, emerald-, rose-, red- in web/src: stattdessen ak-gut*, ak-fehler*, ak-warnung*')

// Zuordnungen: Gewählt = Grün, Ausgeschlossen = Rot, Feature = Grün, Bugfix = Warnung, Kino-Knopf ohne Rot.
const pille = lies('components/filter/pille-zustand.ts')
assert.match(pille, /PILLE_JA =\s*'border-ak-gut bg-ak-gut-grund inset-ring-1 inset-ring-ak-gut /)
assert.match(pille, /PILLE_NEIN =\s*'border-ak-fehler bg-ak-fehler-grund inset-ring-1 inset-ring-ak-fehler text-ak-fehler-text line-through /)

const klick = lies('components/filter/klick-modus.tsx')
assert.match(klick, /'bg-ak-fehler text-ak-auf-fehler' : 'bg-ak-gut text-ak-auf-gut'/, 'Klick-Modus: Ausschließen rot, Auswählen grün')

const patch = lies('patchnotes.css')
assert.match(patch, /--pn-feature: var\(--ak-gut-text\);/)
assert.match(patch, /--pn-bugfix: var\(--ak-warnung-text\);/)
assert.doesNotMatch(patch, /--pn-(feature|bugfix)(-grund)?: (#|rgba?\()/, 'Patch Notes: keine festen Farben für Feature und Bugfix')

const kino = lies('components/detail/kino.tsx')
assert.match(kino, /'border-ak-rand bg-ak-flaeche text-ak-text hover:border-ak-leise hover:bg-ak-flaeche-2'/, 'Kino-Knopf ist ein Sekundärknopf')

const pilleDub = lies('components/detail/pille.tsx')
assert.match(pilleDub, /belegt: 'bg-ak-gut text-ak-auf-gut'/, '✓ Deutsch in Grün')
assert.match(pilleDub, /offen: 'bg-ak-flaeche-2 text-ak-leise'/, 'Sprache offen ist Unsicherheit (leise), keine Warnung')

const kopf = lies('components/Header.tsx')
assert.match(kopf, /dunkel \? 'text-ak-favorit' : 'text-ak-info'/, 'Themaknopf: Sonne Gold, Mond Info')

const styles = lies('styles.css')
assert.match(styles, /\.ak-immer-dunkel \{[^}]*--ak-fehler: #fb7185;[^}]*--ak-fehler-text: #fda4af;/, 'Beleg-Dialog hat die Dunkelfassung der Fehlerfarben')
assert.match(lies('components/beleg-dialog.tsx'), /className="ak-immer-dunkel /, 'Beleg-Dialog trägt .ak-immer-dunkel')

// Die Ansichtsprüfung: jede Messgröße kippt für sich, und der Aufrufer ruft sie am Rechner (Datenbank und News) auf.
const soll = { gut: 'g', fehler: 'f', 'gut-text': 'gt', 'warnung-text': 'wt' }
const ist = {
  f: { include: { modusGrund: 'g', pilleRand: 'g', pilleDurch: 'none' }, exclude: { modusGrund: 'f', pilleRand: 'f', pilleDurch: 'line-through' } },
  p: { feature: 'gt', bugfix: 'wt' },
}
assert.deepEqual(abweichungen('hell', soll, ist.f, ist.p), [])
for (const [was, f, p] of [
  ['Auswählen', { ...ist.f, include: { ...ist.f.include, modusGrund: 'x' } }, ist.p],
  ['gewählte Pille', { ...ist.f, include: { ...ist.f.include, pilleRand: 'x' } }, ist.p],
  ['Ausschließen', { ...ist.f, exclude: { ...ist.f.exclude, modusGrund: 'x' } }, ist.p],
  ['ausgeschlossene Pille', { ...ist.f, exclude: { ...ist.f.exclude, pilleRand: 'x' } }, ist.p],
  ['durchgestrichen', { ...ist.f, exclude: { ...ist.f.exclude, pilleDurch: 'none' } }, ist.p],
  ['Feature', ist.f, { ...ist.p, feature: 'x' }],
  ['Bugfix', ist.f, { ...ist.p, bugfix: 'x' }],
]) {
  assert.equal(abweichungen('hell', soll, f, p).length, 1, `${was} kippt allein`)
}
const aufrufer = readFileSync(join(wurzel, 'tools', 'ansicht-bild.mjs'), 'utf8')
assert.match(aufrufer, /\['datenbank', 'news'\]\.every\(.*pruefeStatusfarben\(seite\)/, 'ansicht-bild.mjs ruft pruefeStatusfarben am Rechner')

console.log('Statusfarben: nur Tokens, Zuordnungen stimmen.')
