// Reine Teile der drei CR-Abrufskripte (fetch-cr-einzelwerke/-filmbloecke/-katalog): neue Funktionen gegen die
// wörtlich übernommenen alten Schleifen auf festen Eingaben, dazu Einzelfälle.
import assert from 'node:assert/strict'
import { katalogTrefferPasst } from './lib/cr-einzelwerk-urteil.ts'
import { kennwort } from './lib/cr-kennwort.ts'
import { normSchluessel } from './lib/util.ts'
import { audioVon, formeFund, offeneOhneSerienkennung, suchNamen, treffferInAntwort, zeichenVon, zusammenfassung } from './lib/cr-einzelwerke-lauf.ts'
import { blockTreffer, bloeckeAusAntwort, folgenTreffer, fuehreZusammen, offeneFilme, reiheVon, sammleSerienIds, zaehlzeilen } from './lib/cr-filmbloecke-lauf.ts'
import { katalogEintrag, offeneVerweise, ordneZu } from './lib/cr-katalog-lauf.ts'
import { zeichenVon as zeichenFilm } from './lib/cr-filmbloecke-lauf.ts'

type L = Record<string, any>
const gleich = (a: unknown, b: unknown, was: string) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), was)

const titles: L[] = [
  { id: 1, titleDe: 'Fruits Basket -prelude-', titleEn: 'Fruits Basket -prelude-', format: 'MOVIE', episodes: 1, streams: [{ platform: 'crunchyroll', url: 'u1' }] },
  { id: 2, titleDe: null, titleEn: 'Ride Your Wave', titleRomaji: 'Kimi to Nami', format: 'MOVIE', episodes: 1, jpYear: 2019, streams: [{ platform: 'crunchyroll', url: 'u2' }, { platform: 'netflix', url: 'n2' }] },
  { id: 3, titleDe: 'Serie TV', titleEn: 'Serie TV', format: 'TV', episodes: 12, streams: [{ platform: 'crunchyroll', url: 'u3' }] },
  { id: 4, titleDe: 'Mit Urteil', format: 'MOVIE', episodes: 1, streams: [{ platform: 'crunchyroll', url: 'u4', dub: true }] },
  { id: 5, titleDe: 'Mit Kennung', format: 'OVA', episodes: 2, streams: [{ platform: 'crunchyroll', url: 'u5' }] },
  { id: 6, titleDe: 'Ohne Streams', format: 'OVA' },
  { id: 7, titleDe: 'Ona Titel', format: 'ONA', episodes: 3, streams: [{ platform: 'crunchyroll', url: 'u7' }] },
]
const cr = { serien: [{ url: 'u5', seriesId: 'S5' }, { url: 'u3' }] }

// --- einzelwerke: alt (wörtlich) gegen neu
const nachUrl = new Map(cr.serien.map((s: L) => [s.url, s]))
const altEinzel: L[] = []
for (const x of titles) {
  for (const s of x.streams ?? []) {
    if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
    const serie = nachUrl.get(s.url)
    if (serie?.seriesId) continue
    altEinzel.push({ id: x.id, titel: x.titleDe ?? x.titleEn, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes, url: s.url })
  }
}
const offenE = offeneOhneSerienkennung(titles, cr)
gleich(offenE, altEinzel, 'einzelwerke: offene Verweise')
assert.deepStrictEqual(offenE.map((o) => o.id), [1, 2, 3, 7], 'einzelwerke: ids (Serie mit Kennung und Urteil fehlen)')
assert.deepStrictEqual(suchNamen({ titel: 'A', en: 'A', romaji: 'B' }), ['A', 'B'])
assert.deepStrictEqual(suchNamen({ titel: null, en: 'X' }), ['X'])

