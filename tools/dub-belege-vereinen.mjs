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
 * Verglichen wird Block für Block nach Inhalt (geparster Beleg, dieselbe Form
 * wie die Zusicherung in check-logic): Was im Fernstand steht, bleibt
 * unangetastet; was nur im Arbeitsstand steht, kommt dahinter, jeder Beleg
 * höchstens einmal. Textvergleich reichte nicht: Kommentarzeilen am Block
 * („# --- Aus dem Browser gemeldet …") ließen denselben Beleg doppelt entstehen, und derselbe
 * Beleg mit und ohne diese Zeile landete doppelt in der Datei (19.10.2026).
 * Mehrfacheinträge bleiben erhalten — welcher Beleg gilt, entscheidet der Bau
 * über `checkedAt`, nicht diese Datei.
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

/*
  Ein Block ist ein Beleg samt den Kommentarzeilen davor: der Abschnittskopf „# --- Aus dem Browser gemeldet …“
  gehört zum Beleg dahinter (`tools/poc-urteil/beobachtungen.mjs` liest ihn) und kommt mit ihm. Reine Kommentarblöcke
  am Dateiende zählen nicht.
*/
const bloecke = (text) => {
  const liste = []
  let aktuell = []
  let imBeleg = false
  for (const zeile of text.split('\n')) {
    const beginntBeleg = zeile.startsWith('- anilistId: ')
    if (imBeleg && (beginntBeleg || zeile.startsWith('#'))) {
      liste.push(aktuell)
      aktuell = []
      imBeleg = false
    }
    if (beginntBeleg) imBeleg = true
    aktuell.push(zeile)
  }
  liste.push(aktuell)
  return liste.map((z) => z.join('\n').replace(/\s+$/, '')).filter((b) => /^- /m.test(b))
}

/* Inhalt des Belegs; ein Block, der nicht lesbar ist, gilt nach seinem Text. */
const inhalt = (block) => {
  try {
    const liste = yaml.load(block)
    return Array.isArray(liste) && liste.length === 1 ? JSON.stringify(liste[0]) : block
  } catch {
    return block
  }
}

const fernText = readFileSync(fern, 'utf8')
const da = new Set(bloecke(fernText).map(inhalt))
const fehlend = bloecke(readFileSync(arbeit, 'utf8')).filter((b) => {
  const schluessel = inhalt(b)
  if (da.has(schluessel)) return false
  da.add(schluessel)
  return true
})

if (!fehlend.length) {
  console.log('Keine zusätzlichen Belege im Arbeitsstand.')
  process.exit(0)
}
writeFileSync(fern, fernText.replace(/\s+$/, '') + '\n\n' + fehlend.join('\n\n') + '\n')
console.log(`${fehlend.length} Beleg(e) aus dem Arbeitsstand ergänzt.`)
