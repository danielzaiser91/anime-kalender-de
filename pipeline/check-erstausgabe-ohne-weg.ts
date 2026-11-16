/**
 * Wächter „Erstausgabe bekannt, kein Weg“ (16.11.2026): Zählregel und Anstiegszeile.
 * Anlass: Laughing Under the Clouds: Gaiden hatte eine deutsche Disc-Erstausgabe (12.07.2019, Universum Anime), aber weder Stream noch Verweis.
 * Aufruf: `npm run check:logic`.
 */
import { discTitelIds, erstausgabeOhneWegAnstieg, zaehleErstausgabeOhneWeg } from './lib/erstausgabe-ohne-weg.ts'
import { warnZeilen } from './lib/qualitaet-warnzeilen.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const erst = { von: '2019-07-12', publisher: 'Universum Anime', synchro: true }
const stream = [{ platform: 'netflix', url: 'https://x.invalid/1' }]
const link = [{ name: 'Amazon', url: 'https://www.amazon.de/dp/B0KULISSE1', kind: 'buy' as const }]

/* Gaiden Teil 1 wörtlich wie in titles.json (16.11.2026): Erstausgabe, `streams` leer, kein `watchLinks`. */
pruefe('Gaiden: Erstausgabe, leere streams, kein watchLinks zählt', zaehleErstausgabeOhneWeg([{ deErstausgabe: erst, streams: [] }]) === 1)
pruefe('ein Stream nimmt den Titel aus der Zählung', zaehleErstausgabeOhneWeg([{ deErstausgabe: erst, streams: stream as never }]) === 0)
pruefe('ein Verweis nimmt den Titel aus der Zählung', zaehleErstausgabeOhneWeg([{ deErstausgabe: erst, streams: [], watchLinks: link }]) === 0)
pruefe('leeres watchLinks zählt wie fehlendes', zaehleErstausgabeOhneWeg([{ deErstausgabe: erst, streams: [], watchLinks: [] }]) === 1)
pruefe('ohne Erstausgabe zählt nicht', zaehleErstausgabeOhneWeg([{ streams: [] }]) === 0)
pruefe('Erstausgabe ohne Synchro-Marke zählt nicht (kein Beleg für Deutsch)', zaehleErstausgabeOhneWeg([{ deErstausgabe: { ...erst, synchro: false }, streams: [] }, { deErstausgabe: { von: '2019-07-12' }, streams: [] }]) === 0)
pruefe('mehrere: nur die ohne Weg', zaehleErstausgabeOhneWeg([{ deErstausgabe: erst, streams: [] }, { deErstausgabe: erst, streams: [] }, { deErstausgabe: erst, streams: stream as never }]) === 2)

/* Gaiden Teil 3 (99197) mit dem Disc-Termin der Komplettbox; Teil 4 (fremd) ohne. */
const disc = discTitelIds([{ titleId: 99197, releaseType: 'disc' }, { titleId: 5, releaseType: 'kino' }, { releaseType: 'disc' }])
pruefe('discTitelIds: nur Disc-Termine mit Titelkennung', [...disc].join() === '99197', [...disc])
pruefe('ein Disc-Termin nimmt den Titel aus der Zählung', zaehleErstausgabeOhneWeg([{ id: 99197, deErstausgabe: erst, streams: [] }], disc) === 0)
pruefe('Disc-Termin eines anderen Titels nimmt nichts heraus', zaehleErstausgabeOhneWeg([{ id: 99198, deErstausgabe: erst, streams: [] }], disc) === 1)
pruefe('Kino-Termin ist kein Disc-Weg', zaehleErstausgabeOhneWeg([{ id: 5, deErstausgabe: erst, streams: [] }], disc) === 1)

pruefe('Anstieg um genau 1 meldet', erstausgabeOhneWegAnstieg(172, 171) === 'erstausgabeOhneWeg: 171 → 172 (+1)')
pruefe('Anstieg nennt beide Werte und die Differenz', erstausgabeOhneWegAnstieg(180, 172) === 'erstausgabeOhneWeg: 172 → 180 (+8)')
pruefe('gleicher Wert schweigt', erstausgabeOhneWegAnstieg(172, 172) === null)
pruefe('Rückgang schweigt', erstausgabeOhneWegAnstieg(169, 172) === null)
pruefe('Vorwert 0: Anstieg auf 1 meldet', erstausgabeOhneWegAnstieg(1, 0) === 'erstausgabeOhneWeg: 0 → 1 (+1)')
pruefe('ohne Vorwert (ältere Verlaufszeile) schweigt', erstausgabeOhneWegAnstieg(172, undefined) === null)

const w = (a: number, v: number | undefined) => warnZeilen({ mitStreamingWeg: 100, erstausgabeOhneWeg: a }, v === undefined ? null : { mitStreamingWeg: 100, erstausgabeOhneWeg: v })
pruefe('warnZeilen: Anstieg ergibt eine Zeile mit Präfix', w(173, 172).join('|') === 'ERSTAUSGABE_OHNE_WEG erstausgabeOhneWeg: 172 → 173 (+1)', w(173, 172))
pruefe('warnZeilen: ohne Anstieg keine Zeile', w(172, 172).length === 0)
pruefe(
  'warnZeilen: Streaming-Rückgang und Erstausgabe-Anstieg stehen beide da',
  warnZeilen({ mitStreamingWeg: 90, erstausgabeOhneWeg: 5 }, { mitStreamingWeg: 100, erstausgabeOhneWeg: 4 }).map((z) => z.split(' ')[0]).join() === 'STREAMING_RUECKGANG,ERSTAUSGABE_OHNE_WEG',
)

if (verletzt) process.exit(1)
console.log(`check-erstausgabe-ohne-weg: ${faelle} Fälle grün`)
