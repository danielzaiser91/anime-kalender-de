/**
 * Zusicherung: Ein Nein aus einer Messung, die keine Folge gelesen hat („nur 0 von N Folgen geladen“), ist eine Nichtauskunft und hebt kein Ja derselben Adresse auf.
 * Anlass Chaika (20462, 20719, Prime): Ja vom 28.08. („alle 10 Folgen geprüft“), `dub: false` vom 28.09. „nur 0 von 12 Folgen geladen“ an derselben Adresse;
 * das jüngere Nein gewann in `verschmelze`. Die Zeilen unten stehen wörtlich in `data/dub-confirmed.yaml`.
 * Gegenproben: ein Nein mit gelesenen Folgen („nur 6 von 8“) gewinnt weiter, ein Ladefehler-Nein ohne Ja bleibt stehen, ein jüngeres Ja gewinnt.
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
const { ladeHandbelege, verschmelze, urteilVon, neinHandbelege } = await import('./lib/dub-confirmed.ts')

const JA = `- anilistId: 20462
  title: "Chaika, die Sargprinzessin"
  platform: primevideo
  url: https://www.amazon.de/dp/B07LHCSXV6
  dub: true
  checkedAt: '2026-08-28'
  note: "Tonspuren: Deutsch — Amazon-Seite B07LHCSXV6: alle 10 Folgen geprüft, Abos: Prime, zugang=abo_und_kauf"
`
const NEIN = `- anilistId: 20462
  title: "Chaika, die Sargprinzessin"
  platform: primevideo
  url: https://www.amazon.de/gp/video/detail/B07LHCSXV6
  dub: false
  checkedAt: '2026-09-28'
  note: "Amazon-Seite B07LHCSXV6: nur 0 von 12 Folgen geladen — Rest ungeprüft, Abos: keine Angabe, gti=amzn1.dv.gti.4ab3e446-1e73-5556-5d01-9905ded6ea33, regionsperre=laut Seite nicht mehr im Abo"
`
const NEIN_ANDERE_NOTIZ = NEIN.replace('B07LHCSXV6: nur', 'B07LHFLDBS: nur')
const NEIN_AVAILABLE = NEIN.replace('dub: false', 'available: false')
const NEIN_TEIL = NEIN.replace('nur 0 von 12', 'nur 6 von 8')
const NEIN_ZEHN = NEIN.replace('nur 0 von 12', 'nur 10 von 12')
const JA_NEU = JA.replace('2026-08-28', '2026-10-30')

function lade(zeilen: string[]) {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  return ladeHandbelege().filter((c) => c.anilistId === 20462)
}
const urteile = (zeilen: string[]) => lade(zeilen).map((c) => urteilVon(c))
const verneint = (zeilen: string[]) => [...neinHandbelege(lade(zeilen))]

pruefe('Ja, dann Ladefehler-Nein (dub: false): ein Eintrag, Urteil ja', JSON.stringify(urteile([JA, NEIN])) === '["ja"]', urteile([JA, NEIN]))
pruefe('Reihenfolge in der Datei egal: Ladefehler-Nein vor dem Ja', JSON.stringify(urteile([NEIN, JA])) === '["ja"]', urteile([NEIN, JA]))
pruefe('Ladefehler-Nein mit fremder ASIN in der Notiz (Chaika, zweite Zeile): Urteil ja', JSON.stringify(urteile([JA, NEIN, NEIN_ANDERE_NOTIZ])) === '["ja"]', urteile([JA, NEIN, NEIN_ANDERE_NOTIZ]))
pruefe('Ladefehler-Nein als available: false: Urteil ja', JSON.stringify(urteile([JA, NEIN_AVAILABLE])) === '["ja"]', urteile([JA, NEIN_AVAILABLE]))
pruefe('der Weg gilt nicht als verneint', verneint([JA, NEIN, NEIN_ANDERE_NOTIZ]).length === 0, verneint([JA, NEIN, NEIN_ANDERE_NOTIZ]))
pruefe('das Ja behält Datum und Notiz', lade([JA, NEIN])[0]?.checkedAt === '2026-08-28' && /alle 10 Folgen/.test(lade([JA, NEIN])[0]?.note ?? ''), lade([JA, NEIN])[0])
pruefe('Gegenfall: Ladefehler-Nein ohne Ja bleibt ein Nein', JSON.stringify(urteile([NEIN])) === '["nein"]', urteile([NEIN]))
pruefe('Gegenprobe: Nein mit gelesenen Folgen („nur 6 von 8“) überstimmt das Ja', JSON.stringify(urteile([JA, NEIN_TEIL])) === '["nein"]', urteile([JA, NEIN_TEIL]))
pruefe('Gegenprobe: „nur 10 von 12“ ist kein Ladefehler (nur 0 zählt)', JSON.stringify(urteile([JA, NEIN_ZEHN])) === '["nein"]', urteile([JA, NEIN_ZEHN]))
pruefe('Gegenprobe: Nein mit gelesenen Folgen verneint den Weg', verneint([JA, NEIN_TEIL]).length === 1, verneint([JA, NEIN_TEIL]))
pruefe('ein jüngeres Ja nach dem Ladefehler-Nein gilt', JSON.stringify(urteile([NEIN, JA_NEU])) === '["ja"]', urteile([NEIN, JA_NEU]))

const a = ladeHandbelege().find((c) => c.dub === true)!
const b = { ...a, dub: false, checkedAt: '2026-09-28', note: 'Amazon-Seite X: nur 0 von 3 Folgen geladen — Rest ungeprüft' }
const v = verschmelze(a, b)
pruefe('verschmelze: Ergebnis ist eine Kopie des Ja, a bleibt dub: true', v !== a && v.dub === true && a.dub === true, v)

console.log(verletzt === 0 ? `Ladefehler-Nein: ${gesamt} Zusicherungen grün` : `Ladefehler-Nein: ${verletzt} verletzt`)
process.exit(verletzt === 0 ? 0 : 1)
