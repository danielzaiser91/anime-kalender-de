/**
 * Zusicherungen für den Sammelartikel-PoC (`sammelartikel-poc.ts`, `lib/aussagen*.ts`) — an nachgestellten
 * Zeilen, die die Formen der echten Artikel vom 08.10.2026 tragen. Jeder Fall hier war im PoC einmal falsch.
 *
 * Aufruf: npx tsx pipeline/check-sammelartikel.ts
 */
import assert from 'node:assert/strict'
import { aussagenAusAnime2You } from './lib/aussagen-anime2you.ts'
import { aussagenAusLineup, aussagenAusSynchros } from './lib/aussagen-crunchyroll.ts'
import { Katalog, normName, ordneZu } from './lib/aussagen-zuordnung.ts'
import { datumAus } from './lib/aussagen.ts'

const artikel = { url: 'https://www.anime2you.de/news/1/x/', veroeffentlicht: '2026-09-28', ueberschrift: 'ADN kündigt 25 Simulcasts an' }

// --- Datum ---------------------------------------------------------------------------------------
assert.equal(datumAus('7. Oktober', '2026-09-15'), '2026-10-07')
assert.equal(datumAus('Ab 12.10.: »X«', '2026-09-28'), '2026-10-12')
assert.equal(datumAus('Start: 30. September 2026', '2026-09-30'), '2026-09-30')
assert.equal(datumAus('3. Januar', '2026-12-16'), '2027-01-03', 'Dezember-Artikel nennt Januar → nächstes Jahr')
assert.equal(datumAus('Jeden Mittwoch', '2026-09-28'), undefined)

// --- Anime2You: Monatsartikel mit Kurzliste und Blöcken ------------------------------------------
const adn = aussagenAusAnime2You([
  'Neue Katalogtitel:',
  'Ab 08.10.: »86 EIGHTY-SIX« (Dub + Sub)',
  'Ab 15.10.: »Revolutionary Girl Utena« (Sub)',
  'Ab 29.10.: »Puella Magi Madoka Magica – Film 1: Beginnings« (Dub + Sub)',
  '8. Oktober: »86 EIGHTY-SIX«',
  'Episoden: 23 (komplett)',
  'Sprache: Deutsch, Japanisch (UT)',
  'Stream: ADN',
  'Handlung:',
  'Die Republik San Magnolia …',
  '29. Oktober: »Puella Magi Madoka Magica – Film 1: Beginnings«',
  'Sprache: Japanisch (UT)',
  'Stream: ADN',
], artikel)
assert.equal(adn.length, 3, 'Kurzliste und Block desselben Titels sind eine Aussage')
const [sechsundachtzig, utena, madoka] = adn
assert.deepEqual([sechsundachtzig!.datum, sechsundachtzig!.deutsch, sechsundachtzig!.folgen, sechsundachtzig!.plattformen], ['2026-10-08', 'ja', 23, ['adn']])
assert.equal(sechsundachtzig!.inhalt, 'Die Republik San Magnolia …')
assert.deepEqual([utena!.datum, utena!.deutsch, utena!.plattformen], ['2026-10-15', 'nein', ['adn']], 'Kurzliste allein: Tag aus dem Kopf, Anbieter aus der Überschrift')
assert.equal(madoka!.deutsch, 'unklar', 'Kurzliste (Dub + Sub) gegen Block „Japanisch (UT)" bleibt unklar')
assert.match(madoka!.gruende.join(' '), /widerspricht/)

// --- Anime2You: „Ab sofort verfügbar:" ohne Tag im Kopf -----------------------------------------
const cr = aussagenAusAnime2You([
  'Ab sofort verfügbar:',
  '»Magic Knight Rayearth«',
  '»Dandivine«',
  '»Magic Knight Rayearth«',
  'Episoden: 1 verfügbar',
  'Sprache: Japanisch (UT)',
  'Simulcast: Jeden Mittwoch um 17:15 Uhr',
  'Hinweis: Deutsche Synchronisation angekündigt',
  'Stream: Prime Video, Crunchyroll',
  'Handlung:',
  'Hikaru, Umi und Fuu …',
  '»Dandivine«',
  'Sprache: Japanisch (UT)',
  'Simulcast: Jeden Mittwoch um 19:00 Uhr',
  'Stream: Prime Video, Crunchyroll',
], { ...artikel, veroeffentlicht: '2026-10-07', ueberschrift: 'Crunchyroll ergänzt zehn weitere Anime-Neuzugänge' })
assert.equal(cr.length, 2, 'die Namensliste am Anfang zählt nicht doppelt')
assert.deepEqual([cr[0]!.datum, cr[0]!.datumBedeutung, cr[0]!.deutsch, cr[0]!.zeit, cr[0]!.konfidenz], ['2026-10-07', 'tag-der-meldung', 'angekuendigt', '17:15', 0.8])
assert.deepEqual(cr[0]!.plattformen, ['primevideo', 'crunchyroll'])
assert.equal(cr[1]!.deutsch, 'nein')

