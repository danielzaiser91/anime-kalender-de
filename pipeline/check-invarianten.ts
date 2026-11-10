/**
 * Gegenprobe der Invarianten am Ergebnis (`lib/invarianten.ts`): je Regel ein nachgestellter Fehlerfall,
 * der rot wird, und ein sauberer Fall, der es nicht wird. `--bestand` fährt sie zusätzlich über `public/data`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import {
  DATUM_VOM_ANBIETER, deutschNichtVorJapan, filmOhneMehrereFolgen, folgenDatumSteigt, folgennummernEindeutig, pruefeInvarianten, slugsEindeutig,
  terminKennungenEindeutig, verweiseAufgeloest, widerlegteOhneTermine, zaehlworteStimmen,
} from './lib/invarianten.ts'
import { reihenVerweiseAufgeloest, synchroNichtHinterToggle, type SynchroQuellen } from './lib/invarianten-auslieferung.ts'
import { geplantNichtDeutschHeute, ladeGeplantQuelle } from './lib/invarianten-geplant.ts'
import { dubIdsNachAnisearch, dubsNachTitel } from './lib/anisearch-marke.ts'
import { kanalProben, kanalWegProben, kanalWegeVorhanden } from './check-invarianten-kanal.ts'
import { kanalFehler } from './bau/kanal-fehler.ts'
import { todayIso } from '../shared/time.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (slug: string, titleId = 1, platform = 'crunchyroll', releaseType = 'weekly'): Release =>
  ({ slug, titleId, name: slug, platform, releaseType, schedule: { firstEpisodeDate: '2026-09-01' }, year: 2026, sources: ['x'] }) as unknown as Release
const termin = (releaseSlug: string, episode: number | undefined, date: string): ReleaseEvent =>
  ({ id: `${releaseSlug}-${episode}-${date}`, releaseSlug, titleId: 1, date, episode, releaseType: 'weekly', platform: 'crunchyroll', name: releaseSlug }) as unknown as ReleaseEvent
const titel = new Map<number, Title>([[1, { id: 1 } as unknown as Title]])

console.log('\nInvarianten am Ergebnis:')
{
  // B-04: zwei Releases mit demselben Slug (Pokémon Reisen, TOGGO plus)
  pruefe('Slug doppelt wird gemeldet', slugsEindeutig([release('auto-112153-tv-toggo-plus'), release('auto-112153-tv-toggo-plus')]).length === 1)
  pruefe('verschiedene Slugs gehen durch', slugsEindeutig([release('a'), release('b')]).length === 0)

  // B-03: „Folge 8" dreimal im Kalender
  const dreimal = [termin('polar', 8, '2026-09-13'), termin('polar', 8, '2026-09-20'), termin('polar', 8, '2026-10-04'), termin('polar', 9, '2026-10-11')]
  const f = folgennummernEindeutig([release('polar')], dreimal)
  pruefe('Folgennummer doppelt wird gemeldet', f.length === 1 && f[0].includes('8×3'), f)
  pruefe('Folgen ohne Nummer und Discs zählen nicht', folgennummernEindeutig([release('d', 1, 'disc', 'disc'), release('b')], [termin('d', 1, '2026-09-01'), termin('d', 1, '2026-09-02'), termin('b', undefined, '2026-09-01'), termin('b', undefined, '2026-09-08')]).length === 0)
  pruefe('aufsteigende Folgen gehen durch', folgennummernEindeutig([release('polar')], [termin('polar', 8, '2026-09-13'), termin('polar', 9, '2026-09-20')]).length === 0)
  const ausgeblieben = { ...termin('trk', 12, '2026-10-14'), verpasst: { erwartetAm: '2026-10-14T17:25:00.000Z' } }
  pruefe('ausgebliebener Tag und Ersatztermin derselben Folge gehen durch', folgennummernEindeutig([release('trk')], [ausgeblieben, termin('trk', 12, '2026-10-21')]).length === 0)
  const nachgeholt = { ...ausgeblieben, verpasst: { erwartetAm: '2026-10-14T17:25:00.000Z', erschienenAm: '2026-10-15' } }
  pruefe('nachgeholter Tag zählt mit', folgennummernEindeutig([release('trk')], [nachgeholt, termin('trk', 12, '2026-10-21')]).length === 1)
  pruefe('zwei echte Termine neben einem ausgebliebenen werden gemeldet', folgennummernEindeutig([release('trk')], [ausgeblieben, termin('trk', 12, '2026-10-21'), termin('trk', 12, '2026-10-28')]).length === 1)

  // B-06: Release ohne vorhandenen Titel, Termin ohne Release
  const v = verweiseAufgeloest([release('x', 999)], [termin('geist', 1, '2026-09-01')], titel)
  pruefe('Release ohne Titel wird gemeldet', v.fehler.some((e) => e.includes('Titel 999')), v.fehler)
  pruefe('Termin ohne Release wird gemeldet', v.fehler.some((e) => e.includes('ohne Release')), v.fehler)
  const w = verweiseAufgeloest([release('adn-197', -1), release('cartoon', -5)], [], titel)
  pruefe('titleId -1 ist ein Fehler, Cartoon-ID nicht', w.fehler.length === 1 && w.fehler[0].includes('adn-197'), w)
  const t = verweiseAufgeloest([release('a')], [{ ...termin('a', 1, '2026-09-01'), titleId: -1 }, { ...termin('a', 2, '2026-09-08'), titleId: 999 }, { ...termin('a', 3, '2026-09-15'), titleId: -5 }], titel)
  pruefe('Termin mit titleId -1 oder unbekanntem Titel wird gemeldet, Cartoon-Termin nicht', t.fehler.length === 1 && t.fehler[0].startsWith('2 Termin(e) ohne vorhandenen Titel'), t)
  pruefe('sauberer Bestand geht durch', pruefeInvarianten([release('a')], [termin('a', 1, '2026-09-01')], titel).fehler.length === 0)

  // B-07/B-08: Fußzeile nannte 610 Releases, die Datei hatte 722
  const z = zaehlworteStimmen({ titleCount: 10, releaseCount: 610, eventCount: 5 }, { titles: 10, releases: 722, events: 5 })
  pruefe('Zählwort ungleich Dateilänge wird gemeldet', z.length === 1 && z[0].includes('610') && z[0].includes('722'), z)
  pruefe('passende Zählworte gehen durch', zaehlworteStimmen({ titleCount: 1, belegtCount: 1, releaseCount: 2, eventCount: 3 }, { titles: 1, belegt: 1, releases: 2, events: 3 }).length === 0)
  pruefe('ungesetztes „belegt“ wird gemeldet', zaehlworteStimmen({ titleCount: 3, belegtCount: 0, releaseCount: 2, eventCount: 3 }, { titles: 3, belegt: 2, releases: 2, events: 3 }).length === 1)
}

/* Die harten Regeln des Daten-Detektivs (DD-01, DD-13, DD-14, DD-21, DD-23 an Releases und Terminen; DD-06, DD-15 an den Dateien). */
console.log('\nHarte Regeln des Daten-Detektivs:')
{
  const titelMit = (t: Record<string, unknown>): Title => t as unknown as Title
  // DD-01: Lycoris Recoil, Folge 6 vor Folge 5
  const lycoris = [termin('l', 5, '2022-08-20'), termin('l', 6, '2022-08-06'), termin('l', 7, '2022-09-03')]
  pruefe('DD-01: spätere Folge vor früherer wird gemeldet', folgenDatumSteigt([release('l')], lycoris).length === 1, folgenDatumSteigt([release('l')], lycoris))
  pruefe('DD-01: Folgen gleichen Tages und aufsteigende gehen durch', folgenDatumSteigt([release('l')], [termin('l', 1, '2026-09-01'), termin('l', 2, '2026-09-01'), termin('l', 3, '2026-09-08')]).length === 0)
  pruefe('DD-01: TV-Sichtung und Disc zählen nicht', folgenDatumSteigt([{ ...release('tv'), tvLetzteSichtung: '2026-09-01' } as Release, release('d', 1, 'disc', 'disc')], [termin('tv', 78, '2026-09-01'), termin('tv', 5, '2026-09-02'), termin('d', 2, '2026-09-01'), termin('d', 1, '2026-09-02')]).length === 0)
  pruefe('DD-01: das belegte Anbieterdatum von Lycoris Recoil ist eingetragen', Object.keys(DATUM_VOM_ANBIETER).includes('lycoris-recoil-crunchyroll-de-2022-07-23') && folgenDatumSteigt([release('lycoris-recoil-crunchyroll-de-2022-07-23')], lycoris.map((e) => ({ ...e, releaseSlug: 'lycoris-recoil-crunchyroll-de-2022-07-23' }))).length === 0)

  // DD-13: Boruto/The Last als „2 Folgen"
  const film = new Map<number, Title>([[1, titelMit({ id: 1, format: 'MOVIE', episodes: 1 })], [2, titelMit({ id: 2, format: 'ONA', episodes: 1 })]])
  const mitFolgen = (slug: string, titleId: number, n: number, releaseType = 'weekly'): Release => ({ ...release(slug, titleId, 'tv', releaseType), schedule: { firstEpisodeDate: '2026-10-09', episodeCount: n } }) as Release
  pruefe('DD-13: Film mit zwei Folgen wird gemeldet', filmOhneMehrereFolgen([mitFolgen('boruto', 1, 2)], film).length === 1)
  pruefe('DD-13: Release-Typ Film mit mehreren Folgen wird gemeldet', filmOhneMehrereFolgen([mitFolgen('f', 2, 3, 'movie')], film).length === 1)
  pruefe('DD-13: ein Film mit einer Folge, ein Disc-Eintrag und ein ONA gehen durch', filmOhneMehrereFolgen([mitFolgen('a', 1, 1), mitFolgen('b', 1, 4, 'disc'), mitFolgen('c', 2, 11)], film).length === 0)

  // DD-14, DD-21, DD-23
  const jp = new Map<number, Title>([[1, titelMit({ id: 1, jpYear: 2021 })], [2, titelMit({ id: 2, jpYear: 2021, westlich: true })]])
  pruefe('DD-14: deutsch vor Japan wird gemeldet', deutschNichtVorJapan([{ ...release('a'), year: 2019 } as Release], jp).length === 1)
  pruefe('DD-14: westliche Serie und gleiches Jahr gehen durch', deutschNichtVorJapan([{ ...release('b', 2), year: 2019 } as Release, { ...release('c'), year: 2021 } as Release], jp).length === 0)
  pruefe('DD-21: doppelte Termin-Kennung wird gemeldet', terminKennungenEindeutig([termin('a', 1, '2026-09-01'), termin('a', 1, '2026-09-01')]).length === 1)
  pruefe('DD-21: verschiedene Kennungen gehen durch', terminKennungenEindeutig([termin('a', 1, '2026-09-01'), termin('a', 2, '2026-09-08')]).length === 0)
  const widerlegt = { ...release('w'), widerlegt: { am: '2026-10-01', grund: 'x', gemeldet: true } } as Release
  pruefe('DD-23: widerlegter Termin mit Kalendereintrag wird gemeldet', widerlegteOhneTermine([widerlegt], [termin('w', 1, '2026-10-05')]).length === 1)
  pruefe('DD-23: widerlegter Termin ohne Kalendereintrag geht durch', widerlegteOhneTermine([widerlegt], [termin('x', 1, '2026-10-05')]).length === 0)

  // DD-06: Scott Pilgrim hebt ab — aniSearch „d", hinter dem Toggle
  const scott = titelMit({ id: 170206, titleRomaji: 'Scott Pilgrim Takes Off', anisearchId: 18828, jpStart: '2023-11-17' })
  const quellen: SynchroQuellen = { dubsAnilist: {}, dubIds: { '18828': 'd' }, handbelegteIds: new Set<number>(), handKeine: new Set<number>(), heute: '2026-10-08' }
  const hinter = (titles: Title[], q = quellen, ohne = [scott]) => synchroNichtHinterToggle({ titles, ohneSynchro: ohne }, q)
  pruefe('DD-06: aniSearch „d" hinter dem Toggle wird gemeldet', hinter([]).length === 1, hinter([]))
  pruefe('DD-06: der aniSearch-Zwilling im Hauptbestand genügt', hinter([titelMit({ id: 10_018_828 })]).length === 0)
  pruefe('DD-06: Handurteil „keine Synchro" nimmt den Titel aus', hinter([], { ...quellen, handKeine: new Set([170206]) }).length === 0)
  pruefe('DD-06: ein Start in der Zukunft bleibt hinter dem Toggle', hinter([], quellen, [{ ...scott, jpStart: '2026-12-01' } as Title]).length === 0)
  pruefe('DD-06: Handbeleg dub:true wird gemeldet, auch ohne aniSearch', hinter([], { ...quellen, dubIds: {}, handbelegteIds: new Set([170206]) }).length === 1)
  pruefe('DD-06: ohne jede Quelle bleibt ein Titel hinter dem Toggle', hinter([], { ...quellen, dubIds: {} }).length === 0)

  // DD-15: Reihen-Verweise
  const reihe = (id: number, franchiseId?: number) => titelMit({ id, franchiseId })
  const ausl = (franchises: Record<string, { id: number; name: string }[]>) => ({ titles: [reihe(1, 9), reihe(2, 9)], ohneSynchro: [], cartoons: [], franchises })
  pruefe('DD-15: Glied ohne Titel wird gemeldet', reihenVerweiseAufgeloest(ausl({ '9': [{ id: 1, name: 'a' }, { id: 77, name: 'b' }] })).length === 1)
  pruefe('DD-15: mehrgliedrige Reihe ohne Eintrag wird gemeldet', reihenVerweiseAufgeloest(ausl({})).length === 2)
  pruefe('DD-15: vollständige Reihe geht durch', reihenVerweiseAufgeloest(ausl({ '9': [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] })).length === 0)

  // D-24: Dragon Hatchling — aniSearch „Geplant“, ADN-Termin erst am 22.10., trotzdem „Auf Deutsch seit 10.01.“ und dub:true
  const hatchling = (extra: Record<string, unknown> = {}) => new Map([[187941, titelMit({ id: 187941, titleRomaji: 'Dragon Hatchling', streams: [{ platform: 'adn', url: 'x', dub: true }], ...extra })]])
  const adnTermin = [{ ...release('a', 187941, 'adn', 'batch'), schedule: { firstEpisodeDate: '2026-10-22' } } as Release]
  const q = { geplant: new Set([187941]), handbelegt: new Set<number>() }
  const lauf = (t: Map<number, Title>, r = adnTermin, quelle = q) => geplantNichtDeutschHeute(r, t, quelle, '2026-10-11')
  pruefe('D-24: dub:true bei künftigem Start und Marke „Geplant“ wird gemeldet', lauf(hatchling()).length === 1, lauf(hatchling()))
  pruefe('D-24: „Auf Deutsch seit“ aus dem aniSearch-Block bei „Geplant“ wird gemeldet', lauf(hatchling({ streams: [], deErstausgabe: { von: '2026-01-10', publisher: 'ADN' } })).length === 1)
  pruefe('D-24: ein Handbeleg schlägt die Marke', lauf(hatchling(), adnTermin, { ...q, handbelegt: new Set([187941]) }).length === 0)
  pruefe('D-24: ein begonnener Termin belegt die Synchro', lauf(hatchling(), [{ ...adnTermin[0]!, schedule: { firstEpisodeDate: '2026-10-01' } } as Release]).length === 0)
  pruefe('D-24: ohne Marke „Geplant“ keine Meldung', lauf(hatchling(), adnTermin, { ...q, geplant: new Set<number>() }).length === 0)
  pruefe('D-24: Erstausgabe mit Handbeleg (synchro) oder benannter Quelle geht durch', lauf(hatchling({ streams: [], deErstausgabe: { von: '2026-01-10', synchro: true } })).length === 0)

  kanalProben(pruefe)
  kanalWegProben(pruefe)
}

