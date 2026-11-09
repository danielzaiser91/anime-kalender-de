/**
 * Der Routerschritt im Claude-Lauf (`pipeline/anime2you-router.ts`): liest `auswahl.json` und `artikel/<id>.txt` des Arbeitsordners, entscheidet je Artikel
 * (`anime2you-router.ts`) und schreibt immer `router.json` (Protokoll). Nur wenn `scharf`, übernimmt er den Plan:
 * - die Regel-Artikel bekommen ihre Antwortdatei `ergebnis/<id>.json` (Form wie Claudes Antwort, damit `--uebernehmen` sie gleich prüft),
 * - `auswahl.json` führt sie unter `regel` statt unter `kandidaten`, und Claude sieht nur noch den Rest und die Stichprobe.
 * `auswahl.json` wird zuletzt geschrieben; scheitert etwas davor, werden die neuen Antwortdateien wieder gelöscht und Claude liest alles wie ohne Router.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Kandidat } from './anime2you-artikel.ts'
import { plane, zeileVon, type Plan, type RouterZeile } from './anime2you-router.ts'

interface AuswahlDatei {
  kandidaten: Kandidat[]
  regel?: Kandidat[]
  uebersprungen: unknown[]
}

export interface RouterErgebnis {
  zeile: RouterZeile
  /** Wie viele Artikel Claude nach dem Router noch liest. */
  claude: number
}

const lies = (pfad: string): string => readFileSync(pfad, 'utf8')

/** Schreibt Antwortdateien und `auswahl.json` für den Plan; bei einem Fehler räumt es seine Antwortdateien weg und wirft weiter. */
function wendeAn(ordner: string, auswahl: AuswahlDatei, plan: Plan): void {
  const geschrieben: string[] = []
  try {
    for (const e of plan.entscheidungen.filter((x) => plan.erspart.includes(x.id))) {
      const pfad = resolve(ordner, 'ergebnis', `${e.id}.json`)
      writeFileSync(pfad, JSON.stringify({ gelesen: true, vorschlaege: e.vorschlaege }, null, 2), 'utf8')
      geschrieben.push(pfad)
    }
    const erspart = new Set(plan.erspart)
    const neu: AuswahlDatei = { ...auswahl, kandidaten: auswahl.kandidaten.filter((k) => !erspart.has(k.id)), regel: auswahl.kandidaten.filter((k) => erspart.has(k.id)) }
    writeFileSync(resolve(ordner, 'auswahl.json'), JSON.stringify(neu, null, 2), 'utf8')
  } catch (err) {
    for (const pfad of geschrieben) rmSync(pfad, { force: true })
    throw err
  }
}

export function routerSchritt(ordner: string, scharf: boolean): RouterErgebnis {
  const auswahl = JSON.parse(lies(resolve(ordner, 'auswahl.json'))) as AuswahlDatei
  const artikel = auswahl.kandidaten.map((k) => ({ id: k.id, text: lies(resolve(ordner, 'artikel', `${k.id}.txt`)), rubriken: k.rubriken ?? [] }))
  const plan = plane(artikel)
  const zeile = zeileVon(plan, scharf)
  const protokoll = plan.entscheidungen.map((e) => ({ id: e.id, weg: e.weg, ...(e.grund ? { grund: e.grund } : {}) }))
  writeFileSync(resolve(ordner, 'router.json'), JSON.stringify({ zeile, entscheidungen: protokoll }, null, 2), 'utf8')
  if (scharf) wendeAn(ordner, auswahl, plan)
  return { zeile, claude: scharf ? artikel.length - plan.erspart.length : artikel.length }
}

/** Die Zeile aus `router.json`, falls der Routerschritt gelaufen ist; sonst `undefined`. */
export function leseRouterZeile(ordner: string): RouterZeile | undefined {
  try {
    return (JSON.parse(lies(resolve(ordner, 'router.json'))) as { zeile?: RouterZeile }).zeile
  } catch {
    return undefined
  }
}
