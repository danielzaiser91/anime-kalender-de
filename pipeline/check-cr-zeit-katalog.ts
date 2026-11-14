/**
 * Wächter: Ein laufender Crunchyroll-Wochentermin (Slug `cr-…`) trägt die Uhrzeit des Katalogstempels seiner jüngsten Folge,
 * nicht die Zeit aus dem Wochenprogramm.
 *
 * Lehre (14.11.2026, The Vermilion Mask, GT00384015): Das Wochenprogramm nannte 10:30, Folge 2 und 3 kamen um 11:30; live stand
 * Folge 3 eine Stunde zu früh als erschienen da. Stempel wörtlich aus `crunchyroll-dub.json` (Vermilion, Psyren GT00371866).
 * Rot, sobald die Wochenprogramm-Zeit nach der Bau-Phase stehen bleibt. Aufruf: npx tsx pipeline/check-cr-zeit-katalog.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cr-zeit-katalog-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { zeitenAusBlock, setzeKatalogZeit } = await import('./lib/cr-zeit-katalog.ts')
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
const { BELEGE_DATEI } = await import('./lib/woche-beleg.ts')
type Belege = import('./lib/woche-beleg.ts').WocheBelege
type Schedule = import('../shared/types.ts').Schedule
type Release = import('../shared/types.ts').Release

const VM = 'https://www.crunchyroll.com/de/series/GT00384015/the-vermilion-mask'
const PS = 'https://www.crunchyroll.com/de/series/GT00371866/psyren'
const ARTIKEL = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/10/5/crunchyroll-wochenprogramm-herbst-2026'
const serie = (url: string, stempel: (string | undefined)[], katalog = 'de') => ({
  url,
  seriesId: /series\/([A-Z0-9]+)/.exec(url)![1],
  katalog,
  staffeln: [{ name: 'Staffel 1', deutsch: stempel.length, folgen: 12, deutscheFolgen: stempel.map((v, i) => ({ nummer: i + 1, guid: `g${i}`, verfuegbarAb: v })) }],
}) as never
const beleg = (seriesId: string, datum: string, zeit: string): Belege =>
  ({ k0: { seriesId, titel: 'x', von: 1, bis: 1, datum, zeit, artikel: ARTIKEL, erstmalsAm: '2026-10-26T10:00:00.000Z' } }) as Belege

/* Vermilion: 31.10. 10:30, 07.11. und 14.11. 11:30 Berlin (Katalogstempel). */
const VM_STEMPEL = ['2026-10-31T09:30:00Z', '2026-11-07T10:30:00Z', '2026-11-14T10:30:00Z']
const VM_TAGE = { 1: '2026-10-31', 2: '2026-11-07', 3: '2026-11-14' }
/* Psyren: API 15:30 am 26.10. (Zeitumstellung), danach 16:30; das Wochenprogramm belegt 16:30 am ersten Tag. */
const PS_STEMPEL = ['2026-10-26T14:30:00Z', '2026-11-02T15:30:00Z', '2026-11-09T15:30:00Z']
const PS_TAGE = { 1: '2026-10-26', 2: '2026-11-02', 3: '2026-11-09' }
const PS_START = { datum: '2026-10-26', zeit: '16:30' }
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/* zeitenAusBlock: die reine Rechnung. */
const vm = zeitenAusBlock(serie(VM, VM_STEMPEL), VM_TAGE)
pruefe('Vermilion: Zeit der jüngsten Folge 11:30, Folge 1 behält 10:30', gleich(vm, { time: '11:30', zeiten: { 1: '10:30' } }), vm)
const vmRueck = zeitenAusBlock(serie(VM, [...VM_STEMPEL].reverse()), { 1: '2026-11-14', 2: '2026-11-07', 3: '2026-10-31' })
pruefe('Katalog in umgekehrter Reihenfolge: die jüngste nach Datum gewinnt, nicht die letzte der Liste', gleich(vmRueck, { time: '11:30', zeiten: { 3: '10:30' } }), vmRueck)
const ps = zeitenAusBlock(serie(PS, PS_STEMPEL), PS_TAGE, PS_START)
pruefe('Psyren mit Wochenprogramm am ersten Tag: 16:30, keine abweichende Folge', gleich(ps, { time: '16:30', zeiten: {} }), ps)
const psOhne = zeitenAusBlock(serie(PS, PS_STEMPEL), PS_TAGE)
pruefe('Psyren ohne Wochenprogramm: Folge 1 behält den API-Stempel 15:30', gleich(psOhne, { time: '16:30', zeiten: { 1: '15:30' } }), psOhne)
const psAnderTag = zeitenAusBlock(serie(PS, PS_STEMPEL), PS_TAGE, { datum: '2026-11-02', zeit: '17:00' })
pruefe('Wochenprogramm gilt nur für seinen Tag', gleich(psAnderTag, { time: '16:30', zeiten: { 1: '15:30', 2: '17:00' } }), psAnderTag)
pruefe('Katalog nicht deutsch: keine Aussage', zeitenAusBlock(serie(VM, VM_STEMPEL, 'us'), VM_TAGE) === undefined)
pruefe('Beobachteter Tag widerspricht dem Katalog: keine Aussage', zeitenAusBlock(serie(VM, VM_STEMPEL), { ...VM_TAGE, 3: '2026-11-13' }) === undefined)
pruefe('Keine Beobachtung: keine Aussage', zeitenAusBlock(serie(VM, VM_STEMPEL), {}) === undefined)
const vier = zeitenAusBlock(serie(VM, [...VM_STEMPEL, '2026-11-21T09:00:00Z']), VM_TAGE)
pruefe('Katalogfolge ohne Beobachtung zählt nicht (Folge 4 um 10:00)', gleich(vier, { time: '11:30', zeiten: { 1: '10:30' } }), vier)
const ohneStempel = zeitenAusBlock(serie(VM, [VM_STEMPEL[0], VM_STEMPEL[1], undefined]), VM_TAGE)
pruefe('Folge ohne Stempel zählt nicht: Folge 2 ist die jüngste', gleich(ohneStempel, { time: '11:30', zeiten: { 1: '10:30' } }), ohneStempel)
const doppel = zeitenAusBlock(serie(VM, ['2026-10-31T09:30:00Z', '2026-10-31T10:00:00Z']), { 2: '2026-10-31', 1: '2026-10-31' })
pruefe('Zwei Folgen am selben Tag: die höhere Nummer ist die jüngste (11:00)', gleich(doppel, { time: '11:00', zeiten: { 1: '10:30' } }), doppel)
const doppelRueck = zeitenAusBlock(serie(VM, ['2026-10-31T10:00:00Z', '2026-10-31T09:30:00Z']), { 1: '2026-10-31', 2: '2026-10-31' })
pruefe('Zwei Folgen am selben Tag, Katalog umgekehrt: weiterhin die höhere Nummer (10:30)', gleich(doppelRueck, { time: '10:30', zeiten: { 1: '11:00' } }), doppelRueck)

