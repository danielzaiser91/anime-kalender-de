/**
 * **Was ein automatischer Termin über seine Quelle nicht behaupten darf** (10.10.2026, Beerus: OmU-Meldung als
 * Synchro-Start, Simulcast als „Alle Folgen"). Läuft im Bau gegen das ausgelieferte Ergebnis (`13-5-kerndateien.ts`);
 * ein Treffer bricht den Bau ab.
 */
import type { Release } from '../../shared/types.ts'
import { taktDerMeldung, type Vorschlag } from './meldungen.ts'
import { spracheDerMeldung } from './sprachbefund.ts'

export function autoReleaseWidersprueche(releases: Release[], vorschlaege: Vorschlag[]): string[] {
  const jeAdresse = new Map<string, Vorschlag[]>()
  for (const v of vorschlaege) jeAdresse.set(v.articleUrl, [...(jeAdresse.get(v.articleUrl) ?? []), v])
  const fehler: string[] = []
  for (const r of releases) {
    if (!r.automatisch || r.platform === 'disc' || r.platform === 'tv' || r.platform === 'rtlplus') continue
    const quellen = jeAdresse.get(r.sources[0] ?? '') ?? []
    if (!quellen.length) continue
    if (!r.sprache && !quellen.some((v) => spracheDerMeldung(v) === 'ja'))
      fehler.push(`"${r.slug}": Quelle sagt keine deutsche Synchro zu, der Termin ist nicht gekennzeichnet (sprache)`)
    const einzel = quellen.filter((v) => !v.dates?.every((d) => d.context === 'Sammelartikel'))
    if (r.releaseType === 'batch' && !r.schedule.episodeCount && !r.dateMeaning && einzel.some((v) => taktDerMeldung(v) === 'woechentlich'))
      fehler.push(`"${r.slug}": Quelle nennt einen Wochentakt, der Termin steht als „alle Folgen" (batch)`)
  }
  return fehler
}
