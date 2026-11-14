/**
 * Zusicherungen zu `worker/src/pruefung-stand-briefkasten.ts` an einer DB-Attrappe (keine D1): `wartendSchluessel()` ersetzt die Abfrage
 * der Adresse; `holeWartende()` sammelt Adressen je Plattform (ohne leere Adressen, ohne Doppel) und Staffeln je Adresse (nur Zahlen),
 * aus Folgen- und Titelzeilen; mit Cache geht das Ergebnis als JSON hin und zurück, unter Schlüssel und Frist. Läuft in `check:worker`.
 */
import type { Env } from '../worker/src/env.ts'
import type { AusCache } from '../worker/src/cache-kurz.ts'
import { holeWartende, WARTEND_SEKUNDEN, wartendSchluessel } from '../worker/src/pruefung-stand-briefkasten.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

type Zeile = { plattform: string; url: string; folge_nr: number | null; staffel: number | null }

/** Attrappe: Folgenzeilen für `FROM pruefung `, Titelzeilen für `FROM pruefung_titel`; zählt die Abfragen. */
function umgebung(folgen: Zeile[] | undefined, titel: Zeile[] | undefined) {
  const abfragen: string[] = []
  const env = {
    DB: {
      prepare: (sql: string) => ({
        all: async () => {
          abfragen.push(sql)
          return { results: /FROM pruefung_titel/.test(sql) ? titel : folgen }
        },
      }),
    },
  } as unknown as Env
  return { env, abfragen }
}

/** Mengen als sortierte Listen, damit der Vergleich nicht an der Einfügereihenfolge hängt. */
const flach = (w: { adressen: Map<string, Set<string>>; staffeln: Map<string, Set<number>> }) => ({
  adressen: [...w.adressen].map(([k, v]) => [k, [...v].sort()]).sort(),
  staffeln: [...w.staffeln].map(([k, v]) => [k, [...v].sort((a, b) => a - b)]).sort(),
})

const z = (plattform: string, url: string, staffel: number | null = null, folge_nr: number | null = 1): Zeile => ({ plattform, url, folge_nr, staffel })

async function main() {
  pruefe('Schlüssel ersetzt die Abfrage', wartendSchluessel('https://w.example/api/pruefung?stand=1&x=2'), 'https://w.example/api/pruefung?wartend=1')
  pruefe('Schlüssel ohne Abfrage', wartendSchluessel('https://w.example/api/pruefung'), 'https://w.example/api/pruefung?wartend=1')
  pruefe('Schlüssel lässt den Anker stehen', wartendSchluessel('https://w.example/a?b=1#c'), 'https://w.example/a?wartend=1#c')

  const folgen = [
    z('netflix', 'https://n/1', 1),
    z('netflix', 'https://n/1', 2),
    z('netflix', 'https://n/1', 2, 3),
    z('netflix', 'https://n/2', null),
    z('primevideo', 'https://p/1', 0),
    z('primevideo', '', 4),
  ]
  const titel = [z('primevideo', 'https://p/1', 3, null), z('disneyplus', 'https://d/1', null, null)]
  const a = umgebung(folgen, titel)
  const direkt = await holeWartende(a.env)
  pruefe('ohne Cache: Adressen und Staffeln', flach(direkt), {
    adressen: [
      ['disneyplus', ['https://d/1']],
      ['netflix', ['https://n/1', 'https://n/2']],
      ['primevideo', ['https://p/1']],
    ],
    staffeln: [
      ['https://n/1', [1, 2]],
      ['https://p/1', [0, 3]],
    ],
  })
  pruefe('liest nur offene Zeilen beider Tabellen', a.abfragen.length === 2 && a.abfragen.every((s) => /uebernommen = 0/.test(s)), true)

  pruefe('leere Ergebnisse', flach(await holeWartende(umgebung([], []).env)), { adressen: [], staffeln: [] })
  pruefe('fehlende results', flach(await holeWartende(umgebung(undefined, undefined).env)), { adressen: [], staffeln: [] })

  // Mit Cache: bauen nur, wenn der Cache es verlangt; Frist und Schlüssel kommen an, das Ergebnis übersteht JSON.
  const aufrufe: { sekunden?: number; schluessel?: string }[] = []
  const ausCache: AusCache = async (bauen, sekunden, schluessel) => {
    aufrufe.push({ sekunden, schluessel })
    return await bauen()
  }
  const b = umgebung(folgen, titel)
  const gecacht = await holeWartende(b.env, { ausCache, schluessel: 'https://w.example/a?wartend=1' })
  pruefe('mit Cache: dasselbe Ergebnis', flach(gecacht), flach(direkt))
  pruefe('mit Cache: Mengen wieder Mengen', gecacht.adressen.get('netflix') instanceof Set && gecacht.staffeln.get('https://n/1') instanceof Set, true)
  pruefe('mit Cache: Staffeln bleiben Zahlen', [...gecacht.staffeln.get('https://p/1')!].every((s) => typeof s === 'number'), true)
  pruefe('mit Cache: Frist und Schlüssel', aufrufe, [{ sekunden: WARTEND_SEKUNDEN, schluessel: 'https://w.example/a?wartend=1' }])
  pruefe('Frist zwei Stunden', WARTEND_SEKUNDEN, 7200)

  // Ein Treffer im Cache liest die Datenbank nicht.
  const c = umgebung(folgen, titel)
  const treffer: AusCache = async () => Response.json({ adressen: [['adn', ['https://a/1']]], staffeln: [['https://a/1', [5]]] })
  pruefe('Cache-Treffer', flach(await holeWartende(c.env, { ausCache: treffer, schluessel: 'x' })), { adressen: [['adn', ['https://a/1']]], staffeln: [['https://a/1', [5]]] })
  pruefe('Cache-Treffer ohne Abfrage', c.abfragen.length, 0)

  if (fehler) {
    console.error(`worker-pruefung-stand-briefkasten: ${fehler} Fehler`)
    process.exit(1)
  }
  console.log('worker-pruefung-stand-briefkasten: ok')
}

void main()
