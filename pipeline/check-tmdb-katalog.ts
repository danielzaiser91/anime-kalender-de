/**
 * Zusicherungen zur TMDB-Zuordnung der Nur-AniList-Titel (`lib/tmdb-katalog.ts`): die Regel der Probe vom 11.10.2026, darunter die drei Fehltreffer
 * der einfachen Namen-und-Jahr-Regel (Silence, Gathering, Night Owl). Aufruf: `npm run check:logic`.
 */
import { suchNamen, urteilKatalog, type HandBeleg, type KatalogTitel, type KatalogTreffer, type Zuordnung } from './lib/tmdb-katalog.ts'
import { pruefeHandEintraege } from './lib/tmdb-katalog-hand.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (t: Partial<KatalogTitel>): KatalogTitel => ({ id: 1, format: 'ONA', jahr: 2020, ...t })
const treffer = (t: Partial<KatalogTreffer>): KatalogTreffer => ({ art: 'tv', id: 10, name: 'X', original: 'X', datum: '2020-05-01', genres: [16], sprache: 'zh', ...t })

console.log('\nTMDB-Katalog: sicher')
pruefe('Originalname gleich, Jahr, Art: sicher', urteilKatalog(titel({ native: '君临臣下' }), [treffer({ original: '君临臣下' })]).stufe === 'sicher')
pruefe('Latein gleich + Animation + Sprache zh: sicher', urteilKatalog(titel({ en: 'Time Autobahn' }), [treffer({ name: 'Time Autobahn' })]).stufe === 'sicher')
pruefe('Jahr um eins daneben gilt noch', urteilKatalog(titel({ native: '崂山道士' }), [treffer({ original: '崂山道士', datum: '2021-01-01' })]).stufe === 'sicher')
pruefe('Sicherer Treffer trägt Kennung und Art', JSON.stringify([urteilKatalog(titel({ native: 'あ' }), [treffer({ id: 7, art: 'movie', original: 'あ' })]).tmdbId, urteilKatalog(titel({ native: 'あ' }), [treffer({ id: 7, art: 'movie', original: 'あ' })]).art]) === '[7,"movie"]')

console.log('\nTMDB-Katalog: Fehltreffer der einfachen Regel bleiben draußen')
pruefe('Silence (2016) ↔ Scorseses Film (Realfilm, englisch, 2016 gleiches Jahr): nicht sicher', urteilKatalog(titel({ format: 'MOVIE', jahr: 2016, en: 'Silence', native: '静寂' }), [treffer({ art: 'movie', id: 68730, name: 'Silence', original: 'Silence', datum: '2016-12-23', genres: [18], sprache: 'en' })]).stufe !== 'sicher')
pruefe('Gathering (2010) ↔ US-Kurzfilm 2009 ohne Animation: nicht sicher', urteilKatalog(titel({ format: 'MOVIE', jahr: 2010, en: 'Gathering', native: '収集家の散歩' }), [treffer({ art: 'movie', id: 694767, name: 'Gathering', original: 'Gathering', datum: '2009-03-01', genres: [99], sprache: 'en' })]).stufe !== 'sicher')
pruefe('Night Owl (2023) ↔ US-Horrorfilm: nicht sicher', urteilKatalog(titel({ format: 'MOVIE', jahr: 2023, en: 'Night Owl', native: '夜猫' }), [treffer({ art: 'movie', name: 'Night Owl', original: 'Night Owl', datum: '2023-06-01', genres: [27], sprache: 'en' })]).stufe !== 'sicher')

