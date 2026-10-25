/**
 * Zusicherungen zur Belegstärke (`dubConfidence`, 09.10.2026): kein high ohne starke oder zwei mittlere Quellen, schwache Quellen heben nie über low.
 * Läuft hinter `check:logic`; prüft die Regel an Beispielen; die Forum-Liste steht in `check-belegstaerke-forum.ts`, die Treffer-Datei gegen den Datensatz in `check-belegstaerke-bestand.ts`.
 */
import type { Title } from '../shared/types.ts'
import { titleStatus } from '../shared/logic.ts'
import { synchroBelegt } from '../shared/titles.ts'
import { belegstaerke, hochOhneBeleg, motnTonSchluessel, zaehleBelegte, type Belegsignale } from './lib/belegstaerke.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const leer: Belegsignale = { handbelegt: new Set(), kartei: new Set(), tv: new Set(), forum: new Set() }
const titel = (extra: Partial<Title> = {}) => ({ id: 1, streams: [], ...extra }) as Pick<Title, 'id' | 'streams' | 'deErstausgabe'>
const anisearch = { deErstausgabe: { synchro: true } } as Partial<Title>
const tonspur = { streams: [{ platform: 'netflix', url: 'x', dub: true }] } as Partial<Title>

console.log('\nBelegstärke: Regel')
pruefe('ohne jede Quelle: low (MyDubList allein hebt nie)', belegstaerke(titel(), leer) === 'low')
pruefe('Verweis ohne belegte Sprache zählt nicht', belegstaerke(titel({ streams: [{ platform: 'netflix', url: 'x' }] as never }), leer) === 'low')
pruefe('eine mittlere Quelle: normal', belegstaerke(titel(anisearch), leer) === 'normal')
pruefe('TV allein: normal', belegstaerke(titel(), { ...leer, tv: new Set([1]) }) === 'normal')
pruefe('zwei mittlere (aniSearch + TV): high', belegstaerke(titel(anisearch), { ...leer, tv: new Set([1]) }) === 'high')
pruefe('Anbieter-Tonspur allein: high', belegstaerke(titel(tonspur), leer) === 'high')
pruefe('Handbeleg allein: high', belegstaerke(titel(), { ...leer, handbelegt: new Set([1]) }) === 'high')
pruefe('Handbeleg und Tonspur sind eine Quelle', belegstaerke(titel(tonspur), { ...leer, handbelegt: new Set([1]) }) === 'high')
pruefe('Synchronkartei allein: high', belegstaerke(titel(), { ...leer, kartei: new Set([1]) }) === 'high')
pruefe('stark plus mittel: very-high', belegstaerke(titel({ ...tonspur, ...anisearch }), leer) === 'very-high')

console.log('\nBelegstärke: Synchron-Forum-Liste (mittel, hebt nie über high)')
{
  const forum = { ...leer, forum: new Set([1]) }
  pruefe('Forum allein: normal (low -> normal)', belegstaerke(titel(), forum) === 'normal')
  pruefe('Forum plus aniSearch: high (normal -> high)', belegstaerke(titel(anisearch), forum) === 'high')
  pruefe('Forum plus TV: high', belegstaerke(titel(), { ...forum, tv: new Set([1]) }) === 'high')
  pruefe('Forum plus starke Quelle: high, nicht very-high', belegstaerke(titel(tonspur), forum) === 'high')
  pruefe('Forum plus Synchronkartei: high, nicht very-high', belegstaerke(titel(), { ...forum, kartei: new Set([1]) }) === 'high')
  pruefe('Forum plus starke und mittlere Quelle: very-high gilt ohne das Forum', belegstaerke(titel({ ...tonspur, ...anisearch }), forum) === 'very-high')
}

