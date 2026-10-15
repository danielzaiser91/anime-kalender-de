/**
 * **Das Wochenprogramm als Bild, wenn eine deutsche Zeile erstmals auftaucht oder sich ändert** (Daniel, 15.10.2026,
 * Tomb Raider King F12: „das wäre ein echter wichtiger Beweis … crunchy schuld, nicht wir“).
 *
 * „Folge X nicht erschienen“ ist nur dann Crunchyrolls Versäumnis, wenn Crunchyroll den Termin angekündigt hatte. Der Artikel
 * ist ein Wanderartikel (gleiche Adresse, jede Woche anderer Inhalt), die Ankündigung ist nach der Woche nicht mehr zu sehen.
 * Deshalb hält `data/crunchyroll-woche-belege.json` je deutscher Zeile fest, wann wir sie zuerst sahen und wo ihr Bild liegt;
 * `termine-pruefen.ts` hängt es an den Vermerk, die Meldung zeigt es als Beleg. Das Foto selbst macht `woche-bild.ts`.
 */
import { addDays, toIsoDate } from '../../shared/time.ts'
import type { WocheBelegVermerk } from '../../shared/woche-beleg-typ.ts'
import type { WochenEintrag } from '../scrape-crunchyroll-woche.ts'

export const BELEGE_DATEI = 'data/crunchyroll-woche-belege.json'
/** Länger als das Fenster der Messbelege (14 Tage), damit ein Vermerk sein Bild noch findet. */
const BEHALTEN_TAGE = 21

export interface WocheBeleg {
  seriesId: string
  titel: string
  von: number
  bis: number
  datum: string
  zeit: string | null
  artikel: string
  /** Wann ein Lauf die Zeile zuerst gesehen hat — nicht notwendig, wann Crunchyroll sie schrieb. */
  erstmalsAm: string
  bild?: string
  bildAm?: string
  /** Die Zeile im Bild als Anteile `[links, oben, Breite, Höhe]` (Beleg-Dialog, „Zur Fundstelle"). */
  markierung?: [number, number, number, number]
}

export type WocheBelege = Record<string, WocheBeleg>

type Zeile = Pick<WochenEintrag, 'seriesId' | 'von' | 'bis' | 'datum' | 'zeit'>

/** Dieselbe Zeile, solange Folgen, Tag und Uhrzeit gleich bleiben; ändert sich eins davon, ist es eine neue Zeile mit neuem Bild. */
export function zeilenSchluessel(e: Zeile): string {
  return [e.seriesId, e.von, e.bis, e.datum, e.zeit ?? ''].join('|')
}

/**
 * Trägt neue deutsche Zeilen mit dem Tag der ersten Sichtung ein und nennt, welche noch ein Bild brauchen. Zeilen ohne Serienkennung
 * lassen sich keinem Termin zuordnen und zählen nicht. Was länger als `BEHALTEN_TAGE` zurückliegt, fällt heraus.
 */
export function fortschreiben(alt: WocheBelege, eintraege: WochenEintrag[], artikel: string, jetzt: string): { belege: WocheBelege; offen: string[] } {
  const grenze = addDays(toIsoDate(new Date(jetzt)), -BEHALTEN_TAGE)
  const belege: WocheBelege = Object.fromEntries(Object.entries(alt).filter(([, b]) => b.datum >= grenze))
  const offen: string[] = []
  for (const e of eintraege) {
    if (e.sprache !== 'de' || !e.seriesId) continue
    const schluessel = zeilenSchluessel(e)
    belege[schluessel] ??= { seriesId: e.seriesId, titel: e.titel, von: e.von, bis: e.bis, datum: e.datum, zeit: e.zeit, artikel, erstmalsAm: jetzt }
    if (!belege[schluessel].bild && !offen.includes(schluessel)) offen.push(schluessel)
  }
  return { belege, offen }
}

/**
 * Das Bild der Ankündigung zu einem ausgebliebenen Termin: dieselbe Serie und derselbe Tag, die Folge liegt in der Zeile.
 * Bei mehreren Fassungen derselben Zeile (Uhrzeit geändert) gilt die jüngste, die vor dem Termin schon stand.
 */
export function belegFuerTermin(belege: WocheBelege, t: { seriesId: string; episode: number; datum: string; erwartetAm: string }): WocheBelegVermerk | undefined {
  const treffer = Object.values(belege)
    .filter((b) => b.bild && b.bildAm && b.seriesId === t.seriesId && b.datum === t.datum && b.von <= t.episode && t.episode <= b.bis && b.erstmalsAm <= t.erwartetAm)
    .sort((a, b) => b.erstmalsAm.localeCompare(a.erstmalsAm))[0]
  if (!treffer) return undefined
  return { url: treffer.artikel, gesehenAm: treffer.erstmalsAm, bild: treffer.bild!, bildAm: treffer.bildAm!, ...(treffer.markierung ? { markierung: treffer.markierung } : {}) }
}

/** Ablageschlüssel des Bilds — nur Kleinbuchstaben, Ziffern und `/_.-` (Regel des Workers, `BELEG_SCHLUESSEL`). */
export function bildSchluessel(b: WocheBeleg, am: string): string {
  return `www.crunchyroll.com/wochenprogramm/${b.seriesId.toLowerCase()}/${b.datum}-f${b.von}-${am.slice(0, 16).replace(/[T:]/g, '-')}.webp`
}

/** Hängt das Bild der Ankündigung an jeden Vermerk, der noch keins hat und zu dessen Folge und Tag eine Zeile mit Bild vorliegt. Gibt die Zahl der Treffer zurück. */
export function belegeAnhaengen(
  verpasst: { slug: string; episode: number | null; erwartetAm: string; wocheBeleg?: WocheBelegVermerk }[],
  belege: WocheBelege,
  kennungJeSlug: (slug: string) => string | undefined,
): number {
  let n = 0
  for (const v of verpasst) {
    const seriesId = kennungJeSlug(v.slug)
    if (v.wocheBeleg || v.episode == null || !seriesId) continue
    const treffer = belegFuerTermin(belege, { seriesId, episode: v.episode, datum: toIsoDate(new Date(v.erwartetAm)), erwartetAm: v.erwartetAm })
    if (!treffer) continue
    v.wocheBeleg = treffer
    n++
  }
  return n
}
