/**
 * Zusicherungen: Ein recherchierter Ersatztermin (`neuErwartet`) ist kein Stützpunkt mehr, wenn eine gleiche oder frühere Folge
 * danach beobachtet wurde (Re:ZERO Staffel 4, 16.10.2026: 4p.de meinte Folge 14, der Vermerk stand an Folge 16). Läuft in `check:logic`.
 */
import { expandEvents } from '../shared/logic.ts'
import type { Release } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wochen = (start: string, bis: number): Record<number, string> =>
  Object.fromEntries(Array.from({ length: bis }, (_, i) => [i + 1, new Date(Date.parse(`${start}T12:00:00Z`) + i * 7 * 864e5).toISOString().slice(0, 10)]))
function tagVon(observed: Record<number, string>, neuErwartet: string): string | undefined {
  const r = {
    slug: 'x',
    titleId: 1,
    name: 'X',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-04-08',
      episodeCount: 19,
      observed,
      verpasst: { 16: { erwartetAm: '2026-09-30T14:00:00.000Z', neuErwartet: `${neuErwartet}T14:00:00.000Z` } },
    },
  } as unknown as Release
  return expandEvents(r).find((e) => e.episode === 17 && !e.verpasst)?.date
}

const bis15 = { ...wochen('2026-04-08', 11), 12: '2026-09-09', 13: '2026-09-09', 14: '2026-10-14', 15: '2026-10-15' }
pruefe('Ersatztermin 14.10. für Folge 16, Folge 15 am 15.10. beobachtet: überholt, Folge 17 rechnet von Folge 15 aus (29.10.)', tagVon(bis15, '2026-10-14') === '2026-10-29', tagVon(bis15, '2026-10-14'))
pruefe('Ersatztermin nach der letzten Beobachtung gilt weiter, Folge 17 eine Woche später (28.10.)', tagVon(bis15, '2026-10-21') === '2026-10-28', tagVon(bis15, '2026-10-21'))
const f14 = expandEvents({ slug: 'x', titleId: 1, name: 'X', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-04-08', episodeCount: 19, observed: { ...wochen('2026-04-08', 11), 12: '2026-09-09', 13: '2026-09-09', 16: '2026-10-15' }, verpasst: { 14: { erwartetAm: '2026-09-16T14:00:00.000Z', neuErwartet: '2026-10-14T14:00:00.000Z' } } } } as unknown as Release)
pruefe('Ersatztermin einer früheren Folge bleibt, auch wenn eine spätere Nummer danach gesehen wurde (Folge 14 am 14.10., Folge 16 am 15.10.)', f14.some((e) => e.episode === 14 && !e.verpasst && e.date === '2026-10-14'), f14.map((e) => `${e.episode}:${e.date}`))
const bis5 = wochen('2026-07-26', 5)
const f6 = expandEvents({ slug: 'x', titleId: 1, name: 'X', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-26', episodeCount: 13, observed: bis5, verpasst: { 6: { erwartetAm: '2026-08-30T15:00:00.000Z', neuErwartet: '2026-09-06T15:00:00.000Z' } } } } as unknown as Release)
pruefe('Mushoku-Fall: Ersatztermin hinter der letzten Beobachtung bleibt Stützpunkt', f6.find((e) => e.episode === 6 && !e.verpasst)?.date === '2026-09-06', f6.map((e) => `${e.episode}:${e.date}`))

if (verletzt) {
  console.error(`check-stuetzpunkt-ueberholt: ${verletzt} Fehler`)
  process.exit(1)
}
console.log('check-stuetzpunkt-ueberholt: alles grün')