/* setzeKatalogZeit: wann der Termin angefasst wird. */
const sched = (extra: Partial<Schedule> = {}): Schedule => ({ firstEpisodeDate: '2026-10-31', time: '10:30', observed: { ...VM_TAGE }, ...extra }) as Schedule
const s1 = sched()
pruefe('Vermilion-Termin 10:30 wird geändert', setzeKatalogZeit(s1, serie(VM, VM_STEMPEL), {}) === true, s1)
pruefe('… auf 11:30 mit Folge 1 um 10:30', s1.time === '11:30' && gleich(s1.zeiten, { 1: '10:30' }), s1)
const s2 = sched({ time: '11:30' })
pruefe('Zeit stimmt schon, Folge 1 weicht ab: zeiten werden gesetzt', setzeKatalogZeit(s2, serie(VM, VM_STEMPEL), {}) === true && gleich(s2.zeiten, { 1: '10:30' }), s2)
const s3 = sched({ firstEpisodeDate: '2026-10-26', time: '16:30', observed: { ...PS_TAGE } })
pruefe('Psyren 16:30 mit Wochenprogramm-Beleg: nichts zu ändern', setzeKatalogZeit(s3, serie(PS, PS_STEMPEL), beleg('GT00371866', '2026-10-26', '16:30')) === false && s3.time === '16:30' && !('zeiten' in s3), s3)
const s4 = sched({ firstEpisodeDate: '2026-10-26', time: '15:30', observed: { ...PS_TAGE } })
pruefe('Psyren 15:30 mit Beleg: wird 16:30 ohne zeiten', setzeKatalogZeit(s4, serie(PS, PS_STEMPEL), beleg('GT00371866', '2026-10-26', '16:30')) === true && s4.time === '16:30' && !('zeiten' in s4), s4)
const s5 = sched({ firstEpisodeDate: '2026-10-26', time: '16:30', observed: { ...PS_TAGE } })
pruefe('Psyren, Beleg einer anderen Serie: Folge 1 behält 15:30', setzeKatalogZeit(s5, serie(PS, PS_STEMPEL), beleg('GT00384015', '2026-10-26', '16:30')) === true && gleich(s5.zeiten, { 1: '15:30' }), s5)
const s6 = sched({ firstEpisodeDate: '2026-10-26', time: '16:30', observed: { ...PS_TAGE } })
pruefe('Psyren, Beleg eines anderen Tages: Folge 1 behält 15:30', setzeKatalogZeit(s6, serie(PS, PS_STEMPEL), beleg('GT00371866', '2026-11-02', '16:30')) === true && gleich(s6.zeiten, { 1: '15:30' }), s6)
const unberuehrt: [string, Partial<Schedule>][] = [
  ['geschätzte Zeit (timeEstimated)', { timeEstimated: true }],
  ['schon gesetzte Zeiten je Folge', { zeiten: { 1: '09:00' } }],
  ['keine Zeit', { time: undefined }],
  ['keine Beobachtung', { observed: undefined }],
]
for (const [name, extra] of unberuehrt) {
  const s = sched(extra)
  const vorher = JSON.stringify(s)
  pruefe(`unberührt: ${name}`, setzeKatalogZeit(s, serie(VM, VM_STEMPEL), {}) === false && JSON.stringify(s) === vorher, s)
}
const s7 = sched()
pruefe('kein Block (Katalog us): unberührt', setzeKatalogZeit(s7, serie(VM, VM_STEMPEL, 'us'), {}) === false && s7.time === '10:30', s7)

