import type { AgentRun } from '../types'

// Prüfer: Agententyp `pruefer` oder Beschreibung, die mit „Prüfer“ beginnt. Sie zählen nicht zu den laufenden Agenten.
export const istPruefer = (a: Pick<AgentRun, 'type' | 'description'>): boolean =>
  a.type === 'pruefer' || /^prüfer/i.test(a.description.trim())
