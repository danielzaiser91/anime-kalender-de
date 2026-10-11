import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { type PlatformId, type StreamLink, type Title } from '../../shared/types.ts'
import { type Zugangsart } from '../../shared/zugangsart.ts'
import { adressKern, adressGleich } from './dub-confirmed.ts'
import { ROOT, warn, log } from './util.ts'

interface VerweisVonHand {
  anilistId?: number
  platform?: string
  url?: string
  beleg?: string
  belegtAm?: string
  zugang?: Zugangsart
}

/**
 * **Verweise, die kein Sammellauf findet — von Hand belegt** (`data/verweise-von-hand.yaml`).
 *
 * Die Erweiterung meldet Seiten, die unser Datensatz gar nicht kennt: Ein Anbieter führt denselben
 * Anime unter mehreren Kennungen, und aniSearch nennt nur eine. `data/adn-adressen.yaml` und
 * `data/rtlplus-adressen.yaml` **ersetzen** eine vorhandene Adresse; diese Datei **legt eine an**.
 *
 * **Der Eintrag urteilt nicht.** Er sagt „dort gibt es diesen Titel", nicht „dort ist er auf
 * Deutsch" — das Sprachurteil kommt weiter aus den Meldungen. Ein Verweis, der schon dasteht,
 * wird nicht verdoppelt (Vergleich über den Adresskern).
 *
 * Gibt zurück: Adresskern → `belegtAm` der bestätigten Wege (für `handSticht`, 22.09.2026).
 */
export function ergaenzeVerweiseVonHand(titles: Map<number, Title>): Map<string, string> {
  const belegtAm = new Map<string, string>()
  const datei = resolve(ROOT, 'data/verweise-von-hand.yaml')
  const roh = existsSync(datei) ? yaml.load(readFileSync(datei, 'utf8')) : []
  const eintraege = Array.isArray(roh) ? (roh as VerweisVonHand[]) : []
  let ergaenzt = 0
  for (const e of eintraege) {
    if (!e.anilistId || !e.platform || !e.url) continue
    if (e.belegtAm) belegtAm.set(adressKern(e.url), String(e.belegtAm))
    const title = titles.get(e.anilistId)
    if (!title) {
      warn(`verweise-von-hand: Titel ${e.anilistId} steht nicht im Bestand`)
      continue
    }
    if ((title.streams ?? []).some((s) => adressGleich(s.url, e.url!))) continue
    title.streams = [
      ...(title.streams ?? []),
      { platform: e.platform as PlatformId, url: e.url, ...(e.zugang ? { zugang: e.zugang } : {}) } as StreamLink,
    ]
    ergaenzt++
  }
  if (ergaenzt) log(`${ergaenzt} Verweise aus data/verweise-von-hand.yaml ergänzt`)
  return belegtAm
}
