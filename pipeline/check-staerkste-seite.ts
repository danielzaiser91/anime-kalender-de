/**
 * Zusicherung: Hat ein Titel mehrere gleich alte Prime-Handbelege (verschiedene Seiten, gleiches `checkedAt`), zeigt der Bau die Seite
 * mit den meisten geprüften Folgen, nicht die, die in der Datei zuerst steht (29.10.2026, Naruto Shippuden: 7 statt 33 Folgen).
 * Geprüft wird der echte Weg: Handbeleg-Datei einer Kulisse (`AK_ROOT`) → `sammleBelege` → `werteLinkpruefungAus` → `uebernehmePrimeUndCrVorschlaege`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-staerkste-seite.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-staerkste-seite-'))
mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = kulisse
const { sammleBelege } = await import('./bau/09-1-belege.ts')
const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')
const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
const { gepruefteFolgen, vergleicheBelege, ersetztBeleg, istSchwaechereSchwester } = await import('./lib/staerkste-seite.ts')

const AMAZON = 'https://www.amazon.de/gp/video/detail/'
/** Eine Prime-Zeile wie die Erweiterung sie schreibt (Notiz wörtlich, Naruto Shippuden 1735). */
function zeile(seite: string, folgen: number | null, datum = '2026-10-16', dub = 'true'): string {
  const notiz = folgen === null ? 'Tonspuren: Deutsch, 日本語' : `Tonspuren: Deutsch, 日本語 — Amazon-Seite ${seite}: alle ${folgen} Folgen geprüft, Abos: Prime, zugang=abo_und_kauf`
  return `- anilistId: 1735
  title: "Naruto Shippuden"
  platform: primevideo
  url: ${AMAZON}${seite}
  dub: ${dub}
  checkedAt: '${datum}'
  note: "${notiz}"
`
}

/** Die Zuordnung aus `prime-zugeordnet.json`: Daniel stand auf der Seite `gemeldet`. */
function meldung(gemeldet: string): string {
  return JSON.stringify({
    [`${AMAZON}${gemeldet}#1`]: { titleId: 1735, asin: 'B0FYNTK38Z', seite: 'B0FVF6MV39', plattform: 'primevideo', folgen: [{ unsere: null, sprachen: ['Deutsch', '日本語'] }] },
  })
}

/** Baut wie `09-synchro` mit der Handbelegdatei; liefert die Prime-Adressen des Titels. */
function primeWege(zeilen: string[], gemeldet?: string, ohneWeg = false, startWege: string[] = ['B07Q6VL4QC/']): string[] {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  writeFileSync(join(kulisse, 'data', 'prime-zugeordnet.json'), gemeldet ? meldung(gemeldet) : '{}')
  const wege = ohneWeg ? [] : startWege.map((s) => ({ platform: 'primevideo', url: AMAZON + s }))
  const titel = { id: 1735, slug: 'naruto-shippuden', streams: wege } as unknown as Title
  const titles = new Map<number, Title>([[1735, titel]])
  const belege = sammleBelege({ releases: [] as Release[], titles, crBySeriesId: new Map(), tmdbMehrdeutig: new Set(), tmdbTitles: {}, tvJeTmdb: new Set(), toteAdressen: new Set(), crDub: { scrapedAt: '', serien: [] } as never })
  const pruefung = werteLinkpruefungAus({ ...belege, titles, netflixOhneKennung: 0, vorherTitles: [] })
  uebernehmePrimeUndCrVorschlaege({ ...belege, ...pruefung, titles, tmdbTitles: {}, anisearch: {} })
  return titel.streams.filter((s) => s.platform === 'primevideo').map((s) => s.url.replace(AMAZON, ''))
}

const SIEBEN = zeile('B084DBMYFX', 7)
const DREI_UND_DREISSIG = zeile('B0FV7YYGQC', 33)
const VIERZEHN = zeile('B0FWJZ331M', 14)

