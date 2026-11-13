/**
 * Gegenprobe zu tools/stumme-pfade.mjs: ein neuer stummer catch oder ein unbegründetes `|| true` macht den Wächter rot,
 * die begründeten Formen und die Altfälle bleiben grün, `--festschreiben` senkt und erhöht nie, und die Kette
 * (check:logic) ruft den Wächter wirklich auf (Pflichtmutant „Aufruf entfernt“).
 */
import assert from 'node:assert/strict'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'stumme-pfade.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'stumme-pfade-'))

// Ohne --git liegt der Basisvergleich außerhalb eines Repos (entfällt); die Kulisse unten gibt ein eigenes Repo.
function lauf(wurzel, grenzen, ...optionen) {
  const git = optionen.includes('--git') ? [] : ['--git', ordner]
  return spawnMitLimit(process.execPath, [werkzeug, '--wurzel', wurzel, '--grenzen', grenzen, ...git, ...optionen], { encoding: 'utf8' })
}

/** Git-Kulisse: Repo mit `origin/main`, dessen Grenzdatei den Basiswert trägt (`null` = ohne Datei, `false` = ohne origin/main). */
function kulisse(name, basis) {
  const wurzel = baum(name, { 'x.txt': '1' })
  const git = (...a) => spawnMitLimit('git', ['-C', wurzel, '-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { encoding: 'utf8' })
  git('init', '-q')
  if (basis) {
    mkdirSync(join(wurzel, 'tools'), { recursive: true })
    writeFileSync(join(wurzel, 'tools/stumme-pfade-grenzen.json'), JSON.stringify(basis))
  }
  git('add', '-A')
  git('commit', '-q', '-m', 'basis')
  if (basis !== false) git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  return wurzel
}

function baum(name, dateien) {
  const wurzel = join(ordner, name)
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
  return wurzel
}

const SAUBER = { 'pipeline/a.ts': 'export function f() { try { g() } catch (e) { console.error(e); return null } }\ndeclare function g(): void\n' }
const WORKFLOW = '.github/workflows/x.yml'

try {
  const grenzen = join(ordner, 'grenzen.json')
  writeFileSync(grenzen, JSON.stringify({ code: {}, workflows: {} }))
  assert.equal(lauf(baum('sauber', SAUBER), grenzen).status, 0, 'catch mit Log ist grün')

  // Neue stumme Formen sind rot, jede über ihre Regel.
  const stumm = {
    'leer.ts': 'try { g() } catch {}',
    'null.ts': 'export const f = () => { try { return g() } catch { return null } }',
    'liste.ts': 'export const f = () => { try { return g() } catch (e) { return [] } }',
    'objekt.mjs': 'export const f = () => { try { return g() } catch (e) { return {} } }',
    'undef.ts': 'export const f = () => { try { return g() } catch { return undefined } }',
    'leer-return.ts': 'export function f() { try { g() } catch { return } }',
    'ohne-eslint.ts': '/* eslint-disable no-empty */\ntry { g() } catch {}',
    // Promise-Form (A2)
    'p-null.ts': 'export const f = () => g().catch(() => null)',
    'p-liste.ts': 'export const f = () => g().catch(() => [])',
    'p-objekt.ts': 'export const f = () => g().catch(() => ({}))',
    'p-undef.ts': 'export const f = () => g().catch(() => undefined)',
    'p-void.ts': 'export const f = () => g().catch(() => void 0)',
    'p-block.ts': 'g().catch(() => {})',
    // Jede Endung wird gelesen (A3)
    'e.tsx': 'try { g() } catch {}',
    'e.mts': 'try { g() } catch {}',
    'e.cts': 'try { g() } catch {}',
    'e.cjs': 'try { g() } catch {}',
    'e.js': 'try { g() } catch {}',
  }
  for (const [datei, code] of Object.entries(stumm)) {
    const r = lauf(baum(`stumm-${datei}`, { ...SAUBER, [`tools/${datei}`]: code }), grenzen)
    assert.equal(r.status, 1, `${datei} rot`)
    assert.match(r.stderr, new RegExp(`tools/${datei}: 1 statt höchstens 0`))
  }

  // Zulässig: Kommentar mit Warum im catch; weitere Anweisung neben dem return.
  const erlaubt = baum('erlaubt', {
    ...SAUBER,
    'tools/k.ts': 'try { g() } catch {\n  // Datei darf fehlen: erster Lauf\n}',
    'tools/l.ts': 'export const f = () => { try { return g() } catch (e) { console.warn(e); return [] } }',
  })
  assert.equal(lauf(erlaubt, grenzen).status, 0, 'begründeter oder geloggter catch grün')

  // Altfall: Grenze 1 erlaubt einen, der zweite ist rot.
  const alt = baum('alt', { ...SAUBER, 'tools/a.ts': 'try { g() } catch {}' })
  writeFileSync(grenzen, JSON.stringify({ code: { 'tools/a.ts': 1 }, workflows: {} }))
  assert.equal(lauf(alt, grenzen).status, 0, 'Altfall unter der Grenze grün')
  const alt2 = baum('alt2', { ...SAUBER, 'tools/a.ts': 'try { g() } catch {}\ntry { g() } catch {}' })
  assert.equal(lauf(alt2, grenzen).status, 1, 'zweiter Fall rot')

  // Parsefehler ist Fehler des Laufs, nicht „0 Funde“.
  assert.notEqual(lauf(baum('kaputt', { 'tools/k.ts': 'const = ;' }), grenzen).status, 0, 'Parsefehler nicht grün')

  // Workflows: Begründung in derselben oder der Vorzeile.
  writeFileSync(grenzen, JSON.stringify({ code: {}, workflows: {} }))
  const ohne = baum('wf-ohne', { [WORKFLOW]: 'jobs:\n  a:\n    steps:\n      - run: rm x || true\n' })
  const r = lauf(ohne, grenzen)
  assert.equal(r.status, 1, '|| true ohne Begründung rot')
  assert.match(r.stderr, /x\.yml: 1 statt höchstens 0/)
  assert.equal(lauf(baum('wf-echo', { [WORKFLOW]: '      - run: foo || echo "weiter"\n' }), grenzen).status, 1, '|| echo rot')
  const mit = baum('wf-mit', {
    [WORKFLOW]:
      '      - run: rm x || true # stumm: Datei fehlt beim ersten Lauf\n' +
      '      # stumm: Aufräumen darf scheitern\n      - run: rm y || true\n' +
      '      - run: a || b\n',
  })
  assert.equal(lauf(mit, grenzen).status, 0, 'begründete Formen und „||“ ohne true/echo grün')
  const leerGrund = baum('wf-leer', { [WORKFLOW]: '      - run: rm x || true # stumm:\n' })
  assert.equal(lauf(leerGrund, grenzen).status, 1, '„# stumm:“ ohne Grund zählt nicht')

  // Festschreiben senkt, erhöht nie, entfernt erledigte Dateien.
  writeFileSync(grenzen, JSON.stringify({ code: { 'tools/a.ts': 3, 'tools/weg.ts': 2 }, workflows: {} }))
  assert.equal(lauf(alt, grenzen, '--festschreiben').status, 0)
  const nach = JSON.parse(readFileSync(grenzen, 'utf8'))
  assert.deepEqual(nach.code, { 'tools/a.ts': 1 }, 'gesenkt, erledigte Datei entfernt')
  writeFileSync(grenzen, JSON.stringify({ code: { 'tools/a.ts': 1 }, workflows: {} }))
  assert.equal(lauf(alt2, grenzen, '--festschreiben').status, 1, 'Festschreiben erhöht nie')
  assert.deepEqual(JSON.parse(readFileSync(grenzen, 'utf8')).code, { 'tools/a.ts': 1 }, 'Grenze unverändert')

  // Promise-.catch mit Log oder echtem Ergebnis bleibt grün.
  const gutPromise = baum('p-gut', { 'tools/p.ts': 'export const f = () => g().catch((e) => { console.warn(e); return null })\nexport const h = () => g().catch(() => 1)' })
  assert.equal(lauf(gutPromise, grenzen).status, 0, '.catch mit Log oder Wert grün')

  // Workflow-Formen: `.yaml`, Composite-Actions, `|| :`, `|| exit 0` (A3, A4, A5).
  const wfFormen = {
    '.github/workflows/y.yaml': '      - run: rm x || true\n',
    '.github/actions/a/action.yml': '      - run: rm x || true\n',
    '.github/workflows/dp.yml': '      - run: rm x || :\n',
    '.github/workflows/ex.yml': '      - run: rm x || exit 0\n',
  }
  for (const [pfad, text] of Object.entries(wfFormen)) {
    const wr = lauf(baum(`wf-${pfad}`, { [pfad]: text }), grenzen)
    assert.equal(wr.status, 1, `${pfad} rot`)
    assert.match(wr.stderr, new RegExp(`${pfad.replaceAll('.', '\\.')}: 1 statt höchstens 0`))
  }
  assert.equal(lauf(baum('wf-doppelpunkt-ok', { [WORKFLOW]: '      - run: a || :b\n      - run: a || exit 1\n' }), grenzen).status, 0, '`|| :b` und `|| exit 1` grün')

  // eslint-Absturz (kaputte Konfig) bricht mit eigener Meldung ab, er ist weder grün noch ein JSON-Fehler (A5).
  const kaputteKonfig = join(ordner, 'kaputt.config.js')
  writeFileSync(kaputteKonfig, 'export default [ { rules: { "gibt-es-nicht": "error" } } ]\nthrow new Error("kaputt")\n')
  const absturz = lauf(baum('absturz', SAUBER), grenzen, '--konfig', kaputteKonfig)
  assert.notEqual(absturz.status, 0, 'eslint-Absturz nicht grün')
  assert.match(absturz.stderr, /eslint lief nicht durch/, 'Absturz wird als solcher gemeldet')

  // Fehlende Grenzdatei ist Fehler, nicht „keine Altfälle erlaubt/vorhanden“ (A5).
  const ohneDatei = lauf(baum('ohne-grenzdatei', SAUBER), join(ordner, 'gibt-es-nicht.json'))
  assert.notEqual(ohneDatei.status, 0, 'fehlende Grenzdatei nicht grün')
  assert.match(ohneDatei.stderr, /ENOENT|Grenzdatei/, 'Grund genannt')

  // Basisvergleich gegen origin/main (A1): höher oder neu ist rot, gleich oder niedriger grün, ohne Basis entfällt er sichtbar.
  const zweiAlt = baum('basis-wurzel', { ...SAUBER, 'tools/a.ts': 'try { g() } catch {}\ntry { g() } catch {}' })
  const wert = (n, pfad = 'tools/a.ts') => {
    writeFileSync(grenzen, JSON.stringify({ code: { [pfad]: n }, workflows: {} }))
    return grenzen
  }
  const basisEins = kulisse('basis-1', { code: { 'tools/a.ts': 1 }, workflows: {} })
  const angehoben = lauf(zweiAlt, wert(2), '--git', basisEins)
  assert.equal(angehoben.status, 1, 'Wert von 1 auf 2 ist rot, obwohl Ist = Grenze')
  assert.match(angehoben.stderr, /Grenzdatei von Hand angehoben/)
  // Wurzel ohne Fund: nur der neue Eintrag selbst kann rot machen.
  assert.equal(lauf(baum('basis-sauber', SAUBER), wert(1, 'tools/neu.ts'), '--git', basisEins).status, 1, 'neuer Eintrag ist rot')
  const basisZwei = kulisse('basis-2', { code: { 'tools/a.ts': 2 }, workflows: {} })
  const gleich = lauf(zweiAlt, wert(2), '--git', basisZwei)
  assert.equal(gleich.status, 0, 'gleicher Wert grün')
  assert.match(gleich.stdout, /Basisvergleich ja/, 'Log nennt den Vergleich')
  assert.equal(lauf(zweiAlt, wert(2), '--git', kulisse('basis-3', { code: { 'tools/a.ts': 3 }, workflows: {} })).status, 0, 'gesenkter Wert grün')
  const ohneOrigin = lauf(zweiAlt, wert(2), '--git', kulisse('basis-ohne-origin', false))
  assert.equal(ohneOrigin.status, 0)
  assert.match(ohneOrigin.stdout, /Basisvergleich entfällt: origin\/main fehlt/)
  const ohneBasisDatei = lauf(zweiAlt, wert(2), '--git', kulisse('basis-ohne-datei', null))
  assert.equal(ohneBasisDatei.status, 0)
  assert.match(ohneBasisDatei.stdout, /Basisvergleich entfällt: Grenzdatei steht noch nicht/)

  // Kette: der Wächter hängt in check:logic (dort läuft er gegen den echten Bestand).
  const liste = readFileSync(join(tools, 'check-logic-liste.txt'), 'utf8').split('\n')
  assert.ok(liste.includes('tools/stumme-pfade.mjs'), 'Wächter steht in check-logic-liste.txt')
  console.log('stumme-pfade: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
