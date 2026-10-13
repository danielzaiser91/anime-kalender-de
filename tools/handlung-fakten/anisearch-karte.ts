/** Fakten aus einer archivierten aniSearch-Seite (`data/anisearch-raw`, nie Netz): Format, Studio, Genres, Tags, Figuren, Beziehungen und vorhandene Beschreibungen. */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { decode } from '../../pipeline/lib/anisearch-handlung.ts'
import { ARCHIV_SEITEN, parseRelationen } from '../../pipeline/lib/anisearch-relationen.ts'

export interface AnisearchFakten {
  id: number
  titel: string
  info: Record<string, string>
  hauptgenres: string[]
  nebengenres: string[]
  tags: string[]
  figuren: string[]
  beziehungen: string[]
  /** Beschreibungen je Sprache, Mitmach-Aufruf („Du kennst diesen Anime …“) und Quellenzeilen entfernt. */
  beschreibungen: { sprache: string; text: string }[]
}

const text = (h: string) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const bereich = (html: string, id: string) => new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`).exec(html)?.[1] ?? ''
const INFO_FELDER: [string, string][] = [
  ['type', 'Typ'],
  ['status', 'Status'],
  ['released', 'Veröffentlicht'],
  ['company', 'Studio'],
  ['creators', 'Staff'],
]

function infoFelder(html: string): Record<string, string> {
  const kasten = bereich(html, 'information')
  const raus: Record<string, string> = {}
  for (const [klasse, name] of INFO_FELDER) {
    const roh = new RegExp(`<div class="${klasse}">([\\s\\S]*?)</div>`).exec(kasten)?.[1]
    const wert = roh && text(roh.replace(/<span class="header">[\s\S]*?<\/span>/, ''))
    if (wert) raus[name] = wert.slice(0, 400)
  }
  return raus
}

function tagListe(html: string, klasse: 'gg' | 'gc' | 'gt'): string[] {
  const gt = bereich(html, 'genres-tags')
  const namen = [...gt.matchAll(new RegExp(`class="${klasse} showpop"[^>]*>([^<]*)<`, 'g'))].map((m) => text(m[1]!))
  return [...new Set(namen)]
}

/** Die Beschreibungen der Seite; ein reiner Aufruf zum Mitschreiben und die Quellenzeile zählen nicht. */
function beschreibungen(html: string): { sprache: string; text: string }[] {
  const raus: { sprache: string; text: string }[] = []
  for (const m of bereich(html, 'description').matchAll(/<div lang="([a-z]+)"[^>]*class="textblock[^"]*"[^>]*>([\s\S]*?)<\/div>/g)) {
    const roh = m[2]!.replace(/<br\s*\/?>/gi, '\n').replace(/<span class="source">[\s\S]*$/i, '').replace(/<i class="hidden">[\s\S]*$/i, '')
    const t = decode(roh.replace(/<[^>]+>/g, '')).replace(/Source:[\s\S]*$/i, '').trim()
    if (t.length > 40 && !/unterstütze aniSearch|add a short description|Du kennst diesen Anime/i.test(t)) raus.push({ sprache: m[1]!, text: t })
  }
  return raus
}

export function leseFakten(html: string, id: number): AnisearchFakten {
  const figuren = [...bereich(html, 'characters').matchAll(/class="title">([^<]*)</g)].map((m) => text(m[1]!))
  return {
    id,
    titel: text(/<title>([^<]*)/.exec(html)?.[1] ?? ''),
    info: infoFelder(html),
    hauptgenres: tagListe(html, 'gg'),
    nebengenres: tagListe(html, 'gc'),
    tags: tagListe(html, 'gt'),
    figuren: figuren.slice(0, 8),
    beziehungen: parseRelationen(html).map((r) => `${r.art}: ${r.name} (${r.medium})`).slice(0, 8),
    beschreibungen: beschreibungen(html),
  }
}

/** `undefined`, wenn die Seite nicht im Archiv liegt. */
export function ladeFakten(id: number, dir = ARCHIV_SEITEN): AnisearchFakten | undefined {
  const pfad = `${dir}/${id}.html.gz`
  if (!existsSync(pfad)) return undefined
  return leseFakten(gunzipSync(readFileSync(pfad)).toString('utf8'), id)
}
