/**
 * Zusicherungen zu den Chips im Detail-Panel (14.10.2026, Daniel am Panel Snowball Earth): Prime-Kanal-Termin mit „Deutsch“ und
 * Folgen, „seit“-Datum an den Stream-Chips, keine zweite Pille für dieselbe Seite. Erfundene Titel, kein Bestand.
 * Aufruf: `npm run check:logic`.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PlatformId, Release, StreamLink, Title } from '../shared/types.ts'
import { formatDate } from '../shared/time.ts'
import { verlagIstAnbieter } from '../shared/verlag-anbieter.ts'
import { angebotSeitZeileVon } from '../web/src/components/detail/kasten-hinweise.ts'
import { streamZeilen, terminPillen } from '../web/src/components/detail/wege-zeilen.tsx'
import { ausgabenOhneDeSichtbar, kanalTerminQuelle, kastenNenntSeit, seitDatumFuerPille, seitDatumVon, seitenKern } from '../web/src/components/detail/chips-regeln.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-14'
const FOLGEN = 'FOLGEN-13'
/** Übersetzung, die Schlüssel und Werte zurückgibt: Der Test sieht, welcher Text mit welchem Datum gewählt wurde. */
const t = ((k: string, p?: Record<string, unknown>) => (p ? `${k}${JSON.stringify(p)}` : k)) as never

const cr = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GT1/x', dub: true, zugang: 'abo', ...extra }) as StreamLink
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 'r1', titleId: 1, name: 'Testserie', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-20', episodeCount: 13 }, ...extra }) as unknown as Release
const primeKanal = (extra: Partial<Release> = {}): Release =>
  termin({ slug: 'auto-1-primevideo', platform: 'primevideo', kanal: 'Crunchyroll', releaseType: 'batch', schedule: { firstEpisodeDate: '2026-10-13', episodeCount: 13 } as never, ...extra })
const titel = (extra: Partial<Title> = {}): Title => ({ id: 1, slug: 'x', format: 'TV', episodes: 13, streams: [cr()], ...extra }) as unknown as Title

const html = (knoten: unknown[]): string => renderToStaticMarkup(createElement(Fragment, null, ...(knoten as never[])))

function streamHtml(title: Title, releases: Release[], today = HEUTE): string {
  return html(
    streamZeilen({
      sortiertNachZugang: [{ plattformen: title.streams, streamWege: [] }] as never,
      title,
      t,
      today,
      folgenAngabeFuer: () => '',
      dubZeilen: () => [],
      releaseJePlattform: new Map(),
      streamReleases: [],
      releases,
      tvVorbei: [],
    }),
  )
}

console.log('\nSeite hinter der Adresse (adressKern ohne Sprachsegment):')
const gtiA = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const gtiB = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
pruefe('Crunchyroll: /de/series/X gleich /series/X', seitenKern('https://www.crunchyroll.com/de/series/GT1/x') === seitenKern('https://crunchyroll.com/series/GT1/x?a=1'))
pruefe('Disney+: /de-de/browse/… gleich /browse/…', seitenKern('https://www.disneyplus.com/de-de/browse/entity-1') === seitenKern('https://www.disneyplus.com/browse/entity-1'))
pruefe('Amazon: „/dp/“ und „/gp/video/detail/“ derselben Kennung sind gleich, keine Sprache', seitenKern('https://www.amazon.de/dp/B0AAAAAAAA') === seitenKern('https://www.amazon.de/gp/video/detail/B0AAAAAAAA'), seitenKern('https://www.amazon.de/dp/B0AAAAAAAA'))
pruefe('Amazon: zwei gti-Adressen bleiben verschieden (Parameter zählt)', seitenKern(gtiA) !== seitenKern(gtiB), [seitenKern(gtiA), seitenKern(gtiB)])
pruefe('YouTube: zwei Videos bleiben verschieden', seitenKern('https://www.youtube.com/watch?v=aaaaaaaaaaa') !== seitenKern('https://www.youtube.com/watch?v=bbbbbbbbbbb'))
pruefe('Andere Serie bleibt verschieden', seitenKern('https://www.crunchyroll.com/de/series/GT1/x') !== seitenKern('https://www.crunchyroll.com/series/GT2/x'))

