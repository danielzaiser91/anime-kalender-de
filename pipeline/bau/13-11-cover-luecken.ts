import { readJson, writeJson, log } from '../lib/util.ts'
import { baueCoverLuecken } from '../lib/cover-luecken.ts'

const OUT = 'public/data'
export const COVER_LUECKEN = 'data/cover-luecken.json'

/**
 * Schreibt `data/cover-luecken.json` aus den fertig geschriebenen Dateien neu: Ein Titel, der ein Cover bekommt, verlässt die Liste im selben Bau.
 * Bis zum 04.11.2026 pflegte niemand die Liste (einmal von Hand angelegt, die Wache warnte nur): 546 von 645 Einträgen waren veraltet.
 */
export function schreibeCoverLuecken(): void {
  const lies = <T>(name: string): T => readJson<T>(`${OUT}/${name}`, [] as never)
  const liste = baueCoverLuecken(
    readJson(`${OUT}/franchises.json`, {}),
    [...lies<[]>('titles.json'), ...lies<[]>('ohne-synchro.json')],
    readJson('data/cover-eigen.json', {}),
  )
  writeJson(COVER_LUECKEN, liste, true)
  log(`cover-luecken.json: ${Object.keys(liste).length} Einträge ohne Cover`)
}
