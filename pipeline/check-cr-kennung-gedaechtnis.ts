/**
 * Zusicherung: **Die Crunchyroll-Serienkennung kommt aus der Adresse, sonst aus dem Kennungsgedächtnis** (`kennungMitAdressgedaechtnis`).
 * Anlass: 43 von 44 offenen Verweisen standen in der alten Slug-Form `/de/<name>` ohne Kennung; Baukatalog, geteilte Serien und
 * Crunchyroll-Wache lösen sie jetzt über dieselbe Funktion auf. Fixture-Werte sind Zeilen aus `crunchyroll-series-ids.json` (Stand 29.10.2026).
 * Läuft in `check:logic`.
 */
import { adressKern, kennungAusPfad, kennungMitAdressgedaechtnis } from './lib/cr-kennung-gedaechtnis.ts'
import { kennungMitGedaechtnis } from './lib/cr-neu-wache.ts'
import { readFileSync } from 'node:fs'

const SLUG = 'http://www.crunchyroll.com/de/a-place-further-than-the-universe'
const MIT_KENNUNG = 'https://www.crunchyroll.com/de/series/GYK541EPR/a-place-further-than-the-universe'
const GEDAECHTNIS = {
  [SLUG]: { seriesId: 'GYK541EPR' },
  'http://www.crunchyroll.com/de/acca-13-territory-inspection-dept': { seriesId: 'GR5V95N8R' },
  'http://www.crunchyroll.com/de/ohne-kennung': {},
}

const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  faelle++
  if (ist !== soll) fehler.push(`${name}: ${String(ist)} statt ${String(soll)}`)
}

const bau = kennungMitAdressgedaechtnis(GEDAECHTNIS, kennungAusPfad)
erwarte('Slug-Adresse ohne Kennung kommt aus dem Gedächtnis', bau(SLUG), 'GYK541EPR')
erwarte('Schreibweise (https, ohne www, Schlussstrich, Anhang) trifft denselben Eintrag', bau('https://crunchyroll.com/de/a-place-further-than-the-universe/?x=1'), 'GYK541EPR')
erwarte('Groß-/Kleinschreibung der Adresse ist egal', bau('http://www.CrunchyRoll.com/de/A-Place-Further-Than-The-Universe'), 'GYK541EPR')
erwarte('Gedächtnis-Eintrag ohne seriesId löst nichts auf', bau('http://www.crunchyroll.com/de/ohne-kennung'), undefined)
erwarte('unbekannte Slug-Adresse löst nichts auf', bau('http://www.crunchyroll.com/de/gibt-es-nicht'), undefined)
const vorrang = kennungMitAdressgedaechtnis({ [adressKern(MIT_KENNUNG)]: { seriesId: 'GEDAECHTNIS1' } }, kennungAusPfad)
erwarte('Kennung aus der Adresse hat Vorrang vor dem Gedächtnis', vorrang(MIT_KENNUNG), 'GYK541EPR')

const wache = kennungMitGedaechtnis(GEDAECHTNIS)
erwarte('Wache: Slug-Adresse aus dem Gedächtnis', wache(SLUG), 'GYK541EPR')
erwarte('Wache: strenge Form liest die Kennung aus crunchyroll.com/…/series/', wache(MIT_KENNUNG), 'GYK541EPR')
erwarte('Wache: fremder Host mit /series/ zählt nicht', wache('https://example.org/de/series/FREMD1234/x'), undefined)
erwarte('Katalog-Form: fremder Host mit /series/ zählt (lockerer Pfad)', bau('https://example.org/de/series/FREMD1234/x'), 'FREMD1234')

// Verdrahtung: der Baukatalog benutzt die Funktion wirklich
const katalog = readFileSync(new URL('./bau/09-4-3-katalog.ts', import.meta.url), 'utf8')
erwarte('09-4-3 ruft kennungMitAdressgedaechtnis auf', /kennungMitAdressgedaechtnis\(/.test(katalog), true)

if (fehler.length) {
  console.error(`FEHL check-cr-kennung-gedaechtnis:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-cr-kennung-gedaechtnis: ${faelle} Fälle ok.`)
