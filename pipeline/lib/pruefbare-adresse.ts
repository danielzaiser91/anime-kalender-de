import { log } from './util.ts'

/**
 * Ob eine Adresse überhaupt abrufbar ist. Wege ohne Adresse (`url: ''`, nur der Anbieter ist bekannt) gibt es
 * seit dem Bau aus Terminen (`bau/11-7-wege-aus-terminen.ts`), vorher nur bei Cartoons; `StreamLink.url` kann also
 * leer sein, und ein Prüflauf darf an ihnen nicht abstürzen.
 */
export function istPruefbareAdresse(adresse: string | undefined): adresse is string {
  if (!adresse) return false
  try {
    const u = new URL(adresse)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** Behält nur abrufbare Adressen und meldet, wie viele übersprungen wurden. */
export function pruefbare(adressen: Iterable<string>): string[] {
  const alle = [...adressen]
  const brauchbar = alle.filter(istPruefbareAdresse)
  log(`${alle.length - brauchbar.length} Einträge ohne gültige Adresse übersprungen.`)
  return brauchbar
}
