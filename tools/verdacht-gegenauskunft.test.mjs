/**
 * **Ein altes Nein, dem JustWatch später deutschen Ton entgegenhält, kommt auf die Prüfliste.**
 *
 * Der Fall „Rooster Fighter": Gebiets-Beleg „nicht verfügbar" vom 26.08., JustWatch am 17.09.
 * Disney+ mit deutschem Ton. Geprüft wird mit echten Dateien in einem eigenen Ordner: Der alte
 * Nein-Beleg kommt auf die Liste, ein neuerer Ja-Beleg nimmt ihn wieder herunter, ein Nein, das
 * jünger ist als JustWatch, bleibt stehen, und ein Kauf-Angebot zählt nicht.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verdachtHinweis, verdachtsfaelle } from './verdacht.mjs'

const w = mkdtempSync(join(tmpdir(), 'verdacht-gegenauskunft-'))
mkdirSync(join(w, 'data'), { recursive: true })
const beleg = (id, feld, am) => `- anilistId: ${id}\n  platform: disneyplus\n  ${feld}\n  checkedAt: '${am}'\n`
writeFileSync(
  join(w, 'data', 'dub-confirmed.yaml'),
  beleg(1, 'available: false', '2026-08-26') +
    beleg(2, 'available: false', '2026-08-26') +
    beleg(2, 'dub: true', '2026-10-02') +
    beleg(3, 'dub: false', '2026-09-20') +
    beleg(4, 'available: false', '2026-08-26'),
)
const angebot = (art) => ({ anbieter: 'Disney Plus', art, audio: ['de', 'ja'] })
writeFileSync(
  join(w, 'data', 'justwatch-audio.json'),
  JSON.stringify({
    1: { geprueftAm: '2026-09-17', angebote: [angebot('FLATRATE')] },
    2: { geprueftAm: '2026-09-17', angebote: [angebot('FLATRATE')] },
    3: { geprueftAm: '2026-09-17', angebote: [angebot('FLATRATE')] },
    4: { geprueftAm: '2026-09-17', angebote: [angebot('BUY')] },
  }),
)

const faelle = verdachtsfaelle(w, 'disneyplus')
const fehler = []
const pruefe = (name, bedingung) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}`)
}

console.log('Altes Nein gegen neuere JustWatch-Auskunft')
pruefe('altes „nicht verfügbar", später JustWatch mit deutschem Ton → Prüfliste', faelle.get(1)?.gegenauskunft === 'JustWatch')
pruefe('ein neuerer Ja-Beleg nimmt den Titel wieder herunter', !faelle.has(2))
pruefe('ein Nein, jünger als JustWatch, bleibt stehen', !faelle.has(3))
pruefe('ein Kauf-Angebot ist kein Widerspruch', !faelle.has(4))
pruefe('der Hinweis nennt Quelle und Datum', /JustWatch nennt hier seit 2026-09-17 deutschen Ton/.test(verdachtHinweis(faelle.get(1) ?? {})))
process.exitCode = fehler.length ? 1 : 0
