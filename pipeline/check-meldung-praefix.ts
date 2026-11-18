/**
 * Kurzname in »…« als Namensanfang (18.11.2026): „Hell Mode“ (Anime2You, Blu-ray 25.02.2027) ging im Meldungsweg still verloren, weil der Name nur Präfix des
 * Bestandstitels ist. Meldungen und Titelnamen sind die wörtlichen aus `data/proposals/anime2you.json` bzw. `public/data/titles.json` (Stand 18.11.2026).
 */
import type { Title } from '../shared/types.ts'
import { leereVerluste, releasesAus, type Vorschlag } from './lib/meldungen.ts'
import { praefixTitel } from './lib/meldung-praefix.ts'
import { einzelOhneRelease } from './lib/sammel-unzugeordnet.ts'
import { mehrdeutigZeile, verlustZeile } from './lib/meldungen-ohne-release-zeilen.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, titleEn: string, franchiseId: number, jpYear: number, extra: Partial<Title> = {}): Title =>
  ({ id, franchiseId, titleEn, format: 'TV', jpYear, episodes: 12, ...extra }) as Title

const HELL = titel(185262, 'HELL MODE: The Hardcore Gamer Dominates in Another World with Garbage Balancing', 185262, 2026)
const SLAVE1 = titel(141821, 'Chained Soldier', 141821, 2024, { titleDe: 'Demon Slave: The Chained Soldier' })
const SLAVE2 = titel(176276, 'Chained Soldier Season 2', 141821, 2026, { titleDe: 'Demon Slave: Staffel 2' })
const TWISTED = titel(140291, 'Disney Twisted-Wonderland: The Animation', 140291, 2025, { format: 'ONA' })
const ARIF1 = titel(100668, 'Arifureta: From Commonplace to World’s Strongest', 100668, 2019)
const ARIF3 = titel(154473, 'Arifureta: From Commonplace to World’s Strongest Season 3', 100668, 2024)
const FATE = [20791, 21718, 21719].map((id, i) => titel(id, `Fate/stay night [Heaven's Feel] ${['I', 'II', 'III'][i]}.`, 6922, 2017 + i, { format: 'MOVIE' }))
const STEEL = [titel(190327, 'STEEL BALL RUN JoJo’s Bizarre Adventure 1st STAGE', 14719, 2026, { format: 'ONA' }), titel(210482, 'STEEL BALL RUN JoJo’s Bizarre Adventure 2nd - 3rd STAGE', 14719, 2026, { format: 'ONA' })]
const MONONOKE = [titel(164, 'Mononoke Hime', 164, 1997, { format: 'MOVIE' }), titel(151117, 'Mononoke The Movie: The Phantom in the Rain', 151117, 2024, { format: 'MOVIE' })]
const ALLE = [HELL, SLAVE1, SLAVE2, TWISTED, ARIF1, ARIF3, ...FATE, ...STEEL, ...MONONOKE]

const meldung = (articleTitle: string, iso: string, extra: Partial<Vorschlag> = {}): Vorschlag => ({
  articleTitle,
  articleUrl: `https://www.anime2you.de/news/${articleTitle.length}/`,
  publishedAt: '2026-11-11',
  category: 'disc',
  platforms: ['disc'],
  dates: [{ iso, context: 'erscheint voraussichtlich am' }],
  dub: 'ja',
  alreadyCurated: false,
  ...extra,
})

function lauf(v: Vorschlag, bestand: Title[] = ALLE) {
  const verluste = leereVerluste()
  const neu = releasesAus([v], bestand, [], '2026-11-18', [], [], [], verluste)
  return { neu, verluste }
}

const hell = lauf(meldung('Erste »Hell Mode«-Staffel erscheint als Blu-ray-Komplettbox + Design', '2027-02-25'))
pruefe('Hell Mode: genau ein Treffer → Termin 25.02.2027 an Titel 185262', hell.neu.length === 1 && hell.neu[0]!.titleId === 185262 && hell.neu[0]!.schedule.firstEpisodeDate === '2027-02-25', hell.neu)
pruefe('Hell Mode: Herkunft nennt den Kurznamen (Unsicheres wird gekennzeichnet)', hell.neu[0]?.herkunft?.includes('Kurznamen »Hell Mode«') === true, hell.neu[0]?.herkunft)
pruefe('Hell Mode: kein Verlust gezählt', Object.values(hell.verluste).every((l) => l.length === 0), hell.verluste)

