import type { Title } from '../../shared/types.ts'
import type { CrSerie } from './crunchyroll-dub.ts'
import { wegVerneint } from './dub-confirmed.ts'
import type { NeueFolge } from './cr-neu-wache.ts'

/** Eine Folge aus `data/crunchyroll-neu.json` samt Staffelkennung. */
export type NeueSerienFolge = NeueFolge & { staffelId?: string; ausstrahlung?: string; guid?: string; gesehenAm?: string }

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
  /** Serienseiten aus den Katalogfolgen für die Termin-Ableitung. */
  seiten: CrSerie[]
}

const norm = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function namen(t: Title): Set<string> {
  return new Set([t.titleEn, t.titleRomaji, t.titleDe].filter((n): n is string => !!n).map(norm))
}

/**
 * Der Serienweg ersetzt Crunchyroll-Adressen ohne Serienkennung (Folgen-Link `/watch/…`, z. B. aus JustWatch) an derselben Stelle:
 * ein Folgen-Link neben der Serienseite wäre ein zweiter Anbieter ohne Tonangabe (The Vermilion Mask, 01.11.2026).
 */
function setzeSerienWeg(t: Title, weg: Title['streams'][number]): void {
  const rest = t.streams.filter((s) => s.platform !== 'crunchyroll' || serienKennung(s.url))
  const stelle = t.streams.findIndex((s) => s.platform === 'crunchyroll' && !serienKennung(s.url))
  t.streams = stelle < 0 ? [...rest, weg] : [...rest.slice(0, stelle), weg, ...rest.slice(stelle)]
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
export function ordneNeueSerienZu({ folgen, titles, nachUrl, handNein, gelesen = new Set() }: {
  folgen: NeueSerienFolge[]
  titles: Iterable<Title>
  nachUrl: Map<string, Title[]>
  handNein: ReadonlySet<string>
  /** Adressen der Serien, die der Dub-Sammler schon gelesen hat. */
  gelesen?: ReadonlySet<string>
}): NeueSerieAusgang {
  const alle = [...titles]
  const bekannt = new Set(alle.flatMap((t) => t.streams.filter((s) => s.platform === 'crunchyroll').map((s) => serienKennung(s.url))))
  const jeSerie = new Map<string, NeueSerienFolge[]>()
  for (const f of folgen) if (f.serieId && !bekannt.has(f.serieId)) jeSerie.set(f.serieId, [...(jeSerie.get(f.serieId) ?? []), f])
  const aus: NeueSerieAusgang = { zugeordnet: [], offen: [], seiten: [] }
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
    setzeSerienWeg(t, { platform: 'crunchyroll', url, dub: true, ...(ranges.length ? { dubRanges: ranges } : {}) })
    nachUrl.set(url, [...(nachUrl.get(url) ?? []), t])
    aus.zugeordnet.push({ serieId, titelId: t.id })
  }
  aus.seiten = seitenAusNeuenFolgen({ folgen, zugeordnet: aus.zugeordnet, gelesen })
  return aus
}

/** Logzeilen des Bau-Schritts: eine für die Zuordnung, eine benannte für alles, was offen blieb. */
export function neueSerienZeilen(aus: NeueSerieAusgang): string[] {
  const zeilen: string[] = []
  if (aus.zugeordnet.length) zeilen.push(`${aus.zugeordnet.length} neue Crunchyroll-Serien mit deutscher Folge ihrem Titel zugeordnet (${aus.zugeordnet.map((z) => `${z.serieId} → ${z.titelId}`).join(', ')})`)
  if (aus.offen.length) zeilen.push(`${aus.offen.length} neue Crunchyroll-Serien mit deutscher Folge ohne eindeutigen Titel: ${aus.offen.map((o) => `${o.serie} (${o.serieId}, ${o.grund})`).join('; ')}`)
  return zeilen
}

/**
 * Serienseite aus den gefundenen deutschen Folgen für jede zugeordnete Serie, die der Dub-Sammler noch nie gelesen hat.
 * Ohne sie bliebe der neue Weg bis zum nächsten Sammler-Lauf ohne Termin und der Titel unter „Kommt noch“ (The Vermilion Mask,
 * 31.10.2026). Der Termin kommt aus `verfuegbarAb` der Katalogfolge; die Ableitung selbst bleibt die vorhandene (`alleTermine`).
 */
export function seitenAusNeuenFolgen({ folgen, zugeordnet, gelesen }: {
  folgen: NeueSerienFolge[]
  zugeordnet: NeueSerieAusgang['zugeordnet']
  gelesen: ReadonlySet<string>
}): CrSerie[] {
  const seiten: CrSerie[] = []
  for (const { serieId } of zugeordnet) {
    const url = `https://www.crunchyroll.com/de/series/${serieId}`
    const liste = folgen.filter((f) => f.serieId === serieId && f.verfuegbarAb)
    if (gelesen.has(url) || !liste.length) continue
    const nummern = new Set(liste.map((f) => f.nummer))
    seiten.push({
      url,
      seriesId: serieId,
      quelle: 'api',
      katalog: 'de',
      deutschImAngebot: true,
      geprueftAm: liste[0]!.gesehenAm ?? liste[0]!.verfuegbarAb!.slice(0, 10),
      staffeln: [{
        name: liste[0]!.staffel ?? '',
        folgen: nummern.size,
        kacheln: liste.length,
        deutsch: nummern.size,
        fremd: 0,
        ...(liste[0]!.staffelId ? { staffelId: liste[0]!.staffelId } : {}),
        deutscheFassung: true,
        deutscheFolgen: liste.map((f) => ({ ...(f.nummer !== undefined ? { nummer: Number(f.nummer) } : {}), guid: f.guid ?? '', verfuegbarAb: f.verfuegbarAb })),
      }],
    })
  }
  return seiten
}
