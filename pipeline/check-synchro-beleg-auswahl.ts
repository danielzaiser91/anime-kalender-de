/**
 * Zusicherung: Welche Synchro-Aussagen aus Anime2You-Artikeln ohne Handgriff zum Handbeleg werden (F108, 07.11.2026, Anlass Devils’ Crest).
 * Anlassfall wörtlich: der Artikel 1068059 (06.11.2026, 15:45) und die Katalogeinträge von Devils’ Crest (203275) und Pet (101350) aus
 * `public/data/titles.json`. Jede Stufe der Auswahl hat einen roten Fall; der Schreibweg läuft gegen eine Wegwerf-Wurzel.
 * Läuft in `check:logic`; der Prozesstest zum Aufruf `--belege` steht in `check-synchro-beleg-lauf.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-synchro-beleg-auswahl.ts`
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { ANBIETER_NUR_IM_ARTIKEL, pruefeName } from './lib/anime2you-abgleich.ts'
import type { GespeicherterVorschlag } from './lib/anime2you-bestand.ts'
import { pruefeVorschlag } from './lib/anime2you-vorschlag.ts'
import { belegBericht, gibSynchroBelegeAb, leseBelegStand } from './lib/synchro-beleg-abgabe.ts'
import { belegFlaute } from './lib/synchro-beleg-flaute.ts'
import { belegZeilen, HOECHSTENS_AM_TAG, IMMER, mitPlattformAusAnbieter, nenntSynchro, ordneTitelZu, waehleSynchroBelege, type Belegstand, type KatalogTitel } from './lib/synchro-beleg-auswahl.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

// --- Der echte Artikel 1068059 (Auszug wörtlich aus dem Abruf vom 07.11.2026) -------------------------------------------------------
const ARTIKEL = [
  'Prime Video nimmt zwei Anime-Serien auf Deutsch ins Programm',
  'Der Streaming-Dienst Prime Video hat sein Anime-Angebot in den letzten Tagen um zwei neue Titel erweitert. Wir fassen die Details zusammen.',
  'Die 13-teilige Serie »Pet« kann ab sofort auch mit deutscher Synchronisation auf Prime Video angesehen werden. Zuvor war der Anime ausschließlich in der japanischen Originalfassung mit deutschen Untertiteln verfügbar.',
  'Darüber hinaus ist heute die erste Episode von »Devils‘ Crest« erschienen. Neue Folgen werden fortan jeden Freitag mit deutscher Sprachausgabe sowie im japanischen Originalton mit Untertiteln veröffentlicht.',
].join('\n')
const QUELLE = 'https://www.anime2you.de/news/1068059/prime-video-devils-crest-und-mehr/'
const PET_ZITAT = 'Die 13-teilige Serie »Pet« kann ab sofort auch mit deutscher Synchronisation auf Prime Video angesehen werden.'
const DC_ZITAT = 'Darüber hinaus ist heute die erste Episode von »Devils‘ Crest« erschienen. Neue Folgen werden fortan jeden Freitag mit deutscher Sprachausgabe sowie im japanischen Originalton mit Untertiteln veröffentlicht.'

const roh = (titel: string, art: string, sprache: string, zitat: string) => ({
  titel,
  art,
  plattform: 'primevideo',
  anbieter: 'Prime Video',
  sender: null,
  datum: null,
  uhrzeit: null,
  wochentage: null,
  sprache,
  folgen: null,
  zitat,
  unsicher: null,
})
function ausArtikel(r: ReturnType<typeof roh>): GespeicherterVorschlag {
  const g = pruefeVorschlag(r, { text: ARTIKEL, titel: 'Prime Video nimmt zwei Anime-Serien auf Deutsch ins Programm', veroeffentlicht: '2026-11-06' })
  if ('grund' in g) throw new Error(`Fixture verworfen: ${g.grund}`)
  return { ...g.ok, artikelId: '1068059', artikel: 'Prime Video', quelle: QUELLE, veroeffentlicht: '2026-11-06', gelesenAm: '2026-11-07' }
}
const PET = ausArtikel(roh('Pet', 'sprachfassung', 'deutsch', PET_ZITAT))
const DC = ausArtikel(roh('Devils‘ Crest', 'start', 'deutsch+omu', DC_ZITAT))
pruefe('Fixture Devils’ Crest trägt genau die zwei Anbieter-Warnungen (nur im Artikeltext)', DC.warnungen.length === 2 && DC.warnungen.every((w) => ANBIETER_NUR_IM_ARTIKEL.test(w)), DC.warnungen)
pruefe('Fixture Pet hat keine Warnung', PET.warnungen.length === 0, PET.warnungen)
/** Ein Vorschlag mit geänderten Feldern (die Prüfung der Rohantwort ist nicht Gegenstand dieser Fälle). */
const mit = (v: GespeicherterVorschlag, o: Partial<GespeicherterVorschlag>): GespeicherterVorschlag => ({ ...v, ...o })

// --- Katalog: Anlassfälle aus public/data/titles.json plus Fremde, der richtige in der Mitte -----------------------------------------
const weg = (platform: string, dub?: boolean) => ({ platform, ...(dub === undefined ? {} : { dub }) })
const DC_TITEL: KatalogTitel = { id: 203275, titleRomaji: "Demons' Crest", titleEn: "Devils' Crest", titleDe: 'Devils’ Crest', streams: [weg('primevideo')] }
const PET_TITEL: KatalogTitel = { id: 101350, titleRomaji: 'pet', titleEn: 'pet', titleDe: 'Pet', streams: [weg('primevideo')] }
const FREMDE: KatalogTitel[] = [
  { id: 900101, titleRomaji: 'Pet Shop of Horrors', titleEn: 'Pet Shop of Horrors', titleDe: 'Pet Shop of Horrors', streams: [weg('primevideo')] },
  { id: 900102, titleRomaji: 'Crest of the Stars', titleDe: 'Crest of the Stars', streams: [weg('primevideo')] },
]
const KATALOG = [FREMDE[0]!, DC_TITEL, PET_TITEL, FREMDE[1]!]
const OFFEN: Belegstand = new Map()
const lauf = (vs: GespeicherterVorschlag[], katalog = KATALOG, belegt = OFFEN, platz = 10, heute = '2026-11-07') => waehleSynchroBelege(vs, katalog, belegt, heute, platz)
const ids = (e: ReturnType<typeof lauf>) => e.belege.map((b) => b.anilistId).join()
const grund = (e: ReturnType<typeof lauf>) => e.zurueck.map((z) => z.grund).join(' | ')

