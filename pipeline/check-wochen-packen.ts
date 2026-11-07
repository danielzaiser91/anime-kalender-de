/**
 * Zusicherungen zur Packform der Kachel-Datei (`shared/wochen-packen.ts`, `pipeline/lib/packform-pruefen.ts`): Auspacken gibt die Kachel-Datei Wert für Wert
 * zurück, auch bei Randfällen (Termin ohne Feld, das das Release trägt; fremde Kennung; Läufe mit Lücke, Rückschritt, gleichem Tag), und die Prüfung des Baus
 * wird rot, sobald die Packform etwas verändert. Erwartete Schlüssel und Werte stehen hier fest, nicht aus dem Modul geholt.
 * Aufruf: `npm run check:logic`
 */
import { isDeepStrictEqual } from 'node:util'
import type { Release, ReleaseEvent } from '../shared/types.ts'
import type { WochenDatei } from '../shared/wochen-datei.ts'
import { entpackeKachel, packeKachel } from '../shared/wochen-packen.ts'
import { pruefePackform } from './lib/packform-pruefen.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (slug: string, extra: object = {}): Release =>
  ({ slug, titleId: 900001, name: `Name ${slug}`, platform: 'tv', releaseType: 'weekly', year: 2026, schedule: { firstEpisodeDate: '2026-10-05' }, ...extra }) as Release
const termin = (extra: object): ReleaseEvent =>
  ({ id: 'a@2026-10-05', releaseSlug: 'a', titleId: 900001, date: '2026-10-05', name: 'Name a', platform: 'tv', releaseType: 'weekly', ...extra }) as ReleaseEvent
const datei = (releases: Release[], events: ReleaseEvent[]): WochenDatei => ({ von: '2026-10-05', bis: '2026-10-11', titles: [], releases, events })
const roh = (x: unknown) => JSON.parse(JSON.stringify(x)) as WochenDatei
const hin = (d: WochenDatei) => entpackeKachel(roh(packeKachel(d)))

console.log('Packform der Kachel-Datei:')
const a = release('a', { sender: 'Super RTL' })
const b = release('b', { platform: 'netflix', releaseType: 'batch' })
const events = [
  termin({ sender: 'Super RTL' }),
  termin({ id: 'a@2026-10-06#7', date: '2026-10-06', episode: 7, sender: 'Super RTL' }),
  termin({ id: 'eigene-kennung', date: '2026-10-07', sender: 'Super RTL' }),
  termin({ id: 'a@2026-10-08', date: '2026-10-08', platform: 'netflix', sender: 'Super RTL' }),
  termin({ id: 'a@2026-10-09', date: '2026-10-09' }),
  termin({ id: 'fremd@2026-10-10', releaseSlug: 'fremd', date: '2026-10-10', titleId: 5 }),
  termin({ id: 'b@2026-10-11#2', releaseSlug: 'b', date: '2026-10-11', episode: 2, name: 'Name b', platform: 'netflix', releaseType: 'batch' }),
]
const d = datei([a, b], events)
const gepackt = roh(packeKachel(d))
const e = gepackt.events as unknown as Record<string, unknown>[]
pruefe('Termin: gleiche Felder entfallen, Stelle im Release steht statt der Kennung', !('name' in e[0]!) && !('titleId' in e[0]!) && !('platform' in e[0]!) && !('releaseType' in e[0]!) && !('sender' in e[0]!) && e[0]!.r === 0 && !('releaseSlug' in e[0]!), e[0])
pruefe('Termin: id <slug>@<date> entfällt', !('id' in e[0]!))
pruefe('Termin: id <slug>@<date>#<episode> wird zu #', e[1]!.id === '#', e[1])
pruefe('Termin: andere id bleibt wörtlich', e[2]!.id === 'eigene-kennung', e[2])
pruefe('Termin: abweichende Plattform bleibt', e[3]!.platform === 'netflix' && !('name' in e[3]!), e[3])
pruefe('Termin: fehlendes Feld, das das Release trägt, steht als null', e[4]!.sender === null, e[4])
pruefe('Termin: Release unbekannt, nichts entfällt außer der Standard-id', e[5]!.releaseSlug === 'fremd' && e[5]!.titleId === 5 && e[5]!.name === 'Name a' && !('r' in e[5]!), e[5])
pruefe('Termin: zweites Release trägt Stelle 1', e[6]!.r === 1 && !('platform' in e[6]!), e[6])
pruefe('Auspacken gibt alle Termine zurück', isDeepStrictEqual(hin(d).events, d.events), hin(d).events)
pruefe('Packform-Prüfung des Baus: in Ordnung', pruefePackform(d, roh(packeKachel(d))).length === 0, pruefePackform(d, roh(packeKachel(d))))

