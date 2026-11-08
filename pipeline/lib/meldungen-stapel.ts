/**
 * Der Stapel offener Meldungen für `fetch-pruefungen.ts`, wahlweise gesichert oder nachgespielt (18.10.2026).
 *
 * Wird die Prüfung neuer Handbelege rot, grenzt `tools/meldungen-eingrenzen.mjs` die auslösenden Meldungen ein und spielt dazu
 * denselben Stapel mehrmals nach, jedes Mal ohne einen Teil davon. Der Briefkasten wird dabei nur einmal gelesen:
 * `MELDUNGEN_SICHERN=<datei>` legt seine Antwort ab, `MELDUNGEN_ANTWORT=<datei>` liest sie statt des Briefkastens,
 * `MELDUNGEN_OHNE=<datei>` (JSON-Liste von Kennungen) lässt diese Meldungen weg — sie bleiben offen und werden nicht abgehakt.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { istFremd, ladeFremdeMeldungen, type FremdeMeldung } from './netflix-fremde-meldung.ts'
import { log, ROOT } from './util.ts'

type Meldung = { id: number; url: string; plattform: string; folge?: string | null }

/**
 * Die Netflix-Sperrliste gilt auch für Prüfungen (06.11.2026). Ihre Zeilen tragen die Folgenkennung im Feld `folge`
 * (Sicht `pruefung_titel`), die Staffelkennung kennt die Prüfung nicht: gesperrt wird über die `gti`-Liste des Eintrags.
 * Gesperrte Zeilen kommen weder in die Zuordnung noch in die Auffälligkeitsliste; sie werden abgehakt.
 */
export function ohneGesperrtePruefungen<T extends Meldung>(
  pruefungen: T[],
  sperre: FremdeMeldung[],
): { pruefungen: T[]; gesperrt: number[]; jeAdresse: Map<string, number> } {
  const gesperrt = pruefungen.filter((p) => p.plattform === 'netflix' && istFremd({ id: p.id, url: p.url, gti: p.folge }, sperre))
  const jeAdresse = new Map<string, number>()
  for (const p of gesperrt) jeAdresse.set(p.url, (jeAdresse.get(p.url) ?? 0) + 1)
  const weg = new Set(gesperrt.map((p) => p.id))
  return { pruefungen: weg.size ? pruefungen.filter((p) => !weg.has(p.id)) : pruefungen, gesperrt: [...weg], jeAdresse }
}

/** Wie `ohneGesperrtePruefungen` mit der echten Sperrliste; benennt, was verworfen wurde (Ergebniszeile im Log). */
export function sperreAufPruefungen<T extends Meldung>(pruefungen: T[], sperre: FremdeMeldung[] = ladeFremdeMeldungen()) {
  const r = ohneGesperrtePruefungen(pruefungen, sperre)
  const nennung = [...r.jeAdresse].map(([url, n]) => `${url.replace('https://www.netflix.com/title/', 'netflix/')}: ${n}`).join(', ')
  log(`Sperrliste (netflix-fremde-meldungen.json): ${r.gesperrt.length} von ${pruefungen.length} Prüfungen verworfen und abgehakt${nennung ? ` (${nennung})` : ''}`)
  return r
}

export async function ladeMeldungen(adresse: string, token: string): Promise<Response> {
  const nachspiel = process.env.MELDUNGEN_ANTWORT
  const antwort = nachspiel ? new Response(readFileSync(nachspiel, 'utf8')) : await fetch(adresse, { headers: { Authorization: `Bearer ${token}` } })
  const sichern = process.env.MELDUNGEN_SICHERN
  const ohneDatei = process.env.MELDUNGEN_OHNE
  if (!antwort.ok) return antwort
  const text = await antwort.text()
  if (sichern) writeFileSync(sichern, text)
  if (!ohneDatei) return new Response(text)
  const ohne = new Set(JSON.parse(readFileSync(ohneDatei, 'utf8')) as number[])
  const { pruefungen } = JSON.parse(text) as { pruefungen: { id: number }[] }
  return new Response(JSON.stringify({ pruefungen: pruefungen.filter((p) => !ohne.has(p.id)) }))
}

/** Stempel der jüngsten Übernahme; geht mit dem Commit des Bestandslaufs ins Repo. */
export const UEBERNAHME_DATEI = 'data/meldungen-uebernahme.json'

/**
 * Kennungen fürs Abhaken nach dem Commit ablegen und die Übernahme stempeln (18.10.2026): Vom 11. bis 18.10. kam keine Meldung
 * an, ohne dass ein Lauf rot wurde. Nimmt die Handbeleg-Prüfung die Meldungen zurück, setzt sie den Stempel mit zurück;
 * `tools/briefkasten-wache.mjs` meldet einen Stau, wenn er älter als 24 Stunden ist und zuzuordnende Meldungen warten.
 */
export function legeAbhakenAb(datei: string, ids: Set<number>): void {
  mkdirSync(dirname(datei), { recursive: true })
  writeFileSync(datei, JSON.stringify([...ids]))
  writeFileSync(resolve(ROOT, UEBERNAHME_DATEI), JSON.stringify({ zuletzt: new Date().toISOString(), meldungen: ids.size }, null, 2) + '\n')
}
