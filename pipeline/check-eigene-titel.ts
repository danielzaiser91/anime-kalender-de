/**
 * **Prüfung: Eigene Titel aus belegter Ankündigung** (`data/eigene-titel.yaml`, Bau-Modul `bau/eigene-titel.ts`, 04.11.2026).
 * Läuft den echten Bau (`baueTitel`) und `releasesAus` gegen einen Wegwerf-Ordner (`AK_ROOT`): der Titel entsteht aus der Handzeile,
 * die Meldung findet ihn unter seinem Namen, ein Titel mit ähnlichem Namen (die Serie „Z wie Zorro“) bekommt den Termin des Films nicht.
 * Dazu: Kennungsraum, Zeilenprüfung, Wächter „Katalog führt jetzt X“, Umhängen über `zuId`/`zuAk`.
 *
 * Aufruf: npx tsx pipeline/check-eigene-titel.ts
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, Title } from '../shared/types.ts'
import { Quellenuebersicht } from '../web/src/components/Quellenuebersicht.tsx'
import type { AniListMedia } from './lib/anilist.ts'

const bauOrdner = mkdtempSync(join(tmpdir(), 'eigene-titel-'))
mkdirSync(join(bauOrdner, 'data', 'curated'), { recursive: true })
for (const datei of ['ohne-synchro-von-hand.yaml', 'kino-ankuendigungen.yaml', 'fanservice-urteil.yaml']) copyFileSync(join(import.meta.dirname, '..', 'data', datei), join(bauOrdner, 'data', datei))
writeFileSync(join(bauOrdner, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
process.env.AK_ROOT = bauOrdner
const { EIGENE_ID_BASIS, EIGENE_ID_ENDE, istEigenerTitel } = await import('../shared/eigene-titel.ts')
const { ladeEigeneTitel, ergaenzeEigeneTitel, katalogFuehrtJetzt, eigeneId } = await import('./bau/eigene-titel.ts')
const { begrenzeWegeAufBelege } = await import('./bau/wege-begrenzen.ts')
const { haengeEigeneUm, setzeEigeneZuAk, schreibeEigeneZuAk } = await import('./bau/eigene-titel-umhaengen.ts')
const { ergaenzeWegeAusTmdbUndMotn } = await import('./bau/13-3-1-tmdb-wege.ts')
const { offeneTitel } = await import('./fetch-anisearch-katalog-abgleich.ts')
const { pruefeAufrufAnweisung, pruefeBindung } = await import('./lib/eigene-titel-verdrahtung.ts')
const { kernOhneCover } = await import('./lib/kern-ohne-cover.ts')
const { baueTitel } = await import('./bau/02-titel.ts')
const { schreibeNeuMitSynchro } = await import('./bau/nebendateien.ts')
const { releasesAus } = await import('./lib/meldungen.ts')
const { vorschlaegeAusSammelartikel } = await import('./lib/sammelartikel.ts')

let fehler = 0
let faelle = 0
const pruefe = (bedingung: boolean, text: string) => {
  faelle++
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const wirft = (f: () => unknown, teil: string): boolean => {
  try {
    f()
    return false
  } catch (e) {
    return String((e as Error).message).includes(teil)
  }
}
const schreibeDatei = (zeilen: string[]) => writeFileSync(join(bauOrdner, 'data', 'eigene-titel.yaml'), zeilen.join('\n'))
const zeile = (nr: number, name: string, extra: string[] = []) => [
  `- nr: ${nr}`, `  name: ${name}`, '  format: MOVIE', '  anbieter: [joyn, primevideo]', '  tag: 2999-01-02',
  '  sources: [https://example.org/artikel]', '  zitat: "Fixture-Zitat"', ...extra,
]
const ID_FILM = EIGENE_ID_BASIS + 910001
const ID_GEHEIMNIS = EIGENE_ID_BASIS + 910002
const ID_MASK = EIGENE_ID_BASIS + 910003

console.log('Kennungsraum')
pruefe(EIGENE_ID_BASIS === 5_000_000 && EIGENE_ID_ENDE === 6_000_000, 'Raum 5 bis unter 6 Mio.')
pruefe(!istEigenerTitel(4_999_999) && istEigenerTitel(5_000_000) && istEigenerTitel(5_999_999) && !istEigenerTitel(6_000_000) && !istEigenerTitel(9_000_051) && !istEigenerTitel(10_000_000), 'eigener Titel: ab 5 Mio. bis unter 6 Mio. (Testkennungen 9.000.0xx und die aniSearch-Basis 10 Mio. zählen nicht)')
pruefe(!istEigenerTitel(-314271) && !istEigenerTitel(220_000), 'Cartoon (negativ) und AniList-Kennung sind keine eigenen Titel')
pruefe(eigeneId(7) === 5_000_007, 'Kennung = Basis + nr')

console.log('Handdatei prüfen')
{
  pruefe(ladeEigeneTitel(bauOrdner).length === 0, 'ohne Datei: keine Zeilen, kein Fehler')
  schreibeDatei(zeile(910001, 'Fixture Eins'))
  const ein = ladeEigeneTitel(bauOrdner)
  pruefe(ein.length === 1 && ein[0]!.name === 'Fixture Eins' && ein[0]!.nr === 910001 && ein[0]!.sources[0] === 'https://example.org/artikel', 'gültige Zeile wird gelesen')
  const kaputt = (zeilen: string[], teil: string, text: string) => {
    schreibeDatei(zeilen)
    pruefe(wirft(() => ladeEigeneTitel(bauOrdner), teil), text)
  }
  kaputt([...zeile(910001, 'A'), ...zeile(910001, 'B')], 'doppelt', 'doppelte nr bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('nr: 910001', 'nr: x')), 'nr fehlt', 'nr keine Zahl bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('nr: 910001', 'nr: 1000000')), 'nr fehlt oder liegt außerhalb', 'nr ab einer Million bricht ab (Kennung läge außerhalb des Raums)')
  kaputt(zeile(910001, 'A').map((z) => z.replace('format: MOVIE', 'format: Film')), 'format', 'unbekanntes Format bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('joyn', 'nirgendwo')), 'unbekannte Plattform', 'unbekannter Anbieter bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('2999-01-02', '2999-01')), 'tag', 'Tag ohne Tagesangabe bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('https://example.org/artikel', 'http://example.org/artikel')), 'sources', 'Quelle ohne https bricht ab')
  kaputt(zeile(910001, 'A').filter((z) => !z.includes('sources')), 'sources', 'fehlende Quelle bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('"Fixture-Zitat"', '""')), 'zitat', 'leeres Zitat bricht ab')
  kaputt(zeile(910001, '').map((z) => z.replace('name: ', 'name:')), 'name', 'fehlender Name bricht ab')
  kaputt(zeile(910001, 'A', ['  zuId: abc']), 'zuId', 'zuId ohne Zahl bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('nr: 910001', 'nr: 0')), 'nr fehlt oder liegt außerhalb', 'nr 0 bricht ab')
  kaputt(zeile(910001, 'A').filter((z) => !z.includes('anbieter')), 'anbieter', 'fehlender Anbieter bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('sources: [https://example.org/artikel]', 'sources: []')), 'sources', 'leere Quellenliste bricht ab')
  kaputt(zeile(910001, 'A').map((z) => z.replace('format: MOVIE', 'format: ')), 'format', 'fehlendes Format bricht ab')
  schreibeDatei([''])
  pruefe(ladeEigeneTitel(bauOrdner).length === 0, 'leere Datei: keine Zeilen, kein Fehler')
  const echt = ladeEigeneTitel(join(import.meta.dirname, '..'))
  pruefe(echt.length > 0 && echt.every((e) => e.sources.length > 0 && e.zitat.length > 0), 'die echte Handdatei ist gültig und belegt jede Zeile')
}

console.log('Titel aus der Zeile')
{
  const titles = new Map<number, Title>([[42, { id: 42, titleDe: 'Fremd' } as Title]])
  schreibeDatei([...zeile(910001, 'Fixture Eins'), ...zeile(910002, 'Fixture Zwei', ['  widerrufen: Fixture, 2999-01-03'])])
  const n = ergaenzeEigeneTitel(titles, ladeEigeneTitel(bauOrdner))
  const t = titles.get(eigeneId(910001))
  pruefe(n === 1 && titles.size === 2, 'ein Titel kommt dazu, der widerrufene nicht, der fremde bleibt')
  pruefe(t?.titleDe === 'Fixture Eins' && t.format === 'MOVIE' && t.dubConfidence === 'normal' && t.slug === `fixture-eins-${eigeneId(910001)}`, 'Name, Format, Sicherheit und Adresse stammen aus der Zeile')
  pruefe(t?.episodes === undefined && t?.jpYear === undefined && t?.malId === undefined && t?.coverImage === undefined && t?.streams.length === 0, 'keine Folgenzahl, kein Jahr, keine MAL-Kennung, kein Cover, kein Weg erfunden')
  pruefe(titles.get(42)?.titleDe === 'Fremd' && !titles.has(eigeneId(910002)), 'der fremde Titel ist unverändert, der widerrufene fehlt')
}

console.log('Bau und Termin über releasesAus (Z wie Zorro, M.A.S.K.)')
{
  schreibeDatei([
    ...zeile(910001, 'Z wie Zorro – Der Film'),
    ...zeile(910002, 'Zorros Geheimnis'),
    '- nr: 910003', '  name: M.A.S.K.', '  format: TV', '  anbieter: [primevideo]', '  tag: 2999-01-01',
    '  sources: [https://example.org/mask]', '  zitat: "Fixture-Zitat"',
  ])
  const serie = { id: 900081, idMal: null, title: { romaji: 'Z wie Zorro', english: 'Z wie Zorro', native: null }, format: 'TV', status: 'FINISHED', episodes: 52, duration: 24, season: 'FALL', seasonYear: 1996, startDate: { year: 1996, month: 10, day: 1 }, genres: [], tags: [], externalLinks: [], studios: { nodes: [] }, coverImage: { large: null, extraLarge: null }, bannerImage: null, averageScore: null, isAdult: false, description: null, countryOfOrigin: 'JP' } as unknown as AniListMedia
  const { titles } = baueTitel({ byMal: {}, byAniId: { 900081: serie }, confidenceRaw: {} })
  pruefe(titles.has(900081) && titles.has(ID_FILM) && titles.has(ID_GEHEIMNIS) && titles.has(ID_MASK), 'baueTitel legt die Zeilen neben dem AniList-Titel an')
  const art = { url: 'https://example.org/joyn', publishedAt: '2999-01-01' }
  const eintrag = (titel: string, stream: string[]) => ({ titel, deutsch: true, woechentlich: false, stream, datum: '2999-01-02', datumGeschaetzt: true })
  const joyn = vorschlaegeAusSammelartikel(art, [eintrag('Z wie Zorro – Der Film', ['Joyn', 'Prime Video']), eintrag('Zorros Geheimnis', ['Joyn', 'Prime Video'])])
  const mask = vorschlaegeAusSammelartikel({ url: 'https://example.org/mask', publishedAt: '2999-01-01' }, [{ titel: 'M.A.S.K.', deutsch: true, woechentlich: false, stream: [], datum: '2999-01-01', folgen: 73 }], 'primevideo', 'Aniverse')
  const releases = releasesAus([...joyn, ...mask], [...titles.values()], [], '2999-01-01')
  const je = (id: number) => releases.filter((r) => r.titleId === id).map((r) => r.platform).sort().join()
  /* „Der Film“ in der Überschrift löst heute den Film-Hinweis aus (`teilAusUeberschrift`, ohne Nummer → verworfen); die Sammelzeile ohne ihren Namen zu lesen liefert #2822. Bis dahin: nur der Titel, kein Termin-Urteil. */
  console.log(`  info Termin „Z wie Zorro – Der Film“ aus der Meldung: ${je(ID_FILM) || 'keiner'} (hängt am Film-Hinweis, #2822)`)
  pruefe(je(ID_GEHEIMNIS) === 'joyn', 'Zorros Geheimnis bekommt den Termin beim ersten Anbieter der Meldung (Joyn); `releasesAus` legt je Meldung einen an')
  pruefe(je(ID_MASK) === 'primevideo' && releases.find((r) => r.titleId === ID_MASK)?.kanal === 'Aniverse', 'M.A.S.K. bekommt den Termin beim belegten Anbieter, als Aniverse-Kanal')
  pruefe(je(900081) === '', 'die Serie „Z wie Zorro“ (52 Folgen) bekommt keinen Termin des Films')
  const geheimnis = releases.find((r) => r.titleId === ID_GEHEIMNIS)!
  pruefe(geheimnis.schedule.firstEpisodeDate === '2999-01-02' && !geheimnis.schedule.time && geheimnis.schedule.episodeCount === undefined, 'Termin ohne erfundene Uhrzeit und ohne erfundene Folgenzahl')
  pruefe(geheimnis.sources.includes('https://example.org/joyn'), 'der Termin trägt die Quelle')
}

