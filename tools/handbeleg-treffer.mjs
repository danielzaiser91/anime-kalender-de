/** Welche Blöcke von `data/dub-confirmed.yaml` gehören zu genau dieser Adresse? (reine Funktion) */

const norm = (u) => String(u).trim().replace(/^https?:\/\/(www\.)?/, '').replace(/#.*$/, '').replace(/\/$/, '')
const asin = (u) => /\/(?:dp|detail)\/([A-Z0-9]{10})(?:[/?]|$)/.exec(u)?.[1] ?? null

/** Treffer = gleiche Adresse samt Query (Suchadressen bleiben eigen) oder gleiche Amazon-Kennung. */
export function handbelegBloecke(text, url) {
  const ziel = norm(url)
  const zielAsin = asin(ziel)
  return text.split(/\n(?=- )/).filter((block) => {
    const adressen = block.match(/https?:\/\/[^\s'"]+/g) ?? []
    return adressen.some((a) => norm(a) === ziel || (zielAsin !== null && asin(norm(a)) === zielAsin))
  })
}
