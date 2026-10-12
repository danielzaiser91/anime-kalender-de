/**
 * Zusicherungen zu den Wegen je Staffel bei Cartoons (`lib/cartoon-wege.ts`, `bau/cartoon-wege.ts`): die Teilbereiche eines
 * Anbieters ergeben genau die Staffelsumme, ein Häkchen gibt es nur aus einem Handbeleg mit Folgenbereichen, JustWatchs Ton
 * je Staffel bleibt Hinweis. Läuft in `check:logic`; der Bestandsteil steht in `check-cartoon-wege-bestand.ts`.
 */
import { staffelBereiche, verteileWeg } from './lib/cartoon-wege.ts'
import { verteileWege } from './bau/cartoon-wege.ts'
import type { StreamLink, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const bereiche = (...folgen: number[]) => staffelBereiche(folgen.map((f, i) => ({ nr: i + 1, folgen: f })))
const ohneUrteil: StreamLink = { platform: 'primevideo', url: 'https://watch.amazon.de/detail?gti=x' }
const teile = (ws: StreamLink[]) => ws.map((w) => `${w.teilBereich?.von}-${w.teilBereich?.bis}`).join()

pruefe('Bereiche zählen durchlaufend', bereiche(13, 10).map((b) => `${b.von}-${b.bis}`).join() === '1-13,14-23')

// Niko: Ohne Haken und ohne JustWatch-Hinweis trägt keine Staffel etwas Eigenes, der Weg bleibt ganz (sonst 44 Pillen bei American Dad).
const niko = verteileWeg(ohneUrteil, bereiche(13, 10))
pruefe('ohne Haken und Hinweis: Weg bleibt ganz', niko.length === 1 && !niko[0].teilBereich && niko[0] === ohneUrteil)
const nikoHinweis = verteileWeg(ohneUrteil, bereiche(13, 10), () => '2026-10-11')
pruefe('mit Hinweis: ein Weg je Staffel, lückenlos', teile(nikoHinweis) === '1-13,14-23', teile(nikoHinweis))
pruefe('mit Hinweis: kein dub, keine Bereiche', nikoHinweis.every((w) => w.dub === undefined && !w.dubRanges))
pruefe('Adresse bleibt an jedem Weg', nikoHinweis.every((w) => w.url === ohneUrteil.url))

// Jack: Handbeleg mit Bereichen gibt jeder Staffel ihr Häkchen, in durchlaufender Zählung.
const jack = verteileWeg({ platform: 'netflix', url: 'x', dub: true, dubRanges: [{ from: 1, to: 21, dub: true }] }, bereiche(1, 10, 10))
pruefe('Handbeleg: Häkchen je Staffel', teile(jack) === '1-1,2-11,12-21' && jack.every((w) => w.dub === true), teile(jack))
pruefe('Handbeleg: Bereiche auf die Staffel beschnitten', jack[1].dubRanges?.[0].from === 2 && jack[1].dubRanges?.[0].to === 11)

// Lücke im Beleg: keine Staffel ohne Aussage bekommt ein Häkchen; eine Staffel nur mit Nein bekommt kein Ja.
const luecke = verteileWeg(
  { platform: 'netflix', url: 'x', dub: true, dubRanges: [{ from: 1, to: 5, dub: true }, { from: 11, to: 15, dub: false }] },
  bereiche(10, 10, 10),
)
pruefe('Beleg mit Lücke: Staffel ohne Aussage bleibt ohne Urteil', luecke[2].dub === undefined && !luecke[2].dubRanges)
pruefe('Beleg mit Lücke: Staffel mit Teilbeleg behält ihn', luecke[0].dub === true && luecke[0].dubRanges?.length === 1)
pruefe('Beleg mit Nein: Staffel bekommt Nein, kein Ja', luecke[1].dub === false)

// Ohne Folgenbereiche (Barbie: 12 von 110 Folgen) bleibt der Weg ganz — sonst bekäme jede Staffel ein unbelegtes Häkchen.
const barbie = verteileWeg({ platform: 'netflix', url: 'x', dub: true }, bereiche(23, 20, 16))
pruefe('Handbeleg ohne Bereiche: Weg bleibt ganz', barbie.length === 1 && !barbie[0].teilBereich && barbie[0].dub === true)
pruefe('Weg mit Ausschnitt bleibt unberührt', verteileWeg({ ...ohneUrteil, teilBereich: { von: 3, bis: 9 } }, bereiche(5, 5)).length === 1)
pruefe('eine Staffel: nichts zu verteilen', verteileWeg(ohneUrteil, bereiche(23)).length === 1)

// JustWatch je Staffel: nur Hinweis mit Datum, nie dub.
const mitHinweis = verteileWeg(ohneUrteil, bereiche(13, 10), (nr) => (nr === 1 ? '2026-10-11' : undefined))
pruefe('JustWatch: Hinweis nur an der genannten Staffel', mitHinweis[0].dubQuelle === 'justwatch' && mitHinweis[0].dubStand === '2026-10-11' && !mitHinweis[1].dubQuelle)
pruefe('JustWatch: schreibt nie dub', mitHinweis.every((w) => w.dub === undefined))
pruefe('JustWatch: ein Handbeleg-Weg trägt keine Kennzeichnung', jack.every((w) => !w.dubQuelle))

// Der Bau: JustWatchs Staffelnummern gelten nur bei JustWatch-Staffeln; was auf der Prüfliste steht, bleibt ganz.
const jwBefund = {
  geprueftAm: '2026-10-11',
  staffeln: [
    { nr: 1, folgen: 13, angebote: [{ anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio: ['de'] }] },
    { nr: 2, folgen: 10, angebote: [{ anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio: ['ja'] }] },
  ],
}
const titel = (id: number, quelle: 'justwatch' | 'tmdb'): Title =>
  ({ id, streams: [{ ...ohneUrteil }], staffeln: [{ nr: 1, folgen: 13 }, { nr: 2, folgen: 10 }], staffelnQuelle: quelle }) as unknown as Title
const [vonJw, vonTmdb, geprueft] = [titel(-1, 'justwatch'), titel(-2, 'tmdb'), titel(-3, 'justwatch')]
verteileWege([vonJw, vonTmdb, geprueft], { '-1': jwBefund, '-2': jwBefund, '-3': jwBefund }, new Set([-3]))
pruefe('Bau: JustWatch-Staffeln tragen den Hinweis an der Staffel mit deutschem Ton', vonJw.streams[0].dubQuelle === 'justwatch' && !vonJw.streams[1].dubQuelle)
pruefe('Bau: TMDB-Staffeln bekommen keinen Hinweis (Nummern können abweichen)', vonTmdb.streams.length === 1 && !vonTmdb.streams[0].dubQuelle)
pruefe('Bau: Titel auf der Prüfliste behält den Weg ganz', geprueft.streams.length === 1)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den Cartoon-Wegen verletzt`)
  process.exit(1)
}
console.log('Cartoon-Wege: Zusicherungen erfüllt')
