import type { Title } from '../../shared/types.ts'
import { deutscheFolgenNachDemEnde, type CrDubData, type CrStaffel } from './crunchyroll-dub.ts'
import { kennungAusZiel } from './crunchyroll-api.ts'
import { frischesteSerieJeKennung } from './cr-block-standardname.ts'
import { titelStaffelNr, zerlege } from './cr-staffel-nummer.ts'
import { wegVerneint } from './dub-confirmed.ts'

/** Blockname, der nur eine Staffelnummer ab 2 trägt („Staffel 2“, „Season 3“). */
function folgestaffelNr(block: CrStaffel): number | null {
  const z = zerlege(block.name ?? '')
  return z.nr !== null && z.nr >= 2 && z.kern === '' ? z.nr : null
}

/**
 * Deutscher Block „Staffel N“ (N ≥ 2) einer Crunchyroll-Serie gehört dem einen TV-Titel derselben Reihe mit Staffelnummer N,
 * der noch keinen Crunchyroll-Weg hat. Anlass 28.10.2026: The Detective Is Already Dead Staffel 2 (152677) lief deutsch, blieb aber
 * „nur Untertitel“, weil die Adresse nur an Staffel 1 hing und die laufende Staffel (4 von 13 Folgen) keine der Block-Regeln erfüllt.
 * Eng: genau ein Kandidat, kein Titel der Adresse trägt die Nummer schon, deutsche Folge liegt nicht hinter dem Ende des Titels,
 * der Block hat nicht mehr Folgen als der Titel.
 */
export function folgestaffelTitel(block: CrStaffel, gruppe: Title[], titles: Iterable<Title>): Title | null {
  const nr = folgestaffelNr(block)
  if (nr === null || !(block.deutscheFolgen?.length ?? block.deutsch ?? 0)) return null
  if (gruppe.some((t) => t.format === 'TV' && titelStaffelNr(t) === nr)) return null
  const reihen = new Set(gruppe.map((t) => t.franchiseId ?? t.id))
  const passend = [...titles].filter(
    (t) =>
      t.format === 'TV' &&
      reihen.has(t.franchiseId ?? t.id) &&
      titelStaffelNr(t) === nr &&
      !t.streams.some((s) => s.platform === 'crunchyroll'),
  )
  if (passend.length !== 1) return null
  const t = passend[0]!
  if (!t.episodes || (block.folgen ?? 0) > t.episodes) return null
  if (deutscheFolgenNachDemEnde([block], t.episodes)) return null
  return t
}

/** Deutsche Folgennummern des Blocks als zusammenhängende Bereiche. */
function bereiche(block: CrStaffel): { from: number; to: number; dub: boolean }[] {
  const nummern = [...new Set((block.deutscheFolgen ?? []).map((f) => Number(f.nummer)).filter((n) => Number.isFinite(n) && n >= 1))].sort((a, b) => a - b)
  const raus: { from: number; to: number; dub: boolean }[] = []
  for (const n of nummern) {
    const letzter = raus[raus.length - 1]
    if (letzter && n === letzter.to + 1) letzter.to = n
    else raus.push({ from: n, to: n, dub: true })
  }
  return raus
}

/** Legt dem Folgestaffel-Titel den Crunchyroll-Weg der Serie mit `dub: true` an. Gibt die Titelnummern zurück. */
export function ordneFolgestaffelBloeckeZu({ crDub, nachUrl, titles, handNein }: {
  crDub: CrDubData
  nachUrl: Map<string, Title[]>
  titles: Map<number, Title>
  handNein: ReadonlySet<string>
}): number[] {
  const gesetzt: number[] = []
  for (const [kennung, serie] of frischesteSerieJeKennung(crDub)) {
    const adressen = new Set(crDub.serien.filter((s) => s.seriesId === kennung).map((s) => s.url))
    const gruppe = new Map<number, Title>()
    for (const [url, ts] of nachUrl) if (adressen.has(url) || kennungAusZiel(url) === kennung) for (const t of ts) gruppe.set(t.id, t)
    for (const block of serie.staffeln ?? []) {
      const t = folgestaffelTitel(block, [...gruppe.values()], titles.values())
      if (!t || wegVerneint(handNein, t.id, 'crunchyroll', serie.url)) continue
      const ranges = bereiche(block)
      const voll = ranges.length === 1 && ranges[0]!.from === 1 && ranges[0]!.to === t.episodes
      t.streams.push({ platform: 'crunchyroll', url: serie.url, dub: true, ...(ranges.length && !voll ? { dubRanges: ranges } : {}) })
      nachUrl.set(serie.url, [...(nachUrl.get(serie.url) ?? []), t])
      gesetzt.push(t.id)
    }
  }
  return gesetzt
}
