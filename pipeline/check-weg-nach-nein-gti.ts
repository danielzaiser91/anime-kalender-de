/**
 * Ein belegtes Nein zu EINER Amazon-Adresse (`watch.amazon.de/detail?gti=…`) nimmt nicht allen Titeln ihre Amazon-Bezugswege.
 * Anlass (10.11.2026): `bereinigeWege` verglich ohne Parameter, aus zwei Prime-Nein in `data/verweise-entfernt.json` (Vampire Hunter D:
 * Bloodlust, A Silent Voice) wurde `watch.amazon.de/detail` für alle; im Probebau gingen 305 Bezugswege "aus den Verweisen" verloren, darunter
 * die JustWatch-Streams von Drei kleine Geister (310), Boku wa Tomodachi ga Sukunai (10719), Laidbackers (104721) und Die Neue These (100780).
 * Die Adressen stehen wörtlich in `data/justwatch-audio.json` und `data/verweise-entfernt.json` (Stand 10.11.2026).
 *
 * Aufruf: npx tsx pipeline/check-weg-nach-nein-gti.ts
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

/* `bereinigeWege` schreibt Nebendateien: Wurzel vor dem Laden der Module in einen Wegwerf-Ordner legen. */
process.env.AK_ROOT = mkdtempSync(join(tmpdir(), 'weg-nach-nein-'))
mkdirSync(join(process.env.AK_ROOT, 'data'), { recursive: true })
mkdirSync(join(process.env.AK_ROOT, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
writeFileSync(join(process.env.AK_ROOT, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(process.env.AK_ROOT, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
const { bereinigeWege } = await import('./bau/11-3-bereinigung.ts')

const GTI_NEIN = 'amzn1.dv.gti.68239688-dba5-4abc-a3b5-5e554d51081f'
const GTI_ANDERS = 'amzn1.dv.gti.4ab84d22-8eb7-4a0e-8cc1-9e2146a69910'
const amazon = (gti: string) => `https://watch.amazon.de/detail?gti=${gti}`
const nein = (url: string) => ({ titleId: 543, titel: 'Vampire Hunter D: Bloodlust', plattform: 'primevideo', url, seriesId: null, grund: 'belegtes Nein', geprueftAm: null, entferntAm: '2026-11-10', letzterWeg: false })

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Ein Titel (Kennung 310 wie im Anlass) mit Bezugswegen; Rückgabe: die Adressen, die nach `bereinigeWege` bleiben. */
function bleibt(wege: { name: string; url: string }[], entfernt: ReturnType<typeof nein>[]): string[] {
  const t = { id: 310, titleRomaji: 'Chiisana Obake Acchi, Kocchi, Socchi', jpYear: 2026, streams: [], watchLinks: wege.map((w) => ({ ...w, kind: 'stream' })) } as unknown as Title
  bereinigeWege({ titles: new Map([[t.id, t]]), anisearch: {}, istTot: () => false, linkBefunde: {}, verweiseEntfernt: entfernt, crAdresseZu: () => undefined, beantworteteSuchen: new Set(), suchOffen: [] })
  return (t.watchLinks ?? []).map((w) => w.url)
}

console.log('Belegtes Nein je Adresse (bereinigeWege)')
const prime = { name: 'Amazon Video', url: amazon(GTI_ANDERS) }
pruefe('Nein zu einer anderen Amazon-Adresse: der Weg bleibt', bleibt([prime], [nein(amazon(GTI_NEIN))]).length === 1, bleibt([prime], [nein(amazon(GTI_NEIN))]))
pruefe('Nein zu genau dieser Amazon-Adresse: der Weg fliegt', bleibt([{ name: 'Amazon Video', url: amazon(GTI_NEIN) }], [nein(amazon(GTI_NEIN))]).length === 0)
pruefe('Zwei Wege, ein Nein: nur der verneinte fliegt', JSON.stringify(bleibt([prime, { name: 'Amazon Video', url: amazon(GTI_NEIN) }], [nein(amazon(GTI_NEIN))])) === JSON.stringify([amazon(GTI_ANDERS)]))
pruefe('Ein Nein ohne Adresse (leerer Kern) trifft keinen Weg', bleibt([prime], [nein('')]).length === 1)
const NETFLIX = { name: 'Netflix', url: 'https://www.netflix.com/title/80001305' }
pruefe('Nein zu einer Netflix-Seite entfernt genau diese (Kontrolle: Verhalten ohne Parameter bleibt)', bleibt([NETFLIX, prime], [nein(NETFLIX.url)]).join() === amazon(GTI_ANDERS))
pruefe('Partnerparameter ändert den Kern nicht: Nein gilt auch mit Anhang (`?tag=…`)', bleibt([NETFLIX], [nein(`${NETFLIX.url}?tag=x`)]).length === 0)

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`✓ Weg nach Nein je Adresse: ${faelle} Fälle`)
