import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Meldung, Quelle, Release, ReleaseEvent, Title, WatchLink } from '@shared/types.ts'
import { dubGrenze, dubLuecken } from '@shared/dub-grenze.ts'
import type { Zugangsart } from '@shared/zugangsart.ts'
import { PLATFORMS } from '@shared/types.ts'
import { PLATFORM_TIME_NOTE } from '@shared/mappings.ts'
import { expandEvents, lastEpisodeDate, releaseStatus, titleStatus, istErschienen } from '@shared/logic.ts'
import { buildIcs, googleCalendarUrl } from '@shared/ics.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import type { FranchiseMember, Franchises } from '@shared/types.ts'
import {
  anzeigeName,
  eindeutschenStaffel,
  istStaffel,
  nachAusstrahlung,
  ohneStaffelEins,
  reihenVertreter,
} from '@shared/titles.ts'
import {
  loadAllTitles,
  loadFranchises,
  loadMeldungen,
  loadOhneSynchro,
  loadSynopsis,
  loadVoices,
  type Synopsis,
  type Voices,
} from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { useNewsletterVerbindung } from '../lib/newsletterSync.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import {
  Button,
  Chip,
  DubMark,
  ReihenStern,
  Tooltip,
  FavoriteStar,
  HideEye,
  FskBadge,
  PlatformBadge,
  ReleaseTypeBadge,
  SectionTitle,
  StatusBadge,
} from './ui.tsx'
import { Quellenuebersicht } from './Quellenuebersicht.tsx'

const KEYWORD_PREVIEW = 8
/**
 * Wie viel von der Handlung ohne Klick zu sehen ist.
 *
 * 200 Zeichen sind etwa zwei Sätze — genug, um zu entscheiden, ob man
 * weiterlesen will, und kurz genug, dass alles Übrige im Bild bleibt.
 */
const PLOT_PREVIEW = 200