const slave = lauf(meldung('Blu-ray-Termin der zweiten »Demon Slave«-Staffel + Vorbestellung', '2027-03-19'))
pruefe('Demon Slave: eine Franchise + „zweite Staffel“ → Staffel 2 (176276), nicht der älteste Titel', slave.neu.length === 1 && slave.neu[0]!.titleId === 176276, slave.neu)

const stufen = lauf(meldung('»STEEL BALL RUN: JoJo’s Bizarre Adventure« – 2nd-3rd STAGE', '2026-09-25', { category: 'streaming', platforms: ['netflix'] }))
pruefe('Gegenfall Steel Ball Run: zwei Teile derselben Franchise, keine Staffelzahl → mehrdeutig, kein Termin', stufen.neu.length === 0 && stufen.verluste.mehrdeutig.length === 1 && stufen.verluste.ohneTitel.length === 0, stufen.verluste)
const fate = lauf(meldung('Design der »Fate/stay night: Heaven’s Feel«-Komplettbox + Extras', '2026-12-18'))
pruefe('Gegenfall Heaven’s Feel: drei Filme, eine Box → mehrdeutig, kein Termin an Film I', fate.neu.length === 0 && fate.verluste.mehrdeutig.length === 1, fate.verluste)
const zweiReihen = lauf(meldung('Neue »Mononoke The«-Box + Trailer', '2026-09-29'), [MONONOKE[1]!, titel(9, 'Mononoke The Movie Ghost Story', 9, 2020, { format: 'MOVIE' })])
pruefe('Gegenfall zwei Franchisen mit gleichem Namensanfang → mehrdeutig, auch mit Staffelwort', zweiReihen.neu.length === 0 && zweiReihen.verluste.mehrdeutig.length === 1, zweiReihen.verluste)
const zweiReihenStaffel = lauf(meldung('Zweite »Mononoke The«-Staffel + Trailer', '2026-09-29'), [MONONOKE[1]!, titel(9, 'Mononoke The Movie Ghost Story', 9, 2020, { format: 'MOVIE' })])
pruefe('… auch wenn die Überschrift eine Staffel nennt (nur eine Franchise macht das eindeutig)', zweiReihenStaffel.neu.length === 0 && zweiReihenStaffel.verluste.mehrdeutig.length === 1, zweiReihenStaffel.verluste)

const twisted = lauf(meldung('Starttermin der zweiten »Disney Twisted-Wonderland«-Staffel + Visual', '2026-12-23', { category: 'streaming', platforms: ['disneyplus'] }))
pruefe('Gegenfall Twisted-Wonderland: ein Treffer, aber Staffel 2 gibt es im Bestand nicht → ohneTeil, kein Termin an Staffel 1', twisted.neu.length === 0 && twisted.verluste.ohneTeil.length === 1, twisted.verluste)

const angebot = lauf(meldung('AniMoon-Angebot: Zweite »Demon Slave«-Staffel zum Sonderpreis', '2026-10-31'))
pruefe('Gegenfall Preisangebot: das Datum ist das Ende der Aktion → kein Termin, als „ohne Titel“ gezählt', angebot.neu.length === 0 && angebot.verluste.ohneTitel.length === 1, angebot.verluste)

for (const satz of ['mit Rabatt', 'mit Rabattaktion', 'in der Aktion', 'im Sale', 'im Angebot', 'zum Sonderpreis', 'in der Sparaktion', 'zum Black Friday', 'in den Black-Weeks', 'reduziert', 'zum Deal-Preis', 'günstiger', 'Vorbestellphase endet am 31.10.', 'bis zum 31.10.']) {
  const l = lauf(meldung(`Zweite »Demon Slave«-Staffel ${satz}`, '2026-10-31'))
  pruefe(`Angebotsformulierung „${satz}“ sperrt den Kurznamen`, l.neu.length === 0 && l.verluste.ohneTitel.length === 1, l.verluste)
}

