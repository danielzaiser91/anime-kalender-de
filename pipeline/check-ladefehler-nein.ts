/**
 * Zusicherung: Ein Nein aus einer Messung, die keine Folge gelesen hat („nur 0 von N Folgen geladen“, ohne `regionsperre=`),
 * ist eine Nichtauskunft und hebt kein Urteil derselben Adresse auf — in jeder Reihenfolge der Zeilen.
 * Anlass Chaika (20462, 20719, Prime): Ja vom 28.08. („alle 10 Folgen geprüft“), `dub: false` vom 28.09. „nur 0 von 12 Folgen geladen“ an derselben Adresse;
 * das jüngere Nein gewann in `verschmelze`. Die Chaika-Zeilen tragen aber `regionsperre=` (gemessene Sperre der Seite): das bleibt ein Nein.
 * Gegenproben: ein Nein mit gelesenen Folgen („nur 6 von 8“) gewinnt weiter, ein Ladefehler-Nein ohne Urteil daneben bleibt stehen, ein jüngeres Ja gewinnt.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-ladefehler-nein.ts`
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-ladefehler-nein-'))
mkdirSync(join(kulisse, 'data'))
process.env.AK_ROOT = kulisse
const { ladeHandbelege, verschmelze, urteilVon, neinHandbelege, ladefehlerNein, nurLadefehlerJuenger } = await import('./lib/dub-confirmed.ts')

const JA = `- anilistId: 20462
  title: "Chaika, die Sargprinzessin"
  platform: primevideo
  url: https://www.amazon.de/dp/B07LHCSXV6
  dub: true
  checkedAt: '2026-08-28'
  note: "Tonspuren: Deutsch — Amazon-Seite B07LHCSXV6: alle 10 Folgen geprüft, Abos: Prime, zugang=abo_und_kauf"
`
const NEIN_REGION = `- anilistId: 20462
  title: "Chaika, die Sargprinzessin"
  platform: primevideo
  url: https://www.amazon.de/gp/video/detail/B07LHCSXV6
  dub: false
  checkedAt: '2026-09-28'
  note: "Amazon-Seite B07LHCSXV6: nur 0 von 12 Folgen geladen — Rest ungeprüft, Abos: keine Angabe, gti=amzn1.dv.gti.4ab3e446-1e73-5556-5d01-9905ded6ea33, regionsperre=laut Seite nicht mehr im Abo"
`
const NEIN = NEIN_REGION.replace(', regionsperre=laut Seite nicht mehr im Abo', '')
const NEIN_ANDERE_NOTIZ = NEIN.replace('B07LHCSXV6: nur', 'B07LHFLDBS: nur')
const NEIN_AVAILABLE = NEIN.replace('dub: false', 'available: false')
const NEIN_TEIL = NEIN.replace('nur 0 von 12', 'nur 6 von 8')
const NEIN_ZEHN = NEIN.replace('nur 0 von 12', 'nur 10 von 12')
const NEIN_DEUTSCH = NEIN.replace('Folgen geladen', 'Folgen deutsch')
const NEIN_OHNE_NOTIZ = NEIN.replace(/  note: .*\n/, '')
const JA_NEU = JA.replace('2026-08-28', '2026-10-30')
const JA_MIT_LADEFEHLER_NOTIZ = JA_NEU.replace('alle 10 Folgen geprüft', 'nur 0 von 12 Folgen geladen')
const NUR_ADRESSE = `- anilistId: 20462
  title: "Chaika, die Sargprinzessin"
  platform: primevideo
  url: https://www.amazon.de/dp/B07LHCSXV6
  checkedAt: '2026-08-01'
  note: "Verweis aus der Staffelliste erschlossen"
`
const JA_FRUEH = JA.replace('2026-08-28', '2026-08-01')
const NEIN_ECHT = NEIN_TEIL.replace('2026-09-28', '2026-08-15')
const NEIN_LADEFEHLER_SPAET = NEIN.replace('2026-09-28', '2026-09-01')

function lade(zeilen: string[]) {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  return ladeHandbelege().filter((c) => c.anilistId === 20462)
}
const urteile = (zeilen: string[]) => lade(zeilen).map((c) => urteilVon(c))
const verneint = (zeilen: string[]) => [...neinHandbelege(lade(zeilen))]
const ein = (zeilen: string[], erwartet: string) => JSON.stringify(urteile(zeilen)) === `["${erwartet}"]`

pruefe('Ja, dann Ladefehler-Nein (dub: false): ein Eintrag, Urteil ja', ein([JA, NEIN], 'ja'), urteile([JA, NEIN]))
pruefe('Reihenfolge in der Datei egal: Ladefehler-Nein vor dem Ja', ein([NEIN, JA], 'ja'), urteile([NEIN, JA]))
pruefe('Ladefehler-Nein mit fremder ASIN in der Notiz: Urteil ja', ein([JA, NEIN, NEIN_ANDERE_NOTIZ], 'ja'), urteile([JA, NEIN, NEIN_ANDERE_NOTIZ]))
pruefe('Ladefehler-Nein als available: false: Urteil ja', ein([JA, NEIN_AVAILABLE], 'ja'), urteile([JA, NEIN_AVAILABLE]))
pruefe('der Weg gilt nicht als verneint', verneint([JA, NEIN, NEIN_ANDERE_NOTIZ]).length === 0, verneint([JA, NEIN, NEIN_ANDERE_NOTIZ]))
pruefe('das Ja behält Datum und Notiz', lade([JA, NEIN])[0]?.checkedAt === '2026-08-28' && /alle 10 Folgen/.test(lade([JA, NEIN])[0]?.note ?? ''), lade([JA, NEIN])[0])
pruefe('Gegenfall: Ladefehler-Nein ohne Ja bleibt ein Nein', ein([NEIN], 'nein'), urteile([NEIN]))
const NEIN_ALT = NEIN_TEIL.replace('2026-09-28', '2026-08-30')
pruefe('Gegenfall: älteres Nein plus Ladefehler-Nein: Urteil nein, Datum des echten Nein', lade([NEIN_ALT, NEIN])[0]?.checkedAt === '2026-08-30' && ein([NEIN_ALT, NEIN], 'nein'), lade([NEIN_ALT, NEIN]))
pruefe('Gegenprobe: Nein mit gelesenen Folgen („nur 6 von 8“) überstimmt das Ja', ein([JA, NEIN_TEIL], 'nein'), urteile([JA, NEIN_TEIL]))
pruefe('Gegenprobe: „nur 10 von 12“ ist kein Ladefehler (nur 0 zählt)', ein([JA, NEIN_ZEHN], 'nein'), urteile([JA, NEIN_ZEHN]))
pruefe('Gegenprobe: „nur 0 von 12 Folgen deutsch“ ist kein Ladefehler', ein([JA, NEIN_DEUTSCH], 'nein'), urteile([JA, NEIN_DEUTSCH]))
pruefe('Gegenprobe: Nein ohne Notiz überstimmt das Ja', ein([JA, NEIN_OHNE_NOTIZ], 'nein'), urteile([JA, NEIN_OHNE_NOTIZ]))
pruefe('Gegenprobe: Nein mit gelesenen Folgen verneint den Weg', verneint([JA, NEIN_TEIL]).length === 1, verneint([JA, NEIN_TEIL]))
pruefe('ein jüngeres Ja nach dem Ladefehler-Nein gilt', ein([NEIN, JA_NEU], 'ja'), urteile([NEIN, JA_NEU]))

/* A1: eine gemessene Regionssperre (Chaika, wörtlich aus der Datei) ist ein Nein und überstimmt das ältere Ja. */
pruefe('Regionssperre (Chaika-Zeile): Nein bleibt Nein, kein Abo', ein([JA, NEIN_REGION], 'nein') && verneint([JA, NEIN_REGION]).length === 1, urteile([JA, NEIN_REGION]))
pruefe('Regionssperre vor dem Ja in der Datei: ebenso Nein', ein([NEIN_REGION, JA], 'nein'), urteile([NEIN_REGION, JA]))

