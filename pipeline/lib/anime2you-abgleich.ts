/**
 * Namensabgleich für die Anime2You-Gegenprobe: Titel, Sender und Anbieter eines Modell-Vorschlags müssen im Zitat,
 * im Artikeltitel oder im Artikeltext stehen. Schreibvarianten („ProSieben MAXX“/„ProSiebenMaxx“, „Prime Video“/„Amazon“)
 * zählen als derselbe Name; ein anderer bekannter Name im Zitat widerlegt die Angabe.
 */
import { PLATFORMS } from '../../shared/types.ts'

interface Gruppe {
  namen: string[]
  /** Regex-Quelle: der Name zählt nicht, wenn sie direkt folgt (RTL ≠ RTL ZWEI, ProSieben ≠ ProSieben MAXX). */
  nicht?: string
  /** Regex-Quelle: der Name zählt nicht, wenn sie direkt davor steht (RTL ≠ Super RTL). */
  nichtDavor?: string
}

const GRUPPEN: Gruppe[] = [
  { namen: ['crunchyroll'] },
  { namen: ['netflix'] },
  { namen: ['prime video', 'amazon prime video', 'amazon prime', 'amazon'] },
  { namen: ['disney+', 'disney plus', 'disneyplus'] },
  { namen: ['adn', 'animation digital network'] },
  { namen: ['aniverse'] },
  { namen: ['wow', 'sky'] },
  { namen: ['joyn'] },
  { namen: ['rtl+', 'rtl plus', 'rtlplus'] },
  { namen: ['rtl'], nicht: 'zwei|2|\\+|plus', nichtDavor: 'super' },
  { namen: ['rtl zwei', 'rtl2', 'rtl 2'] },
  { namen: ['super rtl', 'superrtl'] },
  { namen: ['prosieben maxx', 'pro7 maxx', 'prosiebenmaxx'] },
  { namen: ['prosieben', 'pro7', 'pro sieben'], nicht: 'maxx|fun' },
  { namen: ['sat.1', 'sat1'], nicht: 'gold' },
  { namen: ['kabel eins', 'kabel1'] },
  { namen: ['vox'] },
  { namen: ['nitro'] },
  { namen: ['tele 5', 'tele5'] },
  { namen: ['zdf'] },
  { namen: ['ard'] },
  { namen: ['arte'] },
  { namen: ['kika'] },
  { namen: ['toggo'] },
  { namen: ['nickelodeon', 'nick'] },
  { namen: ['cartoon network'] },
  { namen: ['paramount+', 'paramount plus', 'paramountplus'] },
  { namen: ['youtube'] },
  { namen: ['apple tv+', 'apple tv plus'] },
]

const squash = (s: string): string => s.toLowerCase().replace(/[^\p{L}\d+]/gu, '')
const maskiert = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Zwischen den Buchstaben sind Leerzeichen, Bindestrich und Punkt erlaubt: „ProSiebenMaxx“ = „ProSieben MAXX“. */
const muster = (name: string, g?: Gruppe): RegExp => {
  const buchstaben = [...squash(name)].map(maskiert).join('[\\s.-]*')
  const davor = g?.nichtDavor ? `(?<!${g.nichtDavor}[\\s-])` : ''
  const danach = g?.nicht ? `(?!\\s*(?:${g.nicht}))` : ''
  const ende = name.endsWith('+') ? '' : '(?![\\p{L}\\d+])'
  return new RegExp(`(?<![\\p{L}\\d])${davor}${buchstaben}${ende}${danach}`, 'iu')
}

const gruppeVon = (name: string): Gruppe | undefined => GRUPPEN.find((g) => g.namen.some((n) => squash(n) === squash(name)))
const nenntGruppe = (text: string, g: Gruppe): boolean => g.namen.some((n) => muster(n, g).test(text))

/** Steht der Name (oder eine bekannte Schreibvariante) im Text? */
export function nenntName(text: string, name: string): boolean {
  const g = gruppeVon(name)
  return g ? nenntGruppe(text, g) : muster(name).test(text)
}

/** Nennt der Text einen anderen bekannten Sender oder Anbieter als `name`? */
export function nenntAnderen(text: string, name: string): boolean {
  const eigene = gruppeVon(name)
  return GRUPPEN.some((g) => g !== eigene && nenntGruppe(text, g))
}

/** Sender oder Anbieter gegen Zitat und Artikeltext: `undefined` = in Ordnung, sonst der Grund der Verwerfung oder eine Warnung. */
export function pruefeName(feld: string, name: string, zitat: string, artikel: string): { grund?: string; warnung?: string } {
  if (nenntName(zitat, name)) return {}
  if (nenntAnderen(zitat, name)) return { grund: `${feld} „${name}“ steht nicht im Zitat, das Zitat nennt einen anderen Anbieter` }
  if (nenntName(artikel, name)) return { warnung: `${feld} „${name}“ steht nur im Artikeltext, nicht im Zitat – gegenlesen` }
  return { grund: `${feld} „${name}“ steht weder im Zitat noch im Artikel` }
}

/** Die Namen, die eine Plattform des Datenmodells im Artikel trägt; leer, wo es keinen Anbieternamen gibt (disc, kino, tv). */
export const PLATTFORM_NAMEN: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORMS)
    .filter(([id]) => !['disc', 'kino', 'tv', 'unbekannt'].includes(id))
    .map(([id, p]) => [id, p.name.toLowerCase()]),
)

const woerter = (s: string): string[] => s.toLowerCase().match(/[\p{L}\d]+/gu) ?? []

/**
 * Titel gegen Artikeltitel und Zitat. Tolerant für Untertitel: Es genügt der Teil vor „:“ oder „–“, und jedes seiner Wörter
 * muss im Artikeltitel oder Zitat vorkommen (Beugung wie „Avatars“ zählt).
 */
export function titelPasst(titel: string, zitat: string, artikelTitel?: string): boolean {
  const haupt = titel.split(/\s[–-]\s|:/)[0] ?? titel
  const quelle = woerter(`${artikelTitel ?? ''} ${zitat}`)
  const gesucht = woerter(haupt).filter((w) => w.length >= 2)
  if (!gesucht.length) return squash(zitat).includes(squash(titel))
  return gesucht.every((w) => quelle.some((q) => q === w || (w.length >= 4 && q.startsWith(w))))
}
