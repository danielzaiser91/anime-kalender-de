/**
 * Tests für tools/pr-eigener-diff.mjs (eigener Diff eines PR-Kopfes aus GitHub-Compare, 21.11.2026).
 * Dateilisten in der Form von `gh api repos/o/r/compare/main...K --jq .files` (Felder filename, status, previous_filename, patch).
 */
import { DATEIEN_HOECHSTENS, compareKennung, diffGleich, diffKennung } from './pr-eigener-diff.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const PATCH = '@@ -10,6 +10,7 @@ export function a() {\n   x\n+  y\n   z'
const datei = (name, patch = PATCH, extra = {}) => ({ filename: name, status: 'modified', patch, ...extra })
const basis = [datei('tools/a.mjs'), datei('tools/b.mjs', '@@ -1,2 +1,3 @@\n a\n+b\n c'), datei('docs/c.md', '@@ -5 +5 @@\n-alt\n+neu')]
const k = diffKennung(basis)

console.log('pr-eigener-diff: diffKennung')
pruefe('Kennung ist ein sha256-Hex', /^[0-9a-f]{64}$/.test(k ?? ''), k)
pruefe('(1) nur main nachgezogen: Hunk um Zeilen verschoben -> gleich', diffKennung([datei('tools/a.mjs', PATCH.replace('-10,6 +10,7', '-42,6 +42,7')), basis[1], basis[2]]) === k)
pruefe('(1) Hunk-Kopf ohne Zeilenzahl (-5 +5) verschoben -> gleich', diffKennung([basis[0], basis[1], datei('docs/c.md', '@@ -9 +9 @@\n-alt\n+neu')]) === k)
pruefe('Reihenfolge der Dateien egal', diffKennung([basis[2], basis[0], basis[1]]) === k)
pruefe('(2) eigener Commit: zusätzliche Zeile -> anders', diffKennung([datei('tools/a.mjs', `${PATCH}\n+  w`), basis[1], basis[2]]) !== k)
pruefe('(2) eigener Commit: zusätzliche Datei -> anders', diffKennung([...basis, datei('tools/d.mjs')]) !== k)
pruefe('(3) Konfliktauflösung ändert eine Zeile -> anders', diffKennung([basis[0], datei('tools/b.mjs', '@@ -1,2 +1,3 @@\n a\n+B\n c'), basis[2]]) !== k)
pruefe('(3) main ändert Kontextzeile -> anders (Prüfung nötig)', diffKennung([basis[0], basis[1], datei('docs/c.md', '@@ -5 +5 @@\n-alt2\n+neu')]) !== k)
pruefe('Status geändert -> anders', diffKennung([datei('tools/a.mjs', PATCH, { status: 'added' }), basis[1], basis[2]]) !== k)
pruefe('Umbenennung (previous_filename) -> anders', diffKennung([datei('tools/a.mjs', PATCH, { previous_filename: 'tools/alt.mjs' }), basis[1], basis[2]]) !== k)
pruefe('Name geändert -> anders', diffKennung([datei('tools/a2.mjs'), basis[1], basis[2]]) !== k)
pruefe('Datei ohne Patch (Binärdatei, Riesen-Diff) -> null', diffKennung([...basis, { filename: 'bild.png', status: 'added' }]) === null)
pruefe('leere Liste -> null', diffKennung([]) === null && diffKennung(null) === null && diffKennung(undefined) === null)
const viele = (n) => Array.from({ length: n }, (_, i) => datei(`f${i}.txt`))
pruefe(`${DATEIEN_HOECHSTENS} Dateien (Liste womöglich gekürzt) -> null, ${DATEIEN_HOECHSTENS - 1} -> Kennung`, DATEIEN_HOECHSTENS === 300 && diffKennung(viele(300)) === null && diffKennung(viele(299)) !== null)

console.log('pr-eigener-diff: compareKennung')
const aufrufe = []
const holen = compareKennung((args) => {
  aufrufe.push(args.join(' '))
  if (args[1].endsWith('...0123456789bad')) throw new Error('HTTP 404')
  return JSON.stringify(args[1].endsWith('...leer') ? null : basis)
}, 'main')
pruefe('Abruf über Compare drei Punkte ab Basis, nur .files', holen('abc') === k && aufrufe[0] === 'api repos/{owner}/{repo}/compare/main...abc --jq .files', aufrufe)
const fehlerZeilen = []
const altError = console.error
console.error = (t) => fehlerZeilen.push(t)
const nachFehler = holen('0123456789bad')
console.error = altError
pruefe('Abruffehler -> null, Ursache mit Kurz-SHA im Log', nachFehler === null && fehlerZeilen.join() === 'eigener Diff 012345678 nicht lesbar (HTTP 404); Freigabe wird nicht übernommen', fehlerZeilen)
pruefe('.files null -> null', holen('leer') === null)

console.log('pr-eigener-diff: diffGleich')
const A = '0a1b2c3d4e5f'.padEnd(40, '6')
const B = '1b2c3d4e5f6a'.padEnd(40, '7')
const K = '2c3d4e5f6a7b'.padEnd(40, '8')
const commits = [{ oid: A }, { oid: B }, { oid: K }]
const gefragt = []
const mitKennung = (tabelle) => diffGleich((sha) => {
  gefragt.push(sha)
  return tabelle[sha] ?? null
}, commits, K)
const g = mitKennung({ [A]: 'X', [B]: 'Y', [K]: 'Y' })
pruefe('gleiche Kennung -> gleich, andere -> nicht', g('1b2c3d4e5') === true && g('0a1b2c3d4') === false)
pruefe('je SHA höchstens ein Abruf (B, K, A)', g('1b2c3d4e5') && JSON.stringify(gefragt) === JSON.stringify([B, K, A]), gefragt)
pruefe('beide Kennungen null -> nicht gleich', mitKennung({})('1b2c3d4e5') === false)
pruefe('Kopf nicht unter den Commits -> nicht gleich, auch wenn jede Kennung passt', diffGleich(() => 'Y', commits, K)('999999999') === false)
pruefe('leerer Kopf -> nie gleich', diffGleich(() => 'Y', commits, '')('1b2c3d4e5') === false)

if (fehler.length > 0) {
  console.error(`pr-eigener-diff: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-eigener-diff: alle Fälle grün')
