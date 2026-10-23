#!/usr/bin/env node
/**
 * **Kapazitätsmessung der letzten 7 UTC-Tage** (23.10.2026, Plan `skalierung-100-bis-100k.md`, B1):
 * Worker-Anfragen (Konto und je Skript), Fehler und `exceededCpu`, CPU p50/p99 (Cron getrennt von allen
 * Aufrufen), D1 gelesen und geschrieben — aus der GraphQL-Analytics-API, mit dem Token von
 * `d1-verbrauch.yml` (`Account Analytics: Read`). Schwellen: `kapazitaet-bewertung.mjs`.
 *
 * **Annahmen, beim ersten CI-Lauf gegen das Dashboard zu prüfen:** `cpuTimeP50/P99` in Mikrosekunden;
 * Cron aus `workersInvocationsScheduled`, alle Aufrufe aus `workersInvocationsAdaptive`; HTTP allein gibt
 * es nicht getrennt. Je Gruppe (Skript, Status, Cron) gilt der größte Quantil-Wert. Ein Datensatz, der
 * nicht lesbar ist, wird als Warnzeile genannt (kein roter Lauf, kein stilles Schweigen).
 *
 * Ohne `CLOUDFLARE_API_TOKEN` oder `CLOUDFLARE_ACCOUNT_ID` passiert nichts (Exit 0 mit Hinweis).
 * Aufruf: `node tools/kapazitaet-messen.mjs [--tage 7]`
 */
import { pathToFileURL } from 'node:url'
import { bewerteKapazitaet } from './kapazitaet-bewertung.mjs'

const ENDPUNKT = 'https://api.cloudflare.com/client/v4/graphql'
const TAG_MS = 86_400_000

const KOPF = 'query($konto:String!,$von:Time!,$bis:Time!,$tag:Date!){viewer{accounts(filter:{accountTag:$konto}){'
const ENDE = '}}}'
const AUFRUFE = (satz) => `(limit:1000,filter:{datetime_geq:$von,datetime_lt:$bis}){dimensions{${satz}} sum{requests errors} quantiles{cpuTimeP50 cpuTimeP99}}`
export const ABFRAGEN = {
  alle: `${KOPF}workersInvocationsAdaptive${AUFRUFE('scriptName status')}${ENDE}`,
  cron: `${KOPF}workersInvocationsScheduled${AUFRUFE('scriptName cron status')}${ENDE}`,
  d1: `${KOPF}d1AnalyticsAdaptiveGroups(limit:100,filter:{date_geq:$tag,date_leq:$tag}){dimensions{databaseId} sum{rowsRead rowsWritten}}${ENDE}`,
}

/** Eine GraphQL-Abfrage; gibt die Zeilen des einen Datensatzes zurück, wirft bei Fehlern der API. */
async function frage(holen, token, abfrage, variablen) {
  const res = await holen(ENDPUNKT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: abfrage, variables: variablen }),
  })
  const antwort = await res.json()
  if (!res.ok || antwort.errors?.length) throw new Error(antwort.errors?.[0]?.message ?? `HTTP ${res.status}`)
  const konto = antwort.data?.viewer?.accounts?.[0] ?? {}
  return Object.values(konto)[0] ?? []
}

const summe = (zeilen, feld) => zeilen.reduce((a, z) => a + (z.sum?.[feld] ?? 0), 0)
const groesster = (zeilen, feld) => (zeilen.length ? Math.max(...zeilen.map((z) => (z.quantiles?.[feld] ?? 0) / 1000)) : null)

