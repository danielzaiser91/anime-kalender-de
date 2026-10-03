/**
 * Prüft das Gedächtnis der Beleg-Lesungen (`data/beleg-lesungen.json`) auf Doppeltes und Rauschen.
 *
 * Gemessen wird: Wie viele Adressen haben mehr als eine Lesung, und wie viele dieser Wechsel sind
 * „Rauschen" (nur der Hash ändert sich, Veröffentlicht/Aktualisiert bleiben) — ein Hinweis, dass
 * etwas Veränderliches (Empfehlungen, Zähler) im Text steht und jede Lesung ein neues Bild erzeugt.
 *
 * Aufruf: node tools/belege-pruefen.mjs   (Exit 1 bei Verstoß)
 */
import { readFileSync } from 'node:fs'

const g = JSON.parse(readFileSync('data/beleg-lesungen.json', 'utf8'))
const urls = Object.keys(g)
const fehler = []
let lesungen = 0
let mehrfach = 0
let rauschen = 0
for (const url of urls) {
  const l = g[url].lesungen
  lesungen += l.length
  if (l.length > 1) mehrfach++
  for (let i = 1; i < l.length; i++)
    if (l[i].hash !== l[i - 1].hash && l[i].aktualisiert === l[i - 1].aktualisiert && l[i].veroeffentlicht === l[i - 1].veroeffentlicht) rauschen++
  for (const e of l) {
    if (!e.bild) fehler.push(`${url} ${e.am}: Lesung ohne Bild`)
    if (/anisearch\.de\/article\//.test(url) && e.veroeffentlicht) fehler.push(`${url}: Produktseite mit Veröffentlichungsdatum`)
  }
  for (let i = 1; i < l.length; i++)
    if (l[i].hash === l[i - 1].hash && l[i].bild && l[i].bild !== l[i - 1].bild) fehler.push(`${url} ${l[i].am}: gleicher Text, neues Bild`)
}
const wechsel = lesungen - urls.length
console.log(`${urls.length} Adressen, ${lesungen} Lesungen, ${mehrfach} mit mehr als einer, ${rauschen} von ${wechsel} Wechseln ohne Datumsänderung (Rauschen)`)
/* Bei mehr als einem Viertel Rauschen (ab 8 Wechseln) ist der Text nicht stabil genug für einen Hash. */
if (wechsel >= 8 && rauschen / wechsel > 0.25) fehler.push(`Rauschen ${rauschen}/${wechsel}: Hash ist nicht stabil`)
for (const f of fehler) console.log('✗', f)
console.log(fehler.length ? `${fehler.length} Verstöße` : 'in Ordnung')
process.exit(fehler.length ? 1 : 0)
