import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { ROOT, log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'
import { fuehreReihenZusammen } from './03-reihen.ts'
import { alle, anisearchNamensKanten } from './anisearch-titel.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { type AnisearchTitel, katalogNamen, ladeAnisearchTitel } from './katalog-namen.ts'
import type { Kante, Namen } from './anisearch-reihen.ts'
import { type Ausgeschieden, anisearchKatalogReihen, katalogAnker, ladeBeziehungen } from './anisearch-reihen-pruefliste.ts'
import { type ReinErgebnis, type ReinHand, type ReinTitel, bestandReihenAusAnisearch, katalogReihenAusAnisearch, reineReihen } from './anisearch-reihen-rein.ts'

/**
 * **Anbindung von `REIHEN_QUELLE=anisearch` an den Bau** (Schritt 6 der AniList-Ablösung, 12.10.2026). Hauptbestand und Katalog laufen rein (Rückweg `REIHEN_QUELLE=anilist`); wo der Weg aus ist, rufen die Eintrittspunkte den AniList-Weg.
 * Mit ihm kommen `franchiseId` des Hauptbestands und die Reihen des Katalogs allein aus aniSearch (Regeln in `anisearch-reihen-rein.ts`); `data/reihen-von-hand.yaml` gilt weiter.
 * Die Prüfliste dieses Wegs steht in einer eigenen Datei, damit der Standardweg seine nicht verliert.
 */
export const REIN_PRUEFLISTE_DATEI = `${process.env.PRUEFLISTE_ORDNER ?? 'data'}/anisearch-reihen-rein-pruefliste.json` // PRUEFLISTE_ORDNER: nur Tests

/** `ids:`, `reinIds:` und `getrennt:` der Handdatei; `reinIds:` verbindet wie `ids:`, wird aber nur hier gelesen (der Standardweg kennt diese Teile schon als eine Reihe). */
export function ladeHand(datei = `${ROOT}/data/reihen-von-hand.yaml`): ReinHand {
  const eintraege = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as Array<{ ids?: number[]; reinIds?: number[]; getrennt?: number[] }> | null) ?? []) : []
  return {
    verbinden: eintraege.flatMap((e) => [e.ids, e.reinIds].filter((l): l is number[] => !!l)),
    trennen: eintraege.flatMap((e) => (e.getrennt ? [e.getrennt] : [])),
  }
}

/** Schreibt den Teil `teil` der Prüfliste; der andere bleibt stehen, geschrieben wird nur bei Änderung. */
function schreibePruefliste(teil: 'bestand' | 'katalog', e: ReinErgebnis): void {
  const alt = readJson<Record<string, unknown>>(REIN_PRUEFLISTE_DATEI, {})
  const neu = { ...alt, stand: todayIso(), [teil]: { inReihen: e.inReihen, reihen: e.reihen, pruefliste: e.pruefliste } }
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...neu, stand: '' })) writeJson(REIN_PRUEFLISTE_DATEI, neu, true)
}

/** Die MAL-Kennung eines Titels (sein Feld) und die im aniSearch-Eintrag; die zweite gilt nur als Ersatz und verbindet nur mit Beleg (`malVerbindungen`). */
const malVon = (mal: number | undefined, anisearchId: number | undefined): { mal?: number; malAnisearch?: number } => ({ mal, malAnisearch: anisearchId ? alle()[String(anisearchId)]?.mal : undefined })

/** Was der Hauptbestand-Weg von draußen liest; Prüfungen reichen eigene Quellen durch. */
export type ReinQuellen = {
  beziehungen: () => { kanten: Kante[]; namen: Namen }
  katalog: () => KatalogEintrag[]
  hand: () => ReinHand
  kennungen: typeof anisearchKennungen
  anisearchTitel: () => Record<string, AnisearchTitel>
}
export const STANDARD_QUELLEN: ReinQuellen = {
  beziehungen: ladeBeziehungen,
  katalog: ladeKatalogEintraege,
  hand: () => ladeHand(),
  kennungen: anisearchKennungen,
  anisearchTitel: ladeAnisearchTitel,
}

/** Reihe je Katalogtitel, wie der Katalog-Schritt sie mit dem Stand des Hauptbestands bildet (Vorschau ohne Dubletten und Verschobene: dieser Schritt kommt erst nach `titles.json`). */
function katalogVorschau(titles: Map<number, Title>, eintraege: KatalogEintrag[], q: ReinQuellen): Map<number, number> {
  const haupt = [...titles.values()]
  const kennung = q.kennungen([...eintraege.map((e) => ({ id: e.id, mal: e.mal ?? undefined })), ...haupt.map((t) => ({ id: t.id, mal: t.malId }))])
  const anker = katalogAnker(eintraege, new Map(haupt.map((t) => [t.id, t.franchiseId ?? t.id])), [], kennung, { katalogWeg: new Map(), zeilenWeg: new Set() }, haupt)
  const { kanten, namen } = q.beziehungen()
  return reineKatalogReihen(eintraege, kennung, anker, new Map(), kanten, namen, q.hand()).reihe
}

