import type { Title } from '../../shared/types.ts'
import { readJson } from '../lib/util.ts'
import { mitAnkuendigung, OUT } from './grundlagen.ts'

/**
 * Die Titel für `titles-core.json`: alle mit einem Release. Ein kuratierter Termin kann zu einem Cartoon gehören
 * (Kennung < 0, z. B. Avatar: Die sieben Häfen); sein Titel steht nur in `cartoons.json`, der Kalender liest aber nur den Kern.
 */
export function kernTitel(slim: Title[], referenziert: Set<number>): Title[] {
  const cartoons = readJson<Title[]>(`${OUT}/cartoons.json`, []).filter((t) => referenziert.has(t.id))
  return [...slim.filter((t) => referenziert.has(t.id)), ...cartoons].map(mitAnkuendigung)
}
