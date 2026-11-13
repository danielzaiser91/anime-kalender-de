/**
 * Gegenprobe zu tools/stumme-pfade.mjs: ein neuer stummer catch oder ein unbegründetes `|| true` macht den Wächter rot,
 * die begründeten Formen und die Altfälle bleiben grün, `--festschreiben` senkt und erhöht nie, und die Kette
 * (check:logic) ruft den Wächter wirklich auf (Pflichtmutant „Aufruf entfernt“).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'stumme-pfade.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'stumme-pfade-'))

function lauf(wurzel, grenzen, ...optionen) {
  return spawnSync(process.execPath, [werkzeug, '--wurzel', wurzel, '--grenzen', grenzen, ...optionen], { encoding: 'utf8' })
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

  // Kette: der Wächter hängt in check:logic (dort läuft er gegen den echten Bestand).
  const liste = readFileSync(join(tools, 'check-logic-liste.txt'), 'utf8').split('\n')
  assert.ok(liste.includes('tools/stumme-pfade.mjs'), 'Wächter steht in check-logic-liste.txt')
  console.log('stumme-pfade: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
