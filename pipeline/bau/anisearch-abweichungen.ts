import { writeFileSync } from 'node:fs'
import { log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import type { AniListMedia } from '../lib/anilist.ts'
import type { AnisearchEintrag } from './01-quellen.ts'
import { baueTitel } from './02-titel.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'
import { FELDER, type FeldName, type Spalte, type Urteil, anilistSpalte, anisearchSpalte, urteil } from './anisearch-spalte.ts'

/**
 * **Abweichungsliste AniList gegen aniSearch** (`data/anisearch-abweichungen.json`, Stufe B der AniList-Ablösung, 10.10.2026). Je Feld die Zähler
 * gleich / abweichend / nur AniList / nur aniSearch / beide leer; dazu je Feld höchstens 20 Beispiele (beide Werte bzw. Kennungen). Nichts davon
 * wird ausgeliefert: die Seite zeigt weiter den AniList-Wert, die Datei ist Messgrundlage für den Umzug.
 */
export const ABWEICHUNGEN_DATEI = 'data/anisearch-abweichungen.json'
const BEISPIELE = 20

export type FeldBericht = Record<Urteil, number> & {
  abweichungen: [number, unknown, unknown][]
  nurAnilistIds: number[]
  nurAnisearchIds: number[]
}
export type Bericht = {
  stand: string
  /** `verglichen` = Titel mit AniList-Wert und aniSearch-Info; die übrigen erklären, warum ein Titel fehlt. */
  titel: { gesamt: number; verglichen: number; ohneAnisearchEintrag: number; ohneInfo: number; nurAnisearch: number }
  felder: Record<FeldName, FeldBericht>
  /** Namen der Titel, die in einer Liste vorkommen, damit die Kennungen lesbar sind. */
  namen: Record<number, string>
}
export type Paar = { id: number; name: string; anilist: Spalte; anisearch: Spalte }

const leeresFeld = (): FeldBericht => ({ gleich: 0, abweichend: 0, nurAnilist: 0, nurAnisearch: 0, beideLeer: 0, abweichungen: [], nurAnilistIds: [], nurAnisearchIds: [] })

/** Zählt die Paare Feld für Feld aus. */
export function vergleichePaare(paare: Paar[]): Pick<Bericht, 'felder' | 'namen'> {
  const felder = Object.fromEntries(FELDER.map((f) => [f, leeresFeld()])) as Record<FeldName, FeldBericht>
  const namen: Record<number, string> = {}
  for (const p of paare) {
    for (const f of FELDER) {
      const u = urteil(f, p.anilist, p.anisearch)
      const b = felder[f]
      b[u]++
      if (u === 'abweichend') b.abweichungen.push([p.id, p.anilist[f], p.anisearch[f]])
      if (u === 'nurAnilist') b.nurAnilistIds.push(p.id)
      if (u === 'nurAnisearch') b.nurAnisearchIds.push(p.id)
      if (u === 'abweichend' || u === 'nurAnilist' || u === 'nurAnisearch') namen[p.id] = p.name
    }
  }
  return { felder, namen }
}

/** Zähler vollständig, je Liste nur die ersten Beispiele — die Volllisten (469 KB) würden bei jeder Änderung neu committet. */
export function kuerzeBericht(b: Bericht): Bericht {
  const felder = Object.fromEntries(
    FELDER.map((f) => {
      const x = b.felder[f]
      return [f, { ...x, abweichungen: x.abweichungen.slice(0, BEISPIELE), nurAnilistIds: x.nurAnilistIds.slice(0, BEISPIELE), nurAnisearchIds: x.nurAnisearchIds.slice(0, BEISPIELE) }]
    }),
  ) as Record<FeldName, FeldBericht>
  const ids = new Set(FELDER.flatMap((f) => [...felder[f].abweichungen.map((a) => a[0]), ...felder[f].nurAnilistIds, ...felder[f].nurAnisearchIds]))
  return { ...b, felder, namen: Object.fromEntries(Object.entries(b.namen).filter(([id]) => ids.has(Number(id)))) }
}

/** Kennungen, die aniSearchs eigene Brücke (MAL → aniSearch) je aniSearch-Eintrag nennt. */
export function malJeAnisearch(bruecke: Record<string, number>): Map<number, number[]> {
  const m = new Map<number, number[]>()
  for (const [mal, as] of Object.entries(bruecke)) m.set(as, [...(m.get(as) ?? []), Number(mal)])
  return m
}

type Quellen = { titles: Map<number, Title>; byMal: Record<string, AniListMedia>; byAniId: Record<string, AniListMedia>; anisearch: Record<string, AnisearchEintrag> }

/** Titel mit ihren beiden Spalten; die Zähler `titel` sagen, wer aus welchem Grund fehlt. */
export function sammlePaare({ titles, byMal, byAniId, anisearch }: Quellen, mal: Map<number, number[]>): { paare: Paar[]; titel: Bericht['titel'] } {
  const medien = new Map<number, AniListMedia>()
  for (const m of [...Object.values(byMal), ...Object.values(byAniId)]) if (m?.id) medien.set(m.id, m)
  const paare: Paar[] = []
  const titel = { gesamt: titles.size, verglichen: 0, ohneAnisearchEintrag: 0, ohneInfo: 0, nurAnisearch: 0 }
  for (const t of titles.values()) {
    if (t.id >= ANISEARCH_ID_BASIS) titel.nurAnisearch++
    else if (!anisearch[t.id]) titel.ohneAnisearchEintrag++
    else if (!anisearch[t.id]!.info) titel.ohneInfo++
    else {
      const e = anisearch[t.id]!
      paare.push({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anilist: anilistSpalte(t, medien.get(t.id)), anisearch: anisearchSpalte(e, mal.get(e.anisearchId ?? -1)) })
      titel.verglichen++
    }
  }
  return { paare, titel }
}

const zaehlerZeile = (b: Bericht): string =>
  FELDER.map((f) => `${f} ${b.felder[f].gleich}=/${b.felder[f].abweichend}≠/${b.felder[f].nurAnilist}A/${b.felder[f].nurAnisearch}S`).join(' · ')

/** Vergleicht und schreibt die Liste — nur bei Änderung, damit der Stand nicht täglich committet wird. */
function schreibeAnisearchAbweichungen(q: Quellen): void {
  const { paare, titel } = sammlePaare(q, malJeAnisearch(readJson<Record<string, number>>('data/anisearch-mal.json', {})))
  const voll: Bericht = { stand: todayIso(), titel, ...vergleichePaare(paare) }
  // Volllisten nur auf Wunsch und nur lokal: `ANISEARCH_VOLLLISTE=<Pfad außerhalb des Repos>`.
  if (process.env.ANISEARCH_VOLLLISTE) writeFileSync(process.env.ANISEARCH_VOLLLISTE, JSON.stringify(voll))
  const bericht = kuerzeBericht(voll)
  const alt = readJson<Partial<Bericht>>(ABWEICHUNGEN_DATEI, {})
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...bericht, stand: '' })) writeJson(ABWEICHUNGEN_DATEI, bericht)
  log(`aniSearch gegen AniList: ${titel.verglichen} von ${titel.gesamt} Titeln verglichen (${titel.ohneAnisearchEintrag} ohne Eintrag, ${titel.ohneInfo} ohne Info) — ${zaehlerZeile(bericht)} — Liste: ${ABWEICHUNGEN_DATEI}`)
}

let messfehler = 0

/** Bau-Phase `baueTitel` samt anschließender Messung. Die Messung darf den Bau nie stoppen: ein Fehler wird gezählt und gewarnt, der Bau läuft weiter. */
export function baueTitelGemessen(q: Parameters<typeof baueTitel>[0] & Pick<Quellen, 'anisearch'>) {
  const gebaut = baueTitel(q)
  try {
    schreibeAnisearchAbweichungen({ titles: gebaut.titles, byMal: q.byMal, byAniId: q.byAniId, anisearch: q.anisearch })
  } catch (e) {
    warn(`aniSearch-Abweichungsliste übersprungen (Messfehler Nr. ${++messfehler} in diesem Lauf): ${(e as Error).message}`)
  }
  return gebaut
}
