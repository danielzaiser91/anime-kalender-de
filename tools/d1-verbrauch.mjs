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
 * **bevor** es eng wird (Schwellen und Bewertung: `d1-verbrauch-bewertung.mjs`):
 *
 *   - Gesamtverbrauch über `GRENZE_GESAMT` (2,5 Mio. = die Hälfte des Kontingents), oder
 *   - eine einzelne Abfrage über `GRENZE_EINZELN` (1 Mio. = ein Fünftel), oder
 *   - geschriebene Zeilen über `GRENZE_GESCHRIEBEN` (80.000 von 100.000; ab 50.000 nur eine Warnzeile)
 *
 * Dann endet der Lauf mit Exit 1 — in der Statusanzeige steht er rot mit dem Befund, und im
 * Protokoll stehen die fünf größten Leser mit ihren Zahlen.
 *
 * **Messfenster (14.10.2026): der UTC-Tag bis jetzt**, denn das Kontingent und unser Deckel zählen je
 * UTC-Tag; `--zeitraum 1d` (oder `12h` …) bleibt als gleitendes Fenster. **Summiert werden alle
 * Abfragegruppen** (bis `ABFRAGEN_LIMIT`), nicht nur die größten.
 *
 * **Nicht in den Insights:** Migrations-DDL (`CREATE INDEX` …) und `d1 execute --file`. Der Lauf nennt
 * dazu die gleitenden 24 h aus `d1 info` (enthält beides) und rechnet mit `--ddl <Zeilen>` die
 * Schreibzeilen der heute eingespielten Migrationen dazu.
 *
 * **Ohne `CLOUDFLARE_API_TOKEN` passiert nichts** (Exit 0 mit Hinweis): Ein fehlendes Secret darf
 * keinen roten Lauf erzeugen — dieselbe Regel wie beim Melder.
 *
 * Aufruf: `node tools/d1-verbrauch.mjs [--zeitraum 1d] [--ddl 38747] [--lokal]`
 */
import { execSync } from 'node:child_process'
import {
  ABFRAGEN_LIMIT,
  DDL_LUECKE_GEMESSEN,
  KONTINGENT_GELESEN,
  KONTINGENT_GESCHRIEBEN,
  PUFFER_MINUTEN,
  bewerte,
  utcTagMinuten,
} from './d1-verbrauch-bewertung.mjs'

const args = process.argv.slice(2)
const wert = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const jetzt = new Date()
const zeitraum = wert('--zeitraum') ?? `${utcTagMinuten(jetzt)}m`
/* Die erste Zeile bleibt „D1-Verbrauch der letzten …“: `d1-verbrauch.yml` sucht sie für die Statusmeldung. */
const fensterText = wert('--zeitraum')
  ? `letzten ${zeitraum}`
  : `letzten ${Math.floor((utcTagMinuten(jetzt) - PUFFER_MINUTEN) / 60)} h (UTC-Tag ${jetzt.toISOString().slice(0, 10)} seit 00:00 UTC)`
const ddl = Number(wert('--ddl') ?? 0) || 0
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

const wrangler = (befehl) =>
  execSync(`npx wrangler d1 ${befehl} anime-kalender --config wrangler.toml`, {
    cwd: 'worker',
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function leseInsights(sortierung) {
  let roh
  try {
    roh = wrangler(`insights --sort-by ${sortierung} --limit ${ABFRAGEN_LIMIT} --time-period ${zeitraum}`)
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

/** Gleitende 24 h samt DDL; ein Token ohne D1-Recht (nur Analytics) kann das nicht lesen — dann `null`. */
function leseInfo() {
  try {
    const roh = wrangler('info --json')
    const info = JSON.parse(roh.slice(roh.indexOf('{')))
    return { gelesen24h: info.rows_read_24h, geschrieben24h: info.rows_written_24h }
  } catch {
    return null
  }
}

const zeilen = leseInsights('reads')

const summe = zeilen.reduce((a, q) => a + (q.totalRowsRead ?? 0), 0)
const groesste = [...zeilen].sort((a, b) => (b.totalRowsRead ?? 0) - (a.totalRowsRead ?? 0))
const kurz = (q) => String(q.query ?? '').replace(/\s+/g, ' ').slice(0, 96)
const de = (n) => n.toLocaleString('de-DE')

console.log(`D1-Verbrauch der ${fensterText}: ${de(summe)} gelesene Zeilen`)
console.log(`Kontingent der freien Stufe: ${de(KONTINGENT_GELESEN)} am Tag — das sind ${((summe / KONTINGENT_GELESEN) * 100).toFixed(1)} %`)
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
  140.000 Zeilen (Folgenmeldungen), und die Wache sah nur Gelesenes. Je Anfrage der Meldungs-Route
  gemessen (13.10.2026): 48 geschriebene Zeilen, 11 je Netflix-/Disney+-Folge, 5 je Prime-Rohfolge.
*/
const schreiber = leseInsights('writes')
const geschrieben = schreiber.reduce((a, q) => a + (q.totalRowsWritten ?? 0), 0)
console.log('')
console.log(`Geschriebene Zeilen der ${fensterText}: ${de(geschrieben)}`)
console.log(`Schreib-Kontingent der freien Stufe: ${de(KONTINGENT_GESCHRIEBEN)} am Tag — das sind ${((geschrieben / KONTINGENT_GESCHRIEBEN) * 100).toFixed(1)} %`)
console.log('Die drei größten Schreiber:')
for (const q of schreiber.slice(0, 3)) {
  console.log(
    `  ${String(q.totalRowsWritten ?? 0).padStart(10)}  ${String(q.numberOfTimesRun ?? 0).padStart(6)}×  ` +
      `Ø ${String(q.avgRowsWritten ?? 0).padStart(6)}  ${kurz(q)}`,
  )
}
if (Math.max(zeilen.length, schreiber.length) >= ABFRAGEN_LIMIT) {
  console.log(`::warning::D1-Verbrauch: ${ABFRAGEN_LIMIT} Abfragegruppen geholt, die Summen sind eine untere Schranke.`)
}

const info = leseInfo()
console.log('')
console.log(
  `Nicht in den Insights: Migrations-DDL und \`d1 execute --file\` (13.10.2026: ${de(DDL_LUECKE_GEMESSEN)} Schreibzeilen an einem Tag mit drei Migrationen).` +
    (ddl ? ` Eingerechnet: ${de(ddl)} (--ddl).` : ' Heute eingespielte Migrationen mit `--ddl <Zeilen>` angeben.'),
)
if (info) {
  console.log(`d1 info, gleitende 24 h (mit DDL, reicht in den Vortag): ${de(info.gelesen24h)} gelesen, ${de(info.geschrieben24h)} geschrieben.`)
} else {
  console.log('d1 info nicht lesbar (Token ohne D1-Recht?) — die Lücke bleibt ungemessen.')
}

const { befunde, warnungen } = bewerte({ gelesen: summe, geschrieben, ddl, groesste, info })
for (const w of warnungen) console.log(`::warning::D1-Verbrauch: ${w}`)

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
