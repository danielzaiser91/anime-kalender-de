import { existsSync, readdirSync } from 'node:fs'
import { log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { ARCHIV_SEITEN, leseSeite } from '../lib/anisearch-relationen.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import type { Kante, Namen } from './anisearch-reihen.ts'
import { type Pruefzeile, uebernimmReihen } from './anisearch-reihen-uebernahme.ts'

/**
 * **Reihen aus aniSearch übernehmen: Anbindung an den Bau** (Stufe C der AniList-Ablösung, 11.10.2026). `anisearchRelationenKanten` liefert die Verbindungen, die `03-reihen.ts` zu den
 * Reihen hinzunimmt (Regeln in `anisearch-reihen-uebernahme.ts`), und schreibt, was nicht automatisch geht, als Prüfliste `data/anisearch-reihen-pruefliste.json` — der Weg dafür ist
 * `data/reihen-von-hand.yaml`. Ein Fehler hier stoppt den Bau nie: dann bleiben die Reihen aus AniList, wie sie sind.
 */
export const PRUEFLISTE_DATEI = 'data/anisearch-reihen-pruefliste.json'

export type PruefDatei = { stand: string; angehaengt: number; neueReihen: number; pruefliste: Pruefzeile[] }

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

/** Schreibt die Prüfliste nur bei Änderung, damit der Stand nicht täglich committet wird. */
function schreibePruefliste(neu: PruefDatei): void {
  const alt = readJson<Partial<PruefDatei>>(PRUEFLISTE_DATEI, {})
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...neu, stand: '' })) writeJson(PRUEFLISTE_DATEI, neu, true)
}

/** Verbindungen aus aniSearch-Beziehungen für `03-reihen.ts` (Format von `reihen-von-hand.yaml`); `wurzel`: die Reihe je Titel im Stand des Baus. */
export function anisearchRelationenKanten(titles: Map<number, Title>, wurzel: (id: number) => number, ausgenommen: Set<number>): { ids: number[] }[] {
  try {
    const kennung = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
    const kandidaten = [...titles.values()].map((t) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: kennung.get(t.id) }))
    const { kanten, namen } = ladeBeziehungen()
    const u = uebernimmReihen(kandidaten, kanten, namen, wurzel, ausgenommen)
    schreibePruefliste({ stand: todayIso(), angehaengt: u.angehaengt, neueReihen: u.neueReihen, pruefliste: u.pruefliste })
    log(`aniSearch-Reihen: ${u.angehaengt} Alleinstehende an Reihen gehängt, ${u.neueReihen} neue Reihen, ${u.pruefliste.length} Fälle auf der Prüfliste (${PRUEFLISTE_DATEI})`)
    return u.kanten
  } catch (e) {
    warn(`aniSearch-Reihen übernehmen übersprungen (Fehler): ${(e as Error).message}`)
    return []
  }
}