/* Format der Meldung gegen Format des Treffers (Prüfer R1, 18.11.2026): „Street Fighter“ als Netflix-Serie ist nicht „Street Fighter II: The Animated Movie“. */
for (const format of ['MOVIE', 'OVA', 'SPECIAL']) {
  const nurFilm = [titel(1362, `Street Fighter II: The Animated ${format}`, 1362, 1994, { format })]
  const serie = lauf(meldung('Netflix zeigt neue »Street Fighter«-Serie', '2026-12-01', { category: 'streaming', platforms: ['netflix'] }), nurFilm)
  pruefe(`Format ${format} für eine Serien-Meldung (Streaming) → mehrdeutig, kein Termin`, serie.neu.length === 0 && serie.verluste.mehrdeutig.length === 1, serie.verluste)
  const staffel = lauf(meldung('Blu-ray-Termin der zweiten »Street Fighter«-Staffel', '2026-12-01'), nurFilm)
  pruefe(`Format ${format} für eine Meldung mit Staffelwort (Disc) → mehrdeutig, kein Termin`, staffel.neu.length === 0 && staffel.verluste.mehrdeutig.length === 1, staffel.verluste)
}
/* Jedes Signal der Meldungsart allein: Kategorie ohne Stichwort, Stichwort ohne Kategorie (Disc), je mit dem Fixture des falschen Formats. */
const SERIE = [titel(77, 'Street Fighter The Series', 77, 1995)]
const FILM = [titel(1362, 'Street Fighter II: The Animated Movie', 1362, 1994, { format: 'MOVIE' })]
const alleinKino = lauf(meldung('»Street Fighter« ab 1. Dezember', '2026-12-01', { category: 'kino', platforms: ['kino'] }), SERIE)
pruefe('Kategorie „kino“ allein (kein Stichwort) → Film-Meldung, TV-Serie passt nicht', alleinKino.neu.length === 0 && alleinKino.verluste.mehrdeutig.length === 1, alleinKino.verluste)
const alleinStream = lauf(meldung('Netflix: »Street Fighter« ab 1. Dezember', '2026-12-01', { category: 'streaming', platforms: ['netflix'] }), FILM)
pruefe('Kategorie „streaming“ allein (kein Stichwort) → Serien-Meldung, Film passt nicht', alleinStream.neu.length === 0 && alleinStream.verluste.mehrdeutig.length === 1, alleinStream.verluste)
for (const wort of ['Film', 'Movie', 'Kino']) {
  const l = lauf(meldung(`»Street Fighter« ${wort} erscheint auf Blu-ray`, '2026-12-01'), SERIE)
  pruefe(`Film-Stichwort „${wort}“ allein (Disc) → Film-Meldung, TV-Serie passt nicht`, l.neu.length === 0 && l.verluste.mehrdeutig.length === 1, l.verluste)
}
for (const wort of ['Staffel', 'Season', 'Simulcast', 'Serie', 'Start']) {
  const l = lauf(meldung(`»Street Fighter« ${wort} erscheint auf Blu-ray`, '2026-12-01'), FILM)
  pruefe(`Serien-Stichwort „${wort}“ allein (Disc) → Serien-Meldung, Film passt nicht`, l.neu.length === 0 && l.verluste.mehrdeutig.length === 1, l.verluste)
}
const filmZuFilm = lauf(meldung('»Street Fighter« startet im Kino', '2026-12-01', { category: 'kino', platforms: ['kino'] }), [titel(1362, 'Street Fighter II: The Animated Movie', 1362, 1994, { format: 'MOVIE' })])
pruefe('Film-Meldung (Kino) an einen Film: Termin, Format passt', filmZuFilm.neu.length === 1 && filmZuFilm.neu[0]!.titleId === 1362, filmZuFilm.verluste)
const filmZuSerie = lauf(meldung('»Street Fighter« startet im Kino', '2026-12-01', { category: 'kino', platforms: ['kino'] }), [titel(77, 'Street Fighter The Series', 77, 1995)])
pruefe('Film-Meldung (Kino) an eine TV-Serie → mehrdeutig, kein Termin', filmZuSerie.neu.length === 0 && filmZuSerie.verluste.mehrdeutig.length === 1, filmZuSerie.verluste)
const discBox = lauf(meldung('»Street Fighter« erscheint als Blu-ray-Box', '2026-12-01'), [titel(1362, 'Street Fighter II: The Animated Movie', 1362, 1994, { format: 'MOVIE' })])
pruefe('Disc-Box ohne Film- oder Serienwort: das Format entscheidet nicht (Termin)', discBox.neu.length === 1, discBox.verluste)
pruefe('Gegenfall „Black Clover“/„Spartacus“ ist kein Angebotswort (Präfix-Weg bleibt offen)', 'titel' in (praefixTitel({ articleTitle: 'Neue »Black Clover«-Staffel startet', category: 'streaming' }, [titel(5, 'Black Clover: Next Chapter', 5, 2026)], false) ?? {}) && 'titel' in (praefixTitel({ articleTitle: 'Neue »Sparta Kid«-Staffel startet', category: 'streaming' }, [titel(6, 'Sparta Kid: Rising', 6, 2026)], false) ?? {}))

