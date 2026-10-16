/**
 * Zusicherungen: Ein Prime-Kanal ist so deutsch wie sein Anbieter (Daniel, 13.10.2026, „Reborn as a Space Mercenary“:
 * Crunchyroll Ja, Prime (Crunchyroll) „Sprache offen“). Läuft in `check:logic`. Erfundene Titel, kein Netz.
 */
import { readFileSync } from 'node:fs'
import type { NewsMeldung, Release, StreamLink, Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { kanalErbtVomAnbieter } from './bau/kanal-erbt-anbieter.ts'
import { belegteDeutscheSynchro, ersterTerminMitGrund } from './bau/nebendateien.ts'
import { geerbteWege } from '../shared/kanal-anbieter.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { deutschNurAusSpracheTermin } from './lib/pruefung.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const bereiche = [{ from: 1, to: 12, dub: true }]
const cr = (extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/T', ...extra }) as StreamLink
const adn = (extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/1', ...extra }) as StreamLink
const kanal = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/TEST', kanal: 'Crunchyroll', ...extra }) as StreamLink

/** Läuft die Übernahme über einen Titel und gibt dessen Kanal-Weg (zweiter Weg) und die Zahl zurück. */
function erbe(streams: StreamLink[]): { weg: StreamLink; n: number } {
  const n = kanalErbtVomAnbieter([{ id: 1, streams } as unknown as Title])
  return { weg: streams[1]!, n }
}

const ja = erbe([cr({ dub: true, dubRanges: bereiche }), kanal()])
pruefe('Reborn: Crunchyroll Ja, Kanal ohne Urteil: Kanal bekommt Ja', ja.weg.dub === true && ja.n === 1, ja)
pruefe('Die deutschen Bereiche kommen mit', JSON.stringify(ja.weg.dubRanges) === JSON.stringify(bereiche), ja.weg)
pruefe('Die Bereiche sind eine Kopie, kein geteiltes Objekt', ja.weg.dubRanges?.[0] !== bereiche[0])

const ohneBereiche = erbe([cr({ dub: true }), kanal()])
pruefe('Anbieter-Ja ohne Bereiche: Kanal bekommt Ja, keine erfundenen Bereiche', ohneBereiche.weg.dub === true && ohneBereiche.weg.dubRanges === undefined, ohneBereiche.weg)

const termin = erbe([cr({ dub: true }), kanal({ herkunft: 'termin' })])
pruefe('Demon Slayer 166240: ein Kanal-Weg aus einem Termin erbt kein Ja (der Termin sagt Sprache offen)', termin.weg.dub === undefined && termin.n === 0, termin)

/* Die Prüfung des Bestandsbaus (`pruefung.ts`) bleibt still: Termin sagt „Sprache offen“, der Kanal-Weg trägt kein „deutsch“. */
const hashira = { id: 166240, streams: [cr({ dub: true }), kanal({ herkunft: 'termin' })] } as unknown as Title
kanalErbtVomAnbieter([hashira])
const offenerTermin = [{ titleId: 166240, platform: 'primevideo', sprache: 'offen' }] as unknown as Release[]
const widerspruch = deutschNurAusSpracheTermin(offenerTermin, new Map([[166240, hashira]]))
pruefe('Demon Slayer 166240: kein Widerspruch zwischen Termin „Sprache offen“ und dem Kanal-Weg', widerspruch.length === 0, widerspruch)

const adnJa = erbe([adn({ dub: true }), kanal({ kanal: 'ADN' })])
pruefe('ADN: Kanal „ADN“ erbt von ADN', adnJa.weg.dub === true, adnJa.weg)
pruefe('Schreibweise des Kanals egal', erbe([cr({ dub: true }), kanal({ kanal: 'crunchyroll' })]).weg.dub === true)

/* Die Nein-Fälle: nichts erben. */
const goldenWind = erbe([cr({ dub: false }), kanal()])
pruefe('Anbieter Nein (Golden Wind): Kanal bleibt offen', goldenWind.weg.dub === undefined && goldenWind.n === 0, goldenWind)
pruefe('Anbieter offen: Kanal bleibt offen', erbe([cr(), kanal()]).weg.dub === undefined)
pruefe('Kein Anbieter-Weg im Titel: Kanal bleibt offen', erbe([{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true } as StreamLink, kanal()]).weg.dub === undefined)
pruefe('Anderer Anbieter (ADN-Ja, Kanal Crunchyroll): nichts erben', erbe([adn({ dub: true }), kanal()]).weg.dub === undefined)
pruefe('Anbieter-Weg nur noch als Vermerk (entferntAm): nichts erben', erbe([cr({ dub: true, entferntAm: '2026-09-01' }), kanal()]).weg.dub === undefined)
pruefe('Kanal ohne Anbieter-Weg im Bestand (Aniverse): unberührt', erbe([cr({ dub: true }), kanal({ kanal: 'aniverse' })]).weg.dub === undefined)
pruefe('Prime ohne Kanal-Angabe: unberührt', erbe([cr({ dub: true }), kanal({ kanal: undefined })]).weg.dub === undefined)
pruefe('Kanal-Angabe an einem anderen Anbieter-Weg (Netflix): unberührt', erbe([cr({ dub: true }), kanal({ platform: 'netflix' })]).weg.dub === undefined)
pruefe('Weg des Kanals nur noch als Vermerk: unberührt', erbe([cr({ dub: true }), kanal({ entferntAm: '2026-09-01' })]).weg.dub === undefined)

/* Eigene Urteile des Kanals bleiben, Ja wie Nein. */
const kanalNein = erbe([cr({ dub: true, dubRanges: bereiche }), kanal({ dub: false })])
pruefe('Eigenes Nein des Kanals bleibt', kanalNein.weg.dub === false && kanalNein.weg.dubRanges === undefined && kanalNein.n === 0, kanalNein)
const eigeneBereiche = [{ from: 1, to: 25, dub: true }]
const kanalJa = erbe([cr({ dub: true, dubRanges: bereiche }), kanal({ dub: true, dubRanges: eigeneBereiche })])
pruefe('Eigenes Ja mit eigenen Bereichen bleibt', kanalJa.weg.dub === true && kanalJa.weg.dubRanges === eigeneBereiche && kanalJa.n === 0, kanalJa)
const nurBereiche = erbe([cr({ dub: true, dubRanges: bereiche }), kanal({ dubRanges: eigeneBereiche })])
pruefe('Eigene Bereiche ohne Urteil: Ja kommt, die Bereiche des Kanals bleiben', nurBereiche.weg.dub === true && nurBereiche.weg.dubRanges === eigeneBereiche, nurBereiche)

/* Zweimal laufen ändert nichts. */
const zweimal = [cr({ dub: true, dubRanges: bereiche }), kanal()]
kanalErbtVomAnbieter([{ id: 1, streams: zweimal } as unknown as Title])
pruefe('Zweiter Lauf erbt nichts mehr', kanalErbtVomAnbieter([{ id: 1, streams: zweimal } as unknown as Title]) === 0)

/* Ein geerbtes Ja ist keine Meldung „jetzt auch bei Prime Video“ (13.10.2026: Reborn, Frieren u. a. wären zu ihrem Tag falsch gemeldet worden). */
function weitereAnbieter(streams: StreamLink[]): string[] {
  const historie: NewsHistorie = { zuerst: {} }
  const titelMit = (s: StreamLink[]): Title[] =>
    [{ id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', keywords: [], genres: [], streams: s }] as unknown as Title[]
  baueNews(titelMit([cr({ dub: true })]), [], [], [], historie)
  return baueNews(titelMit(streams), [], [], [], historie).flatMap((e) => e.meldungen.filter((m) => m.art === 'neu').map((m) => `${m.platform}`))
}
const geerbt = [cr({ dub: true }), kanal()]
kanalErbtVomAnbieter([{ id: 1, streams: geerbt } as unknown as Title])
pruefe('Geerbtes Ja: Prime ist kein weiterer Anbieter', weitereAnbieter(geerbt).length === 0, weitereAnbieter(geerbt))
pruefe('Gegenprobe: ein eigenes Ja des Kanals (nicht geerbt) bleibt ein weiterer Anbieter', weitereAnbieter([cr({ dub: true }), kanal({ dub: true })]).join() === 'primevideo')
pruefe('Gegenprobe: ein anderer Anbieter bleibt ein weiterer Anbieter', weitereAnbieter([cr({ dub: true }), adn({ dub: true })]).join() === 'adn')

/* Auch „angekündigt“ (Kennzeichen „weiterer“) und „neu auf Deutsch“ (Anbieter, Quelle) lesen ein geerbtes Ja nicht als eigenes (13.10.2026). */
function meldungen(streams: StreamLink[], releases: Release[], neu: { id: number; seit: string }[]): NewsMeldung[] {
  const titel = [{ id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', keywords: [], genres: [], streams }] as unknown as Title[]
  return baueNews(titel, releases, neu, [], { zuerst: {} }).flatMap((e) => e.meldungen)
}
const crTermin = {
  titleId: 1,
  slug: 'r-1',
  platform: 'crunchyroll',
  releaseType: 'series',
  schedule: { firstEpisodeDate: addDays(todayIso(), 1) },
  sources: [cr().url],
} as unknown as Release
const angekuendigt = (streams: StreamLink[]): NewsMeldung[] => meldungen(streams, [crTermin], []).filter((m) => m.art === 'angekuendigt')
const mitGeerbt = (streams: StreamLink[]): StreamLink[] => {
  kanalErbtVomAnbieter([{ id: 1, streams } as unknown as Title])
  return streams
}
const angeGeerbt = angekuendigt(mitGeerbt([cr({ dub: true }), kanal()]))
pruefe('Angekündigt bei Crunchyroll: ein geerbtes Prime-Ja macht keinen „weiteren“ Anbieter', angeGeerbt.length === 1 && angeGeerbt.every((m) => !m.weiterer), angeGeerbt)
pruefe('Gegenprobe: ein eigenes Prime-Ja bleibt ein „weiterer“ Anbieter', angekuendigt([cr({ dub: true }), kanal({ dub: true })]).some((m) => m.weiterer === true))
const neuBei = (streams: StreamLink[]): NewsMeldung[] => meldungen(streams, [], [{ id: 1, seit: todayIso() }]).filter((m) => m.art === 'neu')
const neuGeerbt = neuBei(mitGeerbt([kanal(), cr({ dub: true })]))
pruefe('Neu auf Deutsch: Anbieter und Quelle sind der Anbieter-Weg, nicht der davor stehende geerbte Prime-Weg', neuGeerbt.length === 1 && neuGeerbt[0]!.platform === 'crunchyroll' && neuGeerbt[0]!.quelle === cr().url, neuGeerbt)
pruefe('Gegenprobe: ein eigenes Prime-Ja davor bleibt der Anbieter', neuBei([kanal({ dub: true }), cr({ dub: true })])[0]?.platform === 'primevideo')

/* „Jetzt auch bei Prime Video“: Die Quelle ist der eigene Prime-Weg, nicht der davor stehende geerbte Kanal-Weg. */
const weitererQuellen = (streams: StreamLink[]): (string | undefined)[] => {
  const historie: NewsHistorie = { zuerst: {} }
  const titelMit = (s: StreamLink[]): Title[] =>
    [{ id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', keywords: [], genres: [], streams: s }] as unknown as Title[]
  baueNews(titelMit([cr({ dub: true })]), [], [], [], historie)
  return baueNews(titelMit(mitGeerbt(streams)), [], [], [], historie)
    .flatMap((e) => e.meldungen)
    .filter((m) => m.weiterer === true && m.platform === 'primevideo')
    .map((m) => m.quelle)
}
const kanalWeg = kanal({ url: 'https://www.amazon.de/gp/video/detail/KANAL' })
const eigenerWeg = kanal({ url: 'https://www.amazon.de/gp/video/detail/EIGEN', kanal: undefined, dub: true })
const quellen = weitererQuellen([cr({ dub: true }), kanalWeg, eigenerWeg])
pruefe('Weiterer Anbieter: Quelle ist der eigene Prime-Weg, nicht der geerbte Kanal-Weg', quellen.join() === eigenerWeg.url, quellen)
pruefe('Gegenprobe: ohne Kanal-Weg bleibt die Quelle der eigene Prime-Weg', weitererQuellen([cr({ dub: true }), eigenerWeg]).join() === eigenerWeg.url)

/*
 * Ein automatisch übernommener Kanal-Termin allein macht keine Meldung „Neu auf Deutsch bei Prime Video“ (13.10.2026: Detective Is Already Dead S2,
 * Reincarnated Aristocrat S3, Wild Last Boss S2 — die Termine stammen aus einem Artikel über Crunchyroll-Simulcasts, ein Prime-Ja gab es nie).
 */
const kanalTermin = (extra: Partial<Release> = {}): Release =>
  ({
    titleId: 1,
    slug: 'auto-1-primevideo',
    platform: 'primevideo',
    kanal: 'Crunchyroll',
    automatisch: true,
    releaseType: 'batch',
    schedule: { firstEpisodeDate: addDays(todayIso(), -3) },
    sources: ['https://www.anime2you.de/news/1'],
    ...extra,
  }) as unknown as Release
const neuMitTermin = (streams: StreamLink[], releases: Release[]): NewsMeldung[] =>
  meldungen(streams, releases, [{ id: 1, seit: addDays(todayIso(), -3) }]).filter((m) => m.art === 'neu')
pruefe('Nur ein automatischer Kanal-Termin, kein Prime-Ja: keine Meldung „neu“', neuMitTermin([kanal()], [kanalTermin()]).length === 0, neuMitTermin([kanal()], [kanalTermin()]))
pruefe('Gegenprobe: derselbe Kanal-Termin mit eigenem Prime-Ja bleibt eine Meldung', neuMitTermin([kanal({ dub: true })], [kanalTermin()]).length === 1)
pruefe('Gegenprobe: ein Kanal-Termin von Hand (nicht automatisch) bleibt eine Meldung', neuMitTermin([kanal()], [kanalTermin({ automatisch: undefined })]).length === 1)
const ohneKanalTermin = kanalTermin({ kanal: undefined })
pruefe('Gegenprobe: ein automatischer Prime-Termin ohne Kanal bleibt eine Meldung', neuMitTermin([kanal({ kanal: undefined })], [ohneKanalTermin]).length === 1)

/*
 * Dieselbe Regel für `neu-mit-synchro.json` (Newsletter „Neu auf Deutsch“): Der Kanal-Termin allein belegt keine Synchro; die drei Titel standen dort weiter.
 */
const prime = (streams: StreamLink[]): Title => ({ id: 1, streams }) as unknown as Title
const erster = (streams: StreamLink[], termin: Release): string | undefined => {
  return ersterTerminMitGrund([termin], [prime(streams)]).get(1)
}
pruefe('neu-mit-synchro: automatischer Kanal-Termin ohne Ja zählt nicht als erster deutscher Termin', erster([kanal()], kanalTermin()) === undefined)
pruefe('neu-mit-synchro: mit eigenem Prime-Ja zählt der Kanal-Termin', erster([kanal({ dub: true })], kanalTermin()) === kanalTermin().schedule.firstEpisodeDate)
pruefe('neu-mit-synchro: ein Kanal-Termin von Hand zählt', erster([kanal()], kanalTermin({ automatisch: undefined })) === kanalTermin().schedule.firstEpisodeDate)
pruefe('neu-mit-synchro: ein automatischer Prime-Termin ohne Kanal zählt', erster([kanal({ kanal: undefined })], kanalTermin({ kanal: undefined })) === kanalTermin().schedule.firstEpisodeDate)
const nebendateien = readFileSync(new URL('./bau/nebendateien.ts', import.meta.url), 'utf8')
pruefe('schreibeNeuMitSynchro nimmt die Termine aus ersterTerminMitGrund', nebendateien.includes('const ersterTermin = ersterTerminMitGrund(releases, titles)'))

/*
 * „Neu auf Deutsch“ zählt auch beim Weg selbst nur ein eigenes Ja (13.10.2026): Ein vom Anbieter geerbtes Ja eines Prime-Kanals belegt für sich nichts.
 */
const belegt = (streams: StreamLink[]): boolean => belegteDeutscheSynchro({ id: 1, streams } as unknown as Title, new Map(), todayIso())
const geerbterWeg = kanal({ dub: true })
geerbteWege.add(geerbterWeg)
pruefe('neu-mit-synchro: nur ein geerbter Kanal-Weg belegt keine Synchro', !belegt([geerbterWeg]))
pruefe('Gegenprobe: dasselbe Ja als eigenes Ja des Kanal-Wegs belegt', belegt([kanal({ dub: true })]))
{
  const streams = [cr({ dub: true }), kanal()]
  kanalErbtVomAnbieter([{ id: 1, streams } as unknown as Title])
  pruefe('Gegenprobe: Anbieter-Weg mit Ja belegt weiter, auch wenn der Kanal erbt', belegt(streams))
  pruefe('Der Kanal-Weg allein aus diesem Erbe belegt nichts', !belegt([streams[1]!]))
}

/* Der Bau ruft es auf, vor der Auslieferung (sonst bliebe die Regel Papier). */
const schreiben = readFileSync(new URL('./bau/13-schreiben.ts', import.meta.url), 'utf8')
const aufrufe = unbedingteAufrufe(schreiben, 'schreibeDatensatz')
const stelle = (name: string): number => aufrufe.find((x) => x.name === name)?.stelle ?? -1
/* Das Erbe läuft in `tonDerKanalWege` (vor der Sprach-Termin-Regel); 13-schreiben reicht JustWatchs Seiten-Nein hinein. */
const ton = aufrufe.find((x) => x.name === 'tonDerKanalWege')
pruefe('13-schreiben ruft tonDerKanalWege(allTitles, releases, jwNeinAnSeite()) unbedingt auf', ton?.args.join('|') === 'allTitles|releases|jwNeinAnSeite()', ton)
pruefe(
  '13-schreiben: tonDerKanalWege steht nach dem Anreichern und vor der Auslieferung',
  stelle('schreibeSynopsenUndReichereAn') >= 0 && stelle('tonDerKanalWege') > stelle('schreibeSynopsenUndReichereAn') && stelle('tonDerKanalWege') < stelle('baueAuslieferung'),
  aufrufe.map((x) => `${x.stelle}:${x.name}`),
)
const tonQuelle = readFileSync(new URL('./bau/deutsch-nicht-gegen-sprach-termin.ts', import.meta.url), 'utf8')
const tonAufrufe = unbedingteAufrufe(tonQuelle, 'tonDerKanalWege')
const erbt = tonAufrufe.find((x) => x.name === 'kanalErbtVomAnbieter')
pruefe('tonDerKanalWege reicht jwNein an kanalErbtVomAnbieter(allTitles, jwNein) weiter', erbt?.args.join('|') === 'allTitles|jwNein', erbt)
pruefe(
  'tonDerKanalWege: erst das Erbe, dann die Sprach-Termin-Regel',
  erbt !== undefined && erbt.stelle < (tonAufrufe.find((x) => x.name === 'nimmKanalJaGegenSprachTermin')?.stelle ?? -1),
  tonAufrufe.map((x) => `${x.stelle}:${x.name}`),
)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-kanal-erbt: ok')
