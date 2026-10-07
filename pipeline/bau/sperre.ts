import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from '../lib/util.ts'

/**
 * **F-Sperre** (`data/fanservice-urteil.yaml`, Daniel, 08.10.2026): Titel, die nur Fanservice zeigen. Sie bleiben im Bestand (Datenbank-Suche, Reihen-Liste), tragen aber die Marke
 * `sperre` und haben keine Termine und keine Meldungen — im Kalender, in den Neuigkeiten und in der Saison können sie nicht erscheinen.
 */
export function fanservicesperre(): Set<number> {
  const text = readFileSync(resolve(ROOT, 'data/fanservice-urteil.yaml'), 'utf8')
  return new Set([...text.matchAll(/^\s*-\s*id:\s*(\d+)/gm)].map((m) => Number(m[1])))
}

export const mitSperre = <T extends { id: number }>(t: T, gesperrt: Set<number>): T => (gesperrt.has(t.id) ? { ...t, sperre: 'fanservice' as const } : t)

/** Entfernt die Einträge gesperrter Titel aus den Listen selbst (alle späteren Phasen — Kalender, Meldungen, Abo-Feeds — sehen sie dann nicht mehr). */
export function entferneGesperrte(...listen: { titleId: number }[][]): void {
  const gesperrt = fanservicesperre()
  for (const liste of listen) for (let i = liste.length - 1; i >= 0; i--) if (gesperrt.has(liste[i]!.titleId)) liste.splice(i, 1)
}
