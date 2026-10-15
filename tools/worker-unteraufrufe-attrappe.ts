/**
 * Attrappen für Tests, die **Unteraufrufe** eines Worker-Aufrufs zählen (Free-Stufe: 50 je Aufruf, D1 zählt mit).
 * D1 läuft auf node:sqlite; jede Anweisung eines `batch()` zählt einzeln, weil die Doku offenlässt, ob ein Stapel
 * eine oder viele Abfragen ist (vorsichtige Annahme, 15.10.2026). fetch antwortet ohne Netz.
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import type { Env } from '../worker/src/env.ts'

export const zaehler = { fetch: 0, d1: 0, objekt: 0, stapel: [] as Record<string, unknown>[][], einzelmails: 0, ablehnen: 0, stoerung: null as RegExp | null }
export const unteraufrufe = () => zaehler.fetch + zaehler.d1 + zaehler.objekt

export function zaehlerZurueck(): void {
  Object.assign(zaehler, { fetch: 0, d1: 0, objekt: 0, stapel: [], einzelmails: 0, ablehnen: 0, stoerung: null as RegExp | null })
}

type Wert = string | number | null
interface Anweisung {
  sql: string
  werte: Wert[]
}

/** `zaehler.stoerung` lässt passende Abfragen scheitern wie eine gesperrte D1. */
function anweisung(db: DatabaseSync, a: Anweisung) {
  const ausfuehren = () => {
    if (zaehler.stoerung?.test(a.sql)) throw new Error('D1_ERROR: Störung (Attrappe)')
    return db.prepare(a.sql)
  }
  return {
    ...a,
    bind: (...werte: Wert[]) => anweisung(db, { sql: a.sql, werte }),
    run: async () => {
      zaehler.d1++
      return { meta: { changes: Number(ausfuehren().run(...a.werte).changes) } }
    },
    all: async () => {
      zaehler.d1++
      return { results: ausfuehren().all(...a.werte) }
    },
    first: async (spalte?: string) => {
      zaehler.d1++
      const zeile = ausfuehren().get(...a.werte) as Record<string, unknown> | undefined
      return zeile ? (spalte ? zeile[spalte] : zeile) : null
    },
  }
}

/** D1-Attrappe über einer node:sqlite-Datenbank. */
export function d1(db: DatabaseSync): D1Database {
  return {
    prepare: (sql: string) => anweisung(db, { sql, werte: [] }),
    batch: async (liste: Anweisung[]) => {
      zaehler.d1 += liste.length
      return liste.map((a) => ({ results: db.prepare(a.sql).all(...a.werte) }))
    },
  } as unknown as D1Database
}

/** Datenbank mit schema.sql und allen Migrationen; was schema.sql schon hat, scheitert in der Migration still. */
export function neueDatenbank(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync('worker/schema.sql', 'utf8'))
  for (const datei of readdirSync('worker/migrations').sort()) {
    for (const teil of readFileSync(`worker/migrations/${datei}`, 'utf8').split(/;\s*\n/)) {
      try {
        db.exec(teil)
      } catch {
        /* Spalte oder Tabelle gibt es schon */
      }
    }
  }
  return db
}

const json = (wert: unknown, status = 200) => new Response(JSON.stringify(wert), { status, headers: { 'content-type': 'application/json' } })

/** Ersetzt `fetch`: Seiten-Daten mit einem Termin am Tag `heute`, Resend, GitHub, Monitor-Seiten. */
export function fetchAttrappe(heute: string): void {
  globalThis.fetch = (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url
    zaehler.fetch++
    if (url.endsWith('/emails/batch')) {
      const liste = JSON.parse(String(init?.body)) as Record<string, unknown>[]
      zaehler.stapel.push(liste)
      if (zaehler.ablehnen > 0) {
        zaehler.ablehnen--
        return new Response('abgelehnt', { status: 500 })
      }
      return json({ data: liste.map((_, i) => ({ id: `m${i}` })) })
    }
    if (url.includes('api.resend.com')) {
      zaehler.einzelmails++
      return json({ id: 'x' })
    }
    if (url.endsWith('data/events.json')) {
      return json([{ id: 'e1', releaseSlug: 's', titleId: 1, date: heute, releaseType: 'weekly', platform: 'netflix', name: 'Test', episode: 1, episodeCount: 12, time: '10:00' }])
    }
    if (url.includes('/data/')) return json(url.includes('reihen') ? {} : [])
    if (url.includes('api.github.com') && url.includes('/runs')) return json({ workflow_runs: [] })
    if (url.includes('api.github.com')) return new Response(null, { status: 204 })
    if (url.includes('crunchyroll')) return json({ country: 'DE' })
    if (url.includes('githubstatus')) return json({})
    return new Response('x'.repeat(6000) + ' "date" ', { status: 200 })
  }) as typeof fetch
}

const objektNamensraum = {
  idFromName: () => ({}),
  get: () => ({
    fetch: async () => {
      zaehler.objekt++
      return new Response('ok')
    },
  }),
}

export function testEnv(db: DatabaseSync, sendeStunde: number): Env {
  return {
    DB: d1(db),
    SITE_URL: 'https://anime-kalender.de/',
    ALLOWED_ORIGIN: 'https://anime-kalender.de',
    WORKER_URL: 'https://w.example.invalid',
    MAIL_PROVIDER: 'resend',
    MAIL_API_KEY: 'attrappe',
    FROM_EMAIL: 'k@example.invalid',
    FROM_NAME: 'T',
    SEND_HOUR_BERLIN: String(sendeStunde),
    MONITOR_EMAIL: 'monitor@example.invalid',
    GITHUB_WECKER_TOKEN: 'attrappe',
    SCHNELLMESSER: objektNamensraum,
    EREIGNISSE: objektNamensraum,
  } as unknown as Env
}

export function abonnenten(db: DatabaseSync, anzahl: number): void {
  db.exec('DELETE FROM subscribers')
  const neu = db.prepare(
    `INSERT INTO subscribers (id, email, frequency, platforms, favorites, status, confirm_token, unsub_token, pref_token, created_at)
     VALUES (?1, ?2, 'daily', '', '', 'active', 'c', 'u' || ?1, 'p' || ?1, '2026-01-01')`,
  )
  for (let i = 0; i < anzahl; i++) neu.run(`id${i}`, `a${i}@example.invalid`)
}
