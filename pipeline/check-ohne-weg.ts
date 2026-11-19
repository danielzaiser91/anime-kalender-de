/**
 * Zusicherungen zu `ohne-weg.json` (Grund je Titel ohne Streaming-Weg): Regeln, Wächter, Kennungsübersetzung, Anzeigetext. Den Bauschritt prüft `check-ohne-weg-lauf.ts`.
 * Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, OFFEN_HOECHSTENS, type OhneWegEingabe } from './lib/ohne-weg.ts'
import { zaehleGruende } from './bau/13-13-ohne-weg.ts'
import { ohneWegFehler } from './lib/pruefung.ts'
import { uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { ohneStreamingWeg, type OhneWegEintrag } from '../shared/ohne-weg.ts'
import { hatStreamingWeg } from '../tools/streaming-weg-zaehlen.mjs'
import { ohneWegText } from '../web/src/components/detail/ohne-weg.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-18'
const titel = (id: number, extra: Record<string, unknown> = {}) => ({ id, format: 'TV', streams: [], ...extra }) as unknown as OhneWegEingabe['titel'][number]
const termin = (titleId: number, platform: string, date: string) => ({ titleId, platform, date })
const check = (anilistId: number, platform: string, extra: Record<string, unknown>) => ({ anilistId, platform, checkedAt: '2026-10-01', ...extra }) as unknown as OhneWegEingabe['handbelege'][number]
const jw = (jwId: string, tmdbId: number, art: string[], extra: Record<string, unknown> = {}) =>
  ({ geprueftAm: '2026-11-17', jwId, tmdbId, angebote: art.map((a) => ({ anbieter: 'X', art: a, audio: [] })), ...extra }) as unknown as OhneWegEingabe['justwatch'][string]

function lauf(eingabe: Partial<OhneWegEingabe>): Record<number, OhneWegEintrag> {
  return baueOhneWeg({ titel: [], termine: [], handbelege: [], justwatch: {}, heute: HEUTE, ...eingabe })
}

console.log('\nGründe')
const e1 = lauf({ titel: [titel(900001)], termine: [termin(900001, 'netflix', '2026-12-01'), termin(900001, 'netflix', '2026-11-25')] })
pruefe('Start in der Zukunft: angekuendigt mit frühestem Tag', e1[900001]?.reason === 'angekuendigt' && e1[900001]?.ab === '2026-11-25' && e1[900001]?.source === 'termin', e1)
const e2 = lauf({ titel: [titel(900002)], termine: [termin(900002, 'disc', '2027-01-28')] })
pruefe('Gegenfall: ein künftiger Disc-Termin ist kein Grund', e2[900002]?.reason === 'offen', e2)
const e3 = lauf({ titel: [titel(900003)], termine: [termin(900003, 'netflix', '2026-11-01'), termin(900003, 'netflix', '2026-12-01')] })
pruefe('Gegenfall: schon erschienen, nur der nächste Termin liegt in der Zukunft', e3[900003]?.reason === 'offen', e3)
const e3b = lauf({ titel: [titel(900031)], termine: [termin(900031, 'kino', '2026-11-18')] })
pruefe('Kinostart heute zählt als Start (Grenze genau heute)', e3b[900031]?.reason === 'angekuendigt', e3b)
const e3c = lauf({ titel: [titel(900032)], termine: [termin(900032, 'netflix', '2026-11-17')] })
pruefe('Gegenfall: Termin gestern ist kein künftiger Start', e3c[900032]?.reason === 'offen', e3c)

const e4 = lauf({
  titel: [titel(900004)],
  handbelege: [check(900004, 'prime', { dub: false, checkedAt: '2026-10-26' }), check(900004, 'netflix', { dub: false, checkedAt: '2026-09-01' })],
})
pruefe('Handbeleg Originalton: jüngster Prüftag', e4[900004]?.reason === 'kein-dub' && e4[900004]?.checkedAt === '2026-10-26' && e4[900004]?.source === 'handbeleg', e4)
const e5 = lauf({ titel: [titel(900005)], handbelege: [check(900005, 'prime', { dub: false }), check(900005, 'netflix', { dub: true })] })
pruefe('Gegenfall: ein Ja auf anderer Plattform hebt den Grund auf', e5[900005]?.reason === 'offen', e5)
const e6 = lauf({ titel: [titel(900006)], handbelege: [check(900006, 'prime', { available: false })] })
pruefe('Gegenfall: „nicht verfügbar“ ist kein Originalton-Beleg', e6[900006]?.reason === 'offen', e6)
const e6b = lauf({ titel: [titel(900035)], handbelege: [check(900035, 'prime', { dub: false, available: false, checkedAt: '2026-10-31' })] })
pruefe('Gegenfall: verschmolzene Zeile mit dub:false und jüngerem available:false (Goblin Slayer) trägt keinen Originalton-Tag', e6b[900035]?.reason === 'offen', e6b)
const e6c = lauf({ titel: [titel(900036)], handbelege: [check(900036, 'prime', { dub: false, checkedAt: '2026-09-28' }), check(900036, 'netflix', { available: false, checkedAt: '2026-10-31' })] })
pruefe('Originalton auf einer, „nicht verfügbar“ auf anderer Plattform: der Originalton-Tag zählt', e6c[900036]?.reason === 'kein-dub' && e6c[900036]?.checkedAt === '2026-09-28', e6c)

const e7 = lauf({ titel: [titel(900007)], justwatch: { 900007: jw('a1', 1, ['BUY', 'RENT']) } })
pruefe('JustWatch nur Kauf/Leihe: Tag aus geprueftAm', e7[900007]?.reason === 'nur-kauf' && e7[900007]?.checkedAt === '2026-11-17' && e7[900007]?.source === 'justwatch', e7)
const e8 = lauf({ titel: [titel(900008)], justwatch: { 900008: jw('a2', 2, ['BUY', 'FLATRATE']) } })
pruefe('Gegenfall: Abo-Angebot ohne belegten Ton ist kein „nur Kauf“', e8[900008]?.reason === 'offen', e8)
const e8b = lauf({ titel: [titel(900033)], justwatch: { 900033: jw('a9', 9, ['RENT']) } })
pruefe('Ein einziges Leih-Angebot genügt (Grenze 1)', e8b[900033]?.reason === 'nur-kauf', e8b)

const e9 = lauf({ titel: [titel(900009, { format: 'MOVIE' })], justwatch: { 900009: jw('a3', 3, [], { ohneTreffer: true }) } })
pruefe('Gegenfall: JustWatch ohneTreffer ist eine Zuordnungslücke, kein Beleg', e9[900009]?.reason === 'offen', e9)
const e10 = lauf({ titel: [titel(900010, { format: 'MOVIE' })], justwatch: { 900010: jw('a4', 4, []) } })
pruefe('Film, JustWatch zugeordnet, kein Angebot: film-ohne-abo', e10[900010]?.reason === 'film-ohne-abo' && e10[900010]?.checkedAt === '2026-11-17', e10)
const e11 = lauf({ titel: [titel(900011)], justwatch: { 900011: jw('a5', 5, []) } })
pruefe('Gegenfall: eine Serie ohne Angebot bleibt offen', e11[900011]?.reason === 'offen', e11)
const e12 = lauf({
  titel: [titel(900012, { format: 'MOVIE' }), titel(900013, { format: 'MOVIE' })],
  justwatch: { 900012: jw('gleich', 6, []), 900013: jw('gleich', 7, []) },
})
pruefe('Gegenfall: eine JustWatch-Kennung an zwei TMDB-Reihen trägt keinen Grund', e12[900012]?.reason === 'offen' && e12[900013]?.reason === 'offen', e12)
const e12b = lauf({ titel: [titel(900034, { format: 'MOVIE' })], justwatch: { 900034: jw('a6', 8, [], { geprueftAm: '' }) } })
pruefe('Gegenfall: ein Befund ohne Prüftag trägt keinen Grund (kein Datum ohne Quelle)', e12b[900034]?.reason === 'offen', e12b)
/* Heute ist 2026-11-18: 27 Tage alt gilt noch, 28 Tage nicht mehr (`befundGilt`, `BEFUND_MAX_TAGE` 28), und ein verfehlter Befund (`verfehltAm`) sagt nichts über heute. */
const alt = lauf({
  titel: [titel(900037), titel(900038), titel(900039, { format: 'MOVIE' }), titel(900040, { format: 'MOVIE' }), titel(900041)],
  justwatch: {
    900037: jw('b1', 31, ['BUY'], { geprueftAm: '2026-10-22' }),
    900038: jw('b2', 32, ['BUY'], { geprueftAm: '2026-10-21' }),
    900039: jw('b3', 33, [], { geprueftAm: '2026-10-22' }),
    900040: jw('b4', 34, [], { geprueftAm: '2026-10-21' }),
    900041: jw('b5', 35, ['BUY'], { verfehltAm: '2026-11-17' }),
  },
})
pruefe('Befund 27 Tage alt gilt: nur-kauf und film-ohne-abo', alt[900037]?.reason === 'nur-kauf' && alt[900039]?.reason === 'film-ohne-abo', alt)
pruefe('Gegenfall: Befund 28 Tage alt trägt keinen Grund (nur-kauf und Film bleiben offen)', alt[900038]?.reason === 'offen' && alt[900040]?.reason === 'offen', alt)
pruefe('Gegenfall: verfehlter Befund trägt keinen Grund', alt[900041]?.reason === 'offen', alt)

