/**
 * **Aus Crunchyrolls deutschen Folgenterminen werden Kalendereinträge.**
 *
 * Der Anlass ist der schlimmste Befund, den dieses Projekt je hatte. Daniel am
 * 02.09.2026 an „Die Tagebücher der Apothekerin": Der Kalender zeigte als
 * einzigen Termin eine Blu-ray am 04.09.2026, dazu „0 von 24 Folgen erschienen
 * · Wöchentlich Frs" — für eine Serie, die seit dem **18.11.2023** vollständig
 * deutsch bei Crunchyroll liegt. Sein Wort: „CRUNCHY WIRD VON UNS GESCANNED!!!
 * WIE Kann so unglaublich falsche info bei uns stehen???"
 *
 * **Die Antwort ist die unangenehmste mögliche: Die Termine lagen im Haus.**
 * `data/crunchyroll-dub.json` führt zu 450 Serien und 1.064 Blöcken **21.689
 * datierte deutsche Folgen** — `verfuegbarAb` je Folge, das
 * `premium_available_date` der **deutschen** Fassung. Für diesen Titel steht
 * dort Staffel 1 mit 18.11.2023–20.04.2024 und Staffel 2 mit
 * 31.01.2025–25.07.2025, auf den Tag Daniels Angabe. Der Kommentar in
 * `crunchyroll-dub.ts` sagt seit dem Tag seiner Entstehung: „Das Feld wird
 * derzeit von nichts ausgewertet." Gemessen betraf das **80 Titel mit belegter
 * Synchro, die nur einen Disc-Termin hatten** — bei jedem einzelnen behauptete
 * die Seite einen Termin, der etwas ganz anderes meint.
 *
 * Das ist derselbe Fehler wie am 15.08.2026 („In der Ferne gesucht, was im
 * Haus lag") — nur teurer, weil er nicht eine Recherche verdoppelt, sondern
 * den Kalender falsch macht.
 *
 * ## Warum es ein eigenes Modul ist
 *
 * Die Zuordnung Block → Titel steht in `crunchyroll-dub.ts` und beantwortet
 * eine andere Frage: **ob** es eine deutsche Fassung gibt. Sie tut das über
 * sieben Wege mit je eigenen Sonderfällen, und ihr Ergebnis (`Urteil`) trägt
 * bewusst nur `titleId` und `dub`. Diese Datei fragt: **wann** kam sie — und
 * beantwortet das nur, wo die Zuordnung ohne jede Annahme eindeutig ist.
 *
 * ## Die Strenge, und warum sie hier härter ist als sonst
 *
 * Ein falsches `dub: true` sagt „gibt es auf Deutsch", wo es das nicht gibt —
 * ärgerlich. Ein falscher **Termin** trägt sich in den Kalender ein, löst eine
 * Benachrichtigung aus und schickt jemanden zu einer Folge, die es nicht gibt.
 * Deshalb gibt eine Serie ihre Termine nur her, wenn **alle fünf** Bedingungen
 * gelten:
 *
 * 1. Der Befund stammt aus dem **deutschen** Katalog. Ein US-Lauf sagt über
 *    deutsche Termine nichts.
 * 2. Es gibt **genauso viele** datierte Blöcke wie Titel mit belegter Synchro
 *    an dieser Adresse. Sonst fasst Crunchyroll zusammen oder teilt auf, und
 *    die Paarung wäre geraten.
 * 3. **Jedes** Paar stimmt in der Folgenzahl exakt überein. Ein einziges Paar,
 *    das nicht aufgeht, verwirft die ganze Serie.
 * 4. Mindestens **die Hälfte** der deutschen Folgen eines Blocks trägt ein
 *    Datum. Drei datierte von vierundzwanzig beschreiben keinen Verlauf.
 * 5. Kein abgeleiteter Termin liegt **vor** der japanischen Ausstrahlung des
 *    Titels. Läge er davor, ist die Paarung verschoben.
 *
 * Gepaart wird chronologisch: unsere Staffeln nach japanischem Jahr,
 * Crunchyrolls Blöcke nach ihrem ersten deutschen Termin. Eine Fortsetzung
 * erscheint später als ihr Vorgänger, in Japan wie hier.
 *
 * **Der erste Anlauf war strenger und traf den Anlass nicht.** Er verlangte
 * 1:1 — ein Titel, ein Block — und leitete 169 Termine ab, unter denen die
 * Apothekerin fehlte: Sie hängt mit zwei Staffeln an einer Adresse. Die
 * paarweise Regel bringt 229 und schließt den Prüfstein ein. Was danach noch
 * liegen bleibt, bleibt mit Absicht liegen: Rechnen ist die Stelle, an der ein
 * Kalender anfängt zu lügen.
 */
import type { Title } from '../../shared/types.ts'
import type { CrSerie, CrStaffel } from './crunchyroll-dub.ts'

