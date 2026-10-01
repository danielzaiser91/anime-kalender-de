/**
 * **Nichts verschwindet stillschweigend** (Daniel, 01.10.2026).
 *
 * Als „Die Tagebücher der Apothekerin" Staffel 3 ohne Erklärung aus dem Kalender
 * fiel, war die Nachricht dazu einfach weg: „keine Entfernung von News einträgen.
 * Sie müssen aktualisiert werden statt entfernt, und sichtbar machen was passiert
 * ist."
 *
 * Der Bau vergleicht deshalb jeden Termin mit dem, was zuletzt zu ihm dastand:
 *
 * - **Verschoben** (derselbe Release, dieselbe Art, anderer Tag): Die alte
 *   Meldung bleibt, durchgestrichen, mit `ersetzt` auf den neuen Tag und dessen
 *   Quelle.
 * - **Zurückgezogen** (dieselbe Art gibt es gar nicht mehr): sichtbar mit Grund.
 *
 * Je Release wird eine **Liste** geführt, nicht ein einzelner Wert: Ein Release
 * kann gleichzeitig „angekündigt" und „nicht erschienen" melden, und ein einzelner
 * Wert verlor die erste Meldung.
 *
 * Beim ersten Lauf mit diesem Verfahren ist das Gedächtnis leer — dann wird es
 * aus dem zuvor ausgelieferten `news.json` gespeist (`vorherige`), sonst wäre
 * gerade der Fall unsichtbar, der es ausgelöst hat.
 *
 * Liegt in einer eigenen Datei, weil `baueNews` die Längengrenze reißt.
 */
import { addDays } from '../../shared/time.ts'
import type { NewsArt, NewsEintrag, NewsMeldung, PlatformId, Title } from '../../shared/types.ts'

/** Was zuletzt zu einem Termin auf der Nachrichtenseite stand. */
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
  /** Der Termin war unsere eigene Schätzung — er trägt keinen Quellenlink (01.10.2026). */
  geschaetzt?: boolean
  /** Tag, an dem die Meldung zuerst dastand. */
  am: string
}

/** Das Gedächtnis des Verlaufs — Teil von `NewsHistorie`. */
export interface TerminGedaechtnis {
  /** Release → zuletzt ausgelieferte Termin-Meldungen. */
  termine?: Record<string, TerminVerlauf[]>
  /** Release → abgelöste Fassungen, in Reihenfolge des Ablösens. */
  vergangen?: Record<string, TerminVerlauf[]>
}

/** Eine terminierte Meldung mit ihrem Schlüssel — die Form, mit der `baueNews` arbeitet. */
export type DatiertNews = NewsMeldung & { am: string; titel: Title; schluessel: string }

const tag = (d: string | undefined) => (d ?? '').slice(0, 10)

/** Der gespeicherte Stand einer ausgelieferten Meldung. */
function ausMeldung(m: DatiertNews, name: (t: Title) => string, wurzel: (t: Title) => number): TerminVerlauf {
  return {
    datum: m.datum!,
    art: m.art,
    titelId: m.titel.id,
    name: name(m.titel),
    cover: m.titel.coverImage,
    wurzel: wurzel(m.titel),
    platform: m.platform,
    quelle: m.quelle,
    geschaetzt: m.geschaetzt,
    am: m.am,
  }
}

/** Den Verlauf aus dem zuvor ausgelieferten `news.json` speisen (nur beim ersten Lauf). */
function seedAusVorherige(
  vorherige: NewsEintrag[],
  nachId: Map<number, Title>,
  verlauf: Record<string, TerminVerlauf[]>,
): void {
  for (const e of vorherige) {
    for (const m of e.meldungen) {
      if (!m.release || !m.datum || m.ersetzt || m.zurueckgezogen) continue
      const titelId = m.teilId ?? e.titelId
      const v: TerminVerlauf = {
        datum: m.datum,
        art: m.art,
        titelId,
        name: e.titel,
        cover: e.cover,
        wurzel: nachId.get(titelId)?.franchiseId ?? titelId,
        platform: m.platform,
        quelle: m.quelle,
        geschaetzt: m.geschaetzt,
        am: e.am,
      }
      verlauf[m.release] = [...(verlauf[m.release] ?? []), v]
    }
  }
}

