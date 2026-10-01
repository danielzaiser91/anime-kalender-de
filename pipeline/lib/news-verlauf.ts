/**
 * **Nichts verschwindet stillschweigend** (Daniel, 01.10.2026).
 *
 * Als „Die Tagebücher der Apothekerin" Staffel 3 ohne Erklärung aus dem Kalender
 * fiel, war die Nachricht dazu einfach weg: „keine Entfernung von News einträgen.
 * Sie müssen aktualisiert werden statt entfernt, und sichtbar machen was passiert
 * ist."
 *
 * Der Bau vergleicht deshalb jeden Termin mit dem, was zuletzt zu ihm dastand
 * (`historie.termine`):
 *
 * - **Verschoben** (derselbe Release, anderer Tag): Die alte Meldung bleibt,
 *   durchgestrichen, mit `ersetzt` auf den neuen Tag und dessen Quelle.
 * - **Zurückgezogen** (kein Termin mehr): ebenfalls sichtbar, mit Grund.
 *
 * Abgelöste Fassungen sammeln sich in `historie.vergangen` und werden bei jedem
 * Bau erneut ausgeliefert, bis sie das Fenster verlassen — sonst verschwände die
 * Ersetzung nach einem Tag wieder.
 *
 * Liegt in einer eigenen Datei, weil `baueNews` die Längengrenze reißt.
 */
import { addDays } from '../../shared/time.ts'
import type { NewsArt, NewsMeldung, PlatformId, Title } from '../../shared/types.ts'

/** Was zuletzt zu einem Release auf der Nachrichtenseite stand. */
export interface TerminVerlauf {
  datum: string
  art: NewsArt
  titelId: number
  /** Anzeigename zum Zeitpunkt der Meldung — trägt den Verlauf auch ohne Titel im Bestand. */
  name: string
  cover?: string
  /** Reihenkopf (`franchiseId ?? id`), unter dem gebündelt wird. */
  wurzel: number
  platform?: PlatformId
  quelle?: string
  /** Tag, an dem die Meldung zuerst dastand. */
  am: string
}

/** Das Gedächtnis des Verlaufs — Teil von `NewsHistorie`. */
export interface TerminGedaechtnis {
  /** Zuletzt ausgelieferter Stand je Release (für den Vergleich). */
  termine?: Record<string, TerminVerlauf>
  /** Abgelöste Fassungen, die sichtbar bleiben. */
  vergangen?: Record<string, TerminVerlauf[]>
}

/** Eine terminierte Meldung mit ihrem Schlüssel — die Form, mit der `baueNews` arbeitet. */
export type DatiertNews = NewsMeldung & { am: string; titel: Title; schluessel: string }

export function pflegeTerminverlauf({
  datiert,
  nachId,
  historie,
  name,
  wurzel,
  grenze,
  heute,
}: {
  datiert: DatiertNews[]
  nachId: Map<number, Title>
  historie: TerminGedaechtnis
  name: (t: Title) => string
  wurzel: (t: Title) => number
  grenze: string
  heute: string
}): DatiertNews[] {
  const jetztNachSlug = new Map<string, DatiertNews>()
  for (const m of datiert) if (m.release) jetztNachSlug.set(m.release, m)

  const verlauf = (historie.termine ??= {})
  const vergangen = (historie.vergangen ??= {})
  for (const [slug, alt] of Object.entries(verlauf)) {
    const neu = jetztNachSlug.get(slug)
    if (neu?.datum === alt.datum) continue
    vergangen[slug] = [...(vergangen[slug] ?? []), alt]
    if (neu) {
      const t = neu.titel
      verlauf[slug] = {
        datum: neu.datum!,
        art: neu.art,
        titelId: t.id,
        name: name(t),
        cover: t.coverImage,
        wurzel: wurzel(t),
        platform: neu.platform,
        quelle: neu.quelle,
        am: neu.am,
      }
    } else {
      delete verlauf[slug]
    }
  }

  const raus = verlaufsKette({ vergangen, verlauf, jetztNachSlug, nachId, grenze })
  for (const [slug, kette] of Object.entries(vergangen)) {
    const rest = kette.filter((v) => v.am >= addDays(heute, -400))
    if (rest.length) vergangen[slug] = rest
    else delete vergangen[slug]
  }
  for (const m of datiert) {
    if (!m.release) continue
    const t = m.titel
    verlauf[m.release] = {
      datum: m.datum!,
      art: m.art,
      titelId: t.id,
      name: name(t),
      cover: t.coverImage,
      wurzel: wurzel(t),
      platform: m.platform,
      quelle: m.quelle,
      am: m.am,
    }
  }
  for (const [slug, v] of Object.entries(verlauf)) if (v.am < addDays(heute, -400)) delete verlauf[slug]
  return raus
}

/**
 * **Die Kette ausliefern.** Jede abgelöste Fassung zeigt auf die nächste — bei
 * der letzten auf den geltenden Stand, sonst auf „zurückgezogen".
 */
function verlaufsKette({
  vergangen,
  verlauf,
  jetztNachSlug,
  nachId,
  grenze,
}: {
  vergangen: Record<string, TerminVerlauf[]>
  verlauf: Record<string, TerminVerlauf>
  jetztNachSlug: Map<string, DatiertNews>
  nachId: Map<number, Title>
  grenze: string
}): DatiertNews[] {
  const raus: DatiertNews[] = []
  for (const [slug, kette] of Object.entries(vergangen)) {
    const aktuell = jetztNachSlug.get(slug) ?? verlauf[slug]
    for (let i = 0; i < kette.length; i++) {
      const alt = kette[i]!
      if (alt.am < grenze) continue
      const titel =
        nachId.get(alt.titelId) ??
        ({ id: alt.titelId, franchiseId: alt.wurzel, titleDe: alt.name, coverImage: alt.cover } as unknown as Title)
      const nachfolger = kette[i + 1] ?? aktuell
      raus.push({
        art: alt.art,
        platform: alt.platform,
        datum: alt.datum,
        release: slug,
        quelle: alt.quelle,
        am: alt.am,
        titel,
        schluessel: `verlauf:${slug}:${alt.datum}:${i}`,
        ersetzt: nachfolger ? { datum: nachfolger.datum, release: slug, quelle: nachfolger.quelle } : undefined,
        zurueckgezogen: nachfolger ? undefined : { grund: 'Der Termin wurde zurückgezogen.' },
      })
    }
  }
  return raus
}
