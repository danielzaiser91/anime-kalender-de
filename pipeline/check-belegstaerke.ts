/**
 * Zusicherungen zur Belegstärke (`dubConfidence`, 09.10.2026): kein high ohne starke oder zwei mittlere Quellen, schwache Quellen heben nie über low.
 * Läuft hinter `check:logic`; prüft die Regel an Beispielen; die Treffer-Datei gegen den Datensatz steht in `check-belegstaerke-bestand.ts`.
 */
import type { Title } from '../shared/types.ts'
import { titleStatus } from '../shared/logic.ts'
import { synchroBelegt } from '../shared/titles.ts'
import { belegstaerke, forumTitel, hochOhneBeleg, zaehleBelegte, type Belegsignale } from './lib/belegstaerke.ts'
import { loadDubChecks, type DubCheck } from './lib/dub-confirmed.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './lib/util.ts'

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
  const check = (anilistId: number, dub: boolean, rest: Partial<DubCheck> = {}) => ({ anilistId, platform: 'netflix', dub, checkedAt: '2026-10-09', ...rest }) as DubCheck
  const treffer = (yaml.load(readFileSync(resolve(ROOT, 'data/synchron-forum-treffer.yaml'), 'utf8')) as { anilistId: number }[]).map((t) => t.anilistId)
  const [a, b, c, d] = treffer
  const gefiltert = forumTitel([check(a, false, { nichtImBestand: true }), check(b, false, { nichtImBestand: true }), check(b, true), check(d, false)])
  pruefe('Nein zur Synchro selbst (nichtImBestand) schließt den Titel aus', !gefiltert.has(a))
  pruefe('dasselbe Nein neben einem Ja lässt ihn zu', gefiltert.has(b) && gefiltert.has(c))
  pruefe('ein Plattform-Nein (dub:false ohne nichtImBestand) schließt nicht aus', gefiltert.has(d))
  /* Anlass: PR 1151 legte ein Crunchyroll-Nein für Afro Samurai an; Universum Anime synchronisierte die Serie 2007, die Liste belegt sie. */
  const echt = loadDubChecks()
  pruefe('Vorbedingung: ein Crunchyroll-Nein für 1292 liegt in den Handbelegen', echt.some((x) => x.anilistId === 1292 && x.platform === 'crunchyroll' && x.dub === false))
  pruefe('1292 bleibt trotz Crunchyroll-Nein in der Forum-Liste', forumTitel(echt).has(1292))
  const signale: Belegsignale = { ...leer, forum: forumTitel(echt) }
  pruefe('1292 mit aniSearch-Marke und Forum-Treffer: high (belegt), nicht normal', belegstaerke(titel({ id: 1292, ...anisearch }), signale) === 'high')
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
