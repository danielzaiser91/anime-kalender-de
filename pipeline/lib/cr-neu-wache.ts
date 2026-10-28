/**
 * **Jede neue deutsche Crunchyroll-Folge braucht binnen 10 Tagen einen Termin im Kalender.**
 *
 * Anlass (25.10.2026): Vier von 38 deutschen Folgen der letzten 14 Tage fehlten (Last Boss S2,
 * Apothekerin S3, Aristocrat S3) — der Bau hatte sie still verworfen. `data/crunchyroll-neu.json`
 * führt jede neue Folge mit `verfuegbarAb`; hängt ihre Serie an einem unserer Titel, muss in den
 * Terminen derselben Franchise ein Crunchyroll-Termin am selben Tag (±1, Europe/Berlin) stehen.
 */
import type { ReleaseEvent, Title } from '../../shared/types.ts'
import { diffDays, toIsoDate } from '../../shared/time.ts'
import { HERABGESTUFT } from './bestand-warnzeile.ts'

export interface NeueFolge {
  serieId: string
  serie?: string
  staffel?: string
  nummer?: number
  verfuegbarAb?: string
}

export interface FehlendeFolge {
  titel: string
  folge: string
  tag: string
  ids: number[]
}

/** Nur Folgen, die 1 bis 10 Tage zurückliegen: heute kann der Bau noch aufholen, ältere sind Altlast. */
const MIN_TAGE = 1
const MAX_TAGE = 10

function crSerienKennung(url: string): string | undefined {
  return /crunchyroll\.com\/(?:[a-z]{2}\/)?series\/([A-Z0-9]+)/.exec(url)?.[1]
}

export function fehlendeCrFolgen(
  folgen: NeueFolge[],
  titles: Title[],
  events: Pick<ReleaseEvent, 'platform' | 'titleId' | 'date'>[],
  heute: string,
): FehlendeFolge[] {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const reihe = (t: Title) => t.franchiseId ?? t.id
  const crTermine = events.filter((e) => e.platform === 'crunchyroll')
  const raus: FehlendeFolge[] = []
  for (const f of folgen) {
    const zeit = f.verfuegbarAb ? new Date(f.verfuegbarAb) : null
    if (!zeit || Number.isNaN(zeit.getTime())) continue
    const tag = toIsoDate(zeit)
    const alter = diffDays(tag, heute)
    if (alter < MIN_TAGE || alter > MAX_TAGE) continue
    const unsere = titles.filter((t) =>
      t.streams.some((s) => s.platform === 'crunchyroll' && crSerienKennung(s.url) === f.serieId),
    )
    if (!unsere.length) continue
    const reihen = new Set(unsere.map(reihe))
    const gefunden = crTermine.some((e) => {
      const t = nachId.get(e.titleId)
      return t !== undefined && reihen.has(reihe(t)) && Math.abs(diffDays(tag, e.date)) <= 1
    })
    if (gefunden) continue
    raus.push({
      titel: unsere[0]!.titleEn ?? unsere[0]!.titleRomaji ?? String(unsere[0]!.id),
      folge: `${f.staffel ?? '?'} Folge ${f.nummer ?? '?'}`,
      tag,
      ids: unsere.map((t) => t.id),
    })
  }
  return raus
}

export interface UnbekannteSerie {
  serieId: string
  serie: string
  folgen: number
}

/**
 * Eine Zeile für `check:bestand`. Die Marke bringt sie einmal je Wortlaut in den Posteingang (`tools/bestand-warnung-melden.mjs`);
 * ein bloßes Lauf-Log läse niemand. Serien ohne Titel sind Handarbeit: der Katalog liefert keinen Sendetakt für eine Neuanlage.
 */
export function serienWarnzeile(serien: UnbekannteSerie[]): string {
  const liste = serien.map((s) => `${s.serie} (${s.serieId}, ${s.folgen})`).join('; ')
  return `⚠ WARNUNG ${HERABGESTUFT} Crunchyroll-Serien ohne Titel: ${serien.length} Serien mit neuer deutscher Folge: ${liste}`
}

/**
 * Serien mit neuer deutscher Folge der letzten 1 bis 10 Tage, zu denen wir keinen Titel haben. `fehlendeCrFolgen` und der
 * `--nur-neu`-Lauf übergehen sie, weil sie keine Adresse haben, an der man ansetzen könnte; hier werden sie gezählt und genannt.
 */
export function unbekannteCrSerien(folgen: NeueFolge[], titles: Title[], heute: string): UnbekannteSerie[] {
  const bekannt = new Set(
    titles.flatMap((t) => t.streams.filter((s) => s.platform === 'crunchyroll').map((s) => crSerienKennung(s.url))),
  )
  const nachId = new Map<string, UnbekannteSerie>()
  for (const f of folgen) {
    const zeit = f.verfuegbarAb ? new Date(f.verfuegbarAb) : null
    if (!zeit || Number.isNaN(zeit.getTime())) continue
    const alter = diffDays(toIsoDate(zeit), heute)
    if (alter < MIN_TAGE || alter > MAX_TAGE || bekannt.has(f.serieId)) continue
    const e = nachId.get(f.serieId) ?? { serieId: f.serieId, serie: f.serie ?? f.serieId, folgen: 0 }
    e.folgen++
    nachId.set(f.serieId, e)
  }
  return [...nachId.values()]
}
