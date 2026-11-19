/**
 * Die Gründe `abo-ohne-ton` und `nur-disc` in `ohne-weg.json` (19.11.2026): Beleg, Sperren, Vorrang, Anzeigesatz. Je Zusicherung ein Fall, der ohne sie rot wird.
 * Die übrigen Gründe prüft `check-ohne-weg.ts`. Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, type OhneWegEingabe } from './lib/ohne-weg.ts'
import type { OhneWegEintrag } from '../shared/ohne-weg.ts'
import { ohneWegText } from '../web/src/components/detail/ohne-weg.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-18'
type Befund = OhneWegEingabe['justwatch'][string]
type Angebot = { art: string; audio?: string[] }
const titel = (id: number, extra: Record<string, unknown> = {}) => ({ id, format: 'TV', streams: [], ...extra }) as unknown as OhneWegEingabe['titel'][number]
const befund = (jwId: string | undefined, angebote: Angebot[], extra: Record<string, unknown> = {}) =>
  ({ geprueftAm: '2026-11-17', ...(jwId ? { jwId, tmdbId: 1 } : {}), angebote: angebote.map((a) => ({ anbieter: 'X', ...a })), ...extra }) as unknown as Befund
const ohneTreffer = (extra: Record<string, unknown> = {}) => befund(undefined, [], { ohneTreffer: true, ...extra })
const disc = (datum: string) => [{ datum }]
const lauf = (eingabe: Partial<OhneWegEingabe>): Record<number, OhneWegEintrag> =>
  baueOhneWeg({ titel: [], termine: [], handbelege: [], justwatch: {}, discAusgaben: {}, heute: HEUTE, ...eingabe })
/** Ein Titel (Kennung 900001) mit diesem Befund; `extra` setzt Disc, Termine, Handbelege oder Format. */
const einzeln = (b: Befund | undefined, extra: Partial<OhneWegEingabe> = {}, t: Record<string, unknown> = {}) =>
  lauf({ titel: [titel(900001, t)], justwatch: b ? { 900001: b } : {}, ...extra })[900001]

console.log('\nabo-ohne-ton')
const abo = einzeln(befund('a1', [{ art: 'FLATRATE', audio: ['en', 'ja'] }]))
pruefe('Abo mit belegtem Ton ohne Deutsch: Grund, Tag aus geprueftAm, Quelle JustWatch', abo?.reason === 'abo-ohne-ton' && abo.checkedAt === '2026-11-17' && abo.source === 'justwatch', abo)
for (const art of ['ADS', 'FREE', 'FAST']) pruefe(`Art ${art} zählt als Stream ohne Kauf`, einzeln(befund('a2', [{ art, audio: ['en'] }]))?.reason === 'abo-ohne-ton')
pruefe('Gegenfall: Tonliste leer heißt unbekannt, nicht „kein Deutsch“', einzeln(befund('a3', [{ art: 'FLATRATE', audio: [] }]))?.reason === 'offen')
pruefe('Gegenfall: Tonliste fehlt', einzeln(befund('a3', [{ art: 'FLATRATE' }]))?.reason === 'offen')
pruefe('Gegenfall: ein Abo-Angebot ohne Deutsch, ein zweites mit leerer Liste', einzeln(befund('a4', [{ art: 'FLATRATE', audio: ['en'] }, { art: 'ADS', audio: [] }]))?.reason === 'offen')
pruefe('Gegenfall: ein zweites Abo-Angebot nennt Deutsch', einzeln(befund('a5', [{ art: 'FLATRATE', audio: ['en'] }, { art: 'FLATRATE', audio: ['de'] }]))?.reason === 'offen')
const staffel = befund('a6', [{ art: 'FLATRATE', audio: ['en'] }], { staffeln: [{ nr: 2, folgen: 12, angebote: [{ anbieter: 'X', art: 'FLATRATE', audio: ['de'] }] }] })
pruefe('Gegenfall: Deutsch nur im Staffel-Angebot', einzeln(staffel)?.reason === 'offen')
const nurStaffel = befund('a7', [], { staffeln: [{ nr: 1, folgen: 12, angebote: [{ anbieter: 'X', art: 'FLATRATE', audio: ['en'] }] }] })
pruefe('Abo nur in einer Staffel, ohne Deutsch: Grund', einzeln(nurStaffel)?.reason === 'abo-ohne-ton')
pruefe('Kauf-Angebot daneben ändert nichts (der Satz spricht nur vom Stream)', einzeln(befund('a8', [{ art: 'BUY', audio: ['de'] }, { art: 'FLATRATE', audio: ['en'] }]))?.reason === 'abo-ohne-ton')
pruefe('Gegenfall: nur Kino-Angebot ist kein Abo', einzeln(befund('a9', [{ art: 'CINEMA', audio: ['en'] }]))?.reason === 'offen')
pruefe('Gegenfall: Befund 28 Tage alt', einzeln(befund('b1', [{ art: 'FLATRATE', audio: ['en'] }], { geprueftAm: '2026-10-21' }))?.reason === 'offen')
pruefe('Befund 27 Tage alt gilt', einzeln(befund('b2', [{ art: 'FLATRATE', audio: ['en'] }], { geprueftAm: '2026-10-22' }))?.reason === 'abo-ohne-ton')
pruefe('Gegenfall: verfehlter Befund', einzeln(befund('b3', [{ art: 'FLATRATE', audio: ['en'] }], { verfehltAm: '2026-11-17' }))?.reason === 'offen')
const geteilt = lauf({
  titel: [titel(900002), titel(900003)],
  justwatch: { 900002: befund('gleich', [{ art: 'FLATRATE', audio: ['en'] }], { tmdbId: 6 }), 900003: befund('gleich', [{ art: 'FLATRATE', audio: ['en'] }], { tmdbId: 7 }) },
})
pruefe('Gegenfall: eine JustWatch-Kennung an zwei Titeln', geteilt[900002]?.reason === 'offen' && geteilt[900003]?.reason === 'offen', geteilt)
const cartoon = lauf({ titel: [titel(-900004)], justwatch: { '-900004': befund('c1', [{ art: 'FLATRATE', audio: ['en'] }]) } })
pruefe('Cartoon (negative Kennung) bekommt den Grund', cartoon[-900004]?.reason === 'abo-ohne-ton', cartoon)