const sammel = lauf(
  meldung('»Love & Lies« – Staffel 1', '2026-12-01', { category: 'streaming', platforms: ['netflix'], dates: [{ iso: '2026-12-01', context: 'Sammelartikel' }] }),
  [titel(300, 'Love and Lies', 300, 2026), titel(301, 'Love and Lies Remix', 300, 2026)],
)
pruefe('Sammelzeile: der gleichnamige Titel (Synonymweg) geht dem Kurznamen vor — kein Hinweis „über den Kurznamen“', sammel.neu.length === 1 && sammel.neu[0]!.titleId === 300 && !sammel.neu[0]!.herkunft?.includes('Kurznamen'), sammel.neu)

const einWort = lauf(meldung('Netflix-Termin des dritten »Mononoke«-Films + Trailer', '2026-09-29', { category: 'streaming', platforms: ['netflix'] }))
pruefe('Gegenfall ein einzelnes Wort: kein Präfix-Treffer → ohneTitel', einWort.neu.length === 0 && einWort.verluste.ohneTitel.length === 1, einWort.verluste)
const halbesWort = lauf(meldung('»Hell Mod« erscheint als Blu-ray', '2027-02-25'))
pruefe('Gegenfall Wortgrenze: „Hell Mod“ ist kein ganzes Wort von „Hell Mode“ → ohneTitel', halbesWort.neu.length === 0 && halbesWort.verluste.ohneTitel.length === 1, halbesWort.verluste)
const anderes = lauf(meldung('»Hell Mode Special« erscheint als Blu-ray', '2027-02-25'))
pruefe('Gegenfall: Name länger als der Titelanfang → ohneTitel', anderes.neu.length === 0 && anderes.verluste.ohneTitel.length === 1, anderes.verluste)

pruefe('praefixTitel: ein Treffer → Titel', 'titel' in (praefixTitel(meldung('»Hell Mode«', '2027-02-25'), ALLE, false) ?? {}))
pruefe('praefixTitel: mehrere Teile ohne Angabe → mehrdeutig', 'mehrdeutig' in (praefixTitel(meldung('»Fate/stay night: Heaven’s Feel«', '2026-12-18'), FATE, false) ?? {}))
pruefe('praefixTitel: eine Franchise mit Angabe → der älteste (Basis für reihenTeil)', (praefixTitel(meldung('»Demon Slave«', '2027-03-19'), ALLE, true) as { titel: Title }).titel.id === 141821)

const streaming = lauf(meldung('Neue »Fate/stay night: Heaven’s Feel«-Folgen im Simulcast', '2026-12-18', { category: 'streaming', platforms: ['netflix'] }))
pruefe('Liste: eine mehrdeutige Streaming-Meldung mit deutschem Ton steht auf der Liste „nicht zugeordnet“', einzelOhneRelease(streaming.verluste, []).length === 1, streaming.verluste)
pruefe('Namentliche Logzeile nennt die Überschrift der mehrdeutigen Meldung', mehrdeutigZeile(streaming.verluste)?.includes('1 Meldungen mit mehrdeutigem Kurznamen') === true && mehrdeutigZeile(streaming.verluste)?.includes('Neue »Fate/stay night: Heaven’s Feel«-Folgen im Simulcast') === true, mehrdeutigZeile(streaming.verluste))
pruefe('Namentliche Logzeile entfällt ohne mehrdeutige Meldung', mehrdeutigZeile(leereVerluste()) === undefined)
pruefe('Logzeile nennt die mehrdeutigen', verlustZeile(streaming.verluste).includes('1 mit mehrdeutigem Kurznamen'), verlustZeile(streaming.verluste))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-meldung-praefix: alles grün')
