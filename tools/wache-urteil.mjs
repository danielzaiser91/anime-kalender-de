#!/usr/bin/env node
/**
 * **Wachen-Urteil als Claude-Lauf** (Fahrplan Schritt 3, `docs/autonomie-plan.md`): die Wachen (`delta-wache.yml`) zählen und melden,
 * beurteilen kann sie nicht. Dieses Werkzeug legt für `claude-wache-urteil.yml` die Befunde in einen Ordner und übernimmt das Urteil zurück.
 *
 *   node tools/wache-urteil.mjs --sammeln --verzeichnis <ordner>     # schreibt <ordner>/dossier/*.txt|md (und legt ergebnis/ an)
 *   node tools/wache-urteil.mjs --uebernehmen --verzeichnis <ordner> # prüft ergebnis/urteil.md, setzt den Eintrag oben in 00-wache-auswertung.md
 *
 * Claude liest nur das Dossier und schreibt nur `ergebnis/urteil.md`; Datum und Überschrift setzt dieses Werkzeug. Bei „Lage: ruhig" bleibt
 * die Datei unverändert (Daniel, 26.09.2026: still bei Ruhe) – dass die Wache lief, zeigt der grüne Lauf.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sammle } from './wache-urteil-dossier.mjs'
import { pruefeUrteil, setzeEin } from './wache-urteil-eintrag.mjs'

const AUSWERTUNG = 'daniel-zum-abarbeiten/00-wache-auswertung.md'

function sammeln(ordner) {
  mkdirSync(resolve(ordner, 'dossier'), { recursive: true })
  mkdirSync(resolve(ordner, 'ergebnis'), { recursive: true })
  for (const [name, inhalt] of sammle()) writeFileSync(resolve(ordner, 'dossier', name), inhalt, 'utf8')
  console.log('Dossier bereit.')
}

function uebernehmen(ordner) {
  const pfad = resolve(ordner, 'ergebnis', 'urteil.md')
  const text = existsSync(pfad) ? readFileSync(pfad, 'utf8') : ''
  const ergebnis = pruefeUrteil(text)
  if (!ergebnis.ok) throw new Error(`Urteil unbrauchbar: ${ergebnis.fehler}`)
  const zusammen = `Urteil (${ergebnis.lage}):\n\n${ergebnis.absaetze.join('\n\n')}\n`
  console.log(zusammen)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${zusammen}\n`)
  writeFileSync(resolve(ordner, 'zusammenfassung.md'), zusammen, 'utf8')
  if (ergebnis.lage === 'ruhig') {
    console.log('Lage ruhig: nichts einzutragen.')
    return
  }
  writeFileSync(AUSWERTUNG, setzeEin(readFileSync(AUSWERTUNG, 'utf8'), ergebnis, new Date()), 'utf8')
  console.log(`Eintrag oben in ${AUSWERTUNG} gesetzt.`)
}

const args = process.argv.slice(2)
const ordner = /--verzeichnis[= ](\S+)/.exec(args.join(' '))?.[1]
if (!ordner || !(args.includes('--sammeln') || args.includes('--uebernehmen'))) {
  console.error('Aufruf: wache-urteil.mjs --sammeln|--uebernehmen --verzeichnis <ordner>')
  process.exit(1)
}
try {
  if (args.includes('--sammeln')) sammeln(ordner)
  else uebernehmen(ordner)
} catch (fehler) {
  console.error(fehler.message)
  process.exit(1)
}
