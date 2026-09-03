import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Meldung, Release, ReleaseEvent, Title, WatchLink } from '@shared/types.ts'
import { dubGrenze, dubLuecken } from '@shared/dub-grenze.ts'
import type { Zugangsart } from '@shared/zugangsart.ts'
import { PLATFORMS } from '@shared/types.ts'
import { expandEvents, titleStatus, istErschienen } from '@shared/logic.ts'
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
  /**
   * Steht die Zeile unter einem „Noch keine deutsche Fassung"?
   *
   * Dann nennt sie ihre Quelle im Text. Sonst stand über „Auf Deutsch seit
   * 03.11.2024" die Aussage, es gebe keine deutsche Fassung — zwei Sätze, die
   * einander widersprechen, statt zweier Auskünfte mit verschiedenen Absendern
   * (Daniel, 03.09.2026: „widerspruch").
   */
  fremd = false,
): string {
  const e = title.deErstausgabe
  if (!e) return ''
  const wann = e.von ? formatDate(e.von) : (e.zeitraum ?? '')
  if (!wann) return ''
  if (fremd) {
    return e.publisher
      ? T('antwort.deSeitFremdPublisher', { datum: wann, publisher: e.publisher })
      : T('antwort.deSeitFremd', { datum: wann })
  }
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
  /*
    **Wo noch nichts erschienen ist, gibt es nichts zu sehen.**

    Bei „Apothekerin" Staffel 3 stand „01.10.2026 — Folge 1 … 0 von 12 Folgen
    erschienen" und darunter eine Crunchyroll-Pille mit „DE ✓" (Daniel,
    04.09.2026: „trotzdem crunchy pill? wenn 0, dann keine pill"). Die Pille
    sagt „dort läuft es auf Deutsch" — dort läuft aber noch gar nichts, und der
    Klick führt auf eine Seite ohne eine einzige Folge.

    **Kaufwege bleiben**, denn eine Vorbestellung ist genau für diesen Zustand
    da: Man kann sie tätigen, bevor etwas erschienen ist.
  */
  const nochNichts = antwort.art === 'laeuft' && antwort.raus === 0
  const streamPillen = nochNichts ? [] : stream
  const beides = streamPillen.length > 0 && disc.length > 0
  const pillen = zeigeDisc && disc.length ? disc : streamPillen.length ? streamPillen : disc
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
      /*
        **„Noch X" heißt: X stehen aus — die nächste eingerechnet.**

        Hier stand `rest - 1`, weil die nächste Folge eine Zeile darüber schon
        mit Datum genannt wird. Gedacht war „und danach kommen noch elf". Gelesen
        wurde es anders, und zwar zu Recht: Bei einer Staffel, von der noch keine
        einzige Folge draußen ist, stand „0 von 12 erschienen" über „noch 11 bis
        zum Finale" (Daniel, 04.09.2026: „es müsste noch 12 heißen"). Zwölf
        Folgen stehen aus, nicht elf — die nächste ist keine erschienene.
      */
      antwort.letzter && antwort.rest > 1
        ? T('antwort.nochFolgen', { count: antwort.rest, datum: formatDate(antwort.letzter) })
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
      // Die Altersfreigabe stand hier als dritte Angabe und steht seit dem
      // 04.09.2026 als Marke am Cover — sie gehört zum Werk, nicht zur Ausgabe.
    ]
  } else if (antwort.art === 'film') {
    haupt = antwort.hatSynchro ? T('antwort.filmTitel') : T('antwort.filmOhneTitel')
    neben = antwort.hatSynchro ? T('antwort.filmNeben') : T('antwort.filmOhneNeben')
    gedaempft = !antwort.hatSynchro
    zaehl = ''
    /*
      **Hier stand dreimal, was oben schon steht.**

      „2022 erschienen · ab 12 Altersfreigabe · 8-bit Studio" — und in der
      Unterzeile am Cover, drei Zentimeter darüber: „Film · JP 2022 · 8-bit"
      (Daniel, 04.09.2026: „2022 info steht bereits oben … 8-bit steht bereits
      im sub-title div oben drin"). Die Altersfreigabe stand als einzige nur
      hier — sie ist jetzt eine Marke an der Unterzeile, wo die anderen
      Werkangaben ohnehin sitzen.

      Ein Film bekommt damit keine Faktenzeile mehr. Der Kasten beantwortet die
      Frage, ob es ihn auf Deutsch gibt; das Werk beschreibt der Kopf.
    */
    fakten = []
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
    neben = deSeitZeile(title, T, true)
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
        'relative flex h-[9.75rem] flex-col rounded-xl border px-3 pb-3 pt-2',
        gedaempft
          ? 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]'
          : 'border-sky-400/40 bg-gradient-to-b from-sky-500/15 to-transparent dark:border-sky-400/30',
      ].join(' ')}
    >
      {/*
        **Der Kopf steht mittig im freien Platz.**

        Die feste Höhe ist auf den längsten Zustand gerechnet — eine laufende
        Staffel mit Datum, Rhythmus, Balken und Zählzeile. Bei „Alle 24 Folgen
        auf Deutsch" bleibt davon eine Zeile übrig, und oben klaffte ein Loch,
        während die Pillen unten klebten. `justify-center` verteilt die Luft auf
        beide Seiten, statt sie an einer Stelle zu sammeln.
      */}
      {/*
        **Kein `flex-1` mehr am Kopfteil** (Daniel, 03.09.2026: „‚alle folgen'
        div-element: flex:1 entfernen"). Es zog den Kopf in die Mitte des
        Kastens und ließ darüber wie darunter Luft; jetzt steht er oben, und der
        freie Platz sammelt sich über den Pillen, wo er nicht auffällt.
      */}
      <div className="flex flex-col">
      <div className="flex items-start gap-2">
      <p
        className={[
          'text-lg font-bold leading-tight tracking-tight',
          gedaempft ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white',
        ].join(' ')}
      >
        {haupt}
      </p>
      {/*
        **Überschrift und Umschalter teilen sich eine Zeile.**

        Der Umschalter saß bis zum 03.09.2026 abends absolut in der Ecke und
        über der Überschrift — zwei Zeilen für zwei Angaben, die nebeneinander
        passen. Daniel: „headline auf selbe zeile wie den toggle, trennstrich
        genau darunter, dann die pills. box müsste also um ~2 zeilen kleiner
        werden."
      */}
      {beides && (
        <div
          className="ml-auto mb-[5px] inline-flex shrink-0 self-start rounded-full border border-slate-300/60 bg-white/70 p-0.5 text-[11px] dark:border-white/15 dark:bg-black/25"
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
      </div>
      {neben && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" title={nebenTitel}>
          {neben}
        </p>
      )}

      {fakten ? (
        /* `mb-1` hält die Beschriftungen von der Trennlinie darunter frei — bei
           „Venus Wars" lag „erschienen / Altersfreigabe / Studio" halb darauf. */
        <div className="mb-1 mt-2 flex gap-4">
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
          {/*
            **Eine Reihe, nicht zwei.**

            Bis zum 03.09.2026 abends waren zwei Reihen fest reserviert, und
            `grid-flow-col` füllte erst die Spalte: Zwei Pillen standen
            untereinander, obwohl nebeneinander Platz für vier gewesen wäre.
            Daniel: „zu viel platz verschwendung."

            Jetzt eine Reihe, die nach rechts läuft. Der Kasten behält seine
            feste Höhe, und was nicht hineinpasst, wird gescrollt statt den Kopf
            zu verschieben.
          */}
          <div className="flex min-h-[2.1rem] items-start gap-1.5 overflow-x-auto pb-1">
            {pillen}
          </div>
        </div>
      )}
    </section>
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
/**
 * **Ein zugegangener Weg sieht aus wie der Weg, nur durchgestrichen.**
 *
 * Der Vermerk war bis zum 03.09.2026 abends eine graue Kachel mit gestricheltem
 * Rand — sie sah aus wie ein Platzhalter, nicht wie „Netflix, aber nicht mehr".
 * Daniel: „graue netflix box identisch zu netflix pill (rot etc) aber
 * durchgestrichen mit ?-icon und bei hover/touch — tooltip mit erklärung das aus
 * bestand entfernt seit <datum>".
 *
 * Sie trägt deshalb die Anbieterfarbe wie jede andere Pille, nur gedämpft, und
 * ist kein Verweis: Ein Klick führte ins Leere, und genau das ist die Auskunft.
 * Das Fragezeichen trägt den Tooltip — auf einem Gerät ohne Mauszeiger ist ein
 * Zeichen zum Antippen der einzige Weg zu einer Erklärung.
 */
function WegPille({ name, farbe, hinweis }: { name: string; farbe?: string; hinweis: string }) {
  return (
    <span
      className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 opacity-60"
      style={farbe ? { background: `${farbe}14`, boxShadow: `inset 0 0 0 1px ${farbe}44` } : undefined}
    >
      <span
        className="truncate text-[13px] font-medium line-through"
        style={farbe ? { color: farbe } : undefined}
      >
        {name}
      </span>
      <Tooltip text={hinweis} seite="oben">
        <span
          className="cursor-help rounded-full border border-current px-1 text-[10px] leading-tight text-slate-500 dark:text-slate-400"
          aria-label={hinweis}
        >
          ?
        </span>
      </Tooltip>
    </span>
  )
}

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
        'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 transition',
        farbe
          ? 'hover:brightness-95 dark:hover:brightness-125'
          : 'border border-slate-200 hover:bg-slate-100/60 dark:border-white/10 dark:hover:bg-white/5',
      ].join(' ')}
      style={farbe ? { background: `${farbe}1f`, boxShadow: `inset 0 0 0 1px ${farbe}55` } : undefined}
    >
      <span className="flex flex-col leading-tight">
        <span
          className="whitespace-nowrap text-[13px] font-medium"
          style={farbe ? { color: farbe } : undefined}
        >
          {name}
        </span>
        {/*
          **Kein `truncate` mehr.** Die Unterzeile trug Sätze wie „Ohne deutschen
          Ton: Folge 2–33" und wurde ausgepunktet — eine halbe Auskunft ist
          schlechter als eine kurze (Daniel, 03.09.2026). Seit den gekürzten
          Texten („✕ DE 2–33") passt sie, und `whitespace-nowrap` hält sie in
          einer Zeile: Die Pille wächst lieber mit, als etwas zu verschlucken.
        */}
        {unten && (
          <span
            className={`whitespace-nowrap text-[11px] ${farbe ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}
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

/**
 * **„Merken" — ein Symbol, ein Wort, zwei Wege dahinter.**
 *
 * Steht in jeder Pille, die einen künftigen Termin trägt: an der Release-Pille
 * einer Disc ebenso wie an der Anbieter-Pille einer laufenden Serie. Steht
 * nichts mehr aus, erscheint er nicht — ein Kalendereintrag für etwas
 * Vergangenes ist kein Angebot, sondern ein Fehlgriff.
 */
function MerkenKnopf({
  release,
  today,
  farbe,
}: {
  release?: Release
  today: string
  farbe?: string
}) {
  const { t } = useLang()
  const [merkenOffen, setMerkenOffen] = useState(false)
  const kuenftige = release ? expandEvents(release).filter((e) => e.date >= today) : []
  const ev = kuenftige[0]
  if (!ev || !release) return null
  return (
      <span className="relative ml-2 shrink-0">
        <button
          type="button"
          onClick={() => setMerkenOffen((v) => !v)}
          aria-expanded={merkenOffen}
          className="flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium transition hover:brightness-95 dark:hover:brightness-125"
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
          {t('detail.merken')}
        </button>
        {merkenOffen && (
          <span className="absolute right-0 top-8 z-20 flex w-max flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-[12px] shadow-lg dark:border-white/10 dark:bg-[#141b2d]">
            <a
              href={googleCalendarUrl(ev)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setMerkenOffen(false)}
              className="px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {t('detail.merkenGoogle')}
            </a>
            <button
              type="button"
              onClick={() => {
                /* Alle künftigen Folgen, nicht nur die nächste — genau
                   dafür lädt jemand eine Kalenderdatei statt einen
                   Einzeltermin einzutragen. */
                downloadIcs(kuenftige, release.slug)
                setMerkenOffen(false)
              }}
              className="cursor-pointer px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {t('detail.merkenIcs')}
            </button>
          </span>
        )}
      </span>
  )
}

/**
 * **Das Medium aus der Editionsangabe** — „Limited Steelbook Edition, Blu-ray"
 * trägt es am Ende, andere Ausgaben mittendrin. Gesucht wird deshalb im ganzen
 * Text, und die genauere Angabe gewinnt: „DVD & Blu-ray" ist beides.
 */
function mediumAus(edition?: string): string | undefined {
  if (!edition) return undefined
  const bd = /blu-?ray/i.test(edition)
  const dvd = /\bdvd\b/i.test(edition)
  if (bd && dvd) return 'DVD + BD'
  if (bd) return 'Blu-ray'
  if (dvd) return 'DVD'
  return undefined
}

/** Der Händlername aus der Adresse — „amazon.de" wird zu „Amazon". */
function haendlerAus(url?: string): string {
  if (!url) return 'Shop'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
    return host.charAt(0).toUpperCase() + host.slice(1)
  } catch {
    return 'Shop'
  }
}

function ReleasePille({
  release,
  titel,
  today,
}: {
  release: Release
  titel?: string
  today: string
}) {
  const { t } = useLang()
  /*
    **Die Pille sagt, was ein Klick tut — nicht, wie die Ausgabe heißt.**

    Hier stand der gekürzte Releasename: „Staffel 1", darunter „Crunchyroll ·
    Limited Steelbook Edition, Blu-ray · ab 04.09.2026". Der Titel steht drei
    Zeilen höher im Kopf, die Edition sagt nichts über das Ziel des Links —
    und was der Klick tut, stand nirgends. Daniel am 04.09.2026: „in der pill
    sollte stehen ,[blu-ray] kaufen bei amazon'".

    Also: das Medium als Marke, dahinter die Handlung mit dem Händler. Die
    Edition rückt in die zweite Zeile, wo sie hingehört — sie unterscheidet
    Ausgaben, sie benennt keine.
  */
  const medium = mediumAus(release.edition)
  const kurzerName =
    release.releaseType === 'disc'
      ? t('detail.kaufenBei', { shop: haendlerAus(release.buyUrl ?? release.platformUrl) })
      : kuerzeUmTitel(release.name, titel)
  /*
    **Der Kalendereintrag gilt dem nächsten Termin, nicht dem ersten.**

    Bei einer Wochenserie, die seit anderthalb Jahren läuft, wäre der erste
    Termin die Folge 1 von 2023 — ein Eintrag, den niemand braucht. Steht
    nichts mehr aus, fällt das Symbol weg: Ein Kalendereintrag für etwas
    Vergangenes ist kein Angebot, sondern ein Fehlgriff.
  */
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
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium" style={farbe ? { color: farbe } : undefined}>
          {medium && (
            <span className="shrink-0 rounded bg-black/10 px-1 py-px text-[10px] uppercase tracking-wide dark:bg-white/15">
              {medium}
            </span>
          )}
          <span className="truncate">{kurzerName}</span>
        </span>
        <span className="truncate text-[11px] opacity-80" style={farbe ? { color: farbe } : undefined}>
          {/*
            **„ab" oder „seit" — ein nacktes Datum sagt beides.**

            „04.09.2026" allein lässt offen, ob die Ausgabe kommt oder schon da
            ist; genau diese Frage führt jemanden auf die Seite. Zwei Zeichen
            beantworten sie.
          */}
          {[zweite, datum && t(datum > today ? 'detail.abDatum' : 'detail.seitDatum', { d: formatDate(datum) })]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </a>
      <MerkenKnopf release={release} today={today} farbe={farbe} />
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
   * **Ein Titel, den der Kern nicht kennt, wird nachgeladen.**
   *
   * `titles-core.json` führt nur, worauf ein Termin zeigt — ein Reihenteil ohne
   * deutschen Termin steht dort nicht. Beim Einstieg über eine geteilte Adresse
   * ist das der Unterschied zwischen dem Panel und einer Fehlermeldung.
   *
   * Genau einmal je Kennung: `versucht` merkt sich, wofür schon geladen wurde,
   * damit ein wirklich unbekannter Titel nicht in eine Schleife läuft.
   */
  const [holt, setHolt] = useState(false)
  const versucht = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (data.titleById.has(titleId) || versucht.current === titleId) return
    versucht.current = titleId
    setHolt(true)
    Promise.all([loadAllTitles(data), loadOhneSynchro(data)])
      .catch(() => {})
      .finally(() => setHolt(false))
  }, [data, titleId])


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
      /*
        **Was man ansieht, ist Stream — was man kauft, ist Disc.**

        Hier stand `kind === 'stream'` ohne Rücksicht auf die Zugangsart, und
        weil die ganze `shops`-Liste in die **Disc**-Spalte geht, landete
        „Crunchyroll über Prime Video" — ein Abo, `kind: stream`,
        `zugang: abo` — unter Disc (Daniel, 04.09.2026: „dieser link führt
        nicht zum disc, sondern zum crunchy-abo auf prime … gehört in
        stream").

        Der Umschalter verspricht „Stream | Disc". Ein Abo unter Disc bricht
        genau dieses Versprechen — und zwar an der Stelle, an der jemand
        nachsieht, ob er die Serie kaufen kann.
      */
      streamWege: gruppiereKaufwege(
        (title?.watchLinks ?? []).filter(
          (w) => w.kind === 'stream' && (w.zugang ?? 'abo') === art && art !== 'kauf',
        ),
      ),
      shops: gruppiereKaufwege([
        ...(title?.watchLinks ?? []).filter(
          (w) => w.kind === 'stream' && (w.zugang ?? 'abo') === art && art === 'kauf',
        ),
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
    const belegte = gruppen.filter((g) => g.plattformen.length || g.shops.length || g.streamWege.length)
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
  /*
    **Jedes Release ist ein Weg, nicht nur das künftige.**

    Bis zum 04.09.2026 standen die Termine in einem eigenen Abschnitt darunter
    — „RELEASE-TERMINE FÜR DEUTSCHE SYNCHRO", mit Start, Folgenzahl, letzter
    Folge, Quelle und zwei Kalender-Knöpfen je Eintrag. Bei einer Staffel, die
    seit anderthalb Jahren durch ist, war das ein halber Bildschirm für eine
    Auskunft, die der Kasten oben schon gibt (Daniel, 04.09.2026: „eig gehört
    der bereich immer weg, unabhängig ob in zukunft oder nicht. die titel
    gehören mit releasedate info in disc/stream bereich … in die pill muss auch
    der calendar icon + eintrag").

    Ein Release **ist** ein Bezugsweg: Es sagt, wo etwas herkommt und ab wann.
    Beides passt in eine Pille — Name und Verlag oben, Datum unten, Kalender
    rechts. Der Abschnitt darunter sagte dasselbe in zwölf Zeilen.

    Getrennt wird nach Art: Eine Disc gehört zu den Kaufwegen, alles Übrige
    zum Stream.
  */
  const discReleases = useMemo(
    () => releases.filter((r) => r.releaseType === 'disc'),
    [releases],
  )
  /*
    **Ein Anbieter, eine Pille — auch wenn ein Release dieselbe Plattform
    meint.**

    Der erste Wurf gab jedem Release eine eigene Pille, und bei „Apothekerin"
    Staffel 1 stand „Crunchyroll" dadurch zweimal in derselben Zeile: einmal
    als Anbieter mit „DE ✓", einmal als Release mit „seit 18.11.2023". Zwei
    Pillen, ein Weg — genau die Dopplung, gegen die `CLAUDE.md` eine eigene
    Regel führt.

    Das Datum gehört an die Pille, die es betrifft. Eine eigene bekommt nur,
    was sonst gar nicht dastehen würde.
  */
  const releaseJePlattform = useMemo(() => {
    const je = new Map<string, Release>()
    for (const r of releases) if (!je.has(r.platform)) je.set(r.platform, r)
    return je
  }, [releases])
  const streamReleases = useMemo(
    () =>
      releases.filter(
        (r) =>
          r.releaseType !== 'disc' &&
          !(title?.streams ?? []).some((s) => s.platform === r.platform),
      ),
    [releases, title],
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
    /*
      **Keine Folgenzahl aus der Zahl der Termine.**

      Bei „One Piece" stand „Alle 1 Folgen auf Deutsch" — für eine Serie mit
      über tausend (Daniel, 03.09.2026: „Totale müll info"). AniList führt dort
      keine Folgenzahl (die Serie läuft weiter), und der Rückfall zählte die
      **Termine**: ein Katalog-Release ergibt ein Ereignis, also „1 Folge".

      Ein Termin ist keine Folge — außer bei einer Wochenserie, wo jede Folge
      ihren eigenen trägt. Nur dort zählt der Rückfall noch.
    */
    const nurWochen = fuerKopf.every((r) => r.releaseType === 'weekly')
    const gesamt = title.episodes ?? (nurWochen && alleEvents.length > 1 ? alleEvents.length : undefined)
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

  /**
   * Zeigt der Kasten oben eine Faktenzeile statt eines Balkens?
   *
   * Dann stehen Jahr, Altersfreigabe und Studio bereits dort, und die
   * Werkangaben weiter unten lassen sie weg.
   */
  const faktenImKasten = antwort?.art === 'film' || antwort?.art === 'disc'

  /** Die vier Werkangaben der Unterzeile — leer heißt: kein Kasten. */
  const unterzeile = !title
    ? []
    : [
        title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
        title.episodes && title.episodes > 1
          ? `${title.episodes} ${t('detail.episodes')}`
          : undefined,
        title.jpYear ? `JP ${title.jpYear}` : undefined,
        title.studios?.[0],
      ].filter(Boolean)

  /*
    **Eine Staffel, die noch nicht läuft, hat keine Handlung — die Reihe schon.**

    aniSearch und AniList führen künftige Staffeln ohne Inhaltsangabe, und das
    ist richtig so: Niemand kann erzählen, was noch nicht gesendet wurde. Auf
    der Seite blieb dafür eine leere Fläche — bei einem Titel, den gerade
    deshalb jemand aufschlägt, weil er ihn noch nicht kennt.

    Also zeigen wir die Handlung des letzten Teils, den es wirklich gibt. Daniel
    am 04.09.2026: „für zukünftige staffeln können wir hinweistext ‚noch nicht
    erschienen, handlung der vorherigen staffel:' … oder ‚der zuletzt
    erschienenen staffel'".

    **Gesucht wird rückwärts, nicht der direkte Vorgänger** — auch das seine
    Beobachtung: „wenn man cour 2 anklickt, wäre letzte ja cour 1 und dort steht
    auch keine handlung". Bei einer Staffel, die in zwei Cours zerfällt, ist der
    Vorgänger genauso leer wie sie selbst. Die Schleife geht deshalb so weit
    zurück, bis ein Teil eine Handlung trägt, und der Hinweis nennt ihn beim
    Namen — sonst liest jemand die Handlung von Staffel 1 und hält sie für die
    von Staffel 3.
  */
  const [ersatz, setErsatz] = useState<{ plot: Synopsis; von: FranchiseMember } | undefined>()
  useEffect(() => {
    let alive = true
    setErsatz(undefined)
    if (synopsis?.de || synopsis?.en) return
    const vorher = reihenTeile
      .filter((m) => m.id !== titleId && (m.jpYear ?? 9999) <= (title?.jpYear ?? 9999))
      .sort((a, b) => (b.jpYear ?? 0) - (a.jpYear ?? 0) || b.id - a.id)
    ;(async () => {
      for (const m of vorher) {
        const s = await loadSynopsis(m.id).catch(() => undefined)
        if (!alive) return
        if (s?.de || s?.en) {
          setErsatz({ plot: s, von: m })
          return
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [titleId, synopsis, reihenTeile, title])

  /** Die AniList-Wertung als Pille — steht neben dem Staffelnamen. */
  const bewertung =
    title?.score !== undefined ? (
      <Tooltip text={t('detail.scoreHint')} seite="oben">
        <span className="inline-flex shrink-0 cursor-help items-baseline gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
          <span className="font-normal text-slate-500 dark:text-slate-400">AniList</span>
          {/* Der Stern macht auf einen Blick klar, dass es eine Wertung ist und
              keine Folgenzahl (Daniel, 15.08.2026). */}
          <span className="text-amber-400" aria-hidden="true">
            ★
          </span>
          <span className="font-semibold tabular-nums">{(title.score / 10).toFixed(1)}</span>
        </span>
      </Tooltip>
    ) : null

  if (!title) {
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
        {/*
          **Nachladen statt aufgeben — die Adresse muss teilbar sein.**

          Der Erstaufruf lädt nur `titles-core.json`: die Titel, auf die ein
          Termin zeigt. Wer die Adresse eines Teils **ohne** Termin öffnet oder
          neu lädt — `#/woche?t=161802`, „Der Traum von Coleus" —, traf damit auf
          „Zu diesem Eintrag liegen keine Metadaten vor" (Daniel, 04.09.2026:
          „die url … ist nicht teilbar. fix das").

          Beim Wechsel **innerhalb** des Panels wurde schon nachgeladen; nur beim
          Einstieg von außen fehlte derselbe Griff. Der Ladehinweis steht so
          lange, bis beide Bestände da sind — danach entscheidet erst, ob es den
          Titel wirklich nicht gibt.
        */}
        <p className="mb-3 text-sm text-slate-500">
          {holt ? t('detail.seasonLoading') : t('detail.noMeta')}
        </p>
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
    if (synopsis?.en) {
      // Die englische Fassung kommt immer von AniList — dort steht auch der Titel.
      return {
        text: synopsis.en,
        fallback: true,
        quelle: { name: 'anilist.co', url: `https://anilist.co/anime/${titleId}` },
      }
    }
    if (!ersatz) return undefined
    // Der Ersatz aus der Reihe — mit Hinweis, von welchem Teil er stammt.
    return {
      text: ersatz.plot.de ?? ersatz.plot.en!,
      fallback: !ersatz.plot.de,
      vonTeil: ersatz.von,
      quelle: ersatz.plot.de
        ? (ersatz.plot.deSource ?? { name: 'anisearch.de', url: 'https://www.anisearch.de/' })
        : { name: 'anilist.co', url: `https://anilist.co/anime/${ersatz.von.id}` },
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
        {/*
          **Der Titel steht über dem Cover, nicht darauf.**

          Bis zum 03.09.2026 abends lag er als halbdeckende Fläche mitten im
          Bild, und das Bild lag zu drei Vierteln unter einem Verlauf. Daniel:
          „titel ganz nach oben schieben, volle breite (100% vom panel), cover
          startet erst danach (wird nicht mehr durch titel verdeckt) … die
          oberen ~60% des covers sollten fast komplett sichtbar sein, da
          befindet sich meistens der fokus des covers."

          Daraus die neue Ordnung, von oben nach unten:

          1. **Titelzeile** — volle Panel-Breite, deckender Panel-Grund, kein
             Bild darunter. Sie braucht keinen Verlauf mehr, um lesbar zu sein.
          2. **Cover** — beginnt erst darunter und bleibt in seinen oberen zwei
             Dritteln unangetastet.
          3. **Unterzeile und Bedienelemente** liegen über dem Bild, jede auf
             ihrer eigenen halbdeckenden Fläche. Die Bedienelemente stehen
             **senkrecht** an der rechten Kante: waagerecht nahmen sie die volle
             Breite des Bildoberteils ein, genau dort, wo der Blick hinfällt.
        */}
        <div className="relative shrink-0" style={{ isolation: 'isolate' }}>
          <h2
            title={reihenName}
            className="line-clamp-2 px-4 pb-2 pt-1 text-lg font-semibold leading-tight text-slate-900 dark:text-white"
          >
            {reihenName}
          </h2>

          {/*
            **410 px, und der Ausschnitt sitzt tief.**

            Daniel am 03.09.2026, in zwei Schritten: erst „cover height: 210 ->
            410px; background-position: 50% 20 -> 90%", nach dem Ansehen dann
            „auf 50% 10% und 400px reduzieren (sind paar negativ aufgefallen mit
            der verschiebung, so ist besser)". Bei 90 % lag der Ausschnitt zu
            tief — manche Cover zeigten dann den Bildrand statt der Figuren.

            Der „Staffel 1"-Block darunter holt einen Teil davon wieder herein
            (sein `-mt-24`): Das Cover bleibt groß, der Weg zum Inhalt kurz.
          */}
          <div className="relative h-[400px]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-cover"
              style={{
                backgroundImage: buehnenBild ? `url(${buehnenBild})` : undefined,
                backgroundPosition: '50% 10%',
                zIndex: -2,
              }}
            />
            {/*
              **Ein Verlauf, der erst in der unteren Hälfte anfängt.**

              Vorher lagen zwei übereinander — einer von oben, einer von links —
              und beide begannen sofort: Das Cover war schon in der ersten Zeile
              zur Hälfte abgedunkelt. Der von links ist ganz entfallen, denn er
              schob den Kontrast vom Titel weg, und der Titel liegt nicht mehr
              hier. Übrig bleibt der von unten, der bei 52 % transparent
              anfängt und in den Panel-Grund ausläuft — damit das Cover ohne
              Kante in die Seite übergeht.

              **Die Farben kommen aus `styles.css` und wechseln mit dem Thema.**
              Bis zum 25.08.2026 standen sie hier fest als `rgba(11,15,22,…)`;
              im hellen Thema lag der dunkle Titel damit auf einem dunklen
              Verlauf (Daniel, mit Bild: „styling kaputt im light mode").
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                zIndex: -1,
                background:
                  'linear-gradient(180deg, transparent 0%, transparent 52%, var(--buehne-mitte) 78%, var(--buehne-unten) 92%, var(--panel-grund) 100%)',
              }}
            />
            {/*
              Senkrecht an der rechten Kante, direkt unter der Titelzeile. Jedes
              Symbol behält seinen dunklen Grund: Auf einem hellen Cover wäre ein
              blankes Symbol sonst genauso unlesbar wie blanker Text.
            */}
            {/*
              In der Ecke, nicht neben ihr: `top-0 right-0`, und gerundet ist nur
              die Kante, die ins Bild zeigt (Daniel, 03.09.2026).
            */}
            <div className="absolute right-0 top-0 z-10 flex flex-col items-center gap-1.5 rounded-bl-lg bg-black/50 px-1.5 py-2 backdrop-blur-[3px]">
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
              Die Unterzeile überlappt das Cover — sie kostet damit keine eigene
              Höhe. In der Ecke wie die Bedienelemente gegenüber, gerundet nur
              zum Bild hin.

              **Die Schreibweisen stehen darin, nicht darunter** (Daniel,
              03.09.2026: „weitere schreibweisen unter subtitle schieben, selber
              container nächste zeile"). Als eigene Zeile im Inhaltsbereich
              kosteten sie 24 px für eine Angabe, die fast niemand aufklappt.
            */}
            {/*
              **Kein Kasten ohne Inhalt.**

              Die Unterzeile setzt sich aus vier Angaben zusammen — Format,
              Folgenzahl, Jahr, Studio. Fehlen alle vier, stand hier trotzdem
              ein grauer Balken über dem Cover: eine leere Fläche, die aussieht
              wie ein Ladefehler (Daniel, 04.09.2026, mit Bild; er konnte den
              Zustand nicht wiederholen, er trat beim Wechsel zwischen Tabs
              auf).

              Die Ursache ist damit nicht gefunden — sie steht als Aufgabe in
              `status.md`. Aber der sichtbare Schaden entsteht erst hier, und er
              gehört unabhängig von seiner Ursache verhindert: Ein Kasten, der
              nichts zu sagen hat, wird nicht gezeichnet.
            */}
            {unterzeile.length > 0 && (
            <div className="absolute left-0 top-0 z-10 max-w-[calc(100%-4rem)] rounded-br-lg bg-[rgba(8,12,18,.74)] px-2.5 py-1 backdrop-blur-[3px]">
            <p className="text-xs text-slate-300">
              {[
                title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
                /*
                  **„1 Folgen" gab es hier zu lesen** — bei „Venus Wars" stand
                  „Film · 1 Folgen · JP 1989" (03.09.2026). Falsch in beidem: Der
                  Plural stimmt nicht, und ein Film hat keine Folgen, sondern ist
                  einer. Bei genau einer Einheit sagt das Format schon alles.
                */
                title.episodes && title.episodes > 1
                  ? `${title.episodes} ${t('detail.episodes')}`
                  : undefined,
                title.jpYear ? `JP ${title.jpYear}` : undefined,
                title.studios?.[0],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <WeitereTitel title={title} />
            </div>
            )}

            {/*
              **Die Altersfreigabe als Marke, gegenüber der Unterzeile.**

              Sie stand bis zum 04.09.2026 in der Faktenzeile des Kastens,
              zwischen zwei Angaben, die den Kopf darüber wiederholten. Als
              deren Dopplung fiel, blieb sie als einzige übrig — und gehört
              damit dorthin, wo die Werkangaben stehen. Daniel: „ab 12 kann als
              label icon oben rechts vom sub-title-div."

              Rechts, weil links der Untertitel steht und die Schließen-Leiste
              erst 3,5 rem tiefer beginnt; die Marke passt in die Lücke
              dazwischen, ohne beide anzufassen.
            */}
            {title.fsk !== undefined && (
              <span className="absolute right-11 top-0 z-10 rounded-b-lg bg-[rgba(8,12,18,.74)] px-2 py-1 text-xs font-semibold tabular-nums text-slate-200 backdrop-blur-[3px]">
                {t('antwort.fskAb', { n: title.fsk })}
              </span>
            )}
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
        {/*
          Die Wertung nennt ihre Quelle — sonst sieht es aus, als wäre es
          unsere. „★ 8.4" ohne Herkunft las sich, als hätten wir diesen Anime
          selbst bewertet (Daniel, 15.08.2026); wir bewerten nichts, die Zahl ist
          der Nutzerdurchschnitt von AniList.

          Der Name steht ausgeschrieben statt als Logo: AniList liefert keine
          Bildmarke zur freien Verwendung, und eine nachgebaute wäre schlechter
          als ein Wort.
        */}
        {/*
          **Der Block rückt sechs Zeilen ins Cover hinein.**

          Daniel am 03.09.2026: „#3-staffel 1 container: margin-top -6em." Das
          Cover ist seit derselben Runde 410 px hoch — ohne diesen Versatz läge
          der erste Inhalt erst darunter, und der Weg zur Antwort wäre länger
          geworden statt kürzer. So bleibt das Bild groß **und** der Kasten im
          Blick; der Verlauf trägt den Text, wo er auf dem Bild steht.
        */}
        <div className="relative -mt-24 flex flex-col gap-3 p-4">
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
            {/*
              **Die Wertung steht vor dem Namen, nicht darunter.**

              Sie war eine eigene Zeile unter dem Staffelnamen — 24 px für eine
              Pille, die neben ihn passt (Daniel, 03.09.2026: „Rating vor
              ,Staffel 1'"). `items-baseline` setzt sie auf die Schriftlinie des
              Namens statt an seine Oberkante.
            */}
            {reihenTeile.length > 1 && teilName !== reihenName && (
              <div className="flex items-baseline gap-2">
                {bewertung}
                <h3 className="min-w-0 flex-1 text-xl font-bold leading-tight text-slate-900 dark:text-white">
                  {teilName}
                </h3>
              </div>
            )}
            {/*
              Die Pillen-Zeile trug nur noch die Wertung — Status und FSK sind
              seit dem 13.08.2026 im Terminblock, wo sie je Release gelten. Eine
              eigene Zeile für eine einzelne Pille ist Platz ohne Auskunft; sie
              steht jetzt neben dem Staffelnamen (siehe `bewertung` oben).
            */}
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
                            /* Seit wann es dort läuft — die Angabe, für die es
                               bis zum 04.09.2026 einen eigenen Abschnitt gab. */
                            (() => {
                              const d = releaseJePlattform.get(s.platform)?.schedule?.firstEpisodeDate
                              return d
                                ? t(d > today ? 'detail.abDatum' : 'detail.seitDatum', {
                                    d: formatDate(d),
                                  })
                                : ''
                            })(),
                          ]
                            .filter(Boolean)
                            .join(' · ') || undefined
                        }
                        /*
                          **Was in der Pille kürzt, steht hier ausgeschrieben.**

                          Die Unterzeile trägt seit dem 03.09.2026 nur noch
                          „✕ DE 2–33" statt „Ohne deutschen Ton: Folge 2–33" — sie
                          wurde sonst ausgepunktet, und eine halbe Auskunft ist
                          schlechter als eine kurze. Der Tooltip nennt beides:
                          was fehlt, und wozu die Adresse sonst noch führt.
                        */
                        titel={
                          [
                            luecken ? t('detail.dubLueckenTitel') : '',
                            grenze
                              ? t(
                                  grenze.schluessel === 'detail.dubUntil'
                                    ? 'detail.dubUntilTitel'
                                    : 'detail.dubFromTitel',
                                  { n: grenze.n },
                                )
                              : '',
                            s.teilBereich
                              ? t('detail.teilBereichTitel', {
                                  von: s.teilBereich.von,
                                  bis: s.teilBereich.bis,
                                })
                              : '',
                            (s.sharedWith ?? 0) > 1
                              ? t('detail.sharedUrlNote', { count: s.sharedWith! })
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ') || undefined
                        }
                        rechts={
                          <>
                            <DubMark dub={s.dub} />
                            <MerkenKnopf
                              release={releaseJePlattform.get(s.platform)}
                              today={today}
                              farbe={PLATFORMS[s.platform].color}
                            />
                          </>
                        }
                      />
                    )
                  }),
                )
                  /*
                    **Ein Abgang ist eine Auskunft, kein Loch — und er gehört zu
                    den anderen Wegen.**

                    Bis zum 01.09.2026 fiel ein Verweis stillschweigend heraus,
                    sobald er ins Leere führte. Daniel damals: „auch bei titeln
                    die aus dem katalog eines anbieters fliegen entsprechend
                    anzeigen … sie sind schließlich nicht mehr klickbar."

                    Er stand danach als eigene Zeile über den Pillen — zwei
                    Zeilen für eine Auskunft, die in eine Pille passt (Daniel,
                    03.09.2026: „nicht mehr abrufbar auf netflix -> umstylen zu
                    grauer netflix-pill und in box schieben"). Das Datum steht
                    jetzt im Tooltip; sichtbar bleibt, was zählt: dieser Weg ist
                    zu.
                  */
                  .concat(
                    (title.entfernteStreams ?? []).map((s) => (
                      <WegPille
                        key={`weg-${s.platform}-${s.url}`}
                        name={PLATFORMS[s.platform]?.name ?? s.platform}
                        farbe={PLATFORMS[s.platform]?.color}
                        hinweis={t('detail.gone', { d: formatDate(s.entferntAm ?? '') })}
                      />
                    )),
                  )
                  /* Ein Abo, das über einen Dritten läuft — „Crunchyroll über
                     Prime Video". Es steht bei den Streams, weil man es ansieht
                     und nicht kauft. */
                  .concat(
                    sortiertNachZugang.flatMap(({ streamWege }) =>
                      streamWege.map((g) => (
                        <Pille
                          key={`sw-${g.shop}-${g.eintraege[0].url}`}
                          name={g.shop}
                          url={g.eintraege[0].url}
                        />
                      )),
                    ),
                  )
                  .concat(
                    streamReleases.map((r) => (
                      <ReleasePille key={r.slug} release={r} titel={anzeigeName(title)} today={today} />
                    )),
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
                  ...discReleases.map((r) => (
                    <ReleasePille key={r.slug} release={r} titel={anzeigeName(title)} today={today} />
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
              {/*
                **Die Reihe schließt direkt an den Kasten an.**

                Zwischen beiden stand eine Überschrift — „64 TEILE IN DIESER
                REIHE" —, die nichts sagte, was die Liste nicht selbst zeigt.
                Daniel am 03.09.2026: „‚x teile in dieser reihe' entfernen und
                reihen bereich direkt an box anknüpfen. die x zahl unten links an
                karussell-box heften. box border geben."

                Die Zahl bleibt — bei drei sichtbaren Einträgen sieht eine Reihe
                mit einundzwanzig Teilen sonst nach dreien aus. Sie steht jetzt
                als Marke an der unteren Kante der Box, wo sie den Platz einer
                Überschrift nicht braucht.

                Der Rahmen macht aus der Liste einen Bereich: Ohne ihn schwamm
                sie zwischen Kasten und Terminen, mit ihm gehört sie sichtbar
                zusammen.
              */}
              <div className="relative -mt-1 rounded-xl border border-slate-200 dark:border-white/10">
              <div className="max-h-[13.5rem] overflow-y-auto p-2">
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
                  /*
                    **Vier Gruppen mit Überschrift, nicht zwei Töpfe.**

                    Bei „One Piece" standen 64 Teile in einer Liste, und der erste
                    sichtbare war eine ONA von 2018 (Daniel, 03.09.2026: „teile in
                    dieser reihe muss sortiert sein. Zuerst Hauptstaffeln
                    aufsteigend, dann Specials, dann movies. Entsprechende
                    Trennstriche müssen sichtbar sein mit entsprechenden Kategorie
                    Labels.").

                    Die Reihenfolge folgt dem, was jemand sucht: erst die
                    Hauptserie, dann das Beiwerk, dann die Filme — und ganz unten,
                    was es noch nicht gibt. Innerhalb jeder Gruppe chronologisch.
                  */
                  /*
                    **Ein Titel ohne Jahr gehört ans Ende, nicht an den Anfang.**

                    `?? 0` machte aus „unbekannt" das Jahr null. Bei „One Piece"
                    standen dadurch drei undatierte Kurzformate vor der Serie von
                    1999, und sie selbst hieß in der Liste „Staffel 4" (Daniel,
                    03.09.2026, mit Bild).
                  */
                  const nachJahr = (a: FranchiseMember, b: FranchiseMember) =>
                    (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id

                  /*
                    **Was eine Hauptstaffel ist, entscheidet die Reihe selbst.**

                    `istStaffel` zählt ONA mit, und das ist richtig: Viele neue
                    Serien laufen als ONA („Beastars"). Für die **Zählung** einer
                    Reihe ist es falsch, sobald sie daneben Kurzformate führt —
                    „One Piece: Annecy Festival" und „Koisuru One Piece" sind keine
                    Staffeln, sie haben nur dasselbe Format.

                    Also: Gibt es in der Reihe echte Fernsehstaffeln, zählen nur
                    die. Gibt es keine, zählen die ONAs — dann sind sie die Serie.

                    **Kurzformate zählen nie mit.** „Chopper's" ist ein TV_SHORT und
                    stand damit unter „Hauptserie" (Daniel, 03.09.2026:
                    „choppers gehört nicht zur hauptserie"). Eine Sendung von fünf
                    Minuten ist Beiwerk, auch wenn sie im Fernsehen läuft.
                  */
                  const hatTv = reihenTeile.some((m) => m.format === 'TV')
                  const istHauptstaffel = (m: FranchiseMember) =>
                    hatTv ? m.format === 'TV' : istStaffel(m.format)
                  const da = reihenTeile.filter((m) => !kuenftig(m))
                  const gruppen: { titel: string; teile: FranchiseMember[]; offen: boolean }[] = [
                    {
                      titel: t('detail.gruppeStaffeln'),
                      teile: da.filter(istHauptstaffel).sort(nachJahr),
                      offen: false,
                    },
                    {
                      titel: t('detail.gruppeSpecials'),
                      teile: da
                        .filter((m) => !istHauptstaffel(m) && m.format !== 'MOVIE')
                        .sort(nachJahr),
                      offen: false,
                    },
                    {
                      titel: t('detail.gruppeFilme'),
                      teile: da.filter((m) => m.format === 'MOVIE').sort(nachJahr),
                      offen: false,
                    },
                    {
                      titel: t('detail.reiheKuenftig'),
                      teile: reihenTeile.filter(kuenftig).sort(nachRang),
                      offen: true,
                    },
                  ].filter((g) => g.teile.length > 0)

                  /*
                    **Die Staffeln werden gezählt, damit die erste „Staffel 1"
                    heißt.** Sie trägt im Datensatz meist den bloßen Reihennamen;
                    nach dem Abzug unten bliebe nichts übrig, und im Panel stand
                    dann derselbe Text wie in der Überschrift darüber (Daniel:
                    „1. eintrag dort müsste staffel 1 heißen").
                  */
                  /*
                    **„Staffel 1" nur, wo es eine Staffel 2 gibt.**

                    One Piece ist bei AniList **ein** Eintrag mit über tausend
                    Folgen — die Arcs sind keine eigenen Werke. In der Liste stand
                    trotzdem „Staffel 1", und daneben nichts weiter (Daniel,
                    03.09.2026: „wenn one piece alles meint, dann sollte nicht
                    staffel 1 stehen, sondern einfach ,One Piece'").

                    Gezählt wird deshalb nur, wo die Nummer etwas unterscheidet:
                    wenn **mindestens zwei** Hauptstaffeln keinen eigenen Namen
                    tragen. Hat ein Teil einen — „Log: Fish-Man Island Saga" —,
                    steht der da, und eine Nummer bräuchte er nicht.
                  */
                  const hauptstaffeln = reihenTeile.filter(istHauptstaffel).slice().sort(nachJahr)
                  const ohneEigenenNamen = hauptstaffeln.filter((m) => {
                    const voll = eindeutschenStaffel(m.name)
                    return !voll.toLowerCase().startsWith(reihenName.toLowerCase())
                      ? false
                      : voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim() === ''
                  })
                  const staffelNr = new Map<number, number>()
                  if (ohneEigenenNamen.length > 1) {
                    hauptstaffeln.forEach((m, i) => staffelNr.set(m.id, i + 1))
                  }

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
                      {gruppen.map((g, i) => (
                        <Fragment key={g.titel}>
                          {/*
                            Die Überschrift der ersten Gruppe steht ohne Linie
                            darüber — dort trennt sie nichts, sie benennt nur.
                          */}
                          <div
                            className={[
                              'flex items-center gap-2',
                              i === 0 ? 'mb-0.5' : 'my-1.5',
                            ].join(' ')}
                          >
                            {i > 0 && <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />}
                            <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {g.titel}
                            </span>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                          </div>
                          {g.teile.map((m) => zeile(m, g.offen))}
                        </Fragment>
                      ))}
                    </div>
                  )
                })()}
              </div>
              {/*
                **Die Marke steht unter einer eigenen Linie, nicht im Bild.**

                Erst hing sie im Scrollbereich und der letzte Eintrag lag halb in
                ihrem Text; ein Verlauf half nur halb. Daniel: „border bottom
                zwischen scrollbereich und ,x teile...' hinzufügen. und x teile
                gleicher abstand zur border und border darunter … hab einfach
                line-height:1 gemacht auf den text, dann hat abstand zu den 2
                bordern gepasst."

                `leading-none` nimmt der Zeile ihre eigene Höhe — dann sind die
                4 px Polster oben und unten wirklich gleich, statt durch die
                Zeilenhöhe verschoben.
              */}
              <div className="border-t border-slate-200 px-3 py-1 text-[10px] uppercase leading-none tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500">
                {t('detail.seriesPartsCount', { count: reihenTeile.length })}
              </div>
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
          {releases.length > 0 ? (
            /*
              **Die Termine stehen in den Pillen — hier steht nichts mehr.**

              Bis zum 04.09.2026 folgte an dieser Stelle ein Abschnitt je
              Release: Start, Folgenzahl, letzte Folge, Herkunftskasten, Quelle
              und zwei Kalender-Knöpfe. Bei „Apothekerin" Staffel 1 waren das
              zwei solche Blöcke für eine Serie, die seit April 2024 durch ist
              — und der Kasten oben sagte dasselbe in einer Zeile.

              Daniel am 04.09.2026, in drei Schritten: erst „der bereich gehört
              weg, aber der link zum disc gehört in disc bereich", dann „eig
              gehört der bereich immer weg, unabhängig ob in zukunft oder nicht.
              die titel gehören mit releasedate info in disc/stream bereich",
              schließlich „in die pill muss auch der calendar icon + eintrag".

              **Was bleibt, sind die Meldungen** — Zusatzangaben, die zu keinem
              einzelnen Termin gehören und in keine Pille passen.
            */
            <Meldungen titleId={title.id} />
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
                **Der Hinweis steht über dem Text, nicht darunter.**

                Er ändert, wie der Absatz zu lesen ist — wer ihn erst am Ende
                findet, hat die Handlung schon dem falschen Titel zugeschrieben.
              */}
              {plot.vonTeil && (
                <p className="mb-1 text-[11px] text-amber-600 dark:text-amber-400/90">
                  {t('detail.plotVonTeil', { teil: plot.vonTeil.name })}
                </p>
              )}
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
                **Die Quelle steht unten, gesammelt — nicht unter jedem Absatz.**

                Hier stand „Quelle: anisearch.de", und dieselbe Zeile stand
                unter jedem Terminblock. Seit die Termine in den Pillen sind,
                blieb sie hier als einzige übrig — eine Fußnote unter einem
                Absatz, während zwei Handbreit tiefer der Bereich „Woher diese
                Angaben stammen" alle Quellen zusammen führt, aniSearch
                eingeschlossen (Daniel, 04.09.2026: „alle stellen wo quelle
                steht entfernen, sie sind nur noch im quellen bereich zu finden,
                gebündelt").

                Nichts geht verloren: Die Quellenübersicht führt aniSearch mit
                „Titel und Beschreibung, wo vorhanden auf Deutsch" — samt Link
                auf die Werkseite.
              */}
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
                {/*
                  **Die Bewertung steht oben, nicht hier.**

                  Beide Stellen zeigten „★ 8.8 AniList" — einmal als Pille neben
                  dem Staffelnamen, einmal als Zeile hier. Gemessen am
                  03.09.2026: dieselbe Zahl zweimal auf einem Bildschirm, und
                  oben ist sie sichtbarer und trägt ihren Tooltip mit der
                  Herkunft. Die Zeile hier war die Wiederholung.
                */}
                {!faktenImKasten && title.studios?.[0] && (
                  <>
                    <dt className="text-slate-400 dark:text-slate-500">{t('detail.studio')}</dt>
                    <dd className="text-slate-600 dark:text-slate-300">{title.studios.join(', ')}</dd>
                  </>
                )}
                {/* Die Altersfreigabe stand hier bis zum 04.09.2026 ein zweites
                    Mal — sie ist jetzt ausschließlich eine Marke am Cover. */}
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