// --- Anlassfall -----------------------------------------------------------------------------------------------------------------
const anlass = lauf([PET, DC])
pruefe('Devils’ Crest wird Beleg (203275, primevideo), nicht der Katalogtitel mit ähnlichem Namen', ids(lauf([DC])) === '203275' && lauf([DC]).belege[0]!.plattform === 'primevideo', lauf([DC]))
pruefe('Pet und Devils’ Crest zusammen: beide Kandidaten, sortiert nach Eingabe', ids(anlass) === '101350,203275', anlass)
pruefe('Beleg trägt den Katalognamen, die Artikeladresse und das Zitat wörtlich', anlass.belege[1]!.titel === 'Devils’ Crest' && anlass.belege[1]!.quelle === QUELLE && anlass.belege[1]!.zitat === DC_ZITAT, anlass.belege[1])

// --- Stufe 1: Aussage --------------------------------------------------------------------------------------------------------------
const UT = 'Die Serie »Pet« steht ab sofort mit deutschen Untertiteln auf Prime Video bereit.'
pruefe('Gegenprobe Untertitel: sprache fälschlich deutsch, Zitat nennt nur Untertitel – kein Beleg', ids(lauf([mit(PET, { zitat: UT })])) === '', lauf([mit(PET, { zitat: UT })]))
pruefe('Gegenprobe OmU', ids(lauf([mit(PET, { zitat: '»Pet« läuft ab sofort in der OmU-Fassung bei Prime Video.' })])) === '')
pruefe('Gegenprobe sprache omu', ids(lauf([mit(PET, { sprache: 'omu' })])) === '')
pruefe('Gegenprobe sprache unklar', ids(lauf([mit(PET, { sprache: 'unklar' })])) === '')
pruefe('Bloßes „auf Deutsch“ zählt nicht (kein Synchro-Bezug)', ids(lauf([mit(PET, { zitat: '»Pet« startet bei Prime Video jetzt auch auf Deutsch.' })])) === '')
pruefe('Verneint: „keine deutsche Synchronisation“', ids(lauf([mit(PET, { zitat: '»Pet« hat bei Prime Video keine deutsche Synchronisation.' })])) === '')
pruefe('nenntSynchro: Synchronisation ja, Sprachausgabe ja, Untertitel nein, auf Deutsch nein',
  nenntSynchro(PET_ZITAT) && nenntSynchro(DC_ZITAT) && !nenntSynchro(UT) && !nenntSynchro('jetzt auch auf Deutsch'))
pruefe('nenntSynchro: Untertitel neben Synchro stören nicht (Devils’ Crest), Untertitel allein schon', nenntSynchro('deutsche Synchronisation und deutsche Untertitel') && !nenntSynchro('mit deutschen Untertiteln'))
pruefe('Art disc / ankuendigung / pause: kein Beleg', ['disc', 'ankuendigung', 'pause'].every((art) => ids(lauf([mit(PET, { art: art as never })])) === ''))
pruefe('Art start / folgen / sprachfassung: Beleg', ['start', 'folgen', 'sprachfassung'].every((art) => ids(lauf([mit(PET, { art: art as never })])) === '101350'))
for (const p of [null, 'tv', 'kino', 'disc'] as const) pruefe(`Plattform ${p}: kein Stream-Weg, zurückgestellt`, ids(lauf([mit(PET, { plattform: p as never })])) === '' && grund(lauf([mit(PET, { plattform: p as never })])).includes('Stream'))
pruefe('Wochentags-Warnung: zurückgestellt', grund(lauf([mit(PET, { warnungen: ['2026-11-06 ist ein Freitag, das Zitat nennt andere Wochentage – gegenlesen'] })])) === 'Warnung am Vorschlag')
pruefe('Namenswarnung plus fremde Warnung: zurückgestellt', ids(lauf([mit(DC, { warnungen: [...DC.warnungen, 'Uhrzeit widerspricht 20:00 – gegenlesen'] })])) === '')
pruefe('Titelzeilen-Warnung: zurückgestellt', ids(lauf([mit(PET, { warnungen: ['Titel steht nur in der Titelzeile des Blocks über dem Zitat – gegenlesen'] })])) === '')
pruefe('unsicher gesetzt: zurückgestellt', ids(lauf([mit(PET, { unsicher: 'Artikel nennt keine Plattform' })])) === '')
pruefe('Tag heute: Beleg; Tag morgen: zurückgestellt', ids(lauf([mit(PET, { datum: '2026-11-07' })])) === '101350' && ids(lauf([mit(PET, { datum: '2026-11-08' })])) === '')
const echteWarnung = pruefeName('anbieter', 'Prime Video', 'Pet startet.', ARTIKEL).warnung ?? ''
pruefe('ANBIETER_NUR_IM_ARTIKEL passt auf die echte Warnung von pruefeName (Gleichlauf)', ANBIETER_NUR_IM_ARTIKEL.test(echteWarnung) && !ANBIETER_NUR_IM_ARTIKEL.test('sender „ProSieben MAXX“ steht nur im Artikeltext, nicht im Zitat – gegenlesen'), echteWarnung)
pruefe('ANBIETER_NUR_IM_ARTIKEL ist an beiden Enden verankert (kein Anhängsel, kein Vorspann)', !ANBIETER_NUR_IM_ARTIKEL.test(`${echteWarnung} und mehr`) && !ANBIETER_NUR_IM_ARTIKEL.test(`Hinweis: ${echteWarnung}`))

