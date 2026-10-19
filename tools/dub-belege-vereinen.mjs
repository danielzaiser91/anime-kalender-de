/**
 * **Belege zusammenführen statt überschreiben.**
 *
 * `commit-data.sh` rettet die Quellen aus dem Arbeitsverzeichnis, setzt hart
 * auf den Fernstand und spielt sie zurück. Für alle anderen Quellen ist das
 * richtig — der Lauf hat sie gerade frisch geholt. Für `dub-confirmed.yaml`
 * ist es falsch: Sie **wächst**, und der Fernstand kann Belege tragen, die
 * dieser Lauf nie gesehen hat.
 *
 * Am 31.08.2026 hat genau das 300 Belege gekostet. Zwei Bauläufe liefen kurz
 * hintereinander, dazwischen kam ein Push mit 210 neuen Belegen; der ältere
 * Lauf spielte seinen Stand zurück und committete ihn. Die Prüfliste sprang
 * von 2 auf 61 offene Titel, und die Ursache war von außen nicht zu sehen.
 *
 * Verglichen wird Block für Block, Zeichen für Zeichen: Was im Fernstand
 * steht, bleibt unangetastet; was nur im Arbeitsstand steht, kommt dahinter.
 * Bereits vorhandene Mehrfacheinträge im Fernstand bleiben; ergänzt wird nichts,
 * was inhaltlich schon dasteht (sonst schlägt `check:logic` „kein Beleg zweimal
 * in der Datei" an, Lauf 39241977425).
 *
 * Aufruf: node tools/dub-belege-vereinen.mjs <fernstand.yaml> <arbeitsstand.yaml>
 * Geschrieben wird der **erste** Pfad.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import yaml from 'js-yaml'

const [fern, arbeit] = process.argv.slice(2)
if (!fern || !arbeit) {
  console.error('Aufruf: node tools/dub-belege-vereinen.mjs <fernstand> <arbeitsstand>')
  process.exit(2)
}
if (!existsSync(fern) || !existsSync(arbeit)) {
  console.error('Eine der beiden Dateien fehlt — nichts zu vereinen.')
  process.exit(0)
}

const bloecke = (text) =>
  text
    .split(/\n(?=- anilistId: )/)
    .map((b) => b.replace(/\s+$/, ''))
    .filter((b) => b.trim())

const fernText = readFileSync(fern, 'utf8')
// Verglichen wird der Inhalt, nicht der Text: Kommentarzeilen zwischen Blöcken
// kleben am Block davor und machen sonst aus einem Beleg einen „neuen".
const inhalt = (b) => {
  try {
    return JSON.stringify(yaml.load(b))
  } catch {
    return b
  }
}
const da = new Set(bloecke(fernText).map(inhalt))
const fehlend = bloecke(readFileSync(arbeit, 'utf8')).filter((b) => {
  const k = inhalt(b)
  if (da.has(k)) return false
  da.add(k) // auch im Arbeitsstand selbst nicht doppelt ergänzen
  return true
})

if (!fehlend.length) {
  console.log('Keine zusätzlichen Belege im Arbeitsstand.')
  process.exit(0)
}
writeFileSync(fern, fernText.replace(/\s+$/, '') + '\n\n' + fehlend.join('\n\n') + '\n')
console.log(`${fehlend.length} Beleg(e) aus dem Arbeitsstand ergänzt.`)