console.log('Quellenübersicht: keine AniList-Quelle für einen Titel ohne AniList-Eintrag')
{
  const anzahl = (al: number): string | undefined => {
    const html = renderToStaticMarkup(createElement(Quellenuebersicht, { title: { id: 1, al, streams: [] } as unknown as Title, releases: [] }))
    return /Woher diese Angaben stammen \((\d+)\)/.exec(html)?.[1]
  }
  pruefe(anzahl(4_999_999) === '1' && anzahl(5_000_001) === '0' && anzahl(5_999_999) === '0' && anzahl(6_000_000) === '1', 'AniList-Kennung: eine Quelle; eigener Titel (5 bis unter 6 Mio.): keine')
}

console.log('Neu auf Deutsch: kein „Erstmals“ für einen Titel, den wir erst bei der Ankündigung kennen')
{
  mkdirSync(join(bauOrdner, 'public', 'data'), { recursive: true })
  /* Beide Titel haben belegte Synchro (`hasVoices`) und stehen seit einem Tag im Fenster; nur der fremde darf in die Liste. */
  writeFileSync(join(bauOrdner, 'data', 'synchro-historie.json'), JSON.stringify({ angelegtAm: '2000-01-01', seit: { 900092: '2999-06-01', [ID_FILM]: '2999-06-01' } }))
  const mit = (id: number) => ({ id, titleDe: `Fixture ${id}`, slug: `f-${id}`, streams: [], hasVoices: true }) as unknown as Title
  schreibeNeuMitSynchro([mit(900092), mit(ID_FILM)], [])
  const datei = JSON.parse(readFileSync(join(bauOrdner, 'public', 'data', 'neu-mit-synchro.json'), 'utf8')) as { id: number }[]
  pruefe(datei.length === 1 && datei[0]!.id === 900092, `nur der Titel mit AniList-Kennung steht in neu-mit-synchro.json: ${datei.map((n) => n.id).join()}`)
}

