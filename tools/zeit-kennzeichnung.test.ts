/**
 * Eine geschätzte Uhrzeit ist in jeder Ausgabe erkennbar: „≈" in Teilseite und Vorschaubild, „ca." in der Mail
 * (HTML und Text, Wiederholungsliste). Eine gemessene Uhrzeit bleibt unmarkiert. Feste Daten, keine Uhr.
 *
 * Aufruf: `npx tsx tools/zeit-kennzeichnung.test.ts`
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { eventDescription } from '../shared/ics.ts'
import { tvAngabe } from '../web/src/lib/tv-angabe.ts'
import { tvZuletzt } from '../web/src/lib/tv-zuletzt.ts'
import { zeitText } from '../web/src/lib/anbieter-kachel.ts'
import { expandEvents } from '../shared/logic.ts'
import { zeitGeschaetzt, zeitMitMarke } from '../shared/zeit-text.ts'
import { terminKopf, terminZeilen } from '../pipeline/lib/og-termin.ts'
import { body, describe } from '../pipeline/lib/termin-seite.ts'
import { digestMail } from '../worker/src/templates.ts'
import { tvWiederholungen, wiederholungsText } from '../worker/src/mail-abschnitte.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const HEUTE = '2026-10-25'

function plan(zusatz: Record<string, unknown>): Release {
  return {
    slug: 'zeit-test',
    titleId: 900001,
    name: 'Zeittest',
    platform: 'netflix',
    platformUrl: 'https://www.netflix.com/title/900001',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-05', time: '17:00', episodeCount: 2, ...zusatz },
    sources: [],
  } as unknown as Release
}

const ctx = { siteUrl: 'https://anime-kalender.de/', links: new Map() } as never
const umfeld = { krumenHtml: '', krumenJsonLd: '', aehnlichHtml: '' }

function fall(titel: string, release: Release, vorsatz: string) {
  const events = expandEvents(release)
  const ev: ReleaseEvent = events[0]!
  console.log(titel)
  const zeile = terminZeilen(release, events, HEUTE).find((z) => z.label === 'Uhrzeit')?.value
  pruefe(zeile === (vorsatz ? '≈ 17:00 Uhr' : '17:00 Uhr'), `Bild Zeile: ${zeile}`)
  const kopf = terminKopf(release, events, HEUTE)
  pruefe(!!kopf && kopf.fakt.includes(vorsatz ? '≈ 17:00 Uhr' : '17:00 Uhr') && (!!vorsatz || !kopf.fakt.includes('≈')), `Bild Kopf: ${kopf?.fakt}`)
  const beschr = describe(release, undefined, HEUTE)
  pruefe(beschr.includes(vorsatz ? ' um ≈ 17:00 Uhr' : ' um 17:00 Uhr'), `Beschreibung: ${beschr}`)
  const seite = body(release, undefined, undefined, HEUTE, [], 1, 'zeit-test', umfeld)
  pruefe(seite.includes(vorsatz ? ' um ≈ 17:00 Uhr' : ' um 17:00 Uhr') && (!!vorsatz || !seite.includes('≈')), 'Teilseite Terminliste')
  const mail = digestMail([ev], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
  const mailVorsatz = vorsatz ? 'ca. 17:00 Uhr' : '17:00 Uhr'
  pruefe(mail.text.includes(` — ${mailVorsatz}`) && (!!vorsatz || !mail.text.includes('ca.')), `Mail Text`)
  pruefe(mail.html.includes(mailVorsatz) && (!!vorsatz || !mail.html.includes('ca. 17')), 'Mail HTML')
  const wdh = wiederholungsText([ev])
  pruefe(wdh.includes(mailVorsatz) && (!!vorsatz || !wdh.includes('ca.')), `Wiederholung Text: ${wdh}`)
  pruefe(tvWiederholungen(ctx, [ev]).includes(mailVorsatz) && (!!vorsatz || !tvWiederholungen(ctx, [ev]).includes('ca.')), 'Wiederholung HTML')
}

fall('gemessen', plan({}), '')
fall('timeEstimated', plan({ timeEstimated: true }), 'ca. ')
fall('estimated-Termin mit Uhrzeit', plan({ estimated: true }), 'ca. ')

function zusatzFaelle(): void {
  console.log('A1/A2: eine Marke je Zeile')
  const est = plan({ estimated: true })
  const mail = digestMail([expandEvents(est)[0]!], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
  pruefe(mail.html.includes('ca. 17:00') && !mail.html.includes('geschätzt'), 'HTML-Mail: estimated mit Uhrzeit nur „ca."')
  const ohneZeit = plan({ estimated: true, time: undefined })
  const mailOhne = digestMail([expandEvents(ohneZeit)[0]!], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
  pruefe(mailOhne.html.includes('geschätzt') && !mailOhne.html.includes('ca.'), 'HTML-Mail: estimated ohne Uhrzeit bleibt „geschätzt"')
  const seite = body(est, undefined, undefined, HEUTE, [], 1, 'zeit-test', umfeld)
  pruefe(seite.includes('≈ 17:00 Uhr') && !seite.includes('Termin abgeleitet'), 'Teilseite: estimated mit Uhrzeit nur „≈"')
  const seiteOhne = body(ohneZeit, undefined, undefined, HEUTE, [], 1, 'zeit-test', umfeld)
  pruefe(seiteOhne.includes('(Termin abgeleitet)') && !seiteOhne.includes('≈'), 'Teilseite: estimated ohne Uhrzeit bleibt „abgeleitet"')
  const gemessenOhne = plan({ time: undefined })
  pruefe(!body(gemessenOhne, undefined, undefined, HEUTE, [], 1, 'zeit-test', umfeld).includes('abgeleitet'), 'Teilseite: gemessener Termin ohne Uhrzeit ohne „abgeleitet"')
  pruefe(!digestMail([expandEvents(gemessenOhne)[0]!], 'daily', 'https://anime-kalender.de/', 'https://x/u', {}).html.includes('geschätzt'), 'HTML-Mail: gemessener Termin ohne Uhrzeit ohne „geschätzt"')

  console.log('A6: jeder Termin, Disc')
  const zwei = body(plan({ timeEstimated: true }), undefined, undefined, HEUTE, [], 1, 'zeit-test', umfeld)
  pruefe(zwei.split('≈ 17:00 Uhr').length === 3, 'Teilseite: Marke an beiden Terminen der Liste')
  const evs = expandEvents(plan({ timeEstimated: true }))
  const gemessen = { ...evs[1]!, timeEstimated: false }
  const gemischt = digestMail([evs[0]!, gemessen], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
  pruefe(gemischt.text.split('ca. 17:00 Uhr').length === 2 && gemischt.text.split('17:00 Uhr').length === 3, 'Mail Text: „ca." nur am geschätzten von zwei Terminen')
  const disc = plan({ time: undefined, estimated: true })
  disc.releaseType = 'disc'
  const discMail = digestMail([expandEvents(disc)[0]!], 'daily', 'https://anime-kalender.de/', 'https://x/u', {})
  pruefe(discMail.text.includes('im Handel') && !discMail.text.includes('ca.') && !discMail.html.includes('ca.'), 'Disc: „im Handel" ohne Uhrzeitmarke')
  const discKopf = terminKopf(disc, expandEvents(disc), HEUTE)
  pruefe(!!discKopf && discKopf.fakt.includes('im Handel') && !discKopf.fakt.includes('≈'), 'Disc: Bildkopf „im Handel" ohne ≈')

  console.log('A3: TV, Pille, ICS')
  const tv = { ...plan({ estimated: true }), platform: 'tv' } as Release
  const pille = tvAngabe(tv, {} as Title, [], HEUTE, '12:00')
  pruefe(!!pille && pille.text.includes('≈ 17:00') && pille.zeit?.includes('≈ 17:00') === true, `TV-Pille: ${pille?.text}`)
  const tvGemessen = tvAngabe({ ...plan({}), platform: 'tv' } as Release, {} as Title, [], HEUTE, '12:00')
  pruefe(!!tvGemessen && tvGemessen.text.includes('17:00') && !tvGemessen.text.includes('≈'), 'TV-Pille gemessen ohne ≈')
  const vergangen = tvZuletzt([{ ...plan({ estimated: true, firstEpisodeDate: '2026-10-01', episodeCount: 1 }), platform: 'tv' } as Release], HEUTE, '12:00')
  pruefe(vergangen[0]?.text.includes('≈ 17:00') === true, `TV zuletzt: ${vergangen[0]?.text}`)
  const ics = (z: Partial<ReleaseEvent>) => eventDescription({ ...evs[0]!, timeEstimated: false, estimated: false, ...z })
  pruefe(ics({ estimated: true }).includes('Uhrzeit voraussichtlich, nicht gemessen.'), 'ICS: estimated mit Uhrzeit trägt den Uhrzeit-Hinweis')
  pruefe(ics({ timeEstimated: true }).includes('Netflix veröffentlicht Anime meist um 17:00'), 'ICS: timeEstimated bei Netflix mit Netflix-Satz')
  pruefe(!ics({ estimated: true }).includes('Netflix veröffentlicht'), 'ICS: estimated allein ohne Netflix-Satz')
  pruefe(!ics({}).includes('Uhrzeit voraussichtlich'), 'ICS: gemessen ohne Hinweis')
  pruefe(!ics({ estimated: true, time: undefined }).includes('Uhrzeit voraussichtlich'), 'ICS: estimated ohne Uhrzeit ohne Uhrzeit-Hinweis')
  pruefe(zeitText({ ...evs[0]!, estimated: true }) === '≈ 17:00' && zeitText({ ...evs[0]!, timeEstimated: false, estimated: false }) === '17:00', 'Kachel zeitText')
}
zusatzFaelle()

console.log('Helfer')
pruefe(zeitMitMarke({ time: '17:00' }, '≈ ') === '17:00', 'gemessen: unmarkiert')
pruefe(zeitMitMarke({ time: '17:00', timeEstimated: true }, '≈ ') === '≈ 17:00', 'timeEstimated: ≈')
pruefe(zeitMitMarke({ time: '17:00', estimated: true }, 'ca. ') === 'ca. 17:00', 'estimated: ca.')
pruefe(zeitMitMarke({ timeEstimated: true }, '≈ ') === '', 'ohne Uhrzeit leer')
pruefe(!zeitGeschaetzt({ time: '17:00' }) && zeitGeschaetzt({ estimated: true }), 'zeitGeschaetzt')

if (fehler > 0) {
  console.error(`zeit-kennzeichnung: ${fehler} Fehler`)
  process.exit(1)
}
console.log('zeit-kennzeichnung: ok')
