import type { AgentRun } from '../types'

// Beendete Läufe (fertig, fehlgeschlagen, abgebrochen) zeigt das Panel nie. Im Zustand bleiben die neuesten wenigen:
// geplante Aufgaben gelten über sie als gestartet, und eine Fortsetzung (SendMessage) belebt sie wieder.
export const BEHALTE_BEENDETE = 12

// Laufende bleiben immer; von den beendeten nur die letzten BEHALTE_BEENDETE. Dieselbe Liste, wenn nichts zu kappen ist.
export function kappeBeendete(list: AgentRun[]): AgentRun[] {
  const beendet = list.filter(a => a.status !== 'running').length
  if (beendet <= BEHALTE_BEENDETE) return list
  let zuStreichen = beendet - BEHALTE_BEENDETE
  return list.filter(a => a.status === 'running' || zuStreichen-- <= 0)
}