try {
  console.log('\nBauweg mit echten Zeilen (Naruto Shippuden):')
  pruefe('die 7-Folgen-Seite steht zuerst: die 33-Folgen-Seite gewinnt', primeWege([SIEBEN, DREI_UND_DREISSIG, VIERZEHN]).join() === 'B0FV7YYGQC')
  pruefe('Reihenfolge der Datei umgekehrt: dieselbe Seite', primeWege([VIERZEHN, DREI_UND_DREISSIG, SIEBEN]).join() === 'B0FV7YYGQC')
  pruefe('die 33-Folgen-Seite steht in der Mitte: dieselbe Seite', primeWege([SIEBEN, DREI_UND_DREISSIG, VIERZEHN]).join() === 'B0FV7YYGQC')
  pruefe('Gleichstand der Folgenzahl: die erste Zeile der Datei bleibt', primeWege([zeile('B0AAAAAAA1', 14), zeile('B0AAAAAAA2', 14)]).join() === 'B0AAAAAAA1')
  pruefe('Gleichstand, Datei umgekehrt: wieder die erste Zeile', primeWege([zeile('B0AAAAAAA2', 14), zeile('B0AAAAAAA1', 14)]).join() === 'B0AAAAAAA2')
  pruefe('ein jüngerer Beleg schlägt die Folgenzahl', primeWege([SIEBEN.replace('2026-10-16', '2026-10-20'), DREI_UND_DREISSIG]).join() === 'B084DBMYFX')
  pruefe('ein Beleg ohne Zahl neben einem mit Zahl: der mit Zahl steht vorn', primeWege([zeile('B0AAAAAAA3', null), VIERZEHN]).join() === 'B0FWJZ331M')
  pruefe('ein Nein mit Zahl schlägt kein Ja', primeWege([zeile('B0AAAAAAA4', 40, '2026-10-16', 'false'), VIERZEHN]).join() === 'B0FWJZ331M')
  pruefe('Titel ohne Weg, starke Seite zuerst in der Datei: sie wird angelegt', primeWege([DREI_UND_DREISSIG, SIEBEN], undefined, true).join() === 'B0FV7YYGQC')
  pruefe('Titel ohne Weg, starke Seite zuletzt: dieselbe', primeWege([SIEBEN, DREI_UND_DREISSIG], undefined, true).join() === 'B0FV7YYGQC')
  console.log('\nKein zweiter Weg durch die gemeldete, schwächere Seite:')
  const mitMeldung = primeWege([SIEBEN, DREI_UND_DREISSIG, VIERZEHN], 'B084DBMYFX')
  pruefe('Daniel meldete die 7-Folgen-Seite: nur die 33-Folgen-Seite bleibt', mitMeldung.join() === 'B0FV7YYGQC', mitMeldung)
  const gleichstark = primeWege([zeile('B0AAAAAAA1', 14), zeile('B0AAAAAAA2', 14)], 'B0AAAAAAA2')
  pruefe('gleich starke gemeldete Seite: unverändert die erste Zeile der Datei', gleichstark.join() === 'B0AAAAAAA1', gleichstark)
  const ohneBeleg = primeWege([DREI_UND_DREISSIG], 'B0ZZZZZZZZ')
  pruefe('gemeldete Seite ohne eigenen Beleg: bleibt als zweiter Weg', ohneBeleg.length === 2, ohneBeleg)

  const dritter = primeWege([zeile('B0AAAAAAA1', 14), zeile('B0AAAAAAA2', 14)], 'B0ZZZZZZZZ', false, ['B0AAAAAAA1', 'B0AAAAAAA2'])
  pruefe('höchstens zwei Prime-Wege: eine gemeldete dritte Seite wird nicht angelegt', dritter.length === 2, dritter)
  const zweiter = primeWege([zeile('B0AAAAAAA1', 14)], 'B0ZZZZZZZZ', false, ['B0AAAAAAA1'])
  pruefe('mit einem Weg wird die gemeldete zweite Seite angelegt', zweiter.length === 2, zweiter)

  console.log('\nBausteine:')
  const ja = (seite: string, folgen: number, datum = '2026-10-16'): DubCheck => ({ anilistId: 1, platform: 'primevideo', url: AMAZON + seite, dub: true, checkedAt: datum, note: `alle ${folgen} Folgen geprüft` })
  pruefe('gepruefteFolgen liest die Zahl der Notiz', gepruefteFolgen(ja('B0A', 13)) === 13)
  pruefe('gepruefteFolgen: ein Nein zählt 0', gepruefteFolgen({ ...ja('B0A', 13), dub: false }) === 0)
  pruefe('gepruefteFolgen: ohne Notiz 0', gepruefteFolgen({ ...ja('B0A', 13), note: undefined }) === 0)
  pruefe('vergleicheBelege: gleiches Datum, mehr Folgen zuerst', [ja('B0A', 7), ja('B0B', 8)].sort(vergleicheBelege)[0]!.url!.endsWith('B0B'))
  pruefe('vergleicheBelege: jüngeres Datum vor mehr Folgen', [ja('B0A', 9, '2026-10-17'), ja('B0B', 20)].sort(vergleicheBelege)[0]!.url!.endsWith('B0A'))
  pruefe('ersetztBeleg: weniger Folgen am selben Tag ersetzt nicht', !ersetztBeleg(ja('B0A', 8), ja('B0B', 7)))
  pruefe('ersetztBeleg: genau eine Folge mehr ersetzt', ersetztBeleg(ja('B0A', 7), ja('B0B', 8)))
  pruefe('ersetztBeleg: gleich viele ersetzt (spätere Zeile)', ersetztBeleg(ja('B0A', 7), ja('B0B', 7)))
  pruefe('ersetztBeleg: anderes Datum ersetzt immer', ersetztBeleg(ja('B0A', 9, '2026-10-17'), ja('B0B', 2)))
  const paar = [ja('B0A', 7), ja('B0B', 8)]
  pruefe('istSchwaechereSchwester: weniger Folgen, gleiches Datum', istSchwaechereSchwester(paar, AMAZON + 'B0B', AMAZON + 'B0A'))
  pruefe('istSchwaechereSchwester: die stärkere ist es nicht', !istSchwaechereSchwester(paar, AMAZON + 'B0A', AMAZON + 'B0B'))
  pruefe('ersetztBeleg: Seite ohne Zahl ersetzt eine mit Zahl (nichts zu vergleichen)', ersetztBeleg(ja('B0A', 8), { ...ja('B0B', 8), note: undefined }))
  pruefe('ersetztBeleg: Seite mit Zahl ersetzt eine ohne', ersetztBeleg({ ...ja('B0A', 8), note: undefined }, ja('B0B', 3)))
  pruefe('istSchwaechereSchwester: gleich viele Folgen nicht', !istSchwaechereSchwester([ja('B0A', 8), ja('B0B', 8)], AMAZON + 'B0B', AMAZON + 'B0A'))
  pruefe('istSchwaechereSchwester: Seite ohne Beleg nicht', !istSchwaechereSchwester([{ ...ja('B0B', 8), checkedAt: undefined as unknown as string }], AMAZON + 'B0B', AMAZON + 'B0A'))
  pruefe('istSchwaechereSchwester: anderes Datum nicht', !istSchwaechereSchwester([ja('B0A', 7, '2026-10-01'), ja('B0B', 8)], AMAZON + 'B0B', AMAZON + 'B0A'))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten (Naruto-Weg, Gleichstand, Datum, Zahl fehlt, Nein, gemeldete Seite, Bausteine).')
process.exit(verletzt ? 1 : 0)
