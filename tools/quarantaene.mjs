#!/usr/bin/env node
/**
 * Titel-Quarantäne im Bestandsbau (18.10.2026): Ein roter Befund an einzelnen Titeln stellt genau diese Titel zurück, statt den
 * ganzen Datensatz zu sperren. Zeilen-Prüfungen drucken je betroffenem Titel eine Marke (`pipeline/lib/quarantaene.ts`, `melde`);
 * `tools/commit-data.sh` sammelt sie hier, baut ohne diese Titel neu (`BAU_QUARANTAENE`) und prüft erneut. Committet wird nur bei Grün.
 *
 * Gesperrt bleibt wie bisher, wenn die Fehler keine neue Kennung tragen (Struktur, `check:logic`, Prüfung ohne Marke), wenn eine
 * Kennung kein Anime ist (Cartoons haben negative Kennungen und eine eigene Datei) oder mehr als `OBERGRENZE` Titel betroffen wären.
 *
 * Aufruf (nur `tools/commit-data.sh`):
 *   node tools/quarantaene.mjs sammeln <prüfprotokoll> <liste.json>   Exit 0: Liste um die neuen Marken ergänzt; Exit 1: sperren (Grund auf stdout)
 *   node tools/quarantaene.mjs text <meta.json>                       Exit 0: eine Zeile für DATEN_WARNUNG; Exit 1: nichts zurückgestellt
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MARKE = 'QUARANTAENE '
/** Mehr betroffene Titel sind eher ein Fehler im Bau als in den Daten einzelner Titel. */
export const OBERGRENZE = 3

/** Die Zeile, die eine Prüfung je betroffenem Titel druckt. */
export function markenZeile(titleId, pruefung, grund) {
  return MARKE + JSON.stringify({ titleId, pruefung, grund })
}

/** Alle gültigen Marken eines Prüfprotokolls; eine unlesbare Marke zählt nicht (dann fehlt die Kennung, und es bleibt bei der Sperre). */
export function liesMarken(text) {
  const marken = []
  for (const zeile of text.split('\n')) {
    const rest = zeile.trimStart()
    if (!rest.startsWith(MARKE)) continue
    try {
      const m = JSON.parse(rest.slice(MARKE.length))
      if (Number.isInteger(m.titleId)) marken.push({ titleId: m.titleId, pruefung: String(m.pruefung), grund: String(m.grund) })
    } catch {
      continue
    }
  }
  return marken
}

/** Neue Liste aus der bisherigen und den Marken dieses Prüflaufs — oder der Grund, warum gesperrt bleibt. */
export function entscheide(alt, marken) {
  const liste = [...alt]
  for (const m of marken) if (!liste.some((e) => e.titleId === m.titleId)) liste.push(m)
  if (liste.length === alt.length) return { sperre: 'die Fehler tragen keine neue Titel-Kennung' }
  const keinAnime = liste.filter((e) => e.titleId <= 0).map((e) => e.titleId)
  if (keinAnime.length) return { sperre: `zurückgestellt werden nur Anime-Titel, nicht ${keinAnime.join(', ')}` }
  if (liste.length > OBERGRENZE) return { sperre: `${liste.length} Titel betroffen, zurückgestellt werden höchstens ${OBERGRENZE}` }
  return { liste }
}

/** Kurztext für die Statusanzeige: Kennung und Prüfung je Titel. */
export function warnText(liste) {
  return `${liste.length} Titel zurückgestellt: ${liste.map((e) => `${e.titleId} (${e.pruefung})`).join(', ')}`
}

/** Fehlt die Datei, ist nichts zurückgestellt (erster Prüflauf, Bau ohne Quarantäne). */
const liesListe = (pfad) => (existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : [])

export function main(args) {
  const [befehl, a, b] = args
  if (befehl === 'text' && a) {
    const liste = liesListe(a).quarantaene ?? []
    if (!liste.length) return 1
    console.log(warnText(liste))
    return 0
  }
  if (befehl !== 'sammeln' || !a || !b) {
    console.log('Aufruf: node tools/quarantaene.mjs sammeln <prüfprotokoll> <liste.json> | text <meta.json>')
    return 2
  }
  const urteil = entscheide(liesListe(b), liesMarken(readFileSync(a, 'utf8')))
  if (urteil.sperre) {
    console.log(`keine Quarantäne: ${urteil.sperre}`)
    return 1
  }
  writeFileSync(b, JSON.stringify(urteil.liste, null, 2) + '\n')
  console.log(`Quarantäne: ${warnText(urteil.liste)}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
