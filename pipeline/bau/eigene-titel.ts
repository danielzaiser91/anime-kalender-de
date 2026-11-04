import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { PLATFORMS, type Title } from '../../shared/types.ts'
import { EIGENE_ID_BASIS, EIGENE_ID_ENDE, istEigenerTitel } from '../../shared/eigene-titel.ts'
import { ROOT, log, slugify } from '../lib/util.ts'

/**
 * **Titel aus einer belegten Ankündigung, die kein AniList-Eintrag trägt** (`data/eigene-titel.yaml`, Daniel 04.11.2026).
 * Der Titel entsteht aus der Handzeile; Termin und Anbieter kommen wie bei jedem Titel aus der Meldung (`releasesAus`, Phase 08),
 * weil er dann unter genau seinem Namen gefunden wird. Keine Uhrzeit, keine Folgenzahl, kein Cover: was die Quelle nicht sagt, steht nicht da.
 */
export interface EigenerEintrag {
  nr: number
  name: string
  format: string
  anbieter: string[]
  tag: string
  sources: string[]
  zitat: string
  zuId?: number
  widerrufen?: string
}

const FORMATE = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL']

/** Prüft eine Zeile der Handdatei; ein Fehler bricht den Bau ab, statt einen halben Titel zu zeigen. */
function pruefeZeile(e: Partial<EigenerEintrag>, i: number, gesehen: Set<number>): EigenerEintrag {
  const wo = `data/eigene-titel.yaml, Zeile ${i + 1} (${e?.name ?? '?'})`
  if (!Number.isInteger(e?.nr) || e.nr! < 1 || e.nr! >= EIGENE_ID_ENDE - EIGENE_ID_BASIS) throw new Error(`${wo}: nr fehlt oder liegt außerhalb`)
  if (gesehen.has(e.nr!)) throw new Error(`${wo}: nr ${e.nr} steht doppelt`)
  gesehen.add(e.nr!)
  if (!e.name?.trim()) throw new Error(`${wo}: name fehlt`)
  if (!FORMATE.includes(String(e.format))) throw new Error(`${wo}: format muss eines von ${FORMATE.join(', ')} sein`)
  if (!Array.isArray(e.anbieter) || e.anbieter.some((a) => !(a in PLATFORMS))) throw new Error(`${wo}: anbieter fehlt oder nennt eine unbekannte Plattform`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.tag))) throw new Error(`${wo}: tag ist kein JJJJ-MM-TT`)
  if (!Array.isArray(e.sources) || !e.sources.length || e.sources.some((q) => !/^https:\/\//.test(String(q)))) throw new Error(`${wo}: sources fehlen oder sind keine Adressen`)
  if (!e.zitat?.trim()) throw new Error(`${wo}: zitat fehlt`)
  if (e.zuId !== undefined && !Number.isInteger(e.zuId)) throw new Error(`${wo}: zuId ist keine Kennung`)
  return e as EigenerEintrag
}

export function ladeEigeneTitel(wurzel: string = ROOT): EigenerEintrag[] {
  const datei = resolve(wurzel, 'data/eigene-titel.yaml')
  if (!existsSync(datei)) return []
  const roh = (yaml.load(readFileSync(datei, 'utf8')) ?? []) as (Omit<Partial<EigenerEintrag>, 'tag'> & { tag?: string | Date })[]
  const gesehen = new Set<number>()
  /* YAML liest ein unquotiertes Datum als Zeitpunkt (UTC-Mitternacht): zurück auf den Tag. */
  return roh.map((e, i) => pruefeZeile({ ...e, tag: e.tag instanceof Date ? e.tag.toISOString().slice(0, 10) : e.tag }, i, gesehen))
}

export const eigeneId = (nr: number): number => EIGENE_ID_BASIS + nr

/** Der Titel einer Zeile: nur, was die Zeile belegt. `dubConfidence: normal` wie bei einer angekündigten deutschen Fassung. */
export function titelAusEintrag(e: EigenerEintrag): Title {
  const id = eigeneId(e.nr)
  return {
    id,
    slug: `${slugify(e.name)}-${id}`,
    titleDe: e.name,
    format: e.format,
    genres: [],
    keywords: [],
    studios: [],
    dubConfidence: 'normal',
    streams: [],
  } as Title
}

/** Legt die Titel der Handdatei an (ohne widerrufene). Gibt zurück, wie viele es sind. */
export function ergaenzeEigeneTitel(titles: Map<number, Title>, eintraege: EigenerEintrag[] = ladeEigeneTitel()): number {
  let neu = 0
  for (const e of eintraege) {
    if (e.widerrufen) continue
    titles.set(eigeneId(e.nr), titelAusEintrag(e))
    neu++
  }
  if (neu) log(`${neu} eigene Titel aus belegter Ankündigung ergänzt: ${eintraege.filter((e) => !e.widerrufen).map((e) => e.name).join(', ')}`)
  return neu
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const klasse = (f: string | null | undefined): string => (f === 'TV_SHORT' || f === 'ONA' ? 'TV' : f ?? '?')

type KatalogNah = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji' | 'format'>

/**
 * **„Katalog führt jetzt X“** (Vorbild `gleichesWerk`, `anisearch-dubletten.ts`): Zeilen der Handdatei ohne `zuId`, deren Name (normalisiert)
 * und Formatklasse ein Titel trägt, der kein eigener ist. Kein Auto-Zusammenführen: der Mensch setzt `zuId` oder widerruft.
 * Gibt je Fund eine Zeile zurück, sonst leer.
 */
export function katalogFuehrtJetzt(eintraege: EigenerEintrag[], titel: KatalogNah[]): string[] {
  const raus: string[] = []
  for (const e of eintraege) {
    if (e.zuId || e.widerrufen) continue
    const treffer = titel.filter((t) => !istEigenerTitel(t.id) && klasse(t.format) === klasse(e.format) && [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && norm(n) === norm(e.name)))
    for (const t of treffer) raus.push(`Katalog führt jetzt „${e.name}“ (Titel ${t.id}); eigene Zeile ${e.nr} in data/eigene-titel.yaml: zuId: ${t.id} setzen oder widerrufen`)
  }
  return raus
}