console.log('\nVorrang und Umfang')
const e13 = lauf({
  titel: [titel(900014), titel(900015)],
  termine: [termin(900014, 'netflix', '2026-12-01')],
  handbelege: [check(900014, 'prime', { dub: false }), check(900015, 'prime', { dub: false, checkedAt: '2026-10-05' })],
  justwatch: { 900014: jw('b1', 11, ['BUY']), 900015: jw('b2', 12, ['BUY'], { geprueftAm: '2026-11-10' }) },
})
pruefe('Termin geht vor Handbeleg und JustWatch', e13[900014]?.reason === 'angekuendigt', e13)
pruefe('Handbeleg geht vor JustWatch (anderes Datum)', e13[900015]?.reason === 'kein-dub' && e13[900015]?.checkedAt === '2026-10-05', e13)
const e14 = lauf({
  titel: [titel(900016, { streams: [{ platform: 'netflix' }] }), titel(900017, { watchLinks: [{ kind: 'buy' }] }), titel(900018, { watchLinks: [{ kind: 'stream' }] }), titel(-900019, {})],
  justwatch: { '-900019': jw('c1', 13, ['RENT']) },
})
pruefe('Titel mit Stream fehlen; Kauf-Weg zählt nicht als Stream; Cartoon (negative Kennung) kommt vor', Object.keys(e14).sort().join() === '-900019,900017', Object.keys(e14))
pruefe('Cartoon: nur-kauf', e14[-900019]?.reason === 'nur-kauf', e14)