// --- Stufe 1b: Plattform an die Synchro-Aussage gebunden (Artikel 1064193 und 1064806, wörtlich aus dem Abruf; Claude ordnete auch Prime Video zu) ---
const CR_ARTIKEL = 'Crunchyroll ergänzt zwei weitere Anime-Neuzugänge auf Deutsch'
const ADN_ARTIKEL = 'ADN kündigt sechs Anime-Neuzugänge für November 2026 an'
const AOASHI_ZITAT = '»Aoashi« – Staffel 2\nEpisoden: 1 auf Deutsch verfügbar\nSprache: Deutsch, Japanisch (UT)\nSimulcast: Jeden Sonntag um 11:00 Uhr'
const PSYREN_ZITAT = '»PSYREN«\nEpisoden: 1 auf Deutsch verfügbar\nSprache: Deutsch, Japanisch (UT)\nSimulcast: Jeden Montag um 16:30 Uhr'
const PARRY_ZITAT = ' 2. November: »I Parry Everything!« (Synchro)\n Episoden: 12 (komplett)\n Sprache: Deutsch, Japanisch (UT)\n Hinweis: Der Originalton ist bereits verfügbar\n Stream: ADN, Prime Video'
const gebunden = (titel: string, artikel: string, zitat: string, plattform: string) => mit(PET, { titel, artikel, zitat, plattform: plattform as GespeicherterVorschlag['plattform'], sprache: 'deutsch+omu', art: 'start' })
const zweiWege = (id: number, titleDe: string, a: string, b: string): KatalogTitel => ({ id, titleDe, streams: [weg(a), weg(b)] })
const KAT_B: KatalogTitel[] = [
  zweiWege(900401, 'Aoashi – Staffel 2', 'crunchyroll', 'primevideo'),
  zweiWege(900402, 'PSYREN', 'crunchyroll', 'primevideo'),
  zweiWege(900403, 'I Parry Everything!', 'adn', 'primevideo'),
]
const FAELLE_B = [
  ['Aoashi', 'Aoashi – Staffel 2', CR_ARTIKEL, AOASHI_ZITAT, 'crunchyroll', 'primevideo', '900401'],
  ['PSYREN', 'PSYREN', CR_ARTIKEL, PSYREN_ZITAT, 'crunchyroll', 'primevideo', '900402'],
  ['I Parry Everything!', 'I Parry Everything!', ADN_ARTIKEL, PARRY_ZITAT, 'adn', 'primevideo', '900403'],
] as const
for (const [n, titel, artikel, zitat, richtig, falsch, id] of FAELLE_B) {
  const falschE = lauf([gebunden(titel, artikel, zitat, falsch)], KAT_B)
  pruefe(`${n}: ${falsch} ist nicht an die Synchro gebunden – kein Beleg, Grund benannt`, ids(falschE) === '' && grund(falschE).includes('nicht eindeutig an die Synchro-Aussage gebunden'), falschE)
  pruefe(`${n}: ${richtig} (Artikeltitel) bleibt Beleg`, ids(lauf([gebunden(titel, artikel, zitat, richtig)], KAT_B)) === id)
}
const SATZ = 'Die Serie »Pet« kommt ab sofort mit deutscher Synchronisation zu Crunchyroll.'
pruefe('Ein-Plattform-Zitat bindet gegen den Artikeltitel einer anderen Plattform', ids(lauf([gebunden('Pet', 'Prime Video nimmt Anime auf', SATZ, 'crunchyroll')], [{ ...PET_TITEL, streams: [weg('crunchyroll')] }])) === '101350')
pruefe('Ein-Plattform-Zitat einer anderen Plattform als der Vorschlag: nicht gebunden', ids(lauf([gebunden('Pet', 'Crunchyroll und Prime Video', SATZ, 'primevideo')])) === '')
pruefe('Zitat nennt zwei Plattformen, Titel keine: nicht gebunden', ids(lauf([gebunden('Pet', 'Neuzugänge im November', PARRY_ZITAT.replace('I Parry Everything!', 'Pet'), 'adn')], [{ ...PET_TITEL, streams: [weg('adn')] }])) === '')
pruefe('Zitat ohne Plattform, Titel mit zwei Plattformen: nicht gebunden', ids(lauf([gebunden('Pet', 'Crunchyroll und Prime Video starten', 'Die Serie »Pet« kommt mit deutscher Synchronisation.', 'primevideo')])) === '')

// --- Stufe 2: Titel -------------------------------------------------------------------------------------------------------------
pruefe('Teilwort: „Pet“ trifft nicht „Pet Shop of Horrors“', ordneTitelZu('Pet', KATALOG) === PET_TITEL)
pruefe('Schreibweise: Apostroph und Anführung egal', ordneTitelZu("Devils' Crest", KATALOG) === DC_TITEL && ordneTitelZu('DEVILS’ CREST', KATALOG) === DC_TITEL)
pruefe('Name aus titleRomaji reicht (Demons’ Crest)', ordneTitelZu('Demons Crest', KATALOG) === DC_TITEL)
const ZWEI = [...KATALOG, { id: 900103, titleDe: 'Pet', streams: [weg('primevideo')] }]
pruefe('Mehrdeutig (zwei Titel „Pet“): keiner', typeof ordneTitelZu('Pet', ZWEI) === 'string' && ids(lauf([PET], ZWEI)) === '' && grund(lauf([PET], ZWEI)).includes('mehrdeutig'))
pruefe('Nicht im Katalog: zurückgestellt', grund(lauf([mit(PET, { titel: 'Unbekannter Titel' })])) === 'Titel nicht im Katalog')
pruefe('Name ohne Buchstaben: zurückgestellt', ids(lauf([mit(PET, { titel: '!!!' })])) === '')
pruefe('Ähnlicher Name („Crest of the Stars“) trifft nur den eigenen Eintrag, nicht Devils’ Crest', ids(lauf([mit(DC, { titel: 'Crest of the Stars' })])) === '900102', lauf([mit(DC, { titel: 'Crest of the Stars' })]))
const NAMEN: KatalogTitel[] = [{ id: 900104, titleDe: 'Deutscher Name', titleEn: 'English Name', titleRomaji: 'Romaji Name', streams: [weg('primevideo')] }]
for (const n of ['Deutscher Name', 'English Name', 'Romaji Name']) pruefe(`Jeder der drei Namen trifft: ${n}`, ordneTitelZu(n, NAMEN) === NAMEN[0])
const NETFLIX_PET: KatalogTitel[] = [{ ...PET_TITEL, streams: [weg('netflix')] }]
const PET_NETFLIX = mit(PET, { plattform: 'netflix', zitat: PET_ZITAT.replace('Prime Video', 'Netflix'), artikel: 'Netflix nimmt zwei Anime-Serien auf Deutsch ins Programm' })
pruefe('Plattform netflix: Beleg trägt netflix, ein Ja bei primevideo sperrt nicht', lauf([PET_NETFLIX], NETFLIX_PET, new Map([['101350|primevideo', IMMER]])).belege[0]?.plattform === 'netflix')
pruefe('Plattform netflix: ein Ja bei netflix sperrt', ids(lauf([PET_NETFLIX], NETFLIX_PET, new Map([['101350|netflix', IMMER]]))) === '')
pruefe('Beleg-Zeilen tragen die Plattform des Belegs', belegZeilen(lauf([PET_NETFLIX], NETFLIX_PET).belege[0]!, '2026-11-07').includes('  platform: netflix'))

