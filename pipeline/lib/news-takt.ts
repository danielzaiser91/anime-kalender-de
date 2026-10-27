/**
 * **Wenn eine Serie vom Wochentakt abweicht, ist das eine Meldung an ihrem Tag** (Daniel, 16.10.2026, Re:ZERO Staffel 4).
 *
 * Folge 14 kam nach fünf Wochen Pause, Folge 15 einen Tag später — das sagte keine Meldung. Grundlage sind nur belegte
 * Folgen-Tage (`schedule.observed`, `shared/takt.ts`), nie Fortschreibungen; der Beleg ist wie bei „verspätet erschienen“
 * der Crunchyroll-Kalender an diesem Tag. Gemessen wird nur bei Crunchyroll: Dort sehen wir den Kalender, bei Fernsehen
 * und angekündigten Rhythmen (`Release.rhythmus`) sagen mehrere Folgen je Woche nichts aus.
 */
import type { NewsMeldung, Release } from '../../shared/types.ts'
import { taktTage } from '../../shared/takt.ts'
import { WOCHENPROGRAMM_UEBERSICHT } from '../../shared/wochenprogramm.ts'
import { messBeleg } from './news-verspaetung.ts'
import type { DatiertNews } from './news-verlauf.ts'

type Roh = NewsMeldung & { schluessel: string; fallback: string }

/** Je abweichendem Folgen-Tag bis `heute` eine `takt`-Meldung. */
export function taktMeldungen(r: Release, heute: string): Roh[] {
  if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || r.rhythmus || r.widerlegt) return []
  return taktTage(r.schedule)
    .filter((t) => t.art && t.tag <= heute)
    .map((t) => ({
      schluessel: `takt:${r.slug}:${t.tag}`,
      fallback: t.tag,
      art: 'takt' as const,
      platform: r.platform,
      datum: t.tag,
      takt: t.art,
      von: t.von,
      bis: t.bis,
      anzahl: t.anzahl,
      abstand: t.abstand,
      release: r.slug,
      quelle: WOCHENPROGRAMM_UEBERSICHT,
      belege: [messBeleg(t.tag, t.tag)],
    }))
}

/**
 * **Was eine andere Meldung desselben Tages schon sagt, steht nicht zweimal da.**
 * Pause und „auf einmal“ sind in „verspätet erschienen“ enthalten; „Folgen 12–13“ der Neuheiten-Meldung nennt schon,
 * dass es zwei auf einmal sind. Die Pause neben einer Folgen-Meldung bleibt: Das sagt die Folgen-Meldung nicht.
 */
export function ohneDoppelteTakte(datiert: DatiertNews[]): DatiertNews[] {
  return datiert.filter((m) => {
    if (m.art !== 'takt') return true
    const nachgereicht = datiert.some((n) => n.art === 'nachgereicht' && n.release === m.release && n.datum === m.datum)
    if (nachgereicht) return m.takt === 'folgetag'
    if (m.takt !== 'doppelt') return true
    return !datiert.some(
      (n) =>
        n.art === 'folgen' && n.titel.id === m.titel.id && n.platform === m.platform && n.am === m.am &&
        n.von !== undefined && n.bis !== undefined && n.von <= m.von! && n.bis >= m.bis!,
    )
  })
}
