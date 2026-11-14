/**
 * Zusicherungen zu `lib/news-cr-zuordnung.ts`: Crunchyroll-Serienkennung → Titel (Staffeln teilen sich eine Kennung) und die Wahl
 * der Staffel für Folgen einer Meldung (Re:ZERO-Fall: jüngster passender Start bis zum Tag, Folgenbereich). Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { titelNachSerienId, waehleStaffel } from './lib/news-cr-zuordnung.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const SERIE = 'GRGGPG93R'
const cr = (id = SERIE, sprache = 'de/') => `https://www.crunchyroll.com/${sprache}series/${id}/re-zero`
const titel = (id: number, urls: string[]) => ({ id, streams: urls.map((url) => ({ platform: 'crunchyroll', url })) }) as unknown as Title

const s3 = titel(3, [cr()])
const s4 = titel(4, [cr(SERIE, ''), cr()])
const anderer = titel(9, [cr('G0XHWM1JP'), 'https://www.netflix.com/title/1'])
const ohne = titel(10, ['https://www.crunchyroll.com/de/watch/ABC/folge'])

{
  const karte = titelNachSerienId([s3, s4, anderer, ohne])
  pruefe('Kennungen', [...karte.keys()], [SERIE, 'G0XHWM1JP'])
  pruefe('Staffeln teilen die Kennung, ein Titel nur einmal trotz zwei Verweisen', karte.get(SERIE)?.map((t) => t.id), [3, 4])
  pruefe('Groß/klein der Adresse egal', titelNachSerienId([titel(5, ['https://WWW.CRUNCHYROLL.COM/SERIES/abc123'])]).has('abc123'), true)
  pruefe('ohne Titel', titelNachSerienId([]).size, 0)
}

const rel = (titleId: number, start: string, teil: Record<string, unknown> = {}) =>
  ({ titleId, platform: 'crunchyroll', platformUrl: cr(), schedule: { firstEpisodeDate: start, ...teil } }) as unknown as Release
const releases = [rel(3, '2024-10-02', { episodeCount: 16 }), rel(4, '2026-10-08', { firstEpisodeNumber: 67, episodeCount: 16 })]

pruefe('ein Kandidat: dieser', waehleStaffel([s3], releases, SERIE, '2026-10-15', [1])?.id, 3)
pruefe('keine Kandidaten', waehleStaffel(undefined, releases, SERIE, '2026-10-15', [1]), undefined)
pruefe('leere Kandidatenliste', waehleStaffel([], releases, SERIE, '2026-10-15', [1]), undefined)
pruefe('Re:ZERO: neue Staffel nach ihrem Start, Folgen im Bereich', waehleStaffel([s3, s4], releases, SERIE, '2026-10-15', [67, 68])?.id, 4)
pruefe('Folgen im Bereich der alten Staffel', waehleStaffel([s3, s4], releases, SERIE, '2026-10-15', [5])?.id, 3)
pruefe('vor dem Start der neuen Staffel: die laufende, auch wenn die neue vorn steht', waehleStaffel([s4, s3], releases, SERIE, '2026-10-07', [5])?.id, 3)
pruefe('Starttag zählt', waehleStaffel([s3, s4], releases, SERIE, '2026-10-08', [67])?.id, 4)
pruefe('Folgen über das Ende des Bereichs: erster Kandidat', waehleStaffel([s3, s4], releases, SERIE, '2026-10-15', [83])?.id, 3)
pruefe('ohne Folgenzahl nach oben offen', waehleStaffel([s3, s4], [rel(3, '2024-10-02'), rel(4, '2026-10-08', { firstEpisodeNumber: 67 })], SERIE, '2026-10-15', [200])?.id, 4)
pruefe('Release einer anderen Kennung zählt nicht', waehleStaffel([s3, s4], [rel(3, '2024-10-02'), { ...rel(4, '2026-10-08'), platformUrl: cr('ANDERE') } as Release], SERIE, '2026-10-15', [1])?.id, 3)
pruefe('Release einer anderen Plattform zählt nicht', waehleStaffel([s3, s4], [rel(3, '2024-10-02'), { ...rel(4, '2026-10-08'), platform: 'netflix' } as Release], SERIE, '2026-10-15', [1])?.id, 3)
pruefe('kein passendes Release: erster Kandidat', waehleStaffel([s4, s3], [], SERIE, '2026-10-15', [1])?.id, 4)
pruefe('mehrere Starts eines Titels: jüngster zählt', waehleStaffel([s3, s4], [rel(3, '2026-10-10'), rel(3, '2020-01-01'), rel(4, '2026-10-08')], SERIE, '2026-10-15', [1])?.id, 3)
pruefe('ohne Nummern: jeder Bereich passt', waehleStaffel([s3, s4], releases, SERIE, '2026-10-15', [])?.id, 4)

if (fehler) process.exit(1)
console.log('check-news-cr-zuordnung: ok')
