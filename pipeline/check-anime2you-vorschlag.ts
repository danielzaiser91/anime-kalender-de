/**
 * Zusicherungen zur Anime2You-Extraktion (P2, 10.10.2026): Die Gegenprobe lässt nur Vorschläge durch, die der Artikeltext trägt.
 * Läuft hinter `check:logic`; die Sätze stammen aus den vier Fällen, die am 10.10.2026 im Kalender fehlten (YAIBA, One Piece, Avatar, Jujutsu-Disc).
 */
import { beschreibe, pruefeVorschlag, genannteTage, type Vorschlag } from './lib/anime2you-vorschlag.ts'
import { artikelId, artikelText, neueKandidaten } from './lib/anime2you-artikel.ts'
import { mitWiderspruechen, type GespeicherterVorschlag } from './lib/anime2you-bestand.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const YAIBA =
  '»YAIBA: Samurai Legend« ist ab dem 5. November 2026 jeweils von Montag bis Freitag um 18:25 Uhr mit deutscher Sprachfassung auf ProSieben MAXX zu sehen.'
const AVATAR =
  'Die ersten drei Episoden von »Avatar: Die sieben Häfen« stehen ab sofort sowohl mit deutscher Synchronisation als auch in der englischen Originalfassung mit Untertiteln bei Paramount+ und auf dem Prime Video Channel des Anbieters zur Verfügung.'
const ONE_PIECE_OMU =
  'Ab dem 14. Oktober 2026 folgen die Episoden 1101 bis 1122 , ehe am 29. Oktober 2026 die neun »Characters Log«-Specials starten. Letztere werden allerdings nur im japanischen Originalton mit deutschen Untertiteln gezeigt.'
const text = `Starttermin von YAIBA\nVeröffentlicht: 2026-10-09\n\n Nachdem ProSieben MAXX ... \n ${YAIBA}\n ${AVATAR}\n ${ONE_PIECE_OMU}`
const bezug = { text, veroeffentlicht: '2026-10-09' }

const yaiba: Vorschlag = {
  titel: 'YAIBA: Samurai Legend',
  art: 'start',
  plattform: 'tv',
  anbieter: null,
  sender: 'ProSieben MAXX',
  datum: '2026-11-05',
  uhrzeit: '18:25',
  wochentage: 'Montag bis Freitag',
  sprache: 'deutsch',
  folgen: null,
  zitat: YAIBA,
  unsicher: null,
}
const grund = (v: unknown): string | undefined => {
  const r = pruefeVorschlag(v, bezug)
  return 'grund' in r ? r.grund : undefined
}

console.log('\nAnime2You-Extraktion: Gegenprobe')
const gut = pruefeVorschlag(yaiba, bezug)
pruefe('YAIBA (Do 05.11., Montag bis Freitag) besteht ohne Warnung', 'ok' in gut && gut.ok.warnungen.length === 0 && gut.ok.wochentag === 'Donnerstag', gut)
pruefe('Zitat nicht im Artikel: verworfen', grund({ ...yaiba, zitat: `${YAIBA} Und noch ein erfundener Satz dazu.` })?.includes('wörtlich') === true)
pruefe('Uhrzeit nicht im Zitat: verworfen', grund({ ...yaiba, uhrzeit: '18:30' })?.includes('Uhrzeit') === true)
pruefe('Tag nicht im Zitat: verworfen', grund({ ...yaiba, datum: '2026-11-06' })?.includes('Tag') === true)
pruefe('Tag im Zitat, aber falsches Jahr: verworfen', grund({ ...yaiba, datum: '2027-11-05' })?.includes('Tag') === true)
pruefe('Plattform außerhalb des Datenmodells: verworfen', grund({ ...yaiba, plattform: 'paramountplus' })?.includes('Datenmodell') === true)
pruefe('tv ohne Sender: verworfen', grund({ ...yaiba, sender: null })?.includes('sender') === true)
pruefe('Adresse im Freitext: verworfen', grund({ ...yaiba, unsicher: 'siehe https://example.org' }) !== undefined)
pruefe('Feld fehlt: verworfen', grund({ ...yaiba, art: 'sonstiges' }) !== undefined)
const glatt = 'Ab dem 14. Oktober 2026 folgen die Episoden 1101 bis 1122, ehe am 29. Oktober 2026 die neun »Characters Log«-Specials starten.'
const folgen = { ...yaiba, titel: 'One Piece', art: 'folgen', datum: '2026-10-14', uhrzeit: null, wochentage: null, sprache: 'unklar', folgen: '1101–1122', zitat: glatt } satisfies Vorschlag
pruefe('Seitentext „1122 ,“, Zitat „1122,“: besteht (Leerraum zählt nicht)', 'ok' in pruefeVorschlag(folgen, bezug), grund(folgen))
pruefe('Beschreibung eines Verworfenen nennt Titel, Art, Tag', beschreibe(folgen) === 'One Piece · folgen · 2026-10-14' && beschreibe(42) === 'unlesbar', beschreibe(folgen))

