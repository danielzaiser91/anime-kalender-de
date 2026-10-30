/**
 * Welche Serien ein ADN-News-Artikel belegt (30.10.2026). Anlass: „Undefeated Bahamut Chronicle" nannte im Fließtext
 * „Studio: Lerche (Assassination Classroom, …)"; die Verweise wurden als Quelle an Assassination Classroom gehängt.
 * Die Ausschnitte sind wörtlich aus den Beiträgen der WordPress-Schnittstelle (Abruf 30.10.2026), nur gekürzt.
 */
import { artikelAusBeitraegen, artikelJeShow, serienDesArtikels, type WpPost } from './lib/adn-news.ts'

let fehler = 0
let zusicherungen = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  zusicherungen++
  if (bedingung) return
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const BAHAMUT =
  '<p><em><a href="https://animationdigitalnetwork.com/de/video/398-saibahamut_tv"><strong>Undefeated Bahamut Chronicle</strong></a></em> ist ab sofort bei ADN</p>' +
  '<li>Studio: Lerche (<a href="https://animationdigitalnetwork.com/de/video/344-assassination-classroom" target="_blank" rel="noopener">Assassination Classroom</a>, &#8230;)</li>' +
  '<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="https://animationdigitalnetwork.com/de/video/398-saibahamut_tv">auf die watchlist</a></div>'
const BABYSITTERS =
  '<p><a href="https://animationdigitalnetwork.com/de/video/502-school-babysitters" target="_blank" rel="noopener"><strong><em>School Babysitters</em></strong></a> ist ab sofort</p>' +
  '<p>Brain&#8217;s Base (<em><a href="https://animationdigitalnetwork.com/de/video/344-assassination-classroom" target="_blank" rel="noopener">Assassination Classroom</a></em>) unter der Regie</p>' +
  '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://animationdigitalnetwork.com/de/video/502-school-babysitters">auf die watchlist</a></div>'
const LINEUP_MIT_KNOEPFEN =
  '<a class="" href="https://animationdigitalnetwork.com/de/video/1320-madoka-part2" target="" rel="noopener"><img src="x.png" /></a>' +
  '<a class="wp-block-button__link wp-element-button" href="https://animationdigitalnetwork.com/de/video/1320-madoka-part2" style="border-width:2px">auf die watchlist</a>' +
  '<a class="wp-block-button__link wp-element-button" href="https://animationdigitalnetwork.com/de/video/1321-madoka-rebellion" style="border-width:2px">auf die watchlist</a>'
/* Sammelmeldung „10 neue Anime ab Juni 2026": Serien im Fließtext (kein Knopf) und eine mit Knopf. */
const SAMMELMELDUNG =
  'im Stream zu entdecken: Den Animationsfilm <a href="https://animationdigitalnetwork.com/video/1396-dive-in-wonderland" title=""><em><strong>Alice im Wunderland: Dive in Wonderland</strong></em></a> aus dem Frühjahr, sowie Staffel 5 von <strong><em><a href="https://animationdigitalnetwork.com/de/video/427-sailor-moon" target="_blank" rel="noopener" title="">Sailor Moon</a></em></strong> und weitere Klassiker wie <a href="https://animationdigitalnetwork.com/de/video/190-gunslinger-girl" target="_blank" rel="noopener" title=""><em><strong>Gunslinger Girl</strong></em></a> und <a href="https://animationdigitalnetwork.com/de/video/1391-gantz" target="_blank" rel="noopener" title=""><em><strong>Gantz</strong></em></a>.</p><p class="wp-block-paragraph">Aber das ist noch nicht alles: Neben zwei neuen Donghua stehen ebenfalls <a href="https://animationdigitalnetwork.com/de/video/1370-kenichi-the-mightiest-disciple-the-attack-of-darkness" target="_blank" rel="noopener" title=""><em><strong>Kenichi: The Mightiest Disciple &#8211; The Attack of Darkness</strong></em></a>, <a href="https://animationdigitalnetwork.com/de/video/131-un-go" target="_blank" rel="noopener" title=""><strong><em>Un-Go</em></strong></a> und <a href="https://animationdigitalnetwork.com/de/video/770-aoi-hana-fleurs-bleues" target="_blank" rel="noopener" title=""><em><strong>Aoi Hana</strong></em></a> auf dem Programm!</p>' +
  '<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="https://animationdigitalnetwork.com/de/video/522-dances-with-the-dragons">Auf die Watchlist</a></div>'
/* Trailer-Beitrag ohne Watchlist-Knopf: beide Verweise sind Serien des Beitrags. */
const OHNE_KNOPF =
  '<a href="https://animationdigitalnetwork.com/video/887-dreamland"><a href="https://animationdigitalnetwork.com/de/video/1383-kill-blue">' +
  '<a href="https://animationdigitalnetwork.com/video/887-dreamland">'

