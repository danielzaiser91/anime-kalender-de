/**
 * Vollständiger Vergleich Kettenbasis -> main aus dem lokalen git (27.10.2026): Die Compare-API von GitHub liefert höchstens 300 Dateien
 * und 250 Commits; Bestandsbau-Sprünge sind oft größer, die Ausnahmen in `pr-nachrechnen.mjs` griffen darum fast nie.
 * Rückgabe { dateien, autoren, commitsGesamt } oder { fehler } (dann gilt der API-Vergleich als abgeschnitten, der PR als veraltet).
 * Dateien mit `--no-renames`: eine Umbenennung nennt alten und neuen Pfad, wie `previous_filename` der API.
 */
import { gitAufruf } from './pr-nachrechnen-leser-git.mjs'

const zeilen = (text) => text.split(/\r?\n/).filter(Boolean)
/** `-z`: Pfade mit Sonderzeichen (Umlaut, Leerzeichen) kommen ungequotet, getrennt durch NUL. */
const nullGetrennt = (text) => text.split('\0').filter(Boolean)

export const vollerVergleich = (git) => (basis, main) => {
  try {
    git(['fetch', '-q', 'origin', basis, main])
    const dateien = nullGetrennt(git(['diff', '-z', '--name-only', '--no-renames', basis, main, '--']))
    const autoren = zeilen(git(['log', '--format=%an', `${basis}..${main}`]))
    return { dateien, autoren, commitsGesamt: autoren.length }
  } catch (e) {
    return { fehler: String(e.message).split('\n')[0].slice(0, 120) }
  }
}

export const standardVoll = vollerVergleich(gitAufruf)