function downloadIcs(events: ReleaseEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events, { calendarName: filename })], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Teilen — als Symbol im Kopf, nicht als Knopf neben dem Anbieter.
 *
 * Vorher stand er in der Knopfzeile direkt neben „Bei ADN ansehen", und dort
 * las er sich, als teile er den ADN-Link (Daniel, 15.08.2026: „es lässt
 * vermuten das der teilen link sich auf adn bezieht, dabei bezieht er sich auf
 * dieses panel"). Geteilt wird der Titel, also gehört er zu Auge und Stern —
 * den anderen beiden Handlungen, die dem Titel gelten.
 */
function ShareIcon({ slug, name }: { slug: string; name: string }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const copied = copiedSlug === slug

  return (
    <Tooltip text={t('detail.shareHint')} seite="unten">
      <button
        type="button"
        onClick={() => share(slug, name)}
        aria-label={t('detail.share')}
        className="cursor-pointer rounded p-1 text-lg leading-none text-slate-400 transition hover:bg-slate-500/10 hover:text-sky-400"
      >
        {copied ? '✓' : '🔗'}
      </button>
    </Tooltip>
  )
}

/** Was die Antwortzeile zu sagen hat — je nach Lage des Titels. */
type Antwort =
  | { art: 'laeuft'; haupt: ReleaseEvent; rest: number; raus: number; gesamt?: number; letzter?: string }
  | { art: 'fertig'; raus?: number; gesamt?: number }
  | { art: 'film'; hatSynchro: boolean; raus: number; gesamt?: number }
  | { art: 'ohne'; gesamt?: number }
  /**
   * **Eine Disc ist kein Sendeplan.**
   *
   * Gibt es zu einem Titel überhaupt kein Streaming-Release, fällt der Kopf auf
   * die Disc zurück — ein Kaufdatum ist besser als gar keine Auskunft. Nur
   * beantwortet es eine andere Frage: über einer Steelbook-Box stand
   * „Wöchentlich freitags · letzte Folge · 0 von 24 Folgen erschienen" (Daniel,
   * 02.09.2026). Eine Disc erscheint an einem Tag komplett; Fortschrittsbalken
   * und Rhythmus gehören dort nicht hin.
   */
  | { art: 'disc'; datum: string; publisher?: string; edition?: string }

/**
 * Der Kasten ganz oben — die Antwort auf „wann, wie weit, wo".
 *
 * **Vier Zeilen in jedem Fall.** Überschrift, Nebenzeile, dann etwas, das den
 * Fortschritt zeigt, dann eine Zählzeile. Auch „keine deutsche Fassung" bekommt
 * beides: einen leeren Balken und „Keine Folge auf Deutsch". Das ist kein
 * Füllmaterial, sondern die ehrlichste Auskunft, die es zu so einem Titel gibt —
 * und es hält den Kasten gleich hoch, damit beim Wechseln des Reihenteils nichts
 * springt.
 *
 * Beim Film tritt an die Stelle des Balkens eine Faktenzeile: Ein
 * Fortschrittsbalken, der immer voll ist, misst nichts.
 */
/**
 * Hat dieses Release noch einen Termin in der Zukunft?
 *
 * Geprüft wird über die entfalteten Ereignisse, nicht über `firstEpisodeDate`:
 * Eine Wochenserie, die vor drei Wochen begann, hat einen Start in der
 * Vergangenheit und trotzdem neun Folgen vor sich.
 */
function hatKuenftigenTermin(release: Release, today: string): boolean {
  if (release.cinemaUntil) return release.cinemaUntil >= today
  return expandEvents(release).some((e) => e.date > today)
}

/**
 * „Auf Deutsch seit …" — die Nebenzeile aus `deErstausgabe`.
 *
 * Zwei Formen, weil aniSearch zwei liefert: ein Tagesdatum („08.01.2003") oder
 * nur einen Zeitraum („1997", „10.1990 - 03.1991"). Der Zeitraum wird
 * unverändert durchgereicht — ein erfundener 1. Januar wäre falsch, der Text
 * ist richtig.
 */
function deSeitZeile(
  title: Title,
  T: (k: string, v?: Record<string, string | number>) => string,
): string {
  const e = title.deErstausgabe
  if (!e) return ''
  const wann = e.von ? formatDate(e.von) : (e.zeitraum ?? '')
  if (!wann) return ''
  return e.publisher
    ? T('antwort.deSeitPublisher', { datum: wann, publisher: e.publisher })
    : T('antwort.deSeit', { datum: wann })
}

function AntwortKasten({
  antwort,
  title,
  t,
  today,
  stream = [],
  disc = [],
}: {
  antwort: Antwort
  title: Title
  t: (k: never, v?: Record<string, string | number>) => string
  today: string
  /**
   * Die Anbieter-Pillen. Sie standen bis zum 03.09.2026 in einem eigenen
   * Abschnitt „WO LÄUFT ES" darunter — mit dem Ergebnis, dass der Kopf des
   * Panels je Titel eine andere Höhe hatte und beim Wechsel sprang (Daniel, mit
   * drei Bildern). Im Kasten haben sie einen festen Platz.
   */
  stream?: React.ReactNode[]
  disc?: React.ReactNode[]
}) {
  /*
    **Der Umschalter sitzt oben rechts — nicht über den Pillen.**

    Über ihnen kostete er eine Zeile, und die gab es nur bei Titeln mit beidem:
    Staffel 1 war dadurch höher als Staffel 2 (Daniel, 03.09.2026, mit zwei
    Bildern: „toggle oben rechts in box packen, sodass keine height änderung
    passiert"). Oben rechts liegt er in einer Zeile, die ohnehin da ist — und
    kostet keine Höhe mehr.
  */
  const [zeigeDisc, setZeigeDisc] = useState(false)
  const beides = stream.length > 0 && disc.length > 0
  const pillen = zeigeDisc && disc.length ? disc : stream.length ? stream : disc
  const T = t as unknown as (k: string, v?: Record<string, string | number>) => string

  /** Relative Angabe zuerst — niemand rechnet gern nach, welcher Tag der 25. ist. */
  const relativ = (datum: string): string => {
    const tage = Math.round(
      (new Date(`${datum}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000,
    )
    if (tage <= 0) return T('antwort.heute')
    if (tage === 1) return T('antwort.morgen')
    if (tage <= 6) return T('antwort.inTagen', { count: tage })
    return ''
  }

  let haupt: string
  let neben: string
  let anteil: number | undefined
  let zaehl: string
  let fakten: { wert: string; was: string }[] | undefined
  let gedaempft = false
  /** Woher die Nebenzeile stammt — nur gesetzt, wo sie eine Fremdangabe ist. */
  let nebenTitel: string | undefined

  if (antwort.art === 'laeuft') {
    const e = antwort.haupt
    const rel = relativ(e.date)
    haupt = [rel, formatDate(e.date)].filter(Boolean).join(', ')
    if (e.episode) haupt += ` — ${T('antwort.folge', { n: e.episode })}`
    neben = [
      /*
        **Der Wochentag wird ausgeschrieben, nicht abgeschnitten.**

        `weekdayName(…).slice(0, 2)` machte aus „Freitag" ein „Fr", und mit dem
        angehängten s stand dort „Wöchentlich Frs" — Daniel am 03.09.2026: „Frs
        entfernen. wofür steht es? Niemand versteht es… Dann nicht entfernen,
        sondern ausschreiben."

        Er hat beides richtig gesehen: Das Kürzel war unlesbar, und die
        Auskunft dahinter ist wertvoll — wer weiß, dass eine Serie freitags
        kommt, muss nicht täglich nachsehen. Zwei Zeichen zu sparen war der
        schlechteste denkbare Tausch dafür.
      */
      T('antwort.rhythmusWoechentlich', { tag: weekdayName(e.date).toLowerCase() }),
      antwort.letzter && antwort.rest > 1
        ? T('antwort.nochFolgen', { count: antwort.rest - 1, datum: formatDate(antwort.letzter) })
        : T('antwort.letzteFolge'),
    ].join(' · ')
    anteil = antwort.gesamt ? Math.round((antwort.raus / antwort.gesamt) * 100) : undefined
    zaehl = antwort.gesamt
      ? T('antwort.erschienenZahl', { raus: antwort.raus, gesamt: antwort.gesamt })
      : ''
  } else if (antwort.art === 'fertig') {
    /*
      **Eine Auskunft, eine Zeile.**

      Hier standen drei: „Auf Deutsch verfügbar", darunter „Vollständig
      synchronisiert", darunter „Alle 24 Folgen auf Deutsch" — und dazwischen ein
      Balken, der immer voll war. Daniel am 03.09.2026: „blauer kasten sagt quasi
      3x das selbe … 3 zeilen können zu 1 zeile werden".

      Die Wahl fällt auf die **unterste**: „Alle 24 Folgen auf Deutsch" sagt
      alles, was die beiden anderen sagen, und dazu die Zahl. Sie wird zur
      Überschrift, der Rest entfällt — samt Balken, denn ein voller Balken misst
      nichts.
    */
    haupt = antwort.gesamt
      ? T('antwort.fertigZahl', { count: antwort.gesamt })
      : T('antwort.fertigTitel')
    /*
      **„Seit wann?" ist die einzige Frage, die hier noch offen war.**

      Bei 1.985 Titeln haben wir keinen eigenen Termin, aber aniSearch nennt die
      deutsche Erstveröffentlichung mit Verlag — „Cowboy Bebop, 08.01.2003,
      Dybex". Sie füllt die Nebenzeile, die seit dem Zusammenlegen der drei
      Dopplungen leer war, und sagt etwas Neues statt desselben noch einmal.

      Wo wir selbst gemessen haben, steht das Feld gar nicht erst da — die
      Übernahme in `build.ts` überspringt jeden Titel mit Termin.
    */
    neben = deSeitZeile(title, T)
    nebenTitel = title.deErstausgabe ? T('antwort.deSeitQuelle') : undefined
    zaehl = ''
  } else if (antwort.art === 'disc') {
    const rel = relativ(antwort.datum)
    haupt = [rel, formatDate(antwort.datum)].filter(Boolean).join(', ')
    neben = T('antwort.discNeben')
    zaehl = ''
    /*
      Statt eines Balkens die drei Angaben, die es zu einer Disc wirklich gibt.
      Ein Fortschrittsbalken hätte hier keinen Messwert — eine Disc ist am Tag
      ihres Erscheinens zu hundert Prozent da.
    */
    fakten = [
      { wert: antwort.publisher ?? '—', was: T('antwort.faktPublisher') },
      { wert: antwort.edition ?? '—', was: T('antwort.faktEdition') },
      {
        wert: title.fsk !== undefined ? T('antwort.fskAb', { n: title.fsk }) : '—',
        was: T('antwort.faktFsk'),
      },
    ]
  } else if (antwort.art === 'film') {
    haupt = antwort.hatSynchro ? T('antwort.filmTitel') : T('antwort.filmOhneTitel')
    neben = antwort.hatSynchro ? T('antwort.filmNeben') : T('antwort.filmOhneNeben')
    gedaempft = !antwort.hatSynchro
    zaehl = ''
    // Drei Angaben, die es bei einem Film wirklich gibt — statt eines Balkens
    // ohne Messwert. Fehlt eine (FSK hat nur die Hälfte der Filme), bleibt ihr
    // Platz leer, statt die Zeile zu verschieben.
    fakten = [
      { wert: title.jpYear ? String(title.jpYear) : '—', was: T('antwort.faktErschienen') },
      {
        wert: title.fsk !== undefined ? T('antwort.fskAb', { n: title.fsk }) : '—',
        was: T('antwort.faktFsk'),
      },
      { wert: title.studios?.[0] ?? '—', was: T('antwort.faktStudio') },
    ]
  } else {
    /*
      Dieselbe Dopplung wie oben, nur verneint: „Noch keine deutsche Fassung",
      „Bisher kein deutscher Anbieter", „Keine Folge auf Deutsch" — dreimal
      dasselbe Nein, dazu ein leerer Balken. Es bleibt der Satz, der die Frage
      beantwortet.
    */
    haupt = T('antwort.ohneTitel')
    /*
      **Auch ein Nein braucht die Gegenstimme.**

      361 Titel im Bestand haben keinen eigenen Synchro-Beleg, bei 227 von ihnen
      führt aniSearch eine deutsche Fassung — meist alte OVAs und Specials
      deutscher Publisher, die nie gestreamt wurden und deshalb in unseren
      Streaming-Quellen gar nicht auftauchen können („M.D. Geist, 1997, OVA
      Films"). „Noch keine deutsche Fassung" ist dort das Letzte, was jemand
      lesen sollte, der genau danach sucht.

      Der Kasten sagt weiter, was **wir** belegen können — und darunter, was die
      Fremdquelle sagt. Beides zusammen ist die ehrliche Auskunft.
    */
    neben = deSeitZeile(title, T)
    nebenTitel = title.deErstausgabe ? T('antwort.deSeitQuelle') : undefined
    gedaempft = true
    zaehl = ''
  }

  return (
    /*
      **Eine Höhe für alle Zustände.**

      Der Kasten trug bisher `min-h` und wuchs mit dem, was drinstand: ein Titel
      mit zwei Anbietern war höher als einer ohne, und beim Wechsel zwischen zwei
      Teilen derselben Reihe sprang alles darunter (Daniel, 03.09.2026, mit drei
      Bildern: „height Änderung der Box durch feste Höhe verhindern").

      Die 11,75rem sind gerechnet, nicht geraten: Kopfbereich (Überschrift,
      Nebenzeile, Balken oder Faktenzeile, Zählzeile) plus Trennlinie plus zwei
      reservierte Pillenreihen. Was nicht hineinpasst, läuft in den Pillen nach
      rechts — der Kasten selbst bleibt, wie er ist.
    */
    <section
      className={[
        'relative flex h-[11.75rem] flex-col rounded-xl border p-3',
        gedaempft
          ? 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]'
          : 'border-sky-400/40 bg-gradient-to-b from-sky-500/15 to-transparent dark:border-sky-400/30',
      ].join(' ')}
    >
      {beides && (
        <div
          className="absolute right-2.5 top-2.5 inline-flex rounded-full border border-slate-300/60 bg-white/70 p-0.5 text-[11px] dark:border-white/15 dark:bg-black/25"
          role="tablist"
          aria-label={T('where.umschalter')}
        >
          {[
            { an: false, text: T('where.umschalterStream') },
            { an: true, text: T('where.umschalterDisc') },
          ].map((o) => (
            <button
              key={String(o.an)}
              type="button"
              role="tab"
              aria-selected={zeigeDisc === o.an}
              onClick={() => setZeigeDisc(o.an)}
              className={[
                'rounded-full px-2.5 py-0.5 transition',
                zeigeDisc === o.an
                  ? 'bg-slate-900 font-medium text-white dark:bg-white/90 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              ].join(' ')}
            >
              {o.text}
            </button>
          ))}
        </div>
      )}
      {/*
        **Der Kopf steht mittig im freien Platz.**

        Die feste Höhe ist auf den längsten Zustand gerechnet — eine laufende
        Staffel mit Datum, Rhythmus, Balken und Zählzeile. Bei „Alle 24 Folgen
        auf Deutsch" bleibt davon eine Zeile übrig, und oben klaffte ein Loch,
        während die Pillen unten klebten. `justify-center` verteilt die Luft auf
        beide Seiten, statt sie an einer Stelle zu sammeln.
      */}
      <div className="flex flex-1 flex-col justify-center">
      <p
        className={[
          'text-lg font-bold leading-tight tracking-tight',
          /* Platz für den Umschalter, damit eine lange Überschrift nicht darunter läuft. */
          beides ? 'pr-28' : '',
          gedaempft ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white',
        ].join(' ')}
      >
        {haupt}
      </p>
      {neben && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" title={nebenTitel}>
          {neben}
        </p>
      )}

      {fakten ? (
        <div className="mt-2 flex gap-4">
          {fakten.map((f) => (
            <span key={f.was} className="flex flex-col leading-tight">
              <b className="text-[13px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {f.wert}
              </b>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{f.was}</span>
            </span>
          ))}
        </div>
      ) : anteil === undefined ? (
        /*
          **Kein Balken, wo es nichts zu messen gibt.**

          Bei „vollständig" war er immer voll, bei „keine Fassung" immer leer —
          in beiden Fällen sagte er dasselbe wie die Zeile darüber. Er bleibt,
          wo er einen echten Zwischenstand zeigt: bei einer laufenden Staffel.
        */
        null
      ) : (
        <div
          className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
          aria-hidden="true"
        >
          <span
            className={anteil === 0 ? 'bg-slate-300 dark:bg-white/15' : 'bg-emerald-500'}
            style={{ width: `${anteil === 0 ? 100 : (anteil ?? 100)}%` }}
          />
          {anteil !== undefined && anteil > 0 && anteil < 100 && (
            <span className="bg-emerald-500/25" style={{ width: `${100 - anteil}%` }} />
          )}
        </div>
      )}

      {zaehl && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{zaehl}</p>}
      </div>
      {pillen.length > 0 && (
        <div className="border-t border-slate-200/70 pt-2.5 dark:border-white/10">
          <div
            className="grid min-h-[4.25rem] grid-flow-col grid-rows-2 justify-start gap-1.5 overflow-x-auto pb-1"
            style={{ gridAutoColumns: 'max-content' }}
          >
            {pillen}
          </div>
        </div>
      )}
    </section>
  )
}

function ReleaseBlock({ release, today }: { release: Release; today: string }) {
  const { t } = useLang()
  const events = useMemo(() => expandEvents(release), [release])
  const status = releaseStatus(release, today)
  const last = lastEpisodeDate(release)
  // „11" neben einer Liste, die bei „2." beginnt, liest sich wie ein Fehler.
  // Fängt das Release mitten in der Reihe an, steht hier die Spanne.
  const episodeSpan = useMemo(() => {
    const count = release.schedule.episodeCount
    if (!count) return undefined
    const first = Math.max(1, release.schedule.firstEpisodeNumber ?? 1)
    return first === 1 ? String(count) : `${first}–${first + count - 1}`
  }, [release.schedule.episodeCount, release.schedule.firstEpisodeNumber])

  /**
   * Wie viele Folgen schon da sind — aber nur, solange noch welche kommen.
   *
   * „14" beantwortet, wie lang die Staffel wird. Die Frage beim Reinschauen ist
   * eine andere: Wie viel kann ich jetzt sehen? Deshalb steht bei einer
   * laufenden Serie **3/14** statt einer nackten Vierzehn (Daniel, 21.08.2026).
   *
   * Gezählt wird aus denselben Terminen, die auch die Liste darunter füllt —
   * sonst widerspräche sich die Seite selbst. Ist alles erschienen, bleibt es
   * bei der schlichten Zahl: „14/14" sagt nichts, was „14" nicht auch sagt.
   */
  const erschienen = useMemo(() => {
    /**
     * Gezählt wird nach **Datum und Uhrzeit**, nicht nach Tag.
     *
     * Vorher stand hier `e.date <= todayIso()`. Das zählte die heutige Folge
     * ab Mitternacht mit — bei „Mushoku Tensei" mit Sendezeit 17:00 also
     * siebzehn Stunden zu früh (Daniel, 23.08.2026: „um 16:59 sollte im panel
     * 4 stehen, ab 17:00 uhr sollte dort 5 stehen").
     */
    const raus = events.filter((e) => istErschienen(e)).length
    return raus > 0 && raus < events.length ? raus : undefined
  }, [events])
  const [showAll, setShowAll] = useState(false)
  /** Die volle Terminliste erscheint erst auf Wunsch. */
  const [alleTermine, setAlleTermine] = useState(false)
  const shown = showAll ? events : events.slice(0, 8)

  /**
   * Der Satz, der das Datum einordnet — als Hovertext, nicht als Absatz.
   *
   * „Im Angebot seit 11.06.2025" liest sich sonst wie ein Erscheinungstermin,
   * und der wäre bei Sword Art Online zwölf Jahre daneben. Als eigener Absatz
   * stand die Erklärung aber bei jedem Katalogtitel im Weg. Das gepunktete
   * Unterstreichen zeigt an, dass da noch etwas steht.
   */
  const datumErklaerung =
    release.dateMeaning === 'available-from' ? t('detail.availableFromNote') : undefined

  /**
   * Die nächste Folge ist die nächste **noch nicht erschienene**.
   *
   * Vorher stand hier `e.date >= today`. Damit blieb der heutige Termin bis
   * Mitternacht die „nächste Folge" — auch um 22 Uhr, fünf Stunden nachdem sie
   * lief (Daniel, 23.08.2026, mit Bild: „Nächste Folge 23.08.2026", während
   * die Zeile darüber schon 5/14 zählte).
   *
   * `kuenftige` bleibt bewusst beim Tagesvergleich: Es füttert den
   * ICS-Export und das Kalender-Abo, und dort gehört der heutige Termin
   * hinein. Wer eine Datei lädt, will den ganzen Tag darin haben.
   */
  const naechster = events.find((e) => !istErschienen(e))
  const kuenftige = events.filter((e) => e.date >= today)

  /**
   * Die eine Hauptaktion dieses Termins — Beschriftung samt Zielort.
   *
   * Drei Fälle, und sie unterscheiden sich in dem, was der Leser tun **kann**:
   *
   * - **Disc, Termin liegt noch vor uns:** Vorbestellen. „Ansehen" wäre hier
   *   schlicht falsch — es gibt noch nichts zu sehen.
   * - **Disc, Termin ist durch:** Kaufen.
   * - **Stream:** Ansehen, mit dem Namen des Anbieters.
   *
   * Der Zielort steht in jedem Fall dabei. Ein Knopf, der nicht verrät, wohin er
   * führt, ist eine Zumutung — man klickt und landet irgendwo (Daniel,
   * 15.08.2026: „da sollte ein amazon logo sein, wenn der link zu amazon führt,
   * sodass man vorher bescheid weiß, bevor man draufklickt").
   */
  const hauptAktion = useMemo(() => {
    const kauf = release.buyUrl
    if (release.releaseType === 'disc' && kauf) {
      const kuenftig = release.schedule.firstEpisodeDate > today
      return {
        url: kauf,
        label: t(kuenftig ? 'detail.preorderAt' : 'detail.buyAt', { shop: shopName(kauf) }),
      }
    }
    if (release.platformUrl) {
      return {
        url: release.platformUrl,
        label: t('detail.watchOn', { platform: PLATFORMS[release.platform].name }),
      }
    }
    return kauf ? { url: kauf, label: t('detail.buyAt', { shop: shopName(kauf) }) } : undefined
  }, [release, today, t])

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ReleaseTypeBadge type={release.releaseType} />
        <PlatformBadge platform={release.platform} />
        <StatusBadge status={status} />
        {release.fsk !== undefined && <FskBadge fsk={release.fsk} />}
        {release.schedule.estimated && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-500 ring-1 ring-amber-500/40">
            ≈ {t('detail.estimatedDate')}
          </span>
        )}
      </div>

      {/*
        **Woher die Schätzung kommt — im Detail, nicht in der Kachel.**

        „Termin abgeleitet" stand bis zum 01.09.2026 als Etikett da und warf die
        Frage auf, wovon. Daniel: „wir wollen ehrlich sein, aber gleichzeitig
        vertrauenswürdig und best mögliche quelle. es ist eine schätzung
        basierend auf bisherigen daten und erfahrungen … aber sicherheit gibt es
        erst nach bestätigung der titel bei den anbietern."

        Der Satz nennt die **Grundlage**, nicht einen Vorbehalt. Daniels
        Verschärfung im selben Zug: „unser gewähltes datum, wovon wir ausgehen
        das es stimmt, sollte nicht von uns selbst angezweifelt werden." Ein
        Kalender, der seinen eigenen Termin relativiert, nimmt dem Leser die
        Entscheidung ab, für die er hergekommen ist — deshalb steht dort, woher
        der Tag kommt und dass wir nachziehen, nicht, dass man ihm misstrauen
        soll.

        Die Quellen selbst stehen ohnehin weiter unten im Panel, verlinkt.
      */}
      {release.schedule.estimated && (
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {t('detail.estimatedWhy')}
        </p>
      )}

      {/*
        Der Name des Releases stand hier bis zum 12.08.2026 und wiederholte nur
        den Eintrag, der drei Zeilen darüber im Umschalter gewählt ist. Zwei
        Zeilen für dieselbe Auskunft sind eine zu viel.
      */}
      {(release.publisher || release.edition) && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {[release.publisher, release.edition].filter(Boolean).join(' · ')}
        </p>
      )}
      {/*
        Eine lange Notiz gehört eingeklappt, nicht in einen gelben Kasten.

        Bis zum 25.08.2026 stand `note` immer voll ausgeschrieben da. Solange
        dort ein Halbsatz stand („Wiederaufführung zum 25. Jubiläum"), war das
        richtig. Seit die Kino-Einträge die Fassungslage im Klartext tragen —
        wie viele Vorstellungen auf Deutsch, wie viele im Original, ab wann nur
        noch eine —, sind es acht Zeilen, die den Termin darunter wegdrücken.

        Daniel am 25.08.2026: „mach diesen gelben text kürzer, bzw schieb ihn
        unten in ausklapp bereich oder mach hinter das ‚im kino ab'-datum ein
        ausklapp icon, und zeig es dann darunter an."

        Kurze Notizen bleiben deshalb sichtbar, lange klappen auf. Die Schwelle
        liegt bei 120 Zeichen: Das ist etwa das, was in zwei Zeilen passt, ohne
        den Blick vom Termin zu ziehen.
      */}
      {release.note &&
        (release.note.length <= 120 ? (
          <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            {release.note}
          </p>
        ) : (
          <details className="group mt-1">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-2 py-1 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
              <span aria-hidden className="transition group-open:rotate-90">
                ›
              </span>
              {t('detail.noteToggle')}
            </summary>
            <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              {release.note}
            </p>
          </details>
        ))}
      {/*
        Zwei Termine, keiner belegbar — dann stehen beide da.

        Nicht heimlich einen wählen: Wenn zwei Quellen verschiedene Tage nennen
        und keine sich belegen lässt, bekommt der Leser beide samt Quelle und
        entscheidet selbst (Daniels Regel, 13.08.2026). Der Kalender führt
        weiterhin nur einen Termin — zwei Einträge würden behaupten, es gebe
        zwei Veröffentlichungen, und das wäre die schlimmere Falschaussage.
      */}
      {release.disputedDates?.length ? (
        <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          {t('detail.disputedDate')}{' '}
          {release.disputedDates.map((d, i) => (
            <span key={d.date}>
              {i > 0 && ', '}
              <a
                href={d.source}
                target="_blank"
                rel="noreferrer noopener"
                className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-500"
              >
                {formatDate(d.date)}
              </a>
            </span>
          ))}
          {/*
            Kein Gedankenstrich. Er stand hier im Bauteil statt im Text und
            überlebte deshalb den Durchgang durch alle Oberflächentexte
            (Daniel, 15.08.2026: „das ist eindeutig ki, kein mensch macht das").
            Wo ein Satz endet, steht ein Punkt.
          */}
          {'. '}
          {t('detail.disputedDateHint')}
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <dt className="text-slate-400">
          {t(
            release.dateMeaning === 'available-from'
              ? 'detail.availableFrom'
              : release.releaseType === 'movie'
                ? 'detail.startCinema'
                : release.releaseType === 'disc'
                  ? 'detail.startDisc'
                  : 'detail.start',
          )}
        </dt>
        <dd className="tabular-nums">
          {/*
            Datum und Uhrzeit in einer Zeile.

            Vorher standen sie als zwei Einträge untereinander, und fehlte die
            Uhrzeit, stand dort „unbekannt" samt Erklärknopf daneben. Das war
            eine ganze Zeile für die Auskunft, dass wir nichts wissen — bei
            Netflix und Prime also fast immer. Jetzt steht die Uhrzeit hinter
            dem Datum, wenn es eine gibt, und sonst gar nichts (Daniel,
            12.08.2026).
          */}
          {datumErklaerung ? (
            <Tooltip text={datumErklaerung} unterstrichen>
              {weekdayName(release.schedule.firstEpisodeDate, true)},{' '}
              {formatDate(release.schedule.firstEpisodeDate)}
            </Tooltip>
          ) : (
            <>
              {weekdayName(release.schedule.firstEpisodeDate, true)},{' '}
              {formatDate(release.schedule.firstEpisodeDate)}
            </>
          )}
          {release.schedule.time && (
            <span className="text-slate-400"> · {release.schedule.time} Uhr</span>
          )}
        </dd>
        {/*
          **Warum hier keine Uhrzeit steht — an der Stelle, an der die Frage
          entsteht.**

          Bis zum 01.09.2026 stand in der Kachel „Zeit offen". Der Satz warf
          eine Frage auf, statt eine zu beantworten, und Daniels Sorge geht
          weiter als die Formulierung: „dann zweifeln [Nutzer] das die daten
          überhaupt stimmen, und vertrauen zu uns verlieren."

          Die Antwort lag längst im Haus — `PLATFORM_TIME_NOTE` steht seit
          Wochen in `shared/mappings.ts` und wurde nie angezeigt. Meist gibt es
          die Angabe beim Anbieter schlicht nicht, und das zu sagen ist etwas
          anderes, als eine Lücke unkommentiert zu lassen.
        */}
        {!release.schedule.time && PLATFORM_TIME_NOTE[release.platform] && (
          <dd className="col-span-2 mt-0.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {PLATFORM_TIME_NOTE[release.platform]!.de}
            {PLATFORM_TIME_NOTE[release.platform]!.source && (
              <>
                {' '}
                <a
                  href={PLATFORM_TIME_NOTE[release.platform]!.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-sky-500"
                >
                  {t('detail.timeNoteSource')}
                </a>
              </>
            )}
          </dd>
        )}
        {/*
          Eine Zeile, die sagt, was gerade zählt.

          Vorher standen „Start" und „Letzte Folge" nebeneinander, und bei einer
          laufenden Serie war beides die Vergangenheit — die Frage „wann kommt
          die nächste?" beantwortete keine der beiden (Daniel, 15.08.2026).
          Jetzt richtet sich die Zeile nach dem Stand: kommt noch etwas, steht
          hier die nächste Folge; ist alles durch, die letzte.
        */}
        {release.releaseType === 'weekly' && (
          <>
            <dt className="text-slate-400">{t('detail.episodes')}</dt>
            <dd className="tabular-nums">
              {/*
                Beginnt das Release mitten in der Zählung, steht hier die
                Spanne statt einer nackten Anzahl. „11" neben einer Liste, die
                bei „2." anfängt, liest sich sonst wie ein Widerspruch.
              */}
              {erschienen !== undefined && episodeSpan ? (
                <>
                  <span className="text-sky-500 dark:text-sky-400">{erschienen}</span>
                  <span className="text-slate-400">/</span>
                  {episodeSpan}
                </>
              ) : (
                (episodeSpan ?? '—')
              )}
              {release.schedule.episodeCountAssumed && (
                <span className="ml-1 text-amber-500">
                  <Tooltip
                    text={
                      release.schedule.episodeCountSource === 'anisearch'
                        ? t('detail.assumedEpisodesAnisearch')
                        : t('detail.assumedEpisodes')
                    }
                    unterstrichen
                  >
                    ≈
                  </Tooltip>
                </span>
              )}
            </dd>
            {(naechster || last) && (
              <>
                <dt className="text-slate-400">
                  {t(naechster ? 'detail.nextEpisode' : 'detail.lastEpisode')}
                </dt>
                <dd className="tabular-nums">
                  {formatDate(naechster ? naechster.date : (last as string))}
                  {/*
                    Die Uhrzeit gehört hierher, nicht nur zum Start.
                    „23.08.2026" beantwortet die Frage halb — wer heute Abend
                    einschalten will, braucht die Stunde (Daniel, 23.08.2026:
                    „bei nächste folge sollte auch uhrzeit stehen").

                    Am Termin selbst, nicht am Sendeplan: Bei einem geteilten
                    Start kann die erste Welle zu einer anderen Zeit kommen als
                    der Wochentakt danach.
                  */}
                  {(naechster?.time ?? release.schedule.time) && (
                    <span className="text-slate-400">
                      {' · '}
                      {naechster?.time ?? release.schedule.time} Uhr
                    </span>
                  )}
                </dd>
              </>
            )}
          </>
        )}
      </dl>

      {/*
        Die Hauptaktion nimmt die ganze Zeile, der Rest teilt sich die nächste.

        Vorher standen alle Knöpfe in einer umbrechenden Reihe, und der
        wichtigste — „Bei ADN ansehen" — war genauso breit wie „Teilen" daneben
        (Daniel, 15.08.2026). Jetzt liegt er allein oben über die volle Breite,
        und die übrigen teilen die Zeile darunter zu gleichen Teilen: bei zweien
        je die Hälfte, bei dreien je ein Drittel. Das übernimmt `grid` mit
        `auto-cols-fr`, ohne dass die Zahl im Code stehen muss.
      */}
      <div className="mt-3 flex flex-col gap-2">
        {/*
          **Eine** Hauptaktion, und sie sagt, was passiert und wo.

          Vorher standen hier zwei Knöpfe nebeneinander — „Bei DVD / Blu-ray
          ansehen" und „Kaufen" —, die bei Disc-Terminen auf **dieselbe** Adresse
          zeigten (Daniel, 15.08.2026: „was bringt der kaufen button wenn er auf
          genau das gleiche verlinkt"). Dazu passte „ansehen" nicht: Der Termin
          liegt in der Zukunft, man kann dort nichts ansehen, man kann
          vorbestellen.

          Die Beschriftung richtet sich deshalb nach beidem — Art des Releases
          **und** Lage des Termins —, und der Zielort steht dabei. Das ist das
          Muster von JustWatch und aniSearch: Handlung plus Anbieter in einem
          Feld, statt eines Knopfes, der nicht verrät, wohin er führt.
        */}
        {hauptAktion && (
          <Button href={hauptAktion.url} variant="primary" size="sm" breit>
            {hauptAktion.label}
          </Button>
        )}
        <div className="grid grid-flow-col auto-cols-fr gap-2 empty:hidden">
        {/*
          Eintragen kann man nur, was noch kommt.

          Bei einem Katalogtitel, der seit einem Jahr im Angebot ist, führte
          „Zu Google Calendar" zu einem Termin in der Vergangenheit, und die
          ICS-Datei enthielt lauter abgelaufene Einträge. Beide Knöpfe standen
          also überall, halfen aber nur bei einem Bruchteil der Titel (Daniel,
          12.08.2026).
        */}
        {naechster && (
          <Button href={googleCalendarUrl(naechster)} size="sm">
            📅 {t('detail.addToGoogleAction')}
          </Button>
        )}
        {kuenftige.length > 0 && (
          <Button
            size="sm"
            onClick={() => downloadIcs(kuenftige, release.name.replace(/[^\w\s-]/g, '').trim() || release.slug)}
          >
            ⬇ {t('detail.downloadIcs')}
            {/*
              Der Knopf sagt seit dem 24.08.2026 „Kalenderdatei laden" statt
              „.ics laden" — das Kürzel steht für nichts, was man erraten kann.
              Womit sich die Datei öffnen lässt, sagt weiterhin der Hinweis; das
              gehört nicht auf einen Knopf.
            */}
            <Tooltip text={t('detail.downloadIcsHint')} seite="oben">
              <span className="ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border border-current align-[1px] text-[10px] leading-none font-bold opacity-60">
                ?
              </span>
            </Tooltip>
          </Button>
        )}
        </div>
      </div>

      {/*
        Die Terminliste ist zugeklappt. Bei einer Zwölfteiler-Serie standen dort
        zwölf Zeilen, die fast immer schon vorbei sind — sie füllten das halbe
        Panel für eine Auskunft, die die wenigsten suchen (Daniel, 15.08.2026).
      */}
      {events.length > 1 && !alleTermine && (
        <button
          type="button"
          onClick={() => {
            // Ein Klick, alle Termine. Vorher klappte er die Liste auf, zeigte
            // acht davon und verlangte denselben Klick ein zweites Mal (Daniel,
            // 15.08.2026).
            setAlleTermine(true)
            setShowAll(true)
          }}
          className="mt-2 cursor-pointer text-xs text-sky-500 hover:underline"
        >
          {t('detail.showAllDates', { count: events.length })}
        </button>
      )}
      {events.length > 1 && alleTermine && (
        <div className="mt-3">
          <SectionTitle>{t('detail.allDates')}</SectionTitle>
          <ul className="flex flex-col gap-0.5">
            {shown.map((ev) => (
              <li
                key={ev.id}
                className={[
                  'flex items-center gap-2 rounded px-1.5 py-1 text-xs',
                  ev.date < today ? 'opacity-50' : '',
                  ev.date === today ? 'bg-sky-500/10 font-semibold text-sky-500' : '',
                ].join(' ')}
              >
                <span className="w-6 shrink-0 tabular-nums text-slate-400">{ev.episode}.</span>
                <span className="tabular-nums">
                  {weekdayName(ev.date, true)} {formatDate(ev.date)}
                </span>
                <span className="tabular-nums text-slate-400">{ev.time}</span>
                {/*
                  Eintragen lässt sich nur, was noch kommt. Bei einer Serie, die
                  2024 gelaufen ist, stand hinter jeder Folge ein Knopf, der
                  einen Termin in der Vergangenheit anlegt — sinnlos, und bei
                  zwölf Folgen zwölfmal (Daniel, 15.08.2026).
                */}
                {ev.date >= today && (
                  <a
                    className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-sky-500/10 hover:text-sky-400"
                    href={googleCalendarUrl(ev)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t('detail.addSingle')}
                  >
                    📅 <span className="hidden sm:inline">{t('detail.addToGoogle')}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {events.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-1 cursor-pointer text-xs text-sky-500 hover:underline"
            >
              {showAll ? t('detail.showFewer') : t('detail.showAllDates', { count: events.length })}
            </button>
          )}
        </div>
      )}

      <Quellenliste release={release} />
    </section>
  )
}

/**
 * Die Belegkette eines Termins — aktuelle Quellen offen, überholte auf Klick.
 *
 * Zwei Anforderungen stehen sich hier gegenüber, und beide sind berechtigt:
 * Eine überholte Quelle darf **nie verloren gehen** (sonst ist später nicht
 * mehr zu klären, woher ein alter Termin kam), aber fünf Adressen unter einem
 * Termin sind Quellen-Spam und niemand liest sie.
 *
 * Die Auflösung ist dieselbe, die Wikipedia für Einzelnachweise wählt: sichtbar
 * bleibt, was den geltenden Stand trägt; alles Ältere steht **eingeklappt mit
 * Anzahl** dahinter und ist einen Klick entfernt.
 */
function Quellenliste({ release }: { release: Release }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  // Rückfall auf `sources`: ältere Datensätze haben noch keine `quellen`.
  const alle: Quelle[] =
    release.quellen ??
    release.sources.map((url) => ({ url, name: hostname(url), gesehenAm: '', stand: 'aktuell' as const }))
  if (!alle.length) return null

  const aktuell = alle.filter((q) => q.stand !== 'ueberholt' && q.stand !== 'vermutlich-ueberholt')
  const alt = alle.filter((q) => q.stand === 'ueberholt' || q.stand === 'vermutlich-ueberholt')

  return (
    <div className="mt-3 text-[11px] text-slate-400">
      <p>
        {t('detail.source')}:{' '}
        {(aktuell.length ? aktuell : alle).map((q, i) => (
          <span key={q.url}>
            {i > 0 && ', '}
            {istMaschinenquelle(q.url) ? (
              /*
                Der Name kommt aus unserer eigenen Plattformliste, nicht aus der
                Adresse. Ein erster Versuch zerlegte den Hostnamen und machte aus
                `gw.api.animationdigitalnetwork.com` ein „Api" — geraten statt
                nachgesehen, und prompt falsch (15.08.2026).
              */
              t('detail.sourceProvider', { anbieter: PLATFORMS[release.platform].name })
            ) : (
              <a
                href={q.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-sky-400"
              >
                {q.name || hostname(q.url)}
              </a>
            )}
          </span>
        ))}
        {release.automatisch && (
          <>
            {' · '}
            <Tooltip text={t('detail.autoSourceHint')}>
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {t('detail.autoSource')}
              </span>
            </Tooltip>
          </>
        )}
      </p>

      {alt.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            className="mt-1 cursor-pointer underline decoration-dotted underline-offset-2 hover:text-sky-400"
          >
            {offen
              ? t('detail.olderSourcesHide')
              : t(alt.length === 1 ? 'detail.olderSource' : 'detail.olderSources', { count: alt.length })}
          </button>
          {offen && (
            <ul className="mt-1 space-y-0.5 border-l border-slate-300 pl-2 dark:border-slate-700">
              {alt.map((q) => (
                <li key={q.url} className="text-slate-400/70 dark:text-slate-500">
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="line-through underline hover:text-sky-400"
                  >
                    {q.name || hostname(q.url)}
                  </a>{' '}
                  <span className="italic">
                    {q.stand === 'ueberholt' ? t('detail.sourceStale') : t('detail.sourceMaybeStale')}
                  </span>
                  {q.grund && <span className="block">{q.grund}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Was Meldungen über einen Titel sagen, ohne einen Tag zu nennen.
 *
 * Der Grund, dass es diesen Block gibt: Von 29 Meldungen, die der Bot am
 * 14.08.2026 gefunden hatte, nannten zehn nur einen Monat. Bis dahin
 * verschwanden sie in einer Datei, auf die ein Mensch hätte reagieren müssen —
 * für Besucher waren sie schlicht nicht vorhanden, obwohl die Information da
 * war.
 *
 * Jetzt steht sie da, wie sie ist: mit Zitat, mit Datum, mit Link. Ein Termin
 * wird daraus **nicht** — aus „im September" einen Ersten zu machen wäre genau
 * die Falschangabe, gegen die dieses Projekt gebaut ist.
 */
function Meldungen({ titleId }: { titleId: number }) {
  const { t } = useLang()
  const [liste, setListe] = useState<Meldung[]>([])
  const [offen, setOffen] = useState(false)

  useEffect(() => {
    let aktuell = true
    loadMeldungen().then((nachTitel) => {
      if (aktuell) setListe(nachTitel.get(titleId) ?? [])
    })
    return () => {
      aktuell = false
    }
  }, [titleId])

  if (!liste.length) return null

  return (
    <div className="mt-2">
      {/*
        Ein Aufklapper statt eines eigenen Abschnitts, und er sitzt beim Termin.

        Vorher stand der Block weit unten zwischen „Wo läuft es" und „Handlung",
        mit eigener Überschrift und einer wiederholten Quellenzeile — dieselbe
        Adresse, die drei Zeilen weiter oben schon unter dem Termin steht
        (Daniel, 15.08.2026). Was eine Zusatzangabe zum Termin ist, gehört zum
        Termin und bleibt bis zum Klick zusammengefaltet.
      */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="cursor-pointer text-xs text-sky-500 hover:underline"
      >
        {offen ? t('detail.newsHide') : t('detail.newsShow', { count: liste.length })}
      </button>
      {!offen ? null : (
      <>
      <p className="mb-2 mt-2 text-xs text-slate-500 dark:text-slate-400">{t('detail.newsHint')}</p>
      <ul className="space-y-2">
        {liste.map((m) => (
          <li
            key={m.quelle.url}
            className="rounded border-l-2 border-sky-500/50 bg-slate-500/5 py-1.5 pl-2 pr-2 text-xs"
          >
            <a
              href={m.quelle.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold underline hover:text-sky-400"
            >
              {m.titel}
            </a>
            {m.zitat && (
              <p className="mt-1 italic leading-relaxed text-slate-500 dark:text-slate-400">
                „… {m.zitat} …"
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              {m.quelle.name} · {formatDate(m.datum)}
            </p>
          </li>
        ))}
      </ul>
      </>
      )}
    </div>
  )
}

/**
 * Bündelt Ausgaben, die im Grunde dasselbe sind.
 *
 * „Banana Fish – Vol. 1" und „Vol. 2" standen als zwei fast identische Kästen
 * untereinander: gleiche Plakette, gleicher Verlag, gleiche Knöpfe, und der
 * einzige Unterschied — Volume und Datum — ging darin unter (Daniel,
 * 15.08.2026: „unnötige dopplung von infos … man kann sowas gut zusammenfassen").
 *
 * Zusammengefasst wird nach **Anbieter, Art und Verlag**. Das ist eng genug,
 * dass keine ungleichen Dinge zusammenfallen: Eine Disc von peppermint und ein
 * Crunchyroll-Stream bleiben getrennt, ebenso eine Disc von AniMoon neben einer
 * von peppermint. Und es ist weit genug, dass eine Volume-Reihe eine Karte
 * ergibt statt vier.
 *
 * Das Muster stammt von aniSearch, das seine deutschen Ausgaben ebenfalls je
 * Zeile führt, aber nur mit dem, was sie **unterscheidet** — der Serientitel
 * steht dort ausschließlich im Seitenkopf.
 */
/**
 * Ein Shop in einer Zeile — mit allen Ausgaben nebeneinander.
 *
 * Bei einem einzigen Eintrag ist die ganze Zeile der Verweis, wie bisher. Bei
 * mehreren steht der Shop links und daneben die Ausgaben als kleine Knöpfe: vier
 * Ausgaben bei AniMoon sind eine Auskunft, keine vier Zeilen.
 */
/**
 * Ein Bezugsweg als Pille — Anbieter, Bedingung und Sprachmarke in einem Stueck.
 *
 * Bis zum 25.08.2026 stand jeder Weg in einer eigenen, volle Breite langen
 * Zeile. Bei "Dan Da Dan Staffel 2" waren das vier Zeilen fuer vier Anbieter,
 * darunter dieselben Anbieter noch einmal als Terminbloecke. Daniel: "viel zu
 * schlecht praesentiert ... es muss ein kleiner schnell ersichtlicher
 * klickbarer bereich sein, uebersichtlich, stream pills und kauf pills, alle
 * infos in die pills."
 *
 * **Was in der Pille steht, steht im Datensatz.** Die zweite Zeile nennt die
 * Bedingung — Abo, kostenlos, Kanal —, nicht die Folgenzahl: Ein Stream-Verweis
 * zeigt auf die **Serie**, nicht auf unsere Staffel. Daniel am 25.08.2026 zu
 * einem Entwurf, der "12 Folgen" behauptete: "ADN hat folgen 1-24, netflix
 * auch, crunchy auch." Eine Folgenangabe erscheint nur, wo `dubRanges` eine
 * belegte Grenze kennt — also dort, wo der deutsche Ton wirklich aufhoert.
 */
function Pille({
  name,
  farbe,
  url,
  unten,
  rechts,
  titel,
}: {
  name: string
  farbe?: string
  url: string
  unten?: string
  rechts?: ReactNode
  titel?: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={titel}
      className={[
        'inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 transition',
        farbe
          ? 'hover:brightness-95 dark:hover:brightness-125'
          : 'border border-slate-200 hover:bg-slate-100/60 dark:border-white/10 dark:hover:bg-white/5',
      ].join(' ')}
      style={farbe ? { background: `${farbe}1f`, boxShadow: `inset 0 0 0 1px ${farbe}55` } : undefined}
    >
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-medium" style={farbe ? { color: farbe } : undefined}>
          {name}
        </span>
        {unten && (
          <span
            className={`truncate text-[11px] ${farbe ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}
            style={farbe ? { color: farbe } : undefined}
          >
            {unten}
          </span>
        )}
      </span>
      {rechts && <span className="ml-auto flex shrink-0 items-center gap-1">{rechts}</span>}
    </a>
  )
}

/**
 * Eine Ausgabe, die es noch nicht gibt — mit Erinnerungsknopf.
 *
 * Daniel am 25.08.2026: "in die kaufen pills kennzeichnen das es datum in
 * zukunft ist, und kalender eintrag fuer erinnerung klickbar anzeigen, ausserdem
 * kaufen (vorbestellen) bereich extra fuer kauf titel in zukunft, dann muss es
 * nicht in jedem pill stehen."
 *
 * Deshalb steht "vorbestellen" **einmal** ueber der Reihe und nicht in jeder
 * Pille. Der Kalenderknopf sitzt in der Pille, weil er zum einzelnen Termin
 * gehoert; er fuehrt auf denselben Google-Eintrag wie der Knopf im Terminblock.
 */
/**
 * Streicht aus dem Namen einer Ausgabe den Serientitel, der ohnehin daneben steht.
 *
 * „DAN DA DAN (Staffel 2) – Vol. 3" wird zu „Vol. 3". Geschnitten wird nur ein
 * Vorspann, der wirklich dem Titel entspricht — und nur, wenn danach noch etwas
 * übrig bleibt: Eine Ausgabe, die genauso heißt wie die Serie, behält ihren
 * Namen, sonst stünde dort nichts.
 */
function kuerzeUmTitel(name: string, titel?: string): string {
  if (!titel) return name
  const woerter = titel.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (!woerter.length) return name
  /*
    Geschnitten wird über **Wortgrenzen**, nicht zeichenweise. Der erste Anlauf
    zählte normalisierte Zeichen mit und lief aus dem Takt, sobald zwei
    Trennzeichen aufeinander folgten: „Attack on Titan Staffel 4 Teil 3" wurde
    zu „affel 4 Teil 3" (gemessen am 25.08.2026).
  */
  const trenner = '[^\\p{L}\\p{N}]+'
  /*
    `(?:…)?` und nicht `…?` — sonst steht dort `[^\p{L}\p{N}]+?`, ein **faules
    Plus** statt eines optionalen Trenners, und das Muster passt auf keinen
    einzigen Namen. Gemessen am 25.08.2026: sieben Prüffälle, null Kürzungen.
  */
  const muster = new RegExp(
    `^(?:${trenner})?` +
      woerter.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(trenner) +
      `(?:${trenner})?`,
    'iu',
  )
  const rest = name.replace(muster, '').trim()
  /*
    **Ein Rest, der für sich nichts sagt, ist keine Kürzung.** „Jujutsu Kaisen
    0" unter dem Titel „Jujutsu Kaisen" schrumpfte auf „0" — der Film heißt aber
    wirklich so, und „0" allein steht in der Pille als Rätsel. Reine Ziffern und
    alles unter drei Zeichen behalten deshalb den vollen Namen.
  */
  if (!rest || rest.length < 3 || /^\d+$/.test(rest)) return name
  return rest
}

function VorbestellPille({ release, titel }: { release: Release; titel?: string }) {
  const { t } = useLang()
  const kurzerName = kuerzeUmTitel(release.name, titel)
  const ev = expandEvents(release)[0]
  const datum = release.schedule?.firstEpisodeDate
  const farbe = PLATFORMS[release.platform]?.color
  const zweite = [release.publisher, release.edition].filter(Boolean).join(' · ')
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full py-1 pl-3 pr-1"
      style={farbe ? { background: `${farbe}1f`, boxShadow: `inset 0 0 0 1px ${farbe}55` } : undefined}
    >
      <a
        href={release.buyUrl ?? release.platformUrl ?? '#'}
        target="_blank"
        rel="noreferrer noopener"
        className="flex min-w-0 flex-col py-0.5 leading-tight"
      >
        {/*
          Der Serienname steht drei Zeilen höher im Kopf des Panels — ihn in
          jeder Pille zu wiederholen macht sie breit und sagt nichts Neues.
          Übrig bleibt, was die Ausgaben unterscheidet: „Vol. 3" statt
          „DAN DA DAN (Staffel 2) – Vol. 3".
        */}
        <span className="truncate text-[13px] font-medium" style={farbe ? { color: farbe } : undefined}>
          {kurzerName}
        </span>
        <span className="truncate text-[11px] opacity-80" style={farbe ? { color: farbe } : undefined}>
          {[zweite, datum && formatDate(datum)].filter(Boolean).join(' · ')}
        </span>
      </a>
      {ev && (
        <a
          href={googleCalendarUrl(ev)}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('detail.addToGoogleAction')}
          title={t('detail.addToGoogleAction')}
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:brightness-95 dark:hover:brightness-125"
          style={farbe ? { background: `${farbe}33`, color: farbe } : undefined}
        >
          {/*
            Gezeichnet, nicht als Zeichen: Ein 🗓-Emoji kam in der
            Oberflächenschrift nicht vor und erschien als leeres Kästchen
            (gesehen am 25.08.2026 in beiden Themen). Ein Pfad hängt an keiner
            Schrift.
          */}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18M12 14v4M10 16h4" />
          </svg>
        </a>
      )}
    </span>
  )
}

