import { existsSync, readFileSync, readdirSync } from 'node:fs'
import yaml from 'js-yaml'
import { ROOT, log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { ARCHIV_SEITEN, leseSeite } from '../lib/anisearch-relationen.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import type { Kante, Namen } from './anisearch-reihen.ts'
import { type Pruefzeile, type Trennung, WANDERREGEL, uebernimmReihen } from './anisearch-reihen-uebernahme.ts'
import { type Anker, uebernimmKatalogReihen } from './anisearch-reihen-katalog.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'

/**
 * **Reihen aus aniSearch übernehmen: Anbindung an den Bau** (Stufe C der AniList-Ablösung, 11.10.2026). `anisearchRelationenKanten` liefert die Verbindungen, die `03-reihen.ts` zu den
 * Reihen hinzunimmt (Regeln in `anisearch-reihen-uebernahme.ts`), und schreibt, was nicht automatisch geht, als Prüfliste `data/anisearch-reihen-pruefliste.json` — der Weg dafür ist
 * `data/reihen-von-hand.yaml` (`ids:` verbindet, `getrennt:` verbietet die aniSearch-Beziehung). Ein Fehler hier stoppt den Bau nie: dann bleiben die Reihen aus AniList, wie sie sind. `anisearchKatalogReihen` tut dasselbe für den Katalog (Stufe C, Teil 3) und schreibt seinen Teil der Prüfliste (`quelle: katalog`).
 */
export const PRUEFLISTE_DATEI = 'data/anisearch-reihen-pruefliste.json'

/** `bestand`: der Hauptbestand (`03-reihen.ts`, Weg `data/reihen-von-hand.yaml`); `katalog`: der AniList-Katalog (`ohne-synchro.json`, `nebendateien.ts`). */
export type Quelle = 'bestand' | 'katalog'
type Zahlen = { angehaengt: number; neueReihen: number }
/** `bestandEinzeln`: Paare aus einem allein stehenden Hauptbestandstitel und einer Katalog-Reihe, die aniSearch verbindet (geht nur über eine Änderung des Hauptbestands). */
export type KatalogZahlen = Zahlen & { bestandEinzeln: number }
export type PruefDatei = { stand: string; angehaengt: number; neueReihen: number; katalog?: KatalogZahlen; pruefliste: (Pruefzeile & { quelle?: Quelle })[] }

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

/** Die `getrennt:`-Einträge der Handdatei (Titel-Kennungen); fehlt die Datei, gibt es keine. */
export function ladeTrennungen(datei = `${ROOT}/data/reihen-von-hand.yaml`): Trennung[] {
  const eintraege = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as Array<{ getrennt?: number[] }> | null) ?? []) : []
  return eintraege.flatMap((e) => (e.getrennt ? [e.getrennt] : []))
}

const schluessel = (z: Pruefzeile): string => `${z.art}|${z.reihen.map((r) => r.id).join(',')}`

/**
 * Schreibt den Teil der Prüfliste, der zu `teil` gehört; der andere Teil bleibt, wie er war (beide Stufen laufen im selben Bau, der Katalog später).
 * Ein Fall des Katalogs, der schon aus dem Hauptbestand dasteht (gleiche Reihen), erscheint nicht doppelt. Geschrieben wird nur bei Änderung, damit der Stand nicht täglich committet wird.
 */
function schreibePruefliste(teil: Quelle, zeilen: Pruefzeile[], zahlen: Zahlen, bestandEinzeln = 0): void {
  const alt = readJson<Partial<PruefDatei>>(PRUEFLISTE_DATEI, {})
  const rest = (alt.pruefliste ?? []).filter((z) => (z.quelle ?? 'bestand') !== teil)
  const schon = new Set(rest.map(schluessel))
  const eigene = zeilen.filter((z) => teil === 'bestand' || !schon.has(schluessel(z))).map((z) => ({ ...z, quelle: teil }))
  const neu: PruefDatei = teil === 'bestand'
    ? { stand: todayIso(), angehaengt: zahlen.angehaengt, neueReihen: zahlen.neueReihen, ...(alt.katalog ? { katalog: alt.katalog } : {}), pruefliste: [...eigene, ...rest] }
    : { stand: todayIso(), angehaengt: alt.angehaengt ?? 0, neueReihen: alt.neueReihen ?? 0, katalog: { ...zahlen, bestandEinzeln }, pruefliste: [...rest, ...eigene] }
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...neu, stand: '' })) writeJson(PRUEFLISTE_DATEI, neu, true)
}

