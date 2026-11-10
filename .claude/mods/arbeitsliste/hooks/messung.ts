// Abschaltbare Messung der Leisten-Renders (Daniel, 11.10.2026, Flackern): nur aktiv, solange die Datei
// messung.an im Mod-Ordner liegt; Protokoll in messung.log. Hier nur reine Hilfen: `$` darf nicht über
// Dateigrenzen gereicht werden, die Zugriffe darauf stehen in register.tsx.
export const MESS_MARKER = 'C:/Users/ih/.claude/mods/arbeitsliste/messung.an'
export const LOG = 'C:/Users/ih/.claude/mods/arbeitsliste/messung.log'
const MAX = 800

const jetzt = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// Startmarke für eine Dauermessung; 0 bei ausgeschalteter Messung.
export const messStart = (an: boolean): number => (an ? jetzt() : 0)
export const messDauer = (start: number): string => (start ? (jetzt() - start).toFixed(2) + 'ms' : '-')

// Protokolltext mit neuer Zeile am Ende, auf die letzten MAX Zeilen gekürzt.
export function haengeAn(alt: string, art: string, text: string): string {
  const zeile = `${new Date().toISOString()} ${art.padEnd(7)} ${text}`
  return (alt + zeile + '\n').split('\n').slice(-MAX - 1).join('\n')
}

// Welche Schlüssel zweier flacher Objekte unterscheiden sich (Auslöser eines Renders erkennen).
export function unterschied(alt: Record<string, unknown> | null, neu: Record<string, unknown>): string {
  if (!alt) return 'erster'
  const diff = Object.keys(neu).filter(k => JSON.stringify(alt[k]) !== JSON.stringify(neu[k]))
  return diff.length ? diff.join(',') : 'keiner'
}