export function pflegeTerminverlauf({
  datiert,
  nachId,
  historie,
  vorherige,
  name,
  wurzel,
  grenze,
  heute,
}: {
  datiert: DatiertNews[]
  nachId: Map<number, Title>
  historie: TerminGedaechtnis
  vorherige: NewsEintrag[]
  name: (t: Title) => string
  wurzel: (t: Title) => number
  grenze: string
  heute: string
}): DatiertNews[] {
  const jetztProRelease = new Map<string, DatiertNews[]>()
  for (const m of datiert) if (m.release) jetztProRelease.set(m.release, [...(jetztProRelease.get(m.release) ?? []), m])

  const verlauf = (historie.termine ??= {})
  const vergangen = (historie.vergangen ??= {})
  /*
    **Alte Form verwerfen.** Der erste Versuch führte je Release **einen** Stand
    (ein Objekt); die neue Form führt Listen. Ein Objekt wäre nicht iterierbar —
    der Lauf bräche ab. Die Liste wird aus dem vorigen `news.json` neu gespeist.
  */
  for (const [release, wert] of Object.entries(verlauf)) if (!Array.isArray(wert)) delete verlauf[release]
  if (!Object.keys(verlauf).length && vorherige.length) seedAusVorherige(vorherige, nachId, verlauf)

  for (const [release, alte] of Object.entries(verlauf)) {
    const neue = jetztProRelease.get(release) ?? []
    const behalten: TerminVerlauf[] = []
    for (const alt of alte) {
      const treffer = neue.find((n) => n.art === alt.art && tag(n.datum) === tag(alt.datum))
      if (treffer) behalten.push(ausMeldung(treffer, name, wurzel))
      else vergangen[release] = [...(vergangen[release] ?? []), alt]
    }
    for (const n of neue) {
      const v = ausMeldung(n, name, wurzel)
      if (!behalten.some((b) => b.art === v.art && tag(b.datum) === tag(v.datum))) behalten.push(v)
    }
    if (behalten.length) verlauf[release] = behalten
    else delete verlauf[release]
  }
  for (const [release, neue] of jetztProRelease) {
    if (verlauf[release]) continue
    verlauf[release] = neue.map((n) => ausMeldung(n, name, wurzel))
  }
  return verlaufsKette({ vergangen, verlauf, jetztProRelease, nachId, grenze, heute })
}

/**
 * **Die Kette ausliefern.** Jede abgelöste Fassung zeigt auf die nächste
 * Meldung derselben Art — bei der letzten auf den geltenden Stand, sonst auf
 * „zurückgezogen". Altes jenseits des Fensters fällt aus dem Gedächtnis.
 */
function verlaufsKette({
  vergangen,
  verlauf,
  jetztProRelease,
  nachId,
  grenze,
  heute,
}: {
  vergangen: Record<string, TerminVerlauf[]>
  verlauf: Record<string, TerminVerlauf[]>
  jetztProRelease: Map<string, DatiertNews[]>
  nachId: Map<number, Title>
  grenze: string
  heute: string
}): DatiertNews[] {
  const raus: DatiertNews[] = []
  for (const [release, kette] of Object.entries(vergangen)) {
    const aktuell = jetztProRelease.get(release) ?? []
    for (let i = 0; i < kette.length; i++) {
      const alt = kette[i]!
      if (alt.am < grenze) continue
      const titel =
        nachId.get(alt.titelId) ??
        ({ id: alt.titelId, franchiseId: alt.wurzel, titleDe: alt.name, coverImage: alt.cover } as unknown as Title)
      const nachfolger = kette.slice(i + 1).find((k) => k.art === alt.art) ?? aktuell.find((n) => n.art === alt.art)
      raus.push({
        art: alt.art,
        platform: alt.platform,
        datum: alt.datum,
        release,
        quelle: alt.quelle,
        geschaetzt: alt.geschaetzt,
        am: alt.am,
        titel,
        schluessel: `verlauf:${release}:${alt.art}:${tag(alt.datum)}:${i}`,
        ersetzt: nachfolger ? { datum: nachfolger.datum, release, quelle: nachfolger.quelle } : undefined,
        zurueckgezogen: nachfolger ? undefined : { grund: 'Der Termin wurde zurückgezogen.' },
      })
    }
  }
  for (const [release, kette] of Object.entries(vergangen)) {
    const rest = kette.filter((v) => v.am >= addDays(heute, -400))
    if (rest.length) vergangen[release] = rest
    else delete vergangen[release]
  }
  for (const [release, liste] of Object.entries(verlauf)) {
    const rest = liste.filter((v) => v.am >= addDays(heute, -400))
    if (rest.length) verlauf[release] = rest
    else delete verlauf[release]
  }
  return raus
}
