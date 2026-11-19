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
const { belegOhneGenaueAdresse } = await import('./lib/kanal-titel.ts')

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

/** Eine Kanal-Zeile mit zweiter Quelle (dub bleibt Ja), Notiz wie bei Yu-Gi-Oh! 481, B07FB4D9KM. */
function kanalZeile(seite: string, folgen: number, datum = '2026-10-16'): string {
  const notiz = `Tonspuren: Deutsch — Amazon-Seite ${seite}: alle ${folgen} Folgen geprüft, Abos: aniversede, zugang=abo_und_kauf — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg`
  return zeile(seite, folgen, datum).replace(/  note: .*\n/, `  note: "${notiz}"\n  zweiteQuelle: "Anime2You 2024-06-26: Beleg — https://www.anime2you.de/news/803417/x"\n`)
}

/** Die Zuordnung aus `prime-zugeordnet.json`: Daniel stand auf der Seite `gemeldet`. */
function meldung(gemeldet: string): string {
  return JSON.stringify({
    [`${AMAZON}${gemeldet}#1`]: { titleId: 1735, asin: 'B0FYNTK38Z', seite: 'B0FVF6MV39', plattform: 'primevideo', folgen: [{ unsere: null, sprachen: ['Deutsch', '日本語'] }] },
  })
}

/** Baut wie `09-synchro` mit der Handbelegdatei; liefert die Prime-Adressen des Titels. */
function primeWege(zeilen: string[], gemeldet?: string, ohneWeg = false, startWege: string[] = ['B07Q6VL4QC/']): string[] {
  return bauePrimeWege(zeilen, gemeldet ? meldung(gemeldet) : '{}', ohneWeg ? [] : startWege).map((s) => s.url.replace(AMAZON, ''))
}

/** Der Bauweg mit freier Meldungsdatei (`prime-zugeordnet.json` als Text) und Startwegen; liefert die Prime-Wege samt `dub`. */
function bauePrimeWege(zeilen: string[], zugeordnet: string, startWege: string[]): { url: string; dub?: boolean }[] {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  writeFileSync(join(kulisse, 'data', 'prime-zugeordnet.json'), zugeordnet)
  const wege = startWege.map((s) => ({ platform: 'primevideo', url: AMAZON + s }))
  const titel = { id: 1735, slug: 'naruto-shippuden', streams: wege } as unknown as Title
  const titles = new Map<number, Title>([[1735, titel]])
  const belege = sammleBelege({ releases: [] as Release[], titles, crBySeriesId: new Map(), tmdbMehrdeutig: new Set(), tmdbTitles: {}, tvJeTmdb: new Set(), toteAdressen: new Set(), crDub: { scrapedAt: '', serien: [] } as never })
  const pruefung = werteLinkpruefungAus({ ...belege, titles, netflixOhneKennung: 0, vorherTitles: [] })
  uebernehmePrimeUndCrVorschlaege({ ...belege, ...pruefung, titles, tmdbTitles: {}, anisearch: {} })
  return titel.streams.filter((s) => s.platform === 'primevideo')
}