// --- Stufe 2b: Staffelzählung, Gleichnamige (echte Fälle vom 08.11.2026: Black Clover 195604, Colorful 8142/841, Artikel 1068951, 1066831) ---
const BC_STAFFEL2: KatalogTitel = { id: 195604, titleDe: 'Black Clover: Staffel 2', titleEn: 'Black Clover Season 2', titleRomaji: 'Black Clover 2nd Season', streams: [weg('crunchyroll')] }
const BC_STAFFEL1: KatalogTitel = { id: 97940, titleDe: 'Black Clover', titleEn: 'Black Clover', titleRomaji: 'Black Clover', streams: [weg('crunchyroll')] }
const BC = [BC_STAFFEL1, BC_STAFFEL2, { id: 900301, titleDe: 'Black Clover: Staffel 3', streams: [weg('crunchyroll')] }]
for (const n of ['Black Clover Second Season', 'Black Clover 2nd Season', 'Black Clover Season 2', 'Black Clover: Staffel 2'])
  pruefe(`Staffelzählung: „${n}“ trifft Staffel 2, nicht Staffel 1 oder 3`, ordneTitelZu(n, BC) === BC_STAFFEL2, ordneTitelZu(n, BC))
pruefe('Staffelzählung: „Black Clover“ trifft weiter nur Staffel 1', ordneTitelZu('Black Clover', BC) === BC_STAFFEL1)
pruefe('Staffelzählung: „Third Season“ trifft Staffel 3, „Fourth Season“ keinen', (ordneTitelZu('Black Clover Third Season', BC) as KatalogTitel).id === 900301 && ordneTitelZu('Black Clover Fourth Season', BC) === 'Titel nicht im Katalog')
pruefe('Staffelzählung: „Staffel 4“ ohne Staffel-4-Eintrag fällt nicht auf den Grundtitel (Naruto Shippuden – Staffel 4)', ordneTitelZu('Black Clover – Staffel 4', BC) === 'Titel nicht im Katalog')
pruefe('Staffelzählung: Beleg „Black Clover Second Season“ (Crunchyroll, offen) geht an 195604',
  ids(lauf([mit(PET, { titel: 'Black Clover Second Season', plattform: 'crunchyroll', artikel: 'Crunchyroll + Synchro', zitat: '»Black Clover Second Season« (Synchro) Episoden: 1 auf Deutsch verfügbar Sprache: Deutsch, Japanisch (UT) Simulcast: Jeden Samstag' })], [BC_STAFFEL1, { ...BC_STAFFEL2, streams: [weg('crunchyroll')] }])) === '195604')
pruefe('Staffelzählung: „Season 2“ im Artikel trifft einen Katalogtitel nur mit „Staffel 2“', (ordneTitelZu('Black Clover Season 2', [{ id: 900302, titleDe: 'Black Clover: Staffel 2' }]) as KatalogTitel).id === 900302)
const COLORFUL_FILM: KatalogTitel = { id: 8142, titleDe: 'Colorful', titleEn: 'Colorful ~ The Motion Picture', streams: [weg('primevideo'), weg('joyn', true)] }
const COLORFUL_KURZ: KatalogTitel = { id: 841, titleDe: 'Colorful', titleEn: 'COLORFUL', streams: [] }
pruefe('Gleichnamige: nur einer hat einen Weg bei der Plattform – er gewinnt (Colorful)', (ordneTitelZu('Colorful', [COLORFUL_KURZ, COLORFUL_FILM], 'joyn') as KatalogTitel).id === 8142)
pruefe('Gleichnamige: beide mit Weg bei der Plattform bleiben mehrdeutig', String(ordneTitelZu('Colorful', [COLORFUL_FILM, { ...COLORFUL_KURZ, streams: [weg('joyn', true)] }], 'joyn')).includes('mehrdeutig'))
const FILM_OHNE_URTEIL: KatalogTitel = { ...COLORFUL_FILM, streams: [weg('joyn')] }
const COLORFUL_ARTIKEL = mit(PET, { titel: 'Colorful', plattform: 'joyn', artikel: 'Anime-Neuzugänge auf Joyn', zitat: '»Colorful« mit deutscher Synchronisation auf Joyn.' })
pruefe('Gleichnamige: Film mit Joyn-Weg ohne Urteil gegen Serie ohne Weg – mehrdeutig, kein Beleg (Auflage A1)',
  String(ordneTitelZu('Colorful', [COLORFUL_KURZ, FILM_OHNE_URTEIL], 'joyn')).includes('mehrdeutig') && ids(lauf([COLORFUL_ARTIKEL], [COLORFUL_KURZ, FILM_OHNE_URTEIL])) === '' && grund(lauf([COLORFUL_ARTIKEL], [COLORFUL_KURZ, FILM_OHNE_URTEIL])).includes('mehrdeutig'))
