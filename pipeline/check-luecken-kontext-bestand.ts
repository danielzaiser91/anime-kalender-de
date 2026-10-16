/**
 * Verdrahtung von `ladeKontext` (`pipeline/lib/luecken-kontext.ts`): `staffel0` muss aus `data/tmdb-staffel0.json` kommen.
 * `ladeKontext` liest auch `public/data`, deshalb Bestandsprüfung (`check:bestand`); die Einheitenprüfung von `ladeStaffel0` steht in `tools/lueckenlisten.test.mjs`.
 */
import { readFileSync } from 'node:fs'
import { ladeKontext } from './lib/luecken-kontext.ts'

const datei = JSON.parse(readFileSync('data/tmdb-staffel0.json', 'utf8')) as Record<string, unknown>
const geladen = ladeKontext('2026-10-14').staffel0
const gleich = Object.keys(datei).length > 0 && JSON.stringify(Object.keys(geladen)) === JSON.stringify(Object.keys(datei))
if (!gleich) {
  console.error('FEHLER: ladeKontext liefert nicht den Inhalt von data/tmdb-staffel0.json als staffel0')
  process.exit(1)
}
console.log('check-luecken-kontext-bestand: ladeKontext reicht staffel0 durch.')
