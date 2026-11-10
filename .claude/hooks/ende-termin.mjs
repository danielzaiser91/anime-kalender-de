/**
 * UserPromptSubmit-Modul: geplantes Ende („ende 23 uhr“, Daniel 18.10.2026). Die Uhrzeit steht als ISO in
 * ~/.claude/ende-um.txt; ab dann meldet jede Eingabe (auch ein Wecker), dass der Skill zum-ende-kommen fällig ist,
 * vorher, dass kein Wecker über die Uhrzeit hinaus gestellt werden darf. Die Sitzung löscht die Datei beim Schnitt.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DATEI = join(homedir(), '.claude', 'ende-um.txt')
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function meldung(jetzt = Date.now(), lies = () => readFileSync(DATEI, 'utf8')) {
  let t
  try { t = new Date(lies().trim()) } catch { return '' }
  if (isNaN(t)) return ''
  if (jetzt >= t.getTime()) return `[Ende fällig seit ${hhmm(t)}: Skill zum-ende-kommen jetzt ausführen (Schnitt), danach ${DATEI} löschen]`
  const min = Math.ceil((t.getTime() - jetzt) / 60000)
  return `[Ende geplant ${hhmm(t)} (in ${min} min): Wecker höchstens bis dahin stellen, ScheduleWakeup delaySeconds ≤ ${min * 60}]`
}
