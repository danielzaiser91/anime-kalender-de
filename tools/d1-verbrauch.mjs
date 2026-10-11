#!/usr/bin/env node
/**
 * **Der Tagesverbrauch der Datenbank — die Frühwarnung** (28.09.2026).
 *
 * Am 28.09.2026 war das Tageskontingent der kostenlosen D1-Stufe (5 Mio. gelesene Zeilen) um
 * 13:30 erschöpft: Zwei Abfragen machten 88 % aus, und **niemand hat es vorher gesehen** —
 * Statusanzeige, Erweiterung und Datenläufe waren bis Mitternacht UTC blind.
 *
 * Diese Prüfung liest dieselbe Quelle, mit der die Ursachen gefunden wurden
 * (`wrangler d1 insights` → `d1QueriesAdaptiveGroups` der GraphQL Analytics API), und wird laut,
 * **bevor** es eng wird:
 *
 *   - Gesamtverbrauch über `GRENZE_GESAMT` (2,5 Mio. = die Hälfte des Kontingents), oder
 *   - eine einzelne Abfrage über `GRENZE_EINZELN` (1 Mio. = ein Fünftel), oder
 *   - geschriebene Zeilen über `GRENZE_GESCHRIEBEN` (50.000 = die Hälfte des Schreib-Kontingents)
 *
 * Dann endet der Lauf mit Exit 1 — in der Statusanzeige steht er rot mit dem Befund, und im
 * Protokoll stehen die fünf größten Leser mit ihren Zahlen.
 *
 * **Ohne `CLOUDFLARE_API_TOKEN` passiert nichts** (Exit 0 mit Hinweis): Ein fehlendes Secret darf
 * keinen roten Lauf erzeugen — dieselbe Regel wie beim Melder.
 *
 * Aufruf: `node tools/d1-verbrauch.mjs [--zeitraum 1d]`
 */
import { execSync } from 'node:child_process'

const GRENZE_GESAMT = 2_500_000
const GRENZE_EINZELN = 1_000_000
/* Die Hälfte des Schreib-Tageskontingents der freien Stufe (100.000 Zeilen); jede Meldung kostet rund 14. */
const GRENZE_GESCHRIEBEN = 50_000

const args = process.argv.slice(2)
const zeitraum = args.includes('--zeitraum') ? (args[args.indexOf('--zeitraum') + 1] ?? '1d') : '1d'
/*
  **`--lokal` nutzt die angemeldete `wrangler`-Sitzung** statt eines Tokens. Für die Probe am
  eigenen Rechner: In Actions gibt es die Sitzung nicht, dort trägt der Secret-Token die Anmeldung.
*/
const lokal = args.includes('--lokal')

if (!lokal && !process.env.CLOUDFLARE_API_TOKEN) {
  console.log('Kein CLOUDFLARE_API_TOKEN gesetzt — Verbrauchsprüfung übersprungen.')
  console.log('Anleitung: https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/')
  process.exit(0)
}

function leseInsights(sortierung, limit = 5) {
  let roh
  try {
    roh = execSync(
      `npx wrangler d1 insights anime-kalender --config wrangler.toml --sort-by ${sortierung} --limit ${limit} --time-period ${zeitraum}`,
      { cwd: 'worker', encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (err) {
    console.error('`wrangler d1 insights` ist fehlgeschlagen:', String(err.stdout ?? err.message).slice(0, 400))
    process.exit(1)
  }
  try {
    return JSON.parse(roh.slice(roh.indexOf('[')))
  } catch (err) {
    console.error('Antwort nicht lesbar:', roh.slice(0, 400))
    process.exit(1)
  }
}

const zeilen = leseInsights('reads')

const summe = zeilen.reduce((a, q) => a + (q.totalRowsRead ?? 0), 0)
const groesste = [...zeilen].sort((a, b) => (b.totalRowsRead ?? 0) - (a.totalRowsRead ?? 0))
const kurz = (q) => String(q.query ?? '').replace(/\s+/g, ' ').slice(0, 96)

console.log(`D1-Verbrauch der letzten ${zeitraum}: ${summe.toLocaleString('de-DE')} gelesene Zeilen`)
console.log(`Kontingent der freien Stufe: 5.000.000 am Tag — das sind ${((summe / 5_000_000) * 100).toFixed(1)} %`)
console.log('')
console.log('Die fünf größten Leser:')
for (const q of groesste.slice(0, 5)) {
  console.log(
    `  ${String(q.totalRowsRead ?? 0).padStart(10)}  ${String(q.numberOfTimesRun ?? 0).padStart(6)}×  ` +
      `Ø ${String(q.avgRowsRead ?? 0).padStart(6)}  ${kurz(q)}`,
  )
}

/*
  **Geschriebene Zeilen (11.10.2026):** Ein Massenlauf schrieb am 11.10.2026 in 35 Minuten
  140.000 Zeilen (Folgenmeldungen), und die Wache sah nur Gelesenes. Summiert werden die 30
  größten Schreiber; die Summe ist eine untere Schranke, reicht aber, weil zwei Abfragen den Großteil tragen.
*/
const schreiber = leseInsights('writes', 30)
const geschrieben = schreiber.reduce((a, q) => a + (q.totalRowsWritten ?? 0), 0)
console.log('')
console.log(`Geschriebene Zeilen der letzten ${zeitraum}: ${geschrieben.toLocaleString('de-DE')}`)
console.log(`Schreib-Kontingent der freien Stufe: 100.000 am Tag — das sind ${((geschrieben / 100_000) * 100).toFixed(1)} %`)
console.log('Die drei größten Schreiber:')
for (const q of schreiber.slice(0, 3)) {
  console.log(
    `  ${String(q.totalRowsWritten ?? 0).padStart(10)}  ${String(q.numberOfTimesRun ?? 0).padStart(6)}×  ` +
      `Ø ${String(q.avgRowsWritten ?? 0).padStart(6)}  ${kurz(q)}`,
  )
}

const befunde = []
if (geschrieben > GRENZE_GESCHRIEBEN) {
  befunde.push(
    `${geschrieben.toLocaleString('de-DE')} geschriebene Zeilen über der Grenze ` +
      `${GRENZE_GESCHRIEBEN.toLocaleString('de-DE')} (halbes Schreib-Kontingent der freien Stufe)`,
  )
}
if (summe > GRENZE_GESAMT) {
  befunde.push(
    `Gesamtverbrauch ${summe.toLocaleString('de-DE')} über der Grenze ${GRENZE_GESAMT.toLocaleString('de-DE')} ` +
      `(halbes Tageskontingent)`,
  )
}
for (const q of groesste) {
  if ((q.totalRowsRead ?? 0) > GRENZE_EINZELN) {
    befunde.push(`eine Abfrage liest ${q.totalRowsRead.toLocaleString('de-DE')} Zeilen: ${kurz(q)}`)
  }
}

if (befunde.length) {
  console.log('')
  for (const b of befunde) console.log(`::error::D1-Verbrauch: ${b}`)
  console.log(
    '\nNachsehen mit: `wrangler d1 insights anime-kalender --sort-by reads`\n' +
      'Der Plan einer Abfrage verrät den Grund: `EXPLAIN QUERY PLAN <Abfrage>` — greift ein Index?',
  )
  process.exit(1)
}

console.log('\nAlles im Rahmen.')