/**
 * Der Namensvorspann (Daniel, 10.10.2026) ging mit dem Wechsel auf reines aniSearch am 12.10. verloren; `check-reihen-namen-bestand.ts` meldet es seit 16.10.2026.
 * Das Ziel darf ein Katalogtitel sein (Namen wie in `ohne-synchro.json`, Reihe aus der Vorschau), denn `titles.json` steht beim Katalog-Schritt schon; verschoben wird nur ein Titel des Hauptbestands.
 */
function wendeNamensvorspannAn(titles: Map<number, Title>, q: ReinQuellen): void {
  const mit = new Map(titles)
  for (const t of katalogZiele(titles, q)) mit.set(t.id, t)
  for (const { ids: [reihe, id] } of anisearchNamensKanten(mit, (i) => mit.get(i)!.franchiseId ?? i)) titles.get(id!)!.franchiseId = reihe
}

/** Die Katalogtitel als Namensziele; ist der Katalog nicht lesbar, gelten nur die Ziele im Hauptbestand (Warnung statt Abbruch). */
function katalogZiele(titles: Map<number, Title>, q: ReinQuellen): Title[] {
  try {
    const eintraege = q.katalog()
    const vorschau = eintraege.length ? katalogVorschau(titles, eintraege, q) : new Map<number, number>()
    const ausAnisearch = q.anisearchTitel()
    // wie `deutscheReihe` in `13-4-zusatzdateien.ts`: der deutsche Name je Reihenkopf des Hauptbestands
    const deutscheReihe = new Map([...titles.values()].filter((t) => (t.franchiseId ?? t.id) === t.id && t.titleDe).map((t) => [t.id, t.titleDe!]))
    return eintraege.filter((e) => !titles.has(e.id)).map((e) => ({ id: e.id, ...katalogNamen(e, ausAnisearch[String(e.id)], deutscheReihe.get(vorschau.get(e.id) ?? e.id)), franchiseId: vorschau.get(e.id) }) as Title)
  } catch (e) {
    warn(`aniSearch-Reihen (rein): Namensvorspann nur mit Zielen im Hauptbestand, Katalog nicht lesbar: ${(e as Error).message}`)
    return []
  }
}

/** Hauptbestand: `franchiseId` aus aniSearch für jeden Titel (Titel ohne archivierte Seite stehen allein). */
function reinBestandReihen(titles: Map<number, Title>, quellen: ReinQuellen): void {
  const kennung = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  const titel: ReinTitel[] = [...titles.values()].map((t) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: kennung.get(t.id), ...malVon(t.malId, kennung.get(t.id)) }))
  const { kanten, namen } = quellen.beziehungen()
  const e = reineReihen(titel, kanten, namen, quellen.hand())
  for (const t of titles.values()) t.franchiseId = e.reihe.get(t.id) ?? t.id
  schreibePruefliste('bestand', e)
  log(`aniSearch-Reihen (rein): ${e.reihen} Reihen mit ${e.inReihen} Titeln, ${e.pruefliste.length} Fälle auf der Prüfliste (${REIN_PRUEFLISTE_DATEI})`)
  wendeNamensvorspannAn(titles, quellen) // zuletzt: scheitert er, bleiben die Reihen und die Prüfliste stehen
}

type ReihenArgs = Parameters<typeof fuehreReihenZusammen>[0]

/**
 * `fuehreReihenZusammen`, mit dem Schalter aber ohne AniList-Beziehungen (leere Medienlisten) und danach `franchiseId` aus aniSearch.
 * Ein Fehler stoppt den Bau nie: dann bleibt es bei den Reihen ohne AniList-Kanten, und die Warnung nennt den Grund.
 */
export function fuehreReihenZusammenQuelle(args: ReihenArgs, quellen: ReinQuellen = STANDARD_QUELLEN): ReturnType<typeof fuehreReihenZusammen> {
  if (!bestandReihenAusAnisearch()) return fuehreReihenZusammen(args)
  const ergebnis = fuehreReihenZusammen({ ...args, byAniId: {}, byMal: {} })
  try {
    reinBestandReihen(args.titles, quellen)
  } catch (e) {
    warn(`aniSearch-Reihen (rein) übersprungen (Fehler): ${(e as Error).message}`)
  }
  return ergebnis
}

