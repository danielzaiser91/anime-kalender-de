/**
 * Zusicherung (Daniel, 21.10.2026, Yaiba): Die Termin-Pille im Anbieter-Kasten.
 *  - Ein TV-Termin ohne Programm-Adresse (Ankündigung) führt mit dem Fernseh-Zeichen zur Quelle; mit Programm-Adresse zum Programm.
 *  - Die Disc-Pille nennt die Ausgabe einmal, ohne Medium, und trägt das Datum in der Farbe der TV-Termine (`text-ak-tv`).
 *  - Alle Pillen sind eckig (`rounded-xl`), nicht rund.
 * Feste Zeit, keine Uhr. Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release } from '../shared/types.ts'
import { TerminZeile } from '../web/src/components/detail/termin-zeile.tsx'
import { kurzeAusgabe } from '../web/src/components/detail/disc-ausgabe.ts'
import { tvQuelle } from '../web/src/components/detail/tv-quelle.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-21'
const QUELLE = 'https://www.anime2you.de/news/900001/probe/'
const PROGRAMM = 'https://www.tvspielfilm.de/probe-programm'
const tvTermin = (extra: object = {}): Release =>
  ({
    slug: 'probe-tv',
    titleId: 900101,
    name: 'Probe',
    platform: 'tv',
    sender: 'ProSieben MAXX',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24 },
    year: 2026,
    sources: [QUELLE],
    quellen: [{ url: QUELLE, name: 'Anime2You News' }],
    ...extra,
  }) as unknown as Release
const discTermin = (extra: object = {}): Release =>
  ({
    slug: 'probe-disc',
    titleId: 900101,
    name: 'Probe – Vol. 1',
    platform: 'disc',
    releaseType: 'disc',
    publisher: 'peppermint anime GmbH',
    edition: 'Staffel 1 - Vol. 1/2: Limited Edition Blu-ray + Sammelschuber · Staffel 1 - Vol. 1/2 Blu-ray',
    buyUrl: 'https://www.amazon.de/s?k=Probe',
    schedule: { firstEpisodeDate: '2026-12-04' },
    year: 2026,
    sources: ['https://www.amazon.de/s?k=Probe'],
    ...extra,
  }) as unknown as Release
const zeile = (release: Release, tvText?: { text: string; premiere: boolean; programm?: string; zeit?: string }): string =>
  renderToStaticMarkup(createElement(TerminZeile, { release, titel: 'Probe', today: HEUTE, tvText }))
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const links = (html: string): string[] => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'))
const tvAngabe = { text: 'Fg. 1 · Do 05.11. 18:25', premiere: true, zeit: 'Do 05.11. 18:25' }

console.log('\nTV-Pille:')
const ankuendigung = zeile(tvTermin(), tvAngabe)
pruefe('Ankündigung ohne Programm: Fernseh-Zeichen führt zur Quelle', links(ankuendigung).includes(QUELLE), links(ankuendigung))
pruefe('… mit dem Namen der Quelle im Hinweis', ankuendigung.includes('Quelle des Termins: Anime2You News'))
const mitProgramm = zeile(tvTermin(), { ...tvAngabe, programm: PROGRAMM })
pruefe('mit Programm-Adresse: Fernseh-Zeichen führt ins Programm', links(mitProgramm).includes(PROGRAMM) && !links(mitProgramm).includes(QUELLE), links(mitProgramm))
const nurSources = tvTermin({ quellen: undefined })
pruefe('ohne `quellen` gilt die erste Adresse aus `sources`', tvQuelle(nurSources)?.url === QUELLE && tvQuelle(nurSources)?.name === 'anime2you.de', tvQuelle(nurSources))
const ohneQuelle = zeile(tvTermin({ quellen: undefined, sources: [] }), tvAngabe)
const ANDERE = 'https://www.example.org/anderswo'
const beide = tvQuelle(tvTermin({ quellen: [{ url: QUELLE, name: 'anime2you.de' }], sources: [ANDERE] }))
pruefe('`quellen` geht vor `sources`', beide?.url === QUELLE, beide)
const ohneName = tvQuelle(tvTermin({ quellen: [{ url: QUELLE }] }))
pruefe('eine Quelle ohne Namen heißt wie ihr Host', ohneName?.name === 'anime2you.de', ohneName)
pruefe('keine Quelle, kein Fernseh-Zeichen', !ohneQuelle.includes('Quelle des Termins') && !ohneQuelle.includes('Im TV-Programm'), links(ohneQuelle))
const kaputt = tvQuelle(tvTermin({ quellen: [{ url: 'https://' }], sources: ['http://', QUELLE] }))
pruefe('unparsbare http-Adresse wirft nicht, die nächste gültige gilt', kaputt?.url === QUELLE, kaputt)
pruefe('nur unparsbare http-Adressen ergeben keine Quelle', tvQuelle(tvTermin({ quellen: [{ url: 'https://' }], sources: ['https://'] })) === undefined)
pruefe('eine Adresse ohne http(s) wird nicht verlinkt', tvQuelle(tvTermin({ quellen: [{ url: 'javascript:alert(1)', name: 'x' }], sources: ['ftp://x'] })) === undefined)
pruefe('Tag und Uhrzeit tragen `text-ak-tv`', ankuendigung.includes('text-ak-tv">Do 05.11. 18:25'))

console.log('\nDisc-Pille:')
const disc = zeile(discTermin())
const discText = text(disc)
pruefe('Format, Händler, Ausgabe in einer Zeile', discText.includes('Blu-ray Kaufen bei Amazon peppermint anime GmbH · Staffel 1'), discText)
pruefe('Ausgabe steht einmal', discText.split('Vol. 1/2').length === 2, discText)
pruefe('Ausgabe ohne Medium-Wort und ohne Sammelschuber-Rest', discText.includes('Staffel 1 - Vol. 1/2: Limited Edition + Sammelschuber'), discText)
pruefe('Datum in `text-ak-tv`', disc.includes('text-ak-tv">04.12.2026'), disc)
pruefe('Datum steht einmal', discText.split('04.12.2026').length === 2, discText)
pruefe('ein Stream-Termin färbt kein Datum', !zeile(tvTermin({ platform: 'primevideo', sender: undefined, releaseType: 'weekly' })).includes('text-ak-tv'))
const ohneDatum = zeile(discTermin({ schedule: {} }))
pruefe('Disc ohne Datum: nichts gefärbt', !ohneDatum.includes('text-ak-tv'))
const gleich = (e: string): string | undefined => kurzeAusgabe(e)
pruefe('„Komplettset Blu-ray · Komplettset“ → „Komplettset“', gleich('Komplettset Blu-ray · Komplettset') === 'Komplettset', gleich('Komplettset Blu-ray · Komplettset'))
pruefe('„Standard & Limited Edition, Blu-ray“ → ohne Medium', gleich('Standard & Limited Edition, Blu-ray') === 'Standard & Limited Edition', gleich('Standard & Limited Edition, Blu-ray'))
pruefe('zwei verschiedene Ausgaben bleiben beide', gleich('Vol. 1 · Vol. 2') === 'Vol. 1 · Vol. 2', gleich('Vol. 1 · Vol. 2'))
pruefe('steht die kürzere Fassung vorn, bleibt die längere', gleich('Komplettset · Komplettset Limited Edition Blu-ray') === 'Komplettset Limited Edition', gleich('Komplettset · Komplettset Limited Edition Blu-ray'))
pruefe('ein Medium am Ende nimmt sein „+“ mit', gleich('Limited Edition Blu-ray + DVD') === 'Limited Edition', gleich('Limited Edition Blu-ray + DVD'))
pruefe('nur das Medium → nichts', gleich('Blu-ray') === undefined, gleich('Blu-ray'))
pruefe('ohne Angabe → nichts', gleich('') === undefined)

console.log('\nForm:')
pruefe('TV-Pille ist eckig, nicht rund', !ankuendigung.includes('rounded-full"') && ankuendigung.includes('rounded-xl'))
pruefe('Disc-Pille ist eckig, nicht rund', !disc.includes('rounded-full py') && disc.includes('rounded-xl'))

console.log(`\nTermin-Pille: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