console.log('\nBelegstärke: Tonspur nur aus der Streaming-Availability-API (mittel, 25.10.2026)')
{
  /* Moonrise (150654) und Thunder 3 (207254) sind Netflix-Titel, deren Deutsch nur die API nennt. */
  const moonrise = { id: 150654, streams: [{ platform: 'netflix', url: 'x', dub: true }] } as Partial<Title>
  const api = { ...leer, motnTon: new Set([motnTonSchluessel(150654, 'x')]) }
  pruefe('nur API: normal statt high', belegstaerke(titel(moonrise), api) === 'normal')
  pruefe('API plus aniSearch-Marke: high', belegstaerke(titel({ ...moonrise, ...anisearch }), api) === 'high')
  pruefe('API plus TV-Termin: high', belegstaerke(titel(moonrise), { ...api, tv: new Set([150654]) }) === 'high')
  pruefe('API plus Forum: high', belegstaerke(titel(moonrise), { ...api, forum: new Set([150654]) }) === 'high')
  pruefe('API plus Handbeleg: high (stark)', belegstaerke(titel(moonrise), { ...api, handbelegt: new Set([150654]) }) === 'high')
  pruefe('API plus Synchronkartei: very-high (stark plus mittel)', belegstaerke(titel(moonrise), { ...api, kartei: new Set([150654]) }) === 'very-high')
  pruefe('API plus Handbeleg plus Marke: very-high', belegstaerke(titel({ ...moonrise, ...anisearch }), { ...api, handbelegt: new Set([150654]) }) === 'very-high')
  const cr = { id: 150654, streams: [{ platform: 'netflix', url: 'x', dub: true }, { platform: 'crunchyroll', url: 'y', dub: true }] } as Partial<Title>
  pruefe('API auf Netflix, Crunchyroll-Tonspur dazu: high (Crunchyroll bleibt stark)', belegstaerke(titel(cr), api) === 'high')
  const zweiNetflix = { id: 150654, streams: [{ platform: 'netflix', url: 'x', dub: true }, { platform: 'netflix', url: 'z', dub: true }] } as Partial<Title>
  pruefe('zwei Netflix-Wege, nur einer aus der API: der andere bleibt stark, high', belegstaerke(titel(zweiNetflix), api) === 'high')
  pruefe('Crunchyroll allein bleibt high', belegstaerke(titel({ id: 150654, streams: [{ platform: 'crunchyroll', url: 'y', dub: true }] } as Partial<Title>), api) === 'high')
  pruefe('Schlüssel eines anderen Titels oder einer anderen Adresse gilt nicht', belegstaerke(titel(moonrise), { ...leer, motnTon: new Set([motnTonSchluessel(1, 'x'), motnTonSchluessel(150654, 'y')]) }) === 'high')
  pruefe('API-Ton ohne dub: true zählt nicht', belegstaerke(titel({ id: 150654, streams: [{ platform: 'netflix', url: 'x' }] } as Partial<Title>), api) === 'low')
}

console.log('\nBelegstärke: „erschienen“ folgt weiter der alten Stufe')
{
  const status = (x: object) => titleStatus([], '2026-10-09', { jpYear: 2020, streams: [], ...x } as never)
  pruefe('alte Stufe nicht low, neue low: bleibt erschienen', status({ dubConfidence: 'low', einzelquelle: false }) === 'erschienen')
  pruefe('alte Stufe low, neue höher: bleibt unbekannt', status({ dubConfidence: 'normal', einzelquelle: true }) === 'unbekannt')
  pruefe('ohne Feld gilt dubConfidence', status({ dubConfidence: 'low' }) === 'unbekannt' && status({ dubConfidence: 'high' }) === 'erschienen')
}

console.log('\nBelegstärke: Zusicherung für die Auslieferung')
{
  const t = (id: number, dubConfidence: Title['dubConfidence'], extra: Partial<Title> = {}) => ({ id, dubConfidence, streams: [], ...extra }) as Title
  const gefunden = hochOhneBeleg(
    [t(1, 'high'), t(2, 'very-high'), t(3, 'low'), t(4, 'normal', anisearch), t(5, 'high', tonspur), t(6, 'high', anisearch), t(7, 'high'), t(8, 'high'), t(9, 'high')],
    { handbelegt: new Set([7]), kartei: new Set([8]) },
  )
  pruefe('hoch ohne starke Quelle und ohne aniSearch-Marke (auch mit Forum-Treffer) wird gemeldet', gefunden.join() === '1,2,9', gefunden)
}

console.log('\nBelegstärke: Cartoons (westlich) entscheiden wie synchroBelegt')
{
  const t = (westlich: boolean, dubConfidence: Title['dubConfidence'], dub: boolean): Title =>
    ({ id: 1, westlich, dubConfidence, streams: [{ platform: 'disney', url: 'x', ...(dub ? { dub } : {}) }] }) as unknown as Title
  const faelle = [true, false].flatMap((w) => (['low', 'normal', 'high', 'very-high'] as const).flatMap((d) => [t(w, d, true), t(w, d, false)]))
  const abweichung = faelle.filter((x) => zaehleBelegte([x]) !== Number(synchroBelegt(x)))
  pruefe('zaehleBelegte entscheidet in allen 16 Fällen wie synchroBelegt', abweichung.length === 0, abweichung.map((x) => [x.westlich, x.dubConfidence, x.streams?.[0]?.dub]))
  const cartoonHoch = t(true, 'very-high', false)
  pruefe('Cartoon mit Stufe very-high, aber ohne dub-Weg, zählt nicht als belegt', zaehleBelegte([cartoonHoch]) === 0)
  pruefe('Cartoon mit dub-Weg zählt auch bei Stufe low als belegt', zaehleBelegte([t(true, 'low', true)]) === 1)
  const gemeldet = hochOhneBeleg(faelle.filter((x) => x.westlich), { handbelegt: new Set(), kartei: new Set() })
  pruefe('hochOhneBeleg meldet keinen Cartoon (belegt heißt dort: ein dub-Weg, der selbst der Beleg ist)', gemeldet.length === 0, gemeldet)
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
