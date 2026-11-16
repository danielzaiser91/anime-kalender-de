/** Kuratierte Liste deutscher YouTube-Kanäle (`data/curated/youtube-kanaele-deutsch.yaml`): ein Weg von dort gilt als Synchro-belegt. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

/** Kanalnamen wie im oEmbed-Befund; fehlt die Datei, ist die Liste leer. */
export function ladeDeutscheKanaele(): Set<string> {
  let roh: unknown
  try {
    roh = yaml.load(readFileSync(resolve(ROOT, 'data/curated/youtube-kanaele-deutsch.yaml'), 'utf8'))
  } catch {
    return new Set()
  }
  const liste = (roh as { kanaele?: { name?: unknown }[] } | null)?.kanaele ?? []
  return new Set(liste.map((k) => k.name).filter((n): n is string => typeof n === 'string' && n !== ''))
}

/** Urteil für einen YouTube-Weg: `true`, wenn sein Kanal in der Liste steht, sonst `undefined` (kein Urteil, nie `false`). */
export function dubAusDeutschemKanal(kanal: string | undefined, deutscheKanaele: Set<string>): true | undefined {
  return kanal !== undefined && deutscheKanaele.has(kanal) ? true : undefined
}