const antwortE: L = {
  data: [
    { type: 'series', items: [{ id: 'S1', type: 'series', title: 'Fruits Basket', series_metadata: { audio_locales: ['ja-JP'] } }] },
    {
      type: 'movie_listing',
      items: [
        { id: 'M1', type: 'movie_listing', title: '-prelude-', movie_listing_metadata: { audio_locales: ['ja-JP', 'de-DE'] } },
        { id: 'M2', type: 'movie_listing', title: 'Ride Your Wave', movie_listing_metadata: { audio_locale: 'de-DE' } },
      ],
    },
  ],
}
function altTreffer(r: L | null, namen: string[]): L | null {
  let treffer: L | null = null
  for (const gruppe of r?.data ?? []) {
    for (const it of gruppe.items ?? []) {
      const { passt, exakt } = katalogTrefferPasst(it, namen)
      if (!passt) continue
      treffer = { id: it.id, typ: gruppe.type ?? it.type, art: it.type, exakt, titel: it.title, meta: it.movie_listing_metadata ?? it.series_metadata ?? it.movie_metadata ?? {} }
      break
    }
    if (treffer) break
  }
  return treffer
}
for (const namen of [['Fruits Basket -prelude-'], ['Ride Your Wave'], ['Fruits Basket'], ['Unbekannt'], []]) {
  for (const r of [antwortE, null, { data: [] }, { data: [{ items: undefined }] }]) gleich(treffferInAntwort(r, namen), altTreffer(r, namen), `treffer ${namen}`)
}
const t1 = treffferInAntwort(antwortE, ['Fruits Basket -prelude-'])!
assert.equal(t1.id, 'M1', 'Teiltreffer gegen Film, nie gegen die Serie')
assert.equal(t1.exakt, false)
const t2 = treffferInAntwort(antwortE, ['Ride Your Wave'])!
assert.equal(t2.exakt, true)
assert.deepStrictEqual(audioVon(t2), ['de-DE'], 'audio_locale als Einzelwert')
assert.deepStrictEqual(audioVon(t1), ['ja-JP', 'de-DE'])
assert.deepStrictEqual(audioVon(null), [])
assert.deepStrictEqual(audioVon({ meta: {} }), [])
assert.equal(zeichenVon(t1), 'DE')
assert.equal(zeichenVon(null), '—')
assert.equal(zeichenVon({ meta: {} }), '?')
assert.equal(zeichenVon({ meta: { audio_locales: ['ja-JP', 'en-US'] } }), 'ja-JP,en-US')
assert.equal(zeichenVon({ meta: { audio_locales: ['ja-JP', 'en-US', 'fr-FR', 'es-ES', 'pt-BR'] } }), 'ja-JP,en-US,fr-FR,es-ES,'.slice(0, 24))
gleich(formeFund({ id: 1 }, t1), { id: 1, treffer: { id: 'M1', typ: 'movie_listing', art: 'movie_listing', exakt: false, titel: '-prelude-', audio: ['ja-JP', 'de-DE'] } }, 'formeFund')
gleich(formeFund({ id: 9 }, null), { id: 9, treffer: null }, 'formeFund ohne Treffer')
const fE = [formeFund({ id: 1 }, t1), formeFund({ id: 2 }, { ...t2, meta: { audio_locales: ['ja-JP'] } }), formeFund({ id: 3 }, { ...t2, meta: {} }), formeFund({ id: 4 }, null)]
const zs = zusammenfassung(fE)
assert.equal(zs.mitTreffer, 3)
assert.deepStrictEqual(zs.zeilen, ['\n3 von 4 im deutschen Katalog gefunden', '  mit de-DE: 1', '  ohne de-DE: 1'])

// --- filmbloecke
const nachUrlF = new Map(cr.serien.map((s: L) => [s.url, s]))
const altFilme: L[] = []
for (const x of titles) {
  for (const s of x.streams ?? []) {
    if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
    if (x.format === 'TV' || x.format === 'ONA') continue
    altFilme.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, jahr: x.jpYear, url: s.url, serie: nachUrlF.get(s.url) })
  }
}
const offenF = offeneFilme(titles, cr)
gleich(offenF, altFilme, 'filmbloecke: offene Filme')
assert.deepStrictEqual(offenF.map((o) => o.id), [1, 2, 5], 'TV/ONA und Urteil fehlen')
assert.equal(offenF[2].serie.seriesId, 'S5')
for (const o of [{ titel: 'Fairy Tail: The Movie - Phoenix Priestess' }, { en: 'Haikyu!! Movie 1 - Ende' }, { titel: 'Kiss-Shot' }, {}, { titel: 'A : B' }]) {
  assert.equal(reiheVon(o), (o.titel ?? o.en ?? '').split(/\s[-–—:]\s|\s*:\s*/)[0], 'reiheVon')
}
assert.equal(reiheVon({ titel: 'Fairy Tail: The Movie - Phoenix Priestess' }), 'Fairy Tail')

