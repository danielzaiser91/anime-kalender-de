/**
 * Zusicherung: Das Urteil „Seite ist nicht das Werk“ (`seiteNichtWerk`) überlebt eine jüngere Messung derselben Prime-Seite.
 * Anlass How Heavy Are the Dumbbells (138103, B0CZSMKH71): Nein vom 13.09. (Hauptserie statt Special), Messung vom 16.10. (12 Folgen deutsch);
 * ohne das Feld gewann die jüngere Messung, bis das Nein von Hand neu datiert wurde (28.10.).
 * Geprüft wird der echte Weg: Handbeleg-Datei einer Kulisse (`AK_ROOT`) → `ladeHandbelege`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-seite-nicht-werk.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-seite-nicht-werk-'))
mkdirSync(join(kulisse, 'data'))
process.env.AK_ROOT = kulisse
const { ladeHandbelege, urteilVon, neinHandbelege, wegVerneint } = await import('./lib/dub-confirmed.ts')

const URL = 'https://www.amazon.de/dp/B0CZSMKH71'
const KOPF = `- anilistId: 138103
  title: "How Heavy Are the Dumbbells You Lift? Gnadenlose Trainingsstunde"
  platform: primevideo
  url: ${URL}
`
/** Die echten Zeilen (dub-confirmed.yaml), Notizen gekürzt. */
const NEIN = `${KOPF}  available: false
  checkedAt: '2026-09-13'
  note: "Die Seite ist nicht das Special, sondern die Hauptserie als Kauftitel."
`
const NEIN_FELD = `${KOPF}  available: false
  seiteNichtWerk: true
  checkedAt: '2026-09-13'
  note: "Die Seite ist nicht das Special, sondern die Hauptserie als Kauftitel."
`
const MESSUNG = `${KOPF}  dub: true
  checkedAt: '2026-10-16'
  note: "Tonspuren: Deutsch — alle 12 Folgen geprüft"
`
const MESSUNG_BEREICH = `${KOPF}  dub: true
  dubRanges:
    - { from: 1, to: 12, dub: true }
  checkedAt: '2026-10-16'
  note: "Tonspuren: Deutsch — alle 12 Folgen geprüft"
`

function geladen(zeilen: string[]) {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  const alle = ladeHandbelege().filter((c) => c.anilistId === 138103)
  return { alle, check: alle[0]!, verneint: wegVerneint(neinHandbelege(alle), 138103, 'primevideo', URL) }
}

try {
  console.log('\nGegenprobe ohne Feld (Ist vor dem Feld): die jüngere Messung gewinnt')
  const ohne = geladen([NEIN, MESSUNG])
  pruefe('Nein ohne Feld, jüngere Messung: Urteil ja, Weg nicht verneint', urteilVon(ohne.check) === 'ja' && !ohne.verneint, ohne.check)

  console.log('\nMit Feld: die Messung hebt das Urteil nicht auf')
  for (const [name, zeilen] of [
    ['Nein (Feld), jüngere Messung', [NEIN_FELD, MESSUNG]],
    ['Messung vor Nein in der Datei', [MESSUNG, NEIN_FELD]],
    ['jüngere Messung mit Bereichen', [NEIN_FELD, MESSUNG_BEREICH]],
    ['Messung, Nein (Feld), noch jüngere Messung', [MESSUNG, NEIN_FELD, MESSUNG.replace('2026-10-16', '2026-11-05')]],
  ] as const) {
    const g = geladen([...zeilen])
    pruefe(`${name}: ein Beleg, available false, Urteil nein`, g.alle.length === 1 && g.check.available === false && urteilVon(g.check) === 'nein', g.check)
    pruefe(`${name}: Messwerte der falschen Seite fehlen, Feld bleibt`, g.check.dub === undefined && g.check.dubRanges === undefined && g.check.seiteNichtWerk === true, g.check)
    pruefe(`${name}: der Weg gilt als verneint`, g.verneint)
  }

  console.log('\nNein (Feld) JÜNGER als die Messung: gilt ebenso (beide Zeilen werden gelesen, nicht nur die ältere)')
  const JUENGER = NEIN_FELD.replace('2026-09-13', '2026-11-05')
  const juenger = geladen([MESSUNG, JUENGER])
  pruefe('Messung 16.10., Nein (Feld) 05.11.: ein Beleg, Urteil nein, Messwerte fehlen, verneint',
    juenger.alle.length === 1 && urteilVon(juenger.check) === 'nein' && juenger.check.dub === undefined && juenger.check.seiteNichtWerk === true && juenger.verneint, juenger.check)
  const juengerRev = geladen([JUENGER, MESSUNG])
  pruefe('dieselben Zeilen in umgekehrter Dateireihenfolge: verneint', juengerRev.alle.length === 1 && juengerRev.verneint && urteilVon(juengerRev.check) === 'nein', juengerRev.check)

  console.log('\nAndere Adresse, gleicher Titel: ein echtes Ja bleibt unberührt')
  const ANDERE_URL = 'https://www.amazon.de/dp/B0AAAAAAAA'
  const zwei = geladen([NEIN_FELD, MESSUNG.replace(URL, ANDERE_URL)])
  pruefe('zwei Belege (je Adresse)', zwei.alle.length === 2, zwei.alle)
  const ja = zwei.alle.find((c) => c.url === ANDERE_URL)
  const nein = zwei.alle.find((c) => c.url === URL)
  pruefe('andere Adresse: Urteil ja, kein Feld', !!ja && urteilVon(ja) === 'ja' && ja.seiteNichtWerk === undefined, ja)
  pruefe('Adresse mit Feld: nein, verneint', !!nein && urteilVon(nein) === 'nein' && zwei.verneint, nein)
  pruefe('andere Adresse nicht verneint', !wegVerneint(neinHandbelege(zwei.alle), 138103, 'primevideo', ANDERE_URL))

  console.log('\nOhne Feld gewinnt die Messung weiter (Gegenprobe, andere Zeile gleicher Art)')
  const nur = geladen([MESSUNG_BEREICH])
  pruefe('nur Messung: kein Nein, Bereiche bleiben', urteilVon(nur.check) === 'ja' && nur.check.dubRanges?.length === 1 && !nur.verneint, nur.check)
  const allein = geladen([NEIN_FELD])
  pruefe('Nein (Feld) allein: verneint', allein.verneint && allein.check.seiteNichtWerk === true, allein.check)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