console.log('\nTMDB-Katalog: lateinischer „Originalname“ (Romaji) ist kein Beweis (Prüferbefund 11.10.2026)')
pruefe('Her (2014), native „Her“ ↔ Jonzes Realfilm 2013: nicht sicher', urteilKatalog(titel({ format: 'MOVIE', jahr: 2014, romaji: 'Her', native: 'Her' }), [treffer({ art: 'movie', id: 152601, name: 'Her', original: 'Her', datum: '2013-12-18', genres: [18, 878], sprache: 'en' })]).stufe !== 'sicher')
const realfilme: [number, string, string | null, string][] = [[111023, 'NOISE', 'MOVIE', '2006'], [140354, 'mine', 'MOVIE', '2017'], [175057, 'MASTER', 'MOVIE', '2023'], [205287, 'Vision', 'MOVIE', '2023'], [148826, 'object', 'MOVIE', '2022'], [169483, 'Destiny', 'MOVIE', '2021'], [113639, 'FLOAT', 'MOVIE', '2015'], [136778, 'INHERIT', 'MOVIE', '2019'], [158644, 'espresso', 'ONA', '2020'], [157425, 'Protector', 'SPECIAL', '2022'], [214834, 'Path of Progress', 'ONA', '2025']]
for (const [id, name, format, jahr] of realfilme) {
  const r = urteilKatalog(titel({ id, format, jahr: Number(jahr), romaji: name, native: name }), [treffer({ art: 'movie', name, original: name, datum: `${jahr}-06-01`, genres: [18], sprache: 'en' })])
  pruefe(`${name} (${jahr}), native gleich Romaji ↔ Realfilm gleichen Namens: nicht sicher`, r.stufe !== 'sicher', r)
}
pruefe('Moyashimon CGI Anime (OVA 2010), native もやしもん ↔ Realdrama tv/44315 ohne Animation: nicht sicher', urteilKatalog(titel({ format: 'OVA', jahr: 2010, romaji: 'Moyashimon CGI Anime', native: 'もやしもん' }), [treffer({ art: 'tv', id: 44315, name: 'もやしもん', original: 'もやしもん', datum: '2010-10-01', genres: [35, 18], sprache: 'ja' })]).stufe !== 'sicher')
pruefe('the persona (Film 2023), native 繭 ↔ taiwanisches Realdrama „Shelter“ ohne Animation: nicht sicher', urteilKatalog(titel({ format: 'MOVIE', jahr: 2023, en: 'the persona', romaji: 'Mayu', native: '繭' }), [treffer({ art: 'movie', id: 1128903, name: 'Shelter', original: '繭', datum: '2023-05-01', genres: [18], sprache: 'zh' })]).stufe !== 'sicher')
pruefe('native in nicht-lateinischer Schrift mit Animation bleibt sicher', urteilKatalog(titel({ native: 'もやしもん' }), [treffer({ original: 'もやしもん', genres: [16], sprache: 'ja' })]).stufe === 'sicher')
pruefe('lateinisches native mit Animation und Sprache ja bleibt sicher', urteilKatalog(titel({ format: 'MOVIE', romaji: 'Her', native: 'Her' }), [treffer({ art: 'movie', name: 'Her', original: 'Her', genres: [16], sprache: 'ja' })]).stufe === 'sicher')

console.log('\nTMDB-Katalog: unsicher und kein')
pruefe('Name gleich, Jahr um zwei daneben: unsicher mit Grund', urteilKatalog(titel({ native: 'あ' }), [treffer({ original: 'あ', datum: '2023-01-01' })]).grund.startsWith('Jahr weicht ab'))
pruefe('TMDB ohne Datum: unsicher', urteilKatalog(titel({ native: 'あ' }), [treffer({ original: 'あ', datum: undefined })]).grund === 'TMDB ohne Datum')
pruefe('Film für Format TV: Art passt nicht', urteilKatalog(titel({ format: 'TV', native: 'あ' }), [treffer({ art: 'movie', original: 'あ' })]).grund.startsWith('Art passt nicht'))
pruefe('ONA darf Film und Serie sein', urteilKatalog(titel({ native: 'あ' }), [treffer({ art: 'movie', original: 'あ' })]).stufe === 'sicher')
pruefe('zwei passende Werke: unsicher mit Kandidat', urteilKatalog(titel({ native: 'あ' }), [treffer({ id: 1, original: 'あ' }), treffer({ id: 2, original: 'あ' })]).kandidaten?.[0] === 'tv/2')
pruefe('dasselbe Werk zweimal (zwei Suchen) bleibt sicher', urteilKatalog(titel({ native: 'あ' }), [treffer({ id: 1, original: 'あ' }), treffer({ id: 1, original: 'あ' })]).stufe === 'sicher')
pruefe('anderer Name: kein', urteilKatalog(titel({ en: 'Luck' }), [treffer({ name: 'Fortune', original: 'Fortune' })]).stufe === 'kein')
pruefe('unser Jahr fehlt: nie sicher', urteilKatalog(titel({ jahr: null, native: 'あ' }), [treffer({ original: 'あ' })]).stufe === 'unsicher')