if (process.argv.includes('--bestand')) {
  const d = <T>(datei: string): T => JSON.parse(readFileSync(new URL(`../public/data/${datei}`, import.meta.url), 'utf8')) as T
  const titles = new Map([...d<Title[]>('titles.json')].map((t) => [t.id, t]))
  const releases = d<Release[]>('releases.json')
  const events = d<ReleaseEvent[]>('events.json')
  const r = pruefeInvarianten(releases, events, titles)
  console.log(`\nBestand: ${releases.length} Releases, ${events.length} Termine — ${r.fehler.length} Fehler, ${r.warnungen.length} Warnungen`)
  for (const t of [...r.fehler, ...r.warnungen].slice(0, 10)) console.log('  ', t)
  const meta = d<{ titleCount: number; releaseCount: number; eventCount: number }>('meta.json')
  const z = zaehlworteStimmen(meta, { titles: titles.size, releases: releases.length, events: events.length })
  console.log(`Zählworte: ${z.length} Abweichung(en)`, z)
  verletzt += r.fehler.length
  const handbelegt = new Set((yaml.load(readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')) as { anilistId: number; dub?: boolean; nichtImBestand?: boolean }[]).filter((c) => c.dub === true && !c.nichtImBestand).map((c) => c.anilistId))
  const handKeine = new Set((yaml.load(readFileSync(new URL('../data/ohne-synchro-von-hand.yaml', import.meta.url), 'utf8')) as { anilistId?: number; sources?: string[] }[]).filter((e) => e.anilistId && e.sources?.length).map((e) => e.anilistId!))
  const auslieferung = { titles: [...titles.values()], ohneSynchro: d<Title[]>('ohne-synchro.json'), cartoons: d<Title[]>('cartoons.json'), franchises: d<Record<string, { id: number; name: string }[]>>('franchises.json') }
  const a = [
    ...synchroNichtHinterToggle(auslieferung, { dubsAnilist: dubsNachTitel(), dubIds: dubIdsNachAnisearch(), handbelegteIds: handbelegt, handKeine, heute: todayIso() }),
    ...reihenVerweiseAufgeloest(auslieferung),
    ...geplantNichtDeutschHeute(releases, titles, ladeGeplantQuelle()),
    ...kanalFehler(titles.values(), releases),
    ...kanalWegeVorhanden(titles),
  ]
  console.log(`Auslieferung (DD-06, DD-15, D-24, D-25, D-26, D-27): ${a.length} Fehler`)
  for (const t of a.slice(0, 10)) console.log('  ', t)
  verletzt += a.length
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Invarianten-Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