const serienAntwort: L = { data: [{ items: [{ id: 'A', title: 'Fairy Tail' }, { id: 'B', title: 'Fairy Tail Movies' }, { id: 'C', title: 'Anderes' }] }, { items: undefined }, {}] }
const ids = new Set<string>(['X'])
sammleSerienIds(ids, serienAntwort, 'Fairy Tail')
assert.deepStrictEqual([...ids], ['X', 'A', 'B'])
sammleSerienIds(ids, null, 'Fairy Tail')
assert.equal(ids.size, 3)

const bl = bloeckeAusAntwort({ data: [{ id: 'b1', title: 'Fairy Tail Movie 1 - Phoenix Priestess', audio_locales: ['ja-JP', 'de-DE'] }, { id: 'b2' }] })
gleich(bl, [{ id: 'b1', titel: 'Fairy Tail Movie 1 - Phoenix Priestess', audio: ['ja-JP', 'de-DE'] }, { id: 'b2', titel: '', audio: [] }], 'bloecke')
assert.deepStrictEqual(bloeckeAusAntwort(null), [])
function altBlock(sid: string, bloecke: L[], namen: string[]): L | null {
  let treffer: L | null = null
  for (const b of bloecke) {
    const bn = normSchluessel(b.titel)
    const passt = namen.some((n) => normSchluessel(n) === bn) || namen.some((n) => bn.includes(kennwort(n)) && kennwort(n).length >= 6)
    if (!passt) continue
    treffer = { serienId: sid, blockId: b.id, blockTitel: b.titel, audio: b.audio }
    break
  }
  return treffer
}
const blockeF = [...bl, { id: 'b3', titel: 'Fairy Tail Movie 2 - Dragon Cry', audio: ['de-DE'] }, { id: 'b4', titel: 'Teil 2', audio: [] }]
for (const namen of [['Fairy Tail: The Movie - Phoenix Priestess'], ['Fairy Tail Movie 2 - Dragon Cry'], ['Teil 2'], ['Film - Teil 2'], ['Nichts'], []]) {
  gleich(blockTreffer('S', blockeF, namen), altBlock('S', blockeF, namen), `block ${namen}`)
}
assert.equal(blockTreffer('S', blockeF, ['Fairy Tail: The Movie - Phoenix Priestess'])!.blockId, 'b1', 'Kennwort ≥ 6 Zeichen')
assert.equal(blockTreffer('S', blockeF, ['Teil 2'])!.blockId, 'b4', 'exakter Name')
assert.equal(blockTreffer('S', blockeF, ['Film - Teil 2']), null, 'Kennwort unter sechs Zeichen trifft nicht')

const items: L[] = [
  { id: 'e1', title: 'Uniform', episode_metadata: { series_title: 'TONIKAWA', series_id: 'T1', versions: [{ audio_locale: 'ja-JP' }, { audio_locale: 'de-DE' }, {}] } },
  { id: 'e2', title: 'Uniform', episode_metadata: { series_title: 'Andere Serie', versions: [{ audio_locale: 'de-DE' }] } },
  { id: 'e3', title: 'Uniform', episode_metadata: { series_title: 'TONIKAWA', versions: [] } },
]
function altFolge(its: L[], reihe: string, namen: string[]): L | null {
  let treffer: L | null = null
  for (const it of its) {
    const md = it.episode_metadata ?? {}
    const serieOk = normSchluessel(md.series_title ?? '').includes(normSchluessel(reihe)) || normSchluessel(reihe).includes(normSchluessel(md.series_title ?? ''))
    const kw = namen.map(kennwort).find((k) => k.length >= 6 && normSchluessel(it.title).includes(k))
    if (!serieOk || !kw) continue
    const versionen = (md.versions ?? []).map((v: L) => v.audio_locale).filter(Boolean)
    if (!versionen.length) continue
    treffer = { serienId: md.series_id ?? null, blockId: it.id, blockTitel: `Folge „${it.title}" in ${md.series_title}`, audio: versionen }
    break
  }
  return treffer
}
for (const reihe of ['TONIKAWA', 'Andere', 'Nichts', '']) {
  for (const namen of [['TONIKAWA: Over The Moon ~Uniform~'], ['Film - Uniform'], ['Kurz - Uni'], []]) {
    gleich(folgenTreffer(items, reihe, namen), altFolge(items, reihe, namen), `folge ${reihe} ${namen}`)
  }
}
gleich(folgenTreffer(items, 'TONIKAWA', ['Film - Uniform']), { serienId: 'T1', blockId: 'e1', blockTitel: 'Folge „Uniform" in TONIKAWA', audio: ['ja-JP', 'de-DE'] }, 'folge Soll')
assert.equal(folgenTreffer([items[2]], 'TONIKAWA', ['Film - Uniform']), null, 'ohne Versionen kein Treffer')
assert.equal(folgenTreffer([items[1]], 'TONIKAWA', ['Film - Uniform']), null, 'fremde Serie kein Treffer')
assert.equal(zeichenFilm(null), '—')
assert.equal(zeichenFilm({ audio: ['de-DE'] }), 'DE')
assert.equal(zeichenFilm({ audio: ['ja-JP'] }), 'kein DE')
assert.equal(zeichenFilm({ audio: [] }), '?')

