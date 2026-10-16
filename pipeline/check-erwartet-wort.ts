/**
 * „angekündigt“ oder „erwartet“ (PR „erwartet statt angekündigt“, 15.10.2026): Meldung, Detailfenster und
 * Mail fragen dieselbe Stelle (`tagIstAngekuendigt`) und müssen für denselben Tag dasselbe Wort sagen.
 */
import type { NewsEintrag, Release, ReleaseEvent } from '../shared/types.ts'
import { ausgebliebenTerminText } from '../web/src/components/detail/kasten-texte.ts'
import { newsSatz } from '../web/src/lib/news-text.ts'
import { digestMail } from '../worker/src/templates.ts'
import { verpasstAmTermin } from './bau/verpasst-am-termin.ts'
import { verspaetungsMeldungen } from './lib/news-verspaetung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.log(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const FOTO = { url: 'https://x/a', gesehenAm: '2026-10-12T11:00:00.000Z', bild: 'www.crunchyroll.com/wochenprogramm/b.webp', bildAm: '2026-10-15T13:00:00.000Z' }
const tag = (n: number) => `2026-09-${String(n).padStart(2, '0')}T08:30:00.000Z`

/** Eine Reihe mit Folgen 8 bis 10, die am 04.10. zusammen kamen; `fotos` nennt die Folgen mit Foto der Ankündigung. */
function reihe(fotos: number[], geschaetzt: boolean, extra: object = {}): Release {
  const vermerk = (nr: number, erwartetAm: string) => ({ slug: 'x', episode: nr, erwartetAm, erschienenAm: '2026-10-04T08:30:00.000Z', ...(fotos.includes(nr) ? { wocheBeleg: FOTO } : {}) })
  const verpasst = verpasstAmTermin('x', [vermerk(8, tag(13)), vermerk(9, tag(20)), vermerk(10, tag(27))] as never)
  return { slug: 'x', titleId: 1, name: 'X', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-29', ...(geschaetzt ? { estimated: true } : {}), verpasst, ...extra } } as unknown as Release
}
const nachgereicht = (r: Release) => verspaetungsMeldungen(r).find((m) => m.art === 'nachgereicht')!

console.log('\nGebündelte Folgen: angekündigt nur, wenn alle belegt sind')
{
  pruefe('drei Folgen, nur eine mit Foto: „erwartet waren“', newsSatz(nachgereicht(reihe([9], true))) === 'Folgen 8–10 sind da, erwartet waren 13.09., 20.09. und 27.09.', newsSatz(nachgereicht(reihe([9], true))))
  pruefe('drei Folgen, alle mit Foto: „angekündigt waren“', newsSatz(nachgereicht(reihe([8, 9, 10], true))) === 'Folgen 8–10 sind da, angekündigt waren 13.09., 20.09. und 27.09.')
  const plan = { observed: { 11: '2026-10-04' } }
  pruefe('mit planmäßiger Folge, nicht belegt: „erwartet waren“', newsSatz(nachgereicht(reihe([], true, plan))).includes('mit der geplanten Folge 11 erschienen, erwartet waren'), newsSatz(nachgereicht(reihe([], true, plan))))
  pruefe('mit planmäßiger Folge, belegt: „angekündigt waren“', newsSatz(nachgereicht(reihe([8, 9, 10], true, plan))).includes('erschienen, angekündigt waren'))
}

console.log('\nEine Folge mit planmäßiger Folge am selben Tag')
{
  const einzeln = (foto: boolean) => {
    const v = { slug: 'x', episode: 8, erwartetAm: tag(13), erschienenAm: '2026-10-04T08:30:00.000Z', ...(foto ? { wocheBeleg: FOTO } : {}) }
    const r = { slug: 'x', titleId: 1, name: 'X', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-29', estimated: true, observed: { 9: '2026-10-04' }, verpasst: verpasstAmTermin('x', [v] as never) } } as unknown as Release
    return newsSatz(nachgereicht(r))
  }
  pruefe('ohne Foto: „erwartet war“', einzeln(false) === 'Folge 8 ist verspätet zusammen mit der geplanten Folge 9 erschienen, erwartet war der 13.09.2026', einzeln(false))
  pruefe('mit Foto: „angekündigt war“', einzeln(true) === 'Folge 8 ist verspätet zusammen mit der geplanten Folge 9 erschienen, angekündigt war der 13.09.2026', einzeln(true))
}

console.log('\nOffener Ausfall: die Meldung folgt dem Plan (geschätzt oder nicht), wie das Detailfenster')
{
  const offen = (geschaetzt: boolean, foto: boolean) => {
    const v = { slug: 'x', episode: 12, erwartetAm: '2026-10-14T17:25:00.000Z', ...(foto ? { wocheBeleg: FOTO } : {}) }
    const r = { slug: 'x', titleId: 1, name: 'X', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-29', episodeCount: 13, ...(geschaetzt ? { estimated: true } : {}), verpasst: verpasstAmTermin('x', [v] as never) } } as unknown as Release
    return newsSatz(verspaetungsMeldungen(r).find((m) => m.art === 'verspaetet')!)
  }
  pruefe('geschätzt, ohne Foto: „erwartet“', offen(true, false) === 'Folge 12 war für den 14.10.2026 erwartet und ist nicht erschienen', offen(true, false))
  pruefe('geschätzt, mit Foto: „angekündigt“', offen(true, true) === 'Folge 12 war für den 14.10.2026 angekündigt und ist nicht erschienen')
  pruefe('nicht geschätzt, ohne Foto: „angekündigt“', offen(false, false) === 'Folge 12 war für den 14.10.2026 angekündigt und ist nicht erschienen', offen(false, false))
}

console.log('\nEin Kriterium für Meldung, Detailfenster und Mail')
{
  const T = (k: string) => k
  const ev = (estimated: boolean | undefined, foto = false) => ({ releaseSlug: 'x', titleId: 1, name: 'Hana-Kimi', date: '2026-09-30', platform: 'crunchyroll', releaseType: 'weekly', episode: 12, estimated, verpasst: { erwartetAm: '2026-09-30', ...(foto ? { wocheBeleg: FOTO } : {}) } }) as unknown as ReleaseEvent
  const mail = (e: ReleaseEvent, news: NewsEintrag[] = []) => digestMail([e], 'daily', 'https://anime-kalender.de/', 'https://x/u', { news })
  pruefe('Detailfenster: geschätzt ohne Foto = erwartet', ausgebliebenTerminText(ev(true), T) === 'antwort.erwartetFuer')
  pruefe('Detailfenster: geschätzt mit Foto = angekündigt', ausgebliebenTerminText(ev(true, true), T) === 'antwort.angekuendigtFuer')
  pruefe('Detailfenster: nicht geschätzt = angekündigt', ausgebliebenTerminText(ev(false), T) === 'antwort.angekuendigtFuer')
  pruefe('Mail (HTML und Text): geschätzt ohne Foto = „erwartet für“', /erwartet für 30\.09\.2026/.test(mail(ev(true)).html) && /erwartet für 30\.09\.2026/.test(mail(ev(true)).text) && !/angekündigt für/.test(mail(ev(true)).html + mail(ev(true)).text))
  pruefe('Mail (HTML und Text): geschätzt mit Foto = „angekündigt für“', /angekündigt für 30\.09\.2026/.test(mail(ev(true, true)).html) && /angekündigt für 30\.09\.2026/.test(mail(ev(true, true)).text))
  pruefe('Mail: nicht geschätzt = „angekündigt für“', /angekündigt für 30\.09\.2026/.test(mail(ev(false)).html))

  const meldung = { art: 'verspaetet', platform: 'crunchyroll', datum: '2026-09-30', von: 12, release: 'x' }
  const eintrag = (m: object): NewsEintrag => ({ am: '2026-10-01', titelId: 1, titel: 'Hana-Kimi', slug: 'x', meldungen: [m] }) as never
  const doppelt = mail(ev(true), [eintrag(meldung)])
  pruefe('derselbe Ausfall steht in der Mail nur einmal: die Meldung ersetzt den Block „Verschoben“', !doppelt.html.includes('Verschoben oder ausgeblieben') && !doppelt.text.includes('VERSCHOBEN') && doppelt.html.includes('Folge 12 war für den 30.09.2026 erwartet'), doppelt.html.slice(0, 80))
  const anderer = mail(ev(true), [eintrag({ ...meldung, datum: '2026-09-23' })])
  pruefe('eine Meldung zu einem anderen Tag nimmt den Block nicht weg', anderer.html.includes('Verschoben oder ausgeblieben'))
  const fremd = mail(ev(true), [eintrag({ ...meldung, release: 'andere-serie' })])
  pruefe('eine Meldung derselben Tageszahl zu einer anderen Serie nimmt den Block nicht weg', fremd.html.includes('Verschoben oder ausgeblieben'))
  const nach = mail(ev(true), [eintrag({ art: 'nachgereicht', platform: 'crunchyroll', datum: '2026-10-02', von: 12, bis: 12, erwartet: ['2026-09-30'], release: 'x' })])
  pruefe('eine Nachreich-Meldung zu diesem Tag nimmt den Block ebenfalls weg', !nach.html.includes('Verschoben oder ausgeblieben'))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