/**
 * Fasst die Bezugswege eines Shops zu einer Zeile zusammen.
 *
 * Vorher stand jede Ausgabe in einer eigenen Zeile: „AniMoon — Vol. 1",
 * „AniMoon — Vol. 2", „AniMoon — Vol. 3", „AniMoon — Vol. 4" untereinander. Das
 * sind vier Zeilen für eine Auskunft — nämlich, dass es die Serie bei AniMoon in
 * vier Ausgaben gibt (Daniel, 20.08.2026).
 *
 * Gruppiert wird nach **Hostnamen**, nicht nach Anzeigenamen: Derselbe Shop
 * schreibt sich in unseren Daten mal so, mal anders, die Adresse nicht. Der
 * Anzeigename kommt aus dem gemeinsamen Teil vor dem Gedankenstrich; steht dort
 * nichts Gemeinsames, bleibt der volle Name stehen.
 */
function gruppiereKaufwege(links: WatchLink[]): { shop: string; eintraege: { label?: string; url: string }[] }[] {
  const nachHost = new Map<string, WatchLink[]>()
  for (const l of links) {
    let host = l.url
    try {
      host = new URL(l.url).hostname.replace(/^www\./, '')
    } catch {
      // Keine gültige Adresse — dann steht der Eintrag eben für sich allein.
    }
    const liste = nachHost.get(host) ?? []
    liste.push(l)
    nachHost.set(host, liste)
  }

  return [...nachHost.values()].map((liste) => {
    const geteilt = liste.map((l) => l.name.split(/\s+—\s+/))
    const gemeinsam = geteilt.every((t) => t.length > 1 && t[0] === geteilt[0][0])
    if (liste.length === 1 || !gemeinsam) {
      return { shop: liste[0].name, eintraege: liste.map((l) => ({ url: l.url })) }
    }
    return {
      shop: geteilt[0][0],
      eintraege: liste.map((l, i) => ({ label: geteilt[i].slice(1).join(' — '), url: l.url })),
    }
  })
}

