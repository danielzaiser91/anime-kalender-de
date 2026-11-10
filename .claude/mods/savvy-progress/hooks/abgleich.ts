import type { AgentRun } from '../types'

// Nur ausdrückliche Endzustände der Sitzung (`$.agent.list()`) beenden einen Lauf im Panel. Ein Lauf, den die Liste
// nicht kennt (andere ID, anderer Umfang der Liste), bleibt unberührt: fehlend heißt nie „fertig“.
const ENDE: Record<string, AgentRun['status']> = { completed: 'done', failed: 'failed', killed: 'failed' }

const SCHONFRIST_MS = 15_000

// Gibt dieselbe Liste zurück, wenn sich nichts ändert (kein Schreiben, kein Neuzeichnen).
export function gleicheAb(list: AgentRun[], echt: { id: string; status: string }[], jetzt: number): AgentRun[] {
  const stand = new Map(echt.map(a => [a.id, a.status]))
  let geaendert = false
  const neu = list.map(a => {
    const status = a.status === 'running' && a.agentId && jetzt - a.startedAt >= SCHONFRIST_MS ? ENDE[stand.get(a.agentId) ?? ''] : undefined
    if (!status) return a
    geaendert = true
    return { ...a, status, endedAt: jetzt }
  })
  return geaendert ? neu : list
}