console.log('\nWeb und Werkzeug zählen „ohne Weg“ gleich')
const faelle = [{}, { streams: [] }, { streams: [{}] }, { watchLinks: [] }, { watchLinks: [{ kind: 'buy' }] }, { watchLinks: [{ kind: 'stream' }] }, { streams: [{}], watchLinks: [{ kind: 'buy' }] }, { streams: [], watchLinks: [{ kind: 'buy' }, { kind: 'stream' }] }]
pruefe('ohneStreamingWeg = nicht hatStreamingWeg in allen Fällen', faelle.every((f) => ohneStreamingWeg(f) === !hatStreamingWeg(f)), faelle.filter((f) => ohneStreamingWeg(f) === hatStreamingWeg(f)))

console.log('\nWächter')
const gut: Record<number, OhneWegEintrag> = {
  1: { reason: 'angekuendigt', ab: '2026-12-01', source: 'termin' },
  2: { reason: 'kein-dub', checkedAt: '2026-10-26', source: 'handbeleg' },
  3: { reason: 'offen' },
}
const sauber = ohneWegFehler(gut, [1, 2, 3], 1)
pruefe('Sauberer Stand: kein Fehler, keine Warnung (offen genau an der Grenze)', sauber.fehler.length === 0 && sauber.warnungen.length === 0, sauber)
pruefe('Eine Meldung mehr als die Grenze: Warnung, kein Fehler', ohneWegFehler(gut, [1, 2, 3], 0).warnungen.length === 1 && ohneWegFehler(gut, [1, 2, 3], 0).fehler.length === 0)
pruefe('Titel ohne Weg ohne Eintrag: Fehler', ohneWegFehler(gut, [1, 2, 3, 4], 1).fehler.length === 1)
pruefe('Eintrag für Titel mit Weg: Fehler', ohneWegFehler(gut, [1, 2], 1).fehler.length === 1)
for (const [name, e] of [
  ['kein-dub ohne Prüftag', { reason: 'kein-dub' }],
  ['nur-kauf mit kaputtem Prüftag', { reason: 'nur-kauf', checkedAt: '18.11.2026' }],
  ['film-ohne-abo ohne Prüftag', { reason: 'film-ohne-abo' }],
  ['angekuendigt ohne Starttag (checkedAt zählt dort nicht)', { reason: 'angekuendigt', checkedAt: '2026-11-17' }],
] as [string, OhneWegEintrag][])
  pruefe(`Fehler: ${name}`, ohneWegFehler({ 5: e }, [5], 9).fehler.length === 1)
