import type { Release, Title } from '../../shared/types.ts'
import { folgtSerienname, teilAusUeberschrift } from './meldungen.ts'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

const namenDes = (t: Title): string[] => [t.titleDe, t.titleEn, t.titleRomaji].flatMap((n) => (n ? [n] : []))

/** Die Titel in »Guillemets« der Herkunft eines automatischen Termins („Automatisch übernommen aus …“). */
const artikelNamen = (herkunft: string): string[] => [...herkunft.matchAll(/»([^«]+)«/g)].map((m) => m[1]!)

/** Trägt ein Name des Titels den Artikelnamen (oder umgekehrt)? Sonst hat der Namensabgleich einen fremden Titel gewählt. */
function nameTrifft(t: Title, artikel: string): boolean {
  const a = norm(artikel)
  return namenDes(t).some((n) => (norm(n).includes(a) || a.includes(norm(n))) && norm(n).length > 0)
}

/**
 * **Ein automatischer Termin an einem Titel, den sein Artikel nicht meint** (Boruto statt „Naruto Shippuden – Staffel 4“, Zexal II statt
 * „Yu-Gi-Oh! – Staffel 5“, 16.11.2026): Der Name in der Herkunft kommt im Titel nicht vor, oder die Herkunft nennt Staffel N ≥ 2, und der
 * Titel ist weder diese Staffel (Zahl im Namen) noch der Serienname mit bloßer Zählung. Wortgrenzen zählen, ein Teilstring nicht.
 */
export function herkunftFremderTitel(t: Title, releases: Release[]): boolean {
  return releases.some((r) => {
    if (!r.automatisch || !r.herkunft) return false
    const namen = artikelNamen(r.herkunft)
    if (!namen.length) return false
    if (!namen.some((n) => nameTrifft(t, n))) return true
    const teil = teilAusUeberschrift(r.herkunft)
    if (teil?.art !== 'staffel' || !teil.nummer || teil.nummer < 2) return false
    const mitZahl = new RegExp(`(staffel|season)\\s*0*${teil.nummer}\\b`, 'i')
    return !namenDes(t).some((n) => mitZahl.test(n)) && !namen.some((n) => folgtSerienname(namenDes(t), [n]))
  })
}