const wegAbgeleitet = (dub: boolean, wie = 'joyn-pauschal') => ({ platform: 'joyn', dub, dubAbgeleitet: wie })
const FILM_PAUSCHAL: KatalogTitel = { ...COLORFUL_FILM, streams: [wegAbgeleitet(true)] }
pruefe('Angenommenes Ja (joyn-pauschal) wird vom Artikel ersetzt: Beleg', ids(lauf([COLORFUL_ARTIKEL], [FILM_PAUSCHAL])) === '8142')
pruefe('Angenommenes Ja (kanal-erbt) wird ersetzt', ids(lauf([COLORFUL_ARTIKEL], [{ ...FILM_PAUSCHAL, streams: [wegAbgeleitet(true, 'kanal-erbt')] }])) === '8142')
pruefe('Gemessenes Ja (ohne dubAbgeleitet) bleibt: kein Beleg', grund(lauf([COLORFUL_ARTIKEL], [{ ...FILM_PAUSCHAL, streams: [weg('joyn', true)] }])) === 'Weg trägt schon dub: true')
pruefe('Angenommenes Nein gibt es nicht; dub: false mit dubAbgeleitet bleibt abgelehnt', grund(lauf([COLORFUL_ARTIKEL], [{ ...FILM_PAUSCHAL, streams: [wegAbgeleitet(false)] }])) === 'Weg trägt schon dub: false')
pruefe('Angenommenes Ja, aber Handbeleg-Nein bis zum Artikeltag: gesperrt', ids(lauf([COLORFUL_ARTIKEL], [FILM_PAUSCHAL], new Map([['8142|joyn', '2026-11-06']]))) === '')

// --- Flaute: nur Zuordnungsfehler zählen (Vorschlagsstand 08.11.2026, Auswahl der echten Gründe; die Wege tragen hier gemessene Urteile, 0 Belege) ---
const mitWegen = (...streams: { platform: string; dub?: boolean }[]) => [{ ...PET_TITEL, streams }]
// Wörtlich aus data/proposals/anime2you-extraktion.json (Artikel 1068729, gelesen 07.11.2026)
const PLUTO_ARTIKEL = 'Zwei weitere Anime-Neuzugänge kostenlos auf Deutsch bei Pluto TV'
const BC_ZITAT = 'Nachdem Pluto TV bereits im letzten Monat die ersten 35 Folgen von »Black Clover« in sein Programm aufgenommen hat, wurden nun die restlichen 16 Folgen der ersten Staffel ergänzt. Damit sind alle 51 Episoden mit deutscher Synchronisation verfügbar.'
const DS_ZITAT = 'Darüber hinaus bietet die Plattform seit Kurzem auch die erste Staffel der Adventure-Serie »Dr. STONE« mit deutscher Sprachfassung auf Abruf an. Von den insgesamt 24 Episoden stehen derzeit allerdings nur 23 Folgen zur Verfügung.'
const ZEILEN_0811: [string, Partial<GespeicherterVorschlag>, KatalogTitel[]][] = [
  ['Iron Man', { art: 'abgang' }, []],
  ['Der Held ohne Klasse', { plattform: 'netflix', zitat: PET_ZITAT.replace('Prime Video', 'Netflix'), artikel: 'Netflix' }, [{ id: 900501, titleDe: 'Der Held ohne Klasse', streams: [] }]],
  ['Clannad', {}, [{ id: 900502, titleDe: 'Clannad', streams: [weg('primevideo', true)] }]],
  ['Gosick', {}, [{ id: 900503, titleDe: 'Gosick', streams: [weg('primevideo', true)] }]],
  ['Fool Night', { datum: '2026-11-26' }, [{ id: 900504, titleDe: 'Fool Night', streams: [weg('primevideo')] }]],
  ['Der Schatten über Anlegion', { art: 'ankuendigung' }, []],
  ['Black Clover', { plattform: null, anbieter: 'Pluto TV', artikel: PLUTO_ARTIKEL, zitat: BC_ZITAT }, [{ id: 900506, titleDe: 'Black Clover', streams: [] }]],
  ['Dr. STONE', { plattform: null, anbieter: 'Pluto TV', artikel: PLUTO_ARTIKEL, zitat: DS_ZITAT }, [{ id: 900507, titleDe: 'Dr. STONE', streams: [] }]],
  ['Tokyo Godfathers', { unsicher: 'Plattform fehlt im Artikel' }, []],
  ['Akira', {}, [{ id: 900505, titleDe: 'Akira', streams: [weg('netflix')] }]],
  ['YAIBA: Samurai Legend', { warnungen: ['Uhrzeit widerspricht 18:25 – gegenlesen'] }, []],
  ['Naruto Shippuden – Staffel 4', {}, []],
  ['Girls und Panzer OVA – Real Anzio Battle', {}, []],
]
const KATALOG_0811 = ZEILEN_0811.flatMap(([, , k]) => k)
const V_0811 = ZEILEN_0811.map(([titel, o], i) => mit(PET, { titel, artikelId: `8${i}`, ...o }))
const E_0811 = lauf(V_0811, KATALOG_0811)
pruefe('Stand 08.11.: 0 Belege, 13 Ablehnungen, davon nur 2 Zuordnungsfehler (Naruto, Anzio) – keine Flaute-Warnung', E_0811.belege.length === 0 && E_0811.zurueck.length === 13 && E_0811.zurueck.filter((z) => z.strittig).length === 2 && belegFlaute(E_0811) === undefined, E_0811.zurueck)
const SIEBEN = Array.from({ length: 5 }, (_, i) => mit(PET, { titel: `Unbekannt ${i}`, artikelId: `7${i}` }))
pruefe('Fünf Zuordnungsfehler, 0 Belege: Warnung mit allen fünf in der Liste', (belegFlaute(lauf(SIEBEN)) ?? '').includes('0 Belege bei 5 ') && (belegFlaute(lauf(SIEBEN)) ?? '').includes('Unbekannt 4 (Artikel 74)'))
pruefe('Vier Zuordnungsfehler: keine Warnung', belegFlaute(lauf(SIEBEN.slice(0, 4))) === undefined)
pruefe('Fünf Zuordnungsfehler plus ein Beleg: keine Warnung', belegFlaute(lauf([...SIEBEN, PET])) === undefined)
pruefe('Mehrere Wege und Plattform-Bindung zählen als Zuordnungsfehler', lauf([PET], mitWegen(weg('primevideo'), weg('primevideo'))).zurueck[0]?.strittig === true && lauf([gebunden('Aoashi', CR_ARTIKEL, AOASHI_ZITAT, 'primevideo')], KAT_B).zurueck[0]?.strittig === true)
pruefe('Berechtigte Gründe sind nicht strittig (Weg trägt Urteil, kein Weg, Handbeleg)', [lauf([PET], mitWegen(weg('primevideo', true))), lauf([PET], mitWegen(weg('netflix'))), lauf([PET], KATALOG, new Map([['101350|primevideo', IMMER]]))].every((e) => e.zurueck.length === 1 && !e.zurueck[0]!.strittig))
pruefe('Gleichnamige: keiner mit Weg bei der Plattform bleibt mehrdeutig', String(ordneTitelZu('Colorful', [COLORFUL_KURZ, COLORFUL_FILM], 'netflix')).includes('mehrdeutig'))
pruefe('Gleichnamige: ohne Plattform kein Vorzug', String(ordneTitelZu('Colorful', [COLORFUL_KURZ, COLORFUL_FILM])).includes('mehrdeutig'))
pruefe('Colorful durch die Auswahl: Weg trägt schon dub gilt dem Film, nicht „mehrdeutig“',
  grund(lauf([mit(PET, { titel: 'Colorful', plattform: 'joyn', artikel: 'Anime-Neuzugänge auf Joyn', zitat: '»Colorful« mit deutscher Synchronisation auf Joyn.' })], [COLORFUL_KURZ, { ...COLORFUL_FILM, streams: [weg('joyn', true)] }])) === 'Weg trägt schon dub: true')

