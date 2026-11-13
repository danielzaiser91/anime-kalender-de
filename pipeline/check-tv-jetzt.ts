/**
 * Zusicherungen zu `tvJetzt()` aus `web/src/lib/tv-jetzt.ts`: ohne Zeilen kein Ergebnis; „heute“ ist der Tag des ersten Termins; die
 * Sendungen jeder Zeile kommen aus der Reihe ihres ersten Termins (fehlt die Reihe oder ihr Programm, gilt keine Sendung); Zustand und
 * Linie entstehen daraus (laufend, nächste, vorbei). Läuft in `check:logic`.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { tvJetzt } from '../web/src/lib/tv-jetzt.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const HEUTE = '2026-11-13'
const termin = (releaseSlug: string, time: string, episode?: number, date = HEUTE) =>
  ({ id: `${releaseSlug}-${time}`, releaseSlug, date, time, platform: 'tv', releaseType: 'weekly', ...(episode ? { episode } : {}) }) as unknown as ReleaseEvent
const reihe = (slug: string, sendungen?: { start: string; ende: string; nr?: number }[]) => [slug, { slug, ...(sendungen ? { sendungen } : {}) } as unknown as Release] as const
const sendung = (von: string, bis: string, nr?: number) => ({ start: `${HEUTE}T${von}`, ende: `${HEUTE}T${bis}`, ...(nr ? { nr } : {}) })

const reihen = new Map([
  reihe('a', [sendung('20:15', '20:40', 5), sendung('20:40', '21:05', 6)]),
  reihe('b', [sendung('22:00', '22:25')]),
  reihe('ohne-programm'),
])
const gruppen = [[termin('a', '20:15', 5), termin('a', '20:40', 6)], [termin('b', '22:00', 1)]]

pruefe('ohne Zeilen', tvJetzt([], reihen, '20:00'), undefined)
pruefe('erste Zeile leer', tvJetzt([[]], reihen, '20:00'), undefined)

pruefe('vor allem: nächste in 15 Min, Linie davor', tvJetzt(gruppen, reihen, '20:00'), {
  zustand: { zeilen: [{ art: 'naechste', minuten: 15 }, { art: 'spaeter' }], alleVorbei: false },
  linie: { linieVor: 0, ersteIn: 15, nichtsMehr: false, restInZeile: false },
})
pruefe('zweite Folge der Bündelzeile läuft (Programm der Reihe a)', tvJetzt(gruppen, reihen, '20:50')?.zustand.zeilen[0], { art: 'laeuft', bis: '21:05', folge: 6 })
pruefe('zweite Zeile läuft (Programm der Reihe b)', tvJetzt(gruppen, reihen, '22:10')?.zustand.zeilen, [{ art: 'vorbei' }, { art: 'laeuft', bis: '22:25' }])
pruefe('alles vorbei', tvJetzt(gruppen, reihen, '23:00'), {
  zustand: { zeilen: [{ art: 'vorbei' }, { art: 'vorbei' }], alleVorbei: true },
  linie: { linieVor: 2, nichtsMehr: true, restInZeile: false },
})

// Ohne Programm (unbekannte Reihe oder Reihe ohne `sendungen`) läuft nichts, die Zeile ist nach Uhrzeit vorbei oder später.
const ohne = [[termin('ohne-programm', '20:15')], [termin('fehlt', '22:00')]]
pruefe('ohne Programm', tvJetzt(ohne, reihen, '20:20')?.zustand.zeilen, [{ art: 'vorbei' }, { art: 'naechste', minuten: 100 }])

// „heute“ kommt vom ersten Termin: Sendungen eines anderen Tages laufen nicht.
const morgen = [[termin('a', '20:15', 5, '2026-11-14')]]
pruefe('anderer Tag', tvJetzt(morgen, reihen, '20:20')?.zustand.zeilen, [{ art: 'vorbei' }])
const gemischt = [[termin('a', '20:15', 5)], [termin('b', '22:00', 1, '2026-11-14')]]
pruefe('Tag der ersten Zeile gilt für alle', tvJetzt(gemischt, reihen, '20:20')?.zustand.zeilen[0], { art: 'laeuft', bis: '20:40' })

if (fehler) {
  console.error(`check-tv-jetzt: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-tv-jetzt: ok')
