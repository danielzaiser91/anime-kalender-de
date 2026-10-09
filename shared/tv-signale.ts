/**
 * **Zwei Auskünfte über einen Termin, die überall gleich lauten müssen** (28.09.2026).
 *
 * Bis heute lagen sie in der Web-App (`web/src/lib/tv-angabe.ts`, `web/src/lib/staffelstart.ts`).
 * Der Newsletter aber entsteht im **Worker**, und der hat den Datensatz nicht: Er sieht nur die
 * Termine. Damit die Mail nicht behauptet, eine Folge sei eine Premiere, während die Seite
 * „Wiederholung" schreibt, wandern die beiden Entscheidungen hierher — und der **Bau** schreibt
 * ihr Ergebnis an den Termin:
 *
 *   `tvPremiere`      — erstmals auf Deutsch im Fernsehen (fehlt = keine Aussage, z. B. kein TV)
 *   `staffelfinale`   — letzte Folge einer Staffel mit belegter Folgenzahl
 *   `staffelstart`    — erste Folge einer wöchentlichen Staffel
 *
 * Wer die Flags liest (Newsletter, später die Oberfläche), braucht den Datensatz nicht mehr.
 * Die Funktionen bleiben hier, weil der Bau sie beim Setzen braucht — und die Oberfläche kann
 * sie für Sonderfälle weiterhin aufrufen.
 *
 * ## Premiere oder Wiederholung — und sonst keine Aussage
 *
 * `istPremiere()` liefert **true** (Premiere), **false** (Wiederholung) oder **undefined** (keine
 * Aussage). Beides setzt einen Beleg voraus; das Fehlen von Belegen ist keiner (Daniel, 09.10.2026:
 * „Super Wings" trug PREMIERE für Folgen der Staffel 1 von 2017).
 *
 * **Wiederholung ist belegt**, wenn die Folge früher auf Deutsch lief: laut Wikipedia-Erstausgabe,
 * an einem früheren TV-Termin, im Streaming (Termin oder Bereich) oder bei einem Anbieter, der
 * den ganzen Titel auf Deutsch führt.
 *
 * **Premiere ist belegt**, wenn
 *  (a) die Wikipedia-Erstausgabe der Folge nicht vor dem Termin liegt, oder
 *  (b) die Folge unmittelbar hinter dem belegten Bestand folgt (Streaming, bei frischer Erstausgabe auch frühere TV-Folgen; höchste bisher erschienene
 *      Folge + 1), oder
 *  (c) ein Streaming-Termin dieser Folge erst nach dem Sendetermin liegt (Dragon Ball DAIMA am
 *      16.–18.09.2026 auf TOGGO plus: RTL+ startet am 25.09.).
 * Liegt die deutsche Erstausgabe des Titels mehr als ein Jahr vor dem Termin, gilt nur (a) — auch (c)
 * kommt dort bewusst nicht zum Zug (bekannte Grenze: ein späterer Streaming-Termin eines alten Titels
 * kann eine Wiederveröffentlichung sein): Ohne
 * Beleg der Folge ist es eine Wiederholung oder unbekannt, nie eine Premiere. Eine Disc zählt nicht
 * mit — gefragt ist Streaming.
 *
 * Daniel, 19.09.2026: „im tv muss auch sagen welche folge an dem termin kommt + uhrzeit ist
 * wichtig" und „premiere bzw wiederholung … je nachdem ob die folge das aller erste mal auf
 * deutsch erscheint, oder ob es bereits in streaming erhältlich ist".
 */
import type { Release, ReleaseEvent, Title } from './types.ts'
import { expandEvents } from './logic.ts'
import { addDays } from './time.ts'

/** Tag der belegten deutschen Erstausgabe: aniSearch mit Synchro-Marke oder Wikipedia-Episodenliste (ohne Marke wäre es evtl. nur OmU). */
function belegteErstausgabe(title: Title): string | undefined {
  const e = title.deErstausgabe
  return e?.synchro || e?.quelle === 'wikipedia' ? e.von : undefined
}

/** Hat der Titel schon vor diesem Tag (abzüglich `abstandTage`) eine belegte deutsche Erstausgabe? */
export function frueherDeutscheErstausgabe(title: Title, tag: string, abstandTage = 0): boolean {
  const von = belegteErstausgabe(title)
  return Boolean(von && von < addDays(tag, -abstandTage))
}

/**
 * Ist dieser Termin kein deutscher Start? Ein **automatisch** aus dem Fernsehprogramm erzeugter
 * Termin beweist nur, dass die Sendung läuft — nicht, dass es die erste deutsche Fassung ist,
 * wenn der Titel schon früher eine belegte Synchro-Erstausgabe hat (News „Erstmals mit deutscher Synchro").
 */
export function istKeinDeutscherStart(r: Release, title: Title | undefined): boolean {
  return r.platform === 'tv' && !!r.automatisch && !!title && frueherDeutscheErstausgabe(title, r.schedule.firstEpisodeDate)
}

/** Der früheste deutsche Termin je Titel; widerlegte und `istKeinDeutscherStart` zählen nicht. */
export function ersterDeutscherTermin(releases: Release[], titles: Title[]): Map<number, string> {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const erster = new Map<number, string>()
  for (const r of releases) {
    if (r.widerlegt || istKeinDeutscherStart(r, nachId.get(r.titleId))) continue
    const bisher = erster.get(r.titleId)
    if (!bisher || r.schedule.firstEpisodeDate < bisher) erster.set(r.titleId, r.schedule.firstEpisodeDate)
  }
  return erster
}