/* Die Bau-Phase: nur der Kalendertermin (`cr-…`) bekommt die Katalogzeit, ein kuratierter Termin bleibt. */
const titel = { id: 900001, titleEn: 'The Vermilion Mask', jpYear: 2026, format: 'TV', streams: [{ platform: 'crunchyroll', url: VM, dub: true }] }
const termin = (slug: string): Release =>
  ({ slug, titleId: 900001, name: 'The Vermilion Mask', platform: 'crunchyroll', platformUrl: VM, releaseType: 'weekly', year: 2026, sources: [VM], schedule: { firstEpisodeDate: '2026-10-31', time: '10:30', episodeCount: 12, observed: { ...VM_TAGE } } }) as never
function phase(releases: Release[], belege: Belege = {}): string[] {
  writeFileSync(join(wurzel, BELEGE_DATEI), JSON.stringify(belege))
  const zeilen: string[] = []
  const log = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[titel.id, titel as never]]),
      anisearch: {},
      belegt: 0,
      crDub: { serien: [serie(VM, VM_STEMPEL)] } as never,
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map([[VM, [titel as never]]]),
      releases,
      jetzt: Date.parse('2026-11-14T12:00:00Z'),
    })
  } finally {
    console.log = log
  }
  return zeilen
}
try {
  const kalender = termin('cr-GT00384015')
  const kuratiert = termin('the-vermilion-mask-crunchyroll')
  const zeilen = phase([kalender, kuratiert])
  pruefe('Phase: Kalendertermin cr-GT00384015 steht auf 11:30, Folge 1 auf 10:30', kalender.schedule.time === '11:30' && gleich(kalender.schedule.zeiten, { 1: '10:30' }), kalender.schedule)
  pruefe('Phase: kuratierter Termin bleibt bei 10:30 ohne zeiten', kuratiert.schedule.time === '10:30' && !('zeiten' in kuratiert.schedule), kuratiert.schedule)
  pruefe('Phase: das Log zählt genau einen korrigierten Termin', zeilen.some((z) => /(^|\D)1 Crunchyroll-Wochentermine mit der Uhrzeit aus dem Katalog/.test(z)), zeilen)
  const zweiter = phase([kalender])
  pruefe('Phase, zweiter Lauf: unverändert, keine Zählzeile', kalender.schedule.time === '11:30' && !zweiter.some((z) => z.includes('Uhrzeit aus dem Katalog')), zweiter)
  const mitBeleg = termin('cr-GT00384015')
  phase([mitBeleg], beleg('GT00384015', '2026-10-31', '10:00'))
  pruefe('Phase reicht die Wochenprogramm-Belege durch: Folge 1 am ersten Tag 10:00', mitBeleg.schedule.time === '11:30' && gleich(mitBeleg.schedule.zeiten, { 1: '10:00' }), mitBeleg.schedule)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`✖ check-cr-zeit-katalog: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`✓ check-cr-zeit-katalog: ${faelle} Fälle (Kalendertermine tragen die Katalogzeit der jüngsten Folge, kuratierte und geschätzte bleiben)`)
