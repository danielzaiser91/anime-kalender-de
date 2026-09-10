#!/usr/bin/env node
/**
 * **Die Adresse aus der Notiz wird zum Feld.**
 *
 * 855 Belege in `data/dub-confirmed.yaml` nennen in ihrer Notiz die Amazon-Seite,
 * auf der gemessen wurde („Amazon-Seite B07L1CMH2D: alle 0 Folgen geprüft").
 * 497 davon tragen **kein** `url`-Feld — und ohne das gilt der Befund für jede
 * Adresse dieser Plattform, auch für später hinzukommende.
 *
 * Bei den Belegen mit **entfernendem** Urteil (`dub: false`, `available: false`)
 * ist das folgenreich: Gemessen am 10.09.2026 zeigen **acht** davon auf eine
 * andere Seite als der Verweis, den sie entfernen — dieselbe Klasse wie „Date a
 * Live IV" (07.09.2026), wo ein Kanal-Beleg den Abo-Verweis mitnahm.
 *
 * **Ergänzt, nicht geändert.** Das Skript schreibt genau die Kennung, die in
 * der Notiz desselben Belegs steht — es fügt keine Auskunft hinzu, es macht
 * eine vorhandene maschinenlesbar. Urteile, Bereiche und Notizen bleiben
 * unangetastet; ein Beleg, der schon ein `url`-Feld hat, wird übersprungen.
 *
 * Aufruf: `node tools/beleg-adresse-nachtragen.mjs [--schreiben]`
 * Ohne `--schreiben` wird nur gezählt.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SCHREIBEN = process.argv.includes('--schreiben')
const DATEI = 'data/dub-confirmed.yaml'

const roh = readFileSync(DATEI, 'utf8')
const bloecke = roh.split(/\n(?=- anilistId:)/)

let ergaenzt = 0
let hatteSchon = 0
let ohneKennung = 0

const neu = bloecke.map((block) => {
  const kennung = /Amazon-Seite ([A-Z0-9]{8,})/.exec(block)?.[1]
  if (!kennung) {
    ohneKennung++
    return block
  }
  if (/^\s+url:/m.test(block)) {
    hatteSchon++
    return block
  }
  /* Nur Amazon-Belege — die Kennung stammt aus einer Amazon-Notiz. */
  if (!/^\s+platform:\s*primevideo\s*$/m.test(block)) return block
  /*
    Die Zeile steht direkt hinter `platform:` — dort steht sie auch bei den
    Belegen, die `fetch-pruefungen.ts` selbst schreibt. Gleiche Reihenfolge
    heißt: Der Diff bleibt lesbar, wenn beide Wege dieselbe Datei anfassen.
  */
  ergaenzt++
  return block.replace(
    /^(\s+platform:\s*primevideo\s*)$/m,
    `$1\n  url: https://www.amazon.de/gp/video/detail/${kennung}`,
  )
})

console.log(`${bloecke.length} Belege gelesen`)
console.log(`  ${ergaenzt} bekommen die Adresse aus ihrer eigenen Notiz`)
console.log(`  ${hatteSchon} hatten schon eine`)
console.log(`  ${ohneKennung} nennen keine Amazon-Seite`)

if (!SCHREIBEN) {
  console.log('\nTrockenlauf — mit --schreiben wird die Datei geändert.')
  process.exit(0)
}
writeFileSync(DATEI, neu.join('\n'))
console.log(`\n${DATEI} geschrieben.`)
