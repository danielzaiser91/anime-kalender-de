/**
 * **Ein Kanal-Titel kommt nicht als Wiedervorlage zurück** (30.09.2026).
 *
 * Daniels drei Amazon-Einträge (Akame ga Kill, There's No Freaking Way, Hell Mode) ließen sich über
 * Prime nie abräumen: Ihre Belege sind **Kanal-Titel**, und dort ist Amazons Sprachangabe laut
 * eigener Regel kein Beleg — der Prime-Durchgang erzeugt nie einen gültigen Nachweis, die
 * Wiedervorlage liefe endlos. Gemessen: **139 der 367** Einträge in `data/erneut-melden.yaml` haben
 * nur solche Belege.
 *
 * Geprüft wird mit echten Dateien in einem eigenen Ordner: Ein Kanal-Titel fällt heraus, ein
 * normaler Beleg bleibt.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verdachtsfaelle } from './verdacht.mjs'

const w = mkdtempSync(join(tmpdir(), 'verdacht-kanal-'))
mkdirSync(join(w, 'data'), { recursive: true })
writeFileSync(
  join(w, 'data', 'erneut-melden.yaml'),
  `- { anilistId: 1, platform: primevideo, seit: '2026-09-01', grund: 'Alter Beleg' }\n` +
    `- { anilistId: 2, platform: primevideo, seit: '2026-09-01', grund: 'Alter Beleg' }\n`,
)
writeFileSync(
  join(w, 'data', 'dub-confirmed.yaml'),
  `- anilistId: 1\n  platform: primevideo\n  url: https://www.amazon.de/dp/B000000001\n  dub: true\n  checkedAt: '2026-08-01'\n  note: "Tonspuren: Deutsch — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg"\n` +
    `- anilistId: 2\n  platform: primevideo\n  url: https://www.amazon.de/dp/B000000002\n  dub: true\n  checkedAt: '2026-08-01'\n  note: "Tonspuren: Deutsch"\n`,
)

const faelle = verdachtsfaelle(w, 'primevideo')
const fehler = []
const pruefe = (name, bedingung) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}`)
}

console.log('Kanal-Titel ohne Wiedervorlage')

pruefe('ein Kanal-Titel kommt nicht auf die Liste', faelle.has(1) === false)
pruefe('ein normaler Beleg schon', faelle.has(2) === true)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Kanal-Wiedervorlage halten.')
