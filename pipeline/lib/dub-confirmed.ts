/**
 * Von Hand geprüfte Synchro-Angaben je Anbieter.
 *
 * Die Pipeline kann eine deutsche Synchro nur dort belegen, wo eine Quelle sie
 * selbst nennt — ADN über den Sprachcode `vde`, Crunchyroll über „(Deutsch)"
 * im Kalender. Für YouTube, Netflix, Prime Video, RTL+ und Joyn gibt es keine
 * maschinenlesbare Auskunft; dort steht in der Oberfläche „🇩🇪 ?".
 *
 * `data/dub-confirmed.yaml` ist der Weg, aus einem Fragezeichen ein Häkchen zu
 * machen — durch tatsächliches Nachsehen, nicht durch Vermutung.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { PLATFORMS, type PlatformId } from '../../shared/types.ts'
import { warn } from './util.ts'

export interface DubCheck {
  anilistId: number
  title?: string
  platform: PlatformId
  dub: boolean
  checkedAt: string
  note?: string
}

const DATEI = resolve(ROOT, 'data', 'dub-confirmed.yaml')

export function loadDubChecks(): DubCheck[] {
  if (!existsSync(DATEI)) return []
  const raw = yaml.load(readFileSync(DATEI, 'utf8'))
  if (!Array.isArray(raw)) return []
  const out: DubCheck[] = []
  for (const item of raw as DubCheck[]) {
    // Ein halb ausgefüllter Eintrag ist gefährlicher als keiner: Er nimmt den
    // Verweis aus der Prüfliste, ohne etwas zu belegen. Deshalb hier laut
    // meckern statt still überspringen.
    if (!item?.anilistId || typeof item.dub !== 'boolean') {
      warn(`dub-confirmed.yaml: Eintrag ohne anilistId oder ohne dub — übersprungen (${JSON.stringify(item)})`)
      continue
    }
    if (!(item.platform in PLATFORMS)) {
      warn(`dub-confirmed.yaml: unbekannte Plattform "${item.platform}" bei ${item.anilistId}`)
      continue
    }
    if (!item.checkedAt) {
      warn(`dub-confirmed.yaml: ${item.anilistId}/${item.platform} ohne checkedAt`)
      continue
    }
    out.push(item)
  }
  return out
}

/** Schlüssel für den Abgleich: ein Anime auf einer Plattform. */
export function dubKey(anilistId: number, platform: string): string {
  return `${anilistId}|${platform}`
}
