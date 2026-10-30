/**
 * Zusicherung (Daniel, 21.10.2026, Yaiba und Failure Frame): Kopfzeile und Nebenzeile des Antwort-Kastens.
 *  - Ein belegter deutscher TV-Termin ohne Stream ist eine Premiere: „Erste Folge …“, nie „Alle 24 Folgen auf Deutsch“ / „Sprache offen“.
 *  - Eine OmU-Adresse zählt als Untertitel; ohne Kennung (und bei „-sub“) bleibt die Sprache offen.
 *  - „Auf Deutsch seit {Tag}“ steht nie mit einem Tag nach heute und nicht doppelt zur Pille.
 *  - Die Kaufausgabe-Zeile und die Legende „Sprache offen“ gibt es nicht mehr; keine TV-Notiz beginnt mit „Uhrzeit:“.
 *  - Eine belegte TV-Premiere heißt in der Meldung „Deutsche TV-Premiere“.
 * Feste Zeit, keine Uhr. Aufruf: `npm run check:logic`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from 'yaml'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { adresseIstOmu } from '../shared/omu-adresse.ts'
import { AntwortBereich } from '../web/src/components/detail/antwort-bereich.tsx'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { AntwortKasten } from '../web/src/components/detail/antwort-kasten.tsx'
import { deutschBegonnen } from '../web/src/components/detail/antwort-regeln.ts'
import { deSeitZeigen } from '../web/src/components/detail/de-seit.ts'
import { alleNurUntertitel, alleOhneSprachbeleg, streamStatus, streamWegStatus } from '../web/src/components/detail/legende-zeilen.ts'
import { legendeFuer } from '../web/src/components/detail/pille.tsx'
import { translate } from '../web/src/lib/i18n.tsx'
import { newsSatz } from '../web/src/lib/news-text.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { vergissAlte } from './lib/news-einfrieren.ts'
import { newsSatz as mailSatz } from '../worker/src/mail-abschnitte.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-21'
const JETZT = new Date('2026-10-21T12:00:00Z')
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const basis = {
  id: 900101,
  slug: 'x',
  format: 'TV',
  episodes: 24,
  jpYear: 2025,
  hasVoices: true,
  streams: [],
  watchLinks: [],
  titleDe: 'Probe',
}
const titel = (extra: object = {}): Title => ({ ...basis, ...extra }) as unknown as Title
const tvTermin = (extra: object = {}): Release =>
  ({
    slug: 'probe-tv',
    titleId: 900101,
    name: 'Probe',
    platform: 'tv',
    sender: 'ProSieben MAXX',
    releaseType: 'weekly',
    premiere: { weg: 'tv', quelle: 'https://example.org/a' },
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24 },
    year: 2026,
    sources: ['https://example.org/a'],
    ...extra,
  }) as unknown as Release
function kopf(t: Title, rs: Release[]): string {
  const antwort = berechneAntwort({ title: t, releases: rs, today: HEUTE, jetzt: JETZT })!
  return text(renderToStaticMarkup(createElement(AntwortKasten, { antwort, title: t, t: translate as never, today: HEUTE, releases: rs })))
}

console.log('\nTV-Premiere ohne Stream (Yaiba):')
const yaiba = berechneAntwort({ title: titel(), releases: [tvTermin()], today: HEUTE, jetzt: JETZT })!
pruefe('Antwort „läuft“ statt „fertig“', yaiba.art === 'laeuft', yaiba.art)
const yaibaKopf = kopf(titel(), [tvTermin()])
pruefe('Kopf nennt die erste Folge', yaibaKopf.includes('Die erste Folge mit deutscher Synchro erscheint am 05.11.2026'), yaibaKopf)
pruefe('Kopf sagt weder „Alle 24 Folgen“ noch „Sprache offen“', !yaibaKopf.includes('Alle 24') && !yaibaKopf.includes('Sprache offen'), yaibaKopf)
pruefe('keine Kaufausgabe-Zeile', !yaibaKopf.includes('Kaufausgabe'))
pruefe('kein „Auf Deutsch seit“ vor dem Start', !yaibaKopf.includes('Auf Deutsch seit'))
const mitStream = titel({ streams: [{ platform: 'crunchyroll', url: 'https://x/cr', dub: true }] })
pruefe('deutschBegonnen: Stream mit Tonspur', deutschBegonnen(mitStream, 0, HEUTE))
pruefe('deutschBegonnen: genau eine erschienene Folge', deutschBegonnen(titel(), 1, HEUTE))
pruefe('deutschBegonnen: nichts erschienen', !deutschBegonnen(titel(), 0, HEUTE))
pruefe('deutschBegonnen: Stream ohne Tonspur zählt nicht', !deutschBegonnen(titel({ streams: [{ platform: 'x', url: 'https://x/a', dub: false }] }), 0, HEUTE))
const erst = (von: string, synchro = true): Title => titel({ deErstausgabe: { von, synchro } })
pruefe('deutschBegonnen: Erstausgabe heute', deutschBegonnen(erst(HEUTE), 0, HEUTE))
pruefe('deutschBegonnen: Erstausgabe morgen', !deutschBegonnen(erst('2026-10-22'), 0, HEUTE))
pruefe('deutschBegonnen: Erstausgabe ohne Synchro', !deutschBegonnen(erst('2026-01-01', false), 0, HEUTE))
pruefe('deutschBegonnen: Zeitraum statt Tag', !deutschBegonnen(erst('2026-01'), 0, HEUTE))

console.log('\nOmU-Adresse:')
const akiba = 'https://www.akibapass.tv/products/yaiba-samurai-legend-omu-season-1-2'
pruefe('Akibapass mit „-omu-“', adresseIstOmu(akiba))
pruefe('„omu“ am Pfadende', adresseIstOmu('https://x.de/serie/foo-omu'))
pruefe('„OMU“ groß, nach Unterstrich', adresseIstOmu('https://x.de/serie/foo_OMU/'))
pruefe('ohne Kennung', !adresseIstOmu('https://www.akibapass.tv/products/yaiba-samurai-legend-season-1-2'))
pruefe('„-sub“ zählt nicht', !adresseIstOmu('https://x.de/serie/foo-sub-season-1'))
pruefe('„omu“ als Wortanfang (omurice) bleibt offen', !adresseIstOmu('https://x.de/serie/omurice-s1') && !adresseIstOmu('https://x.de/serie/foo-omurice'))
pruefe('„omu“ vor Punkt oder Schrägstrich', adresseIstOmu('https://x.de/serie/foo-omu.html') && adresseIstOmu('https://x.de/serie/omu/s1'))
pruefe('„omu“ als Wortende (komu) bleibt offen', !adresseIstOmu('https://x.de/serie/komu') && !adresseIstOmu('https://x.de/serie/foo-komu/s1'))
pruefe('„omu“ im Wort (komunikation)', !adresseIstOmu('https://x.de/serie/komuna'))
pruefe('Kennung nur im Host zählt nicht', !adresseIstOmu('https://omu.example.org/serie/foo'))
pruefe('keine Adresse / kaputte Adresse', !adresseIstOmu(undefined) && !adresseIstOmu('kein link'))
const weg = (url: string, extra: Partial<StreamLink> = {}): StreamLink => ({ platform: 'akibapass', url, ...extra }) as StreamLink
pruefe('streamStatus: OmU-Adresse → omu', streamStatus(titel(), weg(akiba), []) === 'omu')
pruefe('streamStatus: ohne Kennung → offen', streamStatus(titel(), weg('https://www.akibapass.tv/products/yaiba'), []) === 'offen')
pruefe('streamStatus: belegtes Deutsch geht vor', streamStatus(titel(), weg(akiba, { dub: true }), []) === 'belegt')
const kaufweg = (url: string): Parameters<typeof streamWegStatus>[0] => ({ eintraege: [{ url }] }) as never
pruefe('streamWegStatus: OmU-Adresse → omu', streamWegStatus(kaufweg(akiba), titel()) === 'omu')
pruefe('streamWegStatus: ohne Kennung → offen', streamWegStatus(kaufweg('https://x.de/serie/foo'), titel()) === 'offen')
const wege = (...urls: string[]): Parameters<typeof alleNurUntertitel>[0] => [{ plattformen: urls.map((u) => weg(u)), streamWege: [] }] as never
pruefe('Kopf: nur OmU-Zeilen → „nur Untertitel“', alleNurUntertitel(wege(akiba), titel(), []))
pruefe('Kopf: eine Zeile ohne Kennung dabei → nicht „nur Untertitel“', !alleNurUntertitel(wege(akiba, 'https://x.de/serie/foo'), titel(), []))
pruefe('Kopf: OmU und offen zusammen → weiter „ohne Sprachbeleg“', alleOhneSprachbeleg(wege(akiba, 'https://x.de/serie/foo'), titel(), []))
const mitKaufweg = (pillen: string[], kauf: string[]): Parameters<typeof alleNurUntertitel>[0] =>
  [{ plattformen: pillen.map((u) => weg(u)), streamWege: kauf.map((u) => kaufweg(u)) }] as never
pruefe('Kopf: OmU-Pille plus Kaufweg ohne Kennung → nicht „nur Untertitel“', !alleNurUntertitel(mitKaufweg([akiba], ['https://x.de/serie/foo']), titel(), []))
pruefe('Kopf: nur OmU-Kaufwege → „nur Untertitel“', alleNurUntertitel(mitKaufweg([], [akiba]), titel(), []))
pruefe('Kopf: OmU-Pille plus OmU-Kaufweg → „nur Untertitel“', alleNurUntertitel(mitKaufweg([akiba], [akiba]), titel(), []))
pruefe('Kopf: Kaufweg ohne Kennung bleibt „ohne Sprachbeleg“', alleOhneSprachbeleg(mitKaufweg([akiba], ['https://x.de/serie/foo']), titel(), []))
pruefe('Kopf: keine Zeilen → nicht „nur Untertitel“', !alleNurUntertitel(wege(), titel(), []))

console.log('\n„Auf Deutsch seit“ (Failure Frame):')
const cr = { platform: 'crunchyroll', url: 'https://x/cr', dub: true }
const crTermin = { slug: 'cr', titleId: 900101, platform: 'crunchyroll', schedule: { firstEpisodeDate: '2025-02-04' } } as unknown as Release
const disc = erst('2026-11-06')
pruefe('Tag nach heute: nie', !deSeitZeigen(disc, [], HEUTE))
pruefe('Tag nach heute um genau einen Tag: nie', !deSeitZeigen(erst('2026-10-22'), [], HEUTE))
pruefe('Tag heute: ja', deSeitZeigen(erst(HEUTE), [], HEUTE))
pruefe('Stream mit Tonspur früher: Zeile entfällt', !deSeitZeigen({ ...erst('2026-03-01'), streams: [cr] } as never, [crTermin], HEUTE))
pruefe('Stream am selben Tag: Zeile entfällt', !deSeitZeigen({ ...erst('2025-02-04'), streams: [cr] } as never, [crTermin], HEUTE))
pruefe('Stream einen Tag später: Zeile bleibt', deSeitZeigen({ ...erst('2025-02-03'), streams: [cr] } as never, [crTermin], HEUTE))
pruefe('Stream ohne Tonspur zählt nicht', deSeitZeigen({ ...erst('2026-03-01'), streams: [{ ...cr, dub: false }] } as never, [crTermin], HEUTE))
pruefe('Stream ohne Angabe zur Tonspur zählt nicht', deSeitZeigen({ ...erst('2026-03-01'), streams: [{ platform: 'crunchyroll', url: 'https://x/cr' }] } as never, [crTermin], HEUTE))
pruefe('Disc-Termin des Anbieters zählt nicht', deSeitZeigen({ ...erst('2026-03-01'), streams: [cr] } as never, [{ ...crTermin, releaseType: 'disc' } as Release], HEUTE))
pruefe('Zeitraum ohne Tag bleibt', deSeitZeigen(erst('2026-01'), [], HEUTE))
const ff = titel({ episodes: 12, streams: [{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }], deErstausgabe: { von: '2026-11-06', synchro: true } })
const ffTermin = { ...crTermin, schedule: { firstEpisodeDate: '2025-02-04', lastEpisodeDate: '2025-02-04', episodeCount: 12, observed: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), '2025-02-04'])) } } as unknown as Release
const ffKopf = kopf(ff, [ffTermin])
pruefe('Gerendert: nie „seit“ mit Zukunftstag', !ffKopf.includes('06.11.2026'), ffKopf)
pruefe('Gerendert: keine Kaufausgabe-Zeile', !ffKopf.includes('Kaufausgabe'))
const fruehDe = titel({ episodes: 12, streams: [{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }], deErstausgabe: { von: '2020-01-01', synchro: false } })
pruefe('Gerendert: eine echte frühere Erstausgabe bleibt sichtbar', kopf(fruehDe, [ffTermin]).includes('Auf Deutsch seit 01.01.2020'), kopf(fruehDe, [ffTermin]))

console.log('\nGerendert über AntwortBereich (Verdrahtung):')
const leer = { verbindung: { verbunden: false }, favorites: new Set(), folgenAngabeFuer: () => '', dubZeilen: () => [], releaseJePlattform: new Map() }
function bereich(t: Title, rs: Release[]): string {
  const antwort = berechneAntwort({ title: t, releases: rs, today: HEUTE, jetzt: JETZT })
  const eingabe = {
    ...leer,
    antwort,
    sortiertNachZugang: sortiereNachZugang({ title: t }),
    streamReleases: [],
    terminReleases: [],
    title: t,
    t: translate,
    today: HEUTE,
    wegeHinweis: undefined,
    tvVorbei: [],
    kastenNotiz: undefined,
    folgenLuecke: null,
    releases: rs,
    discAusgaben: [],
    discReleases: [],
  }
  return text(renderToStaticMarkup(createElement(AntwortBereich, eingabe as never)))
}
const omuWeg = { platform: 'crunchyroll', url: akiba, zugang: 'abo' }
const offenWeg = { platform: 'netflix', url: 'https://x.de/serie/foo', zugang: 'abo' }
const alt = (streams: object[]): Title => titel({ episodes: 12, streams })
pruefe('nur OmU-Wege: „Anbieter, nur Untertitel“', bereich(alt([omuWeg]), [ffTermin]).includes('Anbieter, nur Untertitel'), bereich(alt([omuWeg]), [ffTermin]))
pruefe('OmU und offener Weg: „Anbieter, Sprache offen“', bereich(alt([omuWeg, offenWeg]), [ffTermin]).includes('Anbieter, Sprache offen'), bereich(alt([omuWeg, offenWeg]), [ffTermin]))
pruefe('nur offener Weg: „Anbieter, Sprache offen“', bereich(alt([offenWeg]), [ffTermin]).includes('Anbieter, Sprache offen'))
pruefe('Pille trägt „nur Untertitel“, nicht „Sprache offen“', bereich(alt([omuWeg]), [ffTermin]).includes('nur Untertitel') && !bereich(alt([omuWeg]), [ffTermin]).includes('Sprache offen'))
const zaehle = (html: string, wort: string): number => html.split(wort).length - 1
const nurOffen = bereich(alt([offenWeg]), [ffTermin])
pruefe('Kopf „Sprache offen“ und keine Marke daneben: genau einmal', zaehle(nurOffen, 'Sprache offen') === 1, nurOffen)
const omuUndOffen = bereich(alt([omuWeg, offenWeg]), [ffTermin])
pruefe('OmU und offen: „Sprache offen“ nur im Kopf, die OmU-Marke bleibt', zaehle(omuUndOffen, 'Sprache offen') === 1 && omuUndOffen.includes('nur Untertitel'), omuUndOffen)
const belegtUndOffen = bereich(alt([{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }, offenWeg]), [ffTermin])
pruefe('Kopf sagt Deutsch, ein Weg offen: die Marke „Sprache offen“ steht allein einmal', zaehle(belegtUndOffen, 'Sprache offen') === 1 && !belegtUndOffen.includes('Anbieter, Sprache offen'), belegtUndOffen)
const laeuftOffen = bereich(alt([{ ...cr, dubRanges: [{ from: 1, to: 6, dub: true }] }, offenWeg]), [ffTermin])
pruefe('Kein Kopf „Sprache offen“ (Art „teilweise“): die Marke an der Pille bleibt', zaehle(laeuftOffen, 'Sprache offen') === 1 && !laeuftOffen.includes('Anbieter, Sprache offen'), laeuftOffen)
const frueher = titel({ episodes: 12, streams: [{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }], deErstausgabe: { von: '2026-03-01', synchro: false } })
pruefe('Termine kommen an: früherer Stream blendet „seit“ aus', !bereich(frueher, [ffTermin]).includes('Auf Deutsch seit'), bereich(frueher, [ffTermin]))
const spaeter = titel({ episodes: 12, streams: [{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }], deErstausgabe: { von: '2025-02-03', synchro: false } })
pruefe('Gegenprobe: späterer Stream lässt „seit“ stehen', bereich(spaeter, [ffTermin]).includes('Auf Deutsch seit 03.02.2025'), bereich(spaeter, [ffTermin]))
const neuigkeit = titel({ episodes: 12, streams: [{ ...cr, dubRanges: [{ from: 1, to: 12, dub: true }] }], deErstausgabe: { von: '2020-01-01', synchro: true } })
pruefe('Erstausgabe als Neuigkeit: keine „seit“-Zeile', !kopf(neuigkeit, [ffTermin]).includes('Auf Deutsch seit'), kopf(neuigkeit, [ffTermin]))
const zukunftOhneStream = titel({ deErstausgabe: { von: '2026-11-06', synchro: true } })
const zkKopf = kopf(zukunftOhneStream, [tvTermin()])
pruefe('Erstausgabe in der Zukunft ist kein Beginn: „Erste Folge“ statt „Alle 24“', zkKopf.includes('Die erste Folge mit deutscher Synchro erscheint am 05.11.2026') && !zkKopf.includes('Alle 24'), zkKopf)
pruefe('Stream ohne Angabe zur Tonspur ist kein Beginn', !deutschBegonnen(titel({ streams: [{ platform: 'x', url: 'https://x/a' }] }), 0, HEUTE))
pruefe('Zeitraum nach heute (Dezember) wird nicht unterdrückt', deSeitZeigen(erst('2026-12'), [], HEUTE))
const zwei = [{ ...crTermin, schedule: { firstEpisodeDate: '2025-02-04' } }, { ...crTermin, slug: 'cr2', schedule: { firstEpisodeDate: '2025-05-01' } }] as unknown as Release[]
pruefe('mehrere Termine des Anbieters: der früheste zählt', !deSeitZeigen({ ...erst('2025-03-01'), streams: [cr] } as never, zwei, HEUTE))
pruefe('mehrere Termine, Reihenfolge egal', !deSeitZeigen({ ...erst('2025-03-01'), streams: [cr] } as never, [...zwei].reverse(), HEUTE))
pruefe('Weg mit belegtem Deutsch bleibt „belegt“ trotz OmU-Adresse', streamWegStatus({ eintraege: [{ url: akiba, dubRanges: [{ from: 1, to: 2, dub: true }] }] } as never, titel()) === 'belegt')

const film = (von: string): Title => titel({ format: 'MOVIE', episodes: 1, streams: [{ ...cr, dubRanges: undefined }], deErstausgabe: { von, synchro: false } })
const filmKopf = kopf(film('2020-01-01'), [])
pruefe('Film: früher Tag steht als „seit“', filmKopf.includes('Auf Deutsch seit 01.01.2020'), filmKopf)
pruefe('Film: Tag nach heute steht nie als „seit“', !kopf(film('2026-11-06'), []).includes('Auf Deutsch seit'), kopf(film('2026-11-06'), []))
const komplettPlusTv = berechneAntwort({ title: titel({ episodes: 12 }), releases: [ffTermin, tvTermin()], today: HEUTE, jetzt: JETZT })!
pruefe('belegt abgeschlossen, Folgen erschienen, TV-Wiederholung folgt: bleibt „fertig“', komplettPlusTv.art === 'fertig', komplettPlusTv.art)

console.log('\nLegende und Notizen:')
pruefe('Legende „Sprache offen“ gibt es nicht mehr', legendeFuer(['offen'], false, translate as never) === undefined)
pruefe('Marke der Pille heißt wie der Kopf: „Sprache offen“', translate('detail.statusOffen' as never) === 'Sprache offen')
const noten: string[] = []
for (const f of readdirSync('data/curated').filter((x) => x.startsWith('tv-') && x.endsWith('.yaml'))) {
  const dok = parse(readFileSync(`data/curated/${f}`, 'utf8')) as unknown
  for (const r of (Array.isArray(dok) ? dok : ((dok as { releases?: unknown[] })?.releases ?? [])) as { note?: string; slug?: string }[]) {
    if (r.note?.startsWith('Uhrzeit:')) noten.push(r.slug ?? '?')
  }
}
pruefe('keine TV-Notiz beginnt mit „Uhrzeit:“ (Herleitung gehört in den YAML-Kommentar)', noten.length === 0, noten)

console.log('\nMeldung „Deutsche TV-Premiere“:')
const nachBau = (r: Release, historie: NewsHistorie = { zuerst: {} }): string[] =>
  baueNews([titel({ id: 900101 })], [r], [], [], historie)
    .flatMap((e) => e.meldungen)
    .filter((m) => m.platform === 'tv')
    .map((m) => newsSatz(m))
const fern = { schedule: { firstEpisodeDate: '2999-11-05', time: '18:25', episodeCount: 24 } }
const satzPremiere = nachBau(tvTermin(fern))
pruefe('belegte Premiere: „Deutsche TV-Premiere bei … am Montag, den 05.11.2999“', satzPremiere.some((s) => s.startsWith('Deutsche TV-Premiere bei ProSieben MAXX am ') && s.includes('05.11.2999')), satzPremiere)
const satzOhne = nachBau(tvTermin({ ...fern, premiere: undefined }))
pruefe('ohne Handbeleg bleibt „Im TV bei …“', satzOhne.length > 0 && satzOhne.every((s) => s.startsWith('Im TV bei ProSieben MAXX am ')), satzOhne)
const satzAnderer = nachBau(tvTermin({ ...fern, premiere: { weg: 'stream', quelle: 'https://example.org/a' } }))
pruefe('Premiere auf anderem Weg (stream) ist keine TV-Premiere', satzAnderer.length > 0 && satzAnderer.every((s) => s.startsWith('Im TV bei ')), satzAnderer)
const SCHLUESSEL = 'angekuendigt:probe-tv:2999-11-05'
const alteHistorie = (): NewsHistorie => ({ zuerst: { [SCHLUESSEL]: '2026-10-10' } })
const satzAlt = nachBau(tvTermin(fern), alteHistorie())
pruefe('Meldung aus der Historie behält „Im TV bei …“ trotz Premiere-Beleg', satzAlt.length > 0 && satzAlt.every((s) => s.startsWith('Im TV bei ProSieben MAXX am ')), satzAlt)
pruefe('Meldung aus der Historie: Text byte-gleich zur Meldung ohne Handbeleg', JSON.stringify(satzAlt) === JSON.stringify(nachBau(tvTermin({ ...fern, premiere: undefined }), alteHistorie())), satzAlt)
const folge = { zuerst: {} } as NewsHistorie
const ersterBau = nachBau(tvTermin(fern), folge)
const zweiterBau = nachBau(tvTermin(fern), folge)
pruefe('neue Meldung bekommt die Marke und behält sie im nächsten Bau', ersterBau.some((s) => s.startsWith('Deutsche TV-Premiere')) && JSON.stringify(zweiterBau) === JSON.stringify(ersterBau), [ersterBau, zweiterBau])
const andere = nachBau(tvTermin({ ...fern, slug: 'andere-tv' }), alteHistorie())
pruefe('Historie eines anderen Schlüssels schützt nicht', andere.some((s) => s.startsWith('Deutsche TV-Premiere')), andere)
const vergessen = { zuerst: {} } as NewsHistorie
nachBau(tvTermin(fern), vergessen)
pruefe('neue Meldung hinterlässt den Marken-Eintrag in der Historie', vergessen.premiere?.[SCHLUESSEL] === true, vergessen)
const ohneMarkeHistorie = { zuerst: {} } as NewsHistorie
nachBau(tvTermin({ ...fern, premiere: undefined }), ohneMarkeHistorie)
pruefe('neue Meldung ohne Premiere-Beleg hinterlässt keinen Marken-Eintrag', ohneMarkeHistorie.premiere === undefined, ohneMarkeHistorie)
const altesGedaechtnis = { zuerst: { a: '2025-01-01', b: '2026-10-01' }, premiere: { a: true, b: true } } as NewsHistorie
vergissAlte(altesGedaechtnis, '2026-01-01')
pruefe('Gedächtnis vergisst die Marke mit der alten Meldung, nicht die der jungen', JSON.stringify(altesGedaechtnis.premiere) === '{"b":true}', altesGedaechtnis.premiere)
const satzFremd = nachBau(tvTermin({ ...fern, premiere: { weg: 'tv', quelle: 'https://example.org/fremd' } }))
pruefe('Premiere-Beleg nicht unter den Belegen der Meldung: „Im TV bei …“', satzFremd.length > 0 && satzFremd.every((s) => s.startsWith('Im TV bei ')), satzFremd)
const mailMeldung = { art: 'angekuendigt', platform: 'tv', anbieter: 'ProSieben MAXX', datum: '2026-11-05' }
const mailPremiere = mailSatz({ ...mailMeldung, premiere: true } as never)
pruefe('Mail: belegte Premiere heißt „Deutsche TV-Premiere“', mailPremiere.startsWith('Deutsche TV-Premiere bei ProSieben MAXX am Donnerstag, den '), mailPremiere)
pruefe('Mail: ohne Marke bleibt „Im TV bei …“', mailSatz(mailMeldung as never).startsWith('Im TV bei ProSieben MAXX am Donnerstag'))
const nachgetragen = tvTermin({ ...fern, nachtrag: { kurz: 'Probe', abschnitte: [] } })
const nachtragMeldungen = baueNews([titel({ id: 900101 })], [nachgetragen], [], [], { zuerst: {} }).flatMap((e) => e.meldungen)
pruefe('Nachtrag eines Premieren-Termins trägt die Marke nicht', nachtragMeldungen.some((m) => m.art === 'nachgetragen') && nachtragMeldungen.every((m) => !m.premiere), nachtragMeldungen)
const alleMeldungen = baueNews([titel({ id: 900101 })], [tvTermin(fern)], [], [], { zuerst: {} }).flatMap((e) => e.meldungen)
pruefe('Marke nur an der angekündigten Meldung', alleMeldungen.filter((m) => m.premiere).every((m) => m.art === 'angekuendigt') && alleMeldungen.some((m) => m.premiere === true), alleMeldungen)

console.log(`\nKopfzeile/Premiere: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