/* Ladefehler ohne Urteil in der Nachbarzeile: bleibt stehen (Nein gilt). */
pruefe('Zeile ohne Urteil plus Ladefehler-Nein: Nein bleibt', ein([NUR_ADRESSE, NEIN], 'nein'), urteile([NUR_ADRESSE, NEIN]))
pruefe('Ladefehler-Nein plus Zeile ohne Urteil: Nein bleibt', ein([NEIN, NUR_ADRESSE], 'nein'), urteile([NEIN, NUR_ADRESSE]))
pruefe('Ja-Zeile mit Ladefehler-Wortlaut ist kein Ladefehler-Nein: jüngeres Ja gewinnt gegen echtes Nein', ein([NEIN_TEIL, JA_MIT_LADEFEHLER_NOTIZ], 'ja'), urteile([NEIN_TEIL, JA_MIT_LADEFEHLER_NOTIZ]))
pruefe('zwei Ladefehler-Nein-Zeilen ohne anderes Urteil bleiben ein Nein', ein([NEIN, NEIN_ANDERE_NOTIZ], 'nein'), urteile([NEIN, NEIN_ANDERE_NOTIZ]))

/* A2: alle sechs Anordnungen von Ja 08-01, echtem Nein 08-15 und Ladefehler 09-01: das echte Nein gewinnt. */
const DREI = [JA_FRUEH, NEIN_ECHT, NEIN_LADEFEHLER_SPAET]
const anordnungen = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
for (const idx of anordnungen) {
  const geladen = lade(idx.map((i) => DREI[i]!))
  const ok = geladen.length === 1 && urteilVon(geladen[0]!) === 'nein' && geladen[0]!.checkedAt === '2026-08-15'
  pruefe(`Anordnung ${idx.join('')} (Ja, echtes Nein, Ladefehler): nein vom 15.08.`, ok, geladen)
}