console.log('Wächter: Katalog führt jetzt X')
{
  schreibeDatei([...zeile(910001, 'Zorros Geheimnis'), ...zeile(910002, 'Anderer Name', ['  zuId: 77']), ...zeile(910003, 'Dritter', ['  widerrufen: x'])])
  const e = ladeEigeneTitel(bauOrdner)
  const katalog = [
    { id: 11, titleDe: 'Zorros Geheimnis', format: 'MOVIE' },
    { id: 12, titleEn: 'ZORROS GEHEIMNIS!', format: 'MOVIE' },
    { id: 13, titleRomaji: 'Zorros Geheimnis', format: 'TV' },
    { id: 14, titleDe: 'Etwas anderes', format: 'MOVIE' },
    { id: 77, titleDe: 'Anderer Name', format: 'MOVIE' },
    { id: 78, titleDe: 'Dritter', format: 'MOVIE' },
    { id: ID_FILM, titleDe: 'Zorros Geheimnis', format: 'MOVIE' },
  ]
  const f = katalogFuehrtJetzt(e, katalog)
  pruefe(f.length === 2 && f[0]!.includes('Titel 11') && f[1]!.includes('Titel 12') && f[0]!.includes('zuId: 11'), `gleicher Name und gleiche Formatklasse melden (in der Schreibweise egal): ${f.length} Funde`)
  pruefe(!f.some((z) => z.includes('Titel 13')), 'ein TV-Titel gleichen Namens ist kein Film')
  pruefe(!f.some((z) => z.includes(`Titel ${ID_FILM}`)), 'ein eigener Titel zählt nicht als Katalog')
  pruefe(f.every((z) => !z.includes('Anderer Name') && !z.includes('Dritter')), 'mit zuId oder widerrufen ist die Zeile erledigt')
  pruefe(katalogFuehrtJetzt(e, [{ id: 14, titleDe: 'Etwas anderes', format: 'MOVIE' }]).length === 0, 'ohne Treffer bleibt es still')
}