/** Ein abgeleiteter deutscher Streaming-Termin für genau einen Titel. */
export interface CrTermin {
  titleId: number
  /** Frühester belegter deutscher Termin, `YYYY-MM-DD` Ortszeit Europe/Berlin. */
  firstEpisodeDate: string
  /** Spätester belegter Termin — gesetzt, wenn der Block vollständig datiert ist. */
  lastEpisodeDate?: string
  /** Uhrzeit des ersten Termins, falls alle Folgen dieselbe tragen. */
  time?: string
  episodeCount: number
  /** Gemessen aus den Abständen, nie angenommen. */
  rhythmus: 'weekly' | 'batch'
  /** Crunchyrolls Name des Blocks — steht als Beleg in der Notiz. */
  blockName: string
  /** Wie viele der deutschen Folgen ein Datum tragen. */
  datiert: number
}

/**
 * **Ein UTC-Zeitstempel wird zu Datum und Uhrzeit in Europe/Berlin.**
 *
 * Crunchyroll liefert `2023-11-18T21:30:00Z`. In Berlin ist das der 18.11. um
 * 22:30 (MEZ) — und im Sommer eine Stunde später. Wer nur `slice(0, 10)`
 * nimmt, verschiebt jeden Termin nach 22:00 UTC auf den Vortag; bei einer
 * Freitagsfolge um 23:30 UTC stünde im Kalender Freitag statt Samstag.
 *
 * Gerechnet wird über `Intl`, wie überall in diesem Projekt (`shared/time.ts`)
 * — eine feste Stundenverschiebung wäre im Winter richtig und im Sommer falsch.
 */
function nachBerlin(iso: string): { datum: string; zeit: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const w = (art: string) => teile.find((t) => t.type === art)?.value ?? ''
  const datum = `${w('year')}-${w('month')}-${w('day')}`
  /* Mitternacht meldet `Intl` als „24" — für uns ist das 00:00 desselben Tages. */
  const stunde = w('hour') === '24' ? '00' : w('hour')
  return { datum, zeit: `${stunde}:${w('minute')}` }
}

/** Tage zwischen zwei `YYYY-MM-DD` — beide als UTC gelesen, also ohne Sommerzeitsprung. */
function tageDazwischen(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
}

/**
 * **Der Rhythmus wird gemessen, nicht angenommen.**
 *
 * Dieselbe Regel wie bei ADN (`bestimmeRhythmus`), und aus demselben Anlass:
 * „Nicht alles an einem Tag" heißt nicht „jede Woche eine Folge". Ein
 * angenommener Wochentakt hat am 12.08.2026 **196 von 867 Terminen** erfunden.
 *
 * Bei Crunchyroll kommt ein eigener Fall dazu, und die Apothekerin ist er: Die
 * Folgen 1 bis 3 erschienen am selben Tag, danach lief es wöchentlich. Ein
 * Auftakt mit mehreren Folgen ist ein Sendeplan, kein Abwurf — deshalb
 * entscheidet der **Median** der Abstände und nicht ihr Mittelwert.
 */
function messeRhythmus(daten: string[]): 'weekly' | 'batch' {
  const tage = [...new Set(daten)].sort()
  if (tage.length <= 1) return 'batch'
  /*
    Mehr als zwei Folgen je Termin im Schnitt: Das ist ein Abwurf. Die Grenze
    liegt höher als bei ADN (1,5), weil Crunchyroll bei Katalogtiteln gern
    einen Auftaktblock stellt und danach wöchentlich weitermacht.
  */
  if (daten.length > tage.length * 2) return 'batch'
  const abstaende: number[] = []
  for (let i = 1; i < tage.length; i++) abstaende.push(tageDazwischen(tage[i - 1]!, tage[i]!))
  abstaende.sort((a, b) => a - b)
  const median = abstaende[Math.floor(abstaende.length / 2)]!
  /* Fünf bis zehn Tage deckt den Wochentakt samt Verschiebungen ab. */
  return median >= 5 && median <= 10 ? 'weekly' : 'batch'
}

/**
 * Leitet für eine Crunchyroll-Serie die deutschen Termine ab — oder gibt
 * nichts zurück, wenn die Zuordnung nicht ohne Annahme eindeutig ist.
 *
 * @param serie   Ein Eintrag aus `data/crunchyroll-dub.json`.
 * @param unsere  Unsere Titel, die auf `serie.url` zeigen.
 */
