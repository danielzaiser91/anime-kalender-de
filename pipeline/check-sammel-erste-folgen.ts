/**
 * Zusicherungen zu „Die ersten N Folgen sind ab sofort auf Deutsch“ im Sammelartikel (Snowball Earth, Disney+, Anime2You 24.09.2026):
 * Die Aussage wird ein Teil-Termin (Folge 1–N, im Angebot spätestens am Tag der Meldung). Nachgestellte Zeilen, erfundene Titel, kein Netz.
 * Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { releasesAus } from './lib/meldungen.ts'
import { ersteFolgenAusZeile } from './lib/sammel-erste-folgen.ts'
import { leseSammelartikel, sammelVerwurf, vorschlaegeAusSammelartikel } from './lib/sammelartikel.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const TAG = '2026-09-24'
const artikel = { url: 'https://www.anime2you.de/news/1/disney-plus-x/', publishedAt: TAG }
const SATZ = 'Die ersten sechs Episoden von »Snowball Earth« sind ab sofort mit deutscher Synchronisation bei Disney+ verfügbar.'

/* Fließtext: Titel im Satz, „ab sofort“ und der Anbieter stehen in derselben Zeile. */
const satz = leseSammelartikel(SATZ, TAG)
pruefe('Satz: ein Eintrag Snowball Earth, deutsch, Folge 1–6', satz.length === 1 && satz[0]?.titel === 'Snowball Earth' && satz[0].deutsch && satz[0].erste === 6, satz)
pruefe('Satz: Meldetag als geschätzter Tag, Anbieter Disney+, kein Wochentakt', satz[0]?.datum === TAG && satz[0].datumGeschaetzt === true && satz[0].stream.join() === 'disney+' && !satz[0].woechentlich, satz)
pruefe('Satz: wird nicht verworfen', satz[0] !== undefined && sammelVerwurf(satz[0]) === undefined, satz)

/* Titelblock: die Aussage steht in einem Feld, der Tag kommt aus „Ab sofort:“. */
const block = leseSammelartikel(
  ['Ab sofort: »Snowball Earth« – Staffel 1', 'Episoden: 13', 'Sprache: Deutsch (Episode 1 bis 6), Japanisch (UT)', 'Stream: Disney+'].join('\n'),
  TAG,
)
pruefe('Block: Folge 1–6 am Meldetag, Disney+', block.length === 1 && block[0]?.erste === 6 && block[0].datum === TAG && block[0].stream.join() === 'Disney+', block)

/* Ein Simulcast-Block mit der Aussage im Hinweis: der Wochentakt gilt nur für den Originalton, deutsch sind die ersten Folgen. */
const takt = leseSammelartikel(
  ['Ab sofort: »Testserie«', 'Episoden: 1 verfügbar', 'Sprache: Deutsch, Japanisch (UT)', 'Simulcast: Jeden Freitag um 17:30 Uhr', 'Hinweis: Die ersten drei Folgen sind ab sofort auf Deutsch verfügbar', 'Stream: Disney+'].join('\n'),
  TAG,
)
pruefe('Simulcast-Block: erste 3 Folgen, kein Wochentakt', takt[0]?.erste === 3 && takt[0].woechentlich === false, takt)

/* Vorschlag und Termin. */
const titel = [{ id: 7, titleEn: 'Snowball Earth', titleRomaji: 'Snowball Earth', franchiseId: 7, format: 'TV', jpYear: 2026, episodes: 13, streams: [] }] as unknown as Title[]
const vorschlaege = vorschlaegeAusSammelartikel(artikel, satz, 'disneyplus')
pruefe('Vorschlag trägt ersteFolgen, nicht folgen', vorschlaege[0]?.ersteFolgen === 6 && vorschlaege[0].folgen === undefined, vorschlaege)
const termin = releasesAus(vorschlaege, titel, [], '2026-10-12')[0]
pruefe('Termin: Disney+, batch, im Angebot seit dem Meldetag, 6 Folgen', termin?.platform === 'disneyplus' && termin.releaseType === 'batch' && termin.dateMeaning === 'available-from' && termin.schedule.firstEpisodeDate === TAG && termin.schedule.episodeCount === 6, termin)
pruefe('Termin: keine Uhrzeit, Tag als geschätzt gekennzeichnet, Quelle genannt', termin?.schedule.estimated === true && termin.schedule.time === undefined && termin.sources.length === 1, termin)