function gruppiereReleases(releases: Release[]): Release[][] {
  const nachSchluessel = new Map<string, Release[]>()
  for (const r of releases) {
    const key = `${r.platform}|${r.releaseType}|${r.publisher ?? ''}`
    nachSchluessel.set(key, [...(nachSchluessel.get(key) ?? []), r])
  }
  return [...nachSchluessel.values()]
    .map((g) => g.sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate)))
    .sort((a, b) => a[0].schedule.firstEpisodeDate.localeCompare(b[0].schedule.firstEpisodeDate))
}

/**
 * Was eine einzelne Ausgabe von den übrigen der Gruppe unterscheidet.
 *
 * Der gemeinsame Anfang aller Namen fällt weg — bei „Banana Fish – Vol. 1" und
 * „Banana Fish – Vol. 2" bleibt „Vol. 1" und „Vol. 2". Genau das ist die
 * Auskunft, die der Leser sucht; der Serientitel steht drei Zeilen weiter oben.
 */
function unterscheidung(name: string, alle: string[]): string {
  if (alle.length < 2) return name
  let gemeinsam = 0
  while (gemeinsam < name.length && alle.every((n) => n[gemeinsam] === name[gemeinsam])) gemeinsam++
  /**
   * **Auf die letzte Wortgrenze zurück.** Ein Abzug Zeichen für Zeichen
   * schneidet mitten im Wort: Bei „Banana Fish – Vol. 1" und „… Vol. 2" ist der
   * gemeinsame Anfang „Banana Fish – Vol. ", übrig bliebe die nackte Ziffer
   * „1". Genau so stand es am 15.08.2026 im Panel, und „1" allein sagt nichts.
   * Zurück bis zum letzten Leerzeichen bleibt „Vol. 1" — die Auskunft, die
   * gemeint war.
   */
  const saeubern = (ab: number) => name.slice(ab).replace(/^[\s:–—-]+/, '').trim()
  let rest = saeubern(gemeinsam)
  /**
   * Solange der Rest kein einziges Buchstabenzeichen trägt, ist er noch kein
   * Wort — dann wird ein Wort weiter zurückgegangen. „1" wird so zu „Vol. 1".
   * Die Schleife endet spätestens am Anfang des Namens.
   */
  while (!/\p{L}/u.test(rest) && gemeinsam > 0) {
    const vorheriges = name.lastIndexOf(' ', gemeinsam - 1)
    if (vorheriges < 0) break
    gemeinsam = vorheriges
    rest = saeubern(gemeinsam)
  }
  return rest || name
}

/**
 * Mehrere Ausgaben derselben Sache in **einer** Karte.
 *
 * Die Plaketten, der Verlag und die Quellen stehen einmal oben; darunter je
 * Ausgabe genau eine Zeile mit dem, was sie ausmacht: Datum, Unterscheidung,
 * Medium und die eine Aktion, die dort möglich ist. Das ist dieselbe Aufteilung,
 * die JustWatch für seinen Angebotsblock benutzt — ein Rahmen, wechselnder
 * Inhalt — nur ohne Reiter, weil zwei bis vier Zeilen keinen Umschalter
 * brauchen.
 */
