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
import { belegZeilen, HOECHSTENS_AM_TAG, IMMER, nenntSynchro, ordneTitelZu, waehleSynchroBelege, type Belegstand, type KatalogTitel } from './lib/synchro-beleg-auswahl.ts'

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
const PET_NETFLIX = mit(PET, { plattform: 'netflix' })
pruefe('Plattform netflix: Beleg trägt netflix, ein Ja bei primevideo sperrt nicht', lauf([PET_NETFLIX], NETFLIX_PET, new Map([['101350|primevideo', IMMER]])).belege[0]?.plattform === 'netflix')
pruefe('Plattform netflix: ein Ja bei netflix sperrt', ids(lauf([PET_NETFLIX], NETFLIX_PET, new Map([['101350|netflix', IMMER]]))) === '')
pruefe('Beleg-Zeilen tragen die Plattform des Belegs', belegZeilen(lauf([PET_NETFLIX], NETFLIX_PET).belege[0]!, '2026-11-07').includes('  platform: netflix'))

// --- Stufe 3: Weg und Handbelege ---------------------------------------------------------------------------------------------------
const mitWegen = (...streams: { platform: string; dub?: boolean }[]) => [{ ...PET_TITEL, streams }]
pruefe('Kein Weg bei der Plattform (nur Netflix): zurückgestellt', grund(lauf([PET], mitWegen(weg('netflix')))) === 'kein Weg bei primevideo')
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
