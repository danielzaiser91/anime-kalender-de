/**
 * Zusicherungen zu „Eine API-Adresse ist nie ein Besucher-Link“ an den drei Anzeigestellen (Daniel, 19.10.2026, Madoka Magica):
 * Beleg-Fenster (`BelegAnsicht`), Panel-Quelle (`quelleFuer`) und Quellenübersicht (`terminQuellenJeHost`).
 * Gerendert bzw. aufgerufen wird die echte Komponente, nicht ihr Quelltext. Ergänzt `check-beleg-api.ts` (Bau-Seite).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NewsBeleg, Release } from '../shared/types.ts'
import { adnApiBeleg } from './lib/beleg-api.ts'
import { BelegAnsicht } from '../web/src/components/beleg-dialog.tsx'
import { AbgeloestHinweis } from '../web/src/components/news-abgeloest.tsx'
import { VerlaufZeilen } from '../web/src/components/news-verlauf.tsx'
import { quelleFuer } from '../web/src/components/detail/neuigkeiten.tsx'
import { terminQuellenJeHost } from '../web/src/components/Quellenuebersicht.tsx'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const API = 'https://gw.api.animationdigitalnetwork.com/video/calendar'
const ARTIKEL = 'https://news.animationdigitalnetwork.com/de/2026/09/28/line-up/'
const SERIE = 'https://animationdigitalnetwork.com/de/video/1318-puella-magi-madoka-magica'
const FOLGE = `${SERIE}/29565-folge-1`

console.log('\nBeleg-Fenster: Originalseite')
const html = (b: NewsBeleg) => renderToStaticMarkup(createElement(BelegAnsicht, { beleg: b, zu: () => {} }))
/* Die Messung kommt aus dem Erzeuger (`adnApiBeleg`), nicht von Hand (Prüfer 1598 A8). */
const madoka = { slug: 'adn-1318', name: 'Puella Magi Madoka Magica', platform: 'adn', platformUrl: FOLGE, schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 12 } }
const messung = adnApiBeleg(madoka as unknown as Release, API, '2026-10-17')!.messung!
{
  const mit = html({ url: API, name: 'ADN-Kalender', messung, seite: SERIE })
  pruefe('API-Beleg mit Serienseite: Knopf auf die Serienseite', mit.includes(`href="${SERIE}"`) && mit.includes('Originalseite bei animationdigitalnetwork.com') && !mit.includes('ADN API'), mit)
  pruefe('API-Beleg mit Serienseite: die API-Adresse steht nirgends', !mit.includes('gw.api'), mit)
  pruefe('API-Beleg zeigt seine Messung', mit.includes('12 Folgen') && mit.includes('Datum: 29.10.2026, 09:00 Uhr') && mit.includes('Sprache: Deutsch'), mit)
  const ohne = html({ url: API, name: 'ADN-Kalender', messung })
  pruefe('API-Beleg ohne Serienseite: kein Knopf, keine Adresse', !ohne.includes('Originalseite') && !ohne.includes('<a ') && !ohne.includes('gw.api'), ohne)
  const gewoehnlich = html({ url: ARTIKEL, name: 'news.animationdigitalnetwork.com' })
  pruefe('gewöhnlicher Beleg: Knopf auf seine eigene Adresse', gewoehnlich.includes(`href="${ARTIKEL}"`), gewoehnlich)
}

console.log('\nVerlauf überholter Stände (VerlaufZeilen)')
{
  const verlauf = (belege: NewsBeleg[]) =>
    renderToStaticMarkup(createElement(VerlaufZeilen, { staende: [{ am: '2026-10-10', ueberholtAm: '2026-10-12', m: { art: 'angekuendigt', platform: 'adn', datum: '2026-10-29', belege } as never }] }))
  const mit = verlauf([{ url: API, name: 'ADN-Kalender', messung, seite: SERIE }])
  pruefe('überholter Stand mit API-Beleg und Serienseite: Link auf die Serienseite, API-Adresse nirgends', mit.includes(`href="${SERIE}"`) && !mit.includes('gw.api'), mit)
  const ohne = verlauf([{ url: API, name: 'ADN-Kalender', messung }])
  pruefe('überholter Stand mit API-Beleg ohne Serienseite: nur der Name, kein Link', ohne.includes('ADN-Kalender') && !ohne.includes('<a ') && !ohne.includes('gw.api'), ohne)
  const gewoehnlich = verlauf([{ url: ARTIKEL, name: 'news.animationdigitalnetwork.com' }])
  pruefe('überholter Stand mit gewöhnlichem Beleg: Link auf dessen Adresse', gewoehnlich.includes(`href="${ARTIKEL}"`), gewoehnlich)
  const nurQuelle = (quelle: string) =>
    renderToStaticMarkup(createElement(VerlaufZeilen, { staende: [{ am: '2026-10-10', ueberholtAm: '2026-10-12', m: { art: 'angekuendigt', platform: 'adn', datum: '2026-10-29', quelle } as never }] }))
  const api = nurQuelle(API)
  pruefe('überholter Stand ohne Belege, Quelle ist die API-Adresse: kein Link, kein leerer Beleg (Prüfer 1598 A7)', !api.includes('<a ') && !api.includes('gw.api') && !api.includes('ADN API'), api)
  pruefe('überholter Stand ohne Belege, Quelle ist eine Seite: Link auf sie', nurQuelle(ARTIKEL).includes(`href="${ARTIKEL}"`))
}

