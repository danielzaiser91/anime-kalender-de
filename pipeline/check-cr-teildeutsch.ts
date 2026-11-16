/**
 * Wächter (16.11.2026, Issue 4047): Ein teilweise deutscher Crunchyroll-Block darf das Urteil nicht kippen.
 * Eingefroren: Demon Slayer (101922, 26 Folgen) und Film Mugen Train (112151) an der Serie GY5P48XEY,
 * Stand des Dub-Bestands vom 16.11.: Staffel 1 deutsch 24 von 26 (Folgen 25 und 26 fremd), alle anderen Blöcke vollständig.
 * Vorher blieben beide ohne `dub`, weil die Zahl 26 als „auch an einem nicht ganz deutschen Block“ galt.
 */
import { beurteile, type CrDubData, type CrSerie } from './lib/crunchyroll-dub.ts'
import { ordneCrSerienZu } from './bau/09-4-1-serien.ts'
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
  name, staffelId: name, folgen: gesamt, kacheln: gesamt, deutsch, fremd: gesamt - deutsch, deutscheFassung: deutsch > 0, deutscheFolgen: folgen(bis(deutsch)),
})
const serie = (staffeln: ReturnType<typeof block>[]): CrSerie =>
  ({ url: URL, seriesId: 'GY5P48XEY', quelle: 'api', katalog: 'de', geprueftAm: '2026-11-16', deutschImAngebot: true, staffeln }) as unknown as CrSerie
const titel = (id: number, episodes: number, format: string): Title =>
  ({ id, episodes, format, jpYear: 2019, titleEn: `T${id}`, streams: [{ platform: 'crunchyroll', url: URL, zugang: 'abo' }] }) as unknown as Title

const demon = serie([
  block('Unwavering Resolve Arc', 26, 24), block('Mugen Train Arc', 7, 7), block('Entertainment District Arc', 11, 11),
  block('Swordsmith Village Arc', 11, 11), block('Hashira Training Arc', 8, 8),
])
const bereich = (von: number, bis2: number) => JSON.stringify([{ from: von, to: bis2, dub: true }])

const u = beurteile(demon, [titel(101922, 26, 'TV'), titel(112151, 1, 'MOVIE')])
const tvU = u.find((x) => x.titleId === 101922)
const filmU = u.find((x) => x.titleId === 112151)
pruefe('TV (26 Folgen) bekommt dub: true', tvU?.dub === true, u)
pruefe('TV trägt Bereich 1–24 (die belegten deutschen Folgen)', JSON.stringify(tvU?.dubRanges) === bereich(1, 24), tvU?.dubRanges)
pruefe('Film bekommt dub: true, ohne Bereiche', filmU?.dub === true && !filmU.dubRanges, u)

pruefe('Gegenprobe: 12-Folgen-Serie ohne passenden Block bleibt offen', beurteile(demon, [titel(1, 12, 'TV')]).length === 0)
const zweiGleiche = serie([block('A', 26, 24), block('B', 26, 26), block('C', 7, 7)])
pruefe('Gegenprobe: zwei Blöcke mit 26 Folgen, einer teils deutsch → offen', beurteile(zweiGleiche, [titel(101922, 26, 'TV')]).length === 0)
const nullBlock = serie([block('A', 26, 24), block('B', 7, 0), block('C', 11, 11)])
pruefe('Gegenprobe: ein Block ganz ohne Deutsch → der Film bleibt offen', beurteile(nullBlock, [titel(112151, 1, 'MOVIE')]).length === 0)
const spaet = serie([{ ...block('Unwavering Resolve Arc', 26, 2), deutscheFolgen: folgen([25, 26]) }, block('Mugen Train Arc', 7, 7)])
pruefe('Bereich folgt den Nummern (25–26 deutsch)', JSON.stringify(beurteile(spaet, [titel(101922, 26, 'TV')])[0]?.dubRanges) === bereich(25, 26))

/* Bau: der Verweis trägt dub und Bereiche. */
const t1 = titel(101922, 26, 'TV')
const t2 = titel(112151, 1, 'MOVIE')
const titles = new Map<number, Title>([[t1.id, t1], [t2.id, t2]])
ordneCrSerienZu({ titles, crDub: { scrapedAt: '2026-11-16', serien: [demon] } as unknown as CrDubData, usNeinWiderlegt: () => false, verweiseEntfernt: [] })
pruefe('Bau: TV trägt dub und dubRanges 1–24', t1.streams[0]!.dub === true && JSON.stringify(t1.streams[0]!.dubRanges) === bereich(1, 24), t1.streams[0])
pruefe('Bau: Film trägt dub: true', t2.streams[0]!.dub === true, t2.streams[0])

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