console.log('zuId: Termine ziehen um')
{
  schreibeDatei([...zeile(910001, 'Fixture Eins', ['  zuId: 42']), ...zeile(910002, 'Fixture Zwei'), ...zeile(910003, 'Fixture Drei', ['  zuId: 43', '  widerrufen: Fixture, 2999-01-03'])])
  const e = ladeEigeneTitel(bauOrdner)
  const titles = new Map<number, Title>([[42, { id: 42 } as Title], [43, { id: 43 } as Title]])
  ergaenzeEigeneTitel(titles, e)
  const rel = (titleId: number, platform: string, tag: string, slug: string) => ({ slug, titleId, platform, schedule: { firstEpisodeDate: tag } }) as unknown as Release
  const releases = [
    rel(eigeneId(910001), 'joyn', '2999-01-02', 'a'), rel(eigeneId(910001), 'primevideo', '2999-01-02', 'b'),
    rel(42, 'joyn', '2999-01-02', 'c'), rel(eigeneId(910002), 'joyn', '2999-01-02', 'd'), rel(43, 'joyn', '2999-01-09', 'e'),
    /* Gleicher Anbieter, anderer Tag (f gegen g): kein Duplikat, f zieht um. Gleicher Tag und Anbieter an einem fremden Titel (h): zählt nicht. */
    rel(eigeneId(910001), 'netflix', '2999-01-05', 'f'), rel(42, 'netflix', '2999-01-09', 'g'), rel(43, 'primevideo', '2999-01-02', 'h'),
    /* Widerrufen schlägt zuId: ein übrig gebliebener Termin zieht nicht um. */
    rel(eigeneId(910003), 'netflix', '2999-01-02', 'i'),
  ]
  const n = haengeEigeneUm(titles, releases, e)
  const stand = releases.map((r) => `${r.slug}:${r.titleId}`).join()
  pruefe(n === 1 && !titles.has(eigeneId(910001)) && titles.has(eigeneId(910002)) && titles.has(42), 'der eigene Titel mit zuId entfällt, der ohne zuId bleibt')
  pruefe(stand === `b:42,c:42,d:${eigeneId(910002)},e:43,f:42,g:42,h:43,i:${eigeneId(910003)}`, `Prime-Termin zieht auf 42 um, der Joyn-Termin entfällt (42 hat ihn schon), Nachbarn bleiben: ${stand}`)
  pruefe(wirft(() => haengeEigeneUm(new Map(), [], e), 'zuId 42 steht nicht im Bestand'), 'zuId ohne Katalogtitel bricht ab')
}

