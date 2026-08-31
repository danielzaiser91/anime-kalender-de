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
 * Mehrfacheinträge bleiben erhalten — welcher Beleg gilt, entscheidet der Bau
 * über `checkedAt`, nicht diese Datei.
 *
 * Aufruf: node tools/dub-belege-vereinen.mjs <fernstand.yaml> <arbeitsstand.yaml>
 * Geschrieben wird der **erste** Pfad.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

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
const da = new Set(bloecke(fernText))
const fehlend = bloecke(readFileSync(arbeit, 'utf8')).filter((b) => !da.has(b))

if (!fehlend.length) {
  console.log('Keine zusätzlichen Belege im Arbeitsstand.')
  process.exit(0)
}
writeFileSync(fern, fernText.replace(/\s+$/, '') + '\n\n' + fehlend.join('\n\n') + '\n')
console.log(`${fehlend.length} Beleg(e) aus dem Arbeitsstand ergänzt.`)
