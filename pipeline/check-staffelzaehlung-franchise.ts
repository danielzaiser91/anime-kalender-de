/**
 * Die Staffelzählung einer Meldung läuft nur über Staffeln derselben Serie (16.11.2026): „»Naruto Shippuden« – Staffel 4“ landete an Boruto,
 * „»Yu-Gi-Oh!« – Staffel 5“ an Zexal, weil die Franchise Nachfolger und andere Serien mitzählte. Läuft in `check:logic`; erfundene Titel, kein Netz.
 */
import type { Title } from '../shared/types.ts'
import { pflegeTerminverlauf, type TerminVerlauf } from './lib/news-verlauf.ts'
import { meldungenAus, releasesAus, type Vorschlag } from './lib/meldungen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const titel = (id: number, franchiseId: number, jpYear: number, name: string, format = 'TV', episodes?: number): Title =>
  ({ id, franchiseId, jpYear, format, episodes, titleDe: name, titleEn: name, titleRomaji: name, keywords: [], genres: [], streams: [] }) as unknown as Title
const vorschlag = (artikel: string, tag: string): Vorschlag =>
  ({ articleTitle: artikel, articleUrl: 'https://www.anime2you.de/news/1/x', publishedAt: tag, category: 'streaming', platforms: ['disneyplus'], dates: [{ iso: tag, context: 'Sammelartikel' }], dub: 'zugesagt', folgen: '52', woechentlich: false }) as unknown as Vorschlag
const aus = (titel: Title[], artikel: string) => releasesAus([vorschlag(artikel, '2026-11-04')], titel, [], '2026-11-16').map((r) => r.titleId)

/* Franchise 20 wie im Bestand: Naruto, Shippuden, ein Spin-off, Boruto — vier Serien, keine vier Staffeln. */
const naruto = [titel(20, 20, 2002, 'Naruto', 'TV', 220), titel(1735, 20, 2007, 'Naruto Shippuden', 'TV', 500), titel(12979, 20, 2012, 'Naruto Spin off! Rock Lee', 'TV', 51), titel(97938, 20, 2017, 'Boruto: Naruto Next Generations', 'TV', 293)]
pruefe('Naruto Shippuden – Staffel 4 hängt nicht an Boruto', aus(naruto, '»Naruto Shippuden« – Staffel 4').join() === '', aus(naruto, '»Naruto Shippuden« – Staffel 4'))
const yugioh = [titel(481, 481, 2000, 'Yu-Gi-Oh!', 'TV', 224), titel(482, 481, 2004, 'Yu-Gi-Oh! GX', 'TV', 180), titel(3972, 481, 2008, 'Yu-Gi-Oh! 5D’s', 'TV', 154), titel(10015, 481, 2011, 'Yu-Gi-Oh! Zexal', 'TV', 73), titel(15489, 481, 2012, 'Yu-Gi-Oh! Zexal II', 'TV', 73)]
pruefe('Yu-Gi-Oh! – Staffel 5 hängt weder an Zexal noch an Zexal II', aus(yugioh, '»Yu-Gi-Oh!« – Staffel 5').join() === '', aus(yugioh, '»Yu-Gi-Oh!« – Staffel 5'))
pruefe('Yu-Gi-Oh! – Staffel 1 bleibt der Titel selbst', aus(yugioh, '»Yu-Gi-Oh!« – Staffel 1').join() === '481')

/* Was weiter zählt: Serien mit eigenen Staffel-Einträgen, auch ohne Zählung im Namen (Minami-ke, je 13 Folgen). */
const minami = [titel(2963, 2963, 2007, 'Minami-ke', 'TV', 13), titel(3225, 2963, 2008, 'Minami-ke: Okawari', 'TV', 13), titel(5162, 2963, 2009, 'Minami-ke: Okaeri', 'TV', 13), titel(14511, 2963, 2013, 'Minami-ke: Tadaima', 'TV', 13), titel(179088, 2963, 2027, 'Minami-ke: Korekara', 'TV', 13)]
const meldung = (artikel: string) =>
  meldungenAus([{ articleTitle: artikel, articleUrl: 'https://www.anime2you.de/news/2/y', publishedAt: '2026-11-16', category: 'streaming', dates: [{ month: '2027-04', context: 'Start im April 2027' }] } as unknown as Vorschlag], minami, '2026-11-16').map((m) => m.titleId)
pruefe('Minami-ke: die fünfte Staffel (Korekara, ohne Zählung im Namen) bleibt als Meldung', meldung('Start der fünften »Minami-ke«-Staffel').join() === '179088', meldung('Start der fünften »Minami-ke«-Staffel'))
const reihe = [titel(1, 1, 2020, 'Foo'), titel(2, 1, 2022, 'Foo II'), titel(3, 1, 2024, 'Foo III')]
pruefe('Foo – Staffel 3 findet „Foo III“ per Zählung', aus(reihe, '»Foo« – Staffel 3').join() === '3', aus(reihe, '»Foo« – Staffel 3'))
pruefe('Foo – Staffel 1 bleibt der Titel selbst', aus(reihe, '»Foo« – Staffel 1').join() === '1')

/* Filme zählen weiter über die ganze Reihe. */
const filme = [titel(1, 1, 2020, 'Foo'), titel(5, 1, 2022, 'Foo: The Movie', 'MOVIE'), titel(6, 1, 2024, 'Foo: Das Finale', 'MOVIE')]
pruefe('Zweiter Film von »Foo« findet den zweiten Film, auch ohne Zählung im Namen', aus(filme, 'Zweiter Film von »Foo«').join() === '6', aus(filme, 'Zweiter Film von »Foo«'))

/* Entfällt ein Auto-Termin, weil die Zuordnung ihn nicht mehr bildet, führt der Verlauf ihn als zurückgezogen (nichts verschwindet still). */
const verlaufAlt = (titelId: number, wurzel: number): TerminVerlauf =>
  ({ datum: '2026-11-04', art: 'angekuendigt', titelId, name: `T${titelId}`, wurzel, platform: 'disneyplus', quelle: 'https://www.anime2you.de/news/1/x/', am: '2026-11-04' })
const kette = pflegeTerminverlauf({
  datiert: [],
  nachId: new Map([97938, 10015, 482].map((id) => [id, { id, franchiseId: id, titleDe: `T${id}` } as unknown as Title])),
  historie: { termine: { 'auto-97938-disneyplus': [verlaufAlt(97938, 20)], 'auto-10015-disneyplus': [verlaufAlt(10015, 481)], 'auto-482-disneyplus': [verlaufAlt(482, 481)] }, vergangen: {} },
  vorherige: [],
  name: (t) => t.titleDe ?? String(t.id),
  wurzel: (t) => t.id,
  grenze: '2026-09-01',
  heute: '2026-11-16',
  nurOriginalton: new Set(),
})
pruefe('Verlauf: Boruto, Zexal und GX stehen alle drei als zurückgezogen da', kette.length === 3 && kette.every((m) => m.zurueckgezogen !== undefined), kette.map((m) => [m.release, m.zurueckgezogen]))

if (fehler) {
  console.error(`check-staffelzaehlung-franchise: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-staffelzaehlung-franchise: alles grün')