console.log('\nAbgelöste Meldung (AbgeloestHinweis)')
{
  const hinweis = (quelle: string) => renderToStaticMarkup(createElement(AbgeloestHinweis, { m: { art: 'angekuendigt', ersetzt: { datum: '2026-10-10', quelle } } as never }))
  const api = hinweis(API)
  pruefe('abgelöst durch eine API-Adresse: Text ohne Link', !api.includes('<a ') && !api.includes('gw.api'), api)
  pruefe('abgelöst durch eine Seite: Link auf sie', hinweis(ARTIKEL).includes(`href="${ARTIKEL}"`))
}

console.log('\nPanel: Quelle des Termins (quelleFuer)')
const release = (extra: Partial<Release>): Release =>
  ({ slug: 'adn-1318', titleId: 1, name: 'Madoka', platform: 'adn', platformUrl: FOLGE, sources: [], ...extra }) as unknown as Release
const wahl = (r: Release) =>
  quelleFuer({ m: { release: r.slug, platform: 'adn' }, teilId: 1 } as never, { releaseBySlug: new Map([[r.slug, r]]), releases: [r], titleById: new Map() } as never)
{
  const quellen = (api: string, artikel: string) => [
    { url: API, name: 'ADN API', gesehenAm: api, stand: 'aktuell' },
    { url: ARTIKEL, name: 'news.animationdigitalnetwork.com', gesehenAm: artikel, stand: 'aktuell' },
  ]
  pruefe('jüngster Beleg ist die API-Adresse: der Artikel wird gewählt', wahl(release({ quellen: quellen('2026-10-17', '2026-10-10') } as Partial<Release>))?.url === ARTIKEL)
  pruefe('jüngster Beleg ist der Artikel: der Artikel wird gewählt', wahl(release({ quellen: quellen('2026-10-10', '2026-10-17') } as Partial<Release>))?.url === ARTIKEL)
  const zwei = [
    { url: ARTIKEL, name: 'a', gesehenAm: '2026-10-10', stand: 'aktuell' },
    { url: FOLGE, name: 'b', gesehenAm: '2026-10-17', stand: 'aktuell' },
  ]
  const jungster = (q: unknown[]) => wahl(release({ quellen: q } as Partial<Release>))?.url
  pruefe('von zwei lesbaren Belegen gilt der jüngste, in jeder Reihenfolge', jungster(zwei) === FOLGE && jungster([...zwei].reverse()) === FOLGE)
  pruefe('API-Adresse zuerst in `sources`: die lesbare wird gewählt', wahl(release({ sources: [API, ARTIKEL] }))?.url === ARTIKEL)
  pruefe('nur die API-Adresse: die Folgen-Seite des Anbieters', wahl(release({ sources: [API], quellen: quellen('2026-10-17', '2026-10-10').slice(0, 1) } as Partial<Release>))?.url === FOLGE)
  pruefe('nur die API-Adresse und keine Seite: kein Link', wahl(release({ sources: [API], platformUrl: undefined }))?.url === undefined)
  const abgeloest = (quelle: string) =>
    quelleFuer({ m: { release: 'adn-1318', platform: 'adn', ersetzt: { datum: '2026-10-10' }, quelle }, teilId: 1 } as never, { releaseBySlug: new Map(), releases: [], titleById: new Map() } as never)
  pruefe('abgelöste Meldung mit API-Adresse als Quelle: kein Link (Prüfer 1598 A6)', abgeloest(API) === undefined, abgeloest(API))
  pruefe('abgelöste Meldung mit Seite als Quelle: ihre damalige Quelle', abgeloest(ARTIKEL)?.url === ARTIKEL, abgeloest(ARTIKEL))
}

console.log('\nQuellenübersicht: Termin-Quellen je Host')
{
  const r = release({
    sources: [API, ARTIKEL],
    quellen: [
      { url: API, name: 'ADN API', gesehenAm: '2026-10-17', stand: 'aktuell' },
      { url: ARTIKEL, name: 'news.animationdigitalnetwork.com', gesehenAm: '2026-10-17', stand: 'aktuell' },
    ],
    schedule: { firstEpisodeDate: '2026-10-29' },
  } as Partial<Release>)
  const zeilen = terminQuellenJeHost([r, r])
  const api = zeilen.find((z) => z.host === 'ADN API')
  pruefe('ADN-API-Host: gezählt, ohne Adresse', api?.anzahl === 2 && api.url === undefined, zeilen)
  pruefe('Artikel-Host: gezählt, mit Adresse', zeilen.find((z) => z.host === 'news.animationdigitalnetwork.com')?.url === ARTIKEL, zeilen)
  const nurSources = terminQuellenJeHost([release({ sources: [API], schedule: { firstEpisodeDate: '2026-10-29' } } as Partial<Release>)])
  pruefe('ohne `quellen`: die API-Adresse aus `sources` bekommt ebenfalls keine Adresse', nurSources[0]?.host === 'gw.api.animationdigitalnetwork.com' && nurSources[0].url === undefined, nurSources)
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nbeleg-api-web: alle Zusicherungen halten')