// --- Benannte Ausfälle: Anbieter ohne Kennung (Pluto TV), Zitat ohne Synchro-Wort (Artikel 1068729, 1069021) ---
const APPLE = mit(PET, { titel: 'Dr. STONE', plattform: null, anbieter: 'Apple TV+', zitat: 'Die erste Staffel »Dr. STONE« mit deutscher Synchronisation.' })
pruefe('Weder Plattform noch Anbieter: keine Stream-Plattform, zurückgestellt', grund(lauf([mit(APPLE, { anbieter: null })])) === 'keine Stream-Plattform im Datenmodell')
pruefe('Anbieter ohne Plattform-Kennung: Grund nennt den Anbieter', grund(lauf([APPLE], [{ ...PET_TITEL, titleDe: 'Dr. STONE' }])) === 'keine Stream-Plattform im Datenmodell (Anbieter Apple TV+ hat keine Kennung)')

// --- Pluto TV (Artikel 1068729): gespeichert mit plattform null und Anbieter „Pluto TV“, bevor es eine Kennung gab ---
const PLUTO = mit(PET, { titel: 'Dr. STONE', plattform: null, anbieter: 'Pluto TV', artikel: PLUTO_ARTIKEL, zitat: DS_ZITAT, art: 'start', folgen: null, warnungen: [] })
const DS_ID = 105333
const KAT_PLUTO: KatalogTitel[] = [
  { id: 900601, titleDe: 'Dr. STONE Special', streams: [weg('primevideo')] },
  { id: DS_ID, titleDe: 'Dr. STONE', streams: [weg('plutotv'), weg('netflix', true)] },
  { id: 900602, titleDe: 'Dr. STONE: New World', streams: [weg('plutotv')] },
]
const E_PLUTO = lauf([PLUTO], KAT_PLUTO)
pruefe('Pluto TV: Vorschlag mit Anbietername wird ein Beleg an plutotv, am richtigen Titel unter dreien', E_PLUTO.belege.length === 1 && E_PLUTO.belege[0]!.anilistId === DS_ID && E_PLUTO.belege[0]!.plattform === 'plutotv', E_PLUTO)
pruefe('Pluto TV: der Beleg als YAML trägt platform: plutotv', E_PLUTO.belege.length === 1 && belegZeilen(E_PLUTO.belege[0]!, '2026-11-08').includes('  platform: plutotv'))
const OHNE_WEG = lauf([PLUTO], [{ id: DS_ID, titleDe: 'Dr. STONE', streams: [weg('netflix', true)] }])
pruefe('Pluto TV: ohne Weg bei plutotv wartet der Beleg auf den Bestandsbau, kein Zuordnungsfehler', grund(OHNE_WEG) === 'kein Weg bei plutotv (wartet auf den Bestandsbau)' && OHNE_WEG.zurueck[0]!.strittig === false, OHNE_WEG)
pruefe('Pluto TV: ein Zitat, das nur Prime Video nennt, bindet die Plattform nicht', lauf([mit(PLUTO, { zitat: PET_ZITAT })], KAT_PLUTO).belege.length === 0)
pruefe('Pluto TV: ein Handbeleg zu Titel und Plattform sperrt wie bei jeder Plattform', grund(lauf([PLUTO], KAT_PLUTO, new Map([[`${DS_ID}|plutotv`, IMMER]]))) === 'Handbeleg zu Titel und Plattform steht schon')
pruefe('Nachträgliche Plattform: nur Pluto TV wird aus dem Anbieter gelesen, null bei Prime Video bleibt null', mitPlattformAusAnbieter(PLUTO).plattform === 'plutotv' && mitPlattformAusAnbieter(mit(PET, { plattform: null })).plattform === null)
const YAIBA = mit(PET, { titel: 'YAIBA: Samurai Legend', zitat: 'Die ersten beiden Episoden von »YAIBA: Samurai Legend« stehen kostenlos auf Deutsch zur Verfügung.' })
pruefe('Deutsches Zitat ohne Synchro-Wort: wird gezählt und benannt, nicht still übergangen', lauf([YAIBA]).zurueck.length === 1 && grund(lauf([YAIBA])) === 'Zitat nennt die Synchro nicht ausdrücklich', lauf([YAIBA]))
pruefe('Vorschlag in anderer Sprache (omu) ist kein Ablehnungsfall und wird nicht gezählt', lauf([mit(YAIBA, { sprache: 'omu' })]).zurueck.length === 0)