console.log('zuId: zuAk in kennungen.json')
{
  schreibeDatei([...zeile(910001, 'Fixture Eins', ['  zuId: 42']), ...zeile(910002, 'Fixture Zwei', ['  zuId: 43']), ...zeile(910003, 'Fixture Drei', ['  zuId: 42']), ...zeile(910004, 'Fixture Vier', ['  zuId: 42', '  widerrufen: Fixture, 2999-01-03']), ...zeile(910005, 'Fixture Fünf')])
  const e = ladeEigeneTitel(bauOrdner)
  const zeilen: [number, number, number, number?][] = [[10, 42, 0], [11, 43, 5, 10], [20, eigeneId(910001), 0], [21, eigeneId(910002), 0], [22, 999, 0], [23, eigeneId(910003), 0, 11], [24, eigeneId(910004), 0], [25, eigeneId(910005), 0]]
  const g = setzeEigeneZuAk(zeilen, e)
  pruefe(g.length === 2 && zeilen[2]![3] === 10, 'die alte Zeile bekommt die ak des Katalogtitels')
  pruefe(zeilen[3]![3] === 10, 'ist der Katalogtitel selbst weitergeleitet (zuAk 10), gilt dessen Ziel')
  pruefe(zeilen[5]![3] === 11 && zeilen[4]!.length === 3 && zeilen[0]!.length === 3, 'eine gesetzte zuAk bleibt, fremde Zeilen bleiben unberührt')
  pruefe(zeilen[6]!.length === 3, 'widerrufen schlägt zuId: die Zeile bleibt ohne zuAk')
  pruefe(zeilen[7]!.length === 3, 'ohne zuId (ein gewöhnlicher eigener Titel) bleibt die Zeile ohne zuAk, und es gibt keinen Fehler')
  pruefe(setzeEigeneZuAk(zeilen, e).length === 0, 'zweiter Lauf ändert nichts')
  pruefe(wirft(() => setzeEigeneZuAk([[20, eigeneId(910001), 0]], e), 'keine Zeile für zuId 42'), 'fehlt die Zeile des Katalogtitels, bricht es ab')
  pruefe(setzeEigeneZuAk([[10, 42, 0]], e).length === 0, 'war der eigene Titel nie ausgeliefert, gibt es nichts umzuleiten')
  /* Die Datei selbst (Format wie `tools/kennungen-erzeugen.mjs`): Zeilen bleiben, nur die alte bekommt das vierte Feld. */
  const kennungen = join(bauOrdner, 'data', 'kennungen.json')
  pruefe(schreibeEigeneZuAk(bauOrdner, e) === 0, 'ohne kennungen.json: nichts zu tun, kein Fehler')
  const vorher = `{"naechste":30,"titel":[\n[10,42,0],\n[11,43,5,10],\n[20,${eigeneId(910001)},0],\n[22,999,0]\n]}\n`
  writeFileSync(kennungen, vorher)
  pruefe(schreibeEigeneZuAk(bauOrdner, e) === 1, 'schreibeEigeneZuAk ändert genau die eine Zeile (910002 und 910003 waren nie ausgeliefert)')
  pruefe(readFileSync(kennungen, 'utf8') === vorher.replace(`[20,${eigeneId(910001)},0]`, `[20,${eigeneId(910001)},0,10]`), 'Datei: nur die Zeile geändert, gleiches Format')
  pruefe(schreibeEigeneZuAk(bauOrdner, e) === 0 && schreibeEigeneZuAk(bauOrdner, []) === 0, 'zweiter Lauf und leere Handdatei ändern nichts')
}

