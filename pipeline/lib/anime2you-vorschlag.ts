/**
 * **Prüfung der Claude-Antwort zu einem Anime2You-Artikel** (P2). Das Modell liefert Vorschläge, aber keinen Beleg gilt ohne Gegenprobe
 * am Artikeltext: Zitat wörtlich vorhanden, Titel, Sender und Anbieter stehen im Zitat (oder Artikeltitel bzw. -text), Tag und
 * Uhrzeit stehen im Zitat, deutsche Fassung nur bei deutscher Wortmarke.
 * Was die Probe nicht besteht, wird mit Grund verworfen; was zweifelhaft bleibt (Wochentag), kommt mit Warnung durch.
 */
import { PLATFORMS, type PlatformId } from '../../shared/types.ts'
import { weekdayIndex, weekdayName } from '../../shared/time.ts'
import { findDates } from './feed.ts'
import { dubBefund } from './sprachbefund.ts'
import { maskiert, PLATTFORM_NAMEN, pruefeName, titelPasst, zeichenfolge } from './anime2you-abgleich.ts'
import { titelzeilePasst, titelzeilenUeber } from './anime2you-blockkopf.ts'

export const ARTEN = ['start', 'folgen', 'disc', 'kino', 'ankuendigung', 'sprachfassung', 'pause', 'abgang'] as const
export const SPRACHEN = ['deutsch', 'omu', 'deutsch+omu', 'unklar'] as const
/** Plattformen des Datenmodells (`PLATFORMS`); was dort fehlt (z. B. Apple TV+), steht als `null` und in `anbieter`. */
const PLATTFORMEN = Object.keys(PLATFORMS).filter((p) => p !== 'unbekannt') as PlatformId[]

export interface Vorschlag {
  titel: string
  art: (typeof ARTEN)[number]
  plattform: PlatformId | null
  /** Der Anbieter, wie der Artikel ihn nennt — vor allem, wo `plattform` null ist. */
  anbieter: string | null
  sender: string | null
  /** `JJJJ-MM-TT`; null, wenn der Artikel keinen Tag nennt. */
  datum: string | null
  uhrzeit: string | null
  wochentage: string | null
  sprache: (typeof SPRACHEN)[number]
  folgen: string | null
  zitat: string
  unsicher: string | null
}

export interface GepruefterVorschlag extends Vorschlag {
  /** Wochentag des Datums, vom Skript gerechnet. */
  wochentag: string | null
  warnungen: string[]
}

export interface Artikelbezug {
  text: string
  /** Überschrift des Artikels – neben dem Zitat die zweite Stelle, an der der Titel stehen darf. */
  titel?: string
  veroeffentlicht: string
}

const TAG_STAEMME = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag']
const DEUTSCHE_FASSUNG = /deutsch|synchron|verton|\bdub\b/i
/** Deutsch als angebotene Sprache neben Japanisch (UT) – `dubBefund` liest den Untertitel-Teil sonst als „nein“. */
const DEUTSCH_ANGEBOT = /sprache:\s*deutsch|deutsche[rn]?\s+(?:und\s+japanische[rn]?\s+)?sprachausgabe/i

