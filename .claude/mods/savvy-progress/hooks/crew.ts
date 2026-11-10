// Zahl am Agents-Knopf: aktiv (Zustand running) plus geplant (Aufgaben ohne Lauf); Fertige zählen nie.
export function crewText(status: readonly string[], planned: number): string {
  const active = status.filter(s => s === 'running').length
  return planned ? `${active} + ${planned}` : active ? String(active) : ''
}
