/**
 * **Die Kanal-Nachmessung kommt auf die Prüfliste und fällt mit der Messung heraus** (12.10.2026).
 *
 * Ein Kanal-Titel ohne `kanal: true` bleibt von der Wiedervorlage ausgenommen (`verdacht-kanal.test.mjs`). Mit `kanal: true` kommt er
 * auf die Liste, trägt seinen `vorrang`, und eine Messung ab `seit` beendet die Wiedervorlage — auch ein Nein, das keinen Beleg
 * mit Urteil erzeugt, sondern nur `kanalMessung: nein`.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verdachtsFelder, verdachtsfaelle } from './verdacht.mjs'

const w = mkdtempSync(join(tmpdir(), 'verdacht-nachmessung-'))
mkdirSync(join(w, 'data'), { recursive: true })
const eintrag = (id, extra) => `- { anilistId: ${id}, platform: primevideo, seit: '2026-10-13', grund: 'Nachmessung'${extra} }\n`
writeFileSync(
  join(w, 'data', 'erneut-melden.yaml'),
  eintrag(1, ', kanal: true, vorrang: 1') + eintrag(2, ', kanal: true, vorrang: 2') + eintrag(3, ', kanal: true') + eintrag(4, ''),
)
const note = 'Tonspuren: Deutsch — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
const beleg = (id, checkedAt, extra) =>
  `- anilistId: ${id}\n  platform: primevideo\n  url: https://www.amazon.de/dp/B00000000${id}\n  checkedAt: '${checkedAt}'\n  note: "${note}"\n${extra}`
writeFileSync(
  join(w, 'data', 'dub-confirmed.yaml'),
  beleg(1, '2026-08-30', '  dub: true\n') +
    beleg(2, '2026-08-30', '  dub: true\n') +
    beleg(2, '2026-10-14', '  kanalMessung: nein\n') +
    beleg(3, '2026-08-30', '  dub: true\n') +
    beleg(4, '2026-08-30', '  dub: true\n'),
)

const faelle = verdachtsfaelle(w, 'primevideo')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

pruefe('Kanal-Titel mit kanal: true kommt auf die Liste', faelle.has(1))
pruefe('der Vorrang reist mit', faelle.get(1)?.vorrang === 1, faelle.get(1))
pruefe('ein Nein ab dem Stichtag beendet die Wiedervorlage', !faelle.has(2))
pruefe('ohne Vorrang kein Vorrangfeld', faelle.has(3) && faelle.get(3).vorrang === undefined, faelle.get(3))
pruefe('Kanal-Titel ohne kanal: true bleibt ausgenommen', !faelle.has(4))
pruefe('der Listeneintrag trägt Satz und Vorrang', verdachtsFelder(faelle.get(1)).vorrang === 1 && /Wiedervorlage/.test(verdachtsFelder(faelle.get(1)).erneut))
pruefe('ohne Vorrang trägt er nur den Satz', !('vorrang' in verdachtsFelder(faelle.get(3))))

if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Kanal-Nachmessung auf der Liste halten.')
