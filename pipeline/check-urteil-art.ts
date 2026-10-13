/**
 * Zusicherung: **die Art einer Beobachtung (gemessen/angenommen) kommt aus der Meldung, nicht aus dem Freitext der Notiz** (12.10.2026).
 *
 * Die Randprobe über eine Staffel meldet E1 und die letzte Folge gemessen, alle dazwischen angenommen. Die Notiz
 * „ANGENOMMEN aus Randprobe …" stand früher bei jeder Folge; `fetch-urteile.ts` machte daraus auch für die zwei
 * Randfolgen eine Annahme. Auch die Rohfolge (`roh.angenommen`) zählte als gemessen. Läuft in `check:logic`.
 */
import { artDerMeldung, artDerRohfolge, urteileJeFolge, type UrteilBeobachtung } from './lib/urteil-je-folge.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, info)
}

const RAND = 'ANGENOMMEN aus Randprobe — gemessen: Folge 1 und 15, dazwischen nicht geprüft'
pruefe('die art der Meldung schlägt die Notiz: gemessen trotz ANGENOMMEN', artDerMeldung({ art: 'gemessen', notiz: RAND }) === 'gemessen')
pruefe('angenommen bleibt angenommen', artDerMeldung({ art: 'angenommen', notiz: RAND }) === 'angenommen')
pruefe('angenommen auch ohne Wort in der Notiz', artDerMeldung({ art: 'angenommen', notiz: null }) === 'angenommen')
pruefe('ohne art (vor 4.21.0) liest die Notiz: ANGENOMMEN', artDerMeldung({ art: null, notiz: RAND }) === 'angenommen')
pruefe('ohne art und ohne Wort: gemessen', artDerMeldung({ art: null, notiz: 'Durchlauf: Folge 3' }) === 'gemessen')
pruefe('ohne art und ohne Notiz: gemessen', artDerMeldung({ art: null, notiz: null }) === 'gemessen')

pruefe('Rohfolge mit roh.angenommen = 1: angenommen', artDerRohfolge({ angenommen: 1 }) === 'angenommen')
pruefe('Rohfolge ohne das Feld (Prime, Disney+, älterer Worker): gemessen', artDerRohfolge({}) === 'gemessen')
pruefe('Rohfolge mit angenommen = null: gemessen', artDerRohfolge({ angenommen: null }) === 'gemessen')

/* Zusammen: Randprobe über drei Folgen, jede Folge einmal als Meldung und einmal als Rohfolge — wie `fetch-urteile.ts` sie sammelt. */
const b = (folge: number, angenommen: boolean, quelle: 'meldung' | 'rohfolge'): UrteilBeobachtung => ({
  titel: 1,
  anbieter: 'netflix',
  folge,
  vorhanden: 'ja',
  tonDe: 'ja',
  tag: '2026-10-12',
  art: quelle === 'meldung' ? artDerMeldung({ art: angenommen ? 'angenommen' : 'gemessen', notiz: RAND }) : artDerRohfolge({ angenommen: angenommen ? 1 : 0 }),
})
const u = urteileJeFolge([1, 2, 3].flatMap((n) => [b(n, n === 2, 'meldung'), b(n, n === 2, 'rohfolge')]))
pruefe('Randprobe: E1 und E3 sind gemessen', u['1|netflix|1']?.art === 'gemessen' && u['1|netflix|3']?.art === 'gemessen', u)
pruefe('Randprobe: nur E2 dazwischen ist angenommen', u['1|netflix|2']?.art === 'angenommen', u['1|netflix|2'])

if (fehler) process.exit(1)
console.log('Urteil-Art: alle Zusicherungen halten.')
