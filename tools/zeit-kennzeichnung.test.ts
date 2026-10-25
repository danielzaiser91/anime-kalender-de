/**
 * Eine geschätzte Uhrzeit ist in jeder Ausgabe erkennbar: „≈" in Teilseite und Vorschaubild, „ca." in der Mail
 * (HTML und Text, Wiederholungsliste). Eine gemessene Uhrzeit bleibt unmarkiert. Feste Daten, keine Uhr.
 *
 * Aufruf: `npx tsx tools/zeit-kennzeichnung.test.ts`
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
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