console.log('\nTMDB-Katalog: Suchreihenfolge')
pruefe('chinesischer Titel: Originalname zuerst', suchNamen(titel({ land: 'CN', en: 'A', romaji: 'B', native: 'C' }))[0] === 'C')
pruefe('japanischer Titel: Englisch zuerst, ohne Doppelte', suchNamen(titel({ en: 'A', romaji: 'A', native: 'C' })).join() === 'A,C')

console.log('\nTMDB-Katalog: Handurteile tragen die Pflichtmerkmale (Abgleich der Unsicheren, 11.10.2026)')
const hand = (b: Partial<HandBeleg>, rest: Partial<Zuordnung> = {}): Record<string, Zuordnung> => ({ '1': { tmdbId: 1, art: 'tv', stufe: 'sicher', grund: 'von Hand bestätigt: x', von: 'hand', beleg: { tmdb: 'tv/1', genres: [16], jahr: [2020, 2020], name: 'original', ...b }, ...rest } })
pruefe('bestätigt mit Animation, Jahr gleich, Name: in Ordnung', pruefeHandEintraege(hand({})).length === 0)
pruefe('Name leer oder unbekannt: Verstoß, „latein“ in Ordnung', pruefeHandEintraege(hand({ name: '' as HandBeleg['name'] })).length === 1 && pruefeHandEintraege(hand({ name: 'falsch' as HandBeleg['name'] })).length === 1 && pruefeHandEintraege(hand({ name: 'latein' })).length === 0)
pruefe('Beleg einer anderen TMDB-Kennung: Verstoß', pruefeHandEintraege(hand({ tmdb: 'tv/2' })).length === 1 && pruefeHandEintraege(hand({ tmdb: 'movie/1' })).length === 1)
pruefe('bestätigt ohne Animationsgenre und ohne Ausnahme: Verstoß', pruefeHandEintraege(hand({ genres: [18] })).length === 1)
pruefe('Genre leer nur mit Ausnahme genre-leer', pruefeHandEintraege(hand({ genres: [] })).length === 1 && pruefeHandEintraege(hand({ genres: [], ausnahme: ['genre-leer'] })).length === 0)
pruefe('Ausnahme genre-leer bei vorhandenen Genres: Verstoß', pruefeHandEintraege(hand({ genres: [18], ausnahme: ['genre-leer'] })).length === 1)
pruefe('Jahr um zwei daneben nur mit Ausnahme', pruefeHandEintraege(hand({ jahr: [2020, 2022] })).length === 1 && pruefeHandEintraege(hand({ jahr: [2020, 2022], ausnahme: ['jahr-kurzfilm'] })).length === 0)
pruefe('Jahr fehlt nur mit Ausnahme jahr-fehlt', pruefeHandEintraege(hand({ jahr: [null, 2020] })).length === 1 && pruefeHandEintraege(hand({ jahr: [null, 2020], ausnahme: ['jahr-fehlt'] })).length === 0)
pruefe('bestätigt ohne Beleg: Verstoß', pruefeHandEintraege(hand({}, { beleg: undefined })).length === 1)
pruefe('verworfen mit Kennung: Verstoß', pruefeHandEintraege(hand({}, { stufe: 'kein', grund: 'von Hand verworfen: x' })).length === 1)
pruefe('Kennung an zwei Titel bestätigt: Verstoß', pruefeHandEintraege({ ...hand({}), '2': hand({})['1']! }).length === 2)
const daten = readJson<Record<string, Zuordnung>>('data/tmdb-katalog-zuordnung.json', {})
const verstoesse = pruefeHandEintraege(daten)
pruefe(`alle ${Object.values(daten).filter((e) => e.von === 'hand').length} Handurteile in der Zuordnung halten die Pflichtmerkmale`, verstoesse.length === 0, verstoesse.slice(0, 5))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Katalog: alle Zusicherungen grün.')
