/**
 * Zusicherungen zu `lib/rohfolgen-doppelte.ts`: Schlüssel ist der ganze Inhalt (gleiche Nummer, anderer Inhalt bleibt), die jüngste
 * Zeile gewinnt, bei gleichem Zeitpunkt die höhere Kennung, Reihenfolge der ersten Fundstelle. Läuft in `check:logic`.
 */
import { ohneDoppelte } from './lib/rohfolgen-doppelte.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const U = 'https://www.amazon.de/gp/video/detail/B0X'
interface Folge {
  id: number
  url: string
  nummer: number | null
  titel: string | null
  erschienen: string | null
  sprachen: string | null
  gemeldet_am: string
}
function folge(id: number, gemeldet_am: string, teil: Partial<Folge> = {}): Folge {
  return { id, url: U, nummer: 1, titel: 'Folge 1', erschienen: '2026-10-01', sprachen: 'de,ja', gemeldet_am, ...teil }
}

{
  const leer: Folge[] = []
  const r = ohneDoppelte(leer)
  pruefe('leer', [r.folgen, r.veraltet], [[], []])
}
{
  const ohne = [folge(1, '2026-10-01'), folge(2, '2026-10-01', { nummer: 2 })]
  const r = ohneDoppelte(ohne)
  pruefe('ohne Doppelte: dieselbe Liste unverändert', [r.folgen === ohne, r.veraltet], [true, []])
}

pruefe('jüngste Meldung gewinnt, auch wenn sie zuerst steht', ohneDoppelte([folge(5, '2026-10-03'), folge(3, '2026-10-01'), folge(4, '2026-10-02')]), {
  folgen: [folge(5, '2026-10-03')],
  veraltet: [3, 4],
})
pruefe('jüngste Meldung gewinnt, wenn sie zuletzt steht', ohneDoppelte([folge(3, '2026-10-01'), folge(4, '2026-10-02')]).veraltet, [3])
pruefe('gleicher Zeitpunkt: höhere Kennung gewinnt', ohneDoppelte([folge(9, '2026-10-01'), folge(8, '2026-10-01'), folge(10, '2026-10-01')]), {
  folgen: [folge(10, '2026-10-01')],
  veraltet: [8, 9],
})

{
  // Detektiv Conan: deutsche Zählung neben der japanischen, gleiche Nummer bei anderem Inhalt.
  const r = ohneDoppelte([
    folge(1, '2026-10-01', { nummer: 149, titel: 'Der Mord im Zug' }),
    folge(2, '2026-10-01', { nummer: 149, titel: 'Ein anderer Fall' }),
    folge(3, '2026-10-01', { nummer: 149, titel: 'Der Mord im Zug', sprachen: 'ja' }),
    folge(4, '2026-10-01', { nummer: 149, titel: 'Der Mord im Zug', erschienen: null }),
    folge(5, '2026-10-01', { nummer: 149, titel: 'Der Mord im Zug', url: `${U}2` }),
    folge(6, '2026-10-01', { nummer: null, titel: 'Der Mord im Zug' }),
  ])
  pruefe('anderer Inhalt bei gleicher Nummer ist keine Dublette', [r.folgen.length, r.veraltet], [6, []])
}

pruefe('null und leerer Text sind derselbe Schlüssel', ohneDoppelte([folge(1, '2026-10-01', { titel: null }), folge(2, '2026-10-02', { titel: '' })]).veraltet, [1])

pruefe(
  'Reihenfolge: Platz der ersten Fundstelle, Inhalt der jüngsten',
  ohneDoppelte([folge(1, '2026-10-01'), folge(2, '2026-10-01', { nummer: 2 }), folge(3, '2026-10-05'), folge(4, '2026-10-01', { nummer: 2 })]).folgen.map((f) => f.id),
  [3, 4],
)

if (fehler) process.exit(1)
console.log('check-rohfolgen-doppelte: ok')