/** Aus den Rohzeilen eines Tages die Kennzahlen; `null` heißt: nicht gemessen. */
export function tagesWerte(datum, { alle, cron, d1 }) {
  const jeSkript = {}
  for (const z of alle ?? []) {
    const name = z.dimensions?.scriptName ?? '?'
    jeSkript[name] = (jeSkript[name] ?? 0) + (z.sum?.requests ?? 0)
  }
  return {
    datum,
    anfragen: alle ? summe(alle, 'requests') : null,
    jeSkript,
    fehler: alle ? summe(alle, 'errors') : null,
    ueberCpu: alle ? summe(alle.filter((z) => z.dimensions?.status === 'exceededCpu'), 'requests') : null,
    cpuP50Ms: groesster(alle ?? [], 'cpuTimeP50'),
    cpuP99Ms: groesster(alle ?? [], 'cpuTimeP99'),
    cronP50Ms: cron ? groesster(cron, 'cpuTimeP50') : null,
    cronP99Ms: cron ? groesster(cron, 'cpuTimeP99') : null,
    gelesen: d1 ? summe(d1, 'rowsRead') : null,
    geschrieben: d1 ? summe(d1, 'rowsWritten') : null,
  }
}

/** Misst die letzten `tage` UTC-Tage bis einschließlich dem von `jetzt`; Rückgabe: `{ tage, nichtLesbar }`. */
export async function messe({ token, konto, jetzt, tage = 7, holen = fetch }) {
  const heute = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate())
  const ergebnis = []
  const nichtLesbar = []
  for (let i = tage - 1; i >= 0; i--) {
    const start = heute - i * TAG_MS
    const datum = new Date(start).toISOString().slice(0, 10)
    const variablen = { konto, von: new Date(start).toISOString(), bis: new Date(start + TAG_MS).toISOString(), tag: datum }
    const roh = {}
    for (const [name, abfrage] of Object.entries(ABFRAGEN)) {
      try {
        roh[name] = await frage(holen, token, abfrage, variablen)
      } catch (e) {
        roh[name] = null
        const meldung = `${name}: ${String(e.message).slice(0, 160)}`
        if (!nichtLesbar.includes(meldung)) nichtLesbar.push(meldung)
      }
    }
    ergebnis.push(tagesWerte(datum, roh))
  }
  return { tage: ergebnis, nichtLesbar }
}

const de = (n) => (n == null ? 'n/a' : n.toLocaleString('de-DE', { maximumFractionDigits: 1 }))

/** Die Protokollzeilen eines Messergebnisses (je Tag eine, dazu die Skripte des letzten Tages). */
export function berichtZeilen({ tage, nichtLesbar }) {
  const zeilen = ['Kapazität der letzten Tage (UTC, Tag = 00:00–24:00):']
  for (const t of tage) {
    zeilen.push(
      `  ${t.datum}  Anfragen ${de(t.anfragen)}  Fehler ${de(t.fehler)}  exceededCpu ${de(t.ueberCpu)}  ` +
        `CPU p50/p99 ${de(t.cpuP50Ms)}/${de(t.cpuP99Ms)} ms (Cron ${de(t.cronP50Ms)}/${de(t.cronP99Ms)} ms)  ` +
        `D1 gelesen ${de(t.gelesen)}  geschrieben ${de(t.geschrieben)}`,
    )
  }
  const letzter = tage.at(-1)
  for (const [name, n] of Object.entries(letzter?.jeSkript ?? {})) zeilen.push(`  Skript ${name}: ${de(n)} Anfragen am ${letzter.datum}`)
  for (const m of nichtLesbar) zeilen.push(`::warning::Kapazität: Datensatz nicht lesbar (${m})`)
  return zeilen
}

async function main() {
  const args = process.argv.slice(2)
  const tage = Number(args.includes('--tage') ? args[args.indexOf('--tage') + 1] : 7) || 7
  const token = process.env.CLOUDFLARE_API_TOKEN
  const konto = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !konto) {
    console.log('Kein CLOUDFLARE_API_TOKEN oder CLOUDFLARE_ACCOUNT_ID gesetzt — Kapazitätsmessung übersprungen.')
    return 0
  }
  const messung = await messe({ token, konto, jetzt: new Date(), tage })
  for (const z of berichtZeilen(messung)) console.log(z)
  const { befunde, warnungen } = bewerteKapazitaet(messung.tage)
  for (const w of warnungen) console.log(`::warning::${w}`)
  for (const b of befunde) console.log(`::error::${b}`)
  console.log(befunde.length ? 'Kapazität: ÜBER einer Schwelle.' : 'Kapazität: alles im Rahmen.')
  return befunde.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main())