console.log('\nnur-disc')
const d1 = einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2020-01-01') } })
pruefe('ohneTreffer und erschienene Disc: Grund, Tag des JustWatch-Eintrags, Quelle disc', d1?.reason === 'nur-disc' && d1.checkedAt === '2026-11-17' && d1.source === 'disc', d1)
const d2 = einzeln(befund('d1', []), { discAusgaben: { 900001: disc('2020-01-01') } })
pruefe('Gefundener Titel ohne Angebot und erschienene Disc (Serie): Grund', d2?.reason === 'nur-disc' && d2.source === 'disc', d2)
pruefe('Kauf-Angebot neben der Disc: nur-kauf geht vor', einzeln(befund('d2', [{ art: 'BUY' }]), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'nur-kauf')
pruefe('Film ohne Angebot: film-ohne-abo geht vor', einzeln(befund('d3', []), { discAusgaben: { 900001: disc('2020-01-01') } }, { format: 'MOVIE' })?.reason === 'film-ohne-abo')
pruefe('Abo ohne Deutsch: abo-ohne-ton geht vor', einzeln(befund('d4', [{ art: 'FLATRATE', audio: ['en'] }]), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'abo-ohne-ton')
pruefe('Handbeleg Originalton geht vor', einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2020-01-01') }, handbelege: [{ anilistId: 900001, platform: 'prime', dub: false, checkedAt: '2026-10-01' } as never] })?.reason === 'kein-dub')
pruefe('Künftiger Streamstart geht vor', einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2020-01-01') }, termine: [{ titleId: 900001, platform: 'netflix', date: '2026-12-01' }] })?.reason === 'angekuendigt')
pruefe('Gegenfall: ohne JustWatch-Eintrag kein Grund (kein Tag aus der Quelle)', einzeln(undefined, { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: ohne Disc kein Grund', einzeln(ohneTreffer())?.reason === 'offen')
pruefe('Gegenfall: Disc eines anderen Titels', einzeln(ohneTreffer(), { discAusgaben: { 900009: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Disc am Stichtag zählt (Grenze genau heute)', einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2026-11-18') } })?.reason === 'nur-disc')
pruefe('Gegenfall: Disc morgen', einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2026-11-19') } })?.reason === 'offen')
pruefe('Gegenfall: Disc ohne vollen Tag', einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('2019-12-00') } })?.reason === 'offen' && einzeln(ohneTreffer(), { discAusgaben: { 900001: disc('') } })?.reason === 'offen' && einzeln(ohneTreffer(), { discAusgaben: { 900001: [{}] } })?.reason === 'offen')
pruefe('Eine künftige neben einer erschienenen Disc: Grund', einzeln(ohneTreffer(), { discAusgaben: { 900001: [...disc('2027-01-01'), ...disc('2010-03-08')] } })?.reason === 'nur-disc')
pruefe('Disc-Termin in events.json, schon vorbei: Grund', einzeln(ohneTreffer(), { termine: [{ titleId: 900001, platform: 'disc', date: '2026-11-01' }] })?.reason === 'nur-disc')
pruefe('Gegenfall: Disc-Termin in events.json noch in der Zukunft', einzeln(ohneTreffer(), { termine: [{ titleId: 900001, platform: 'disc', date: '2027-01-28' }] })?.reason === 'offen')
pruefe('Gegenfall: ein vergangener Streamtermin ist keine Disc', einzeln(ohneTreffer(), { termine: [{ titleId: 900001, platform: 'netflix', date: '2026-11-01' }] })?.reason === 'offen')
pruefe('ohneTreffer 27 Tage alt gilt', einzeln(ohneTreffer({ geprueftAm: '2026-10-22' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'nur-disc')
pruefe('Gegenfall: ohneTreffer 28 Tage alt', einzeln(ohneTreffer({ geprueftAm: '2026-10-21' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: Befund ohne Prüftag', einzeln(ohneTreffer({ geprueftAm: '' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: verfehlter Befund', einzeln(befund('d5', [], { verfehltAm: '2026-11-17' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: verfehlter Befund ohneTreffer', einzeln(ohneTreffer({ verfehltAm: '2026-11-17' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: Prüftag ohne volles Datum (parsbar, aber kein Tag der Quelle)', einzeln(ohneTreffer({ geprueftAm: '2026-11' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: ein veraltetes Abo-Angebot im Befund', einzeln(befund('d6', [{ art: 'FLATRATE', audio: ['de'] }], { geprueftAm: '2026-10-01' }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: ein Abo-Angebot mit Deutsch im Befund', einzeln(befund('d7', [{ art: 'FLATRATE', audio: ['de'] }]), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: ein Abo-Angebot nur in der Staffel', einzeln(befund('d8', [], { staffeln: [{ nr: 1, folgen: 1, angebote: [{ anbieter: 'X', art: 'FLATRATE', audio: ['de'] }] }] }), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
pruefe('Gegenfall: ein Kino-Angebot im Befund', einzeln(befund('d9', [{ art: 'CINEMA' }]), { discAusgaben: { 900001: disc('2020-01-01') } })?.reason === 'offen')
const gleich = lauf({
  titel: [titel(900002), titel(900003)],
  justwatch: { 900002: befund('gleich', [], { tmdbId: 6 }), 900003: befund('gleich', [], { tmdbId: 7 }) },
  discAusgaben: { 900002: disc('2020-01-01'), 900003: disc('2020-01-01') },
})
pruefe('Gegenfall: eine JustWatch-Kennung an zwei Titeln', gleich[900002]?.reason === 'offen' && gleich[900003]?.reason === 'offen', gleich)
const mehrere = lauf({
  titel: [titel(900005), titel(900006), titel(900007)],
  justwatch: { 900005: ohneTreffer({ geprueftAm: '2026-11-10' }), 900006: ohneTreffer({ geprueftAm: '2026-11-12' }), 900007: ohneTreffer() },
  discAusgaben: { 900005: disc('2020-01-01'), 900006: disc('2020-01-01') },
})
pruefe('Je Titel der eigene Prüftag, ein Titel ohne Disc bleibt offen', mehrere[900005]?.checkedAt === '2026-11-10' && mehrere[900006]?.checkedAt === '2026-11-12' && mehrere[900007]?.reason === 'offen', mehrere)
pruefe('Titel mit Weg bekommt keinen Grund, auch nicht mit Disc', Object.keys(lauf({ titel: [titel(900008, { streams: [{ platform: 'netflix' }] })], justwatch: { 900008: ohneTreffer() }, discAusgaben: { 900008: disc('2020-01-01') } })).length === 0)

console.log('\nAnzeigesatz')
pruefe('Text abo-ohne-ton nennt den Tag deutsch', ohneWegText({ reason: 'abo-ohne-ton', checkedAt: '2026-11-17' }) === 'Laut JustWatch im Stream ohne deutschen Ton, geprüft am 17.11.2026.', ohneWegText({ reason: 'abo-ohne-ton', checkedAt: '2026-11-17' }))
pruefe('Text nur-disc nennt den Tag und kein JustWatch', ohneWegText({ reason: 'nur-disc', checkedAt: '2026-11-17' }) === 'Auf DVD oder Blu-ray erhältlich, Streaming bisher nicht gefunden, geprüft am 17.11.2026.', ohneWegText({ reason: 'nur-disc', checkedAt: '2026-11-17' }))
pruefe('Gegenfall: beide Gründe ohne Tag erfinden keinen', ohneWegText({ reason: 'abo-ohne-ton' }) === 'Ein Streaming-Angebot ist noch nicht belegt.' && ohneWegText({ reason: 'nur-disc' }) === 'Ein Streaming-Angebot ist noch nicht belegt.')

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-disc-abo: abo-ohne-ton und nur-disc mit Beleg, Sperren, Vorrang und Anzeigesatz in Ordnung')
