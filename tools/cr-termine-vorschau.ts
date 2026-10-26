/**
 * Sofort-Vorschau ohne Bau: Stehen die deutschen Crunchyroll-Folgen der letzten 14 Tage
 * (`data/crunchyroll-neu.json`) als Termin im Kalender?
 *
 * Nimmt Releases und Titel aus dem letzten Bau (`public/data/`), rechnet die Widerlegung durch das
 * Wochenprogramm mit dem **aktuellen** Code und den aktuellen Dateien neu und erzeugt die Termine mit
 * `expandEvents`. So zeigt eine Änderung an Widerlegung oder Terminlogik in Sekunden, was der Bau
 * ausgeben wird, statt erst nach Merge, Bau und Deploy (25.10.2026). Änderungen an `data/curated/`
 * sieht sie nicht — die brauchen den Bau. Rechnet ohne `loeseGeteilteWegeVonWiderlegten`; ein Treffer
 * zählt reihenweit ±1 Tag.
 *
 * Aufruf: `npx tsx tools/cr-termine-vorschau.ts [--wie-gebaut] [--streng]`
 *   --wie-gebaut  Widerlegung aus dem Bau übernehmen statt neu rechnen (Vergleich vorher/nachher)
 *   --streng      Exit 1, sobald eine Folge fehlt
 *   --stand <ISO> "Jetzt" des 14-Tage-Fensters (Standard: die Uhr; für Messungen an alten Bau-Ständen und Tests)
 */
import { readFileSync } from 'node:fs'
import { expandEvents } from '../shared/logic.ts'
import { toIsoDate } from '../shared/time.ts'
import type { Release, Title } from '../shared/types.ts'
import { readJson } from '../pipeline/lib/util.ts'
import { widerlegungAusDateien } from '../pipeline/bau/widerlegung-woche.ts'

type KatalogFolge = { serieId?: string; serie?: string; staffel?: string; nummer?: number; verfuegbarAb?: string }

const lies = <T>(datei: string): T => JSON.parse(readFileSync(datei, 'utf8')) as T
const alsListe = <T>(wert: unknown): T[] => (Array.isArray(wert) ? wert : (Object.values(wert as object).find(Array.isArray) ?? [])) as T[]

function widerlegungNeuRechnen(releases: Release[], titles: Map<number, Title>): void {
  for (const r of releases) if (r.platform === 'crunchyroll') delete r.widerlegt
  const { gedaechtnis } = widerlegungAusDateien(releases, titles, readJson)
  for (const r of releases) if (gedaechtnis[r.slug]) r.widerlegt = gedaechtnis[r.slug]
}

/** Titel derselben Reihe wie der Titel, dessen Crunchyroll-Weg die Serienkennung trägt. */
function reihenTitel(titel: Title[], serieId: string): Set<number> {
  const direkt = titel.filter((t) => t.streams.some((s) => s.platform === 'crunchyroll' && s.url?.includes(serieId)))
  const reihen = new Set(direkt.map((t) => t.franchiseId ?? t.id))
  return new Set(titel.filter((t) => reihen.has(t.franchiseId ?? t.id)).map((t) => t.id))
}

function main(): void {
  const args = process.argv.slice(2)
  const titel = alsListe<Title>(lies('public/data/titles.json'))
  const releases = alsListe<Release>(lies('public/data/releases.json'))
  if (!args.includes('--wie-gebaut')) widerlegungNeuRechnen(releases, new Map(titel.map((t) => [t.id, t])))
  const termine = releases.filter((r) => r.platform === 'crunchyroll').flatMap((r) => expandEvents(r))
  const stand = args.indexOf('--stand')
  const jetzt = stand >= 0 ? Date.parse(args[stand + 1]) : Date.now()
  const grenze = toIsoDate(new Date(jetzt - 14 * 864e5))
  let fehlt = 0
  for (const f of lies<{ folgen?: KatalogFolge[] }>('data/crunchyroll-neu.json').folgen ?? []) {
    if (!f.serieId || !f.verfuegbarAb) continue
    const tag = toIsoDate(new Date(f.verfuegbarAb))
    if (tag < grenze) continue
    const ids = reihenTitel(titel, f.serieId)
    const treffer = termine.some((e) => ids.has(e.titleId) && Math.abs(Date.parse(e.date) - Date.parse(tag)) <= 864e5)
    if (!treffer) fehlt++
    console.log(treffer ? 'ok   ' : 'FEHLT', tag, f.serie, '|', f.staffel, `#${f.nummer}`)
  }
  console.log(`${fehlt} deutsche Folge(n) ohne Termin`)
  if (fehlt && args.includes('--streng')) process.exitCode = 1
}

main()