pruefe(
  'Sammelmeldung mit teilweisen Knöpfen: alle Serien bleiben',
  serienDesArtikels(SAMMELMELDUNG).join() === '1396,427,190,1391,1370,131,770,522',
  serienDesArtikels(SAMMELMELDUNG),
)
const IN_KLAMMER = '(<a href="https://animationdigitalnetwork.com/de/video/344-x">x</a>)'
pruefe('nur Klammer-Verweise: alle bleiben', serienDesArtikels(IN_KLAMMER).join() === '344')
const SERIE = (n: number) => `<a href="https://animationdigitalnetwork.com/de/video/${n}-x">x</a>`
pruefe('geschlossene Klammer davor: Verweis zählt', serienDesArtikels(`${SERIE(7)}(a) ${SERIE(5)}`).join() === '7,5', serienDesArtikels(`${SERIE(7)}(a) ${SERIE(5)}`))
pruefe('Verweis ohne Serie zählt nicht als Verweis außerhalb', serienDesArtikels(`<a href="https://example.org/">x</a>(${SERIE(344)})`).join() === '344')
const TAG_MIT_KLAMMER = `${SERIE(7)}Lerche (<a href="https://animationdigitalnetwork.com/de/video/5-x" title=")">x</a>, ${SERIE(6)}`
pruefe('Klammer in einem Tag schließt nichts', serienDesArtikels(TAG_MIT_KLAMMER).join() === '7', serienDesArtikels(TAG_MIT_KLAMMER))
const weitWeg = '<a href="https://animationdigitalnetwork.com/de/video/7-z">z</a>(' + 'x'.repeat(500) + '<a href="https://animationdigitalnetwork.com/de/video/5-x">x</a>'
pruefe('Klammer über 400 Zeichen zurück gilt nicht mehr', serienDesArtikels(weitWeg).join() === '7,5', serienDesArtikels(weitWeg))
pruefe('Bahamut: nur die Serie des Knopfs', serienDesArtikels(BAHAMUT).join() === '398', serienDesArtikels(BAHAMUT))
pruefe('School Babysitters: Studio-Verweis zählt nicht', serienDesArtikels(BABYSITTERS).join() === '502', serienDesArtikels(BABYSITTERS))
pruefe('Line-up mit Knöpfen: jede Serie mit Knopf', serienDesArtikels(LINEUP_MIT_KNOEPFEN).join() === '1320,1321', serienDesArtikels(LINEUP_MIT_KNOEPFEN))
pruefe('ohne Knopf bleiben alle Verweise', serienDesArtikels(OHNE_KNOPF).join() === '887,1383', serienDesArtikels(OHNE_KNOPF))
pruefe('kein Verweis: leer', serienDesArtikels('<p>nichts</p><a href="https://example.org/">x</a>').length === 0)
pruefe('Knopf ohne Serienverweis zählt nicht als Knopf', serienDesArtikels('<a class="wp-block-button__link" href="https://example.org/">x</a>' + OHNE_KNOPF).join() === '887,1383')

/* Fließtext-Verweise als Vergleich (30.10.2026): Ausschnitte wörtlich aus den Beiträgen, nur gekürzt. */
const AD = 'https://animationdigitalnetwork.com'
const UTENA =
  `<figure class="wp-block-image"><a href="${AD}/de/video/213-revolutionary-girl-utena"><img loading="lazy" width="1024" /></a></figure>` +
  `<p>Sailor Moon: <em><a href="${AD}/de/video/427-sailor-moon" target="_blank" rel="noopener">Sailor Moon</a></em>. Der Film erschien 1999</p>` +
  `<figure class="wp-block-image"><a href="${AD}/de/video/1338-revolutionary-girl-utena-the-movie"><img loading="lazy" width="1024" /></a></figure>` +
  `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${AD}/de/video/1338-revolutionary-girl-utena-the-movie">auf die watchlist</a></div>`
const FULL_MOON =
  `<p><em><a href="${AD}/de/video/1366-full-moon" target="_blank" rel="noopener"><strong>Full Moon wo Sagashite</strong></a></em> ist ab sofort bei ADN</p>` +
  `<p>wie wir sie beispielsweise von <a href="${AD}/de/video/427-sailor-moon" target="_blank" rel="noopener">Sailor Moon</a> kennen</p>` +
  `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${AD}/de/video/1366-full-moon">auf die watchlist</a></div>`
const DRAGON_BALL =
  `<p>wöchentlich eine neue Episode von <em><a href="${AD}/video/1432-dragon-ball-super-beerus" target="_blank" rel="noopener"><strong>Dragon Ball Super: Beerus</strong></a></em>.</p>` +
  `<p>vom ursprünglichen <a href="${AD}/de/video/999-dragon-ball-super"><em><strong>Dragon Ball Super</strong></em></a> präsentiert wird</p>` +
  `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${AD}/video/1432-dragon-ball-super-beerus">auf die watchlist</a></div>`
const ONE_PIECE =
  `<p>geht <em><a href="${AD}/video/561-one-piece"><strong>One Piece</strong></a></em> in die Pause.</p>` +
  `<p>sowie das neue Special zur Serie <a href="${AD}/de/video/1412-one-piece-heroines-nami" target="_blank" rel="noopener"><em>ONE PIECE HEROINES: Nami</em></a> im Stream</p>` +
  `<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${AD}/video/561-one-piece">auf die watchlist</a></div>`
