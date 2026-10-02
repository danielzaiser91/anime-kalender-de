import { type ReleaseEvent, type Title, type Release } from '../../shared/types.ts'
import { expandEvents } from '../../shared/logic.ts'
import { istPremiere, istStaffelfinale, istStaffelstart } from '../../shared/tv-signale.ts'
import { readJson, log, warn } from '../lib/util.ts'
import { pruefeErgebnis } from '../lib/pruefung.ts'
import { todayIso } from '../../shared/time.ts'
import { kostenloseFolgen } from '../../shared/kostenlos.ts'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { VOICES_DIR } from './grundlagen.ts'
import { widerlegeDeutscheTermine } from './widerlegung-woche.ts'

/**
 * **Die zwei Auskünfte an den Termin schreiben** (28.09.2026, `shared/tv-signale.ts`).
 *
 * Der Newsletter entsteht im **Worker**, und der hat den Datensatz nicht — er sieht nur die
 * Termine. Damit die Mail nicht „Premiere" behauptet, während die Seite „Wiederholung" schreibt,
 * wird hier einmal gerechnet (mit denselben Funktionen, die die Oberfläche benutzt) und das
 * Ergebnis an den Termin geschrieben.
 *
 * Gemessen an den Zahlen vom 28.09.2026: 139 TV-Termine, 16 TV-Releases — die Rechnung ist
 * billig. 32 TV-Termine sind `sichtung` (keine belegte Folgennummer); sie bekommen keine
 * Premieren-Auskunft, weil für sie keine Folge feststeht.
 */
export function schreibeTvAuskunft(events: ReleaseEvent[], releases: Release[], titles: Map<number, Title>): void {
  const releaseBySlug = new Map(releases.map((r) => [r.slug, r]))
  let premier = 0
  let wiederholungen = 0
  let finale = 0
  for (const ev of events) {
    const release = releaseBySlug.get(ev.releaseSlug)
    const title = titles.get(ev.titleId)
    if (release && title && ev.platform === 'tv' && ev.episode && !ev.sichtung) {
      const istEs = istPremiere(ev.episode, ev.date, title, releases, release.ersteDeutsch, ev.time)
      ev.tvPremiere = istEs
      if (istEs) premier++
      else wiederholungen++
    }
    if (istStaffelfinale(ev, { releaseBySlug })) {
      ev.staffelfinale = true
      finale++
    }
    if (istStaffelstart(ev, { releaseBySlug })) ev.staffelstart = true
  }
  log(`TV-Auskunft an den Terminen: ${premier} Premieren, ${wiederholungen} Wiederholungen, ${finale} Staffelfinale`)
}