export function istPremiere(
  folge: number,
  datum: string,
  title: Title,
  releases: Release[],
  ersteDeutsch?: Record<number, string>,
  /** Uhrzeit des Termins, um den es geht — trennt zwei Sendungen desselben Tages. */
  zeit?: string,
): boolean | undefined {
  /* Lief sie schon früher auf Deutsch (Wikipedia-EAD, RTL+-Start), ist es eine Wiederholung —
     Dragon Ball Folge 1 auf ProSieben MAXX 2026 ist nicht deren Premiere (1999). */
  const erst = ersteDeutsch?.[folge]
  if (erst && erst < datum) return false
  /* Dieselbe Folge lief an einem früheren Termin desselben Senders/Tages (Nachtwiederholung). */
  const frueheresTv = releases
    .filter((r) => r.platform === 'tv')
    .flatMap((r) => expandEvents(r))
    .filter((e) => e.episode && !e.sichtung && (e.date < datum || (e.date === datum && zeit !== undefined && (e.time ?? '') < zeit)))
  if (frueheresTv.some((e) => e.episode === folge)) return false
  const plattformen = new Set([
    ...(title.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform as string),
    ...releases.filter((r) => r.platform !== 'tv' && r.releaseType !== 'disc').map((r) => r.platform as string),
  ])
  /* Bestand: die höchste Folge, die vor dem Termin belegt im Streaming (oder laut Wikipedia) deutsch erschien. */
  let bestand = Math.max(0, ...Object.entries(ersteDeutsch ?? {}).filter(([, d]) => d < datum).map(([n]) => Number(n)))
  let spaeter = false
  for (const p of plattformen) {
    if (p === 'tv') continue
    const eigene = releases.filter((r) => r.platform === p && r.releaseType !== 'disc')
    if (eigene.length) {
      const termine = eigene.flatMap((r) => expandEvents(r))
      if (termine.some((e) => e.episode === folge && e.date <= datum)) return false
      for (const e of termine) {
        if (e.date <= datum && e.episode) bestand = Math.max(bestand, e.episode)
        if (e.date > datum && e.episode === folge) spaeter = true
      }
      continue
    }
    const s = (title.streams ?? []).find((x) => x.platform === p && x.dub === true)
    if (!s) continue
    const bereiche = s.dubRanges ?? []
    if (!bereiche.length) return false
    if (bereiche.some((r) => r.dub && r.from <= folge && folge <= r.to)) return false
    for (const r of bereiche) if (r.dub) bestand = Math.max(bestand, r.to)
  }
  /* (a) Die Erstausgabe der Folge liegt nicht vor dem Termin. */
  if (erst) return true
  /* Ein Titel mit alter deutscher Erstausgabe: ohne Beleg der Folge keine Aussage. */
  if (frueherDeutscheErstausgabe(title, datum, 365)) return undefined
  /* Frisch auf Deutsch (Erstausgabe innerhalb eines Jahres): Auch die früheren TV-Folgen gehören zum Bestand. */
  const von = belegteErstausgabe(title)
  const jung = Boolean(von && von >= addDays(datum, -365))
  const stand = jung ? Math.max(bestand, ...frueheresTv.map((e) => e.episode!)) : bestand
  /* (b) unmittelbar hinter dem Bestand, (c) im Streaming erst nach dem Sendetermin. */
  return (folge === stand + 1 && (stand > 0 || jung)) || spaeter ? true : undefined
}

type MitReleases = { releaseBySlug: Map<string, Release> }

/** Der wöchentliche Streaming-Release eines Termins — nur für ihn gibt es Start und Finale. */
function woechentlich(e: ReleaseEvent, data: MitReleases): Release | undefined {
  if (e.platform === 'tv' || e.sichtung || !e.episode || e.releaseType !== 'weekly') return undefined
  const release = data.releaseBySlug.get(e.releaseSlug)
  return release && release.dateMeaning !== 'available-from' ? release : undefined
}

/**
 * Beginnt an diesem Termin die deutsche Synchro einer Staffel (oder eines geteilten Teils)?
 *
 * Nur bei wöchentlichen Releases: Ein Katalogtitel mit `available-from` ist „im Angebot seit",
 * nicht „erschienen am", und eine Fernsehausstrahlung beantwortet `istPremiere()`. Gezählt wird
 * nach der Nummer, nicht nach der Position — ein geteilter Start beginnt bei `firstEpisodeNumber`.
 */
export function istStaffelstart(e: ReleaseEvent, data: MitReleases): boolean {
  const release = woechentlich(e, data)
  return !!release && e.episode === (release.schedule?.firstEpisodeNumber ?? 1)
}

/**
 * Endet an diesem Termin die Staffel? Nur mit belegter Folgenzahl — eine geratene
 * (`episodeCountAssumed`) macht aus der letzten bekannten Folge kein Finale.
 */
export function istStaffelfinale(e: ReleaseEvent, data: MitReleases): boolean {
  const release = woechentlich(e, data)
  if (!release || release.schedule?.episodeCountAssumed) return false
  return !!e.episodeCount && e.episode === e.episodeCount
}