console.log('Eigene Titel tragen keine erratenen Wege')
{
  const check = [{ anilistId: 5_000_001, platform: 'joyn', dub: true, url: 'https://www.joyn.de/filme/beleg' }] as unknown as Parameters<typeof begrenzeWegeAufBelege>[1]
  const weg = (platform: string, url: string) => ({ platform, url }) as Title['streams'][number]
  const mit = (id: number) => ({ id, streams: [weg('netflix', 'https://www.netflix.com/title/1'), weg('joyn', 'https://www.joyn.de/filme/beleg')] }) as unknown as Title
  const titel = [mit(42), mit(5_000_001), mit(10_000_001), mit(4_999_999)]
  begrenzeWegeAufBelege(titel, check)
  const rest = titel.map((t) => t.streams.map((s) => s.platform).join('+'))
  pruefe(rest.join() === 'netflix+joyn,joyn,,netflix+joyn', `AniList-Titel behalten alle Wege; eigener Titel nur den belegten, aniSearch-Zeile keinen: ${rest.join()}`)
  const slim = [{ id: 5_000_001 }, { id: 4_999_999 }, { id: 5_999_999 }].map((t) => ({ ...t, streams: [] as Title['streams'] }))
  const zuTmdb = { tmdbId: 1, kind: 'tv', providers: ['netflix'] }
  ergaenzeWegeAusTmdbUndMotn({
    slim: slim as never,
    tmdbTitles: {},
    tmdbZuTitel: Object.fromEntries(slim.map((t) => [String(t.id), zuTmdb])),
    motnTmdb: { 'tv/1': { imdbId: 'tt1' } } as never,
    motnLinks: { tt1: { netflix: 'https://www.netflix.com/title/80040330' } },
    istTot: () => false,
  })
  pruefe(slim.map((t) => t.streams.length).join() === '0,1,0', `TMDB-Anbieter: eigener Titel (auch am oberen Rand) bekommt keinen, die Kennung knapp unter der Basis einen: ${slim.map((t) => t.streams.length).join()}`)
  const offen = offeneTitel([{ id: 5_000_001 }, { id: 42 }, { id: 4_999_999 }] as never, new Set())
  pruefe(offen.map((t) => t.id).join() === '42,4999999', `aniSearch-Abgleich: ein eigener Titel wird nicht zugeordnet: ${offen.map((t) => t.id).join()}`)
}