export function termineAusSerie(serie: CrSerie, unsere: Title[]): CrTermin[] {
  /* Nur der deutsche Katalog trägt deutsche Termine — ein US-Lauf sagt nichts. */
  if (serie.katalog !== 'de') return []
  if (!unsere.length) return []

  const bloecke = (serie.staffeln ?? []).filter((st) => datierte(st).length > 0)
  if (!bloecke.length) return []

  /*
    **Nur Titel mit belegter Synchro und bekannter Folgenzahl kommen in Frage.**
    Ohne `episodes` ist die Rechnung unten nicht zu führen, und ohne belegtes
    `dub` wäre der Termin eine Behauptung über eine Fassung, die niemand
    gesehen hat.
  */
  const kandidaten = unsere.filter((t) => {
    const stream = t.streams.find((x) => x.platform === 'crunchyroll' && x.url === serie.url)
    return stream?.dub === true && typeof t.episodes === 'number' && t.episodes > 0
  })
  if (kandidaten.length !== bloecke.length) return []

  /*
    **Zugeordnet wird chronologisch und paarweise — und nur, wenn jedes Paar
    aufgeht.**

    Der erste Anlauf verlangte 1:1 (ein Titel, ein Block) und ließ damit genau
    den Fall liegen, der ihn ausgelöst hat: „Die Tagebücher der Apothekerin"
    hängt mit **zwei** Staffeln an einer Crunchyroll-Adresse, und Crunchyroll
    führt dafür **zwei** datierte Blöcke. 169 Termine kamen heraus, der
    Prüfstein war keiner davon (02.09.2026).

    Zwei Reihenfolgen entscheiden, und beide sind belegt statt angenommen:
    unsere Staffeln nach japanischem Ausstrahlungsjahr, Crunchyrolls Blöcke
    nach ihrem ersten deutschen Termin. Eine Fortsetzung erscheint später als
    ihr Vorgänger — in Japan wie hier.

    **Drei Riegel halten das eng**, und jeder einzelne wäre allein zu wenig:

    1. **Gleich viele Blöcke wie Titel.** Sonst fasst Crunchyroll zusammen oder
       teilt auf, und die Paarung wäre geraten.
    2. **Jedes Paar muss in der Folgenzahl exakt übereinstimmen.** Ein einziges
       Paar, das nicht aufgeht, verwirft die ganze Serie — dieselbe Strenge wie
       bei den ADN-Staffelblöcken.
    3. **Die Jahre müssen zueinander passen.** Eine deutsche Fassung erscheint
       nicht **vor** der japanischen Ausstrahlung; läge der abgeleitete Termin
       davor, ist die Paarung verschoben. Ein Jahr Toleranz, weil eine
       Herbststaffel im Januar hier ankommen kann.
  */
  const nachJahr = [...kandidaten].sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0) || a.id - b.id)
  const nachDatum = [...bloecke].sort((a, b) => (erstesDatum(a) < erstesDatum(b) ? -1 : 1))

  const raus: CrTermin[] = []
  for (let i = 0; i < nachJahr.length; i++) {
    const titel = nachJahr[i]!
    const block = nachDatum[i]!
    const folgen = datierte(block)

    /* Riegel 2: die Folgenzahl geht exakt auf, oder die ganze Serie fällt. */
    if (folgen.length !== titel.episodes) return []
    /* Und mindestens die Hälfte des Blocks ist datiert, sonst ist es kein Verlauf. */
    if (folgen.length < (block.deutsch ?? folgen.length) / 2) return []

    const punkte = folgen
      .map((f) => nachBerlin(f.verfuegbarAb!))
      .filter((x): x is { datum: string; zeit: string } => x !== null)
      .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0))
    if (!punkte.length) return []

    const daten = punkte.map((p) => p.datum)
    /* Riegel 3: keine deutsche Fassung vor ihrer japanischen Ausstrahlung. */
    const jahr = Number(daten[0]!.slice(0, 4))
    if (titel.jpYear && jahr < titel.jpYear) return []

    const zeiten = new Set(punkte.map((p) => p.zeit))
    raus.push({
      titleId: titel.id,
      firstEpisodeDate: daten[0]!,
      /*
        **`lastEpisodeDate` nur bei vollständig datiertem Block.**

        Das Feld beendet die Fortschreibung (`expandEvents`) — ein zu früh
        gesetztes Ende schneidet echte Folgen ab. Fehlen Daten, rechnet die
        Terminlogik lieber weiter, als die Staffel zu schließen.
      */
      lastEpisodeDate: folgen.length === (block.deutsch ?? folgen.length) ? daten[daten.length - 1] : undefined,
      /* Eine Uhrzeit nur, wenn alle Folgen dieselbe tragen — sonst ist sie geraten. */
      time: zeiten.size === 1 ? [...zeiten][0] : undefined,
      episodeCount: folgen.length,
      rhythmus: messeRhythmus(daten),
      blockName: block.name,
      datiert: folgen.length,
    })
  }
  return raus
}

/** Der früheste deutsche Termin eines Blocks — die Reihenfolge der Blöcke. */
function erstesDatum(st: CrStaffel): string {
  return datierte(st)
    .map((f) => f.verfuegbarAb!)
    .sort()[0]!
}

function datierte(st: CrStaffel): { nummer?: number; guid: string; verfuegbarAb?: string }[] {
  return (st.deutscheFolgen ?? []).filter((f) => Boolean(f.verfuegbarAb))
}

/** Leitet die Termine für alle Serien ab. `nachUrl` bildet Crunchyroll-Adresse → unsere Titel. */
export function alleTermine(serien: CrSerie[], nachUrl: Map<string, Title[]>): CrTermin[] {
  const raus: CrTermin[] = []
  for (const serie of serien) raus.push(...termineAusSerie(serie, nachUrl.get(serie.url) ?? []))
  return raus
}