console.log('\nAusgabe ohne Deutsch neben demselben Chip:')
const gleiche = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GT1/x' }
const andere = { platform: 'primevideo', url: 'https://www.amazon.de/dp/B0AAAAAAAA', kanal: 'Crunchyroll' }
pruefe('gleiche Seite wie ein Verweis (nur Sprachsegment verschieden): ausgeblendet', ausgabenOhneDeSichtbar(titel({ ausgabenOhneDe: [gleiche] as never })).length === 0)
pruefe('gleiche Seite wie ein Bezugsweg: ausgeblendet', ausgabenOhneDeSichtbar(titel({ streams: [], watchLinks: [{ name: 'X', url: 'https://www.crunchyroll.com/de/series/GT1/x', kind: 'stream' }] as never, ausgabenOhneDe: [gleiche] as never })).length === 0)
pruefe('andere Adresse (andere Prime-Kennung): bleibt', ausgabenOhneDeSichtbar(titel({ ausgabenOhneDe: [andere, gleiche] as never })).map((a) => a.url).join() === andere.url)
const gtiPrime = (gti: string) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.${gti}`
const gtiEins = gtiPrime('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
const gtiZwei = gtiPrime('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
pruefe('zwei Amazon-Adressen mit verschiedener gti: die Ausgabe ohne Deutsch bleibt', ausgabenOhneDeSichtbar(titel({ streams: [{ platform: 'primevideo', url: gtiEins, dub: true }, cr()] as never, ausgabenOhneDe: [{ platform: 'primevideo', url: gtiZwei }] as never })).length === 1)
pruefe('dieselbe gti (Gegenprobe): ausgeblendet', ausgabenOhneDeSichtbar(titel({ streams: [{ platform: 'primevideo', url: gtiEins, dub: true }] as never, ausgabenOhneDe: [{ platform: 'primevideo', url: gtiEins }] as never })).length === 0)
const gezeigt = streamHtml(titel({ ausgabenOhneDe: [gleiche, andere] as never }), [])
pruefe('Panel: eine durchgestrichene Pille für die andere Adresse, keine für die gleiche', (gezeigt.match(/line-through/g) ?? []).length === 1, gezeigt.match(/line-through/g)?.length)

console.log('\nPrime-Kanal-Termin erbt Deutsch vom Anbieter:')
pruefe('Crunchyroll mit Ja: der Anbieter-Weg wird die Quelle', kanalTerminQuelle(primeKanal(), titel())?.platform === 'crunchyroll')
pruefe('Crunchyroll mit Nein: keine Quelle', kanalTerminQuelle(primeKanal(), titel({ streams: [cr({ dub: false })] })) === undefined)
pruefe('Crunchyroll ohne Urteil: keine Quelle', kanalTerminQuelle(primeKanal(), titel({ streams: [cr({ dub: undefined })] })) === undefined)
pruefe('Weg nur noch als Vermerk (entferntAm): keine Quelle', kanalTerminQuelle(primeKanal(), titel({ streams: [cr({ entferntAm: '2026-10-01' })] })) === undefined)
pruefe('Kanal ohne eigenen Anbieter-Weg (Aniverse): keine Quelle', kanalTerminQuelle(primeKanal({ kanal: 'Aniverse' }), titel()) === undefined)
pruefe('Termin ohne Kanal: keine Quelle', kanalTerminQuelle(primeKanal({ kanal: undefined }), titel()) === undefined)
pruefe('ausdrückliche Ausgabe ohne Deutsch über diesen Kanal: keine Quelle', kanalTerminQuelle(primeKanal(), titel({ ausgabenOhneDe: [andere] as never })) === undefined)
pruefe('Ausgabe ohne Deutsch eines anderen Anbieters mit gleichem Kanalnamen sperrt nicht', kanalTerminQuelle(primeKanal(), titel({ ausgabenOhneDe: [{ ...andere, platform: 'adn' }] as never }))?.platform === 'crunchyroll')

function terminHtml(title: Title, r: Release): string {
  return html(terminPillen([r], title, [r], HEUTE, () => FOLGEN))
}
const mitDe = terminHtml(titel(), primeKanal())
pruefe('Termin-Pille trägt die Blase „Deutsch“', mitDe.includes('Deutsch'), mitDe.slice(0, 200))
pruefe('Termin-Pille trägt die Folgen des Anbieters', mitDe.includes(FOLGEN))
pruefe('Termin-Pille trägt weiter „seit“ (TerminZeile übersetzt selbst)', mitDe.includes(`seit ${formatDate('2026-10-13')}`), mitDe.slice(0, 400))
pruefe('Termin, dessen Quelle nur OmU nennt: keine Quelle, kein Deutsch', kanalTerminQuelle(primeKanal({ sprache: 'omu' }), titel()) === undefined)
pruefe('Termin mit offener Sprache erbt weiter (nur OmU sperrt)', kanalTerminQuelle(primeKanal({ sprache: 'offen' }), titel())?.platform === 'crunchyroll')
const omuHtml = terminHtml(titel(), primeKanal({ sprache: 'omu' }))
pruefe('Termin-Pille eines OmU-Termins: keine Blase, keine Folgen', !omuHtml.includes('Deutsch') && !omuHtml.includes(FOLGEN), omuHtml.slice(0, 200))
const imStream = html(
  streamZeilen({
    sortiertNachZugang: [{ plattformen: titel().streams, streamWege: [] }] as never,
    title: titel(),
    t,
    today: HEUTE,
    folgenAngabeFuer: (s) => (s?.platform === 'crunchyroll' ? FOLGEN : ''),
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
    streamReleases: [primeKanal()],
    releases: [primeKanal()],
    tvVorbei: [],
  }),
)
pruefe('Panel: die Prime-Kanal-Pille unter den Streams trägt „Deutsch“ und die Folgen des Anbieters', (imStream.match(new RegExp(FOLGEN, 'g')) ?? []).length === 2 && imStream.includes('Prime Video (Crunchyroll)'), imStream.length)
const ohneDe = terminHtml(titel({ streams: [cr({ dub: false })] }), primeKanal())
pruefe('ohne Ja des Anbieters: weder Blase noch Folgen (Gegenprobe)', !ohneDe.includes('Deutsch') && !ohneDe.includes(FOLGEN), ohneDe.slice(0, 200))

console.log('\n„seit“ an den Stream-Chips:')
const seitJuli = formatDate('2026-07-20')
const mitSeit = streamHtml(titel(), [termin()])
pruefe('Chip mit Termin: „seit“ mit dem Datum des Termins', mitSeit.includes(`detail.seitDatum{&quot;d&quot;:&quot;${seitJuli}&quot;}`), mitSeit.slice(0, 300))
pruefe('Chip ohne Termin dieses Anbieters: kein Datum', !streamHtml(titel(), [termin({ platform: 'netflix' })]).includes('Datum'))
pruefe('Termin in der Zukunft: „ab“', streamHtml(titel(), [termin()], '2026-07-01').includes('detail.abDatum'))
pruefe('mehrere Termine: der früheste zählt', seitDatumVon('crunchyroll', [termin({ schedule: { firstEpisodeDate: '2026-09-01' } as never }), termin()]) === '2026-07-20')
pruefe('abgeleitete Termine (estimated) zählen nicht, auch wenn sie früher liegen', seitDatumVon('crunchyroll', [termin({ schedule: { firstEpisodeDate: '2026-01-01', estimated: true } as never }), termin({ schedule: { firstEpisodeDate: '2026-09-20' } as never })]) === '2026-09-20')
pruefe('nur abgeleitete Termine: kein Datum', seitDatumVon('crunchyroll', [termin({ schedule: { firstEpisodeDate: '2026-07-20', estimated: true } as never })]) === undefined)
pruefe('Disc-Termine zählen nicht', seitDatumVon('crunchyroll', [termin({ releaseType: 'disc', schedule: { firstEpisodeDate: '2020-01-01' } as never }), termin()]) === '2026-07-20')
pruefe('OmU-Termine zählen nicht, auch wenn sie früher liegen', seitDatumVon('crunchyroll', [termin({ sprache: 'omu', schedule: { firstEpisodeDate: '2026-01-01' } as never }), termin()]) === '2026-07-20')
pruefe('nur ein OmU-Termin: kein Datum', seitDatumVon('crunchyroll', [termin({ sprache: 'omu' })]) === undefined)
pruefe('Panel: Chip mit nur einem OmU-Termin trägt kein „seit“', !streamHtml(titel(), [termin({ sprache: 'omu' })]).includes('Datum'))

console.log('\nKein „seit“, das der Kasten schon nennt:')
const angebot = (platform: string, date: string) => ({ angebotSeit: { platform, date } }) as Partial<Title>
const erstausgabe = (von: string, publisher: string) => ({ deErstausgabe: { von, publisher, synchro: true } }) as unknown as Partial<Title>
pruefe('Kasten nennt „im Angebot seit“ mit gleichem Datum und Anbieter: kein „seit“ in der Pille', !streamHtml(titel(angebot('crunchyroll', '2026-07-20')), [termin()]).includes('Datum'))
pruefe('anderes Datum: „seit“ bleibt (Gegenprobe)', streamHtml(titel(angebot('crunchyroll', '2026-07-21')), [termin()]).includes('detail.seitDatum'))
pruefe('gleiches Datum bei anderem Anbieter: „seit“ bleibt', streamHtml(titel(angebot('netflix', '2026-07-20')), [termin()]).includes('detail.seitDatum'))
pruefe('Kasten nennt „Auf Deutsch seit“ mit gleichem Datum und Verlag = Anbieter: kein „seit“', !streamHtml(titel(erstausgabe('2026-07-20', 'Crunchyroll')), [termin()]).includes('Datum'))
pruefe('Erstausgabe gleichen Datums eines anderen Verlags: „seit“ bleibt', streamHtml(titel(erstausgabe('2026-07-20', 'Netflix, Inc.')), [termin()]).includes('detail.seitDatum'))
pruefe('Erstausgabe mit anderem Datum: „seit“ bleibt', streamHtml(titel(erstausgabe('2026-07-19', 'Crunchyroll')), [termin()]).includes('detail.seitDatum'))
const streamVon = (platform: string, url: string) => [{ platform, url, dub: true, zugang: 'abo' }] as never
const ohneSeit = (platform: PlatformId, url: string, verlag: string) =>
  !streamHtml(titel({ streams: streamVon(platform, url), ...erstausgabe('2026-07-20', verlag) }), [termin({ platform })]).includes('Datum')
pruefe('Verlag „Amazon.com, Inc.“ ist Prime Video: kein „seit“ an der Prime-Pille', ohneSeit('primevideo', 'https://www.amazon.de/dp/B0AAAAAAAA', 'Amazon.com, Inc.'))
pruefe('Verlag „The Walt Disney Company“ ist Disney+: kein „seit“ an der Disney+-Pille', ohneSeit('disneyplus', 'https://www.disneyplus.com/de-de/browse/entity-1', 'The Walt Disney Company'))
pruefe('Verlag „Netflix, Inc.“ ist Netflix: kein „seit“ an der Netflix-Pille', ohneSeit('netflix', 'https://www.netflix.com/title/1', 'Netflix, Inc.'))
pruefe('Hensuki: Verlag Kazé, Pille Crunchyroll — „seit“ bleibt', streamHtml(titel(erstausgabe('2026-07-20', 'Kazé')), [termin()]).includes('detail.seitDatum'))
pruefe('Verlag Amazon, Pille Netflix: „seit“ bleibt', !ohneSeit('netflix', 'https://www.netflix.com/title/1', 'Amazon.com, Inc.'))
pruefe('verlagIstAnbieter: Tabelle und Name', verlagIstAnbieter('Amazon.com, Inc.', 'primevideo') && verlagIstAnbieter('The Walt Disney Company', 'disneyplus') && verlagIstAnbieter('Netflix, Inc.', 'netflix') && verlagIstAnbieter('Crunchyroll', 'crunchyroll') && verlagIstAnbieter('Disney+', 'disneyplus'))
pruefe('verlagIstAnbieter: andere Verlage nicht', !verlagIstAnbieter('Amazon.com, Inc.', 'netflix') && !verlagIstAnbieter('Kazé', 'crunchyroll') && !verlagIstAnbieter('Walt Disney Studios Motion Pictures', 'disneyplus') && !verlagIstAnbieter(undefined, 'netflix'))
const angebotZeile = (platform: PlatformId, date: string, verlag: string) =>
  angebotSeitZeileVon({ angebotSeit: { platform, date }, ...erstausgabe('2026-07-04', verlag) } as unknown as Title, t)
pruefe('Kasten: „Amazon.com, Inc.“ nennt die Erstausgabe schon (früher oder gleich) — keine Zeile „im Angebot seit“ bei Prime Video', angebotZeile('primevideo', '2026-07-04', 'Amazon.com, Inc.') === undefined)
pruefe('Kasten: „The Walt Disney Company“ bei Disney+ — keine Zeile', angebotZeile('disneyplus', '2026-07-05', 'The Walt Disney Company') === undefined)
pruefe('Kasten: Verlag Kazé bei Crunchyroll — die Zeile bleibt', angebotZeile('crunchyroll', '2026-07-04', 'Kazé') !== undefined)
pruefe('Kasten: Verlag Amazon, Angebot bei Netflix — die Zeile bleibt', angebotZeile('netflix', '2026-07-04', 'Amazon.com, Inc.') !== undefined)
pruefe('kastenNenntSeit: Angebot', kastenNenntSeit(angebot('crunchyroll', '2026-07-20') as never, 'crunchyroll', '2026-07-20') && !kastenNenntSeit(angebot('crunchyroll', '2026-07-20') as never, 'crunchyroll', '2026-07-21'))
pruefe('seitDatumFuerPille: Datum, wenn der Kasten schweigt; sonst nichts', seitDatumFuerPille(titel(), 'crunchyroll', [termin()]) === '2026-07-20' && seitDatumFuerPille(titel(angebot('crunchyroll', '2026-07-20')), 'crunchyroll', [termin()]) === undefined)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
