/**
 * Attrappe für `berechnePruefstand`: ein Briefkasten aus Zeilen im Speicher und ein Prüfstand, den
 * `fetch` liefert. Nie gegen den echten Briefkasten. Gemeinsam genutzt von `worker-pruefstand.test.ts`.
 */
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { type Env } from '../worker/src/env.ts'

export type Zeile = { plattform: string; url: string; staffel?: number | null; uebernommen: 0 | 1; gemeldet_am: string }

type Ziel = { url: string; titel: string; staffeln?: number[]; seit?: string }
export type Anbieter = { name: string; plattform: string; offen: number; gesamt: number; gemeldet: number; ziele: Ziel[]; ohneSeite?: number; suchAdressen?: string[] }

const nurAdresse = (z: Zeile) => ({ plattform: z.plattform, url: z.url, staffel: z.staffel ?? null })

/** Bildet die Abfragen aus `pruefung-stand.ts` nach — nach dem Anfang der SQL-Zeichenkette erkannt. */
export type Titelzeile = { url: string; daten: string }

function ergebnisFuer(zeilen: Zeile[], sql: string, arg: unknown[], titelzeilen: Titelzeile[] | Error) {
  if (sql.includes('FROM titel_zeile WHERE url IN')) {
    if (titelzeilen instanceof Error) throw titelzeilen
    return titelzeilen
  }
  const mitUrl = zeilen.filter((z) => z.url)
  if (sql.includes('uebernommen = 0')) return zeilen.filter((z) => !z.uebernommen).map(nurAdresse)
  if (sql.includes('gemeldet_am > ?1')) return mitUrl.filter((z) => z.gemeldet_am > String(arg[0])).map(nurAdresse)
  return mitUrl.map(nurAdresse)
}

function baueDb(zeilen: Zeile[], titelzeilen: Titelzeile[] | Error) {
  return {
    prepare(sql: string) {
      const lauf = (arg: unknown[]) => ({ all: async () => ({ results: ergebnisFuer(zeilen, sql, arg, titelzeilen) }) })
      return { bind: (...arg: unknown[]) => lauf(arg), ...lauf([]) }
    },
  }
}

/** Rechnet den Prüfstand mit gegebenen Briefkasten-Zeilen und einem Prüfstand, der um `erzeugtAm` gebaut wurde. */
export async function rechnePruefstand(
  zeilen: Zeile[],
  anbieter: Anbieter[],
  erzeugtAm = '2026-10-11T16:00:00.000Z',
  titelzeilen: Titelzeile[] | Error = [],
) {
  const env = { DB: baueDb(zeilen, titelzeilen), SITE_URL: 'https://attrappe.test/' } as unknown as Env
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
