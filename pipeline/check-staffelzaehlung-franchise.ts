/**
 * Die Staffelzählung einer Meldung läuft nur über Staffeln derselben Serie (16.11.2026): „»Naruto Shippuden« – Staffel 4“ landete an Boruto,
 * „»Yu-Gi-Oh!« – Staffel 5“ an Zexal, weil die Franchise Nachfolger und andere Serien mitzählte. Läuft in `check:logic`; erfundene Titel, kein Netz.
 */
import type { Title } from '../shared/types.ts'
import { releasesAus, type Vorschlag } from './lib/meldungen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const titel = (id: number, franchiseId: number, jpYear: number, name: string, format = 'TV'): Title =>
  ({ id, franchiseId, jpYear, format, titleDe: name, titleEn: name, titleRomaji: name, keywords: [], genres: [], streams: [] }) as unknown as Title
const vorschlag = (artikel: string, tag: string): Vorschlag =>
  ({ articleTitle: artikel, articleUrl: 'https://www.anime2you.de/news/1/x', publishedAt: tag, category: 'streaming', platforms: ['disneyplus'], dates: [{ iso: tag, context: 'Sammelartikel' }], dub: 'zugesagt', folgen: '52', woechentlich: false }) as unknown as Vorschlag
const aus = (titel: Title[], artikel: string) => releasesAus([vorschlag(artikel, '2026-11-04')], titel, [], '2026-11-16').map((r) => r.titleId)

/* Franchise 20 wie im Bestand: Naruto, Shippuden, ein Spin-off, Boruto — vier Serien, keine vier Staffeln. */
const naruto = [titel(20, 20, 2002, 'Naruto'), titel(1735, 20, 2007, 'Naruto Shippuden'), titel(12979, 20, 2012, 'Naruto Spin off! Rock Lee'), titel(97938, 20, 2017, 'Boruto: Naruto Next Generations')]
pruefe('Naruto Shippuden – Staffel 4 hängt nicht an Boruto', aus(naruto, '»Naruto Shippuden« – Staffel 4').join() === '', aus(naruto, '»Naruto Shippuden« – Staffel 4'))
const yugioh = [titel(481, 481, 2000, 'Yu-Gi-Oh!'), titel(482, 481, 2004, 'Yu-Gi-Oh! GX'), titel(3972, 481, 2008, 'Yu-Gi-Oh! 5D’s'), titel(10015, 481, 2011, 'Yu-Gi-Oh! Zexal'), titel(15489, 481, 2012, 'Yu-Gi-Oh! Zexal II')]
pruefe('Yu-Gi-Oh! – Staffel 5 hängt weder an Zexal noch an Zexal II', aus(yugioh, '»Yu-Gi-Oh!« – Staffel 5').join() === '', aus(yugioh, '»Yu-Gi-Oh!« – Staffel 5'))

/* Was weiter zählt: Staffeln mit bloßer Zählung im Namen (ohne „Staffel/Season“-Wort) hinter dem Serienamen. */
const reihe = [titel(1, 1, 2020, 'Foo'), titel(2, 1, 2022, 'Foo II'), titel(3, 1, 2024, 'Foo III')]
pruefe('Foo – Staffel 3 findet „Foo III“ per Zählung', aus(reihe, '»Foo« – Staffel 3').join() === '3', aus(reihe, '»Foo« – Staffel 3'))
pruefe('Foo – Staffel 1 bleibt der Titel selbst', aus(reihe, '»Foo« – Staffel 1').join() === '1')


/* Filme zählen weiter über die ganze Reihe (die Namensregel gilt nur für Staffeln). */
const filme = [titel(1, 1, 2020, 'Foo'), titel(5, 1, 2022, 'Foo: The Movie', 'MOVIE'), titel(6, 1, 2024, 'Foo: Das Finale', 'MOVIE')]
pruefe('Zweiter Film von »Foo« findet den zweiten Film, auch ohne Zählung im Namen', aus(filme, 'Zweiter Film von »Foo«').join() === '6', aus(filme, 'Zweiter Film von »Foo«'))
if (fehler) {
  console.error(`check-staffelzaehlung-franchise: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-staffelzaehlung-franchise: alles grün')