function ReleaseGruppe({ releases, today }: { releases: Release[]; today: string }) {
  const { t } = useLang()
  const erste = releases[0]
  const namen = releases.map((r) => r.name)
  /**
   * Je Seite ein Eintrag, auch wenn mehrere Artikel von dort stammen.
   *
   * Bei Banana Fish standen zwei verschiedene Anime2You-Artikel hinter den zwei
   * Ausgaben — angezeigt wurde „Quelle: anime2you.de, anime2you.de", und das
   * las sich wie ein Fehler statt wie zwei Belege (15.08.2026). Gezeigt wird
   * jetzt jede Seite einmal, verlinkt auf den ersten Artikel; die übrigen sind
   * über die Quellenhistorie weiterhin vollständig im Datensatz.
   */
  const alleQuellen = [...new Map(releases.flatMap((r) => r.sources).map((s) => [hostname(s), s])).values()]

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ReleaseTypeBadge type={erste.releaseType} />
        <PlatformBadge platform={erste.platform} />
        {erste.fsk !== undefined && <FskBadge fsk={erste.fsk} />}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('detail.editionCount', { count: releases.length })}
        </span>
      </div>
      {erste.publisher && (
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{erste.publisher}</p>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-white/10">
        {releases.map((r) => {
          const kuenftig = r.schedule.firstEpisodeDate > today
          return (
            <li key={r.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
              <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatDate(r.schedule.firstEpisodeDate)}
              </span>
              <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{unterscheidung(r.name, namen)}</span>
                {r.edition && (
                  <span className="block text-slate-400 dark:text-slate-500">{r.edition}</span>
                )}
              </span>
              {r.buyUrl && (
                <Button href={r.buyUrl} variant={kuenftig ? 'primary' : undefined} size="sm">
                  {t(kuenftig ? 'detail.preorderAt' : 'detail.buyAt', { shop: shopName(r.buyUrl) })}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {alleQuellen.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          {t('detail.source')}:{' '}
          {alleQuellen.map((s, i) => (
            <span key={s}>
              {i > 0 && ', '}
              <a href={s} target="_blank" rel="noreferrer noopener" className="underline hover:text-sky-400">
                {hostname(s)}
              </a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/**
 * Alle weiteren Schreibweisen eines Titels — eingeklappt, an einer Stelle.
 *
 * Nach dem Muster von MyAnimeLists „Alternative Titles": ein Aufklapper statt
 * dauerhaft sichtbarer Zeilen. Wer die Umschrift oder die Originalschrift sucht,
 * findet sie in einem Klick; alle anderen bekommen zwei Zeilen weniger, die sie
 * nie gelesen hätten.
 *
 * Die Regel „infos nie verstecken" (Daniel, 15.08.2026) ist damit nicht
 * verletzt, sondern befolgt: Verstecken hieße weglassen oder hinter ein Symbol
 * ohne Beschriftung packen. Hier steht ausgeschrieben, was drin ist, samt
 * Anzahl — genau das, was MAL mit „More titles" tut.
 */
function WeitereTitel({ title }: { title: Title }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  const gezeigt = title.titleDe ?? title.titleEn ?? title.titleRomaji
  const weitere: { label: string; wert: string }[] = []
  if (title.titleRomaji && title.titleRomaji !== gezeigt) {
    weitere.push({ label: t('detail.titleRomaji'), wert: eindeutschenStaffel(title.titleRomaji) })
  }
  if (title.titleEn && title.titleEn !== gezeigt) {
    weitere.push({ label: t('detail.titleEn'), wert: title.titleEn })
  }
  if (title.titleNative) weitere.push({ label: t('detail.titleNative'), wert: title.titleNative })
  if (!weitere.length) return null

  return (
    <div className="mt-0.5 text-xs">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="cursor-pointer text-slate-400 underline decoration-dotted underline-offset-2 hover:text-sky-400 dark:text-slate-500"
      >
        {offen ? t('detail.otherTitlesHide') : t('detail.otherTitles', { count: weitere.length })}
      </button>
      {offen && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400">
          {weitere.map((w) => (
            <Fragment key={w.label}>
              <dt className="text-slate-400 dark:text-slate-500">{w.label}</dt>
              <dd className="min-w-0 break-words">{w.wert}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * Quellen, die ein Mensch nicht aufschlagen kann.
 *
 * Manche Termine kommen aus einer Programmschnittstelle statt von einer Seite —
 * bei ADN etwa aus `gw.api.animationdigitalnetwork.com`. Diese Adresse als Link
 * anzubieten wäre eine Zumutung: Wer darauf klickt, landet bei JSON oder einer
 * Fehlermeldung. Vorher stand dort ersatzweise die Startseite des Anbieters,
 * und die war schlicht falsch — dort steht keiner dieser Termine (Daniel,
 * 15.08.2026: „das ist keine quelle").
 *
 * Also wird gesagt, was zutrifft: Die Termine kommen vom Anbieter selbst.
 */
function istMaschinenquelle(url: string): boolean {
  const host = hostname(url)
  return host.startsWith('api.') || host.startsWith('gw.api.')
}



/**
 * Der Shop, wie ihn ein Mensch nennt — „Amazon", nicht „www.amazon.de".
 *
 * aniSearch schreibt bei seinen Kaufverweisen die Domain aus, und das ist die
 * belegte, funktionierende Lösung für dieselbe Frage: Vor dem Klick wissen,
 * wohin es geht. Wir kürzen sie noch auf den Namen, weil „amazon.de" in einem
 * Knopf mehr nach Adresszeile aussieht als nach Ziel.
 */
function shopName(url: string): string {
  const host = hostname(url)
  const kern = host.replace(/\.(de|com|net|org|co\.uk|fr)$/, '')
  return kern.charAt(0).toUpperCase() + kern.slice(1)
}

/** Hostname ohne „www." — der Rest der Adresse sagt dem Leser nichts. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Deutsche Sprechrollen — zugeklappt, und erst der Klick holt die Daten.
 *
 * Bewusst nicht im Hauptdatensatz: Über alle Titel wären das mehr als 50.000
 * Einträge für eine Angabe, die die meisten nie aufschlagen. Wer sie sehen
 * will, lädt zwei Kilobyte; alle anderen zahlen nichts. Siehe ARCHITEKTUR.md.
 */
function VoiceCast({ titleId }: { titleId: number }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [stimmen, setStimmen] = useState<Voices | undefined>()

  // Titelwechsel: zuklappen und vergessen. Sonst stünde beim nächsten Anime
  // kurz die Besetzung des vorherigen da.
  useEffect(() => {
    setOpen(false)
    setStimmen(undefined)
  }, [titleId])

  useEffect(() => {
    if (!open || stimmen) return
    let alive = true
    loadVoices(titleId)
      .then((v) => {
        if (alive) setStimmen(v)
      })
      .catch(() => {
        if (alive) setStimmen({ roles: [] })
      })
    return () => {
      alive = false
    }
  }, [open, stimmen, titleId])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
        {t('detail.voices')}
      </button>

      {open && (
        <div className="mt-2">
          {stimmen === undefined ? (
            <p className="text-sm text-slate-400">{t('detail.voicesLoading')}</p>
          ) : stimmen.roles.length === 0 ? (
            <p className="text-sm text-slate-400">{t('detail.voicesNone')}</p>
          ) : (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 text-sm">
                {stimmen.roles.map((r) => (
                  <Fragment key={`${r.character}-${r.actor}`}>
                    <dt className="truncate text-slate-500 dark:text-slate-400" title={r.character}>
                      {r.character}
                    </dt>
                    <dd className="truncate text-slate-700 dark:text-slate-200" title={r.actor}>
                      {r.actor}
                    </dd>
                  </Fragment>
                ))}
              </dl>
              {/*
                Quellennennung, und bei ANN ist sie eine Auflage, keine Geste.

                Anime News Network verlangt fuer die Nutzung der
                Encyclopedia-Daten ausdruecklich eine Quellenangabe **und** einen
                Link zum jeweiligen Eintrag auf jeder Seite, die die Angaben
                zeigt. Der Link steht deshalb hier und nicht auf der
                Quellenseite: Er gehoert dorthin, wo die Daten stehen.
              */}
              <p className="mt-2 text-[11px] text-slate-400">
                {t('detail.voicesSource')}
                {stimmen.annUrl && (
                  <>
                    {', '}
                    <a
                      href={stimmen.annUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline hover:text-sky-400"
                    >
                      Anime News Network
                    </a>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function DetailPanel({
  data,
  titleId,
  favorites,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onClose,
  onFilterBy,
  onOpenTitle,
}: {
  data: Dataset
  titleId: number
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onClose: () => void
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
  onOpenTitle: (id: number) => void
}) {
  const { t, tGenre, tKeyword } = useLang()
  const verbindung = useNewsletterVerbindung()
  const today = todayIso()
  const title: Title | undefined = data.titleById.get(titleId)
  /**
   * Der leere Rückfall braucht ein `useMemo`, sonst ist er bei jedem Durchlauf
   * ein neues Array — und jeder Hook, der `releases` als Abhängigkeit führt,
   * rechnet dann bei jedem Render neu, statt sich das Ergebnis zu merken.
   */
  const releases = useMemo(() => data.releasesByTitle.get(titleId) ?? [], [data, titleId])
  const [synopsis, setSynopsis] = useState<Synopsis | undefined>()
  const [allKeywords, setAllKeywords] = useState(false)
  /** Die ersten drei Genres reichen fuer die Frage "ist das meins?". */
  const [genresOffen, setGenresOffen] = useState(false)
  const [plotOffen, setPlotOffen] = useState(false)

  useEffect(() => {
    let alive = true
    setSynopsis(undefined)
    loadSynopsis(titleId)
      .then((s) => {
        if (alive) setSynopsis(s)
      })
      .catch(() => {})
    setAllKeywords(false)
    setPlotOffen(false)
    return () => {
      alive = false
    }
  }, [titleId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /**
   * Die ganze Reihe — Staffeln, Filme und Specials.
   *
   * Kommt aus `franchises.json`, nicht aus `data.titles`. Dort stehen im
   * Kalender nur die 133 Titel **mit Termin**; „That Time I Got Reincarnated as
   * a Slime" zeigte deshalb allein Staffel 4 als verwandten Eintrag, „I've Been
   * Killing Slimes" gar nichts, obwohl es eine zweite Staffel gibt (gemeldet
   * von Daniel, 12.08.2026).
   */
  const [franchises, setFranchises] = useState<Franchises>({})
  useEffect(() => {
    let alive = true
    loadFranchises().then((f) => {
      if (alive) setFranchises(f)
    })
    return () => {
      alive = false
    }
  }, [])

  const reihe: FranchiseMember[] = useMemo(() => {
    if (!title) return []
    return franchises[title.franchiseId ?? title.id] ?? []
  }, [franchises, title])

  /**
   * Alle Kennungen der Reihe — aus zwei Quellen zusammengeführt.
   *
   * `franchises.json` deckt nur den gepflegten Bestand ab. Titel **ohne**
   * deutsche Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link
   * Click" hat sieben Teile und keinen einzigen mit Synchro. Der zweite Weg
   * geht deshalb über das, was die Anwendung ohnehin geladen hat — wer im
   * Detail-Panel steht, hat die passende Liste vorher geöffnet.
   */
  /**
   * Alle Teile der Reihe als Karten — aus **beiden** Beständen.
   *
   * `franchises.json` deckt nur den gepflegten Bestand ab. Titel ohne deutsche
   * Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link Click" hat
   * sieben Teile und keinen einzigen mit Synchro — der Umschalter fehlte dort
   * deshalb ganz, obwohl die Kachel korrekt gebündelt war (Daniel, 13.08.2026).
   *
   * Die zweite Quelle ist das, was die Anwendung ohnehin geladen hat. Wer im
   * Detail-Panel steht, hat die passende Liste vorher geöffnet; im Kalender
   * fehlen die Cover mancher Teile, dafür trägt `franchises.json` sie bei.
   */
  const reihenTeile: FranchiseMember[] = useMemo(() => {
    if (!title) return []
    const wurzel = title.franchiseId ?? title.id
    const teile = new Map<number, FranchiseMember>()
    for (const m of reihe) teile.set(m.id, m)
    for (const t of data.titleById.values()) {
      if ((t.franchiseId ?? t.id) !== wurzel) continue
      const bisher = teile.get(t.id)
      teile.set(t.id, {
        id: t.id,
        name: bisher?.name ?? t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`,
        format: bisher?.format ?? t.format,
        jpYear: bisher?.jpYear ?? t.jpYear,
        episodes: bisher?.episodes ?? t.episodes,
        cover: bisher?.cover ?? t.coverImage,
      })
    }
    if (!teile.has(title.id)) {
      teile.set(title.id, {
        id: title.id,
        name: anzeigeName(title),
        format: title.format,
        jpYear: title.jpYear,
        episodes: title.episodes,
        cover: title.coverImage,
      })
    }
    // Nach Ausstrahlung: erst das Jahr, dann die Kennung als stabiler Zweitschlüssel.
    return [...teile.values()].sort((a, b) => (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id)
  }, [title, reihe, data])

  const reihenIds: number[] = useMemo(() => reihenTeile.map((m) => m.id), [reihenTeile])

  /**
   * Das Banner des Titels — oder geliehen von einem Teil der Reihe, der eines hat.
   *
   * Ohne den Rückfall verschwindet der Kopf beim Umschalten auf ein Special und
   * kommt beim Zurückschalten wieder; das Panel springt dabei um 112 Pixel.
   */
  /**
   * Das Bild der Bühne — seit dem 24.08.2026 das **Cover**, nicht das Banner.
   *
   * Gemessen: Alle 2.762 Titel haben ein `coverImage`, aber nur 2.111 ein
   * `bannerImage`. Bei 651 Titeln stand oben deshalb ein leerer Farbverlauf.
   * Das Cover trägt außerdem das, was ein Zuschauer wiedererkennt — es ist das
   * Bild, das auch auf einer Hülle stünde.
   *
   * Der frühere Rückfall „Banner von einem Reihenteil leihen" entfällt: Er war
   * nötig, weil der Kopf beim Umschalten auf ein Special um 112 Pixel sprang.
   * Mit dem Cover tritt der Fall nicht mehr ein.
   */
  const buehnenBild: string | undefined = useMemo(() => {
    if (!title) return undefined
    if (title.coverImage) return title.coverImage
    // Sollte nie greifen — steht als Netz für einen künftigen Titel ohne Cover.
    for (const m of reihenTeile) {
      const t = data.titleById.get(m.id)
      if (t?.coverImage) return t.coverImage
    }
    return undefined
  }, [title, reihenTeile, data])

  /**
   * Wie die Reihe heißt — nicht, wie die gerade gewählte Staffel heißt.
   *
   * Im Kopf stand vorher „That Time I Got Reincarnated as a Slime Season 4",
   * während vier Zeilen darunter „… Staffel 4" stand: dasselbe zweimal, einmal
   * auf Englisch. Der Kopf nennt jetzt die Reihe, die Staffel steht im
   * Umschalter darunter.
   */
  const reihenName = useMemo(() => {
    if (!title) return ''
    if (reihe.length < 2) return anzeigeName(title)
    return ohneStaffelEins(reihenVertreter(reihe.map((m) => ({ ...m, id: m.id }))).name)
  }, [reihe, title])

  /**
   * Was diesen Teil von der Reihe unterscheidet — „Staffel 3", „Der Film".
   *
   * Steht unter dem Karussell an der Stelle, an der vorher noch einmal der
   * Reihenname stand. Der Grund: Welcher Teil gerade offen ist, war allein am
   * blauen Rahmen einer von acht Vorschaukarten zu erkennen, und das ging unter
   * (Daniel, 15.08.2026). Der Unterschied ist die wichtigste Auskunft im Kopf,
   * also steht er im Klartext und am größten.
   *
   * Ermittelt wird er durch Abzug: Was am Namen des Teils über den Reihennamen
   * hinausgeht, ist das Unterscheidende. Bleibt nichts übrig — der Teil heißt
   * genau wie die Reihe, typisch für die erste Staffel —, treten Format und
   * Jahr an seine Stelle, denn „2023" unterscheidet immer noch.
   *
   * **Nur innerhalb einer Reihe.** Bei einem Titel, der allein steht, gibt es
   * nichts zu unterscheiden, und der Rückfall auf das Jahr wird zur Absurdität:
   * Über „Banana Fish" stand am 15.08.2026 in großer, fetter Schrift „2018".
   * Deshalb prüft die Ausgabestelle zusätzlich, ob die Reihe überhaupt mehr als
   * einen Teil hat.
   */
  const teilName = useMemo(() => {
    if (!title) return ''
    const voll = eindeutschenStaffel(anzeigeName(title))
    const rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    /**
     * Bleibt nichts übrig, heißt der Teil wie die Reihe — dann steht auch der
     * volle Name hier, und die Ausgabestelle unterdrückt die Zeile als
     * Wiederholung.
     *
     * Vorher trat hier Format und Jahr an die Stelle des Namens, und über
     * „Fairy Tail" stand in großer Schrift „2009" (Daniel, 15.08.2026 — schon
     * das zweite Mal, nachdem bei Banana Fish „2018" dort stand). Eine nackte
     * Jahreszahl als Überschrift beantwortet keine Frage; welcher Teil gewählt
     * ist, zeigt das Karussell.
     */
    if (rest) return rest

    /*
      **Die erste Staffel heißt „Staffel 1", nicht gar nichts.**

      Daniel am 02.09.2026 an „Die Tagebücher der Apothekerin": „es fehlt
      ‚1. staffel'". Bei Staffel 2 stand die Angabe da, bei Staffel 1 nichts —
      wer aus der Übersicht kam, wusste nicht, welchen der beiden Einträge er
      geöffnet hatte.

      Der Grund ist der Abzug oben: Die erste Staffel heißt im Datensatz meist
      genau wie die Reihe („Die Tagebücher der Apothekerin"), die zweite trägt
      ihren Zusatz mit. Nach dem Abzug bleibt bei der ersten nichts übrig.

      **Die Nummer wird gezählt, nicht geraten:** Position dieses Eintrags unter
      den **Staffeln** der Reihe, chronologisch nach japanischer Ausstrahlung —
      dieselbe Sortierung, aus der auch der Reihenname stammt. Filme, OVAs und
      Specials zählen nicht mit; sie sind keine Staffeln und tragen ihren
      Unterschied ohnehin im Namen.

      Hat die Reihe nur eine Staffel, gibt es nichts zu unterscheiden, und die
      Zeile bleibt weg wie bisher.
    */
    const staffeln = reihe.filter((m) => istStaffel(m.format)).slice().sort(nachAusstrahlung)
    if (staffeln.length > 1) {
      const platz = staffeln.findIndex((m) => m.id === title.id)
      if (platz >= 0) return t('detail.staffelNummer', { n: platz + 1 })
    }
    return voll
  }, [title, reihenName, reihe, t])

  /**
   * Beim Wechsel auf eine Staffel ohne Termin fehlen die Metadaten — die liegen
   * in `titles.json`, das im Kalender nicht geladen ist. Erst holen, dann
   * öffnen, sonst zeigt das Panel „keine Metadaten".
   */
  const [wechselt, setWechselt] = useState(false)


  /**
   * Streaming, aufgeteilt nach dem, was es kostet.
   *
   * Daniel am 23.08.2026: „wir brauchen bereich streaming und disc, und unter
   * streaming die kategorien kostenlos, abo, kauf/leih." Für einen Besucher ist
   * genau das der Unterschied — wer kein Netflix hat, dem nützt ein
   * Netflix-Eintrag nichts, und wer eine Folge frei sehen kann, will das oben
   * stehen haben.
   *
   * Die Reihenfolge ist deshalb kostenlos → Abo → Kauf: von „sofort" zu „kostet".
   *
   * `unbekannt` steht am Ende, weil es keine Preisstufe ist, sondern eine
   * fehlende Auskunft — dort landen die Amazon-Suchadressen, die nur zur Suche
   * führen und über das Angebot nichts aussagen. **Die Art muss in dieser Liste
   * stehen:** Was hier fehlt, fällt aus allen Gruppen und verschwindet
   * kommentarlos aus der Anzeige.
   */
  const sortiertNachZugang = useMemo(() => {
    const arten: Zugangsart[] = ['kostenlos', 'abo', 'kauf', 'unbekannt']
    const gruppen = arten.map((art) => ({
      art,
      plattformen: (title?.streams ?? []).filter((s) => (s.zugang ?? 'abo') === art),
      shops: gruppiereKaufwege([
        ...(title?.watchLinks ?? []).filter((w) => w.kind === 'stream' && (w.zugang ?? 'abo') === art),
        /**
         * Kaufwege gehören in die Kauf-Gruppe, nicht in einen zweiten Block.
         *
         * Bis zum 23.08.2026 standen sie darunter mit **derselben Überschrift**
         * — „Kaufen oder leihen" kam bei 61 Titeln zweimal hintereinander, weil
         * die eine Liste aus `streams` stammte und die andere aus `watchLinks`.
         * Für einen Besucher ist das dieselbe Frage, also ist es eine Liste.
         */
        ...(art === 'kauf' ? (title?.watchLinks ?? []).filter((w) => w.kind === 'buy') : []),
      ]),
    }))
    const belegte = gruppen.filter((g) => g.plattformen.length || g.shops.length)
    /**
     * Die Überschrift steht nur da, wo es etwas zu trennen gibt — mit einer
     * Ausnahme: **Was Geld kostet, sagt das immer.** Ein Titel, den es nur zu
     * kaufen gibt, sähe sonst aus wie einer, den man einfach ansehen kann.
     */
    return belegte.map((g) => ({
      ...g,
      zeigeUeberschrift: belegte.length > 1 || g.art === 'kauf',
    }))
  }, [title])
  /**
   * Ausgaben, die es noch nicht gibt.
   *
   * Sie stehen in einer eigenen Reihe, damit "vorbestellen" einmal ueber der
   * Reihe steht statt in jeder Pille — und damit ein kuenftiger Termin nicht
   * neben einem Angebot steht, das man heute nutzen kann.
   *
   * Gefiltert wird ueber das Startdatum, nicht ueber den Status: Ein Release,
   * das erst naechsten Monat erscheint, ist kein Bezugsweg, sondern ein Termin.
   */
  const vorbestellungen = useMemo(
    () =>
      releases.filter(
        (r) => r.releaseType === 'disc' && (r.schedule?.firstEpisodeDate ?? '') > today,
      ),
    [releases, today],
  )

  const wechsleZu = (id: number) => {
    if (id === titleId) return
    if (data.titleById.has(id)) {
      onOpenTitle(id)
      return
    }
    setWechselt(true)
    /*
      **Beide Bestände holen, nicht nur den Hauptbestand.**

      Seit die Reihenliste auch die Teile aus dem Katalog zeigt, kann der Klick
      auf einen davon fallen: `loadAllTitles` lädt `titles.json`, und dort steht
      ein Titel ohne belegte Synchro nicht. Das Panel meldete dann „Zu diesem
      Eintrag liegen keine Metadaten vor" — und derselbe Klick funktionierte,
      sobald der Toggle den Katalog geladen hatte (Daniel, 03.09.2026).

      Ein Eintrag, den die Liste zeigt, muss sich auch öffnen lassen. Beide
      Ladewege sind gegen Mehrfachaufrufe gesichert und tun beim zweiten Mal
      nichts, das Paar kostet also nur beim ersten Wechsel etwas.
    */
    Promise.all([loadAllTitles(data), loadOhneSynchro(data)])
      .catch(() => {})
      .finally(() => {
        setWechselt(false)
        onOpenTitle(id)
      })
  }

  /**
   * Die Antwort auf die Frage, wegen der jemand dieses Panel öffnet.
   *
   * *Wann kommt die nächste Folge, wie weit bin ich, wo kann ich gucken.* Bis
   * zum 24.08.2026 standen die Bausteine dafür verstreut: `Start`, `Folgen` und
   * `Nächste Folge` in drei Zeilen eines Kastens, der als vierter Block kam —
   * nach Bildergalerie, Bewertung und sechs Genre-Chips. Wer die Antwort wollte,
   * musste sie sich zusammensetzen.
   *
   * Hier entsteht sie als **ein** Satz, aus denselben Terminen, die auch die
   * Liste darunter füllt. Vier Fälle, und jeder bekommt dieselben vier Zeilen —
   * Überschrift, Nebenzeile, Balken, Zählzeile. Ungleich hohe Kästen ließen beim
   * Wechseln des Reihenteils alles darunter springen (Daniel, 24.08.2026:
   * „solche element verrückungen sollten möglichst vermieden werden").
   *
   * Der vierte Fall ist der Film: 697 der 2.762 Titel. Ein Folgenzähler ergibt
   * dort keinen Sinn, und ein Balken, der immer voll ist, misst nichts. Statt
   * seiner stehen drei Angaben, die es bei einem Film wirklich gibt.
   */
  const antwort = useMemo(() => {
    if (!title) return undefined

    /*
      **Der Kopf beantwortet die Streaming-Frage, nicht die Disc-Frage.**

      Bei „Die Tagebücher der Apothekerin" Staffel 1 stand dort „Morgen,
      04.09.2026 · Wöchentlich · 23 von 24 Folgen erschienen" — für eine Staffel,
      die seit dem 20.04.2024 vollständig deutsch bei Crunchyroll liegt. Der
      Termin gehörte zu einer Blu-ray. Daniel am 03.09.2026: „die staffel ist
      komplett erschienen, es gibt nur noch ein disc release, was in der
      folgenzählung etc nicht berücksichtigt werden soll, dort soll nur original
      deutsches frühstes release stehen."

      Es ist dieselbe Falle wie am 21.08.2026, nur andersherum: Damals machte ein
      künftiger Disc-Termin aus „auf Netflix längst fertig" ein „läuft noch,
      0/51". Ein Kaufdatum und ein Sendeplan sind zwei verschiedene Fragen, und
      der Fortschrittsbalken beantwortet nur die zweite.

      **Gibt es kein Streaming-Release, zählt die Disc wieder** — dann ist sie
      die einzige Auskunft, die es gibt, und ein leerer Kopf wäre schlechter als
      ein Kaufdatum.
    */
    const ohneDisc = releases.filter((r) => r.releaseType !== 'disc')
    const fuerKopf = ohneDisc.length ? ohneDisc : releases
    const alleEvents = fuerKopf.flatMap((r) => expandEvents(r))
    const kuenftig = alleEvents
      .filter((e) => !istErschienen(e))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
    const raus = alleEvents.filter((e) => istErschienen(e)).length
    const gesamt = title.episodes ?? (alleEvents.length || undefined)
    const hatSynchro = (title.streams ?? []).some((s) => s.dub === true)

    if (kuenftig.length > 0) {
      const n = kuenftig[0]!
      /*
        **Fällt der Kopf auf die Disc zurück, wird er zur Disc-Auskunft.**

        `ohneDisc.length === 0` heißt: zu diesem Titel gibt es kein
        Streaming-Release, und die Ereignisse oben stammen sämtlich von einer
        Kaufausgabe. Sie als Sendeplan zu lesen erzeugte den Satz „Wöchentlich
        freitags · 0 von 24 Folgen erschienen" über einer Steelbook-Box.
      */
      if (!ohneDisc.length) {
        const quelle = releases.find((r) => expandEvents(r).some((e) => e.date === n.date))
        return {
          art: 'disc' as const,
          datum: n.date,
          publisher: quelle?.publisher,
          edition: quelle?.edition,
        }
      }
      return {
        art: 'laeuft' as const,
        haupt: n,
        rest: kuenftig.length,
        raus,
        gesamt,
        letzter: kuenftig[kuenftig.length - 1]?.date,
      }
    }
    if (title.format === 'MOVIE') return { art: 'film' as const, hatSynchro, raus, gesamt }
    if (hatSynchro || titleStatus(releases, today, title) === 'erschienen') {
      return { art: 'fertig' as const, raus: raus || gesamt, gesamt }
    }
    return { art: 'ohne' as const, gesamt }
    // `today` steht in der Abhängigkeitsliste, weil `titleStatus` es benutzt.
  }, [title, releases, today])

  if (!title) {
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
        <p className="mb-3 text-sm text-slate-500">{t('detail.noMeta')}</p>
        <Button onClick={onClose} size="sm">
          {t('detail.close')}
        </Button>
      </aside>
    )
  }

  // Ausgeblendet: Auch das Detail bleibt zu. Über die Kacheln kommt man ohnehin
  // nicht mehr hierher, aber ein geteilter Link oder ein Lesezeichen schon —
  // und dann soll nicht doch alles zu sehen sein, was jemand weggeklickt hat.
  if (hidden.has(title.id)) {
    return (
      <>
        <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
        <aside
          className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col justify-center gap-4 border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
          role="dialog"
          aria-label={anzeigeName(title)}
        >
          <p className="text-base font-medium italic text-slate-400 dark:text-slate-500">
            {anzeigeName(title)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('detail.hiddenNote')}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => onToggleHidden(title.id)} size="sm">
              {t('card.unhide')}
            </Button>
            <Button onClick={onClose} size="sm">
              {t('detail.close')}
            </Button>
          </div>
        </aside>
      </>
    )
  }

  const status = titleStatus(releases, today, title)

  // Handlung auf Deutsch; fehlt sie, lieber den englischen Text mit Hinweis
  // zeigen als gar keinen.
  //
  // Der englische Rückfall bleibt bewusst, obwohl die Oberfläche seit dem
  // 10.08.2026 einsprachig ist: Er stammt nicht aus einer Übersetzung der
  // Seite, sondern aus der Quelle. Für rund 700 der 2.750 Titel gibt es

  // nirgends eine deutsche Inhaltsangabe — dort wäre die Alternative eine
  // leere Fläche.
  const plot = (() => {
    if (synopsis?.de) {
      return {
        text: synopsis.de,
        fallback: false,
        quelle: synopsis.deSource ?? { name: 'anisearch.de', url: 'https://www.anisearch.de/' },
      }
    }
    if (!synopsis?.en) return undefined
    // Die englische Fassung kommt immer von AniList — dort steht auch der Titel.
    return {
      text: synopsis.en,
      fallback: true,
      quelle: { name: 'anilist.co', url: `https://anilist.co/anime/${titleId}` },
    }
  })()
  const keywords = allKeywords ? title.keywords : title.keywords.slice(0, KEYWORD_PREVIEW)

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        /*
          Von `max-w-md` (28 rem) auf `max-w-lg` (32 rem) — vier Rem mehr
          (Daniel, 15.08.2026: „evtl die gesamte card paar pixel breiter").

          Der Gewinn ist kein Selbstzweck: Die Terminzeilen tragen jetzt Datum,
          Ausgabe und Aktion **nebeneinander**. Bei 28 rem brach die Aktion in
          eine eigene Zeile um, und aus einer Zeile je Ausgabe wurden zwei —
          genau die Platzverschwendung, die verschwinden sollte. Auf schmalen
          Schirmen greift weiterhin `w-full`, dort ändert sich nichts.
        */
        className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        aria-label={anzeigeName(title)}
      >
        {/*
          Ohne Banner braucht das ✕ trotzdem seinen eigenen Streifen.

          Der Knopf liegt absolut in diesem Kasten. Fehlt das Bild, fällt der
          Kasten auf Höhe null zusammen, und das ✕ landet auf dem Inhalt
          darunter — genau auf dem Favoritenstern, der oben rechts in der
          Titelzeile sitzt (Daniel, 13.08.2026, mit Bild). Aufgefallen ist es
          bei den Titeln ohne deutsche Synchro, weil die grundsätzlich kein
          Banner haben; betroffen war aber jeder Titel ohne Bannerbild.

          **`shrink-0` ist der eigentliche Fix, nicht `h-9`.** Der erste Versuch
          setzte nur die Höhe — und die blieb wirkungslos: Das Panel ist eine
          Flex-Spalte mit Rollbereich, und darin schrumpft ein Element ohne
          `shrink-0` auf null zurück, ganz gleich welche Höhe daransteht.
          Gemessen wurde genau das: Klasse `relative h-9` gesetzt, Höhe 0
          (Daniel, 13.08.2026: „ich hab grad geguckt, ist immer noch über dem
          Stern"). Merksatz: In einer scrollenden Flex-Spalte ist eine Höhe
          ohne `shrink-0` ein Vorschlag, keine Angabe.
        */}
        {/*
          Das Banner bleibt beim Wechsel des Reihenteils stehen.

          Vorher hing es allein an `title.bannerImage` — und weil längst nicht
          jeder Teil einer Reihe eines hat, verschwand es beim Umschalten und
          kam beim Zurückschalten wieder. Der Kopf sprang dabei um 112 Pixel
          (Daniel, 13.08.2026). Jetzt gilt: eigenes Banner, sonst das des
          ersten Teils der Reihe, der eines hat. Ein Banner ist Schmuck für die
          Reihe, kein Beleg für den einzelnen Titel — es darf geliehen werden.
        */}
        {/*
          Die Bühne: das Cover liegt **hinter** dem Kopfbereich, nicht daneben.

          Umgebaut am 24.08.2026 nach mehreren Mockup-Durchgängen mit Daniel.
          Der Gewinn: Das Artwork ist rund fünfmal so groß wie das frühere
          Karussell-Bildchen und kostet trotzdem keine Zeile — die Höhe des
          Bereichs bestimmt allein der Inhalt darüber.

          **Das Banner entfällt dabei.** Zwei großflächige Bilder übereinander
          sind zu viel, und das Banner fehlt bei 651 von 2.762 Titeln; deren
          Kopf war bisher ein leerer Farbverlauf. Das Cover gibt es dagegen bei
          **allen** 2.762. Der frühere Rückfall „Banner von einem Reihenteil
          leihen" wird damit gegenstandslos — sein Anlass (der Kopf sprang beim
          Umschalten um 112 Pixel) ist es auch, weil die Bühne immer ein Bild
          hat.

          **Feste Höhe, nicht `inset-0`.** Mit `inset-0` wüchse das Bild mit,
          sobald ein Bereich darunter aufklappt — der Klick sähe aus, als hätte
          er das Bild verändert (Daniel, 24.08.2026, am Mockup bemerkt).
        */}
        <div className="relative shrink-0" style={{ isolation: 'isolate' }}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-cover bg-[center_16%]"
            style={{ backgroundImage: buehnenBild ? `url(${buehnenBild})` : undefined, zIndex: -2 }}
          />
          {/*
            Zwei Verläufe: einer von unten, der zur Panel-Farbe ausläuft, einer
            von links, damit das Artwork rechts frei stehen bleibt statt
            vollflächig abgedunkelt zu werden.

            **Die Farben kommen aus `styles.css` und wechseln mit dem Thema.**
            Bis zum 25.08.2026 standen sie hier fest als `rgba(11,15,22,…)`, und
            `--panel-grund` war nirgends definiert — der dunkle Fallback galt
            also immer. Im hellen Thema lag der dunkle Titel damit auf einem
            dunklen Verlauf und war praktisch unlesbar (Daniel, mit Bild:
            „styling kaputt im light mode").

            Der Verlauf hat in beiden Themen dieselbe Aufgabe: den Bildkontrast
            von der Schrift wegschieben. Dafür muss er im hellen Thema
            aufhellen statt abzudunkeln.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[340px]"
            style={{
              zIndex: -1,
              background:
                'linear-gradient(180deg, var(--buehne-oben) 0%, var(--buehne-mitte) 38%, var(--buehne-unten) 74%, var(--panel-grund) 100%),' +
                'linear-gradient(90deg, var(--buehne-links) 0%, var(--buehne-links-mitte) 55%, var(--buehne-links-aus) 100%)',
            }}
          />
          {/*
            Bedienelemente oben rechts, auf der Bühne statt darunter.

            Sie standen bis zum 24.08.2026 in der Titelzeile. Die ist jetzt Teil
            der Bühne, und drei Symbole neben einem zweizeiligen Titel drängen
            sich; oben rechts haben sie ihre eigene Ecke — dieselbe, in der auch
            das Schließen sitzt.

            Jedes bekommt denselben dunklen Grund wie der Titel: Auf einem hellen
            Cover wäre ein blankes Symbol sonst genauso unlesbar wie blanker Text.
          */}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur-[3px]">
            <ShareIcon slug={title.slug} name={anzeigeName(title)} />
            <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
            <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
            {reihenIds.length > 1 && (
              <ReihenStern
                alleGemerkt={reihenIds.every((id) => favorites.has(id))}
                anzahl={reihenIds.length}
                onMerken={() => {
                  for (const id of reihenIds) if (!favorites.has(id)) onToggleFavorite(id)
                }}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('detail.close')}
              className="cursor-pointer px-1 text-sm text-white transition hover:opacity-70"
            >
              ✕
            </button>
          </div>
          {/*
            Der Titel steht **auf** der Bühne, auf einer eigenen Fläche.

            Ein Verlauf allein trägt ihn nicht: Er kommt von unten, der Titel
            steht oben, und auf einem hellen Cover verschwindet er. Im Farbtest
            am 24.08.2026 war er auf Reinweiß unlesbar — Daniels Vorschlag, eine
            halbdeckende Fläche direkt hinter den Text zu legen, hielt dagegen
            auf allen fünf Testfarben.

            Titel und Unterzeile bilden **eine** Fläche in zwei Zeilen, ohne
            Abstand dazwischen: Zwei getrennte Pillen sind verschieden breit und
            sehen aus wie ein Versehen (Daniel, 24.08.2026: „untereinander ohne
            gap").

            Zwei feste Zeilen für den Titel — sonst verschiebt ein einzeiliger
            Titel beim Umschalten alles darunter.
          */}
          <div className="relative flex flex-col items-start gap-0 px-4 pb-3 pt-[104px]">
            <h2
              title={reihenName}
              className="line-clamp-2 min-h-[2.5em] rounded-t-lg bg-[rgba(8,12,18,.74)] px-2.5 pb-px pt-1 text-lg font-semibold leading-tight text-white backdrop-blur-[3px]"
            >
              {reihenName}
            </h2>
            <p className="max-w-full rounded-b-lg rounded-tr-lg bg-[rgba(8,12,18,.74)] px-2.5 pb-1 pt-0.5 text-xs text-slate-300 backdrop-blur-[3px]">
              {[
                title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
                title.episodes ? `${title.episodes} ${t('detail.episodes')}` : undefined,
                title.jpYear ? `JP ${title.jpYear}` : undefined,
                title.studios?.[0],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/*
          Das Karussell der Reihenteile — es ersetzt Cover **und** Auswahlliste.

          Vorher stand links ein einzelnes Cover, rechts daneben alle Angaben,
          und weiter unten eine Auswahlliste mit der Überschrift „Staffel, Film
          oder Special". Drei Bausteine für eine Sache. Jetzt zeigt das
          Karussell alle Teile als Vorschaukarten, der gewählte ist darin
          hervorgehoben, und die Angaben stehen darunter über die volle Breite
          (Daniel, 13.08.2026). Die Überschrift entfällt: Ein Karussell aus
          Covern erklärt sich selbst.

          Auch bei einem Einzeltitel bleibt es stehen — dann als eine Karte.
          Sonst verschwände beim Umschalten auf einen Titel ohne Geschwister
          das Cover, und der Kopf sähe plötzlich anders aus.
        */}
        {/*
          Alles nach der Bühne steht `relative`, und daran hängt mehr, als es
          aussieht.

          Das Bühnenbild ist 340 px hoch, sein Container nur so hoch wie Titel
          und Unterzeile — gemessen 284 px. Die letzten 56 px des Bildes ragen
          also über den Container hinaus, und das ist Absicht: Die ersten
          Inhalte sollen darauf stehen.

          Nur gewinnt beim Malen sonst das Bild. Der Container ist positioniert
          und erzeugt über `isolation: isolate` einen eigenen Stapel; ein
          nachfolgendes Geschwister **ohne** `position` wird davon überdeckt,
          ganz gleich, welchen z-index das Bild innerhalb des Stapels trägt. Der
          Antwortkasten stand dadurch angeschnitten da — obere Kante weg, der
          Rest sichtbar (Daniel, 24.08.2026, mit Bild).

          `relative` allein genügt: Es holt das Geschwister in dieselbe
          Malschicht wie den Container, ohne einen z-index zu vergeben und ohne
          am Layout etwas zu ändern.
        */}
        <div className="relative flex flex-col gap-3 p-4">
          {/*
            Der Reihenname steht **über** dem Karussell, der gewählte Teil
            darunter (Daniel, 15.08.2026: „ich hab s3 ausgewählt, es ist kaum
            erkennbar… das ist der wichtigste teil").

            Vorher trugen beide Zeilen denselben Reihennamen, und welcher Teil
            gerade offen war, stand nur als blauer Rahmen an einer der
            Vorschaukarten — bei acht Karten nebeneinander ein Rahmen zu viel,
            um ihn zu bemerken. Jetzt beantwortet die Zeile unter dem Karussell
            die Frage im Klartext: „Staffel 3".

            Die beiden Bedienelemente teilen sich entsprechend auf: Der
            Reihen-Stern gehört zur Reihe und steht oben, Stern und Auge
            gehören zum gewählten Teil und stehen unten. Das ersetzt zugleich
            die frühere absolute Positionierung — zwei Sterne übereinander
            brauchte es nur, solange beide in derselben Zeile hingen.
          */}
          {/*
            Titel und Bedienelemente stehen seit dem 24.08.2026 auf der Bühne
            weiter oben. Hier stand bis dahin beides — der Reihenname als
            Überschrift und daneben Teilen, Auge, Stern und Reihen-Stern.

            Die frühere Begründung dafür bleibt gültig und ist mit umgezogen:
            Die Bedienelemente gehören an den Anfang des Kopfbereichs, nicht
            unter das Karussell, wo sie bei einem Einzeltitel eine eigene Zeile
            für zwei Symbole gebraucht hätten.
          */}


          <div className="min-w-0 flex-1">
            {/*
              Die zweite Titelzeile entfällt, wenn sie nur die erste wiederholt.

              Bei „Banana Fish" stand der Name viermal untereinander: als
              Reihenname über dem Karussell, hier noch einmal, und darunter als
              Umschrift und in Originalschrift — dreimal davon identisch
              (Daniel, 15.08.2026: „banana fish steht dort 3x"). Ein Titel ohne
              weitere Reihenteile hat schlicht keinen unterscheidenden Zusatz;
              dann trägt ihn die Zeile über dem Karussell allein.
            */}
            {reihenTeile.length > 1 && teilName !== reihenName && (
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-xl font-bold leading-tight text-slate-900 dark:text-white">
                  {teilName}
                </h3>
              </div>
            )}
            {/*
              Alle weiteren Schreibweisen an **einer** Stelle und eingeklappt.

              Vorbild ist MyAnimeLists „Alternative Titles" mit seinem
              „More titles"-Aufklapper: Der Titel steht genau einmal groß, alle
              Varianten gebündelt daneben. Vorher standen Umschrift und
              Originalschrift als zwei eigene Zeilen dauerhaft im Weg — für eine
              Auskunft, die die wenigsten suchen und niemand zweimal braucht.

              Die Umschrift bekommt dabei „Staffel" statt „Season": Sie ist
              ohnehin eine Mischform („Tensei Shitara Slime Datta Ken 4th
              Season"), und ein zweites „Season" unter einem deutschen
              „Staffel 4" wäre genau der Widerspruch, um den es ging. Die
              Originalschrift bleibt unangetastet.
            */}
            <WeitereTitel title={title} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {/*
                Status und FSK standen hier **und** in jedem Terminblock
                darunter — bei einem Titel mit genau einem Release war das
                zweimal dieselbe Auskunft im selben Bild (Daniel, 13.08.2026:
                „erschienen und fsk label werden im panel doppelt angezeigt").

                Weg ist die Angabe hier oben, nicht die unten: Der Terminblock
                nennt sie **je Release**, und das ist die genauere Aussage —
                eine Disc kann eine andere Freigabe tragen als der Stream, und
                „erschienen" gilt für einen Termin, nicht für einen Anime. Die
                Bewertung bleibt, die gibt es je Titel nur einmal.
              */}
              {/*
                Die Wertung nennt ihre Quelle — sonst sieht es aus, als wäre es
                unsere.

                „★ 8.4" ohne Herkunft las sich, als hätten wir diesen Anime
                selbst mit 8,4 bewertet (Daniel, 15.08.2026). Wir bewerten
                nichts; die Zahl ist der Nutzerdurchschnitt von AniList. Wie man
                das löst, ist ein gelöstes Problem: JustWatch stellt das Logo der
                Quelle vor den Wert, MyAnimeList schreibt „scored by 418,623
                users" dazu, TMDB beschriftet die eigene Wertung wörtlich als
                „Benutzerbewertung". Gemeinsam ist allen, dass **neben der Zahl
                steht, wer sie vergeben hat**.

                Hier steht der Name ausgeschrieben statt eines Logos: AniList
                liefert keine Bildmarke zur freien Verwendung, und ein
                nachgebautes Logo wäre schlechter als ein Wort.
              */}
              {title.score !== undefined && (
                <Tooltip text={t('detail.scoreHint')} seite="oben">
                  <span className="inline-flex cursor-help items-baseline gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                    <span className="font-normal text-slate-500 dark:text-slate-400">AniList</span>
                    {/* Der Stern macht auf einen Blick klar, dass es eine
                        Wertung ist und keine Folgenzahl (Daniel, 15.08.2026). */}
                    <span className="text-amber-400" aria-hidden="true">
                      ★
                    </span>
                    <span className="font-semibold tabular-nums">{(title.score / 10).toFixed(1)}</span>
                  </span>
                </Tooltip>
              )}
            </div>
            {/*
              Format, Jahr und Studio stehen seit dem 24.08.2026 in der Bühne,
              direkt unter dem Titel — dieselbe Angabe zweimal im selben Bild
              wäre eine Zeile für nichts.

              Die Genres sind ans Ende gewandert, in den Details-Bereich. Ihre
              Begründung vom 12.08.2026 bleibt gültig — sie beantworten „ist das
              überhaupt meins?" —, aber diese Frage stellt sich **nach** der,
              wegen der jemand das Panel öffnet: wann kommt es, wo läuft es. Wer
              den Titel schon kennt, überspringt die Genres ohnehin.
            */}
          </div>
        </div>

        {/* Aus demselben Grund wie oben — siehe den Hinweis am Block davor. */}
        <div className="relative flex flex-col gap-4 px-4 pb-8">
          {/*
            Die Antwortzeile — der erste Block nach der Bühne.

            Sie beantwortet in einem Satz, wonach jemand das Panel öffnet.
            Vier Fälle, immer dieselben vier Zeilen: Überschrift, Nebenzeile,
            Balken, Zählzeile. Die Gleichheit ist kein Schönheitswunsch —
            ungleich hohe Kästen ließen beim Wechseln des Reihenteils alles
            darunter springen.
          */}
          {antwort && (
            <AntwortKasten
              antwort={antwort}
              title={title}
              t={t}
              today={today}
                /*
                  **Stream ist, wo man es ansehen kann.** Die Zugangsart
                  (kostenlos, Abo, Kauf) stand bis zum 03.09.2026 als eigene
                  Zwischenüberschrift darüber; sie steht jetzt an der Pille
                  selbst, wo sie hingehört — drei Überschriften über je einer
                  Pille waren mehr Gliederung als Inhalt.
                */
                stream={sortiertNachZugang.flatMap(({ plattformen }) =>
                  plattformen.map((s) => {
                    const grenze = dubGrenze(s.dubRanges)
                    /*
                      Lücken mitten in der Staffel kann `dubGrenze` nicht: Sie
                      kennt nur „ab" und „bis". Bei „Hensuki" (1–4 und 6–12
                      deutsch, 5 nicht) meldete sie „bis Folge 4" und unterschlug
                      acht Folgen.
                    */
                    const luecken = dubLuecken(s.dubRanges)
                    return (
                      <Pille
                        key={s.platform}
                        name={PLATFORMS[s.platform].name}
                        farbe={PLATFORMS[s.platform].color}
                        url={s.url}
                        unten={
                          [
                            luecken
                              ? t('detail.dubLuecken', { n: luecken })
                              : grenze
                                ? t(grenze.schluessel, { n: grenze.n })
                                : '',
                            s.teilBereich
                              ? t('detail.teilBereich', { von: s.teilBereich.von, bis: s.teilBereich.bis })
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ') || undefined
                        }
                        titel={
                          (s.sharedWith ?? 0) > 1
                            ? t('detail.sharedUrlNote', { count: s.sharedWith! })
                            : undefined
                        }
                        rechts={<DubMark dub={s.dub} />}
                      />
                    )
                  }),
                )}
                /*
                  **Disc ist, was man kauft** — Händler und Vorbestellungen.
                  Vier Ausgaben desselben Verlags sind **eine** Auskunft, keine
                  vier (Daniel, 20.08.2026): eine Pille je Shop, die Zahl der
                  Ausgaben in der zweiten Zeile.
                */
                disc={[
                  ...sortiertNachZugang.flatMap(({ shops }) =>
                    shops.map((g) => (
                      <Pille
                        key={g.shop + g.eintraege[0].url}
                        name={g.shop}
                        url={g.eintraege[0].url}
                        unten={
                          g.eintraege.length > 1
                            ? t('where.angebote', { count: g.eintraege.length })
                            : undefined
                        }
                      />
                    )),
                  ),
                  ...vorbestellungen.map((r) => (
                    <VorbestellPille key={r.slug} release={r} titel={anzeigeName(title)} />
                  )),
                ]}
            />
          )}
          {/*
            „Wo läuft es" steht seit dem 24.08.2026 **vor** den Terminen.

            Der Block lag bis dahin unter Terminen und Handlung. Dabei ist das
            grüne „DE ✓" die wertvollste Angabe der Seite — der Kalender
            existiert, um genau diese Frage zu beantworten. JustWatch baut die
            ganze Detailseite darum herum: Anbieter groß, klickbar, zuerst.

            Verschoben wurden beide Fassungen, die mit Anbietern und die
            Fehlanzeige — sonst stünde je nach Datenlage mal das eine, mal das
            andere an anderer Stelle.
          */}
          {/*
            **Drei Reihen Pillen statt einer Liste voller Zeilen.**

            Jeder Weg nahm bisher die volle Breite ein; bei vier Anbietern waren
            das vier Zeilen, und darunter kamen dieselben Anbieter noch einmal
            als Terminbloecke. Daniel am 25.08.2026: "die einträge müssen extrem
            viel weniger platz einnehmen ... sie müssen pills sein die anklickbar
            sind."

            Die Reihen trennen, was ein Besucher wirklich unterscheidet:
            **ansehen**, **kaufen**, **vorbestellen**. Die dritte Reihe gibt es,
            damit "vorbestellen" einmal ueber der Reihe steht statt in jeder
            Pille — und damit ein Termin, den es noch nicht gibt, nicht neben
            einem verfuegbaren Angebot steht.
          */}
          {/*
            **Ein Abgang ist eine Auskunft, kein Loch.**

            Bis zum 01.09.2026 fiel ein Verweis stillschweigend heraus, sobald er
            ins Leere führte. Daniel: „auch bei titeln die aus dem katalog eines
            anbieters fliegen entsprechend anzeigen … ‚seit <datum> nicht mehr im
            katalog von <anbieter>'" — und: „sie sind schließlich nicht mehr
            klickbar."

            Deshalb ein Vermerk, kein Verweis: gedämpft, durchgestrichen, ohne
            `href`. Er steht **über** den Wegen, die es noch gibt, denn wer den
            Titel dort gesucht hat, sucht zuerst nach dieser Auskunft.
          */}
          {(title.entfernteStreams?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {title.entfernteStreams!.map((s) => (
                <span
                  key={s.platform + s.url}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-1.5 py-1 text-[11px] text-slate-400 dark:border-white/15 dark:text-slate-500"
                >
                  <span className="line-through">{PLATFORMS[s.platform]?.name ?? s.platform}</span>
                  <span>{t('detail.gone', { d: formatDate(s.entferntAm ?? '') })}</span>
                </span>
              ))}
            </div>
          )}


          {/*
            Kein Anbieter? Dann steht das da — statt gar nichts.

            Bis zum 20.08.2026 wurde der ganze Abschnitt weggelassen, sobald wir
            keine Bezugsquelle kannten. Das betraf **665 von 2.760 Titeln**, und
            für einen Besucher waren zwei sehr verschiedene Dinge nicht zu
            unterscheiden: „läuft nirgends" und „wissen wir nicht". Bei
            „.hack//SIGN" etwa ist die deutsche Synchro über Sprechrollen belegt,
            nur weiß niemand, wo man sie heute noch sehen kann.

            Das ist genau der Fall, für den der Projektgrundsatz „Unsicheres
            kennzeichnen statt weglassen" gemacht ist. Ein Satz, kein Absatz: Er
            hat die eine Aufgabe, das Suchen auf dieser Seite zu beenden.
          */}
          {/*
            **Solange ein Film im Kino läuft, ist „Kein Anbieter bekannt" eine
            Irreführung — danach die richtige Auskunft.**

            Der Satz stand unter „Detektiv Conan Film 29", während der Film in
            36 Städten lief (Daniel, 25.08.2026: „wieso keine anbieter
            bekannt?"). Der Anbieter war das Kino, und der Termin stand drei
            Zeilen höher.

            Ihn bei jedem Kinofilm auszublenden wäre aber zu grob: „später
            irgendwann kommen kinofilme auch bei anbietern, aber solang es keine
            gibt, brauch dieser text da nich stehen. erst wenn der film in
            keinem kino mehr läuft, dann."

            Entschieden wird deshalb am **belegten letzten Spieltag**
            (`cinemaUntil`, aus dem CineStar-Programm über 43 Standorte) — nicht
            an einer geschätzten Laufzeit.

            Vier Fälle, und alle vier fallen richtig:

            | Kino | Stream/Disc | Hinweis |
            |---|---|---|
            | läuft | vorhanden | nein — die erste Bedingung greift |
            | läuft | keiner | nein — der Anbieter ist das Kino |
            | vorbei | vorhanden | nein — die erste Bedingung greift |
            | vorbei | keiner | **ja** |

            Dass beides gleichzeitig gilt, ist dabei der Normalfall und kein
            Sonderfall: Ein Film kann im Kino laufen und schon auf Disc sein
            (Daniel, 25.08.2026). Die Bedingungen schließen einander nicht aus.

            Fehlt `cinemaUntil` — etwa weil CineStar den Film nicht führt —,
            zählt der Starttermin: Ab dem Kinostart gilt der Film als laufend,
            bis das Gegenteil belegt ist. Das ist die vorsichtige Seite: lieber
            einen Hinweis zu wenig als eine falsche Auskunft.
          */}
          {/*
            **Bei einem Titel ohne deutsche Fassung entfällt der Block ganz.**

            Bei „Mission: Yozakura Family" stand oben „Noch keine deutsche
            Fassung — bisher kein deutscher Anbieter" und zwei Zeilen darunter
            noch einmal „WO LÄUFT ES: Kein Anbieter bekannt". Daniel am
            01.09.2026: „also ist es logisch das kein anbieter bekannt ist, es
            sollte umformuliert werden oder der bereich muss in solchen fällen
            einfach versteckt werden."

            Die Auskunft ist dieselbe, nur zweimal — und die zweite liest sich
            wie eine eigene Feststellung. Wo deutsche Sprechrollen belegt sind,
            bleibt der Block: Dort sagt er etwas anderes („es gab eine Fassung,
            wir kennen nur keinen Weg mehr dorthin"), und das steht sonst
            nirgends.
          */}
          {title.streams.length === 0 &&
            (title.watchLinks?.length ?? 0) === 0 &&
            (title.hasVoices || antwort?.art !== 'ohne') &&
            !releases.some(
              (r) =>
                r.platform === 'kino' &&
                (r.cinemaUntil
                  ? r.cinemaUntil >= today
                  : (r.schedule?.firstEpisodeDate ?? '') >= today),
            ) && (
            <div>
              <SectionTitle>{t('detail.whereToWatch')}</SectionTitle>
              {/*
                Sind deutsche Sprechrollen belegt, ist mehr bekannt als „nichts":
                Es gab eine deutsche Fassung, wir kennen nur keinen Weg mehr
                dorthin. Wer das liest, sucht gebraucht statt bei den
                Streamingdiensten weiter.
              */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(title.hasVoices ? 'detail.whereDubbedButGone' : 'detail.whereUnknown')}
              </p>
            </div>
          )}

          {/*
            **Dieser Block endet hier — und bis zum 25.08.2026 tat er das nicht.**

            Der Umbau vom 24.08.2026 („Reihen-Umschalter zieht nach unten") hat
            das schließende `</div>)}` an seiner alten Stelle stehen lassen, gut
            zweihundert Zeilen weiter unten. Damit hingen **das Reihen-Karussell
            und sämtliche Release-Termine** an der Bedingung „kein Anbieter
            bekannt": Wer einen Stream hatte, sah beides nicht mehr.

            Live gemessen am 25.08.2026 an drei Titeln — Dan Da Dan, Clevatess,
            Sakamoto Days. Bei allen dreien fehlte „Release-Termine für deutsche
            Synchro" vollständig, also genau die Auskunft, für die es diese Seite
            gibt. Aufgefallen ist es an einer Nebenwirkung: Daniel klickte im
            Karussell eines Kinofilms auf einen Teil mit Disney+-Verweis, und das
            Karussell verschwand.

            **JSX verschluckt so etwas lautlos.** Der Baum bleibt gültig, `tsc`
            und ESLint sehen kein Problem, und der Unterschied zeigt sich nur an
            Titeln, die die Bedingung nicht erfüllen. Ein Bedingungsblock, der
            mehr als eine Handvoll Zeilen umfasst, gehört deshalb sichtbar
            geschlossen — und wer einen Abschnitt verschiebt, prüft danach einen
            Fall, der **in den anderen Zweig** fällt.
          */}

          {/*
            Der Umschalter über die Reihe.

            Vorher gab es je Staffel eine eigene Kachel und ganz unten eine
            Liste „Staffeln dieser Reihe" — die im Kalender fast immer leer war,
            weil sie nur Staffeln mit Termin kannte. Wer von Staffel 4 zu
            Staffel 2 wollte, fand keinen Weg dorthin, und „Alle Termine" gab es
            nur bei der einen Staffel, die man gerade offen hatte (Daniel,
            12.08.2026).

            Jetzt trägt der Kopf den Reihennamen, und hier wird gewählt, worauf
            sich alles darunter bezieht. Ein `select` statt einer Liste, weil
            eine Reihe zehn Einträge haben kann und die Termine darunter der
            eigentliche Inhalt bleiben sollen.
          */}
          {/*
            Der Reihen-Umschalter steht seit dem 24.08.2026 hier, nach den
            Anbietern -- nicht mehr als Erstes unter dem Kopf.

            Er ist Navigation, keine Antwort: Wer das Panel oeffnet, will
            zuerst wissen, wann und wo. Erst danach stellt sich die Frage nach
            den anderen Teilen der Reihe.

            Die Ueberschrift nennt die Zahl. Ein Band ohne sie sieht bei drei
            sichtbaren Kacheln nach drei Teilen aus -- "Ghost in the Shell" hat
            einundzwanzig.
          */}
          {reihenTeile.length > 1 && (
            <div>
              <SectionTitle>{t('detail.seriesPartsCount', { count: reihenTeile.length })}</SectionTitle>
              {/*
                **Eine Liste über die volle Breite, kein Band mehr.**

                Bis zum 03.09.2026 stand hier ein waagerechtes Karussell aus
                Kacheln von 96 Pixeln. Bei einer Reihe wie „Die Tagebücher der
                Apothekerin" hießen fünf von sechs Kacheln sichtbar gleich —
                „Die Tagebücher der Apothekerin…" — und der unterscheidende Teil
                lag hinter dem Abschnitt. Daniel: „es ist total unklar was man
                dort anklickt … der titel ist ausgepunktet, die echte info steht
                danach und man kann es nicht lesen."

                Seine Vorgabe: „mach einträge die die ganze breite nutzen, sodass
                man komplette titel lesen kann … Links an den einträgen kann das
                cover sein", dazu eine Höchsthöhe mit drei sichtbaren Einträgen
                und einem angeschnittenen vierten.

                **Getrennt wird nach erschienen und angekündigt**, nicht nach
                Werkart (seine Wahl unter drei Entwürfen). Das beantwortet die
                Frage, mit der jemand hierherkommt: Was kann ich jetzt sehen?
              */}
              <div className="mt-1 max-h-[13.5rem] overflow-y-auto pr-1">
                {(() => {
                  /*
                    **Künftig ist, was nach diesem Jahr anfängt.** Ein Titel aus
                    2027 ist angekündigt, einer aus 2023 gelaufen — unabhängig
                    davon, ob wir für ihn eine deutsche Fassung kennen. Fehlt das
                    Jahr, gilt der Teil als erschienen: Ein Eintrag ohne
                    Ausstrahlungsjahr ist fast immer ein alter.
                  */
                  const jahr = new Date().getFullYear()
                  /*
                    **Künftig ist, was noch keine deutsche Fassung hat und
                    frühestens dieses Jahr anfängt.**

                    Das Jahr allein genügt nicht: „Staffel 3 — Teil 1" beginnt am
                    02.10.2026 und stand mit `jpYear > jahr` bei den erschienenen
                    (Daniel, 03.09.2026: „staffel 3 gehört auch in noch nicht
                    erschienen"). Ein Tagesdatum führt die Reihe nicht mit — aber
                    `ohneSynchro` sagt genau das, worum es hier geht: Für diesen
                    Teil gibt es hier noch nichts zu sehen.

                    Ein Titel aus einem späteren Jahr ist immer künftig, auch wenn
                    wir schon eine Fassung kennen.
                  */
                  const kuenftig = (m: FranchiseMember) =>
                    (m.jpYear ?? 0) > jahr || (Boolean(m.ohneSynchro) && (m.jpYear ?? 0) >= jahr)
                  /*
                    **Erst die Staffeln, dann alles Übrige — jeweils nach Datum.**

                    Rein chronologisch stand zwischen Staffel 1 und Staffel 2 eine
                    ONA von 2023 (Daniel: „sortierung der einträge falsch … sie
                    sollten zuerst nach hauptstaffeln sortiert sein, dann nach
                    datum"). Wer eine Reihe öffnet, sucht die nächste Staffel; ein
                    Spin-off dazwischen unterbricht genau die Reihenfolge, die er
                    im Kopf hat.
                  */
                  const nachRang = (a: FranchiseMember, b: FranchiseMember) => {
                    const rang = (m: FranchiseMember) => (istStaffel(m.format) ? 0 : 1)
                    return rang(a) - rang(b) || (a.jpYear ?? 0) - (b.jpYear ?? 0) || a.id - b.id
                  }
                  const erschienen = reihenTeile.filter((m) => !kuenftig(m)).sort(nachRang)
                  const kommt = reihenTeile.filter(kuenftig).sort(nachRang)

                  /*
                    **Die Staffeln werden gezählt, damit die erste „Staffel 1"
                    heißt.** Sie trägt im Datensatz meist den bloßen Reihennamen;
                    nach dem Abzug unten bliebe nichts übrig, und im Panel stand
                    dann derselbe Text wie in der Überschrift darüber (Daniel:
                    „1. eintrag dort müsste staffel 1 heißen").
                  */
                  const staffelNr = new Map<number, number>()
                  reihenTeile
                    .filter((m) => istStaffel(m.format))
                    .slice()
                    .sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0) || a.id - b.id)
                    .forEach((m, i) => staffelNr.set(m.id, i + 1))

                  const zeile = (m: FranchiseMember, offen: boolean) => {
                    const gewaehlt = m.id === title.id
                    const gemerkt = favorites.has(m.id)
                    /*
                      **Gezeigt wird der unterscheidende Teil, nicht der ganze
                      Name.** Der Reihenname steht zwei Zeilen höher; ihn hier
                      sechsmal zu wiederholen füllt die Breite, die gerade erst
                      gewonnen wurde. Bleibt nach dem Abzug nichts übrig, steht
                      der volle Name da — bei der ersten Staffel ist das der
                      Normalfall.
                    */
                    const voll = eindeutschenStaffel(m.name)
                    let rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
                      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
                      : voll
                    /*
                      **Trägt der Name einen fremden Reihennamen, zählt trotzdem
                      nur die Staffelangabe.**

                      „Kusuriya no Hitorigoto Staffel 3 Teil 2" beginnt nicht mit
                      unserem Reihennamen, weil für diesen Teil kein deutscher
                      Titel existiert — der Abzug oben greift dann nicht, und in
                      der Liste stand der volle japanische Name (Daniel,
                      03.09.2026). Einen deutschen Namen können wir nicht
                      erfinden; die Staffelangabe reicht aber, denn welche Reihe
                      gemeint ist, steht zwei Zeilen höher.
                    */
                    const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
                    if (staffelTeil && rest !== staffelTeil[1]) rest = staffelTeil[1]!
                    /* Und die erste Staffel heißt „Staffel 1", nicht wie die Reihe. */
                    const nr = staffelNr.get(m.id)
                    const beschriftung = rest || (nr ? t('detail.staffelNummer', { n: nr }) : voll)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        aria-selected={gewaehlt}
                        disabled={wechselt}
                        ref={
                          gewaehlt
                            ? (el) => el?.scrollIntoView({ block: 'nearest' })
                            : undefined
                        }
                        onClick={() => !gewaehlt && wechsleZu(m.id)}
                        className={[
                          'flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left transition',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60',
                          gewaehlt
                            ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400/50 dark:bg-sky-400/10'
                            : offen
                              ? 'cursor-pointer border-dashed border-slate-300 opacity-80 hover:opacity-100 dark:border-white/20'
                              : gemerkt
                                ? 'cursor-pointer border-amber-400/70 hover:border-amber-400 dark:border-amber-400/60'
                                : 'cursor-pointer border-transparent hover:border-slate-200 dark:hover:border-white/10',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'block h-14 w-10 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-white/5',
                            offen ? 'opacity-60' : '',
                          ].join(' ')}
                        >
                          {m.cover && (
                            <img
                              src={m.cover}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={[
                              'block text-sm leading-snug',
                              gewaehlt
                                ? 'font-medium text-sky-700 dark:text-sky-300'
                                : 'text-slate-700 dark:text-slate-200',
                            ].join(' ')}
                          >
                            {beschriftung}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {[
                              m.format && m.format !== 'TV' ? (FORMAT_DE[m.format] ?? m.format) : '',
                              m.jpYear,
                              m.episodes ? t('detail.folgenKurz', { n: m.episodes }) : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        {gemerkt && (
                          <span className="shrink-0 text-sm text-amber-400" aria-label={t('card.unfavourite')}>
                            ★
                          </span>
                        )}
                      </button>
                    )
                  }

                  return (
                    <div role="tablist" aria-label={t('detail.seriesParts')} className="flex flex-col gap-0.5">
                      {erschienen.map((m) => zeile(m, false))}
                      {kommt.length > 0 && (
                        <div className="my-1.5 flex items-center gap-2">
                          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {t('detail.reiheKuenftig')}
                          </span>
                          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                        </div>
                      )}
                      {kommt.map((m) => zeile(m, true))}
                    </div>
                  )
                })()}
              </div>
              {wechselt && <span className="text-[11px] text-slate-400">{t('detail.seasonLoading')}</span>}
            </div>
          )}

          {/*
            **Der Terminblock steht nur, wenn es noch etwas zu terminieren gibt.**

            Daniel am 03.09.2026: „release termine bereich nur anzeigen, wenn es
            zukünftige termine für diesen titel gibt." Bei einer Reihe, die
            2024 zu Ende lief, beantwortet eine Überschrift „RELEASE-TERMINE FÜR
            DEUTSCHE SYNCHRO" keine Frage mehr — sie kündigt etwas an, das
            längst vorbei ist, und schiebt die Handlung nach unten.

            **Ein Disc-Termin zählt hier mit**, anders als im Kopf: Wer vorbestellen
            kann, hat sehr wohl einen Termin vor sich. Der Kopf beantwortet die
            Frage „wann kann ich es sehen", dieser Block die Frage „was steht
            noch an".
          */}
          {releases.length > 0 && !releases.some((r) => hatKuenftigenTermin(r, today)) ? null : releases.length > 0 ? (
            <div className="flex flex-col gap-3">
              <SectionTitle>{t('detail.releases')}</SectionTitle>
              {gruppiereReleases(releases).map((gruppe) =>
                gruppe.length > 1 ? (
                  <ReleaseGruppe key={gruppe[0].slug} releases={gruppe} today={today} />
                ) : (
                  <ReleaseBlock key={gruppe[0].slug} release={gruppe[0]} today={today} />
                ),
              )}
              {/* Zusatzangaben zum Termin gehören zum Termin, nicht in einen
                  eigenen Abschnitt weiter unten (Daniel, 15.08.2026). */}
              <Meldungen titleId={title.id} />
            </div>
          ) : (
            /*
              Dieselbe Form wie ein echter Termin, nur mit „unbekannt".

              Vorher stand hier ein Kasten mit zwei Sätzen: „Die deutsche
              Fassung ist erschienen. Ein genaues Datum führen wir dazu nicht —
              die Verweise unten führen hin." Das war viel Text für eine
              einzige Auskunft, und es sah anders aus als jeder andere Titel.
              „Im Angebot seit: unbekannt" sagt dasselbe in einer Zeile und an
              derselben Stelle wie sonst auch (Daniel, 12.08.2026).
            */
            <div className="flex flex-col gap-3">
              {/*
                Die Überschrift fällt mit ihrem Inhalt weg. Bei „Cowboy Bebop"
                stand „RELEASE-TERMINE FÜR DEUTSCHE SYNCHRO" über einer leeren
                Fläche, nachdem der Block darunter entfallen war — die Auskunft
                steht im Kasten oben („Auf Deutsch seit 08.01.2003 · Dybex").
              */}
              {(title.ohneSynchro || title.angebotSeit || !title.deErstausgabe) && (
                <SectionTitle>{t('detail.releases')}</SectionTitle>
              )}
              {title.ohneSynchro ? (
                /*
                  Für einen Titel ohne belegte Synchro wäre „Termin unbekannt"
                  die falsche Auskunft: Unbekannt ist nicht der Termin, sondern
                  ob es überhaupt je eine deutsche Fassung gibt. Hier steht
                  deshalb, was wir wirklich wissen — und was der Stern bringt.
                */
                <section className="rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-3 dark:border-white/20 dark:bg-white/[0.02]">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('detail.noDubTitle')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('detail.noDubBody')}
                  </p>
                  {/*
                    Der Hinweis sagt, was der Stern **bewirkt**, und das hängt
                    davon ab, ob ein Newsletter hinterlegt ist.

                    Vorher stand hier „☆ Merken — du bekommst eine Mail, sobald
                    sich das ändert." Das versprach eine Mail an jemanden, der
                    womöglich gar nicht abonniert hat (Daniel, 15.08.2026:
                    „schwammig formuliert und nutzer können es leicht falsch
                    verstehen"). Jetzt steht bei einem verbundenen Browser die
                    Adresse da, an die wir tatsächlich schreiben, und bei einem
                    unverbundenen der zweite nötige Schritt.
                  */}
                  <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    {verbindung.verbunden
                      ? t('detail.noDubWatchConnected', { mail: verbindung.mail ?? '' })
                      : t('detail.noDubWatchOpen')}
                  </p>
                  {favorites.has(title.id) && (
                    <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t('detail.noDubWatched')}
                    </p>
                  )}
                </section>
              ) : !title.angebotSeit && title.deErstausgabe ? (
                /*
                  **Der ganze Block entfällt, wo der Kasten oben es besser weiß.**

                  Bei „Cowboy Bebop" stand hier „RELEASE-TERMINE FÜR DEUTSCHE
                  SYNCHRO — Erscheinungstermin: vorhanden, Termin nicht erfasst",
                  während zwei Handbreit darüber „Auf Deutsch seit 08.01.2003 ·
                  Dybex S.A." zu lesen war. Das war nicht nur doppelt, es
                  widersprach sich: Der Termin **ist** erfasst.

                  Ohne die Zeile bliebe eine Überschrift über zwei Abzeichen —
                  also fällt der Block ganz weg. Der Status steht ohnehin im
                  Kasten, und die FSK bei den Werkangaben.

                  `angebotSeit` behält seinen Platz: Es sagt etwas anderes (seit
                  wann ein Anbieter den Titel führt) und stammt aus einer eigenen
                  Quelle.
                */
                null
              ) : (
              <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={status} />
                  {title.fsk !== undefined && <FskBadge fsk={title.fsk} />}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <dt className="text-slate-400">
                    {t(title.angebotSeit ? 'detail.offerSince' : 'detail.availableFrom')}
                  </dt>
                  <dd>
                    {/*
                      **Ein Datum, wo bisher „unbekannt" stand.**

                      329 Titel mit belegter deutscher Synchro haben keinen
                      Termin — erschienen, bevor der Kalender sie kannte. Für sie
                      führt die Streaming Availability API ein `availableSince`:
                      seit wann der Anbieter den Titel listet.

                      Das ist **nicht** das Erscheinungsdatum der deutschen
                      Fassung, und der Tooltip sagt das auch. Es ist trotzdem
                      mehr als „unbekannt": Wer wissen will, ob ein Titel gerade
                      erst dazukam oder schon zwei Jahre liegt, bekommt hier die
                      Antwort.
                    */}
                    {title.angebotSeit ? (
                      <Tooltip text={t('detail.availableFromNote')} unterstrichen>
                        <span>
                          {formatDate(title.angebotSeit.date)}
                          <span className="ml-1 opacity-60">
                            ({PLATFORMS[title.angebotSeit.platform]?.name ?? title.angebotSeit.platform})
                          </span>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip
                        text={t(status === 'erschienen' ? 'detail.releasedNoDate' : 'detail.noRelease')}
                        unterstrichen
                      >
                        <span className="opacity-70">
                          {t(status === 'erschienen' ? 'detail.releasedValue' : 'detail.unknown')}
                        </span>
                      </Tooltip>
                    )}
                  </dd>
                </dl>
              </section>
              )}
            </div>
          )}

          {/*
            Hier stand „Alles aus dieser Reihe" — dieselben Einträge, die zwei
            Handbreit darüber schon im Umschalter stehen. Zwei Listen mit
            identischem Inhalt sind keine doppelte Auskunft, sondern doppelte
            Länge (Daniel, 12.08.2026).
          */}
          {plot && (
            <div>
              <SectionTitle>{t('detail.plot')}</SectionTitle>
              {/*
                Zuerst zwei Sätze, den Rest auf Wunsch.

                Eine Inhaltsangabe von tausend Zeichen schob alles darunter aus
                dem Bild — die deutschen Stimmen, die Keywords, die
                Quellenangabe. Wer die Handlung lesen will, klickt; wer sie nur
                einordnen will, sieht den Anfang und bleibt im Überblick
                (Daniel, 12.08.2026).
              */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {plotOffen || plot.text.length <= PLOT_PREVIEW
                  ? plot.text
                  : `${plot.text.slice(0, PLOT_PREVIEW).trimEnd()} …`}
              </p>
              {plot.text.length > PLOT_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setPlotOffen((v) => !v)}
                  aria-expanded={plotOffen}
                  className="mt-1 cursor-pointer text-xs text-sky-500 hover:underline"
                >
                  {t(plotOffen ? 'detail.plotLess' : 'detail.plotMore')}
                </button>
              )}
              {plot.fallback && (
                <p className="mt-1.5 text-[11px] text-slate-400">{t('detail.plotOnlyEnglish')}</p>
              )}
              {/*
                Die Quelle im selben Stil wie unter einem Termin: „Quelle:
                anisearch.de". Vorher stand sie nur als Fließtext ganz unten in
                der Metazeile und war weder als Quelle erkennbar noch anklickbar.
              */}
              {/*
                Die Quelle steht jetzt an genau einer Stelle und nennt die
                richtige. Vorher stand sie zweimal da: einmal als Fließtext am
                Ende der aniSearch-Beschreibung und einmal als Zeile darunter,
                die pauschal „themoviedb.org" behauptete — auch bei den 2.385
                Texten, die von aniSearch stammen (Daniel, 12.08.2026).
              */}
              <p className="mt-2 text-[11px] text-slate-400">
                {t('detail.source')}:{' '}
                <a
                  href={plot.quelle.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-sky-400"
                >
                  {plot.quelle.name}
                </a>
              </p>
            </div>
          )}

          {/*
            Die Angaben zum Werk selbst — Genres, Bewertung, Studio.

            Sie standen bis zum 24.08.2026 direkt unter dem Titel, vor allem
            anderen. Dabei beantworten sie eine Frage, die sich erst **nach**
            der eigentlichen stellt: „ist das überhaupt meins?" kommt nach „wann
            kommt es und wo läuft es".

            Offen bleibt, was oft gebraucht wird — die ersten drei Genres, die
            Bewertung, das Studio. Ein Aufklapp-Bereich, der vier verschiedene
            Dinge verspricht („Details, Genres, Bewertung, Quellen"), wird
            seltener geöffnet als drei sichtbare Zeilen. Weggeklappt sind nur
            die übrigen Genres.
          */}
          {(title.genres.length > 0 || title.score !== undefined || title.studios?.[0]) && (
            <div>
              <SectionTitle>{t('detail.werkangaben')}</SectionTitle>
              {title.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(genresOffen ? title.genres : title.genres.slice(0, 3)).map((g) => (
                    <Chip key={g} onClick={() => onFilterBy('genre', g)}>
                      {tGenre(g)}
                    </Chip>
                  ))}
                  {!genresOffen && title.genres.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setGenresOffen(true)}
                      className="cursor-pointer rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-slate-400 dark:border-white/10 dark:text-slate-400"
                    >
                      +{title.genres.length - 3}
                    </button>
                  )}
                </div>
              )}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {title.score !== undefined && (
                  <>
                    <dt className="text-slate-400 dark:text-slate-500">{t('detail.bewertung')}</dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {/*
                        Die Wertung nennt ihre Quelle — sonst sieht es aus, als
                        wäre es unsere. „★ 8.4" ohne Herkunft las sich, als
                        hätten wir diesen Anime selbst bewertet (Daniel,
                        15.08.2026). Wir bewerten nichts; die Zahl ist der
                        Nutzerdurchschnitt von AniList.
                      */}
                      <span className="text-amber-400" aria-hidden="true">
                        ★
                      </span>{' '}
                      <span className="font-semibold tabular-nums">{(title.score / 10).toFixed(1)}</span>{' '}
                      <span className="text-slate-400 dark:text-slate-500">AniList</span>
                    </dd>
                  </>
                )}
                {title.studios?.[0] && (
                  <>
                    <dt className="text-slate-400 dark:text-slate-500">{t('detail.studio')}</dt>
                    <dd className="text-slate-600 dark:text-slate-300">{title.studios.join(', ')}</dd>
                  </>
                )}
                {/*
                  Die Altersfreigabe gehört zum Werk, nicht zum Termin — sie
                  stand bisher nur im Terminblock und verschwand mit ihm, wo der
                  entfällt.
                */}
                {title.fsk !== undefined && (
                  <>
                    <dt className="text-slate-400 dark:text-slate-500">{t('detail.faktFsk')}</dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {t('antwort.fskAb', { n: title.fsk })}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {title.hasVoices && <VoiceCast titleId={title.id} />}

          {title.keywords.length > 0 && (
            <div>
              <SectionTitle>{t('detail.keywords')}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <Chip key={k} onClick={() => onFilterBy('keyword', k)}>
                    {tKeyword(k)}
                  </Chip>
                ))}
                {title.keywords.length > KEYWORD_PREVIEW && (
                  <Chip onClick={() => setAllKeywords((v) => !v)}>
                    {allKeywords
                      ? t('filter.showLess')
                      : `(…) ${t('filter.showMore', { count: title.keywords.length })}`}
                  </Chip>
                )}
              </div>
            </div>
          )}

          {/*
            **Die Quellen stehen gesammelt unten, nicht an jedem Bereich.**

            Hier stand bis zum 29.08.2026 eine Zeile „Metadaten von AniList ·
            MAL 12345 · Beleg ≥4" — richtig, aber unvollständig: Sie nannte
            eine Quelle von sechs und war nicht klickbar (Daniel: „quellen
            links in details kacheln nicht anklickbar").
          */}
          <Quellenuebersicht title={title} releases={releases} />
        </div>
      </aside>
    </>
  )
}