const fehlerText = (e: OhneWegEintrag) => ohneWegFehler({ 5: e }, [5], 9).fehler.join()
pruefe('Fehlertext nennt bei angekuendigt den Starttag, sonst den Prüftag', fehlerText({ reason: 'angekuendigt' }).includes('Starttag (ab)') && fehlerText({ reason: 'nur-kauf' }).includes('Prüftag (checkedAt)'))
/* Die Grenze sinkt nur: 1056 war der Stand vom 18.11.2026; mit jedem nachgetragenen Beleg darf sie fallen, nie steigen. */
pruefe('Grenze für „offen“ ist gesetzt und höchstens 1056', OFFEN_HOECHSTENS > 0 && OFFEN_HOECHSTENS <= 1056, OFFEN_HOECHSTENS)
pruefe('Logzeile zählt je Grund alphabetisch', zaehleGruende({ 1: { reason: 'offen' }, 2: { reason: 'kein-dub' }, 3: { reason: 'offen' } }) === 'kein-dub 1, offen 2')

console.log('\nKennungen und Anzeigetext')
const ak = (n: number) => (n < 0 ? n : n + 1_000_000)
const uebersetzt = uebersetzeDatei('ohne-weg.json', { 900001: gut[1], '-7': gut[3] }, ak) as Record<string, OhneWegEintrag>
pruefe('Schlüssel auf ak übersetzt, negative Kennung bleibt, Inhalt unverändert', Object.keys(uebersetzt).sort().join() === '-7,1900001' && uebersetzt['1900001']?.ab === '2026-12-01', uebersetzt)
pruefe('Text kein-dub nennt den Tag deutsch', ohneWegText(gut[2]!) === 'Bisher nur im Originalton gefunden, geprüft am 26.10.2026.', ohneWegText(gut[2]!))
pruefe('Text angekuendigt: keiner (der Starttag steht schon im Kasten)', ohneWegText(gut[1]!) === undefined)
pruefe('Text offen nennt kein Datum', ohneWegText(gut[3]!) === 'Ein Streaming-Angebot ist noch nicht belegt.')
pruefe('Text nur-kauf und film-ohne-abo nennen JustWatch und den Tag', ohneWegText({ reason: 'nur-kauf', checkedAt: '2026-11-17' })?.includes('17.11.2026') === true && ohneWegText({ reason: 'film-ohne-abo', checkedAt: '2026-11-17' })?.includes('kein Streaming-Angebot') === true)
pruefe('Gegenfall: ein Grund ohne Tag erfindet keinen', ohneWegText({ reason: 'nur-kauf' }) === 'Ein Streaming-Angebot ist noch nicht belegt.')

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg: Gründe, Vorrang, Wächter, Kennungen und Anzeigetext in Ordnung')
