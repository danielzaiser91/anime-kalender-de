import type { AgentRun } from '../types'
import { istPruefer } from './pruefer'

export type Rolle = 'bauer' | 'analyst' | 'pruefer' | 'rechercheur'

// Kostümschlüssel je Rolle: der Analyst trägt das Detektiv-Kostüm der Stufe `heavy`, die anderen haben eigene.
export const ROLLE_KOSTUEM: Record<Rolle, string> = {
  bauer: 'bauer',
  analyst: 'heavy',
  pruefer: 'pruefer',
  rechercheur: 'entdecker',
}

// Akzentfarbe der eigenen Kostüme (das Detektiv-Kostüm behält die Farbe von `heavy`).
export const ROLLE_FARBE: Record<string, string> = {
  bauer: '#378ADD',
  pruefer: '#1D9E75',
  entdecker: '#BA7517',
}

// Rolle aus dem Agententyp (`bauer`, auch `plugin:bauer`) oder dem Präfix der Beschreibung („Bauer PR 3“);
// der Rechercheur ist ein `general-purpose` und nur an der Beschreibung zu erkennen.
export function rolleOf(a: Pick<AgentRun, 'type' | 'description'>): Rolle | null {
  if (istPruefer(a)) return 'pruefer'
  const typ = a.type.replace(/^[^:]*:/, '').toLowerCase()
  if (typ === 'bauer' || typ === 'analyst') return typ
  const wort = /^(bauer|analyst|rechercheur)(?![\p{L}])/iu.exec(a.description.trim())?.[1]
  return wort ? (wort.toLowerCase() as Rolle) : null
}

// Kostümschlüssel der Rolle, sonst null (dann gilt Stufe bzw. Standard).
export const kostuemOfRolle = (a: Pick<AgentRun, 'type' | 'description'>): string | null => {
  const rolle = rolleOf(a)
  return rolle ? ROLLE_KOSTUEM[rolle] : null
}
