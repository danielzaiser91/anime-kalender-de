/**
 * Zusicherung: die ausgelagerte Logik der Crunchyroll-Abrufskripte (`lib/cr-abruf-logik.ts`) liefert feste Werte.
 * Kleine Fixtures, keine Abrufe. Die Gleichheit zur alten Skript-Logik wurde am echten Bestand gemessen (PR-Text).
 */
import { readFileSync } from 'node:fs'
import {
  audioVon,
  einzelwerkFund,
  episodenTreffer,
  ersterEinzelwerkTreffer,
  filmbloeckeZusammen,
  katalogEintrag,
  katalogZuordnung,
  offeneFilmbloecke,
  offeneOhneSerienkennung,
  offeneOhneUrteil,
  passenderBlock,
  reiheVon,
  serienIdsAusSuche,
} from './lib/cr-abruf-logik.ts'

let fehler = 0
let faelle = 0
function gleich(name: string, ist: unknown, soll: unknown): void {
  faelle++
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}, erwartet: ${JSON.stringify(soll)}`)
}

const cr = { serien: [{ url: 'u/mit', seriesId: 'S1' }, { url: 'u/ohne' }] }
const stream = (url: string, extra = {}) => ({ platform: 'crunchyroll', url, ...extra })
const titles = [
  { id: 1, titleDe: 'A', titleEn: 'AE', format: 'MOVIE', episodes: 1, jpYear: 2019, streams: [stream('u/mit')] },
  { id: 2, titleEn: 'B', format: 'OVA', episodes: 2, streams: [stream('u/ohne'), { platform: 'netflix', url: 'n' }] },
  { id: 3, titleDe: 'C', format: 'TV', streams: [stream('u/neu')] },
  { id: 4, titleDe: 'D', format: 'ONA', streams: [stream('u/x', { dub: false })] },
]

console.log('audioVon')
gleich('Liste vor Einzelwert', audioVon({ audio_locales: ['a'], audio_locale: 'b' }), ['a'])
gleich('Einzelwert', audioVon({ audio_locale: 'b' }), ['b'])
gleich('leer', audioVon({}), [])

console.log('offene Listen')
gleich('ohne Serienkennung: Weg mit seriesId fällt weg, Titel fällt auf titleEn zurück', offeneOhneSerienkennung(titles, cr), [
  { id: 2, titel: 'B', en: 'B', romaji: undefined, format: 'OVA', folgen: 2, url: 'u/ohne' },
  { id: 3, titel: 'C', en: undefined, romaji: undefined, format: 'TV', folgen: undefined, url: 'u/neu' },
])
gleich('ohne Urteil: dub gesetzt und fremde Plattform fallen weg', offeneOhneUrteil(titles).map((o) => o.id), [1, 2, 3])
gleich('Filmblöcke: TV und ONA fallen weg, Serienzeile hängt dran', offeneFilmbloecke(titles, cr).map((o) => [o.id, o.serie?.seriesId ?? null, o.jahr ?? null]), [[1, 'S1', 2019], [2, null, null]])

console.log('Einzelwerk-Treffer')
const gruppen = [
  { type: 'series', items: [{ id: 's', title: 'Fruits Basket', type: 'series', series_metadata: { audio_locales: ['ja-JP'] } }] },
  { type: 'movie_listing', items: [{ id: 'm', title: '-prelude-', type: 'movie_listing', movie_listing_metadata: { audio_locale: 'de-DE' } }] },
]
const treffer = ersterEinzelwerkTreffer(gruppen, ['Fruits Basket -prelude-'])
gleich('Teiltreffer gegen Film, Serie wird übersprungen', treffer && [treffer.id, treffer.typ, treffer.art, treffer.exakt], ['m', 'movie_listing', 'movie_listing', false])
gleich('kein Treffer', ersterEinzelwerkTreffer(gruppen, ['Etwas Anderes']), null)
gleich('keine Antwort', ersterEinzelwerkTreffer(undefined as never, ['x']), null)
gleich('Fund mit Treffer trägt audio', einzelwerkFund({ id: 7 }, treffer), { id: 7, treffer: { id: 'm', typ: 'movie_listing', art: 'movie_listing', exakt: false, titel: '-prelude-', audio: ['de-DE'] } })
gleich('Fund ohne Treffer', einzelwerkFund({ id: 7 }, null), { id: 7, treffer: null })

console.log('Katalog')
const roh = { id: 'k', title: 'T', slug_title: 'sl', description: 'x'.repeat(400), movie_listing_metadata: { audio_locale: 'de-DE', movie_release_year: '2019' } }
const eintrag = katalogEintrag(roh, 'movie_listing')
gleich('Eintrag Film', [eintrag.typ, eintrag.slug, eintrag.beschreibung.length, eintrag.audio, eintrag.jahr, eintrag.folgen], ['film', 'sl', 300, ['de-DE'], '2019', null])
gleich('Eintrag Serie', [katalogEintrag({ id: 'k', title: 'T', series_metadata: { episode_count: 12, season_count: 2, series_launch_year: 2020 } }, '').typ], ['serie'])
const kat = [
  { id: 'a', titel: 'One-Punch Man', folgen: 12, audio: ['de-DE'] },
  { id: 'b', titel: '-prelude-', folgen: 1, audio: ['de-DE'] },
  { id: 'c', titel: 'Doppelt', folgen: 3, audio: [] },
  { id: 'd', titel: 'Doppelt', folgen: 3, audio: [] },
]
const offen = [
  { id: 1, titel: 'One Punch Man OVAs', folgen: 6, format: 'OVA' },
  { id: 2, en: 'Fruits Basket -prelude-', folgen: 1, format: 'MOVIE' },
  { id: 3, titel: 'Doppelt', folgen: 3 },
  { id: 4, titel: 'One Punch Man', folgen: 12 },
]
gleich('Zuordnung: Folgenzahl sperrt, Gleichstand sperrt, Teiltreffer und exakter Name ordnen zu', katalogZuordnung(offen, kat), [
  { id: 2, unser: 'Fruits Basket -prelude-', katalogId: 'b', katalogTitel: '-prelude-', audio: ['de-DE'], art: 'Katalogtitel steckt in unserem', folgen: 1 },
  { id: 4, unser: 'One Punch Man', katalogId: 'a', katalogTitel: 'One-Punch Man', audio: ['de-DE'], art: 'Name exakt', folgen: 12 },
])

console.log('Filmblöcke')
gleich('Reihe vor dem Doppelpunkt', reiheVon({ titel: 'Tonikawa: Over The Moon' }), 'Tonikawa')
gleich('Reihe fällt auf en zurück', reiheVon({ en: 'Free! - The Movie' }), 'Free!')
const suche = { data: [{ items: [{ id: 'x', title: 'Tonikawa' }, { id: 'y', title: 'Anderes' }] }] }
gleich('Serien-IDs nach Reihe', serienIdsAusSuche(suche, 'Tonikawa'), ['x'])
gleich('Serien-IDs ohne Antwort', serienIdsAusSuche(null, 'Tonikawa'), [])
const bloecke = [{ id: 'b1', titel: 'Staffel 1', audio: ['ja-JP'] }, { id: 'b2', titel: 'Genocidal Organ', audio: ['de-DE'] }]
gleich('Block über exakten Namen', passenderBlock(bloecke, ['Genocidal Organ'], 'S'), { serienId: 'S', blockId: 'b2', blockTitel: 'Genocidal Organ', audio: ['de-DE'] })
gleich('Block über Kennwort', passenderBlock(bloecke, ['Project Itoh: Genocidal Organ'], 'S')?.blockId, 'b2')
gleich('Kennwort unter sechs Zeichen sperrt', passenderBlock([{ id: 'z', titel: 'Movie', audio: [] }], ['Free: Movie'], 'S'), null)
const ep = (extra = {}) => ({ id: 'e', title: 'Uniform Special', episode_metadata: { series_title: 'TONIKAWA', series_id: 'T', versions: [{ audio_locale: 'de-DE' }, {}], ...extra } })
gleich('Episode: Serienname und Kennwort', episodenTreffer({ data: [{ items: [ep()] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), { serienId: 'T', blockId: 'e', blockTitel: 'Folge „Uniform Special" in TONIKAWA', audio: ['de-DE'] })
gleich('Episode: falsche Serie', episodenTreffer({ data: [{ items: [ep({ series_title: 'Anderes' })] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), null)
gleich('Episode: Kennwort fehlt', episodenTreffer({ data: [{ items: [ep()] }] }, ['Tonikawa: Dress'], 'Tonikawa'), null)
gleich('Episode: ohne Fassungen', episodenTreffer({ data: [{ items: [ep({ versions: [] })] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), null)

console.log('Zusammenführen')
const alt = [{ id: 2, treffer: { audio: ['a'] } }, { id: 1, treffer: null }, { id: 5, treffer: { audio: ['alt'] } }, { id: null }]
const funde = [{ id: 1, treffer: { audio: ['n'] } }, { id: 2, treffer: null }, { id: 3, treffer: { audio: ['neu'] } }, { id: 5, treffer: { audio: ['neu5'] } }, { treffer: null }]
const z = filmbloeckeZusammen(alt, funde)
gleich('Zähler', [z.neuDazu, z.ersetzt, z.behalten], [1, 2, 1])
gleich('Schweigen behält alten Treffer, sortiert nach id', z.gesamt.map((f) => [f.id, f.treffer?.audio?.[0] ?? null]), [[1, 'n'], [2, 'a'], [3, 'neu'], [5, 'neu5']])
gleich('Vorher kein Array', filmbloeckeZusammen({}, [{ id: 1, treffer: null }]).gesamt.length, 1)

function grenzenListen(): void {
  const t = [
    { id: 1, titleDe: 'A', titleEn: 'AE', titleRomaji: 'Ar', format: 'MOVIE', episodes: 1, jpYear: 2019, streams: [stream('u/ohne')] },
    { id: 2, titleDe: 'B', format: 'OVA', episodes: 2, streams: [stream('u/ohne', { dub: false })] },
    { id: 3, titleDe: 'C', format: 'ONA', streams: [stream('u/ohne')] },
    { id: 4, titleDe: 'D', format: 'TV', streams: [stream('u/ohne')] },
    { id: 5, titleDe: 'E', format: 'SPECIAL', streams: [stream('u/ohne', { dub: false })] },
  ]
  gleich('ohne Urteil: ganze Objekte (folgen, romaji)', offeneOhneUrteil(t), [
    { id: 1, titel: 'A', en: 'AE', romaji: 'Ar', format: 'MOVIE', folgen: 1 },
    { id: 3, titel: 'C', en: undefined, romaji: undefined, format: 'ONA', folgen: undefined },
    { id: 4, titel: 'D', en: undefined, romaji: undefined, format: 'TV', folgen: undefined },
  ])
  gleich('Filmblöcke: ONA und TV getrennt ausgeschlossen, dub false fällt weg, ganzes Objekt', offeneFilmbloecke(t, cr), [
    { id: 1, titel: 'A', en: 'AE', romaji: 'Ar', format: 'MOVIE', jahr: 2019, url: 'u/ohne', serie: cr.serien[1] },
  ])
  const nurOna = [{ id: 3, format: 'ONA', streams: [stream('u/x')] }]
  const nurTv = [{ id: 4, format: 'TV', streams: [stream('u/x')] }]
  gleich('Filmblöcke: ONA allein fällt weg', offeneFilmbloecke(nurOna, cr), [])
  gleich('Filmblöcke: TV allein fällt weg', offeneFilmbloecke(nurTv, cr), [])
}

function grenzenTreffer(): void {
  const mit = (it: object, gruppeTyp?: string) => [{ ...(gruppeTyp ? { type: gruppeTyp } : {}), items: [{ id: 'e', title: 'Zeug', ...it }] }]
  const t1 = ersterEinzelwerkTreffer(mit({ type: 'movie', series_metadata: { audio_locales: ['de-DE'] } }, 'movie_listing'), ['Zeug'])
  gleich('Gruppentyp und Eintragstyp verschieden, exakter Name', t1 && [t1.typ, t1.art, t1.exakt, t1.meta], ['movie_listing', 'movie', true, { audio_locales: ['de-DE'] }])
  const t2 = ersterEinzelwerkTreffer(mit({ type: 'movie_listing' }), ['Zeug'])
  gleich('Gruppe ohne type: Eintragstyp springt ein, ohne Metadaten leer', t2 && [t2.typ, t2.art, t2.meta], ['movie_listing', 'movie_listing', {}])
  const audioMit = (md: object) => ersterEinzelwerkTreffer(mit({ type: 'movie', ...md }, 'g'), ['Zeug'])?.meta.audio_locale
  const alle3 = { movie_listing_metadata: { audio_locale: 'a' }, series_metadata: { audio_locale: 'b' }, movie_metadata: { audio_locale: 'c' } }
  gleich('Metadaten: Filmliste vor Serie vor Film', audioMit(alle3), 'a')
  gleich('Metadaten: Serie vor Film', audioMit({ series_metadata: alle3.series_metadata, movie_metadata: alle3.movie_metadata }), 'b')
  gleich('Metadaten: nur Film', audioMit({ movie_metadata: alle3.movie_metadata }), 'c')
  const ohneItems = [{ type: 'leer' }, ...mit({ type: 'movie' }, 'g')]
  gleich('Gruppe ohne items wird übersprungen', ersterEinzelwerkTreffer(ohneItems, ['Zeug'])?.id, 'e')
  const roh = { id: 'i', typ: 'T', art: 'A', exakt: true, titel: 't', meta: { audio_locales: ['de-DE'] } }
  gleich('Fund trägt typ und art getrennt', einzelwerkFund({ id: 7 }, roh), { id: 7, treffer: { id: 'i', typ: 'T', art: 'A', exakt: true, titel: 't', audio: ['de-DE'] } })
}

function grenzenKatalog(): void {
  const serie = { id: 's', title: 'S', slug_title: 'sl', description: 'd', series_metadata: { audio_locales: ['de-DE', 'ja-JP'], subtitle_locales: ['en-US'], episode_count: 12, season_count: 2, series_launch_year: 2020 } }
  gleich('Serie: alle Felder', katalogEintrag(serie, ''), { id: 's', typ: 'serie', titel: 'S', slug: 'sl', beschreibung: 'd', audio: ['de-DE', 'ja-JP'], untertitel: ['en-US'], folgen: 12, staffeln: 2, jahr: 2020 })
  const film = { id: 'f', title: 'F', movie_listing_metadata: { audio_locale: 'de-DE', subtitle_locales: ['fr-FR'], episode_count: 1, season_count: 1, movie_release_year: 2019 } }
  gleich('Film: nur Film-Metadaten, alle Felder', katalogEintrag(film, 'movie_listing'), { id: 'f', typ: 'film', titel: 'F', slug: null, beschreibung: '', audio: ['de-DE'], untertitel: ['fr-FR'], folgen: 1, staffeln: 1, jahr: 2019 })
  const beide = { ...film, series_metadata: { audio_locale: 'ja-JP', series_launch_year: 1999 } }
  gleich('Film- vor Serien-Metadaten, Startjahr vor Erscheinungsjahr', [katalogEintrag(beide, 'movie_listing').audio, katalogEintrag({ id: 'x', series_metadata: { series_launch_year: 1, movie_release_year: 2 } }, '').jahr], [['de-DE'], 1])
  gleich('ohne Metadaten: Voreinstellungen', katalogEintrag({ id: 'n', title: 'N' }, ''), { id: 'n', typ: 'serie', titel: 'N', slug: null, beschreibung: '', audio: [], untertitel: [], folgen: null, staffeln: null, jahr: null })
}

function grenzenZuordnung(): void {
  const zu = (offen: object, kat: object[]) => katalogZuordnung([{ id: 1, ...offen }], kat).map((z) => z.katalogId)
  const k = (id: string, titel: string, folgen?: number | null) => ({ id, titel, folgen, audio: [] })
  gleich('Teiltreffer: Katalogtitel mit 6 Zeichen ordnet zu', zu({ titel: 'Abcdef Movie', folgen: 3 }, [k('a', 'Abcdef', 3)]), ['a'])
  gleich('Teiltreffer: Katalogtitel mit 7 Zeichen ordnet zu', zu({ titel: 'Abcdefg Movie', folgen: 3 }, [k('a', 'Abcdefg', 3)]), ['a'])
  gleich('Teiltreffer: Katalogtitel mit 5 Zeichen sperrt', zu({ titel: 'Abcde Movie', folgen: 3 }, [k('a', 'Abcde', 3)]), [])
  gleich('Name nur über Romaji', zu({ romaji: 'Nur Romaji', folgen: 2 }, [k('a', 'Nur Romaji', 2)]), ['a'])
  gleich('Name nur über en', zu({ en: 'Nur En', folgen: 2 }, [k('a', 'Nur En', 2)]), ['a'])
  gleich('fehlende Namen werden nicht zum leeren Namen', zu({ titel: 'Anders', folgen: 2 }, [k('a', '???', 2)]), [])
  gleich('ohne Folgenzahl keine Zuordnung, auch wenn der Katalog keine hat', zu({ titel: 'Gleich' }, [k('a', 'Gleich')]), [])
  gleich('Film mit 1 Folge passt auf Katalog mit 0 Folgen', zu({ titel: 'Film', format: 'MOVIE', folgen: 1 }, [k('a', 'Film', 0)]), ['a'])
  gleich('Film mit 1 Folge passt auf Katalog mit 1 Folge', zu({ titel: 'Film', format: 'MOVIE', folgen: 1 }, [k('a', 'Film', 1)]), ['a'])
  gleich('OVA mit 1 Folge passt nicht auf Katalog mit 0 Folgen', zu({ titel: 'Film', format: 'OVA', folgen: 1 }, [k('a', 'Film', 0)]), [])
  gleich('Film mit 5 Folgen passt nicht auf Katalog mit 0 oder 1 Folge', zu({ titel: 'Film', format: 'MOVIE', folgen: 5 }, [k('a', 'Film', 0), k('b', 'Film', 1)]), [])
  const teil = k('t', 'Abcdef', 4)
  const exakt = k('x', 'Abcdef Movie', 4)
  gleich('exakter Name schlägt Teiltreffer, Teiltreffer zuerst im Katalog', zu({ titel: 'Abcdef Movie', folgen: 4 }, [teil, exakt]), ['x'])
  gleich('exakter Name schlägt Teiltreffer, exakter zuerst im Katalog', zu({ titel: 'Abcdef Movie', folgen: 4 }, [exakt, teil]), ['x'])
  gleich('zwei Teiltreffer gleich viele Punkte: keine Zuordnung', zu({ titel: 'Abcdef Movie', folgen: 4 }, [teil, k('u', 'Abcdef', 4)]), [])
  gleich('zwei exakte Treffer: keine Zuordnung', zu({ titel: 'Abcdef Movie', folgen: 4 }, [exakt, { ...exakt, id: 'y' }]), [])
  const tn = katalogZuordnung([{ id: 1, titel: 'Abcdef Movie', folgen: 4 }], [teil])
  gleich('Teiltreffer trägt Art und bleibt allein zugeordnet', tn.map((z) => z.art), ['Katalogtitel steckt in unserem'])
}

function grenzenFilmbloecke(): void {
  const ant = { data: [{ items: [{ id: 'x', title: 'Tonikawa: Over The Moon' }, { id: 'y', title: 'Toni' }] }, { type: 'ohne items' }] }
  gleich('Serien-IDs: längerer Katalogtitel enthält die Reihe, kürzerer nicht, Gruppe ohne items', serienIdsAusSuche(ant, 'Tonikawa'), ['x'])
  const bl = (titel: string) => [{ id: 'b', titel, audio: [] }]
  gleich('Block über exakten Namen ohne Kennwort (kurz)', passenderBlock(bl('Free'), ['Free'], 'S')?.blockId, 'b')
  gleich('Block über exakten Namen mit Trenner (Kennwort kurz)', passenderBlock(bl('Free: Movie'), ['Free: Movie'], 'S')?.blockId, 'b')
  gleich('Kennwort mit 6 Zeichen passt', passenderBlock(bl('Abcdef'), ['Reihe: Abcdef'], 'S')?.blockId, 'b')
  gleich('Kennwort mit 7 Zeichen passt', passenderBlock(bl('Abcdefg'), ['Reihe: Abcdefg'], 'S')?.blockId, 'b')
  gleich('Kennwort mit 5 Zeichen sperrt', passenderBlock(bl('Abcde'), ['Reihe: Abcde'], 'S'), null)
  const e = (st: string, titel = 'Uniform Special') => ({ data: [{ items: [{ id: 'e', title: titel, episode_metadata: { series_title: st, series_id: 'T', versions: [{ audio_locale: 'de-DE' }] } }] }] })
  const id = (a: object, namen: string[], reihe: string) => episodenTreffer(a, namen, reihe)?.blockId
  gleich('Episode: Serienname länger als die Reihe', id(e('TONIKAWA Over the Moon'), ['Tonikawa: Uniform'], 'Tonikawa'), 'e')
  gleich('Episode: Serienname kürzer als die Reihe', id(e('Toni'), ['Tonikawa: Uniform'], 'Tonikawa'), 'e')
  gleich('Episode: Serienname ohne Bezug zur Reihe', id(e('Anders'), ['Tonikawa: Uniform'], 'Tonikawa'), undefined)
  gleich('Episode: Kennwort mit 6 Zeichen passt', id(e('Tonikawa'), ['Tonikawa: Unifor'], 'Tonikawa'), 'e')
  gleich('Episode: Kennwort mit 3 Zeichen sperrt', id(e('Tonikawa'), ['Tonikawa: Uni'], 'Tonikawa'), undefined)
  gleich('Episode: Kennwort mit 5 Zeichen sperrt', id(e('Tonikawa'), ['Tonikawa: Unifo'], 'Tonikawa'), undefined)
}

function grenzenZusammen(): void {
  const r = filmbloeckeZusammen([{ id: 9, treffer: null, x: 'alt' }], [{ id: 9, treffer: null, x: 'neu' }])
  gleich('alter und neuer Eintrag ohne Treffer: ersetzt, nicht behalten', [r.ersetzt, r.behalten, r.neuDazu, r.gesamt.map((f) => f.x)], [1, 0, 0, ['neu']])
  const s = filmbloeckeZusammen([{ id: 1, treffer: { a: 1 } }], [null as never, { id: 2, treffer: null }])
  gleich('leerer Fund (null) wird übersprungen', [s.neuDazu, s.gesamt.map((f) => f.id)], [1, [1, 2]])
}

/** Verdrahtung: jeder Aufrufer ruft die Logik mit den richtigen Argumenten (Kommentare zählen nicht). */
function aufruferPruefen(): void {
  const text = (datei: string) => readFileSync(new URL(`./${datei}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  const soll: Record<string, string[]> = {
    'fetch-cr-einzelwerke.mjs': ['const offen = offeneOhneSerienkennung(titles, cr)', 'treffer = ersterEinzelwerkTreffer(r?.data, namen)', 'const fund = einzelwerkFund(o, treffer)'],
    'fetch-cr-katalog.mjs': ['for (const it of seite) alle.push(katalogEintrag(it, typ))', 'const offen = offeneOhneUrteil(titles)', 'const zuordnung = katalogZuordnung(offen, alle)'],
    'fetch-cr-filmbloecke.mjs': [
      'const offen = offeneFilmbloecke(titles, cr)',
      'const reihe = reiheVon(o)',
      'serienIdsAusSuche(s, reihe)',
      'treffer = passenderBlock(await bloeckeVon(sid), namen, sid)',
      'treffer = episodenTreffer(s2, namen, reihe)',
      '= filmbloeckeZusammen(vorher, funde)',
    ],
  }
  for (const [datei, aufrufe] of Object.entries(soll)) {
    const t = text(datei)
    for (const a of aufrufe) gleich(`${datei}: ${a}`, t.includes(a), true)
  }
}

console.log('Grenzen und Zweige')
grenzenListen()
grenzenTreffer()
grenzenKatalog()
grenzenZuordnung()
grenzenFilmbloecke()
grenzenZusammen()

console.log('Aufrufer')
aufruferPruefen()

if (fehler) {
  console.error(`check-cr-abruf-logik: ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`check-cr-abruf-logik: ${faelle} Fälle (Listen, Einzelwerk-Treffer, Katalog, Zuordnung, Filmblöcke, Zusammenführen, Aufrufer) ok`)
