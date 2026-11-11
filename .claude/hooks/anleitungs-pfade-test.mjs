// Test für anleitungs-pfade.js: Anleitungen und Hook-Meldetexte nennen nur Repo-Pfade, die es gibt.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { findePfade, pruefeDatei, pruefeAlle, bewerte } = require('./anleitungs-pfade.js')
const B = String.fromCharCode(96)
let fehler = 0
function soll(name, ist, erwartet) {
  const a = JSON.stringify(ist)
  const e = JSON.stringify(erwartet)
  if (a !== e) {
    fehler++
    console.log(`✖ ${name}: ${a} statt ${e}`)
  }
}

const wurzel = mkdtempSync(join(tmpdir(), 'anleitungs-pfade-'))
mkdirSync(join(wurzel, '.claude', 'skills', 'x'), { recursive: true })
mkdirSync(join(wurzel, 'tools'), { recursive: true })
writeFileSync(join(wurzel, 'tools', 'da.mjs'), '')
function datei(rel, text) {
  writeFileSync(join(wurzel, rel), text)
  return pruefeDatei(wurzel, rel)
}
const D = '.claude/skills/x/SKILL.md'

// findePfade: was zählt als Repo-Pfad
soll('Backtick-Pfad', findePfade(`siehe ${B}tools/da.mjs${B} hier`), ['tools/da.mjs'])
soll('Zeilen-Suffix wird abgeschnitten', findePfade(`${B}tools/da.mjs:54${B}`), ['tools/da.mjs'])
soll('Satzende-Punkt gehört nicht zum Pfad', findePfade('Datei tools/da.mjs.'), ['tools/da.mjs'])
soll('Platzhalter < > frei', findePfade(`${B}tools/<name>.mjs${B}`), [])
soll('Glob * frei', findePfade(`${B}tools/*.mjs${B}`), [])
soll('Klammer-Platzhalter frei', findePfade(`${B}tools/{a,b}.mjs${B}`), [])
soll('NN-Platzhalter frei', findePfade(`${B}pipeline/bau/NN-name.ts${B}`), [])
soll('Fremde Wurzel frei', findePfade(`${B}state/befehle/x.jsonl${B} ${B}C:/code/ai/x/y.mjs${B}`), [])
soll('Erzeugter Ordner frei', findePfade(`${B}node_modules/x/y.js${B}`), [])
soll('Endung fehlt: kein Pfad', findePfade(`${B}tools/readme${B}`), [])
soll('Ordner mit Schrägstrich', findePfade(`${B}.claude/skills/x/${B}`), ['.claude/skills/x/'])

// pruefeDatei: Existenz
soll('vorhanden grün', datei(D, `${B}tools/da.mjs${B}`), [])
soll('fehlend rot', datei(D, `${B}tools/weg.mjs${B}`), [`${D}: tools/weg.mjs existiert nicht`])
soll('fehlend neben vorhandenem', datei(D, `${B}tools/da.mjs${B} ${B}tools/weg.mjs${B}`), [`${D}: tools/weg.mjs existiert nicht`])
soll('Pfad außerhalb des Repos (~/) frei', datei(D, `${B}~/.claude/server-freigaben.json${B}`), [])
soll('~/.claude/rules/ verboten', datei(D, `Regel in ${B}~/.claude/rules/10-x.md${B}`).length, 1)
soll('Hook-Meldetext (js) rot', datei('.claude/skills/x/h.js', `'Regel (.claude/rules/30-gibt-es-nicht.md): nein'`), ['.claude/skills/x/h.js: .claude/rules/30-gibt-es-nicht.md existiert nicht'])

// bewerte: Ratsche
soll('unbekannter Fund rot', bewerte(['a: p existiert nicht'], []), ['a: p existiert nicht'])
soll('bekannter Fund still', bewerte(['a: p existiert nicht'], ['a: p existiert nicht']), [])
soll('erledigter bekannter Eintrag rot', bewerte([], ['a: p existiert nicht']), ['BEKANNT veraltet, bitte streichen: a: p existiert nicht'])

// echtes Repo: Verdrahtung, null Funde
const echt = pruefeAlle(fileURLToPath(new URL('../..', import.meta.url)))
soll('echtes Repo ohne neue Funde', echt, [])

rmSync(wurzel, { recursive: true, force: true })
if (fehler) {
  console.log(`✖ anleitungs-pfade-test: ${fehler} Fehler`)
  process.exit(1)
}
console.log('✔ anleitungs-pfade-test: 21 Fälle ok (Pfad-Erkennung, Existenz, Fremdpfade, Platzhalter, Ratsche, echtes Repo)')
