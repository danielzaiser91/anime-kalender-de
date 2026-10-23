/**
 * **Ein Stapel in die Titelzeile: je Titel einmal lesen, einmal schreiben** (14.10.2026).
 *
 * Die Netflix-Randprobe schickt bis zu zehn Folgen desselben Titels in einem Stapel (`extension/melder.js`, `MELDE_STAPEL`).
 * Einzeln und gleichzeitig gespeichert, läsen alle dieselbe Version der Titelzeile; jede Runde gewinnt eine, die übrigen
 * lesen neu — nach `VERSUCHE` Runden bekämen die letzten 503, und die Wiederholungen kosteten mehr D1-Abfragen, als ein
 * Aufruf darf (50, siehe `pruefung-stapel.ts`). Gebündelt setzt der Worker alle Folgen eines Titels nacheinander ein und
 * schreibt die Zeile einmal.
 *
 * Welche Meldungen hierher gehören, entscheidet dieselbe Regel wie einzeln (`titelzeile-speichern.ts`). Eine Gruppe ohne
 * Titelzeile, in der eine Meldung nicht ins Format passt, geht ganz den bisherigen Weg: Sonst verdrängte die neue
 * Titelzeile die Altzeilen dieser einen Meldung aus den Lesern.
 */
import { type Env } from './env.ts'
import { leiteAb, type Abgeleitet } from './pruefung-ableiten.ts'
import { ablehnungLoggen, ausnahmeAls, type Ablehnung } from './pruefung-ablehnung.ts'
import { ANFRAGEN_BUDGET, type StapelErgebnis } from './pruefung-stapel.ts'
import { zaehlendeDb } from './tagesdeckel.ts'
import { holeListenbauAm } from './pruefung-unveraendert.ts'
import { eintragOderFehler, gehoertHierher, hatAltzeilen, setze } from './titelzeile-speichern.ts'
import { aendereTitelzeile, ladeZeile } from './titelzeile-zeile.ts'
import { kopfAusMeldung, leereDaten, type Eintrag, type TitelDaten } from './titelzeile-format.ts'

type Glied = { i: number; daten: Record<string, unknown>; ab: Abgeleitet }
type Gruppe = { url: string; plattform: string; glieder: Glied[] }

const BUDGET_GRUND = 'Subrequest-Budget des Stapels überschritten'

class BudgetErreicht extends Error {}

/**
 * Ergebnis je Stapel-Index für die Meldungen, die in einer Titelzeile stehen; die übrigen gehen den bisherigen Weg.
 * Die D1-Abfragen zählen zum Budget des Stapels (`ANFRAGEN_BUDGET`, 21.10.2026): `abfragen` ist, was verbraucht ist, der
 * Rest des Budgets gehört den übrigen Meldungen. Reißt eine Gruppe das Budget (Wiederholungen nach Zusammenstößen), bekommt
 * sie 503 und wird neu geschickt; die folgenden Gruppen scheitern an ihrer ersten Abfrage ebenso.
 */
export async function titelzeilenImStapel(env: Env, stapel: unknown[]): Promise<{ ergebnisse: Map<number, StapelErgebnis>; abfragen: number }> {
  const ergebnisse = new Map<number, StapelErgebnis>()
  let abfragen = 0
  const gezaehlt = zaehlendeDb(env.DB, async () => {
    if (++abfragen > ANFRAGEN_BUDGET) throw new BudgetErreicht(BUDGET_GRUND)
  })
  const mitBudget = { ...env, DB: gezaehlt.db }
  let bau: Promise<string | null> | undefined
  const listenbauAm = () => (bau ??= holeListenbauAm(env))
  for (const g of gruppen(env, stapel)) {
    try {
      for (const [i, r] of await gruppeSpeichern(mitBudget, g, listenbauAm)) ergebnisse.set(i, r)
    } catch (e) {
      const ablehnung = e instanceof BudgetErreicht ? { status: 503, grund: BUDGET_GRUND } : ausnahmeAls(e)
      for (const m of g.glieder) ergebnisse.set(m.i, abgelehnt(m, ablehnung))
    }
  }
  return { ergebnisse, abfragen }
}

/** Die Meldungen, die in eine Titelzeile gehören könnten, je Adresse und Anbieter. */
function gruppen(env: Env, stapel: unknown[]): Gruppe[] {
  const je = new Map<string, Gruppe>()
  stapel.forEach((m, i) => {
    if (!m || typeof m !== 'object' || 'stapel' in m) return
    const daten = m as Record<string, unknown>
    const url = String(daten.url ?? '').trim()
    if (!url || !gehoertHierher(env, daten)) return
    const ab = leiteAb(daten)
    if ('fehler' in ab) return
    const plattform = String(daten.plattform)
    const schluessel = JSON.stringify([plattform, url])
    const g = je.get(schluessel) ?? { url, plattform, glieder: [] }
    g.glieder.push({ i, daten, ab })
    je.set(schluessel, g)
  })
  return [...je.values()]
}

/** Alle Folgen einer Gruppe in einem Schreibvorgang; leer, wenn die Gruppe den bisherigen Weg geht. */
async function gruppeSpeichern(env: Env, g: Gruppe, listenbauAm: () => Promise<string | null>): Promise<[number, StapelErgebnis][]> {
  const zeile = await ladeZeile(env, g.url, g.plattform)
  if (!zeile && (await hatAltzeilen(env, g.url))) return []
  const glieder = g.glieder.map((m) => ({ ...m, eintrag: eintragOderFehler(m.daten, m.ab) }))
  if (!zeile && glieder.some((m) => typeof m.eintrag === 'string')) return []
  const passend = glieder.filter((m): m is Glied & { eintrag: Eintrag } => typeof m.eintrag !== 'string')
  const ergebnis = await aendereTitelzeile(env, { url: g.url, plattform: g.plattform, zeile }, async (alt) => {
    let stand: TitelDaten = alt ?? leereDaten()
    let geaendert = false
    for (const m of passend) {
      const neu = await setze(listenbauAm, stand, m.eintrag, kopfAusMeldung(m.daten))
      if (!neu.daten) continue
      stand = neu.daten
      geaendert = true
    }
    return geaendert ? stand : null
  })
  return glieder.map((m) => {
    if (typeof m.eintrag === 'string') return [m.i, abgelehnt(m, { status: 400, grund: m.eintrag })]
    if (ergebnis === 'belegt') return [m.i, abgelehnt(m, { status: 503, grund: 'Titelzeile gerade belegt, bitte wiederholen' })]
    return [m.i, { ok: true, befund: m.ab.befund }]
  })
}

/** Wie `verarbeiteStapel`: ins Protokoll, Grund an die Erweiterung. */
function abgelehnt(m: Glied, ablehnung: Ablehnung): StapelErgebnis {
  ablehnungLoggen('pruefung/stapel', ablehnung, m.daten)
  return { ok: false, status: ablehnung.status, grund: ablehnung.grund }
}