/**
 * AniList-Kanten, die aniSearch nicht ersetzen kann: jede Kante, an der ein Titel ohne aniSearch-Kennung hängt. Ein Crossover (zwei Eltern) verbindet auch hier nichts, weder von sich aus noch als Ziel.
 * Gemessen 13.10.2026: 3.044 Katalogtitel ohne Kennung, davon 1.286 in einer Reihe mit mehreren Titeln; ohne diese Kanten stünden 1.273 allein.
 */
export function anilistKantenOhneKennung(eintraege: KatalogEintrag[], mitKennung: Set<number>, umhaengen: ReadonlyMap<number, number> = new Map()): [number, number][] {
  const crossover = new Set(eintraege.filter((e) => (e.eltern?.length ?? 0) >= 2).map((e) => e.id))
  const ohne = (id: number): boolean => !mitKennung.has(id)
  const dahin = (id: number): number => umhaengen.get(id) ?? id
  return eintraege.flatMap((e) => (crossover.has(e.id) ? [] : (e.rel ?? []).filter((o) => !crossover.has(o) && (ohne(dahin(e.id)) || ohne(dahin(o)))).map((o): [number, number] => [dahin(e.id), dahin(o)])))
}

/**
 * Katalog: Reihe je Eintrag aus aniSearch; der ausgelieferte Hauptbestand (Anker) behält seine Reihe, zwei feste Reihen verschmelzen nie.
 * `katalogWeg`: die ausgeschiedenen Sammeltitel (Katalogkennung → ihre Zeile, `anisearch-dubletten.ts`); sie sind kein Titel mehr, ihre AniList-Kanten gelten für die Zeile.
 */
export function reineKatalogReihen(eintraege: KatalogEintrag[], kennung: Map<number, number>, anker: ReturnType<typeof katalogAnker>, katalogWeg: ReadonlyMap<number, number>, kanten: Kante[], namen: Namen, hand: ReinHand): ReinErgebnis {
  const fest = new Map(anker.map((a) => [a.id, a.reihe]))
  const titel: ReinTitel[] = [
    ...anker.map((a) => ({ id: a.id, name: a.name, anisearchId: a.anisearchId, ...malVon(a.mal, a.anisearchId) })),
    ...eintraege.filter((e) => !katalogWeg.has(e.id) && !fest.has(e.id)).map((e) => ({ id: e.id, name: e.t[0] ?? e.t[1] ?? `#${e.id}`, anisearchId: kennung.get(e.id), ...malVon(e.mal, kennung.get(e.id)) })),
  ]
  const kantenOhne = anilistKantenOhneKennung(eintraege, new Set(titel.filter((t) => t.anisearchId).map((t) => t.id)), katalogWeg)
  return reineReihen(titel, kanten, namen, hand, fest, kantenOhne)
}

function reinKatalogReihen(eintraege: KatalogEintrag[], kennung: Map<number, number>, anker: ReturnType<typeof katalogAnker>, katalogWeg: ReadonlyMap<number, number>, schreibe: (e: ReinErgebnis) => void): Map<number, number> {
  const { kanten, namen } = ladeBeziehungen()
  const e = reineKatalogReihen(eintraege, kennung, anker, katalogWeg, kanten, namen, ladeHand())
  schreibe(e)
  log(`aniSearch-Reihen im Katalog (rein): ${e.reihen} Reihen mit ${e.inReihen} Titeln (mit Hauptbestand), ${e.pruefliste.length} Fälle auf der Prüfliste`)
  return e.reihe
}

/** `anisearchKatalogReihen` mit dem Schalter; gleiche Parameter, damit `nebendateien.ts` nur den Namen wechselt. `schreibe`: die Prüfliste des reinen Wegs (nur Tests tauschen es). */
export function anisearchKatalogReihenQuelle(reihe: Map<number, number>, eintraege: KatalogEintrag[], bekannt: Map<number, number>, verschoben: Title[], kennung: Map<number, number>, weg: Ausgeschieden, schreibe: (e: ReinErgebnis) => void = (e) => schreibePruefliste('katalog', e), hauptbestand?: Title[]): Map<number, number> {
  if (!katalogReihenAusAnisearch()) return anisearchKatalogReihen(reihe, eintraege, bekannt, verschoben, kennung, weg, undefined, hauptbestand)
  try {
    const anker = katalogAnker(eintraege, bekannt, verschoben, kennung, weg, hauptbestand)
    return reinKatalogReihen(eintraege, kennung, anker, weg.katalogWeg, schreibe)
  } catch (e) {
    warn(`aniSearch-Reihen im Katalog (rein) übersprungen (Fehler): ${(e as Error).message}`)
    return reihe
  }
}