// --- Stufe 3: Weg und Handbelege ---------------------------------------------------------------------------------------------------
pruefe('Kein Weg bei der Plattform (nur Netflix): zurückgestellt', grund(lauf([PET], mitWegen(weg('netflix')))) === 'kein Weg bei primevideo (wartet auf den Bestandsbau)')
pruefe('Zwei Wege bei der Plattform: zurückgestellt', grund(lauf([PET], mitWegen(weg('primevideo'), weg('primevideo')))) === '2 Wege bei primevideo')
pruefe('Weg trägt dub: true: zurückgestellt', grund(lauf([PET], mitWegen(weg('primevideo', true)))) === 'Weg trägt schon dub: true')
pruefe('Weg trägt dub: false: zurückgestellt', grund(lauf([PET], mitWegen(weg('primevideo', false)))) === 'Weg trägt schon dub: false')
pruefe('Weg bei der Plattform plus fremder Weg: Beleg', ids(lauf([PET], mitWegen(weg('netflix'), weg('primevideo')))) === '101350')
pruefe('Ja-Handbeleg steht: zurückgestellt', grund(lauf([PET], KATALOG, new Map([['101350|primevideo', IMMER]]))) === 'Handbeleg zu Titel und Plattform steht schon')
pruefe('Ja-Handbeleg einer anderen Plattform sperrt nicht', ids(lauf([PET], KATALOG, new Map([['101350|netflix', IMMER]]))) === '101350')
pruefe('Ja-Handbeleg eines anderen Titels sperrt nicht', ids(lauf([PET], KATALOG, new Map([['203275|primevideo', IMMER]]))) === '101350')
pruefe('Nein vom 16.10. (älter als der Artikel) darf überholt werden (Pet)', ids(lauf([PET], KATALOG, new Map([['101350|primevideo', '2026-10-16']]))) === '101350')
pruefe('Nein vom 05.11. (Tag vor dem Artikel): Beleg; Nein vom 06.11. (Artikeltag): gesperrt; Nein vom 07.11.: gesperrt',
  ids(lauf([PET], KATALOG, new Map([['101350|primevideo', '2026-11-05']]))) === '101350' &&
    ids(lauf([PET], KATALOG, new Map([['101350|primevideo', '2026-11-06']]))) === '' &&
    ids(lauf([PET], KATALOG, new Map([['101350|primevideo', '2026-11-07']]))) === '')
pruefe('Derselbe Titel zweimal im Lauf: ein Beleg', ids(lauf([PET, mit(PET, { artikelId: '1068060' })])) === '101350')

// --- Riegel ---------------------------------------------------------------------------------------------------------------------
const VIELE = Array.from({ length: 12 }, (_, i) => ({ id: 900200 + i, titleDe: `Serie ${i} Alpha`, streams: [weg('primevideo')] }))
const VIELE_V = VIELE.map((t) => mit(PET, { titel: t.titleDe }))
pruefe('Tageshöchstmenge ist 10', HOECHSTENS_AM_TAG === 10)
pruefe('Riegel: 12 Kandidaten, 10 frei: genau 10 Belege, 2 zurückgestellt', lauf(VIELE_V, VIELE, OFFEN, 10).belege.length === 10 && lauf(VIELE_V, VIELE, OFFEN, 10).zurueck.length === 2)
pruefe('Riegel: 1 frei: ein Beleg; 0 frei: keiner', lauf(VIELE_V, VIELE, OFFEN, 1).belege.length === 1 && lauf(VIELE_V, VIELE, OFFEN, 0).belege.length === 0 && grund(lauf([PET], KATALOG, OFFEN, 0)).includes('Tageshöchstmenge'))

// --- Schreibweg gegen Wegwerf-Wurzel -------------------------------------------------------------------------------------------------
const wurzel = mkdtempSync(join(tmpdir(), 'synchro-beleg-'))
const hand = '# Handbelege\n- anilistId: 900001\n  title: "Fremd"\n  platform: netflix\n  dub: false\n  checkedAt: \'2026-10-16\'\n  note: "von Hand"\n'
const belegDatei = join(wurzel, 'dub.yaml')
const katalogDatei = join(wurzel, 'titles.json')
const fehlt = join(wurzel, 'gibt-es-nicht.json')
const tun = (vs: GespeicherterVorschlag[], heute = '2026-11-07', katalogDateien = [katalogDatei, fehlt]) =>
  gibSynchroBelegeAb({ vorschlaege: vs, belegDatei, katalogDateien, heute, log: () => {}, warn: () => {} })
