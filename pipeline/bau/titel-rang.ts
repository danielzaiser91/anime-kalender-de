import { anzeigeName } from '../../shared/titles.ts'
import type { Title } from '../../shared/types.ts'
import { OUT } from './grundlagen.ts'
import { log, readJson, writeJson } from '../lib/util.ts'

const DATEIEN = ['titles.json', 'ohne-synchro.json', 'cartoons.json']

/**
 * **Die Reihenfolge nach Titel, einmal im Bau gerechnet** (Daniel, 07.10.2026: die Datenbank darf beim Umschalten nicht einfrieren).
 *
 * Jeder Titel bekommt `tr`, seinen Platz in der Sortierung nach `anzeigeName` (deutsche Sortierreihenfolge) — über alle drei Dateien
 * zusammen, damit die Rangfolge gilt, egal welche davon geladen sind. Die Seite sortiert dann nach einer Zahl statt 18.863 Namen zu
 * vergleichen: auf einem Handy mit Drosselung 900 ms am Stück gegen wenige Millisekunden. Läuft nach allen Schreibern.
 */
export function ergaenzeTitelRang(): void {
  const listen = DATEIEN.map((d) => ({ pfad: `${OUT}/${d}`, titel: readJson<Title[]>(`${OUT}/${d}`, []) }))
  const kollator = new Intl.Collator('de')
  const alle = listen.flatMap((l) => l.titel).map((t) => ({ t, name: anzeigeName(t) }))
  alle.sort((a, b) => kollator.compare(a.name, b.name) || a.t.id - b.t.id)
  alle.forEach((x, i) => {
    ;(x.t as Title & { tr?: number }).tr = i
  })
  for (const l of listen) if (l.titel.length) writeJson(l.pfad, l.titel)
  log(`Titelrang für ${alle.length} Titel gerechnet`)
}
