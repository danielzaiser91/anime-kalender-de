/**
 * Namen aus den aniSearch-Sprecherseiten lesbar machen (Stufe D der AniList-Ablösung).
 *
 * aniSearch schreibt den Familiennamen groß („Gerrit SCHMIDT-FOSS", „Erwin SMITH") und verliert dabei
 * ß und teils Akzente. Zuerst wird gegen eine Schreibweise gelöst, die der Bestand schon führt (AniList,
 * ANN: „Gerrit Schmidt-Foß"); nur ohne Treffer greift die Regel. Eine Regel allein trifft nur rund 92 %
 * der gleichen Paare (gemessen 10.10.2026); beim Bau 11.10.2026 mussten nur 3.019 von 58.763 Namen nach Regel gebildet werden (`docs/wissen/quellen.md`).
 */

const PARTIKEL = new Set(['von', 'van', 'der', 'den', 'de', 'di', 'da', 'du', 'la', 'le', 'zu', 'zur', 'vom', 'ten', 'ter', 'el', 'al'])

/** Klein, ohne Akzente und Umlaute, ß = ss, alles außer Buchstaben und Ziffern wird Trenner. */
export function falte(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Gleiche Person trotz anderer Schreibung: erstes und letztes Namenswort, gefaltet. */
export function sprecherSchluessel(name: string): string {
  const w = falte(name).split(' ').filter(Boolean)
  return w.length ? `${w[0]} ${w[w.length - 1]}` : ''
}

const buchstaben = (t: string): string => t.replace(/[^\p{L}]/gu, '')
const istGross = (t: string): boolean => buchstaben(t).length >= 2 && t === t.toUpperCase()

function kleinSchreiben(wort: string): string {
  const gefaltet = falte(wort)
  if (PARTIKEL.has(gefaltet)) return wort.toLowerCase()
  return wort.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, vor: string, b: string) => vor + b.toUpperCase())
}

/** Großgeschriebene Wörter neben gemischt geschriebenen werden klein mit Anfangsbuchstaben; ein Name nur aus Großbuchstaben bleibt, wie er ist. */
export function ohneGrossschrift(text: string): string {
  const woerter = text.split(' ')
  if (!woerter.some((w) => buchstaben(w) && !istGross(w))) return text
  return woerter.map((w) => (istGross(w) ? kleinSchreiben(w) : w)).join(' ')
}

/** Faltung → häufigste Schreibweise im Bestand; nimmt nur ganze Namen (kein Teilvergleich). */
export type Schreibweisen = Map<string, string>

export function sammleSchreibweisen(namen: Iterable<string>): Schreibweisen {
  const zaehler = new Map<string, Map<string, number>>()
  for (const name of namen) {
    const k = falte(name)
    if (!k || ohneGrossschrift(name) !== name) continue
    const m = zaehler.get(k) ?? zaehler.set(k, new Map()).get(k)!
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  const aus: Schreibweisen = new Map()
  for (const [k, m] of zaehler) aus.set(k, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0])
  return aus
}

/** Anzeigename eines aniSearch-Sprechers: bekannte Schreibweise, sonst Regel. */
export function sprecherAnzeige(name: string, bekannt: Schreibweisen): string {
  const sauber = name.replace(/\s+/g, ' ').trim()
  return bekannt.get(falte(sauber)) ?? ohneGrossschrift(sauber)
}
