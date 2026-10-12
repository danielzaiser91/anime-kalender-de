/**
 * Zusicherungen zu den Staffeln der Cartoons (`lib/cartoon-staffeln.ts`, `bau/cartoon-staffeln.ts`): JustWatch vor TMDB,
 * Specials zählen nicht, ein Widerspruch oder eine Summe neben der Gesamtfolgenzahl (±3) landet mit Grund auf der
 * Prüfliste. Läuft in `check:logic`; der Bestandsteil steht in `check-cartoon-staffeln-bestand.ts`.
 */
import { jwStaffeln, tmdbStaffeln, waehleStaffeln } from './lib/cartoon-staffeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const tmdb = (...folgen: number[]) => tmdbStaffeln(folgen.map((episode_count, i) => ({ season_number: i + 1, episode_count, air_date: `2020-0${i + 1}-01` })))
const jw = (...folgen: number[]) => jwStaffeln(folgen.map((f, i) => ({ nr: i + 1, folgen: f })))

const roh = tmdbStaffeln([
  { season_number: 2, episode_count: 9, air_date: '2021-01-01' },
  { season_number: 0, episode_count: 13 },
  { season_number: 1, episode_count: 12, air_date: null },
  { season_number: 3, episode_count: 0 },
])
pruefe('TMDB: Staffel 0 und leere Staffeln fallen weg, Reihenfolge nach Nummer', roh?.map((s) => `${s.nr}:${s.folgen}`).join() === '1:12,2:9', JSON.stringify(roh))
pruefe('TMDB: Starttag nur, wo TMDB einen nennt', roh?.[0].start === undefined && roh?.[1].start === '2021-01-01')
pruefe('TMDB: nur Specials ergibt keine Staffeln', tmdbStaffeln([{ season_number: 0, episode_count: 3 }]) === undefined && tmdbStaffeln(undefined) === undefined)
pruefe('JustWatch: Staffel 0 und Staffeln ohne Zahl fallen weg', jwStaffeln([{ nr: 0, folgen: 4 }, { nr: 1, folgen: 10 }, { nr: 2 }])?.length === 1)

const nurTmdb = waehleStaffeln(undefined, tmdb(13, 10), 23)
pruefe('nur TMDB: Quelle tmdb, nichts zu prüfen', nurTmdb?.quelle === 'tmdb' && nurTmdb.gruende.length === 0)
const nurJw = waehleStaffeln(jw(10, 9), undefined, 19)
pruefe('nur JustWatch: Quelle justwatch, nichts zu prüfen', nurJw?.quelle === 'justwatch' && nurJw.gruende.length === 0)
pruefe('keine Quelle: keine Staffeln', waehleStaffeln(undefined, undefined, 5) === undefined)

const gleich = waehleStaffeln(jw(26, 26), tmdb(26, 26), 52)
pruefe('beide gleich: JustWatch, Starttag von TMDB, nichts zu prüfen', gleich?.quelle === 'justwatch' && gleich.gruende.length === 0 && gleich.staffeln[0].start === '2020-01-01')

const jack = waehleStaffeln(jw(10, 10, 10), tmdb(1, 10, 10), 21)
pruefe('Widerspruch: JustWatch gewinnt, Grund steht da', jack?.quelle === 'justwatch' && jack.staffeln[0].folgen === 10 && jack.gruende.some((g) => g.startsWith('Quellen widersprechen sich')), JSON.stringify(jack))
pruefe('Widerspruch: Starttag nur bei gleicher Nummer und Folgenzahl', jack?.staffeln[0].start === undefined && jack?.staffeln[1].start === '2020-02-01')

// Handbeleg gewinnt gegen beide Quellen (Jack: JustWatch 10/10/10 falsch, TMDB und Netflix 1/10/10) und braucht keine Prüfung.
const handJack = [{ nr: 3, folgen: 10 }, { nr: 1, folgen: 1 }, { nr: 2, folgen: 10 }]
const jackHand = waehleStaffeln(jw(10, 10, 10), tmdb(1, 10, 11), 21, handJack)
pruefe('Handbeleg: gewinnt gegen JustWatch und TMDB, nach Nummer geordnet', jackHand?.quelle === 'handbeleg' && jackHand.staffeln.map((s) => s.folgen).join() === '1,10,10', JSON.stringify(jackHand))
pruefe('Handbeleg: kein Widerspruch, nichts zu prüfen', jackHand?.gruende.length === 0)
pruefe('Handbeleg: gilt auch ohne jede andere Quelle', waehleStaffeln(undefined, undefined, undefined, handJack)?.quelle === 'handbeleg')

const pj = waehleStaffeln(jw(40, 15, 20, 30, 20, 15, 15), tmdb(43), 43)
pruefe('Summe weit neben der Gesamtfolgenzahl: Grund', pj?.gruende.some((g) => g.includes('Gesamtfolgenzahl 43')) === true, JSON.stringify(pj))
pruefe('Summe um genau 3 daneben: kein Grund', waehleStaffeln(undefined, tmdb(13, 10), 26)?.gruende.length === 0)
pruefe('Summe um 4 daneben: Grund', waehleStaffeln(undefined, tmdb(13, 10), 27)?.gruende.length === 1)
pruefe('ohne Gesamtfolgenzahl wird die Summe nicht geprüft', waehleStaffeln(undefined, tmdb(13, 10), undefined)?.gruende.length === 0)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den Cartoon-Staffeln verletzt`)
  process.exit(1)
}
console.log('Cartoon-Staffeln: Zusicherungen erfüllt')
