import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { neinWiedervorlage, type NeinBeleg, type NeinFall } from '../../shared/nein-wiedervorlage.ts'
import type { Release } from '../../shared/types.ts'

/** Ein vom Bau entfernter Verweis (`data/verweise-entfernt.json`), soweit die Wiedervorlage ihn liest. */
export interface EntfernterEintrag {
  titleId: number
  plattform: string
  url?: string
  entferntAm?: string | null
}

/** Je Titel und Anbieter die Adresse des zuletzt entfernten Verweises; die Adresse trägt, wohin die Erweiterung gehen soll. */
export function adresseJeWeg(entfernt: EntfernterEintrag[]): Map<string, string> {
  const jeWeg = new Map<string, string>()
  const alt = [...entfernt].sort((a, b) => String(a.entferntAm ?? '').localeCompare(String(b.entferntAm ?? '')))
  for (const e of alt) if (e.url) jeWeg.set(`${e.titleId}|${e.plattform}`, e.url)
  return jeWeg
}

function lies<T>(wurzel: string, pfad: string, leer: T, lader: (text: string) => T): T {
  const voll = resolve(wurzel, pfad)
  return existsSync(voll) ? lader(readFileSync(voll, 'utf8')) : leer
}

/**
 * Die Nein, die jetzt neu gemessen werden sollen, aus den Dateien unter `wurzel`: Handbelege, Termine und das Gedächtnis
 * der entfernten Verweise. Nennt der Beleg keine Adresse, trägt der entfernte Verweis die seine.
 */
export function ladeNeinFaelle(wurzel = ROOT, jetzt = new Date()): NeinFall[] {
  const belege = lies<NeinBeleg[]>(wurzel, 'data/dub-confirmed.yaml', [], (t) => (yaml.load(t) as NeinBeleg[] | undefined) ?? [])
  const releases = lies<Release[]>(wurzel, 'public/data/releases.json', [], (t) => JSON.parse(t))
  const entfernt = lies<{ verweise?: EntfernterEintrag[] }>(wurzel, 'data/verweise-entfernt.json', {}, (t) => JSON.parse(t))
  const adressen = adresseJeWeg(entfernt.verweise ?? [])
  return neinWiedervorlage(belege, releases, jetzt).map((f) => {
    const url = f.url ?? adressen.get(`${f.titleId}|${f.platform}`)
    return url ? { ...f, url } : f
  })
}
