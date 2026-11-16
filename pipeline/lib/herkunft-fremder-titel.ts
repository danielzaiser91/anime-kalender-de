import type { Release, Title } from '../../shared/types.ts'
import { teilAusUeberschrift } from './meldungen.ts'
import { artikelNamen, nameTrifft, titelNamen } from './titel-name-trifft.ts'

/** Wie `LAENGSTE_STAFFEL` in `meldungen.ts`: ein Titel darüber umfasst mehrere Staffeln, seine Staffel N steht nicht im Namen. */
const MEHRERE_STAFFELN = 26

/**
 * **Ein automatischer Termin an einem Titel, den sein Artikel nicht meint** (Boruto statt „Naruto Shippuden – Staffel 4“, Zexal statt
 * „Yu-Gi-Oh! – Staffel 5“, 16.11.2026): Der Name in der Herkunft kommt im Titel nicht vor, oder die Herkunft nennt Staffel N ≥ 2, der Titel trägt
 * die Zahl nicht im Namen und ist länger als eine Staffel (ein Titel mit mehreren Staffeln ist nicht „Staffel N“ der Serie).
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
    return (t.episodes ?? 0) > MEHRERE_STAFFELN && !titelNamen(t).some((n) => mitZahl.test(n))
  })
}