// --- Anime2You: aniverse (Prime-Kanal), „Stream: Noch nicht verfügbar" -------------------------
const av = aussagenAusAnime2You(
  ['»My Girlfriend’s Friend«', 'Start: 4. Oktober 2026', 'Simulcast: Jeden Sonntag um 18:05 Uhr', 'Sprache: Japanisch (UT)', 'Stream: Noch nicht verfügbar'],
  { ...artikel, ueberschrift: 'aniverse kündigt sechs neue Herbst-Simulcasts 2026 an' },
)
assert.deepEqual([av[0]!.datum, av[0]!.plattformen, av[0]!.kanal, av[0]!.woechentlich], ['2026-10-04', ['primevideo'], 'aniverse', true])

// --- Anime2You: Spiegel des Crunchyroll-Synchro-Artikels — OmU-Tag plus „Termin … noch offen" ----
const spiegel = aussagenAusAnime2You(
  ['»Aoashi« – Staffel 2', 'Start: 4. Oktober 2026 (OmU)', 'Sprache: Deutsch, Japanisch (UT)', 'Hinweis: Termin der deutschen Synchronfassung noch offen', 'Stream: Prime Video, Crunchyroll'],
  { ...artikel, veroeffentlicht: '2026-09-15', ueberschrift: 'Crunchyroll zeigt 13 Anime-Neustarts im Herbst 2026 auf Deutsch' },
)
assert.deepEqual([spiegel[0]!.art, spiegel[0]!.datum, spiegel[0]!.datumBedeutung, spiegel[0]!.deutsch], ['omu-start', '2026-10-04', 'omu-start', 'angekuendigt'], '„Sprache: Deutsch" mit offenem Termin ist eine Zusage, der Tag gehört der OmU-Fassung')