const reihe = (observed: Record<string, string>, zeiten?: Record<string, string>) => release('a', { schedule: { firstEpisodeDate: '2026-10-05', observed, ...(zeiten ? { zeiten } : {}) } })
const wochen = { 1: '2026-10-05', 2: '2026-10-12', 3: '2026-10-19', 4: '2026-10-26' }
const reihen: Array<[string, Release, string]> = [
  ['Wochentakt wird ein Lauf', reihe(wochen), '1-4'],
  ['gleicher Tag mehrerer Folgen wird ein Lauf ohne Schritt', reihe({ 1: '2026-10-05', 2: '2026-10-05', 3: '2026-10-05' }), '1-3'],
  ['Lücke in den Folgen trennt Läufe', reihe({ 1: '2026-10-05', 2: '2026-10-12', 4: '2026-10-26', 5: '2026-11-02' }), '1-2'],
  ['Rückschritt im Datum ist kein Lauf', reihe({ 1: '2026-10-12', 2: '2026-10-05' }), '1'],
  ['einzelne Folge bleibt', reihe({ 7: '2026-10-05' }), '7'],
  ['wechselnder Abstand: jeder Lauf für sich', reihe({ 1: '2026-10-05', 2: '2026-10-12', 3: '2026-10-20', 4: '2026-10-28' }), '1-2'],
  ['Wert mit Uhrzeit ist kein Datum', reihe({ 1: '2026-10-05T10:00', 2: '2026-10-12T10:00' }), '1'],
  ['Schlüssel ohne Zahl lässt die Reihe unverändert', reihe({ x: '2026-10-05', y: '2026-10-12' }), 'x'],
]
for (const [name, r, schluessel] of reihen) {
  const p = roh(packeKachel(datei([r], []))).releases[0]!.schedule!.observed!
  pruefe(`Reihe: ${name} (Schlüssel ${schluessel})`, Object.keys(p).includes(schluessel) && isDeepStrictEqual(hin(datei([r], [])).releases[0], r), p)
}
const zeiten = release('a', { schedule: { firstEpisodeDate: '2026-10-05', zeiten: { 1: '16:05', 2: '16:05', 3: '16:15', 5: '16:15', 6: '16:15', 8: '16:05' } } })
const zp = roh(packeKachel(datei([zeiten], []))).releases[0]!.schedule!.zeiten!
pruefe('Zeiten: gleiche Uhrzeit aufeinanderfolgender Folgen wird ein Lauf', isDeepStrictEqual(zp, { '1-2': '16:05', 3: '16:15', '5-6': '16:15', 8: '16:05' }), zp)
pruefe('Zeiten: Auspacken gibt sie zurück', isDeepStrictEqual(hin(datei([zeiten], [])).releases[0], zeiten))
pruefe('Wochenreihe: gepackt steht der Abstand als +7', isDeepStrictEqual(roh(packeKachel(datei([reihe(wochen)], []))).releases[0]!.schedule!.observed, { '1-4': '2026-10-05+7' }))
pruefe('eine ungepackte Datei kommt unverändert heraus', isDeepStrictEqual(entpackeKachel(roh(d)), d))

const kaputt = roh(packeKachel(d))
const ersterTermin = kaputt.events[0] as unknown as Record<string, unknown>
ersterTermin.platform = 'netflix'
pruefe('Packform-Prüfung wird rot, wenn ein Termin nach dem Auspacken abweicht', pruefePackform(d, kaputt).some((f) => f.startsWith('Packform: Termin ')), pruefePackform(d, kaputt))
const kaputt2 = roh(packeKachel(datei([reihe(wochen)], [])))
kaputt2.releases[0]!.schedule!.observed = { '1-4': '2026-10-05+6' } as unknown as Record<number, string>
pruefe('Packform-Prüfung wird rot, wenn eine Reihe nach dem Auspacken abweicht', pruefePackform(datei([reihe(wochen)], []), kaputt2).some((f) => f.startsWith('Packform: Release a')))
const kaputt3 = roh(packeKachel(d))
kaputt3.events.pop()
pruefe('Packform-Prüfung wird rot bei fehlendem Termin', pruefePackform(d, kaputt3).length > 0)

console.log(verletzt ? `\n${verletzt} von ${faelle} Zusicherung(en) zur Packform verletzt.` : `\nWochen-Packform: ${faelle} Zusicherungen halten.`)
process.exit(verletzt ? 1 : 0)
