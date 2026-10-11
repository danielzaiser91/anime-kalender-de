/**
 * Attrappe für `berechnePruefstand`: ein Briefkasten aus Zeilen im Speicher und ein Prüfstand, den
 * `fetch` liefert. Nie gegen den echten Briefkasten. Gemeinsam genutzt von `worker-pruefstand.test.ts`.
 */
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { type Env } from '../worker/src/env.ts'

export type Zeile = { plattform: string; url: string; staffel?: number | null; uebernommen: 0 | 1; gemeldet_am: string }

type Ziel = { url: string; titel: string; staffeln?: number[]; seit?: string }
export type Anbieter = { name: string; plattform: string; offen: number; gesamt: number; gemeldet: number; ziele: Ziel[] }

const nurAdresse = (z: Zeile) => ({ plattform: z.plattform, url: z.url, staffel: z.staffel ?? null })

/** Bildet die vier Abfragen aus `pruefung-stand.ts` nach — nach dem Anfang der SQL-Zeichenkette erkannt. */
function ergebnisFuer(zeilen: Zeile[], sql: string, arg: unknown[]) {
  const mitUrl = zeilen.filter((z) => z.url)
  if (sql.includes('json_each')) {
    const gesucht = new Set(JSON.parse(String(arg[0])) as string[])
    const letzte = new Map<string, { plattform: string; url: string; am: string }>()
    for (const z of mitUrl.filter((x) => gesucht.has(x.url))) {
      const schluessel = `${z.plattform} ${z.url}`
      const alt = letzte.get(schluessel)
      if (!alt || alt.am < z.gemeldet_am) letzte.set(schluessel, { plattform: z.plattform, url: z.url, am: z.gemeldet_am })
    }
    return [...letzte.values()]
  }
  if (sql.includes('uebernommen = 0')) return zeilen.filter((z) => !z.uebernommen).map(nurAdresse)
  if (sql.includes('gemeldet_am > ?1')) return mitUrl.filter((z) => z.gemeldet_am > String(arg[0])).map(nurAdresse)
  return mitUrl.map(nurAdresse)
}

function baueDb(zeilen: Zeile[]) {
  return {
    prepare(sql: string) {
      const lauf = (arg: unknown[]) => ({ all: async () => ({ results: ergebnisFuer(zeilen, sql, arg) }) })
      return { bind: (...arg: unknown[]) => lauf(arg), ...lauf([]) }
    },
  }
}

/** Rechnet den Prüfstand mit gegebenen Briefkasten-Zeilen und einem Prüfstand, der um `erzeugtAm` gebaut wurde. */
export async function rechnePruefstand(zeilen: Zeile[], anbieter: Anbieter[], erzeugtAm = '2026-10-11T16:00:00.000Z') {
  const env = { DB: baueDb(zeilen), SITE_URL: 'https://attrappe.test/' } as unknown as Env
  const echtesFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm, anbieter }))) as typeof fetch
  try {
    const antwort = (body: unknown) => Response.json(body)
    const res = await berechnePruefstand({ env, antwort })
    return (await res.json()) as {
      anbieter: { plattform: string; offen: number; titel: number; unterwegs: number; ohneSeite: number; ziele: Ziel[] }[]
    }
  } finally {
    globalThis.fetch = echtesFetch
  }
}
