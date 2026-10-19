/**
 * Sonde zu `akroot-schreibziel.test.mjs`: ruft die Schreiber auf, die der Bau unter einer Kulisse (`AK_ROOT`) erreicht,
 * und nennt ihre Ziele. Der Aufrufer prüft, dass alles unter der Kulisse landet und der Repo-Baum unberührt bleibt.
 */
import { meldeAnClaude } from '../pipeline/lib/meldung.ts'
import { schreibeNurOriginalton } from '../pipeline/lib/nur-originalton-liste.ts'
import { schreibeOhneFundstelle } from '../pipeline/lib/beleg-ohne-fundstelle.ts'
import { VOICES_DIR } from '../pipeline/bau/grundlagen.ts'

meldeAnClaude('sonde', 'hinweis', 'Sonde')
schreibeNurOriginalton([])
schreibeOhneFundstelle({}, new Map())
console.log(JSON.stringify({ voicesDir: VOICES_DIR }))
