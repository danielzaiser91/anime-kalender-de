/**
 * Staffel des Titels bei JustWatch (11.11.2026): Die erste Runde „ohne jeden Weg“ und der zweite Durchgang nach der Begrenzung verlangen bei Serien
 * mit mehreren Staffeln ein Angebot unter jeder Staffel; ist die Staffel des Titels über seine Folgenzahl eindeutig, genügt sie (Chaika 20462,
 * Staffel 1, Crunchyroll nur dort). Erwartete Werte stehen fest im Test; die Verdrahtung im Bau prüft `check-kanal-nach-begrenzung.ts`.
 *
 * Aufruf: `npx tsx pipeline/check-staffel-des-titels.ts`
 */
import { mitStaffelTreffer } from './bau/11-2-5-wege-nach-begrenzung.ts'
import { staffelDesTitels, staffelFuehrt, zaehleTitelJeJwFolgen, type MitStaffeln } from './lib/jw-staffel-des-titels.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const cr = { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/watch/GAAA/folge-eins' }
const crAndereAdresse = { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/watch/GBBB/folge-zwei' }
const kanal = { anbieter: 'Crunchyroll Amazon Channel', art: 'FLATRATE', url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.kanal' }
const serie = (jwId: string | undefined, ...folgen: [number, object[]][]): MitStaffeln & { angebote: object[] } => ({
  jwId,
  angebote: [cr, kanal],
  staffeln: folgen.map(([f, a]) => ({ folgen: f, angebote: a as never })),
})
const titel = (id: number, episodes?: number): Title => ({ id, episodes }) as unknown as Title

console.log('\nStaffel des Titels (reine Funktionen, feste Werte):')
const zwei = serie('ts1', [12, [cr, kanal]], [24, []])
pruefe('zählt Titel je Serie und Folgenzahl, ohne Kennung oder Folgen nicht', (() => {
  const z = zaehleTitelJeJwFolgen([titel(1, 12), titel(2, 12), titel(3, 24), titel(4), titel(5, 12)], { 1: zwei, 2: zwei, 3: zwei, 4: zwei, 5: serie(undefined, [12, []]) } as never)
  return z.get('ts1|12') === 2 && z.get('ts1|24') === 1 && z.size === 2
})())
pruefe('eindeutige Folgenzahl: die Staffel mit dieser Zahl', staffelDesTitels(zwei, 24, new Map([['ts1|24', 1]]))?.folgen === 24)
pruefe('Folgenzahl 12 und genau ein Titel: Staffel 1 (Kanal vorhanden)', staffelDesTitels(zwei, 12, new Map([['ts1|12', 1]]))?.angebote?.length === 2)
pruefe('ein Geschwistertitel mit derselben Zahl: keine Staffel (Haganai)', staffelDesTitels(zwei, 12, new Map([['ts1|12', 2]])) === undefined)
pruefe('keine Staffel mit der Folgenzahl: keine Staffel', staffelDesTitels(zwei, 13, new Map()) === undefined)
pruefe('zwei Staffeln mit der Folgenzahl: keine Staffel', staffelDesTitels(serie('ts2', [12, []], [12, [cr]]), 12, new Map()) === undefined)
pruefe('Folgenzahl fehlt oder 0: keine Staffel', staffelDesTitels(zwei, undefined, new Map()) === undefined && staffelDesTitels(zwei, 0, new Map()) === undefined)
pruefe('keine Serienkennung: keine Staffel (Geschwister nicht prüfbar)', staffelDesTitels(serie(undefined, [12, [cr]], [24, []]), 12, new Map()) === undefined)

pruefe('Staffel führt das Angebot mit derselben Adresse', staffelFuehrt({ angebote: [cr] }, cr))
pruefe('andere Adresse beim selben Anbieter zählt (Crunchyroll hat je Staffel eine eigene)', staffelFuehrt({ angebote: [crAndereAdresse] }, cr))
pruefe('anderer Anbieter, andere Adresse: nein (Kanal gegen Crunchyroll)', !staffelFuehrt({ angebote: [cr] }, kanal))
pruefe('Staffel ohne Angebote: nein', !staffelFuehrt({}, cr))
pruefe('unbekannter Anbieter mit anderer Adresse: nein', !staffelFuehrt({ angebote: [{ anbieter: 'Zzz Unbekannt Eins', url: 'https://a.example/1' }] }, { anbieter: 'Zzz Unbekannt Zwei', url: 'https://a.example/2' }))

console.log('\nmitStaffelTreffer (ganze Tabelle):')
const jw = {
  1: serie('ts1', [12, [cr, kanal]], [24, []]),
  2: serie('ts1', [12, [cr, kanal]], [24, []]),
  3: serie('ts3', [12, [cr, kanal]], [24, []]),
  4: serie('ts4', [13, [cr, kanal]], [24, []]),
  5: serie('ts5', [12, [crAndereAdresse]], [24, [crAndereAdresse]]),
  8: serie('ts8', [12, [cr]], [12, [crAndereAdresse]]),
}
const titles = new Map([1, 2, 3, 4, 5, 8].map((id) => [id, titel(id, id === 5 ? 24 : 12)] as const))
const aus = mitStaffelTreffer(jw as never, titles)
const namen = (id: number) => (aus[String(id)].angebote ?? []).map((a) => a.anbieter).join(',')
pruefe('Titel 3 (12 Folgen, einzige Staffel mit 12): Angebote bleiben', namen(3) === 'Crunchyroll,Crunchyroll Amazon Channel', namen(3))
pruefe('Titel 1 und 2 teilen Serie und Folgenzahl: keine Staffel, Angebote fallen (nicht jede Staffel führt sie)', namen(1) === '' && namen(2) === '', [namen(1), namen(2)])
pruefe('Titel 4 (12 Folgen, keine Staffel mit 12): Angebote fallen', namen(4) === '', namen(4))
pruefe('Titel 5 (24 Folgen, Staffel 2 führt Crunchyroll unter anderer Adresse, beide Staffeln): Angebot bleibt', namen(5) === 'Crunchyroll', namen(5))
pruefe('beide Staffeln führen Crunchyroll unter je eigener Adresse (Gundam 00, Isekai Quartet): Crunchyroll bleibt, der Kanal fällt', namen(8) === 'Crunchyroll', namen(8))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