console.log('Katalog führt jetzt X: Formatklassen')
{
  schreibeDatei(zeile(910001, 'Reihe Fixture').map((z) => z.replace('MOVIE', 'TV')))
  const e = ladeEigeneTitel(bauOrdner)
  const f = katalogFuehrtJetzt(e, [{ id: 21, titleDe: 'Reihe Fixture', format: 'ONA' }, { id: 22, titleDe: 'Reihe Fixture', format: 'TV_SHORT' }, { id: 23, titleDe: 'Reihe Fixture', format: 'OVA' }, { id: 24, titleDe: 'Reihe Fixture' }])
  pruefe(f.length === 2 && f[0]!.includes('Titel 21') && f[1]!.includes('Titel 22'), `ONA und TV_SHORT gelten als TV, OVA und ein Titel ohne Format nicht: ${f.length} Funde`)
}

console.log('Kern-Titel ohne Cover (check-bild-bestand)')
{
  const kern = [
    { id: 5_000_001 },
    { id: 5_000_002, coverImage: 'https://x/c.jpg' },
    { id: 17975 },
    { id: 10_000_007 },
    { id: -314271 },
    { id: 6_000_000 },
    { id: 4_999_999 },
    { id: 42, coverImage: 'https://x/d.jpg' },
  ]
  pruefe(kernOhneCover(kern).join() === '17975,10000007,-314271,6000000,4999999', `nur der eigene Titel ohne Cover ist kein Fehler; AniList-, aniSearch-, Cartoon- und Randkennungen ohne Cover bleiben einer: ${kernOhneCover(kern).join()}`)
  const bild = readFileSync(join(import.meta.dirname, 'check-bild-bestand.ts'), 'utf8')
  const gebunden = pruefeBindung(bild, 'ohneCover', 'kernOhneCover', 'kern')
  pruefe(gebunden.length === 0, `check-bild-bestand.ts bindet ohneCover über kernOhneCover: ${gebunden.join()}`)
  pruefe(pruefeBindung(bild.replace('kernOhneCover(kern)', 'kern.filter(() => true)'), 'ohneCover', 'kernOhneCover', 'kern').length === 1, 'Fixture: ein anderer Ausdruck wird gemeldet')
  pruefe(pruefeBindung(bild.replace('kernOhneCover(kern)', 'kernOhneCover(alle)'), 'ohneCover', 'kernOhneCover', 'kern').length === 1, 'Fixture: ein anderes Argument wird gemeldet')
  pruefe(pruefeBindung(bild.replace('const ohneCover', 'const andere'), 'ohneCover', 'kernOhneCover', 'kern').length === 1, 'Fixture: eine andere Bindung wird gemeldet')
}

