/**
 * Warnung der Wache (`tools/delta-pruefen.mjs`): Der Entwurfs-Stift im Patch-Notes-Dialog darf nicht dauerhaft stehen bleiben.
 * Ist der älteste Entwurf in `public/data/patchnotes.json` älter als `ENTWURF_MAX_TAGE`, hat der tägliche Überarbeitungslauf den Stempel
 * `data/patchnotes/_ueberarbeitet-bis.txt` nicht gehoben (17.10.2026).
 */
import { existsSync, readFileSync } from 'node:fs'

export const ENTWURF_MAX_TAGE = 3

const tagNummer = (tag) => Date.parse(`${tag}T00:00:00Z`) / 86400000

/** Heutiger Tag in Berlin (JJJJ-MM-TT). */
export const heuteBerlin = (jetzt = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(jetzt)

/** Warntext, wenn der älteste Entwurf mehr als `ENTWURF_MAX_TAGE` Tage zurückliegt, sonst `null`. */
export function veralteterStempel(liste, heute) {
  const aelteste = liste.filter((n) => n.entwurf).map((n) => n.datum).sort()[0]
  if (aelteste === undefined) return null
  const alter = tagNummer(heute) - tagNummer(aelteste)
  if (alter <= ENTWURF_MAX_TAGE) return null
  return `Patch Notes: Einträge vom ${aelteste} sind seit ${alter} Tagen Entwurf (Stempel data/patchnotes/_ueberarbeitet-bis.txt nicht gehoben)`
}

/** Wie `veralteterStempel`, liest die ausgelieferte Liste aus der Datei (relativ zum Arbeitsordner); fehlt sie, gibt es nichts zu warnen. */
export function stempelWarnungAusDatei(pfad = 'public/data/patchnotes.json', heute = heuteBerlin()) {
  if (!existsSync(pfad)) return null
  return veralteterStempel(JSON.parse(readFileSync(pfad, 'utf8')), heute)
}
