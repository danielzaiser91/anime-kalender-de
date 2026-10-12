import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

/** **Deutsche Erstausgabe von Hand** (`data/erstausgabe-von-hand.yaml`): Datum, wo aniSearchs Start nicht die Synchro meint. */
export const ERSTAUSGABE_VON_HAND = 'data/erstausgabe-von-hand.yaml'

export interface ErstausgabeVonHand {
  anilistId?: number
  title?: string
  von?: string
  publisher?: string
  sources?: string[]
}

export function ladeErstausgabeVonHand(pfad = resolve(ROOT, ERSTAUSGABE_VON_HAND)): ErstausgabeVonHand[] {
  if (!existsSync(pfad)) return []
  return (yaml.load(readFileSync(pfad, 'utf8')) as ErstausgabeVonHand[] | null) ?? []
}
