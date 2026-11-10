import type { AgentRun, Schritt } from '../types'

export type StepInput = { percent?: number; steps?: { name?: string; percent?: number }[]; done?: number; total?: number }
export type StepStand = Pick<AgentRun, 'stepPercent' | 'stepPlan'>

const klemme = (n: number): number => Math.min(100, Math.max(0, Math.round(n)))

// Plan auf Summe 100 bringen (der Agent rechnet selten genau); ungültige Einträge fallen weg.
function normiere(steps: StepInput['steps']): Schritt[] | undefined {
  const roh = (steps ?? [])
    .filter(s => typeof s?.percent === 'number' && s.percent > 0)
    .map(s => ({ name: (s.name ?? '').trim(), percent: s.percent as number }))
  const summe = roh.reduce((x, s) => x + s.percent, 0)
  if (!roh.length || !summe) return undefined
  return roh.map(s => ({ name: s.name, percent: (s.percent * 100) / summe }))
}

const gleicheSchritte = (total: number): Schritt[] => Array.from({ length: total }, () => ({ name: '', percent: 100 / total }))

// Neuer Stand aus einer Meldung. `percent` ist kumuliert (0–100); die alten Felder done/total laufen als Rückfall
// weiter (gleich große Schritte), damit schon laufende Agenten nicht brechen.
export function stepStand(prev: StepStand, input: StepInput): StepStand {
  const neuerPlan = normiere(input.steps)
  let plan = neuerPlan ?? prev.stepPlan
  let percent = prev.stepPercent ?? 0
  if (typeof input.percent === 'number') percent = klemme(input.percent)
  else if (typeof input.done === 'number') {
    const total = Math.round(input.total ?? plan?.length ?? 0)
    if (total > 0) {
      if (!neuerPlan && plan?.length !== total) plan = gleicheSchritte(total)
      percent = klemme((Math.max(0, input.done) * 100) / total)
    }
  }
  return { stepPercent: percent, stepPlan: plan }
}

// Erledigt ist ein Schritt, sobald der Fortschritt seinen kumulierten Anteil erreicht hat.
export function schrittZahl(a: StepStand): { done: number; total: number } {
  const plan = a.stepPlan ?? []
  let summe = 0
  let done = 0
  for (const s of plan) {
    summe += s.percent
    if ((a.stepPercent ?? 0) + 0.5 >= summe) done++
  }
  return { done, total: plan.length }
}

// Gesamtleiste: nur laufende Agenten (Fertige fallen aus der Anzeige, sonst spränge das Mittel mit alten Läufen).
// Ein Agent ohne Meldung zählt 0 % und keine Schritte. Ohne laufenden Agenten null: dann gelten die Zahlen der Hauptsitzung.
export function agentenGesamt(list: readonly AgentRun[]): { done: number; total: number; percent: number } | null {
  const laufend = list.filter(a => a.status === 'running')
  if (!laufend.length) return null
  let done = 0
  let total = 0
  let summe = 0
  for (const a of laufend) {
    const z = schrittZahl(a)
    done += z.done
    total += z.total
    summe += a.stepPercent ?? 0
  }
  return { done, total, percent: summe / laufend.length }
}
