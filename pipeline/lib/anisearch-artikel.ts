/**
 * Liest eine aniSearch-Artikelseite (eine Disc-Ausgabe) in ein kleines Gerüst.
 *
 * Warum: Der Artikel nennt je Ausgabe die **Tonspuren** (`Sprache:` ist Audio, `Untertitel:` getrennt),
 * die EAN und unter „Anime" die enthaltenen Titel mit Typ — auch Specials, die als Bonus auf der
 * Disc liegen. Gemessen in `docs/wissen/poc-anisearch-felder.md`.
 */

export interface EnthaltenerTitel {
  anisearchId: number
  /** „TV-Serie", „OVA", „Bonus", „Film" … wie aniSearch es führt. */
  typ: string
  /** Folgenzahl laut aniSearch; bei „?" nicht gesetzt. */
  folgen?: number
}

export interface Artikel {
  ean?: string
  /** Tonspuren, z. B. `["Deutsch (DTS-HD 2.0)", "Japanisch (DTS-HD 2.0)"]`. Fehlt das Feld, fehlt auch hier die Angabe. */
  audio?: string[]
  untertitel?: string[]
  publisher?: string
  umfang?: string
  medium?: string
  enthalten: EnthaltenerTitel[]
}

const entitaeten = (s: string): string =>
  s.replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()

/** Zerlegt „Deutsch (DTS 5.1), Japanisch" an Kommas außerhalb von Klammern. */
const liste = (s: string): string[] => {
  const out: string[] = []
  let tiefe = 0
  let cur = ''
  for (const z of s) {
    if (z === '(') tiefe++
    if (z === ')') tiefe--
    if (z === ',' && tiefe === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += z
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

/** Wert hinter `<span class="header">Name:</span>` innerhalb eines `shopinfo`-Blocks. */
function feld(html: string, name: string): string | undefined {
  const m = new RegExp(`<span class="header">${name}:</span>([\\s\\S]*?)</div>`).exec(html)
  if (!m) return undefined
  const wert = entitaeten(m[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
  return wert || undefined
}

export function artikelAus(html: string): Artikel | undefined {
  const start = html.indexOf('Produktinformationen')
  if (start < 0) return undefined
  const ende = html.indexOf('Weitere Artikel', start)
  const seg = html.slice(start, ende > 0 ? ende : undefined)
  const ean = /EAN:<\/span>\s*(\d{8,14})/.exec(seg)?.[1]
  const sprache = feld(seg, 'Sprache')
  const untertitel = feld(seg, 'Untertitel')
  const enthalten: EnthaltenerTitel[] = []
  const anime = /<section id="anime">([\s\S]*?)<\/section>/.exec(seg)?.[1] ?? ''
  for (const m of anime.matchAll(/href="anime\/(\d+)[,"][^>]*>[\s\S]*?<span class="date">([^<]*)<\/span>/g)) {
    const typ = /^([^,(]+?)(?:,\s*(\d+|\?\+?)[^(]*)?\s*(?:\(|$)/.exec(entitaeten(m[2]!))
    enthalten.push({
      anisearchId: Number(m[1]),
      typ: typ?.[1]?.trim() ?? entitaeten(m[2]!),
      ...(typ?.[2] && /^\d+$/.test(typ[2]) ? { folgen: Number(typ[2]) } : {}),
    })
  }
  return {
    ...(ean ? { ean } : {}),
    ...(sprache ? { audio: liste(sprache) } : {}),
    ...(untertitel ? { untertitel: liste(untertitel) } : {}),
    ...(feld(seg, 'Publisher') ? { publisher: feld(seg, 'Publisher') } : {}),
    ...(feld(seg, 'Umfang') ? { umfang: feld(seg, 'Umfang') } : {}),
    ...(feld(seg, 'Medium') ? { medium: feld(seg, 'Medium') } : {}),
    enthalten,
  }
}
