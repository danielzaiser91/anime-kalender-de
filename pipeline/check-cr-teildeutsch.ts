/**
 * Wächter (16.11.2026, Issue 4047): Ein teilweise deutscher Crunchyroll-Block darf das Urteil nicht kippen.
 * Eingefroren: Demon Slayer (101922, 26 Folgen) und Film Mugen Train (112151) an der Serie GY5P48XEY,
 * Stand des Dub-Bestands vom 16.11.: Staffel 1 deutsch 24 von 26 (Folgen 25 und 26 fremd), alle anderen Blöcke vollständig.
 * Vorher blieben beide ohne `dub`, weil die Zahl 26 als „auch an einem nicht ganz deutschen Block“ galt.
 */
import { type CrDubData, type CrSerie } from './lib/crunchyroll-dub.ts'
import { beurteileMitTeilDeutsch as beurteile } from './lib/cr-teil-deutsch.ts'
import { ordneCrSerienZu } from './bau/09-4-1-serien.ts'
import { beurteileFrischeWege } from './bau/09-6-4-nachbewertung.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL = 'https://www.crunchyroll.com/de/demon-slayer-kimetsu-no-yaiba'
const folgen = (nummern: number[]) => nummern.map((n) => ({ nummer: n, guid: `G${n}`, laufend: n }))
const bis = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const block = (name: string, gesamt: number, deutsch: number) => ({
  name,
  staffelId: name,
  folgen: gesamt,
  kacheln: gesamt,
  deutsch,
  fremd: gesamt - deutsch,
  deutscheFassung: deutsch > 0,
  deutscheFolgen: folgen(bis(deutsch)),
})
const serie = (staffeln: ReturnType<typeof block>[]): CrSerie =>
  ({ url: URL, seriesId: 'GY5P48XEY', quelle: 'api', katalog: 'de', geprueftAm: '2026-11-16', deutschImAngebot: true, staffeln }) as unknown as CrSerie
const titel = (id: number, episodes: number, format: string, titleEn = `T${id}`): Title =>
  ({ id, episodes, format, jpYear: 2019, titleEn, streams: [{ platform: 'crunchyroll', url: URL, zugang: 'abo' }] }) as unknown as Title

const PREFIX = 'Demon Slayer: Kimetsu no Yaiba'
const demon = serie([
  block(`${PREFIX} Tanjiro Kamado, Unwavering Resolve Arc`, 26, 24),
  block(`${PREFIX} Mugen Train Arc`, 7, 7),
  block(`${PREFIX} Entertainment District Arc`, 11, 11),
  block(`${PREFIX} Swordsmith Village Arc`, 11, 11),
  block(`${PREFIX} Hashira Training Arc`, 8, 8),
])
const FILM_NAME = 'Demon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train'
/** Urteile, die erst die Teil-Regel setzt (Begründung trägt ihre Handschrift); die Reihenrechnung davor bleibt außen vor. */
const ausTeil = (s: CrSerie, ts: Title[]) => beurteile(s, ts).filter((x) => x.grund.includes('Folgen deutsch, einzige Staffel') || x.grund.includes('trägt den Namen des Films'))
const bereich = (von: number, bis2: number) => JSON.stringify([{ from: von, to: bis2, dub: true }])

const u = beurteile(demon, [titel(101922, 26, 'TV'), titel(112151, 1, 'MOVIE', FILM_NAME)])
const tvU = u.find((x) => x.titleId === 101922)
const filmU = u.find((x) => x.titleId === 112151)
pruefe('TV (26 Folgen) bekommt dub: true', tvU?.dub === true, u)
pruefe('TV trägt Bereich 1–24 (die belegten deutschen Folgen)', JSON.stringify(tvU?.dubRanges) === bereich(1, 24), tvU?.dubRanges)
pruefe('Film bekommt dub: true, ohne Bereiche', filmU?.dub === true && !filmU.dubRanges, u)
pruefe('Film ohne Namensbezug zu einem Block (Crown-Handler-Chapter-5-Art, kein Datum) bleibt offen', beurteile(demon, [titel(204584, 1, 'MOVIE', 'Princess Principal: Crown Handler - Chapter 5')]).length === 0)
pruefe('Film, dessen Name zu keinem Block passt, bleibt auch bei gleichem Wortanfang offen', beurteile(demon, [titel(5, 1, 'MOVIE', 'Demon Slayer -Kimetsu no Yaiba- The Movie: Something Else')]).length === 0)

pruefe('Gegenprobe: 12-Folgen-Serie ohne passenden Block bleibt offen', beurteile(demon, [titel(1, 12, 'TV')]).length === 0)
const zweiGleiche = serie([block('A', 26, 24), block('B', 26, 26), block('C', 7, 7)])
pruefe('Gegenprobe: zwei Blöcke mit 26 Folgen, einer teils deutsch → offen', beurteile(zweiGleiche, [titel(101922, 26, 'TV')]).length === 0)
const nullBlock = serie([block('A', 26, 24), block('B', 7, 0), block('C', 11, 11)])
pruefe('Gegenprobe: ein Block ganz ohne Deutsch → der Film bleibt offen', beurteile(nullBlock, [titel(112151, 1, 'MOVIE', FILM_NAME)]).length === 0)
const spaet = serie([{ ...block(`${PREFIX} Tanjiro Kamado, Unwavering Resolve Arc`, 26, 2), deutscheFolgen: folgen([25, 26]) }, block(`${PREFIX} Mugen Train Arc`, 7, 7)])
pruefe('Bereich folgt den Nummern (25–26 deutsch)', JSON.stringify(beurteile(spaet, [titel(101922, 26, 'TV')])[0]?.dubRanges) === bereich(25, 26))