/** Verbindungen aus aniSearch-Beziehungen für `03-reihen.ts` (Format von `reihen-von-hand.yaml`); `wurzel`: die Reihe je Titel im Stand des Baus. */
export function anisearchRelationenKanten(titles: Map<number, Title>, wurzel: (id: number) => number, ausgenommen: Set<number>): { ids: number[] }[] {
  try {
    const kennung = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
    const kandidaten = [...titles.values()].map((t) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: kennung.get(t.id) }))
    const { kanten, namen } = ladeBeziehungen()
    const u = uebernimmReihen(kandidaten, kanten, namen, wurzel, ausgenommen, WANDERREGEL, ladeTrennungen())
    schreibePruefliste('bestand', u.pruefliste, u)
    log(`aniSearch-Reihen: ${u.angehaengt} Alleinstehende an Reihen gehängt, ${u.neueReihen} neue Reihen, ${u.pruefliste.length} Fälle auf der Prüfliste (${PRUEFLISTE_DATEI})`)
    return u.kanten
  } catch (e) {
    warn(`aniSearch-Reihen übernehmen übersprungen (Fehler): ${(e as Error).message}`)
    return []
  }
}

export type Ausgeschieden = { katalogWeg: { has(id: number): boolean }; zeilenWeg: { has(id: number): boolean } }

/** Die Titel, die beim Katalog nie umziehen und als Ziel dienen: der ausgelieferte Hauptbestand (aus `titles.json`) und die aus ihm verschobenen Titel, die der Katalog nicht führt. */
export function katalogAnker(eintraege: KatalogEintrag[], bekannt: Map<number, number>, verschoben: Title[], kennung: Map<number, number>, weg: Ausgeschieden): Anker[] {
  const imKatalog = new Set(eintraege.map((e) => e.id))
  const haupt = readJson<Title[]>('public/data/titles.json', []).filter((t) => bekannt.has(t.id))
  const fest = [...haupt.map((t) => ({ t, reihe: bekannt.get(t.id)! })), ...verschoben.filter((t) => !imKatalog.has(t.id) && !weg.zeilenWeg.has(t.id) && !bekannt.has(t.id)).map((t) => ({ t, reihe: t.franchiseId ?? t.id }))]
  return fest.map(({ t, reihe: r }) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: t.anisearchId ?? kennung.get(t.id), reihe: r }))
}

/**
 * Reihen für `ohne-synchro.json` mit aniSearch-Beziehungen (Regel in `anisearch-reihen-katalog.ts`). `reihe`: Reihe je Katalogtitel aus `reihenFuerKatalog`; `bekannt`: Reihe je Hauptbestandstitel;
 * `verschoben`: aus dem Hauptbestand verschobene Titel (die, die der Katalog nicht führt, gelten als fest); `kennung`: aniSearch-Kennung je Katalogtitel. Der Hauptbestand kommt aus der schon
 * geschriebenen `titles.json` (wie bei `ohneWerkDubletten`). Ein Fehler stoppt den Bau nie: dann bleiben die Reihen aus AniList.
 */
export function anisearchKatalogReihen(reihe: Map<number, number>, eintraege: KatalogEintrag[], bekannt: Map<number, number>, verschoben: Title[], kennung: Map<number, number>, weg: Ausgeschieden): Map<number, number> {
  try {
    const anker = katalogAnker(eintraege, bekannt, verschoben, kennung, weg)
    const { kanten, namen } = ladeBeziehungen()
    const u = uebernimmKatalogReihen(eintraege.filter((e) => !weg.katalogWeg.has(e.id)), reihe, anker, kennung, kanten, namen, ladeTrennungen())
    schreibePruefliste('katalog', u.ergebnis.pruefliste, { angehaengt: u.ergebnis.angehaengt, neueReihen: u.ergebnis.neueReihen }, u.bestandEinzeln)
    log(`aniSearch-Reihen im Katalog: ${u.ergebnis.angehaengt} Alleinstehende an Reihen gehängt, ${u.ergebnis.neueReihen} neue Reihen, ${u.ergebnis.pruefliste.length} Fälle auf der Prüfliste, ${u.bestandEinzeln} Paare mit einem allein stehenden Hauptbestandstitel`)
    return u.reihe
  } catch (e) {
    warn(`aniSearch-Reihen im Katalog übersprungen (Fehler): ${(e as Error).message}`)
    return reihe
  }
}
