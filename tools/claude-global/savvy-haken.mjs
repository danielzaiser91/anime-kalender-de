/**
 * Prüft, ob die installierte savvy-progress (Mod claude-kit, nicht im Repo) den Hook für den Agents-Knopf der Mod „arbeitsliste“ hat:
 * `on('state.set', { plugin: 'arbeitsliste', key: 'agentenKnopf' }, …)` mit `togglePane($)`. Ein claude-kit-Update überschreibt die
 * Datei und nimmt den Hook mit; dann zeigt der Knopf nur einen Hinweis. Kopie des Hooks: mods/arbeitsliste/hooks/savvy-haken-kopie.ts.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const HAKEN = /on\(\s*'state\.set'\s*,\s*\{[^}]*key:\s*'agentenKnopf'[^}]*\}[\s\S]*?togglePane\(\$\)/

/** `zielOrdner` ist ~/.claude. Gibt { zeile, fehlt } zurück; ohne installiertes savvy gibt es nichts zu prüfen. */
export function pruefeSavvyHaken(zielOrdner) {
  const datei = join(zielOrdner, 'mods', 'claude-kit', 'plugins', 'savvy-progress', 'hooks', 'register.tsx')
  if (!existsSync(datei)) return { zeile: 'übersprungen: savvy-progress nicht installiert (Agents-Knopf-Hook)', fehlt: false }
  if (HAKEN.test(readFileSync(datei, 'utf8'))) return { zeile: 'ok: savvy-progress hat den Hook für den Agents-Knopf', fehlt: false }
  return { zeile: `FEHLT Hook für den Agents-Knopf in ${datei} (Kopie: mods/arbeitsliste/hooks/savvy-haken-kopie.ts, nach einem claude-kit-Update wieder einsetzen)`, fehlt: true }
}
