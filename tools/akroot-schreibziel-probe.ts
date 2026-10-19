/**
 * Sonde zu `akroot-schreibziel.test.mjs`: ruft die Schreiber auf, die der Bau unter einer Kulisse (`AK_ROOT`) erreicht,
 * und nennt ihre Ziele. Der Aufrufer prüft, dass alles unter der Kulisse landet und der Repo-Baum unberührt bleibt.
 * Die Listen-Schreiber laufen mit Inhalt und zweimal: der zweite Lauf meldet nichts, weil die Kulissen-Datei schon gleich ist
 * (ein Leser, der die Repo-Datei statt der Kulissen-Datei vergleicht, meldet ein zweites Mal).
 */
import { meldeAnClaude } from '../pipeline/lib/meldung.ts'
import { schreibeNurOriginalton } from '../pipeline/lib/nur-originalton-liste.ts'
import { schreibeOhneFundstelle } from '../pipeline/lib/beleg-ohne-fundstelle.ts'
import { BILD_FASSUNG } from '../pipeline/lib/beleg-bild.ts'
import { VOICES_DIR } from '../pipeline/bau/grundlagen.ts'

const meldung = [{ articleTitle: 'Sonde', articleUrl: 'https://sonde.invalid/a', publishedAt: '2026-01-01', dates: [{ iso: '2026-01-02', context: 'Originalton' }] }]
const gedaechtnis = { 'https://sonde.invalid/b': { lesungen: [{ qs: 'ok', bild: 'x', am: '2026-01-01', bildfassung: BILD_FASSUNG }] } }

meldeAnClaude('sonde', 'hinweis', 'Sonde')
for (let i = 0; i < 2; i++) {
  schreibeNurOriginalton(meldung)
  // @ts-expect-error Attrappe mit den gelesenen Feldern
  schreibeOhneFundstelle(gedaechtnis, new Map())
}
console.log(JSON.stringify({ voicesDir: VOICES_DIR }))
