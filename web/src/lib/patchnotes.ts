import type { Patchnote } from '@shared/patchnotes.ts'
import { loadJson } from './data.ts'

/** Die Liste für den Dialog „Neu auf der Webseite“ — wird erst beim Klick auf den Knopf geladen, nie im Start. */
export const ladePatchnotes = (): Promise<Patchnote[]> => loadJson<Patchnote[]>('patchnotes.json')

const SCHLUESSEL = 'pn-gesehen'

/** Zuletzt gesehener Stand (Datum des jüngsten Eintrags); ohne Browser-Speicher gilt „nicht gesehen“. */
export function leseGesehen(): string | null {
  try {
    return localStorage.getItem(SCHLUESSEL)
  } catch {
    return null
  }
}

export function merkeGesehen(stand: string): void {
  try {
    localStorage.setItem(SCHLUESSEL, stand)
  } catch {
    /* Privater Modus: der Punkt kommt dann bei jedem Besuch wieder. */
  }
}