console.log('Verdrahtung im Bau (Syntaxbaum)')
{
  const lies = (datei: string) => readFileSync(join(import.meta.dirname, 'bau', datei), 'utf8')
  const phasen = lies('phasenfolge.ts')
  const fehlerListe = [
    ...pruefeAufrufAnweisung(phasen, 'bauePhasenfolge', 'haengeEigeneUm', 'titles, releases', 'ergaenzeTermineAusNewsUndTv'),
    ...pruefeAufrufAnweisung(lies('13-6-kennungen.ts'), 'ergaenzeKennungen', 'schreibeEigeneZuAk', '', 'execFileSync'),
    ...pruefeAufrufAnweisung(lies('11-wege-abschluss.ts'), 'schliesseWegeAb', 'begrenzeWegeAufBelege', 'titles.values(), alleChecks'),
  ]
  pruefe(fehlerListe.length === 0, `Phase 08 → Umhängen, Kennungen → zuAk und Wegebegrenzung stehen als eigene Anweisung am richtigen Platz: ${fehlerListe.join(' | ')}`)
  const mutant = (alt: string, neu: string) => pruefeAufrufAnweisung(phasen.replace(alt, neu), 'bauePhasenfolge', 'haengeEigeneUm', 'titles, releases', 'ergaenzeTermineAusNewsUndTv').length
  pruefe(mutant('  haengeEigeneUm(titles, releases)', '  0 && haengeEigeneUm(titles, releases)') === 1, 'Fixture: „0 && Aufruf“ ist keine eigene Anweisung')
  pruefe(mutant('  haengeEigeneUm(titles, releases)', '  if (titles.size > 1e9) haengeEigeneUm(titles, releases)') === 1, 'Fixture: Aufruf unter einem if zählt nicht')
  pruefe(mutant('  haengeEigeneUm(titles, releases)', '  haengeEigeneUm(titles, [])') === 1, 'Fixture: falsches Argument wird gemeldet')
  pruefe(mutant('  haengeEigeneUm(titles, releases)\n', '') === 1, 'Fixture: fehlender Aufruf wird gemeldet')
  pruefe(pruefeAufrufAnweisung('function f() {}', 'g', 'h', '').length === 1, 'Fixture: fehlende Funktion wird gemeldet')
  pruefe(pruefeAufrufAnweisung('function f() { a(); b() }', 'f', 'b', '', 'zzz').length === 1 && pruefeAufrufAnweisung('function f() { b() }', 'f', 'b', '', 'a').length === 1, 'Fixture: Aufruf nicht unmittelbar nach „davor“ (anderer Aufruf davor, nichts davor) wird gemeldet')
  pruefe(pruefeAufrufAnweisung('function f() { a(); b() }', 'f', 'b', '', 'a').length === 0, 'Fixture-Kontrolle: derselbe Aufbau mit dem richtigen „davor“ ist in Ordnung')
}

rmSync(bauOrdner, { recursive: true, force: true })
console.log(fehler ? `\n${fehler} Fehler` : `\nEigene Titel: ${faelle} Fälle in Ordnung`)
process.exit(fehler ? 1 : 0)