try {
  writeFileSync(katalogDatei, JSON.stringify(KATALOG))
  writeFileSync(belegDatei, hand)
  const e1 = tun([PET, DC])
  const nach1 = readFileSync(belegDatei, 'utf8')
  const gelesen = yaml.load(nach1) as { anilistId: number; platform: string; dub?: boolean; checkedAt: string; note: string; title: string; url?: string }[]
  pruefe('Schreibweg: zwei neue Blöcke, der Handblock bleibt unverändert davor', e1.belege.length === 2 && nach1.startsWith(hand.trimEnd()) && gelesen.length === 3, nach1.slice(-400))
  const dc = gelesen.find((b) => b.anilistId === 203275)
  pruefe('Block Devils’ Crest: platform, dub true, checkedAt als Text, Titel, keine url', dc?.platform === 'primevideo' && dc.dub === true && dc.checkedAt === '2026-11-07' && dc.title === 'Devils’ Crest' && dc.url === undefined, dc)
  pruefe('Notiz: Marke, Artikeladresse, Zitat wörtlich', !!dc && dc.note.startsWith('Anime2You-Automatik: Artikel ' + QUELLE) && dc.note.includes(DC_ZITAT), dc?.note)
  pruefe('Kopfzeile des Blocks nennt die Automatik, nicht den Browser', nach1.includes('# --- Anime2You-Automatik, 2026-11-07') && !nach1.includes('Aus dem Browser gemeldet'))
  const e2 = tun([PET, DC])
  pruefe('Zweiter Lauf: keine Belege, Datei byte-gleich', e2.belege.length === 0 && readFileSync(belegDatei, 'utf8') === nach1, e2)
  pruefe('Zweiter Lauf: Grund ist der vorhandene Handbeleg', e2.zurueck.every((z) => z.grund === 'Handbeleg zu Titel und Plattform steht schon'), e2.zurueck)

  // Riegel über die Datei: heute stehen schon 10 Auto-Belege da
  const zehn = Array.from({ length: 10 }, (_, i) => `- anilistId: ${900300 + i}\n  platform: netflix\n  dub: true\n  checkedAt: '2026-11-08'\n  note: "Anime2You-Automatik: x"\n`).join('')
  writeFileSync(belegDatei, hand + zehn)
  writeFileSync(katalogDatei, JSON.stringify(KATALOG))
  const e3 = tun([PET], '2026-11-08')
  pruefe('Riegel über die Datei: 10 Auto-Belege heute, Beleg Nummer 11 bleibt aus, Datei unverändert', e3.belege.length === 0 && readFileSync(belegDatei, 'utf8') === hand + zehn, e3)
  const e4 = tun([PET], '2026-11-09')
  pruefe('Riegel: am Folgetag zählen die 10 von gestern nicht', e4.belege.length === 1)
  pruefe('leseBelegStand zählt zehn Auto-Belege am 08.11. und keinen am 09.11.', (writeFileSync(belegDatei, hand + zehn), leseBelegStand(belegDatei, '2026-11-08').heuteAuto === 10 && leseBelegStand(belegDatei, '2026-11-09').heuteAuto === 0))
  const stand = (text: string) => (writeFileSync(belegDatei, text), leseBelegStand(belegDatei, '2026-11-08'))
  const eintrag = (urteil: string, am: string) => `- anilistId: 7\n  platform: netflix\n  ${urteil}\n  checkedAt: '${am}'\n`
  pruefe('Handbelege von heute ohne die Marke zählen nicht für den Riegel', stand(zehn.replaceAll('Anime2You-Automatik: x', 'von Hand')).heuteAuto === 0)
  pruefe('Ja vor Nein in der Datei: das Ja sperrt weiter', stand(eintrag('dub: true', '2026-10-01') + eintrag('dub: false', '2026-10-16')).belegt.get('7|netflix') === IMMER)
  pruefe('Nein vor Ja in der Datei: das Ja sperrt', stand(eintrag('dub: false', '2026-10-16') + eintrag('dub: true', '2026-10-01')).belegt.get('7|netflix') === IMMER)
  pruefe('Nein allein sperrt bis zu seinem Messtag', stand(eintrag('dub: false', '2026-10-16')).belegt.get('7|netflix') === '2026-10-16')
  pruefe('Zwei Nein: das jüngere zählt, in beiden Reihenfolgen', stand(eintrag('dub: false', '2026-10-16') + eintrag('dub: false', '2026-10-20')).belegt.get('7|netflix') === '2026-10-20' && stand(eintrag('dub: false', '2026-10-20') + eintrag('dub: false', '2026-10-16')).belegt.get('7|netflix') === '2026-10-20')
  pruefe('available: false sperrt für immer', stand(eintrag('available: false', '2026-10-01')).belegt.get('7|netflix') === IMMER)
  pruefe('Eintrag ohne Urteil (nur Notiz) sperrt nicht', stand(eintrag('note: x', '2026-10-01')).belegt.size === 0)

  // Ränder: leere Datei, nur Kommentar, kein Katalog
  writeFileSync(belegDatei, '')
  pruefe('Leere Belegdatei: Beleg wird geschrieben, Ergebnis lesbar', tun([PET]).belege.length === 1 && (yaml.load(readFileSync(belegDatei, 'utf8')) as unknown[]).length === 1)
  writeFileSync(belegDatei, '# nur Kommentar\n')
  pruefe('Datei nur mit Kommentar: Beleg wird geschrieben', tun([PET]).belege.length === 1 && (yaml.load(readFileSync(belegDatei, 'utf8')) as unknown[]).length === 1)
  writeFileSync(belegDatei, hand)
  pruefe('Kein Katalog vorhanden: keine Belege, Datei unverändert', tun([PET], '2026-11-07', [fehlt]).belege.length === 0 && readFileSync(belegDatei, 'utf8') === hand)
  const neinPet = (am: string) => `${hand}- anilistId: 101350\n  title: "Pet"\n  platform: primevideo\n  dub: false\n  checkedAt: '${am}'\n`
  writeFileSync(belegDatei, neinPet('2026-10-16'))
  pruefe('Nein-Beleg in der Datei vom 16.10., Artikel vom 06.11.: Beleg wird angehängt', tun([PET]).belege.length === 1 && (yaml.load(readFileSync(belegDatei, 'utf8')) as unknown[]).length === 3)
  writeFileSync(belegDatei, neinPet('2026-11-06'))
  pruefe('Nein-Beleg in der Datei vom 06.11. (Artikeltag): kein Beleg', tun([PET]).belege.length === 0 && readFileSync(belegDatei, 'utf8') === neinPet('2026-11-06'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// --- Beleg als YAML mit Anführungszeichen im Zitat; Bericht -------------------------------------------------------------------------
const heikel = { ...lauf([PET]).belege[0]!, zitat: 'Er sagte: "Deutsche Synchronisation" – und \'mehr\': # kein Kommentar\\n' }
const zeilen = belegZeilen(heikel, '2026-11-07').join('\n')
const heikelGelesen = (yaml.load(zeilen) as { note: string }[])[0]!
pruefe('Zitat mit Anführungszeichen, Doppelpunkt, # und Backslash bleibt gültiges YAML', heikelGelesen.note.includes(heikel.zitat), heikelGelesen)
const bericht = belegBericht(anlass, '2026-11-07')
pruefe('Bericht nennt Zahl, Titel, Artikeladresse und Zitat', bericht.includes('2 Handbeleg(e)') && bericht.includes('Devils’ Crest (203275)') && bericht.includes(QUELLE) && bericht.includes(DC_ZITAT), bericht)

console.log(fehler ? `\n${fehler} von ${faelle} Fällen verletzt.` : `check-synchro-beleg-auswahl: ${faelle} Fälle ok (Anlass Devils’ Crest 203275, Gegenprobe Untertitel, Riegel ${HOECHSTENS_AM_TAG}/Tag).`)
process.exit(fehler ? 1 : 0)