/** Freitext aus dem Modell: Länge begrenzt, ohne Adresse, Markdown- und Zeilenzeichen — er landet in einer Tabelle im Pull Request. */
export function sauber(wert: unknown, max: number): string | null | undefined {
  if (wert === null || wert === undefined || wert === '') return null
  if (typeof wert !== 'string' || /https?:|www\.|@/i.test(wert)) return undefined
  const rein = wert.replace(/[|`<>\[\]\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return rein.length > max ? undefined : rein
}

/** Kurzbeschreibung einer Rohantwort für die Liste der Verworfenen (Titel, Art, Tag, soweit lesbar). */
export function beschreibe(roh: unknown): string {
  const r = typeof roh === 'object' && roh !== null ? (roh as Record<string, unknown>) : {}
  return [r.titel, r.art, r.datum].filter((x) => typeof x === 'string').join(' · ').slice(0, 100) || 'unlesbar'
}

/** Die im Zitat genannten Wochentage; „Montag bis Freitag“ ergibt alle fünf dazwischen. Index wie `weekdayIndex`. */
export function genannteTage(zitat: string): Set<number> {
  const text = zitat.toLowerCase()
  const tage = new Set<number>()
  const stamm = TAG_STAEMME.join('|')
  for (const m of text.matchAll(new RegExp(`(${stamm})s?\\s+bis\\s+(${stamm})s?`, 'g'))) {
    for (let i = TAG_STAEMME.indexOf(m[1]!); ; i = (i + 1) % 7) {
      tage.add(i)
      if (i === TAG_STAEMME.indexOf(m[2]!)) break
    }
  }
  if (tage.size) return tage
  for (const m of text.matchAll(new RegExp(`(${stamm})`, 'g'))) tage.add(TAG_STAEMME.indexOf(m[1]!))
  return tage
}

/** Wochentag des Datums gegen die Angabe im Zitat; leer, wenn beides zusammenpasst oder das Zitat keinen Tag nennt. */
function wochentagsWarnung(datum: string, zitat: string): string[] {
  const tage = genannteTage(zitat)
  if (!tage.size || tage.has(weekdayIndex(datum))) return []
  return [`${datum} ist ein ${weekdayName(datum)}, das Zitat nennt andere Wochentage – gegenlesen`]
}

function pruefeDatum(v: Vorschlag, bezug: Artikelbezug): string | undefined {
  if (v.datum === null) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.datum)) return 'datum ist kein JJJJ-MM-TT'
  const im = findDates(v.zitat, bezug.veroeffentlicht, true).some((d) => d.iso === v.datum)
  if (!im) return `Tag ${v.datum} steht nicht im Zitat`
  const jahr = Number(v.datum.slice(0, 4))
  const artikelJahr = Number(bezug.veroeffentlicht.slice(0, 4))
  return jahr < artikelJahr || jahr > artikelJahr + 3 ? 'Tag außerhalb von Artikeljahr bis +3 Jahre' : undefined
}

function pruefeUhrzeit(v: Vorschlag): string | undefined {
  if (v.uhrzeit === null) return undefined
  const m = /^(\d{2}):(\d{2})$/.exec(v.uhrzeit)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return 'uhrzeit ist kein HH:MM'
  return new RegExp(`(?<![\\d:])0?${Number(m[1])}[:.]${m[2]}(?!\\d)`).test(v.zitat) ? undefined : `Uhrzeit ${v.uhrzeit} steht nicht im Zitat`
}

function pruefeSprache(v: Vorschlag): string | undefined {
  if (!v.sprache.startsWith('deutsch')) return undefined
  if (!DEUTSCHE_FASSUNG.test(v.zitat)) return 'sprache deutsch, aber das Zitat nennt keine deutsche Fassung'
  const befund = dubBefund(v.zitat)
  const nein = befund === 'nein' && !DEUTSCH_ANGEBOT.test(v.zitat)
  return nein || befund === 'offen' ? `sprache deutsch, aber das Zitat sagt „${befund}“` : undefined
}

/** Die Felder in Form und Länge – liefert den Vorschlag oder den Grund, warum die Antwort kein Vorschlag ist. */
export function leseVorschlag(roh: unknown): Vorschlag | string {
  if (typeof roh !== 'object' || roh === null) return 'kein Objekt'
  const r = roh as Record<string, unknown>
  const titel = sauber(r.titel, 120)
  const zitat = sauber(r.zitat, 500) ?? ''
  if (!titel) return 'titel fehlt oder ist unzulässig'
  if (zitat.length < 20) return 'zitat fehlt, ist kürzer als 20 oder länger als 500 Zeichen oder enthält Adresse oder @'
  if (!ARTEN.includes(r.art as never)) return `art „${String(r.art)}“ unbekannt`
  if (!SPRACHEN.includes(r.sprache as never)) return `sprache „${String(r.sprache)}“ unbekannt`
  if (r.plattform !== null && !PLATTFORMEN.includes(r.plattform as PlatformId)) return `plattform „${String(r.plattform)}“ nicht im Datenmodell – null setzen`
  const frei = ['anbieter', 'sender', 'wochentage', 'folgen', 'unsicher'] as const
  const kaputt = frei.find((f) => sauber(r[f], f === 'unsicher' ? 250 : 60) === undefined)
  if (kaputt) return `${kaputt} zu lang oder mit Adresse`
  if (r.datum !== null && typeof r.datum !== 'string') return 'datum weder Text noch null'
  if (r.uhrzeit !== null && typeof r.uhrzeit !== 'string') return 'uhrzeit weder Text noch null'
  return {
    titel,
    zitat,
    art: r.art as Vorschlag['art'],
    sprache: r.sprache as Vorschlag['sprache'],
    plattform: r.plattform as PlatformId | null,
    datum: r.datum as string | null,
    uhrzeit: r.uhrzeit as string | null,
    anbieter: sauber(r.anbieter, 60) ?? null,
    sender: sauber(r.sender, 60) ?? null,
    wochentage: sauber(r.wochentage, 60) ?? null,
    folgen: sauber(r.folgen, 60) ?? null,
    unsicher: sauber(r.unsicher, 250) ?? null,
  }
}

/** Titel, Sender, Anbieter und Plattform gegen Zitat und Artikel: der Grund der Verwerfung oder die Warnungen. */
function pruefeNamen(v: Vorschlag, bezug: Artikelbezug): { grund?: string; warnungen: string[] } {
  const warnungen: string[] = []
  if (!titelPasst(v.titel, v.zitat, bezug.titel)) {
    const passt = titelzeilenUeber(bezug.text, v.zitat).some((z) => titelzeilePasst(v.titel, z))
    if (!passt) return { grund: 'Titel steht weder im Zitat noch im Artikeltitel noch in der Titelzeile über dem Zitat', warnungen }
    warnungen.push('Titel steht nur in der Titelzeile des Blocks über dem Zitat – gegenlesen')
  }
  // Ein Titel wie „The Sky Crawlers“ trägt selbst einen Anbieternamen („Sky“); er zählt nicht als Anbieter im Zitat.
  const zitat = v.zitat.replaceAll(new RegExp(maskiert(v.titel), 'gi'), ' ')
  const plattformName = v.plattform ? PLATTFORM_NAMEN[v.plattform] : undefined
  const namen: [string, string | null | undefined][] = [
    ['sender', v.sender],
    ['anbieter', v.anbieter],
    ['plattform', plattformName],
  ]
  for (const [feld, name] of namen) {
    if (!name) continue
    const r = pruefeName(feld, name, zitat, bezug.text)
    if (r.grund) return { grund: r.grund, warnungen }
    if (r.warnung) warnungen.push(r.warnung)
  }
  return { warnungen }
}

/** Gegenprobe am Artikel: `{ ok }` mit Warnungen oder `{ grund }` für die Verwerfung. */
export function pruefeVorschlag(roh: unknown, bezug: Artikelbezug): { ok: GepruefterVorschlag } | { grund: string } {
  const v = leseVorschlag(roh)
  if (typeof v === 'string') return { grund: v }
  if (!zeichenfolge(bezug.text).includes(zeichenfolge(v.zitat))) return { grund: 'Zitat steht nicht wörtlich im Artikel' }
  const grund = pruefeDatum(v, bezug) ?? pruefeUhrzeit(v) ?? pruefeSprache(v)
  if (grund) return { grund }
  if (v.plattform === 'tv' && !v.sender) return { grund: 'plattform tv ohne sender' }
  const namen = pruefeNamen(v, bezug)
  if (namen.grund) return { grund: namen.grund }
  const warnungen = [...(v.datum ? wochentagsWarnung(v.datum, v.zitat) : []), ...namen.warnungen]
  return { ok: { ...v, wochentag: v.datum ? weekdayName(v.datum) : null, warnungen } }
}
