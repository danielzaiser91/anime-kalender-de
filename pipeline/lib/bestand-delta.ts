/**
 * Die Kennzahlen eines Bestands und der Vergleich mit dem vorigen — der Kern von `pipeline/bestand-historie.ts`,
 * hier ohne Dateizugriff, damit ein Test die Urteile der Wache mit gebauten Zeilen durchspielen kann.
 */
import type { Title } from '../../shared/types.ts'

export interface Kennzahlen {
  titel: number
  titelMitVerweis: number
  verweise: number
  mitUrteil: number
  ohneUrteil: number
  titelMitSynchro: number
  /**
   * Wie viele Verweise das Gedächtnis als **begründet entfernt** führt.
   *
   * Ohne diese Zahl kann die Wache „78 Verweise entfernt" nicht von „78
   * Verweise verschwunden" unterscheiden — und meldete am 06.09.2026 einen
   * Alarm für den Normalfall: Die aniSearch-Ergänzung hatte 123 Verweise
   * angelegt und 78 davon im selben Lauf als belegtes Nein wieder entfernt.
   *
   * Eine Warnung, die zuverlässig zu Unrecht kommt, ist schlimmer als keine
   * (CLAUDE.md, 16.08.2026): Man hört auf hinzusehen, und die echte Störung
   * geht darin unter.
   */
  entferntProtokolliert: number
  /** Dasselbe je Anbieter — damit die Aufschlüsselung ihre Erklärung mitbringt. */
  entferntJeAnbieter?: Record<string, number>
  releases: number
  termine: number
  /** Je Anbieter die Zahl der Verweise mit belegter Synchro. */
  jeAnbieter: Record<string, number>
}

/** Alles, was `messen()` braucht; der Aufrufer liest die Dateien. */
export interface Eingabe {
  titel: Title[]
  releases: unknown
  termine: unknown
  entfernt: { verweise?: unknown[] }
}

export function messen(e: Eingabe): Kennzahlen {
  const { titel, releases, termine, entfernt } = e
  const jeAnbieter: Record<string, number> = {}
  let verweise = 0
  let mitUrteil = 0
  let ohneUrteil = 0
  let titelMitVerweis = 0
  let titelMitSynchro = 0

  for (const t of titel) {
    const streams = t.streams ?? []
    if (streams.length) titelMitVerweis++
    let hat = false
    for (const s of streams) {
      verweise++
      if (s.dub === true) {
        mitUrteil++
        hat = true
        jeAnbieter[s.platform] = (jeAnbieter[s.platform] ?? 0) + 1
      } else if (s.dub === false) mitUrteil++
      else ohneUrteil++
    }
    if (hat) titelMitSynchro++
  }

  return {
    titel: titel.length,
    titelMitVerweis,
    verweise,
    mitUrteil,
    ohneUrteil,
    titelMitSynchro,
    entferntProtokolliert: Array.isArray(entfernt.verweise) ? entfernt.verweise.length : 0,
    /**
     * **Dasselbe je Anbieter — sonst bleibt die Aufschlüsselung ohne Erklärung.**
     *
     * Die Gesamtzahl der Verweise ist seit dem 06.09.2026 gegen das Gedächtnis
     * gerechnet: Was mit Grund entfernt wurde, gilt nicht als Verlust. Die
     * Zeilen „crunchyroll: 6 Synchro-Belege weniger" liefen daran vorbei und
     * standen weiter als Auffälligkeit da.
     *
     * Am 07.09.2026 meldete die Wache fünf solche Zeilen, und **alle fünf**
     * gingen auf gewollte Entfernungen desselben Tages zurück: 16
     * YouTube-Verweise ohne belegte Synchro, die FSK-18-Fassung von Date a
     * Live, „7th Time Loop". Wer das am nächsten Morgen liest, sieht fünf
     * Alarme und muss jeden einzeln nachschlagen.
     */
    entferntJeAnbieter: Array.isArray(entfernt.verweise)
      ? (entfernt.verweise as { plattform?: string }[]).reduce<Record<string, number>>((n, e) => {
          const p = e.plattform ?? 'unbekannt'
          n[p] = (n[p] ?? 0) + 1
          return n
        }, {})
      : {},
    releases: Array.isArray(releases) ? releases.length : 0,
    termine: Array.isArray(termine) ? termine.length : 0,
    jeAnbieter,
  }
}

