/**
 * Zusicherung: Die Ladeabfragen der Rohfolgen erzwingen ihren Index (28.09.2026: ohne ihn nahm der Planer
 * `prime_folge_plattform` und las im Mittel 3430 Zeilen je Aufruf). Statt den Quelltext zu lesen, läuft
 * `ladeRohfolgen` gegen eine Attrappe der Datenbank, die die gestellten Anweisungen mitschreibt.
 * Erfundene Adressen und Kennungen, kein Netz.
 */
import { ladeRohfolgen } from '../worker/src/rohfolgen-abgleich.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (!ok) {
    fehler++
    console.error(`✖ ${name}${ist === undefined ? '' : ` — ${JSON.stringify(ist)}`}`)
  }
}

async function anweisungen(plattform: string, seitenKennung: string | null, kennungen: string[]): Promise<string[]> {
  const sqls: string[] = []
  const env = {
    DB: {
      prepare: (sql: string) => {
        sqls.push(sql)
        return { bind: () => ({ all: async () => ({ results: [] }) }) }
      },
    },
  }
  await ladeRohfolgen(env as never, plattform, 'https://beispiel.test/serie', seitenKennung, kennungen)
  return sqls
}

const prime = await anweisungen('primevideo', 'S1', [])
pruefe('Prime: genau eine Abfrage mit dem Seiten-Index', prime.length === 1 && prime[0].includes('INDEXED BY prime_folge_seite'), prime)

const primeMitKennungen = await anweisungen('primevideo', 'S1', ['g1', 'g2'])
pruefe('Prime trotz Kennungen: genau eine Abfrage mit dem Seiten-Index', primeMitKennungen.length === 1 && primeMitKennungen[0].includes('INDEXED BY prime_folge_seite'), primeMitKennungen)

const netflix = await anweisungen('netflix', null, ['g1', 'g2'])
pruefe('Netflix je Kennung: genau eine Abfrage mit dem gti-Index', netflix.length === 1 && netflix[0].includes('INDEXED BY prime_folge_gti'), netflix)
pruefe('Netflix je Kennung: nicht der Seiten-Index', !netflix[0].includes('prime_folge_seite'), netflix)

const ohneKennung = await anweisungen('netflix', null, [])
pruefe('ohne Kennungen fällt die Abfrage auf die Seite zurück (Seiten-Index)', ohneKennung.length === 1 && ohneKennung[0].includes('INDEXED BY prime_folge_seite'), ohneKennung)

const viele = await anweisungen('netflix', null, Array.from({ length: 100 }, (_, i) => `g${i}`))
pruefe('mehr Kennungen als ein Stapel: jede Abfrage trägt den gti-Index', viele.length === 2 && viele.every((s) => s.includes('INDEXED BY prime_folge_gti')), viele.length)

console.log(`worker-rohfolgen-index: ${faelle} Fälle, ${fehler} Fehler.`)
process.exit(fehler ? 1 : 0)
