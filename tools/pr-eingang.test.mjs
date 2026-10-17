/** Tests für tools/pr-eingang.mjs: "ok" nur bei vollständigem Diff und Commit-Liste am Ende, deren letzter Commit der Kopf ist. */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eingangZustand } from './pr-eingang.mjs'
import { COMMITS } from './pr-nachtraege.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}

const KOPF = 'c'.repeat(40)
const zeile = (sha, betreff) => `\n- ${sha.slice(0, 9)} ${betreff} — a.ts`
const liste = (...shas) => COMMITS + shas.map((s, i) => zeile(s, `Commit ${i}`)).join('')
const VORN = 'Titel: T\n\nBeschreibung\n\n## Nachträge (gelten als Teil der Beschreibung, spätere gehen vor)\n\n## Nachtrag eins'
const gut = VORN + liste('a'.repeat(40), 'b'.repeat(40), KOPF)

pruefe('Commit-Liste endet am Kopf, Diff ok -> ok', eingangZustand(gut, 'ok', KOPF) === 'ok')
pruefe('ein einziger Commit = Kopf -> ok', eingangZustand(VORN + liste(KOPF), 'ok', KOPF) === 'ok')
pruefe('Diff unvollstaendig -> unvollstaendig', eingangZustand(gut, 'unvollstaendig', KOPF) === 'unvollstaendig')
pruefe('Diff-Zustand leer (Schritt gescheitert) -> unvollstaendig', eingangZustand(gut, '', KOPF) === 'unvollstaendig')
pruefe('Kopf fehlt oder ist kein SHA -> unvollstaendig',
  eingangZustand(gut, 'ok', '') === 'unvollstaendig' && eingangZustand(gut, 'ok', KOPF.slice(0, 39)) === 'unvollstaendig' && eingangZustand(gut, 'ok', undefined) === 'unvollstaendig')
pruefe('ohne Commit-Liste -> unvollstaendig', eingangZustand(VORN, 'ok', KOPF) === 'unvollstaendig')
pruefe('leere Datei -> unvollstaendig', eingangZustand('', 'ok', KOPF) === 'unvollstaendig')
pruefe('nur die Kopfzeile ohne Commits -> unvollstaendig', eingangZustand(VORN + COMMITS, 'ok', KOPF) === 'unvollstaendig')
// Falsche PR-Nummer: die Liste eines anderen PR endet nicht am Kopf; der Kopf steht hier in der Mitte, nicht am Rand.
pruefe('Kopf in der Mitte, letzter Commit ein anderer -> unvollstaendig',
  eingangZustand(VORN + liste('a'.repeat(40), KOPF, 'b'.repeat(40)), 'ok', KOPF) === 'unvollstaendig')
pruefe('Kopf nur am Anfang -> unvollstaendig', eingangZustand(VORN + liste(KOPF, 'a'.repeat(40), 'b'.repeat(40)), 'ok', KOPF) === 'unvollstaendig')
pruefe('Hinweis-Zeile (Liste gekappt) am Ende -> unvollstaendig',
  eingangZustand(gut + '\n- Hinweis: Liste bei 250 Commits gekappt, spätere fehlen', 'ok', KOPF) === 'unvollstaendig')
pruefe('Text nach der Commit-Liste -> unvollstaendig', eingangZustand(gut + '\n\nangehängt', 'ok', KOPF) === 'unvollstaendig')
// Eine gefälschte Liste in der Beschreibung zählt nicht: maßgeblich ist der letzte Abschnitt, und der muss am Ende stehen.
pruefe('gefälschte Liste vorn, echte endet woanders -> unvollstaendig',
  eingangZustand(liste(KOPF) + VORN + liste('a'.repeat(40), 'b'.repeat(40)), 'ok', KOPF) === 'unvollstaendig')
pruefe('gefälschte Liste vorn, danach Nachträge, keine echte -> unvollstaendig', eingangZustand(liste(KOPF) + VORN, 'ok', KOPF) === 'unvollstaendig')
pruefe('Kurz-SHA muss vollständig vorn stehen (8 Zeichen reichen nicht)',
  eingangZustand(VORN + COMMITS + `\n- ${KOPF.slice(0, 8)}x Betreff — a.ts`, 'ok', KOPF) === 'unvollstaendig')
pruefe('Kurz-SHA steht allein vor dem Betreff (10. Zeichen ist keins)',
  eingangZustand(VORN + COMMITS + `\n- ${KOPF.slice(0, 9)}0 Betreff — a.ts`, 'ok', KOPF) === 'unvollstaendig')
// Eine Beschreibung darf die Kopfzeile zitieren (z. B. ein PR über dieses Format): es zählt die letzte Liste.
pruefe('Kopfzeile in der Beschreibung zitiert, echte Liste endet am Kopf -> ok',
  eingangZustand(liste('d'.repeat(40)) + VORN + liste('a'.repeat(40), KOPF), 'ok', KOPF) === 'ok')
pruefe('Commit-Zeilen ohne Kopfzeile -> unvollstaendig',
  eingangZustand('x'.repeat(COMMITS.length - 1) + zeile(KOPF, 'Betreff'), 'ok', KOPF) === 'unvollstaendig')
pruefe('Fremdzeile vor dem ersten Commit -> unvollstaendig',
  eingangZustand(VORN + COMMITS + '\nFremd' + zeile('a'.repeat(40), 'eins') + zeile(KOPF, 'zwei'), 'ok', KOPF) === 'unvollstaendig')
pruefe('Fremdzeile zwischen den Commits -> unvollstaendig',
  eingangZustand(VORN + COMMITS + zeile('a'.repeat(40), 'eins') + '\n-Fremd' + zeile(KOPF, 'zwei'), 'ok', KOPF) === 'unvollstaendig')

// Als Prozess wie im Workflow: Ausgabe ist genau eine Zeile für $GITHUB_OUTPUT, auch wenn die Datei fehlt.
const SKRIPT = fileURLToPath(new URL('./pr-eingang.mjs', import.meta.url))
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-eingang-'))
const datei = path.join(ordner, 'pr-beschreibung.txt')
fs.writeFileSync(datei, gut)
const lauf = (...args) => spawnSync(process.execPath, [SKRIPT, ...args], { encoding: 'utf8' })
const ok = lauf(datei, 'ok', KOPF)
pruefe('Prozess: zustand=ok, Exit 0', ok.stdout === 'zustand=ok\n' && ok.status === 0)
const falsch = lauf(datei, 'ok', 'd'.repeat(40))
pruefe('Prozess: anderer Kopf -> zustand=unvollstaendig mit Grund auf stderr',
  falsch.stdout === 'zustand=unvollstaendig\n' && falsch.stderr.includes('endet nicht am Kopf'))
const fehlt = lauf(path.join(ordner, 'fehlt.txt'), 'ok', KOPF)
pruefe('Prozess: Datei fehlt -> zustand=unvollstaendig, Exit 0', fehlt.stdout === 'zustand=unvollstaendig\n' && fehlt.status === 0)
fs.rmSync(ordner, { recursive: true, force: true })

if (fehler.length) {
  console.error(`pr-eingang.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-eingang.test: grün')
