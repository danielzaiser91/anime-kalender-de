/**
 * Zusicherungen zu den Chips im Detail-Panel (14.10.2026, Daniel am Panel Snowball Earth): Prime-Kanal-Termin mit „Deutsch“ und
 * Folgen, „seit“-Datum an den Stream-Chips, keine zweite Pille für dieselbe Seite. Erfundene Titel, kein Bestand.
 * Aufruf: `npm run check:logic`.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { formatDate } from '../shared/time.ts'
import { streamZeilen, terminPillen } from '../web/src/components/detail/wege-zeilen.tsx'
import { adresseOhneSprache, ausgabenOhneDeSichtbar, kanalTerminQuelle, seitDatumVon } from '../web/src/components/detail/chips-regeln.ts'

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

console.log('\nAdresse ohne Sprachsegment:')
pruefe('Crunchyroll: /de/series/X gleich /series/X', adresseOhneSprache('https://www.crunchyroll.com/de/series/GT1/x') === adresseOhneSprache('https://crunchyroll.com/series/GT1/x?a=1'))
pruefe('Disney+: /de-de/browse/… gleich /browse/…', adresseOhneSprache('https://www.disneyplus.com/de-de/browse/entity-1') === adresseOhneSprache('https://www.disneyplus.com/browse/entity-1'))
pruefe('Amazon: „/dp/“ ist keine Sprache', adresseOhneSprache('https://www.amazon.de/dp/B0AAAAAAAA') !== adresseOhneSprache('https://www.amazon.de/B0AAAAAAAA'), adresseOhneSprache('https://www.amazon.de/dp/B0AAAAAAAA'))
pruefe('Amazon: „/gp/video/detail/“ bleibt, wie es ist', adresseOhneSprache('https://www.amazon.de/gp/video/detail/B0AAAAAAAA') === 'amazon.de/gp/video/detail/b0aaaaaaaa', adresseOhneSprache('https://www.amazon.de/gp/video/detail/B0AAAAAAAA'))
pruefe('Andere Serie bleibt verschieden', adresseOhneSprache('https://www.crunchyroll.com/de/series/GT1/x') !== adresseOhneSprache('https://www.crunchyroll.com/series/GT2/x'))

console.log('\nAusgabe ohne Deutsch neben demselben Chip:')
const gleiche = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/GT1/x' }
const andere = { platform: 'primevideo', url: 'https://www.amazon.de/dp/B0AAAAAAAA', kanal: 'Crunchyroll' }
pruefe('gleiche Seite wie ein Verweis (nur Sprachsegment verschieden): ausgeblendet', ausgabenOhneDeSichtbar(titel({ ausgabenOhneDe: [gleiche] as never })).length === 0)
pruefe('gleiche Seite wie ein Bezugsweg: ausgeblendet', ausgabenOhneDeSichtbar(titel({ streams: [], watchLinks: [{ name: 'X', url: 'https://www.crunchyroll.com/de/series/GT1/x', kind: 'stream' }] as never, ausgabenOhneDe: [gleiche] as never })).length === 0)
pruefe('andere Adresse (andere Prime-Kennung): bleibt', ausgabenOhneDeSichtbar(titel({ ausgabenOhneDe: [andere, gleiche] as never })).map((a) => a.url).join() === andere.url)
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

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