function altZusammen(vorher: unknown, funde: L[]) {
  const zusammen = new Map<number, L>()
  for (const f of Array.isArray(vorher) ? vorher : []) if (f?.id != null) zusammen.set(f.id, f)
  let ersetzt = 0
  let neuDazu = 0
  let behalten = 0
  for (const f of funde) {
    if (f?.id == null) continue
    const alt = zusammen.get(f.id)
    if (alt?.treffer && !f.treffer) {
      behalten++
      continue
    }
    if (alt) ersetzt++
    else neuDazu++
    zusammen.set(f.id, f)
  }
  const gesamt = [...zusammen.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  return { gesamt, neuDazu, ersetzt, behalten }
}
const tr = { audio: ['de-DE'], blockTitel: 'x' }
const vorherF = [{ id: 30, treffer: tr, v: 'alt' }, { id: 10, treffer: null, v: 'alt' }, { id: 20, treffer: tr, v: 'alt' }, null, { treffer: tr }]
const fundeF = [{ id: 20, treffer: null, v: 'neu' }, { id: 10, treffer: tr, v: 'neu' }, { id: 30, treffer: { audio: [], blockTitel: 'y' }, v: 'neu' }, { id: 5, treffer: null, v: 'neu' }, { v: 'ohne id' }, null as any]
for (const vorher of [vorherF, [], null, { id: 1 }, undefined]) gleich(fuehreZusammen(vorher, fundeF), altZusammen(vorher, fundeF), 'zusammen')
const z = fuehreZusammen(vorherF, fundeF)
assert.deepStrictEqual([z.neuDazu, z.ersetzt, z.behalten], [1, 2, 1], 'Zähler neu/ersetzt/behalten')
assert.deepStrictEqual(z.gesamt.map((g) => [g.id, g.v]), [[5, 'neu'], [10, 'neu'], [20, 'alt'], [30, 'neu']], 'sortiert, Schweigen überschreibt keinen Treffer')
const zl = zaehlzeilen([{ treffer: { audio: ['de-DE'] } }, { treffer: { audio: ['ja-JP'] } }, { treffer: { audio: [] } }, { treffer: null }])
assert.equal(zl.mit, 3)
assert.deepStrictEqual(zl.zeilen, ['\n3 von 4 über einen eigenen Block gefunden', '  mit de-DE: 1', '  ohne de-DE: 1'])

// --- katalog
const md = { audio_locales: ['ja-JP', 'de-DE'], subtitle_locales: ['de-DE'], episode_count: 1, season_count: 1, movie_release_year: 2019 }
gleich(
  katalogEintrag({ id: 'K', title: 'T', slug_title: 'slug', description: 'x'.repeat(400), movie_listing_metadata: md }, 'movie_listing'),
  { id: 'K', typ: 'film', titel: 'T', slug: 'slug', beschreibung: 'x'.repeat(300), audio: ['ja-JP', 'de-DE'], untertitel: ['de-DE'], folgen: 1, staffeln: 1, jahr: 2019 },
  'katalogEintrag Film',
)
gleich(
  katalogEintrag({ id: 'S', title: 'Serie', series_metadata: { audio_locale: 'ja-JP', series_launch_year: 2001, episode_count: 0 } }, ''),
  { id: 'S', typ: 'serie', titel: 'Serie', slug: null, beschreibung: '', audio: ['ja-JP'], untertitel: [], folgen: 0, staffeln: null, jahr: 2001 },
  'katalogEintrag Serie',
)
gleich(katalogEintrag({ id: 'Z', title: 'Z' }, ''), { id: 'Z', typ: 'serie', titel: 'Z', slug: null, beschreibung: '', audio: [], untertitel: [], folgen: null, staffeln: null, jahr: null }, 'katalogEintrag leer')

const altOffen: L[] = []
for (const x of titles) {
  for (const s of x.streams ?? []) {
    if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
    altOffen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes })
  }
}
gleich(offeneVerweise(titles), altOffen, 'katalog: offene Verweise')
assert.deepStrictEqual(offeneVerweise(titles).map((o) => o.id), [1, 2, 3, 5, 7])

