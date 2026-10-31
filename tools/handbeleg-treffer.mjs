/** Welche Blöcke von `data/dub-confirmed.yaml` gehören zu genau dieser Adresse? (reine Funktion) */

const norm = (u) => String(u).trim().replace(/^https?:\/\/(www\.)?/, '').replace(/#.*$/, '').replace(/\/$/, '')
const ohneQuery = (n) => n.replace(/\?.*$/, '').replace(/\/$/, '')

/** Schlüssel einer Adresse: Plattform-Kennung, bei Suchadressen die ganze Adresse samt Query. */
export function kennung(url) {
  const n = norm(url)
  const gti = /(amzn1\.dv\.gti\.[0-9a-f-]+)/i.exec(n)
  if (gti) return `gti:${gti[1].toLowerCase()}`
  const asin = /\/(?:dp|detail)\/([A-Z0-9]{10})(?:[/?]|$)/.exec(n)
  if (asin) return `asin:${asin[1]}`
  const netflix = /netflix\.com\/(?:[a-z-]+\/)?(?:watch|title)\/(\d+)/.exec(n)
  if (netflix) return `netflix:${netflix[1]}`
  const cr = /crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]+)/.exec(n)
  if (cr) return `cr:${cr[1]}`
  if (/\/(?:s|search)(?:[?/]|$)/.test(n)) return `suche:${n}`
  return `pfad:${ohneQuery(n)}`
}

export function handbelegBloecke(text, url) {
  const ziel = kennung(url)
  return text.split(/\n(?=- )/).filter((block) => {
    const adressen = block.match(/https?:\/\/[^\s'"]+/g) ?? []
    return adressen.some((a) => kennung(a) === ziel)
  })
}