/* A5: Prädikat „nur Ladefehler jünger“ (check-handbelege). */
const roh = (n: string, dub: boolean, datum: string, note = '') => ({ anilistId: 1, platform: 'primevideo' as const, title: 't', checkedAt: datum, dub, note: n || note })
const ja = roh('', true, '2026-08-01')
const lf = roh('nur 0 von 12 Folgen geladen', false, '2026-09-01')
const echt = roh('alle 12 Folgen geprüft', false, '2026-08-15')
pruefe('nurLadefehlerJuenger: Ja plus jüngerer Ladefehler', nurLadefehlerJuenger(ja, [ja, lf]) === true)
pruefe('nurLadefehlerJuenger: Ja plus Ladefehler plus jüngeres echtes Nein: Meldung', nurLadefehlerJuenger(ja, [ja, lf, echt]) === false)
pruefe('nurLadefehlerJuenger: echtes Nein gewählt, nur Ladefehler jünger: still', nurLadefehlerJuenger(echt, [echt, lf]) === true)
pruefe('nurLadefehlerJuenger: Ja gewählt, jüngeres echtes Nein: Meldung', nurLadefehlerJuenger(ja, [ja, echt]) === false)
pruefe('nurLadefehlerJuenger: Zeile ohne Urteil gewählt: Meldung', nurLadefehlerJuenger({ anilistId: 1, platform: 'primevideo' as const, title: 't', checkedAt: '2026-08-01' }, [lf]) === false)
pruefe('nurLadefehlerJuenger: gewählt ist selbst ein Ladefehler: Meldung', nurLadefehlerJuenger(lf, [lf, { ...lf, checkedAt: '2026-09-09' }]) === false)
pruefe('nurLadefehlerJuenger: nichts gewählt: Meldung', nurLadefehlerJuenger(undefined, [lf]) === false)
pruefe('nurLadefehlerJuenger: keine jüngere Zeile: still (leere Menge)', nurLadefehlerJuenger(ja, [ja]) === true)
pruefe('ladefehlerNein: Regionssperre ist keiner', ladefehlerNein({ ...lf, note: 'nur 0 von 12 Folgen geladen, regionsperre=x' }) === false)

const a = lade([JA])[0]!
const b = { ...a, dub: false, checkedAt: '2026-09-28', note: 'Amazon-Seite X: nur 0 von 3 Folgen geladen — Rest ungeprüft' }
const v = verschmelze(a, b)
pruefe('verschmelze: Ergebnis behält das Ja, Eingabe a bleibt unverändert', v.dub === true && a.dub === true && b.dub === false, v)

console.log(verletzt === 0 ? `Ladefehler-Nein: ${gesamt} Zusicherungen grün` : `Ladefehler-Nein: ${verletzt} verletzt`)
process.exit(verletzt === 0 ? 0 : 1)
