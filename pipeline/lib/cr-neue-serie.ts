import type { Title } from '../../shared/types.ts'
import { wegVerneint } from './dub-confirmed.ts'
import type { NeueFolge } from './cr-neu-wache.ts'

/** Eine Folge aus `data/crunchyroll-neu.json` samt Staffelkennung. */
export type NeueSerienFolge = NeueFolge & { staffelId?: string; ausstrahlung?: string }

/** Serienkennung einer Crunchyroll-Adresse, mit und ohne „www.“ und Sprachpfad. */
function serienKennung(url: string): string | undefined {
  return /^https?:\/\/(?:www\.)?crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]+)/i.exec(url)?.[1]
}

/** Jahr der frühesten Ausstrahlung der gefundenen Folgen (Katalogangabe, sonst Verfügbarkeit). */
function folgenJahr(liste: NeueSerienFolge[]): number | undefined {
  const tage = liste.map((f) => f.ausstrahlung ?? f.verfuegbarAb).filter((d): d is string => !!d).sort()
  return tage.length ? Number(tage[0]!.slice(0, 4)) : undefined
}

export interface NeueSerieAusgang {
  /** Serienkennung → Titel, dem der Weg angelegt wurde. */
  zugeordnet: { serieId: string; titelId: number }[]
  /** Serien, die nicht eindeutig zuzuordnen waren, samt Grund (benannt, nie still verworfen). */
  offen: { serieId: string; serie: string; grund: string }[]
}

const norm = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function namen(t: Title): Set<string> {
  return new Set([t.titleEn, t.titleRomaji, t.titleDe].filter((n): n is string => !!n).map(norm))
}

/** Deutsche Folgennummern als zusammenhängende Bereiche. */
function bereiche(nummern: number[]): { from: number; to: number; dub: boolean }[] {
  const raus: { from: number; to: number; dub: boolean }[] = []
  for (const n of [...new Set(nummern)].sort((a, b) => a - b)) {
    const letzter = raus[raus.length - 1]
    if (letzter && n === letzter.to + 1) letzter.to = n
    else raus.push({ from: n, to: n, dub: true })
  }
  return raus
}

/**
 * Eine Crunchyroll-Serie mit neuer deutscher Folge (`crunchyroll-neu.json`), an deren Kennung noch kein Titel hängt, bekommt
 * ihren Weg mit `dub: true` am Titel gleichen Namens. Anlass 28.10.2026: Magic Knight Rayearth (2026) stand als Ankündigung
 * ohne Stream im Bestand; ohne Adresse las der Dub-Sammler die Serie nie, deutsche Folge 1 blieb ohne Weg und Synchro.
 * Eng: Name gleich (nach Normalisierung), genau ein Kandidat, der noch keinen Crunchyroll-Weg hat, nur eine Staffel in den Funden.
 * Die Bereiche sind die gefundenen deutschen Folgen — nicht mehr, als der Katalog belegt.
 */
export function ordneNeueSerienZu({ folgen, titles, nachUrl, handNein }: {
  folgen: NeueSerienFolge[]
  titles: Iterable<Title>
  nachUrl: Map<string, Title[]>
  handNein: ReadonlySet<string>
}): NeueSerieAusgang {
  const alle = [...titles]
  const bekannt = new Set(alle.flatMap((t) => t.streams.filter((s) => s.platform === 'crunchyroll').map((s) => serienKennung(s.url))))
  const jeSerie = new Map<string, NeueSerienFolge[]>()
  for (const f of folgen) if (f.serieId && !bekannt.has(f.serieId)) jeSerie.set(f.serieId, [...(jeSerie.get(f.serieId) ?? []), f])
  const aus: NeueSerieAusgang = { zugeordnet: [], offen: [] }
  for (const [serieId, liste] of jeSerie) {
    const serie = liste[0]!.serie ?? serieId
    const offen = (grund: string) => void aus.offen.push({ serieId, serie, grund })
    if (new Set(liste.map((f) => f.staffelId)).size > 1) {
      offen('Funde aus mehreren Staffeln')
      continue
    }
    const passend = alle.filter((t) => !t.streams.some((s) => s.platform === 'crunchyroll' && serienKennung(s.url)) && namen(t).has(norm(serie)))
    if (passend.length !== 1) {
      offen(passend.length ? `${passend.length} Titel gleichen Namens` : 'kein Titel gleichen Namens')
      continue
    }
    const t = passend[0]!
    const jahr = folgenJahr(liste)
    if (t.jpYear !== undefined && jahr !== undefined && Math.abs(t.jpYear - jahr) > 1) {
      offen(`Jahr passt nicht (Titel ${t.jpYear}, Folgen ${jahr})`)
      continue
    }
    const url = `https://www.crunchyroll.com/de/series/${serieId}`
    if (wegVerneint(handNein, t.id, 'crunchyroll', url)) continue
    const ranges = bereiche(liste.map((f) => Number(f.nummer)).filter((n) => Number.isFinite(n) && n >= 1))
    t.streams.push({ platform: 'crunchyroll', url, dub: true, ...(ranges.length ? { dubRanges: ranges } : {}) })
    nachUrl.set(url, [...(nachUrl.get(url) ?? []), t])
    aus.zugeordnet.push({ serieId, titelId: t.id })
  }
  return aus
}

/** Logzeilen des Bau-Schritts: eine für die Zuordnung, eine benannte für alles, was offen blieb. */
export function neueSerienZeilen(aus: NeueSerieAusgang): string[] {
  const zeilen: string[] = []
  if (aus.zugeordnet.length) zeilen.push(`${aus.zugeordnet.length} neue Crunchyroll-Serien mit deutscher Folge ihrem Titel zugeordnet (${aus.zugeordnet.map((z) => `${z.serieId} → ${z.titelId}`).join(', ')})`)
  if (aus.offen.length) zeilen.push(`${aus.offen.length} neue Crunchyroll-Serien mit deutscher Folge ohne eindeutigen Titel: ${aus.offen.map((o) => `${o.serie} (${o.serieId}, ${o.grund})`).join('; ')}`)
  return zeilen
}