/* Randfälle der Regel. */
const ganzDeutsch = serie([block(`${PREFIX} A Arc`, 26, 26), block(`${PREFIX} Mugen Train Arc`, 7, 7)])
pruefe('Randfall: kein Block teils deutsch → keine Teil-Regel (Film bleibt offen)', ausTeil(ganzDeutsch, [titel(112151, 1, 'MOVIE', FILM_NAME)]).length === 0)
pruefe('Randfall: Serie ohne deutsches Angebot → kein Ja', ausTeil({ ...demon, deutschImAngebot: false } as CrSerie, [titel(101922, 26, 'TV')]).length === 0)
const luecke = serie([{ ...block(`${PREFIX} Unwavering Resolve Arc`, 26, 24), deutscheFolgen: folgen([1, 2]) }, block(`${PREFIX} Mugen Train Arc`, 7, 7)])
pruefe('Randfall: Zahl der Nummern passt nicht zur deutschen Zahl → offen', beurteile(luecke, [titel(101922, 26, 'TV')]).length === 0)
const nachEnde = serie([
  { ...block(`${PREFIX} Unwavering Resolve Arc`, 26, 2), deutscheFolgen: [{ nummer: 1, guid: 'G', laufend: 53 }, { nummer: 2, guid: 'H', laufend: 54 }] },
  block(`${PREFIX} Mugen Train Arc`, 7, 7),
])
pruefe('Randfall: alle deutschen Folgen hinter dem Ende des Titels → offen', ausTeil(nachEnde, [titel(101922, 26, 'TV')]).length === 0)
const kapitel = serie([block('Princess Principal: Crown Handler', 4, 2), block('Princess Principal: Another Block', 12, 12)])
pruefe('Randfall: Kapitelfilm entscheidet `kapitelImBlock`, die Teil-Regel setzt kein Ja', beurteile(kapitel, [titel(7, 1, 'MOVIE', 'Princess Principal: Crown Handler Chapter 3')]).every((x) => x.dub !== true))
const zwei = beurteile(demon, [titel(101922, 26, 'TV'), titel(77, 7, 'TV')])
pruefe('Randfall: jedes Urteil nur einmal, vorhandene gehen vor', new Set(zwei.map((x) => x.titleId)).size === zwei.length && zwei.length === 2, zwei)
const persona = serie([block('Persona 5 the Animation', 26, 26), block('Persona 5 the Animation OVA', 1, 0)])
pruefe('Persona-5-Art: geteilte Adresse, zwei OVAs mit je 1 Folge, ein Block ohne Deutsch → offen', beurteile(persona, [titel(109418, 1, 'OVA'), titel(110265, 1, 'OVA')]).length === 0)

/* Bau: der Verweis trägt dub und Bereiche. */
const t1 = titel(101922, 26, 'TV')
const t2 = titel(112151, 1, 'MOVIE', FILM_NAME)
const t3 = titel(204584, 1, 'MOVIE', 'Princess Principal: Crown Handler - Chapter 5')
const titles = new Map<number, Title>([[t1.id, t1], [t2.id, t2], [t3.id, t3]])
ordneCrSerienZu({ titles, crDub: { scrapedAt: '2026-11-16', serien: [demon] } as unknown as CrDubData, usNeinWiderlegt: () => false, verweiseEntfernt: [] })
pruefe('Bau: TV trägt dub und dubRanges 1–24', t1.streams[0]!.dub === true && JSON.stringify(t1.streams[0]!.dubRanges) === bereich(1, 24), t1.streams[0])
pruefe('Bau: Film trägt dub: true', t2.streams[0]!.dub === true, t2.streams[0])
pruefe('Bau: Film ohne Namensbezug an der geteilten Seite bleibt ohne Urteil', t3.streams[0]!.dub === undefined, t3.streams[0])

/* Zweiter Aufrufweg: frisch ergänzter Weg (`beurteileFrischeWege`). */
const frisch = titel(101922, 26, 'TV')
beurteileFrischeWege({
  title: frisch,
  belegFuer: () => undefined,
  crOffeneBefunde: {},
  crSerienJeKennung: new Map(),
  crNachUrl: new Map([[URL, demon]]),
  adnArchiv: { serien: new Map() } as never,
  adnStreamSchaerfen: () => false,
})
pruefe('Frischer Weg: dub und dubRanges 1–24 über die Nachbewertung', frisch.streams[0]!.dub === true && JSON.stringify(frisch.streams[0]!.dubRanges) === bereich(1, 24), frisch.streams[0])

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