console.log('\nAnime2You-Extraktion: Sprache')
const avatar = { ...yaiba, titel: 'Avatar: Die sieben Häfen', plattform: null, anbieter: 'Paramount+', sender: null, datum: null, uhrzeit: null, wochentage: null, sprache: 'deutsch+omu', zitat: AVATAR } satisfies Vorschlag
const a = pruefeVorschlag(avatar, bezug)
pruefe('Avatar auf Paramount+: ohne Plattform, mit Anbieter, deutsch+omu', 'ok' in a && a.ok.plattform === null && a.ok.anbieter === 'Paramount+', a)
const omu = { ...yaiba, titel: 'One Piece Characters Log', datum: '2026-10-29', uhrzeit: null, wochentage: null, zitat: ONE_PIECE_OMU }
pruefe('deutsch bei „nur Originalton mit deutschen Untertiteln“: verworfen', grund(omu)?.includes('sprache') === true, grund(omu))
pruefe('dasselbe als omu: besteht', 'ok' in pruefeVorschlag({ ...omu, sprache: 'omu' }, bezug))

console.log('\nAnime2You-Extraktion: Wochentag')
pruefe('Montag bis Freitag: fünf Tage', genannteTage('von Montag bis Freitag').size === 5)
pruefe('Freitag bis Montag: umlaufend vier Tage', genannteTage('Freitag bis Montag').size === 4)
const falschTag = `Der Start ist am Montag, 5. November 2026 um 18:25 Uhr mit deutscher Sprachfassung.`
const warn = pruefeVorschlag({ ...yaiba, zitat: falschTag, wochentage: 'Montag' }, { ...bezug, text: `${text}\n${falschTag}` })
pruefe('Datum ist ein Donnerstag, Zitat sagt Montag: Warnung statt Verwerfung', 'ok' in warn && warn.ok.warnungen.length === 1, warn)

console.log('\nAnime2You-Extraktion: Artikel und Bestand')
pruefe('Kennung aus der Adresse', artikelId('https://www.anime2you.de/news/1059480/yaiba-samurai-legend-prosieben-maxx-termin/') === '1059480')
pruefe('Text endet vor „Artikel teilen“', !artikelText('<article><p>Text &amp; mehr</p><p>Artikel teilen</p><p>Fremd</p></article>').includes('Fremd'))
pruefe('Entitäten im Text sind aufgelöst', artikelText('<article><p>Text &amp; mehr</p></article>') === 'Text & mehr')
const feed = [
  { link: 'https://www.anime2you.de/news/1/a/', title: 'a', publishedAt: '2026-10-08' },
  { link: 'https://www.anime2you.de/news/2/b/', title: 'b', publishedAt: '2026-10-09' },
  { link: 'https://www.anime2you.de/news/3/c/', title: 'c', publishedAt: '2026-10-10' },
]
const neu = neueKandidaten(feed, new Set(['1']), new Set(['https://www.anime2you.de/news/3/c']), 10)
pruefe('Gelesene und eingearbeitete Artikel fallen heraus', neu.length === 1 && neu[0]!.id === '2', neu)
pruefe('Die Grenze zählt, neueste zuerst', neueKandidaten(feed, new Set(), new Set(), 2).map((k) => k.id).join() === '3,2')
const gespeichert = (artikelId: string, uhrzeit: string): GespeicherterVorschlag => ({
  ...yaiba,
  uhrzeit,
  wochentag: 'Donnerstag',
  warnungen: [],
  artikelId,
  artikel: 'x',
  quelle: 'https://www.anime2you.de/news/1/',
  veroeffentlicht: '2026-10-09',
  gelesenAm: '2026-10-10',
})
const zwei = mitWiderspruechen([gespeichert('1', '18:25'), gespeichert('2', '18:30')])
pruefe('Zwei Artikel, zwei Uhrzeiten zum selben Titel: beide mit Warnung', zwei.every((v) => v.warnungen.some((w) => w.includes('widerspricht'))), zwei.map((v) => v.warnungen))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Extraktion: alle Zusicherungen erfüllt')
