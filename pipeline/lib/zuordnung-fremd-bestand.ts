import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { streamAdressen } from './fremde-adressen.ts'
import { findeFremdZugeordnete, type FremdZugeordnet, type ZuordnungEintrag } from './zuordnung-fremd.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'
import { adressGleich } from '../../shared/adresse-kern.ts'
import { findeGeteilteSeiten, type GeteilteSeite } from './zuordnung-geteilt.ts'

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

/** „laut Adresse Staffel k“ aus der Notiz des Handbelegs, den `titleId` an `adresse` führt. */
export function staffelLautAdresse(belege: readonly (BelegAdresse & { note?: string })[], titleId: number, adresse: string): number | undefined {
  const beleg = belege.find((b) => b.anilistId === titleId && adressGleich(b.url, adresse) && /laut Adresse Staffel \d+/.test(b.note ?? ''))
  const k = /laut Adresse Staffel (\d+)/.exec(beleg?.note ?? '')?.[1]
  return k === undefined ? undefined : Number(k)
}

/** Seiten im Bestand unter `wurzel`, an denen Titel verschiedener Reihen liegen (`findeGeteilteSeiten`), nach Abzug gesperrter Seiten. */
export function geteilteSeitenImBestand(wurzel: string): GeteilteSeite[] {
  const belege = (yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) as (BelegAdresse & { note?: string })[] | null) ?? []
  const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8')) as { id: number; franchiseId: number }[]
  const reihe = new Map(titel.map((t) => [t.id, t.franchiseId]))
  return findeGeteilteSeiten(
    Object.entries(leseZugeordnet<ZuordnungEintrag>()),
    (id) => reihe.get(id),
    (id, adresse) => staffelLautAdresse(belege, id, adresse),
  )
}
