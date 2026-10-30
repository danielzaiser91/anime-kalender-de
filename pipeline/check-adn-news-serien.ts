/**
 * Welche Serien ein ADN-News-Artikel belegt (30.10.2026). Anlass: „Undefeated Bahamut Chronicle" nannte im Fließtext
 * „Studio: Lerche (Assassination Classroom, …)"; die Verweise wurden als Quelle an Assassination Classroom gehängt.
 * Die Ausschnitte sind wörtlich aus den Beiträgen der WordPress-Schnittstelle (Abruf 30.10.2026), nur gekürzt.
 */
import { artikelAusBeitraegen, artikelJeShow, serienDesArtikels, type WpPost } from './lib/adn-news.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
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
pruefe('Klammer weit zurück und geschlossen: Verweis zählt', serienDesArtikels('(a) <a href="https://animationdigitalnetwork.com/de/video/5-x">x</a>').join() === '5')
const weitWeg = '<a href="https://animationdigitalnetwork.com/de/video/7-z">z</a>(' + 'x'.repeat(500) + '<a href="https://animationdigitalnetwork.com/de/video/5-x">x</a>'
pruefe('Klammer über 400 Zeichen zurück gilt nicht mehr', serienDesArtikels(weitWeg).join() === '7,5', serienDesArtikels(weitWeg))
pruefe('Bahamut: nur die Serie des Knopfs', serienDesArtikels(BAHAMUT).join() === '398', serienDesArtikels(BAHAMUT))
pruefe('School Babysitters: Studio-Verweis zählt nicht', serienDesArtikels(BABYSITTERS).join() === '502', serienDesArtikels(BABYSITTERS))
pruefe('Line-up mit Knöpfen: jede Serie mit Knopf', serienDesArtikels(LINEUP_MIT_KNOEPFEN).join() === '1320,1321', serienDesArtikels(LINEUP_MIT_KNOEPFEN))
pruefe('ohne Knopf bleiben alle Verweise', serienDesArtikels(OHNE_KNOPF).join() === '887,1383', serienDesArtikels(OHNE_KNOPF))
pruefe('kein Verweis: leer', serienDesArtikels('<p>nichts</p><a href="https://example.org/">x</a>').length === 0)
pruefe('Knopf ohne Serienverweis zählt nicht als Knopf', serienDesArtikels('<a class="wp-block-button__link" href="https://example.org/">x</a>' + OHNE_KNOPF).join() === '887,1383')

/* Folge für die Quelle: Assassination Classroom (344) bekommt den Bahamut-Artikel nicht mehr. */
const beitraege: WpPost[] = [
  { link: 'https://news.example/de/2026/09/10/bahamut/', date: '2026-09-10T10:00:00', title: { rendered: 'Bahamut' }, content: { rendered: BAHAMUT } },
  { link: 'https://news.example/de/2026/10/05/kita/', date: '2026-10-05T10:00:00', title: { rendered: 'Babysitters' }, content: { rendered: BABYSITTERS } },
  { link: 'https://news.example/fr/2026/10/05/kita/', date: '2026-10-05T10:00:00', content: { rendered: BABYSITTERS } },
  { link: 'https://news.example/de/2026/10/06/ohne/', content: { rendered: '<p>kein Verweis</p>' } },
]
const artikel = artikelAusBeitraegen(beitraege)
pruefe('zwei deutsche Artikel mit Verweis', artikel.length === 2, artikel.map((a) => a.url))
const jeShow = artikelJeShow({ geholtAm: '2026-10-30T00:00:00Z', artikel })
pruefe('344 ohne Artikel', !jeShow.has(344), jeShow.get(344))
pruefe('398 mit Bahamut-Artikel', jeShow.get(398)?.url === 'https://news.example/de/2026/09/10/bahamut/')
pruefe('502 mit Kita-Artikel', jeShow.get(502)?.url === 'https://news.example/de/2026/10/05/kita/')

if (fehler) process.exit(1)
console.log('check-adn-news-serien: 14 Zusicherungen ok (Verweise in Klammern zählen nicht, Sammelmeldung bleibt vollständig)')