function altZuordnung(offen: L[], alle: L[]): L[] {
  const zuordnung: L[] = []
  for (const o of offen) {
    const namen = [o.titel, o.en, o.romaji].filter(Boolean).map(normSchluessel)
    const kandidaten = alle
      .map((k) => {
        const kn = normSchluessel(k.titel)
        const exakt = namen.includes(kn)
        const teil = kn.length >= 6 && !exakt && namen.some((n) => n.includes(kn))
        if (!exakt && !teil) return null
        const folgenPasst = (o.folgen && k.folgen === o.folgen) || (o.format === 'MOVIE' && o.folgen === 1 && (k.folgen === 0 || k.folgen === 1))
        if (!folgenPasst) return null
        return { ...k, punkte: exakt ? 5 : 3, art: exakt ? 'Name exakt' : 'Katalogtitel steckt in unserem' }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.punkte - a.punkte)
    const [a, b] = kandidaten as L[]
    if (!a || (b && b.punkte === a.punkte)) continue
    zuordnung.push({ id: o.id, unser: o.titel ?? o.en, katalogId: a.id, katalogTitel: a.titel, audio: a.audio, art: a.art, folgen: a.folgen })
  }
  return zuordnung
}
const katalog: L[] = [
  { id: 'k1', titel: '-prelude-', audio: ['de-DE'], folgen: 1 },
  { id: 'k2', titel: 'Ride Your Wave', audio: ['ja-JP'], folgen: 0 },
  { id: 'k3', titel: 'Fruits Basket', audio: ['de-DE'], folgen: 63 },
  { id: 'k4', titel: 'Serie TV', audio: ['de-DE'], folgen: 12 },
  { id: 'k5', titel: 'Serie TV', audio: ['en-US'], folgen: 12 },
  { id: 'k6', titel: 'Mit Kennung', audio: ['de-DE'], folgen: 2 },
  { id: 'k7', titel: 'Kurz', audio: [], folgen: 3 },
]
const offenK = [...offeneVerweise(titles), { id: 8, titel: 'Fruits Basket -prelude-', format: 'MOVIE', folgen: 1 }, { id: 9, titel: 'Ona Titel Plus', format: 'ONA', folgen: 3 }, { id: 10, titel: 'Fruits Basket', folgen: null }]
gleich(ordneZu(offenK, katalog), altZuordnung(offenK, katalog), 'katalog: Zuordnung')
const zu = ordneZu(offenK, katalog)
const zid = (id: number) => zu.find((x) => x.id === id)
assert.equal(zid(1)?.katalogId, 'k1', 'Name steckt in unserem, Film mit einer Folge')
assert.equal(zid(1)?.art, 'Katalogtitel steckt in unserem')
assert.equal(zid(2)?.katalogId, 'k2', 'Film mit 0 Folgen im Katalog, exakter Name')
assert.equal(zid(2)?.art, 'Name exakt')
assert.equal(zid(3), undefined, 'zwei gleich gute Treffer: keine Zuordnung')
assert.equal(zid(5)?.katalogId, 'k6')
assert.equal(zid(7), undefined, 'Folgenzahl passt nicht zum kurzen Namen')
assert.equal(zid(10), undefined, 'ohne Folgenzahl nichts')
assert.equal(zid(8)?.katalogId, 'k1')

console.log('✔ check-cr-fetch-lauf: 3 Lib-Dateien, alt gegen neu auf festen Eingaben gleich (Einzelwerke, Filmblöcke, Katalog)')
