/**
 * Anime2You-Monatsübersicht „Disc-Neuheiten <Monat> <Jahr>" (`/news/<id>/disc-neuheiten-oktober-2026/`) lesen.
 *
 * Die Seite ist serverseitig gerendert und maschinenlesbar: je Tag eine Karte (`disc-day-card`) mit „22. Oktober 2026", je Titel eine Zeile
 * mit `data-disc-title`, `-label`, `-format`, `-medium`, `-edition`. Anlass (06.10.2026): Vier KSM-Ultimate-Editions am 22.10. standen in keiner
 * unserer Quellen, bis jemand die Übersicht von Hand gelesen hat. Hier wird nur gelesen; der Abgleich mit dem Kalender steht in
 * `pipeline/check-disc-uebersicht.ts`.
 */
export interface DiscZeile {
  /** ISO-Tag. */
  datum: string
  /** Wie die Seite ihn zeigt, samt Ausgabe („Summer Wars (Ultimate Edition)"). */
  titel: string
  label: string
  /** „serie" | „film" … laut Seite. */
  format: string
  medium: string
  edition: string
}

/** Adresse einer Monatsübersicht. */
export const DISC_UEBERSICHT = /\/news\/\d+\/disc-neuheiten-[a-zäöü]+-\d{4}\/?$/i

const MONATE: Record<string, string> = {
  januar: '01', februar: '02', märz: '03', april: '04', mai: '05', juni: '06', juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
}

const ENTITAETEN: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'" }
const klartext = (s: string): string =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, n: string) => ENTITAETEN[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim()

/** Liest alle Titelzeilen aller Tageskarten. Eine Karte ohne lesbares Datum wird übersprungen, nie geraten. */
export function leseDiscUebersicht(html: string): DiscZeile[] {
  const zeilen: DiscZeile[] = []
  for (const karte of html.split('<article class="disc-day-card"').slice(1)) {
    const kopf = /<h3[^>]*class="disc-day-card__title"[^>]*>([\s\S]*?)<\/h3>/.exec(karte)?.[1]
    const d = kopf ? /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/.exec(klartext(kopf)) : null
    const monat = d ? MONATE[d[2]!.toLowerCase()] : undefined
    if (!d || !monat) continue
    const datum = `${d[3]}-${monat}-${d[1]!.padStart(2, '0')}`
    for (const zeile of karte.split('<li class="disc-title-row"').slice(1)) {
      const attr = (n: string) => new RegExp(`data-disc-${n}="([^"]*)"`).exec(zeile)?.[1] ?? ''
      const titel = /<span class="disc-title-row__title">([\s\S]*?)<\/span>/.exec(zeile)?.[1]
      if (!titel) continue
      zeilen.push({ datum, titel: klartext(titel), label: klartext(attr('label')), format: attr('format'), medium: klartext(attr('medium')), edition: klartext(attr('edition')) })
    }
  }
  return zeilen
}

const FUELLWORT = new Set(['vol', 'volume', 'staffel', 'season', 'teil', 'part', 'box', 'komplettbox', 'komplettset', 'gesamtausgabe', 'edition', 'ultimate', 'limited', 'collectors', 'film', 'the', 'movie', 'der', 'die', 'das', 'und', 'bundle', 'sammelschuber', 'blu', 'ray', 'dvd', '4k', 'uhd', 'steelbook', 'serie', 'komplett'])

/** Die tragenden Wörter eines Titels: klein, ohne Klammern, Ausgaben- und Füllwörter. */
export function titelKern(titel: string): string[] {
  return titel
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !FUELLWORT.has(w) && !/^\d+$/.test(w))
}

const tageZwischen = (x: string, y: string): number => Math.abs((Date.parse(x) - Date.parse(y)) / 864e5)

function gleicherTitel(a: Set<string>, name: string): boolean {
  const b = new Set(titelKern(name))
  const kleiner = a.size <= b.size ? a : b
  const groesser = a.size <= b.size ? b : a
  return kleiner.size > 0 && [...kleiner].filter((w) => groesser.has(w)).length / kleiner.size >= 0.5
}

export type DiscAbgleich = { art: 'gedeckt' } | { art: 'anderer-tag'; tag: string } | { art: 'fehlt' }

/**
 * Steht diese Zeile der Übersicht schon als Disc-Termin im Kalender? Gleicher Tag (±3: Übersicht und Händler nennen den Tag selten identisch) und mindestens die
 * Hälfte der tragenden Wörter des kürzeren Titels kommt im anderen vor. Bewusst großzügig: Ein falscher Treffer verschweigt eine Lücke, ein fehlender erzeugt Lärm.
 * Kennt der Kalender den Titel nur an einem anderen Tag (die Übersicht ist älter als eine Verschiebung), heißt das „anderer-tag", nicht „fehlt".
 */
export function discAbgleich(zeile: DiscZeile, termine: { name: string; datum: string }[]): DiscAbgleich {
  const a = new Set(titelKern(zeile.titel))
  if (!a.size) return { art: 'gedeckt' }
  const passend = termine.filter((t) => gleicherTitel(a, t.name))
  if (passend.some((t) => tageZwischen(t.datum, zeile.datum) <= 3)) return { art: 'gedeckt' }
  return passend[0] ? { art: 'anderer-tag', tag: passend[0].datum } : { art: 'fehlt' }
}
