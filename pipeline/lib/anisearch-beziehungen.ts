import { existsSync, readdirSync } from 'node:fs'
import type { Kante, Namen } from '../bau/anisearch-reihen.ts'
import { ARCHIV_SEITEN, leseSeite } from './anisearch-relationen.ts'

let beziehungen: { kanten: Kante[]; namen: Namen; mitSeite: Set<number> } | undefined

/** Kanten (nur Anime) und Namen aller Archivseiten; `mitSeite` sind die Kennungen, deren Seite da ist. Einmal je Prozess gelesen (≈ 5 s). */
export function ladeBeziehungen(dir = ARCHIV_SEITEN): { kanten: Kante[]; namen: Namen; mitSeite: Set<number> } {
  if (beziehungen && dir === ARCHIV_SEITEN) return beziehungen
  const [kanten, namen, mitSeite]: [Kante[], Namen, Set<number>] = [[], new Map(), new Set()]
  const merke = (id: number, name: string): void => {
    if (name && !(namen.get(id) ?? []).includes(name)) namen.set(id, [...(namen.get(id) ?? []), name])
  }
  for (const datei of existsSync(dir) ? readdirSync(dir) : []) {
    const id = Number(datei.replace('.html.gz', ''))
    const seite = Number.isInteger(id) ? leseSeite(id, dir) : undefined
    if (!seite) continue
    mitSeite.add(id)
    seite.titel.forEach((t) => merke(id, t))
    for (const r of seite.relationen.filter((x) => x.medium === 'anime')) {
      merke(r.id, r.name)
      kanten.push({ a: id, b: r.id, art: r.art })
    }
  }
  const ergebnis = { kanten, namen, mitSeite }
  if (dir === ARCHIV_SEITEN) beziehungen = ergebnis
  return ergebnis
}