pruefe('Utena: Sailor Moon im Fließtext zählt nicht, Serie und Film bleiben', serienDesArtikels(UTENA).join() === '213,1338', serienDesArtikels(UTENA))
pruefe('Full Moon: Vergleich mit Sailor Moon zählt nicht', serienDesArtikels(FULL_MOON).join() === '1366', serienDesArtikels(FULL_MOON))
pruefe('Dragon Ball Super: Beerus: die ursprüngliche Serie zählt nicht', serienDesArtikels(DRAGON_BALL).join() === '1432', serienDesArtikels(DRAGON_BALL))
pruefe('One Piece: das Special im Fließtext zählt nicht', serienDesArtikels(ONE_PIECE).join() === '561', serienDesArtikels(ONE_PIECE))
const KNOPF = (n: number) => `<a class="wp-block-button__link" href="${AD}/de/video/${n}-x">auf die watchlist</a>`
const BILD = (n: number) => `<a href="${AD}/de/video/${n}-x"><img src="a.png" /></a>`
pruefe('ein Knopf, ein Fließtext-Verweis: nur der Knopf', serienDesArtikels(`${KNOPF(1)}${SERIE(2)}`).join() === '1')
pruefe('zwei Knopf-Serien, ein Fließtext-Verweis: nur die Knöpfe', serienDesArtikels(`${KNOPF(1)}${KNOPF(2)}${SERIE(3)}`).join() === '1,2')
pruefe('drei Knopf-Serien: Fließtext-Verweis bleibt (Sammelmeldung)', serienDesArtikels(`${KNOPF(1)}${KNOPF(2)}${KNOPF(3)}${SERIE(4)}`).join() === '1,2,3,4')
pruefe('ein Knopf, zwei Fließtext-Verweise: alle bleiben (Aufzählung)', serienDesArtikels(`${KNOPF(1)}${SERIE(2)}${SERIE(3)}`).join() === '1,2,3')
pruefe('derselbe Knopf zweimal zählt als eine Serie', serienDesArtikels(`${KNOPF(1)}${KNOPF(1)}${SERIE(2)}`).join() === '1')
pruefe('Bild-Teaser zählt wie ein Knopf', serienDesArtikels(`${BILD(1)}${SERIE(2)}`).join() === '1')
pruefe('Verweis mit Text im Link ist kein Bild-Teaser', serienDesArtikels(`${SERIE(1)}${SERIE(2)}`).join() === '1,2')
pruefe('Klammer-Verweis zählt nicht zu den Fließtext-Vergleichen', serienDesArtikels(`${KNOPF(1)}(${SERIE(2)})${SERIE(3)}`).join() === '1')

/* Folge für die Quelle: Assassination Classroom (344) bekommt den Bahamut-Artikel nicht mehr. */
const beitraege: WpPost[] = [
  { link: 'https://news.example/de/2026/09/10/bahamut/', date: '2026-09-10T10:00:00', title: { rendered: 'Bahamut' }, content: { rendered: BAHAMUT } },
  { link: 'https://news.example/de/2026/10/05/kita/', date: '2026-10-05T10:00:00', title: { rendered: 'Babysitters' }, content: { rendered: BABYSITTERS } },
  { link: 'https://news.example/fr/2026/10/05/kita/', date: '2026-10-05T10:00:00', content: { rendered: BABYSITTERS } },
  { link: 'https://news.example/de/2026/10/06/ohne/', content: { rendered: '<p>kein Verweis</p>' } },
  { link: 'https://news.example/de/2026/10/15/utena/', date: '2026-10-15T10:00:00', content: { rendered: UTENA } },
  { link: 'https://news.example/de/2026/10/01/beerus/', date: '2026-10-01T10:00:00', content: { rendered: DRAGON_BALL } },
]
const artikel = artikelAusBeitraegen(beitraege)
pruefe('vier deutsche Artikel mit Verweis', artikel.length === 4, artikel.map((a) => a.url))
const jeShow = artikelJeShow({ geholtAm: '2026-10-30T00:00:00Z', artikel })
pruefe('344 ohne Artikel', !jeShow.has(344), jeShow.get(344))
pruefe('398 mit Bahamut-Artikel', jeShow.get(398)?.url === 'https://news.example/de/2026/09/10/bahamut/')
pruefe('502 mit Kita-Artikel', jeShow.get(502)?.url === 'https://news.example/de/2026/10/05/kita/')
pruefe('Sailor Moon (427) ohne Utena-Artikel', !jeShow.has(427), jeShow.get(427))
pruefe('Dragon Ball Super (999) ohne Beerus-Artikel', !jeShow.has(999), jeShow.get(999))
pruefe('Utena (213) mit eigenem Artikel', jeShow.get(213)?.url === 'https://news.example/de/2026/10/15/utena/')
pruefe('Beerus (1432) mit eigenem Artikel', jeShow.get(1432)?.url === 'https://news.example/de/2026/10/01/beerus/')

if (fehler) process.exit(1)
console.log(`check-adn-news-serien: ${zusicherungen} Zusicherungen ok (Klammer-Verweise und Vergleiche im Fließtext zählen nicht, Sammelmeldung bleibt vollständig)`)
