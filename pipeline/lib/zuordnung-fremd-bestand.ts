import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { streamAdressen } from './fremde-adressen.ts'
import { findeFremdZugeordnete, type FremdZugeordnet, type ZuordnungEintrag } from './zuordnung-fremd.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'

/** Eine Zeile der Bekannt-Liste: Kennung und Adresse, wie `findeFremdZugeordnete` sie meldet. */
export const bekanntZeile = (t: Pick<FremdZugeordnet, 'titleId' | 'adresse'>): string => `${t.titleId} ${t.adresse}`

/** Die heutigen Treffer im Bestand unter `wurzel`: die Prime-Zuordnungen nach Abzug der gesperrten Seiten und entfernten Belege (`leseZugeordnet`), je Zeile einmal. */
export function fremdZugeordneteImBestand(wurzel: string): FremdZugeordnet[] {
  const belege = (yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) as BelegAdresse[] | null) ?? []
  const treffer = findeFremdZugeordnete(Object.entries(leseZugeordnet<ZuordnungEintrag>()), streamAdressen(wurzel), belege)
  return [...new Map(treffer.map((t) => [bekanntZeile(t), t])).values()]
}

/** Neue Treffer (nicht in der Bekannt-Liste) und veraltete Zeilen der Liste (kein Treffer mehr: streichen). */
export function gegenBekannt(treffer: readonly FremdZugeordnet[], bekannt: readonly string[]): { neu: FremdZugeordnet[]; veraltet: string[] } {
  const stehen = new Set(bekannt)
  const heute = new Set(treffer.map(bekanntZeile))
  return { neu: treffer.filter((t) => !stehen.has(bekanntZeile(t))), veraltet: bekannt.filter((z) => !heute.has(z)) }
}
