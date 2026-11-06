/**
 * Zusicherung: Eine Blockkette trägt kein Ja, wenn ein Block ohne deutsche Folge vor einem deutschen Block steht (04.11.2026, Persona 5:
 * „Day Breakers“ 1/0 vor den OVAs 2/2 ließ die Summen 26 | 1+1 aufgehen, Stars and Ours bekam das Ja der OVAs, und der Bestandsbau stellte den
 * Titel zurück). Werte und Namen stammen aus `data/crunchyroll-dub.json` (Kennung G6VDWKM76, Stand 04.11.2026).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-cr-blockkette-luecke.ts`
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { ordneCrBloeckeZu } from './bau/09-4-2-bloecke.ts'
import { beurteileBlockkettenOhneLuecke, crJaOhneDeckung } from './lib/cr-ja-deckung.ts'
import { beurteileBlockketten, type CrDubData, type CrSerie } from './lib/crunchyroll-dub.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SERIE = 'http://www.crunchyroll.com/de/persona5-the-animation'
const STARS = 'https://www.crunchyroll.com/de/persona5-the-animation/persona5-the-animation-stars-and-ours-782566'
const SUN = 'https://www.crunchyroll.com/de/persona5-the-animation/persona5-the-animation-dark-sun-780776'
const REIHE = 99693

const block = (name: string, folgen: number, deutsch: number) => ({
  name,
  folgen,
  deutsch,
  fremd: 0,
  deutscheFolgen: Array.from({ length: deutsch }, (_, i) => ({ nummer: i + 1 })),
})
const S1 = block('Persona 5: Season 1', 26, 26)
const OVAS = block('OVAs (German Dub)', 2, 2)
const eintrag = (url: string, staffeln: ReturnType<typeof block>[]): CrSerie =>
  ({ url, seriesId: 'G6VDWKM76', katalog: 'de', deutschImAngebot: true, geprueftAm: '2026-11-04', staffeln }) as unknown as CrSerie
const titel = (id: number, episodes: number, jpYear: number, url: string): Title =>
  ({
    id,
    titleRomaji: `Persona ${id}`,
    episodes,
    jpYear,
    franchiseId: REIHE,
    streams: [{ platform: 'crunchyroll', url, zugang: 'abo' }] as StreamLink[],
    keywords: [],
    genres: [],
  }) as unknown as Title
const reihe = (): Title[] => [titel(REIHE, 26, 2018, SERIE), titel(106896, 1, 2019, STARS), titel(106169, 1, 2019, SUN)]

console.log('\nbeurteileBlockkettenOhneLuecke')
const ohneDeutsch = block('PERSONA5 the Animation -THE DAY BREAKERS-', 1, 0)
const luecke = eintrag(SERIE, [S1, ohneDeutsch, OVAS])
pruefe('Kontrolle: die Kette allein gibt allen drei Einträgen das Ja', beurteileBlockketten(luecke, reihe()).length === 3)
pruefe('Null-Block zwischen zwei deutschen Blöcken: kein Ja aus der Kette', beurteileBlockkettenOhneLuecke(luecke, reihe()).length === 0)
const vorn = eintrag(SERIE, [ohneDeutsch, S1, OVAS])
pruefe('Null-Block vor dem ersten deutschen Block: kein Ja aus der Kette', beurteileBlockkettenOhneLuecke(vorn, reihe()).length === 0)
const hinten = eintrag(SERIE, [S1, OVAS, ohneDeutsch])
pruefe('Null-Block hinter dem letzten deutschen Block: die Kette gilt (Dr. Stone, One Punch Man)', beurteileBlockkettenOhneLuecke(hinten, reihe()).length === 3)
const leer = eintrag(SERIE, [S1, block('leer', 0, 0), OVAS])
pruefe('ein leerer Block (0 von 0) davor stört die Kette nicht', beurteileBlockkettenOhneLuecke(leer, reihe()).length === 3)
const vornDannLeer = eintrag(SERIE, [ohneDeutsch, block('leer', 0, 0), S1, OVAS])
pruefe('ein leerer Block hebt den Null-Block davor nicht auf', beurteileBlockkettenOhneLuecke(vornDannLeer, reihe()).length === 0)
const zwilling = eintrag(SERIE, [S1, block('OVAs', 2, 0), OVAS])
pruefe('Untertitel-Zwilling „OVAs“ neben „OVAs (German Dub)“ sperrt die Kette nicht (How Not to Summon)', beurteileBlockkettenOhneLuecke(zwilling, reihe()).length === 3)
const fremd = eintrag(SERIE, [S1, block('Specials', 2, 0), OVAS])
pruefe('ein Null-Block mit fremdem Namen sperrt die Kette', beurteileBlockkettenOhneLuecke(fremd, reihe()).length === 0)
const ohneKlammer = eintrag(SERIE, [S1, block('OVAs', 2, 0), block('OVAs Extra', 2, 2)])
pruefe('ein Name ohne Sprachzusatz in Klammern ist kein Zwilling', beurteileBlockkettenOhneLuecke(ohneKlammer, reihe()).length === 0)
const zwillingNull = eintrag(SERIE, [S1, block('OVAs', 2, 0), block('OVAs (German Dub)', 2, 0), OVAS])
pruefe('zwei Null-Blöcke: der ohne deutschen Zwilling sperrt', beurteileBlockkettenOhneLuecke(zwillingNull, reihe()).length === 0)
const zwillingOhneFolgen = eintrag(SERIE, [S1, block('OVAs', 2, 0), block('OVAs (German Dub)', 0, 0), OVAS.name ? { ...OVAS, name: 'Anderes' } : OVAS])
pruefe('ein Zwilling ohne deutsche Folge zählt nicht', beurteileBlockkettenOhneLuecke(zwillingOhneFolgen, reihe()).length === 0)
const offeneKlammer = eintrag(SERIE, [S1, block('OVAs', 2, 0), block('OVAs (Extra', 2, 2)])
pruefe('ein Name ohne schließende Klammer ist kein Zwilling', beurteileBlockkettenOhneLuecke(offeneKlammer, reihe()).length === 0)
const ohneNull = eintrag(SERIE, [S1, OVAS])
pruefe('ohne Null-Block gilt die Kette', beurteileBlockkettenOhneLuecke(ohneNull, reihe()).length === 3)

console.log('\nBauphase ordneCrBloeckeZu: Stars and Ours')
/** Baut die Blockzuordnung für die drei Einträge der Reihe und liefert das Ergebnis je Titel. */
const serienDerReihe = (erster: CrSerie): CrSerie[] => [
  erster,
  eintrag(STARS, [S1, ohneDeutsch]),
  eintrag(SUN, [S1, block('PERSONA5 the Animation -THE DAY BREAKERS-', 1, 1)]),
]
function bauLauf(erster: CrSerie): Map<number, Title> {
  const titles = new Map(reihe().map((t) => [t.id, t]))
  const serien = serienDerReihe(erster)
  const nachUrl = new Map<string, Title[]>()
  for (const t of titles.values()) nachUrl.set(t.streams[0]!.url, [t])
  ordneCrBloeckeZu({ crDub: { scrapedAt: '', serien } as unknown as CrDubData, nachUrl, titles, katalogEintraege: [] })
  return titles
}
const mitLuecke = bauLauf(luecke)
pruefe('Stars and Ours bekommt aus der Kette kein Ja', mitLuecke.get(106896)!.streams[0]!.dub === undefined, mitLuecke.get(106896)!.streams[0])
const geschlossen = bauLauf(ohneNull)
pruefe('Kontrolle: ohne die Lücke setzt dieselbe Bauphase das Ja', geschlossen.get(106896)!.streams[0]!.dub === true, geschlossen.get(106896)!.streams[0])

console.log('\nBestandsprüfung crJaOhneDeckung: dieselbe Regel')
/** Ein Ja ohne Bereiche an Stars and Ours: gemeldet, wenn nur die Kette es trüge. */
function offeneMit(erster: CrSerie): string[] {
  const titles = reihe().map((t) => (t.id === 106896 ? { ...t, streams: [{ ...t.streams[0]!, dub: true }] } : t))
  return crJaOhneDeckung({ titles, mitTermin: new Set(), mitBeleg: new Set(), crDub: { scrapedAt: '', serien: serienDerReihe(erster) } as unknown as CrDubData })
}
pruefe('Ja aus der Kette über eine Lücke ist nicht gedeckt', offeneMit(luecke).some((z) => z.startsWith('106896 ')), offeneMit(luecke))
pruefe('Kontrolle: ohne Lücke deckt die Kette das Ja', !offeneMit(ohneNull).some((z) => z.startsWith('106896 ')), offeneMit(ohneNull))

if (verletzt) process.exit(1)
console.log('✓ Blockketten: Null-Block vor einem deutschen Block trägt kein Ja (13 Weichenfälle, Bauphase und Bestandsprüfung mit und ohne Lücke).')