/* Gegenprobe Doppelung: Ein vorhandener Termin desselben Titels beim selben Anbieter (kuratiert oder gemessen) gewinnt. */
const vorhanden = { slug: 'snowball-earth-disneyplus', titleId: 7, name: 'Snowball Earth', platform: 'disneyplus', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-09-18' }, sources: ['x'] } as unknown as Release
pruefe('Vorhandener Disney+-Termin desselben Titels: kein zweiter', releasesAus(vorschlaege, titel, [vorhanden], '2026-10-12').length === 0)
const andereWeg = { ...vorhanden, platform: 'netflix' } as Release
pruefe('Vorhandener Termin bei einem anderen Anbieter ändert nichts', releasesAus(vorschlaege, titel, [andereWeg], '2026-10-12').length === 1)

/* Gegenprobe One Piece (Anime2You 03.09.2026): „die ersten 92 Episoden“ im Fließtext und „92 (komplett)“ im Block sind dieselbe Menge, es bleibt „komplett“. */
const komplett = leseSammelartikel(
  ['Zu den neuesten Ergänzungen gehören die ersten 92 Episoden von »One Piece«, die ab sofort auf Disney+ mit deutscher Synchronisation abrufbar sind.', '»One Piece« – Staffel 1 bis 3', 'Episoden: 92 (komplett)', 'Sprache: Deutsch, Japanisch (UT)', 'Stream: Disney+'].join('\n'),
  TAG,
)
pruefe('Fließtext + „(komplett)“: kein Teil-Termin, Folgenzahl bleibt', komplett.find((e) => e.titel === 'One Piece')?.erste === undefined && komplett.find((e) => e.titel === 'One Piece')?.folgen === 92, komplett)

/* Gegenproben Lesart: ohne ausdrücklich deutsche Fassung, bei Disc, Verneinung und nur einer Folge entsteht nichts. */
const nein = (name: string, zeile: string): void => pruefe(name, ersteFolgenAusZeile(zeile) === undefined, ersteFolgenAusZeile(zeile))
nein('Nur Originalton: kein Teil-Termin', 'Die ersten sechs Episoden von »X« sind ab sofort mit Untertiteln bei Disney+ verfügbar.')
nein('Blu-ray: kein Streaming-Teiltermin', 'Das Volume umfasst die ersten sechs Episoden und erscheint mit deutscher Synchronisation auf Blu-ray.')
nein('Verneinung', 'Die ersten sechs Episoden sind noch nicht auf Deutsch verfügbar.')
nein('Eine Folge ist kein Bereich', 'Die ersten 1 Folgen sind auf Deutsch verfügbar.')
nein('Bereich ohne deutsche Fassung in der Zeile', 'Episoden: 1 bis 6')
const feld = leseSammelartikel(['Ab sofort: »Testserie«', 'Episoden: 1 bis 6', 'Sprache: Deutsch, Japanisch (UT)', 'Stream: Disney+'].join('\n'), TAG)
pruefe('Felder auf getrennten Zeilen: bleibt wie bisher ohne Teil-Termin', feld[0]?.erste === undefined, feld)
const unbestaetigt = leseSammelartikel(['Ab sofort: »Testserie«', 'Sprache: Deutsch, Japanisch (UT)', 'Hinweis: Deutsche Synchronisation noch nicht bestätigt', 'Hinweis: Die ersten sechs Folgen auf Deutsch'].join('\n'), TAG)
pruefe('Hinweis „noch nicht bestätigt“ bleibt maßgeblich', unbestaetigt[0]?.erste === undefined && unbestaetigt[0]?.deutsch === false, unbestaetigt)
const fremd = leseSammelartikel(['Ab sofort: »Serie A«', 'Sprache: Deutsch, Japanisch (UT)', 'Stream: Disney+', 'Die ersten sechs Folgen von »Serie B« sind auf Deutsch.'].join('\n'), TAG)
pruefe('Satz mit anderem Titel trifft nur diesen, nicht den Block davor', fremd.find((e) => e.titel === 'Serie A')?.erste === undefined, fremd)
pruefe('Ohne „ab sofort“ und ohne Tag: kein Starttag, nichts erfunden', fremd.find((e) => e.titel === 'Serie B')?.datum === undefined, fremd)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-sammel-erste-folgen: ok')