/** Eine Meldung wie die Erweiterung sie ablegt (Yu-Gi-Oh! 481: Schlüssel `<Kanal-Adresse>#<Nr>`, Seite und ASIN je Staffel). */
function meldungNr(nr: number, seite: string): Record<string, unknown> {
  return { [`${AMAZON}B07FB4D9KM#${nr}`]: { titleId: 1735, asin: 'B0C7GS846P', seite, plattform: 'primevideo', folgen: [{ unsere: 28, sprachen: ['Deutsch'] }] } }
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
  console.log('\nKanal- und Abo-Ausgabe sind getrennte Wege (Yu-Gi-Oh! 481):')
  const kanalVorn = primeWege([kanalZeile('B0KANAL001', 40), zeile('B0ABO00001', 25)], undefined, false, ['B0KANAL001', 'B0ABO00001'])
  pruefe('Kanal-Seite (40 Folgen) vor Abo-Seite (25), gleiches Datum: beide Wege bleiben', kanalVorn.sort().join() === 'B0ABO00001,B0KANAL001', kanalVorn)
  const aboVorn = primeWege([zeile('B0ABO00001', 25), kanalZeile('B0KANAL001', 40)], undefined, false, ['B0KANAL001', 'B0ABO00001'])
  pruefe('Abo-Seite vor Kanal-Seite: beide Wege bleiben', aboVorn.sort().join() === 'B0ABO00001,B0KANAL001', aboVorn)
  /* Echte 481-Form: drei Kanal-Zeilen an einer Adresse (nur die älteste mit zweiter Quelle), zwei Abo-Zeilen (25 und 24 Folgen) am 15.10., Meldungen #0 Kanal und #2. */
  const yugioh = [kanalZeile('B07FB4D9KM', 40, '2026-08-25'), kanalZeile('B07FB4D9KM', 40, '2026-09-25').replace(/  zweiteQuelle: .*\n/, ''), zeile('B0C7GQSHYT', 25, '2026-10-15'), zeile('B0C7GPTB8S', 24, '2026-10-15'), kanalZeile('B07FB4D9KM', 40, '2026-10-15').replace(/  zweiteQuelle: .*\n/, '')]
  const yugiohWege = bauePrimeWege(yugioh, JSON.stringify({ ...meldungNr(0, 'B07FB4D9KM'), ...meldungNr(2, 'B0C7GPTB8S') }), ['B0C7GQSHYT'])
  const aboWeg = yugiohWege.find((s) => s.url.endsWith('B0C7GQSHYT'))
  pruefe('Yu-Gi-Oh! 481: der Abo-Weg bleibt mit dub=true neben der Kanal-Adresse', aboWeg?.dub === true, yugiohWege)
  pruefe('Yu-Gi-Oh! 481: die Kanal-Adresse steht als Weg', yugiohWege.some((s) => s.url.endsWith('B07FB4D9KM')), yugiohWege)
  const kanalMeldung = primeWege([zeile('B0ABO00001', 25), kanalZeile('B0KANAL001', 40)], 'B0ABO00001', false, ['B0KANAL001'])
  pruefe('die gemeldete Abo-Seite wird neben der Kanal-Seite angelegt, nicht als Schwester verworfen', kanalMeldung.sort().join() === 'B0ABO00001,B0KANAL001', kanalMeldung)

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
  pruefe('ersetztBeleg: jüngeres Datum ersetzt, auch mit weniger Folgen', ersetztBeleg(ja('B0A', 9), ja('B0B', 2, '2026-10-17')))
  /* Shana 355: der Beleg vom 19.11. steht vor der Nein-Zeile vom 31.10.; die spätere Zeile darf ihn nicht verdrängen. */
  pruefe('ersetztBeleg: älteres Datum ersetzt nie, auch als spätere Zeile', !ersetztBeleg(ja('B0A', 2, '2026-11-19'), { ...ja('B0B', 9, '2026-10-31'), dub: undefined, available: false }))
  /* 97863: Kauf-Seite (Ja, 01.09.) gegen Kanal-Seite (Nein, 16.11.): das Nein einer anderen Adresse verdrängt das Ja in keiner Reihenfolge. */
  const nein = (seite: string, datum: string): DubCheck => ({ ...ja(seite, 0, datum), dub: false, note: undefined })
  pruefe('ersetztBeleg: jüngeres Nein einer anderen Adresse ersetzt ein Ja nicht', !ersetztBeleg(ja('B0A', 11, '2026-09-01'), nein('B0K', '2026-11-16')))
  pruefe('ersetztBeleg: älteres Ja ersetzt ein jüngeres Nein einer anderen Adresse', ersetztBeleg(nein('B0K', '2026-11-16'), ja('B0A', 11, '2026-09-01')))
  pruefe('ersetztBeleg: jüngeres Nein derselben Adresse ersetzt das Ja', ersetztBeleg(ja('B0A', 11, '2026-09-01'), nein('B0A', '2026-11-16')))
  pruefe('ersetztBeleg: jüngeres Ja einer anderen Adresse ersetzt ein Nein', ersetztBeleg(nein('B0K', '2026-09-01'), ja('B0A', 11, '2026-11-16')))
  const paar = [ja('B0A', 7), ja('B0B', 8)]
  pruefe('istSchwaechereSchwester: weniger Folgen, gleiches Datum', istSchwaechereSchwester(paar, AMAZON + 'B0B', AMAZON + 'B0A'))
  pruefe('istSchwaechereSchwester: die stärkere ist es nicht', !istSchwaechereSchwester(paar, AMAZON + 'B0A', AMAZON + 'B0B'))
  pruefe('ersetztBeleg: Seite ohne Zahl ersetzt eine mit Zahl (nichts zu vergleichen)', ersetztBeleg(ja('B0A', 8), { ...ja('B0B', 8), note: undefined }))
  pruefe('ersetztBeleg: Seite mit Zahl ersetzt eine ohne', ersetztBeleg({ ...ja('B0A', 8), note: undefined }, ja('B0B', 3)))
  pruefe('istSchwaechereSchwester: gleich viele Folgen nicht', !istSchwaechereSchwester([ja('B0A', 8), ja('B0B', 8)], AMAZON + 'B0B', AMAZON + 'B0A'))
  pruefe('istSchwaechereSchwester: Seite ohne Beleg nicht', !istSchwaechereSchwester([{ ...ja('B0B', 8), checkedAt: undefined as unknown as string }], AMAZON + 'B0B', AMAZON + 'B0A'))
  const kanal = (c: DubCheck): DubCheck => ({ ...c, note: `${c.note} — ACHTUNG: Kanal-Titel` })
  pruefe('istSchwaechereSchwester: Kanal-Adresse gegen Abo-Adresse sind zwei Ausgaben (Yu-Gi-Oh! 481)', !istSchwaechereSchwester([ja('B0A', 25), kanal(ja('B0B', 40))], AMAZON + 'B0B', AMAZON + 'B0A'))
  const urlsNachSortierung = (belege: DubCheck[]): string => belege.sort(vergleicheBelege).map((c) => c.url!.replace(AMAZON, '')).join()
  pruefe('vergleicheBelege: Kanal mit mehr Folgen verdrängt die Abo-Seite nicht', urlsNachSortierung([kanal(ja('B0K', 40)), ja('B0A', 25)]) === 'B0A,B0K')
  pruefe('vergleicheBelege: Abo vor Kanal unabhängig von der Dateireihenfolge', urlsNachSortierung([ja('B0A', 25), kanal(ja('B0K', 40))]) === 'B0A,B0K')
  pruefe('vergleicheBelege: je Ausgabe weiter nach Folgen (Kanal 40 vor Kanal 30, Abo 25 vor Abo 10)', urlsNachSortierung([kanal(ja('B0K30', 30)), ja('B0A10', 10), kanal(ja('B0K40', 40)), ja('B0A25', 25)]) === 'B0A25,B0A10,B0K40,B0K30')
  /*
    Rückfall bei einem Weg und fremder Adresse (`belegOhneGenaueAdresse` nimmt den ersten Beleg der sortierten Liste). Soll seit der Kanal/Abo-Trennung:
    bei gleichem Datum steht die Abo-Zeile vorn, also auch ihr „nicht verfügbar“ (To Love-Ru 3455, 19.09.: Abo B0CHQ3NF3M available false, Kanal-Ja mit zweiter Quelle).
    Vorher gewann hier das Kanal-Ja (mehr Folgen). Heute ohne Wirkung, weil 3455 zwei Wege hat (ab zwei Wegen liefert der Rückfall nichts).
  */
  const toLoveRu: DubCheck[] = [
    { ...kanal(ja('B0KANALGTI', 12, '2026-09-19')), anilistId: 3455, zweiteQuelle: 'Anime2You' },
    { anilistId: 3455, platform: 'primevideo', url: AMAZON + 'B0CHQ3NF3M', available: false, checkedAt: '2026-09-19', note: 'Amazon-Seite B0CHQ3NF3M: alle 0 Folgen geprüft' },
  ]
  const rueckfall = belegOhneGenaueAdresse([...toLoveRu].sort(vergleicheBelege), 1, toLoveRu, 3455, AMAZON + 'B0FREMD001')
  pruefe('Rückfall bei einem Weg und fremder Adresse: die Abo-Zeile (nicht verfügbar) steht vor dem Kanal-Ja', rueckfall?.url === AMAZON + 'B0CHQ3NF3M' && rueckfall.available === false, rueckfall)
  pruefe('Rückfall: ab zwei Wegen kein Beleg', belegOhneGenaueAdresse([...toLoveRu].sort(vergleicheBelege), 2, toLoveRu, 3455, AMAZON + 'B0FREMD001') === undefined)
  pruefe('vergleicheBelege: jüngerer Kanal-Beleg schlägt älteren Abo-Beleg', urlsNachSortierung([ja('B0A', 25), kanal(ja('B0K', 3, '2026-10-17'))]) === 'B0K,B0A')
  pruefe('ersetztBeleg: Kanal (40) ersetzt Abo (25) am selben Tag: spätere Zeile', ersetztBeleg(ja('B0A', 25), kanal(ja('B0K', 40))))
  pruefe('ersetztBeleg: Abo (25) ersetzt Kanal (40) am selben Tag: spätere Zeile', ersetztBeleg(kanal(ja('B0K', 40)), ja('B0A', 25)))
  pruefe('ersetztBeleg: zwei Kanal-Seiten, weniger Folgen ersetzt nicht', !ersetztBeleg(kanal(ja('B0K', 40)), kanal(ja('B0L', 25))))
  pruefe('istSchwaechereSchwester: zwei Kanal-Adressen bleiben Schwestern', istSchwaechereSchwester([kanal(ja('B0A', 40)), kanal(ja('B0B', 25))], AMAZON + 'B0A', AMAZON + 'B0B'))
  pruefe('istSchwaechereSchwester: anderes Datum nicht', !istSchwaechereSchwester([ja('B0A', 7, '2026-10-01'), ja('B0B', 8)], AMAZON + 'B0B', AMAZON + 'B0A'))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten (Naruto-Weg, Gleichstand, Datum, Zahl fehlt, Nein, gemeldete Seite, Bausteine).')
process.exit(verletzt ? 1 : 0)