// --- Crunchyroll: Lineup mit Highlights (doppelt), DE: TBA, Weiterlaufende ohne Tag --------------
const quelle = { url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/x', veroeffentlicht: '2026-09-15', leser: 'crunchyroll-lineup' as const }
const lineup = aussagenAusLineup([
  '## Highlights der Herbst-Season 2026',
  '## Black Clover Staffel 2', 'Studio: Pierrot', 'OmU: 3. Oktober', 'DE: TBA', 'Asta kehrt zurück …',
  '## Neue Simulcasts der Herbst-Season 2026',
  '## Black Clover Staffel 2', 'Studio: Pierrot', 'OmU: 3. Oktober', 'DE: TBA',
  '## Dandivine', 'Studio: X', 'OmU: 7. Oktober', 'Text',
  '## BLACK TORCH', 'OmU: 4. Juli', 'DE: 4. Juli',
  '## Weiterlaufende Shows', '## Detective Conan', 'OmU: fortlaufend',
], quelle)
assert.equal(lineup.length, 3)
assert.equal(lineup.uebersprungen, 1, 'ein OmU ohne Tag ist kein Start und wird gezählt')
assert.deepEqual([lineup[0]!.titel, lineup[0]!.datum, lineup[0]!.deutsch, lineup[0]!.art, lineup[0]!.inhalt], ['Black Clover Staffel 2', '2026-10-03', 'angekuendigt', 'omu-start', 'Asta kehrt zurück …'])
assert.deepEqual([lineup[1]!.deutsch, lineup[1]!.gruende], ['nein', ['nur OmU, keine DE-Zeile']])
assert.deepEqual([lineup[2]!.art, lineup[2]!.deutsch, lineup[2]!.datum], ['start', 'ja', '2026-07-04'])
const syn = aussagenAusSynchros(['## Vorwort', 'Text', '## Firefly Wedding', 'Inhalt:', 'Satoko …', 'Zweiter Absatz.', '## PSYREN', 'Inhalt:', 'Ageha …'], { ...quelle, leser: 'crunchyroll-synchros' })
assert.deepEqual(syn.map((a) => [a.titel, a.deutsch, a.inhalt]), [['Firefly Wedding', 'angekuendigt', 'Satoko … Zweiter Absatz.'], ['PSYREN', 'angekuendigt', 'Ageha …']])

// --- Zuordnung ----------------------------------------------------------------------------------
assert.equal(normName('Ranma1/2 (2024) Season 3'), 'ranma1 2 2024 s3')
assert.equal(normName('Cyberpunk: Edgerunners II'), 'cyberpunk edgerunners s2')
assert.equal(normName('Black Clover 2nd Season'), 'black clover s2')
const katalog = new Katalog([
  { id: 435, titleEn: 'Magic Knight Rayearth', format: 'TV', jpYear: 1994, jpStart: '1994-10-17' },
  { id: 178868, titleEn: 'Magic Knight Rayearth (2026)', titleDe: 'Magic Knight Rayearth', format: 'TV', jpYear: 2026, jpStart: '2026-10-07' },
  { id: 10021969, titleDe: 'Magic Knight Rayearth', format: 'TV', jpYear: 2026 },
  { id: 210, titleDe: 'Ranma 1/2', format: 'TV', jpYear: 1989, jpStart: '1989-04-15' },
  { id: 1010, titleDe: 'Ranma 1/2: Film 3', format: 'MOVIE', jpYear: 1994, jpStart: '1994-08-20' },
  { id: 209872, titleDe: 'Ranma ½', titleRomaji: 'Ranma 1/2 (2024) 3rd Season', format: 'TV', jpYear: 2026, jpStart: '2026-10-04' },
  { id: 440, titleDe: 'Utena: La fillette révolutionnaire', synonyme: ['Revolutionary Girl Utena'], format: 'TV', jpYear: 1997 },
  { id: 441, titleDe: 'Utena: La fillette révolutionnaire - The Movie', synonyme: ['Revolutionary Girl Utena: Adolescence Apocalypse'], format: 'MOVIE', jpYear: 1999 },
  { id: 21, titleDe: 'One Piece', format: 'TV', jpYear: 1999, jpStart: '1999-10-20' },
])
const simulcast = { quelle, art: 'start' as const, plattformen: ['crunchyroll'], woechentlich: true, deutsch: 'nein' as const, konfidenz: 1, gruende: [], zitat: '' }
const rayearth = ordneZu({ ...simulcast, titel: 'Magic Knight Rayearth', datum: '2026-10-07' }, katalog)
assert.deepEqual([rayearth.zuordnung?.anilistId, rayearth.zuordnung?.wie, rayearth.zuordnung?.abstandTage], [178868, 'name+start', 0], 'Name und Japan-Start, nicht der erste Namenstreffer; aniSearch-Doppel ausgeblendet')
assert.equal(ordneZu({ ...simulcast, titel: 'Magic Knight Rayearth', datum: '2020-01-01' }, katalog).offen?.grund.startsWith('Japan-Start passt nicht'), true)
const ranma = ordneZu({ ...simulcast, titel: 'Ranma 1/2', zusatz: 'Staffel 3', datum: '2026-10-03' }, katalog)
assert.equal(ranma.zuordnung?.anilistId, 209872, '„Staffel 3" trifft nicht „Film 3"')
const katalogtitel = { ...simulcast, woechentlich: false, plattformen: ['adn'] }
assert.equal(ordneZu({ ...katalogtitel, titel: 'Revolutionary Girl Utena: The Movie', datum: '2026-10-15' }, katalog).zuordnung?.anilistId, 441, '„The Movie" verlangt einen Film')
assert.equal(ordneZu({ ...katalogtitel, titel: 'Revolutionary Girl Utena', datum: '2026-10-15' }, katalog).zuordnung?.anilistId, 440)
const onePiece = ordneZu({ ...katalogtitel, titel: 'One Piece', zusatz: 'Staffel 4 bis 8', datum: '2026-09-17' }, katalog)
assert.deepEqual([onePiece.zuordnung?.anilistId, onePiece.zuordnung?.vorbehalt], [21, 'Zusatz „Staffel 4 bis 8" nicht aufgelöst'])
assert.equal(ordneZu({ ...katalogtitel, titel: 'Gibt es nicht', datum: '2026-10-15' }, katalog).offen?.grund, 'kein Titel mit diesem Namen')

console.log('check:sammelartikel ok')
