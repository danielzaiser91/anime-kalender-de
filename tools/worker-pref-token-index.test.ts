/**
 * **Index auf `subscribers.pref_token`** (14.10.2026): `/prefs`, `/favorites`, `/feed-token` und `/unsubscribe`
 * suchen über `pref_token`. Ohne Index liest jeder Aufruf alle aktiven Abonnenten (2·N Zeilen).
 * Die Zeilenzahl selbst misst Miniflare (PR-Beschreibung); hier steht fest, dass der Planer den Index nimmt.
 *
 * Aufruf: `npx tsx tools/worker-pref-token-index.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const ABFRAGEN = [
  "SELECT favorites, email, franchise_hinweis FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  "UPDATE subscribers SET favorites = ?1 WHERE pref_token = ?2 AND status = 'active'",
  "SELECT feed_token FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
]

function plan(db: DatabaseSync, sql: string): string {
  return (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[]).map((z) => z.detail).join(' | ')
}

function neueDatenbank(mitIndex: boolean): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  // Nur die Spalten und der Statusindex, die die Abfragen berühren (schema.sql allein kennt die späteren Spalten nicht).
  db.exec(`CREATE TABLE subscribers (id INTEGER PRIMARY KEY, email TEXT, status TEXT, frequency TEXT, favorites TEXT,
    franchise_hinweis INTEGER, pref_token TEXT NOT NULL DEFAULT '', feed_token TEXT);
    CREATE INDEX idx_subscribers_status ON subscribers (status, frequency);`)
  if (mitIndex) db.exec(readFileSync('worker/migrations/057-pref-token-index.sql', 'utf8'))
  return db
}

for (const sql of ABFRAGEN) {
  const kurz = sql.slice(0, 40)
  pruefe(/idx_subscribers_pref/.test(plan(neueDatenbank(true), sql)), `mit Migration 057 nimmt der Planer den Index (${kurz}…)`)
  pruefe(!/idx_subscribers_pref/.test(plan(neueDatenbank(false), sql)), `ohne Migration: Durchlauf über den Statusindex, der Test unterscheidet (${kurz}…)`)
}
pruefe(readFileSync('worker/migrations/057-pref-token-index.sql', 'utf8').includes('CREATE INDEX IF NOT EXISTS idx_subscribers_pref ON subscribers (pref_token)'), 'Migration ist wiederholbar (IF NOT EXISTS) und nicht UNIQUE')

if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