export function rolleTermineAus({ releases, titles, jpStart }: {
  releases: Release[]
  titles: Map<number, Title>
  jpStart: Map<number, string>
}) {
  /* Erst widerlegen, dann auffalten: Ein widerlegter Termin erzeugt kein Ereignis (02.10.2026). */
  widerlegeDeutscheTermine(releases, titles)
  const events: ReleaseEvent[] = releases
    .flatMap(expandEvents)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '99') .localeCompare(b.time ?? '99') : a.date.localeCompare(b.date)))

  /**
   * **Stufe 4, Schritt 1: das Urteil schließt Lücken** (Daniel, 23.09.2026: „stufe 4 go").
   *
   * `data/urteile.json` entsteht in Stufe 3 aus allen Beobachtungen je Folge und Anbieter
   * (`lib/urteil-je-folge.ts`): die jüngste gewinnt, am selben Tag schlägt gemessen die
   * abgeleitete, ein Kanal-Nein bleibt `unbekannt`.
   *
   * Dieser Schritt ersetzt **keine** der 26 Stellen, an denen der Bau heute `dub` setzt — er
   * steht dahinter und füllt nur, was niemand gesetzt hat (gemessen am 23.09.2026: 177 von 222
   * decken sich, null widersprechen, einer offen). Jede neue Meldung kommt so ohne neue Setzstelle an.
   *
   * Ein Urteil „kein deutsch" setzt hier nichts: Ein Nein entfernt Wege, und das gehört zu
   * Schritt 2, wenn die Gegenproben dafür stehen.
   */
  {
    const urteile = readJson<Record<string, { urteil?: string }>>('data/urteile.json', {})
    const jaJeWeg = new Set<string>()
    for (const [schluessel, u] of Object.entries(urteile)) {
      if (u?.urteil !== 'deutsch') continue
      const [id, plattform] = schluessel.split('|')
      if (id && plattform) jaJeWeg.add(`${id}|${plattform}`)
    }
    let ausUrteil = 0
    for (const title of titles.values()) {
      for (const stream of title.streams ?? []) {
        if (stream.dub !== undefined) continue
        if (!jaJeWeg.has(`${title.id}|${stream.platform}`)) continue
        stream.dub = true
        ausUrteil++
      }
    }
    if (ausUrteil) log(`${ausUrteil} Weg(e) über das Urteil aus Stufe 3 belegt`)
  }
  /**
   * Gegenprobe, bevor irgendetwas geschrieben wird.
   *
   * Sie steht hier und nicht in `validate.ts`, weil dort nur die kuratierten
   * Dateien geprüft werden — also ausgerechnet der Teil, den ohnehin ein Mensch
   * durchdacht hat. Der Fehler vom 12.08.2026 (196 erfundene Termine) entstand
   * vollständig in diesem Skript und wäre dort nie aufgefallen.
   *
   * Ein Widerspruch bricht den Lauf ab. Das kostet im schlimmsten Fall eine
   * Nacht ohne frische Daten — ein Kalender, der eine Folge ankündigt, die es
   * nicht gibt, kostet das Vertrauen in jeden anderen Termin.
   */
  const pruefung = pruefeErgebnis(releases, events, titles, todayIso())
  for (const w of pruefung.warnungen) warn(w)
  if (pruefung.fehler.length) {
    for (const f of pruefung.fehler) console.error('  ✖', f)
    console.error(`\n${pruefung.fehler.length} Widersprüche im erzeugten Datensatz — nichts geschrieben.`)
    process.exit(1)
  }

  /**
   * Titel, deren japanische Ausstrahlung noch gar nicht begonnen hat, gehören
   * hinter den Toggle „Anime ohne deutsche Synchro".
   *
   * Daniels Begründung ist zwingend (15.08.2026): „wenn nichtmal jap release,
   * dann logischerweise kein de release." Eine deutsche Synchro entsteht aus
   * einer japanischen Fassung; gibt es die noch nicht, kann es die Synchro auch
   * nicht geben. Was MyDubList dazu führt, ist dann eine **Ankündigung**, und
   * die im selben Topf mit erschienenen Synchros zu führen macht aus einer
   * Ankündigung eine Tatsache.
   *
   * Der Filter ist bewusst grob — das ist er auch in Daniels Auswahl gewesen.
   * Die schärfere Regel („mindestens eine Folge auf Deutsch erschienen") setzt
   * eine verlässliche Synchro-Erkennung voraus, und die ist es gerade nicht:
   * Crunchyroll zeigt Gästen weniger als Angemeldeten, siehe CLAUDE.md. Eine
   * scharfe Regel auf unscharfen Daten würde Titel verstecken, die längst
   * synchronisiert sind.
   *
   * Verloren geht dabei nichts: Die Titel stehen weiter in `ohne-synchro.json`,
   * sind über den Toggle auffindbar, lassen sich merken, und der Newsletter
   * meldet sich, sobald eine Synchro belegt ist.
   */
  // Welche Titel haben deutsche Sprechrollen? Nur der Merker wandert in den
  // Datensatz — die Rollen selbst holt die Oberfläche beim Aufklappen aus
  // `public/data/voices/<id>.json`. Das Verzeichnis füllt `data:voices`, das
  // vor diesem Lauf gelaufen sein muss; fehlt es, bleibt der Merker aus und
  // die Oberfläche zeigt den Bereich schlicht nicht an.
  const mitStimmen = new Set<number>()
  if (existsSync(VOICES_DIR)) {
    for (const datei of readdirSync(VOICES_DIR)) {
      if (!datei.endsWith('.json')) continue
      try {
        const inhalt = JSON.parse(readFileSync(`${VOICES_DIR}/${datei}`, 'utf8')) as {
          roles?: unknown[]
        }
        if (inhalt.roles?.length) mitStimmen.add(Number(datei.replace('.json', '')))
      } catch {
        // Kaputte Datei überspringen — der nächste Sprecher-Lauf schreibt sie neu.
      }
    }
  }

  const mitRelease = new Set(releases.map((r) => r.titleId))
  const heuteIso = todayIso()
  /**
   * Die Verschobenen werden aufbewahrt, nicht weggeworfen.
   *
   * `schreibeOhneSynchro` bekommt sie unten übergeben und trägt nach, wer nicht schon über den
   * AniList-Katalog dorthin gelangt. Ohne diese Liste hing es vom Zufall ab, ob ein Titel hinter
   * dem Toggle wieder auftaucht.
   */
  const verschoben: Title[] = []
  for (const id of [...titles.keys()]) {
    if (mitRelease.has(id)) continue
    /**
     * Deutsche Sprechrollen schlagen jede Ableitung.
     *
     * Ein deutscher Sprecher zu einer Rolle belegt, dass eine deutsche Fassung
     * **existiert** — das ist kein Indiz, sondern eine Auskunft. Sie gilt auch
     * gegen ein japanisches Startdatum in der Zukunft: AniList führt für
     * Vorabveröffentlichungen und Kinofassungen mitunter beides.
     */
    if (mitStimmen.has(id)) continue
    // Ohne bekanntes Startdatum wird nichts entfernt — Unwissen ist kein Beleg.
    const start = jpStart.get(id)
    if (!start || start <= heuteIso) continue
    const titel = titles.get(id)
    if (titel) verschoben.push(titel)
    titles.delete(id)
  }
  if (verschoben.length) log(`${verschoben.length} Titel hinter den Toggle verschoben: japanische Ausstrahlung steht noch aus`)
  schreibeTvAuskunft(events, releases, titles)
  schreibeKostenlosAuskunft(events, titles)
  return { events, mitStimmen, verschoben }
}

/**
 * **„Heute kostenlos" an den Termin schreiben** (29.09.2026, Daniel zum Newsletter: „heute
 * kostenlos" als Abzeichen).
 *
 * Der Worker hat den Datensatz nicht — er sieht nur die Termine. Ob ein Titel gerade frei zu sehen
 * ist, rechnet `shared/kostenlos.ts` (dieselbe Rechnung wie der Filter der Oberfläche). Geschrieben
 * wird es **nur an Termine von heute**: Die offenen TOGGO-Fenster sind das, was *jetzt* offen ist;
 * für einen Termin in drei Wochen wäre dieselbe Auskunft geraten.
 */
export function schreibeKostenlosAuskunft(events: ReleaseEvent[], titles: Map<number, Title>): void {
  const heute = todayIso()
  let frei = 0
  for (const ev of events) {
    if (ev.date !== heute) continue
    const title = titles.get(ev.titleId)
    if (!title || !kostenloseFolgen(title)) continue
    ev.kostenlos = true
    frei++
  }
  if (frei) log(`${frei} Termin(e) heute kostenlos schaubar`)
}