/**
 * Was auffällt, steht im Klartext dabei.
 *
 * Die Schwellen sind bewusst niedrig: Lieber eine Zeile zu viel in der Historie
 * als ein stiller Verlust. Wer sie liest, entscheidet — die Datei urteilt nicht.
 */
export function findeAuffaelliges(jetzt: Kennzahlen, vorher: Kennzahlen | null): string[] {
  const auffaellig: string[] = []
  if (!vorher) return auffaellig
  const d = (feld: keyof Kennzahlen) => (jetzt[feld] as number) - (vorher[feld] as number)

  if (d('titel') < 0) auffaellig.push(`${-d('titel')} Titel weniger`)
  /*
    Auch hier gegen das Gedächtnis gerechnet: Ein Urteil verschwindet in aller
    Regel mit dem Verweis, an dem es hing — und wenn der mit Grund entfernt
    wurde, ist nichts verloren. Am 07.09.2026 standen fünf solche Zeilen in der
    Wache, alle fünf erklärt.
  */
  const urteilWeg = -d('mitUrteil')
  const urteilRest = urteilWeg - Math.max(0, d('entferntProtokolliert'))
  if (urteilRest > 0) {
    auffaellig.push(
      `${urteilRest} Urteile verloren` +
        (urteilWeg > urteilRest ? ` (${urteilWeg - urteilRest} weitere sind begründet entfernt)` : ''),
    )
  }
  if (d('titelMitSynchro') < 0) auffaellig.push(`${-d('titelMitSynchro')} Titel ohne Synchro-Beleg`)
  if (d('termine') < -20) auffaellig.push(`${-d('termine')} Termine weniger`)
  /*
    Ein Verweis, der verschwindet, ist oft richtig — tote Adressen und belegte
    Neins werden entfernt, und das Gedächtnis schreibt jeden davon mit. Gemeldet
    wird deshalb nur, was **darüber hinaus** fehlt.

    Am 06.09.2026 stand hier „78 Verweise entfernt" als Auffälligkeit, während
    das Gedächtnis im selben Lauf um 78 Einträge wuchs — der Normalfall, als
    Alarm ausgegeben. Wo die Zahlen zusammenpassen, ist nichts verlorengegangen;
    bleibt ein Rest, steht genau der da.
  */
  const wegErklaert = Math.max(0, d('entferntProtokolliert'))
  const wegUnerklaert = -d('verweise') - wegErklaert
  if (wegUnerklaert > 50) {
    auffaellig.push(
      `${wegUnerklaert} Verweise ohne protokollierten Grund weg` +
        (wegErklaert ? ` (${wegErklaert} weitere sind begründet entfernt)` : ''),
    )
  }
  /*
    **Je Anbieter dieselbe Rechnung wie oben.**

    Was mit protokolliertem Grund entfernt wurde, ist kein Verlust — es ist die
    Arbeit, für die es das Gedächtnis gibt. Gemeldet wird der Rest; passt alles
    zusammen, steht die Zeile gar nicht erst da.
  */
  for (const [anbieter, zahl] of Object.entries(jetzt.jeAnbieter)) {
    const alt = vorher.jeAnbieter?.[anbieter] ?? 0
    if (zahl >= alt) continue
    const weg = alt - zahl
    const begruendet = Math.max(
      0,
      (jetzt.entferntJeAnbieter?.[anbieter] ?? 0) - (vorher.entferntJeAnbieter?.[anbieter] ?? 0),
    )
    const rest = weg - begruendet
    if (rest <= 0) continue
    auffaellig.push(
      `${anbieter}: ${rest} Synchro-Belege weniger` +
        (begruendet ? ` (${begruendet} weitere sind begründet entfernt)` : ''),
    )
  }
  for (const [anbieter, alt] of Object.entries(vorher.jeAnbieter ?? {})) {
    if (!(anbieter in jetzt.jeAnbieter) && alt > 0) {
      auffaellig.push(`${anbieter}: alle ${alt} Synchro-Belege weg`)
    }
  }
  return auffaellig
}
