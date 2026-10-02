import { MitFachwoertern } from '../fachwort.tsx'
import { type ReleaseEvent, type Title, type Release, PLATFORMS } from '@shared/types.ts'
import { formatDate, weekdayName } from '@shared/time.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { type ReactNode, useState, type ReactElement } from 'react'
import { kostenloseFolgen, kostenlosEtikett } from '@shared/kostenlos.ts'
import { Countdown, sendetageText } from './hilfen.tsx'
import { KINO_LAND, kinoDatum } from './kino.tsx'
import { ankuendigungZeile } from '@shared/ankuendigung.ts'
import { VermerkAuskunft } from './vermerk.tsx'
import { Umschalter } from './umschalter.tsx'
import { terminSatz, ungefaehr } from './antwort-regeln.ts'
import { type Antwort } from './antwort-typ.ts'

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
   * einander widersprechen, statt zweier Auskünfte mit verschiedenen Absendern.
   */
  fremd = false,
): string {
  const e = title.deErstausgabe
  if (!e) return ''
  /*
    Liegt das Angebot eines Anbieters mit deutscher Tonspur **vor** diesem Datum, ist es nicht
    das früheste — „Auf Deutsch seit 28.04.2025" neben „Bei Netflix im Angebot seit 06.03.2024"
    (Hero Mask, Stichprobe 16.09.2026). Dann steht nur das Angebot da.
  */
  const angebot = title.angebotSeit
  if (
    !fremd && e.von && angebot?.date && angebot.date < e.von &&
    (title.streams ?? []).some((s) => s.platform === angebot.platform && s.dub === true)
  )
    return ''
  /* Ein offenes Ende („1996 - ?") steht bei aniSearch für „unbekannt" — gezeigt wird nur der Anfang, in jedem Zweig (Superbuch, Stichprobe 17.09.2026). */
  const zeitraumOffen = e.zeitraum?.replace(/\s*-\s*\?\s*$/, '')
  const wann = e.von ? formatDate(e.von) : (zeitraumOffen ?? '')
  /*
    **Ohne Datum bleibt der Verlag — er ist die ganze Spur, die es gibt.**

    aniSearch schreibt bei alten Titeln `released: "?"` und nennt trotzdem den
    Verlag. Für einen Titel, zu dem keine Quelle einen Bezugsweg kennt, stand
    hier bis zum 12.09.2026 gar nichts; jetzt steht wenigstens, bei wem die
    deutsche Fassung erschienen ist — wonach jemand suchen kann.
  */
  /* Unter „Noch keine deutsche Fassung" nennt die Zeile ihren Absender (Bakuman 3, Stichprobe 16.09.2026). */
  if (!wann) return e.publisher ? T(fremd ? 'antwort.deVerlagFremd' : 'antwort.deVerlag', { publisher: e.publisher }) : ''
  if (fremd) {
    return e.publisher
      ? T('antwort.deSeitFremdPublisher', { datum: wann, publisher: e.publisher })
      : T('antwort.deSeitFremd', { datum: wann })
  }
  /* Ein Zeitraum („10.1990 - 03.1991") bekommt kein „seit" (Stichprobe 16.09.2026). */
  if (!e.von && zeitraumOffen?.includes('-')) {
    const zeitraum = zeitraumOffen
    return e.publisher
      ? T('antwort.deZeitraumPublisher', { zeitraum, publisher: e.publisher })
      : T('antwort.deZeitraum', { zeitraum })
  }
  return e.publisher
    ? T('antwort.deSeitPublisher', { datum: wann, publisher: e.publisher })
    : T('antwort.deSeit', { datum: wann })
}

/**
 * Die Nummer der letzten ausgebliebenen Folge in einer ununterbrochenen Reihe ab `erste`.
 *
 * Fällt eine Woche aus und die nächste auch, stünde sonst „Folge 8 ist nicht
 * erschienen" über einem Kasten, in dem auch Folge 9 fehlt.
 */
export function ausgebliebenBis(erste: ReleaseEvent, kuenftig: ReleaseEvent[]): number | undefined {
  let bis = erste.episode
  if (bis == null) return undefined
  for (const e of kuenftig) {
    if (e === erste || e.episode == null || e.episode <= bis) continue
    if (e.episode !== bis + 1 || !istAusgeblieben(e)) break
    bis = e.episode
  }
  return bis > erste.episode! ? bis : undefined
}

export function AntwortKasten({
  antwort,
  title,
  t,
  today,
  stream = [],
  disc = [],
  wegeHinweis,
  notiz,
  schnitt,
  angebotSeit,
  kaufausgabe,
  hinweis,
  pillenGruppen = new Map(),
  discZuerst = false,
}: {
  /** Bereich je Pillen-Schlüssel (`key`) — nur gebraucht, wenn es einen kostenlosen Weg gibt. */
  pillenGruppen?: Map<string, 'frei' | 'abo' | 'kauf' | 'tv' | 'unbekannt'>
  /** Über einen Disc-Termin geöffnet — dann steht der Umschalter auf „Disc". */
  discZuerst?: boolean
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
  /**
   * **Was dasteht, wenn es keinen Weg gibt.**
   *
   * „WO LÄUFT ES — Kein Anbieter bekannt" war bis zum 04.09.2026 ein eigener
   * Abschnitt unter dem Kasten. Seit die Pillen im Kasten stehen, ist er die
   * letzte Hälfte eines Bereichs, den es nicht mehr gibt.
   *
   * Der Satz selbst bleibt, und zwar an der Stelle der Pillen: Er unterscheidet
   * „läuft nirgends" von „wissen wir nicht" — bei 665 von 2.760 Titeln die
   * einzige Auskunft, die das Suchen auf dieser Seite beendet.
   */
  wegeHinweis?: string
  /**
   * **Was den Termin erklärt, steht beim Termin.**
   *
   * `Release.note` trägt das, was aus keiner Zahl hervorgeht — „der Tag steht
   * noch nicht fest", „Netflix nennt den Termin auf der Titelseite; das Jahr
   * ist abgeleitet". Was nur unsere Zuordnung erklärt („Zum Start standen die
   * Folgen 1 bis 3 bereit", „Automatisch übernommen aus …"), steht seit dem
   * 13.09.2026 in `Release.herkunft` und nicht hier.
   * **271 Releases haben eine**, und sie standen bis zum 04.09.2026 als
   * orangefarbener Kasten im Terminbereich.
   *
   * Mit dem Bereich sind sie verschwunden — unbeabsichtigt, denn die Pille
   * nahm nur Name und Datum mit. Daniel hat es an der falschen Beschreibung im
   * Footer gemerkt: „was für 24 folgen mit belegtem termin? das ist staffel 3,
   * das erscheint erst ab 01.10.2026". Bei „Apothekerin" Staffel 3 stand dort
   * in Wahrheit: „Deutsche Fassung laut aniSearch für Oktober 2026
   * angekündigt — der Tag steht noch nicht fest."
   */
  notiz?: string
  schnitt?: Release['schnitt']
  /**
   * **„Im Angebot seit" — die einzige Angabe, die der frühere Terminblock allein trug.**
   *
   * 267 Titel haben sie (Streaming Availability API: seit wann ein Anbieter den
   * Titel führt). Sie ist **nicht** das Erscheinungsdatum der deutschen Fassung;
   * der Tooltip am Datum sagt das. Sie steht seit dem 16.09.2026 hier, weil der
   * Block darunter ersatzlos entfallen ist.
   */
  angebotSeit?: string
  /**
   * **Die Kaufausgabe, wenn sie nicht die Hauptauskunft ist.**
   *
   * Steht ein Titel längst auf Deutsch zum Streamen und kommt nur noch eine
   * Blu-ray, ist ihr Termin eine Nebensache — vorher war er die Überschrift
   * („In 2 Tagen, 18.09.2026" über „Code Geass", das seit 2023 bei Crunchyroll
   * liegt). Hier steht er als das, was er ist, mit Datum und Label.
   */
  kaufausgabe?: string
  /**
   * Der Merken-Hinweis für Titel ohne belegte Synchro — was der Stern bewirkt.
   *
   * Stand bis zum 16.09.2026 im Block darunter, zusammen mit einem zweiten
   * „Keine deutsche Synchro bekannt" neben dem, das der Kasten schon sagt.
   * Geblieben ist der Teil, der etwas Neues sagt.
   */
  hinweis?: React.ReactNode
}) {
  /*
    **Der Umschalter sitzt oben rechts — nicht über den Pillen.**

    Über ihnen kostete er eine Zeile, und die gab es nur bei Titeln mit beidem:
    Staffel 1 war dadurch höher als Staffel 2 (Daniel, 03.09.2026, mit zwei
    Bildern: „toggle oben rechts in box packen, sodass keine height änderung
    passiert"). Oben rechts liegt er in einer Zeile, die ohnehin da ist — und
    kostet keine Höhe mehr.
  */
  const [zeigeDisc, setZeigeDisc] = useState(discZuerst)
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
  const nochNichts = (antwort.art === 'laeuft' && antwort.raus === 0) || antwort.art === 'widerlegt'
  const streamPillen = nochNichts ? [] : stream
  const beides = streamPillen.length > 0 && disc.length > 0
  /*
    **Der Umschalter steht immer da, sobald es Pillen gibt** (`Umschalter`); die leere Seite ist
    gesperrt. Stand er nur bei beidem, war eine einzelne Kaufpille nicht als Disc zu erkennen.
  */
  const aktivDisc = beides ? zeigeDisc : streamPillen.length === 0
  const pillen = aktivDisc ? disc : streamPillen
  const T = t as unknown as (k: string, v?: Record<string, string | number>) => string
  /*
    **Kostenlos ist ein eigener Bereich** (Daniel, 19.09.2026: „trenn die bereiche, sodass es
    besser visuell sichtbar ist"; aus drei Entwürfen in drei Szenarien gewählt: der grüne
    Block). Das kehrt die Entscheidung vom 03.09.2026 um, die Zugangsart nur an der Pille zu
    nennen — ausdrücklich gewünscht. Gegliedert wird nur, wenn es einen kostenlosen Weg gibt;
    sonst bleibt die Reihe wie sie war. Ob „kostenlos" oder „teilweise kostenlos":
    `shared/kostenlos.ts`, verglichen mit den deutschen Folgen (laufend: den erschienenen; ohne
    Gesamtzahl: den meisten belegten eines Anbieters — Beyblade X: Disney+ 100, TOGGO 117).
  */
  const gruppeVon = (p: ReactNode) => pillenGruppen.get(String((p as ReactElement)?.key ?? '')) ?? 'sonst'
  /*
    **Die Bereiche stehen immer**. Bis dahin gliederte
    das Panel nur, wenn es einen kostenlosen Weg gab — bei Gachiakuta stand „Kostenlos / Abo / TV",
    bei One Piece lagen Netflix, ADN und die TV-Pille ohne Überschrift beieinander. Zwei Panels,
    zwei Ordnungen, und beim zweiten sah es nach Fehler aus.
  */
  const mitBereichen = !aktivDisc && pillen.length > 0
  const kostenlosKopf = (() => {
    if (!mitBereichen || !pillen.some((p) => gruppeVon(p) === 'frei')) return undefined
    const k = kostenloseFolgen(title)
    const deutsch =
      title.format === 'MOVIE' || title.episodes === 1
        ? 1
        : antwort.art === 'fertig'
          ? antwort.gesamt
          : antwort.art === 'teilweise' || antwort.art === 'laeuft'
            ? antwort.raus
            : undefined
    const belegtMax = Math.max(
      0,
      ...(title.streams ?? []).map((s) =>
        (s.dubRanges ?? []).filter((r) => r.dub).reduce((n, r) => n + r.to - r.from + 1, 0),
      ),
    )
    const von = deutsch || belegtMax || undefined
    return kostenlosEtikett(k, von) === 'teil'
      ? `${T('kostenlos.teil')} · ${T('kostenlos.zahl', { frei: k!.frei!, von: von! })}`
      : T('kostenlos.ganz')
  })()

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
  /*
    Dieselbe Angabe, aber kleingeschrieben: Sie steht jetzt mitten im Satz
    („erscheint in 2 Tagen, am …") statt am Satzanfang. Ein großes „Heute"
    dort liest sich wie ein Fehler.
  */
  const relativImSatz = (datum: string): string => {
    const tage = Math.round(
      (new Date(`${datum}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000,
    )
    if (tage <= 0) return T('antwort.relHeute')
    if (tage === 1) return T('antwort.relMorgen')
    if (tage <= 6) return T('antwort.relInTagen', { count: tage })
    return ''
  }
  /** Was hervorgehoben wird, trägt die Akzentfarbe des Kastens. */
  const betont = (text: string): ReactNode => (
    <span className="text-sky-700 dark:text-sky-300">{text}</span>
  )

  /*
    **Überschrift und Zählzeile sind Knoten, keine Zeichenketten.**

    Daniel am 10.09.2026: „use coloring". Was hervorgehoben werden soll — die
    Folgennummer, die Zahl der erschienenen Folgen —, steht mitten im Satz;
    ohne Auszeichnung im Text ist das nicht zu machen. Alle übrigen Zustände
    setzen weiterhin schlichte Zeichenketten, die als Knoten durchgehen.
  */
  let haupt: ReactNode
  let neben: string
  let anteil: number | undefined
  let zaehl: ReactNode
  let fakten: { wert: string; was: string }[] | undefined
  let gedaempft = false
  /** Woher die Nebenzeile stammt — nur gesetzt, wo sie eine Fremdangabe ist. */
  let nebenTitel: string | undefined

  if (antwort.art === 'laeuft') {
    const e = antwort.haupt
    /*
      **Zuerst die Sache, dann der Termin**. Vorher stand dort
      „In 2 Tagen, 12.09.2026 — Folge 2" — drei Angaben, aneinandergereiht, und
      die wichtigste hinten.

      Der Wochentag steht ausgeschrieben im Satz, weil er die Frage „wann
      ungefähr" schneller beantwortet als ein Datum. Er verschwindet dafür aus
      der Rhythmuszeile darunter: zweimal „Samstag" auf einem Bildschirm wäre
      dieselbe Auskunft doppelt.
    */
    const rel = relativImSatz(e.date)
    /*
      **Die letzte Folge heißt so, wie sie ist**. `rest` zählt die
      kommende Folge mit; steht nur sie noch aus, ist sie das Finale.
    */
    /*
      Eine TV-Sichtung kennt weder das Ende noch die echte Folgennummer — die Zahl der
      gesehenen Folgen ist kein Finale (Pokémon Horizonte bei TOGGO plus, Stichprobe
      17.09.2026: „Finale Folge (Folge 2)" und „Wöchentlich" bei täglicher Sendung).
    */
    /*
      Und „Erste Folge" nur, wenn es Folge 1 ist: Beyblade X setzte am 19.09.2026 bei TOGGO plus
      mit Folge 115 ein, und der Kasten sagte „Erste Folge heute" (Daniel).
    */
    const wasKommt = antwort.offenesEnde
      ? !antwort.sichtung && e.episode === 1
        ? 'erste'
        : 'naechste'
      : antwort.raus === 0
        ? 'erste'
        : antwort.rest === 1
          ? 'finale'
          : 'naechste'
    const kopf = antwort.komplett
      ? T('antwort.alleFolgen', { count: antwort.gesamt ?? e.episodeCount ?? 0 })
      : e.episode && !antwort.sichtung
        ? T(`antwort.${wasKommt}FolgeNr`, { n: e.episode })
        : T(`antwort.${wasKommt}Folge`)
    /*
      **Die Uhrzeit gehört dazu, wo wir eine führen** (Daniel, 12.09.2026:
      „heute ist der 12.09. es ist noch nicht erschienen, und wir führen die
      voraussichtliche Uhrzeit, also sollten wir die Uhrzeit hier in der blauen
      Box auch anzeigen").

      An einem Tag, an dem die Folge noch kommt, ist „erscheint heute" die
      halbe Auskunft — die andere Hälfte ist, ob man in zwei Minuten oder in
      sechs Stunden nachsehen soll. Sie steht im Datensatz (`schedule.time`,
      aus Crunchyrolls Kalender gemessen), und der Kasten hat sie bisher
      weggelassen.

      **„Voraussichtlich", weil es eine Fortschreibung ist.** Der Rhythmus ist
      gemessen, dieser einzelne Termin ist daraus gerechnet — ein Anbieter kann
      ihn verschieben, und genau das kommt vor (`schedule.verpasst`). Fehlt die
      Uhrzeit, steht dort nichts: eine erfundene wäre schlimmer als keine
      (CLAUDE.md, „Keine erfundenen Uhrzeiten").
    */
    const termin = terminSatz(antwort.komplett, rel, e.date, T)
    const mitZeit = e.time
      ? T('antwort.erscheintUmZeit', { termin: termin.replace(/\.$/, ''), zeit: e.timeEstimated ? `≈ ${e.time}` : e.time })
      : termin
    /*
      **Ist die nächste Folge ausgeblieben, sagt der Kasten das zuerst** (Daniel,
      13.09.2026: „die info, das ein titel nicht zur versprochenen uhrzeit
      erschienen ist muss auch im detail panel stehen"). Die Kachel im Kalender
      trug es längst; hier stand „Nächste Folge (Folge 9)", als wäre Folge 8 da.
    */
    const ausgeblieben = istAusgeblieben(e)
    haupt = ausgeblieben ? (
      <>
        <span className="text-rose-600 dark:text-rose-400">
          ⚠{' '}
          {antwort.ausgebliebenBis
            ? T('antwort.ausgebliebenMehrere', { von: e.episode ?? '', bis: antwort.ausgebliebenBis })
            : T('antwort.ausgeblieben', { n: e.episode ?? '' })}
        </span>
        <span className="font-normal text-slate-700 dark:text-slate-300">
          {', '}
          {e.time
            ? T('antwort.angekuendigtFuerZeit', {
                tag: weekdayName(e.date),
                datum: formatDate(e.date),
                zeit: e.timeEstimated ? `≈ ${e.time}` : e.time,
              })
            : T('antwort.angekuendigtFuer', { tag: weekdayName(e.date), datum: formatDate(e.date) })}
        </span>
      </>
    ) : (
      <>
        {betont(kopf)}{' '}
        <span className="font-normal text-slate-700 dark:text-slate-300">
          {/* „heute" in eigener Farbe — der Tag entscheidet, ob man jetzt nachsieht. */}
          {rel && rel === T('antwort.relHeute') && mitZeit.includes(rel) ? (
            <>
              {mitZeit.slice(0, mitZeit.indexOf(rel))}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{rel}</span>
              {mitZeit.slice(mitZeit.indexOf(rel) + rel.length)}
            </>
          ) : (
            mitZeit
          )}
        </span>
        {e.time && !e.estimated && !e.timeEstimated && <Countdown date={e.date} time={e.time} />}
      </>
    )
    neben = [
      /*
        **Der Wochentag steht oben im Satz, hier bleibt die Frequenz.**
        Das alte Kürzel („Wöchentlich Frs") war unlesbar; ausgeschrieben
        wiederholte es nur den Wochentag der Überschrift. Was bleibt, ist der
        Takt — wer weiß, dass eine Serie freitags kommt, muss nicht täglich
        nachsehen.
      */
      antwort.sendetage?.length
        ? sendetageText(antwort.sendetage)
        : antwort.offenesEnde || antwort.komplett
          ? null
          : T('antwort.rhythmusWoechentlichKurz'),
      /*
        **„Noch X" heißt: X stehen aus — die nächste eingerechnet.**

        Hier stand `rest - 1`, weil die nächste Folge eine Zeile darüber schon
        mit Datum genannt wird. Gedacht war „und danach kommen noch elf". Gelesen
        wurde es anders, und zwar zu Recht: Bei einer Staffel, von der noch keine
        einzige Folge draußen ist, stand „0 von 12 erschienen" über „noch 11 bis
        zum Finale". Zwölf
        Folgen stehen aus, nicht elf — die nächste ist keine erschienene.
      */
      antwort.letzter && antwort.rest > 1 && !antwort.offenesEnde
        ? /* „noch 2 Folgen …" — Einzahl gibt es hier nicht: bei einer steht „letzte Folge". */
          T('antwort.nochFolgen', { count: ungefaehr(antwort.rest, antwort.gesamtGeschaetzt), datum: ungefaehr(formatDate(antwort.letzter), antwort.gesamtGeschaetzt) })
        : /* Steht „Finale Folge" schon in der Überschrift, wäre „letzte Folge" hier dieselbe Auskunft zweimal. */
          antwort.raus === 0 && !antwort.offenesEnde && !antwort.komplett
          ? T('antwort.letzteFolge')
          : null,
      antwort.verschobenVon && T('antwort.verschobenVon', { datum: formatDate(antwort.verschobenVon) }),
    ]
      .filter(Boolean)
      .join(' · ')
    anteil = antwort.gesamt ? Math.round((antwort.raus / antwort.gesamt) * 100) : undefined
    /*
      **Die erschienenen Folgen sind die zweite betonte Angabe** (Daniel,
      10.09.2026: „emphasize already released episodes and next episodes").
      Hervorgehoben wird die Zahl, nicht der Satz: Wer den Kasten überfliegt,
      soll sehen, wie viel schon da ist.
    */
    zaehl = antwort.gesamt
      ? (
          <>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{antwort.raus}</span>
            {' '}
            {T('antwort.erschienenRest', { gesamt: ungefaehr(antwort.gesamt, antwort.gesamtGeschaetzt) })}
          </>
        )
      : ''
  } else if (antwort.art === 'teilweise') {
    /*
      **Teilweise synchronisiert — die Zahl statt „alle".**

      Der Zustand entsteht, wenn ein Verweis `dub: true` trägt, seine Bereiche
      die Serie aber nicht abdecken. Vorher fiel dieser Fall in „fertig" und
      wurde zu „Alle 12 Folgen auf Deutsch", obwohl vier belegt waren.
    */
    haupt = T('antwort.teilweiseZahl', { raus: antwort.raus, gesamt: antwort.gesamt })
    neben = antwort.restBelegt ? '' : T('antwort.teilweiseNeben')
    anteil = Math.round((antwort.raus / antwort.gesamt) * 100)
    zaehl = ''
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
    /* „Alle 1 Folgen" stand über OVAs mit einer Folge — dort sagt die Überschrift ohne Zahl dasselbe. */
    haupt = antwort.gesamt && antwort.gesamt > 1
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
    nebenTitel = title.deErstausgabe
      ? T(title.deErstausgabe.quelle === 'wikipedia' ? 'antwort.deSeitWikipedia' : 'antwort.deSeitQuelle')
      : undefined
    zaehl = ''
  } else if (antwort.art === 'disc') {
    const rel = relativ(antwort.datum)
    /*
      **Ab zwei Bänden zählt der Stand, nicht der nächste Termin.**

      „in 2 Monaten, 06.11.2026" verschweigt, dass Band 1 seit dem 21.08. im
      Laden liegt — und der Kauf-Weg daneben führt genau dorthin. Die Zeile
      nennt deshalb beide: „Vol. 1 seit 21.08.2026 · Vol. 2 am 06.11.2026".
    */
    haupt =
      antwort.baende
        ?.map((b) =>
          [b.name, T(b.raus ? 'antwort.discSeit' : 'antwort.discAm', { datum: formatDate(b.datum) })]
            .filter(Boolean)
            .join(' '),
        )
        .join(' · ') ?? [rel, formatDate(antwort.datum)].filter(Boolean).join(', ')
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
  } else if (antwort.art === 'kino') {
    const { land, adj } = KINO_LAND[antwort.land]!
    haupt = !antwort.jp
      ? T('antwort.kinoOffen', { land })
      : antwort.jpRaus
        ? T('antwort.kinoSeit', { datum: kinoDatum(antwort.jp), adj })
        : antwort.jp.length === 4
          ? T('antwort.kinoJahr', { land, jahr: antwort.jp })
          : T('antwort.kinoAb', { land, datum: kinoDatum(antwort.jp) })
    /*
      Die Nebenzeile sagt, was zum deutschen Kinostart bekannt ist — Termin oder
      Zeitraum, Verleih, Fassung —, so viel davon eben belegt ist.
    */
    const fassung = antwort.fassung
      ? T(
          antwort.fassung === 'omu'
            ? 'antwort.kinoFassungOmu'
            : antwort.fassung === 'synchro'
              ? 'antwort.kinoFassungSynchro'
              : 'antwort.kinoFassungBeides',
        )
      : undefined
    neben =
      antwort.deTermin || antwort.deZeitraum
        ? [
            antwort.deTermin
              ? T('antwort.kinoDeTermin', { datum: formatDate(antwort.deTermin) })
              : T('antwort.kinoDeZeitraum', { zeitraum: antwort.deZeitraum ?? '' }),
            antwort.verleih,
            fassung,
          ]
            .filter(Boolean)
            .join(' · ')
        : antwort.verleih
          ? T('antwort.kinoDeVerleih', { verleih: antwort.verleih })
          : T('antwort.kinoDeOffen')
    gedaempft = true
    zaehl = ''
    fakten = []
  } else if (antwort.art === 'filmDe') {
    const kinoText = antwort.kino
      ? T(antwort.kino.raus ? 'antwort.filmDeKinoSeit' : 'antwort.filmDeKinoAb', { datum: formatDate(antwort.kino.datum) })
      : undefined
    const streamText = antwort.stream
      ? T(antwort.stream.raus ? 'antwort.filmDeStreamSeit' : 'antwort.filmDeStreamAb', {
          datum: formatDate(antwort.stream.datum),
          anbieter: antwort.stream.anbieter,
        })
      : undefined
    const gleich = antwort.kino && antwort.stream && antwort.kino.datum === antwort.stream.datum
    /* Vorn steht der nächste Termin; liegen beide zurück, der jüngere. */
    const streamZuerst =
      antwort.stream &&
      (!antwort.kino ||
        (antwort.kino.raus && !antwort.stream.raus) ||
        (antwort.kino.raus === antwort.stream.raus &&
          (antwort.kino.raus
            ? antwort.stream.datum > antwort.kino.datum
            : antwort.stream.datum < antwort.kino.datum)))
    const fassung = antwort.fassung
      ? T(
          antwort.fassung === 'omu'
            ? 'antwort.kinoFassungOmu'
            : antwort.fassung === 'synchro'
              ? 'antwort.kinoFassungSynchro'
              : 'antwort.kinoFassungBeides',
        )
      : undefined
    if (gleich) {
      haupt = T(antwort.kino!.raus ? 'antwort.filmDeBeideSeit' : 'antwort.filmDeBeideAb', {
        datum: formatDate(antwort.kino!.datum),
        anbieter: antwort.stream!.anbieter,
      })
      neben = fassung ?? ''
    } else {
      haupt = (streamZuerst ? streamText : kinoText) ?? ''
      /* Der Verleih steht schon in der Kino-Pille darunter; hier steht, was noch fehlt. */
      /*
        „Streamstart noch nicht bekannt" stand über vier Stream-Pillen (Daniel, 17.09.2026,
        Your Name: Prime, YouTube, Rakuten, maxdome). Wo man den Film sehen kann, steht
        darunter — dann fehlt kein Termin, sondern nur ein Datum, das niemand vermisst.
      */
      neben = [streamZuerst ? kinoText : (streamText ?? (antwort.streamWege ? undefined : T('antwort.filmDeStreamOffen'))), fassung]
        .filter(Boolean)
        .join(' · ')
    }
    gedaempft = !antwort.kino?.raus && !antwort.stream?.raus
    zaehl = ''
    fakten = []
  } else if (antwort.art === 'film') {
    haupt = antwort.hatSynchro ? T('antwort.filmTitel') : T('antwort.filmOhneTitel')
    /*
      Unter einem Kino-Banner ohne Stream-Weg fehlt genau eine Angabe, und der Leser
      sucht sie: wann er den Film zu Hause sehen kann (Madoka, 17.09.2026).
    */
    neben = antwort.hatSynchro
      ? T('antwort.filmNeben')
      : antwort.imKino && !(title.streams ?? []).length
        ? T('antwort.filmDeStreamOffen')
        : antwort.ohneWeg
          ? T('antwort.filmOhneNeben')
          : ''
    gedaempft = !antwort.hatSynchro
    zaehl = ''
    /*
      **Hier stand dreimal, was oben schon steht.**

      „2022 erschienen · ab 12 Altersfreigabe · 8-bit Studio" — und in der
      Unterzeile am Cover, drei Zentimeter darüber: „Film · JP 2022 · 8-bit".
      Die Altersfreigabe stand als einzige nur
      hier — sie ist jetzt eine Marke an der Unterzeile, wo die anderen
      Werkangaben ohnehin sitzen.

      Ein Film bekommt damit keine Faktenzeile mehr. Der Kasten beantwortet die
      Frage, ob es ihn auf Deutsch gibt; das Werk beschreibt der Kopf.
    */
    fakten = []
  } else if (antwort.art === 'widerlegt') {
    /* Ein widerlegter Termin sagt nicht „erscheint heute" — er nennt Tag und Grund (02.10.2026). */
    haupt = T('antwort.widerlegtTitel')
    neben = T('antwort.widerlegtNeben', { datum: formatDate(antwort.datum) })
    gedaempft = true
    zaehl = ''
  } else {
    /*
      Dieselbe Dopplung wie oben, nur verneint: „Noch keine deutsche Fassung",
      „Bisher kein deutscher Anbieter", „Keine Folge auf Deutsch" — dreimal
      dasselbe Nein, dazu ein leerer Balken. Es bleibt der Satz, der die Frage
      beantwortet.
    */
    /*
      **Bei Cartoons ist „noch keine deutsche Fassung" eine Behauptung, die niemand
      geprüft hat** — TMDB nennt Anbieter, keine Tonspuren, und eine deutsche Fassung
      ist dort der Normalfall (Daniel an The Mighty Nein, 16.09.2026).
    */
    /*
      **Ein angekündigter Simulcast gehört in die Antwort** (Daniel an Magic Knight Rayearth 2026,
      25.09.2026: „dann sollte im detail panel stehen, für wann genau das angekündigt ist … wichtigste
      infos auf einen blick"). Ist eine Synchro angekündigt, ist das die Antwort auf die Frage des
      Kastens; der OmU-Start und der offene Termin stehen darunter.
    */
    const ankuendigung = title.westlich ? undefined : title.ankuendigung
    haupt = title.westlich
      ? T(title.streams.length ? 'antwort.westlichVerfuegbar' : 'antwort.westlichUngeprueft')
      : ankuendigung?.synchro === 'angekuendigt'
        ? T('antwort.synchroAngekuendigt')
        : T('antwort.ohneTitel')
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
    neben = ankuendigung ? ankuendigungZeile(ankuendigung, T) : deSeitZeile(title, T, true)
    nebenTitel = ankuendigung
      ? T('antwort.ankuendigungQuelle', { anbieter: PLATFORMS[ankuendigung.platform]?.name ?? ankuendigung.platform, datum: formatDate(ankuendigung.stand) })
      : title.deErstausgabe
        ? T(title.deErstausgabe.quelle === 'wikipedia' ? 'antwort.deSeitWikipedia' : 'antwort.deSeitQuelle')
        : undefined
    /* Eine angekündigte Synchro ist eine Nachricht, kein Nein — der Kasten steht dann nicht gedämpft. */
    gedaempft = ankuendigung?.synchro !== 'angekuendigt'
    zaehl = ''
  }

  return (
    /*
      **Eine Höhe für alle Zustände.**

      Der Kasten trug bisher `min-h` und wuchs mit dem, was drinstand: ein Titel
      mit zwei Anbietern war höher als einer ohne, und beim Wechsel zwischen zwei
      Teilen derselben Reihe sprang alles darunter (Daniel, 03.09.2026, mit drei
      Bildern: „height Änderung der Box durch feste Höhe verhindern").

      Die Höhe ist gerechnet, nicht geraten: Kopfbereich (Überschrift,
      Nebenzeile, Balken oder Faktenzeile, Zählzeile) plus Trennlinie plus zwei
      reservierte Pillenreihen. Was nicht hineinpasst, läuft in den Pillen nach
      unten weg — der Kasten selbst bleibt, wie er ist.

      **Von 9,75 auf 11 rem am 07.09.2026.** Der neue Zustand „teilweise"
      („8 von 12 Folgen auf Deutsch") bringt einen Fortschrittsbalken mit, den
      „fertig" nicht hat. Zusammen mit einer zweiten Pillenreihe — bei „Kill
      Blue" sind es fünf Anbieter — stand die untere Reihe über den Rand hinaus.
      Gemessen an genau diesem Titel; `npm run check:panel` hält fest, dass alle
      Titel weiter gleich hoch bleiben.
    */
    <section
      className={[
        /*
          **Mindesthöhe statt fester Höhe — seit dem 12.09.2026.**

          Bei „Steel Ball Run" stand die Netflix-Pille halb unter der
          Reihenliste.
          Dieser Titel bringt alles auf einmal mit: zweizeilige Überschrift,
          Rhythmuszeile, Balken, Zählzeile **und** eine zweizeilige Notiz. Das
          ist höher als 11rem, und was übersteht, schob die Pillenreihe aus dem
          Kasten heraus.

          Die feste Höhe war Daniels Vorgabe vom 03.09.2026 („height Änderung
          der Box durch feste Höhe verhindern"), und ihr Zweck bleibt gewahrt:
          Der Kasten ist für den **Regelfall** gerechnet und springt zwischen
          zwei Teilen derselben Reihe nicht. Wo der Inhalt wirklich mehr
          braucht, wächst er jetzt, statt ihn hinauszudrücken — ein Kasten, der
          seine Notiz verschluckt oder eine Pille unter die Liste schiebt,
          beantwortet die Frage schlechter als einer, der zwanzig Pixel höher
          ist.

          Am 07.09.2026 war die Antwort auf denselben Fehler, die feste Höhe von
          9,75 auf 11rem zu erhöhen. Das trägt genau bis zum nächsten Zustand,
          den niemand vorhergesehen hat — und davon gab es seitdem zwei.
        */
        'relative flex min-h-[11rem] flex-col rounded-xl border px-3 pb-3 pt-2',
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
        **Kein `flex-1` mehr am Kopfteil**. Es zog den Kopf in die Mitte des
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
        **Überschrift und Umschalter teilen sich eine Zeile**: „headline auf
        selbe zeile wie den toggle, trennstrich genau darunter, dann die pills. box müsste also um
        ~2 zeilen kleiner werden." Der Umschalter selbst steht in `Umschalter`.
      */}
      <Umschalter
        aktivDisc={aktivDisc}
        streamLeer={streamPillen.length === 0}
        discLeer={disc.length === 0}
        onWahl={setZeigeDisc}
        T={T}
      />
      </div>
      {neben && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" title={nebenTitel}>
          <MitFachwoertern text={neben} />
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
      {angebotSeit && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{angebotSeit}</p>}
      {kaufausgabe && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kaufausgabe}</p>}
      {hinweis}
      {antwort.art === 'laeuft' && antwort.vermerk && (
        <VermerkAuskunft
          vermerk={antwort.vermerk}
          ausgeblieben={istAusgeblieben(antwort.haupt)}
          episode={antwort.haupt.episode}
          anbieter={PLATFORMS[antwort.haupt.platform]?.name ?? antwort.haupt.platform}
          anbieterUrl={(title.streams ?? []).find((s) => s.platform === antwort.haupt.platform)?.url}
          today={today}
          T={T}
        />
      )}
      {/* Die Erklärung zum Termin, in Warnfarbe: Sie schränkt ihn ein. */}
      {notiz && (
        <p className="mt-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400/90">
          <MitFachwoertern text={notiz} />
        </p>
      )}
      {schnitt && (
        <details className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300/90">
          <summary className="cursor-pointer select-none font-medium hover:underline">Was geschnitten ist</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {schnitt.was.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Quellen:{' '}
            {schnitt.quellen.map((q, i) => (
              <span key={q}>
                {i > 0 && ' · '}
                <a href={q} target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-700 dark:hover:text-sky-300">
                  {new URL(q).hostname.replace(/^www\./, '')}
                </a>
              </span>
            ))}
          </p>
        </details>
      )}
      </div>
      {pillen.length === 0 && wegeHinweis && (
        <div className="mt-auto shrink-0 border-t border-slate-200/70 pt-2.5 dark:border-white/10">
          {/* Beim Kinofilm ist der Satz ein Favoriten-Hinweis und trägt deren Gelb. */}
          <p
            className={[
              'flex min-h-[2.1rem] items-center text-xs',
              antwort.art === 'kino'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-500 dark:text-slate-400',
            ].join(' ')}
          >
            {wegeHinweis}
          </p>
        </div>
      )}
      {pillen.length > 0 && (
        <div className="mt-auto shrink-0 border-t border-slate-200/70 pt-2.5 dark:border-white/10">
          {/*
            **Umbrechen statt scrollen — der Platz ist ohnehin reserviert.**

            Die Geschichte dieser Zeile in drei Schritten:

            1. Bis zum 03.09.2026 waren zwei Reihen fest reserviert, und
               `grid-flow-col` füllte erst die Spalte: Zwei Pillen standen
               untereinander, obwohl nebeneinander Platz für vier war. Daniels
               Urteil: „zu viel platz verschwendung."
            2. Danach **eine** Reihe mit `overflow-x-auto`. Das löste die
               Verschwendung und schuf die Gegenrichtung: Der Kasten ist für
               zwei Zeilen hoch, die Pillen blieben in der ersten, und darunter
               erschien ein Rollbalken über leerem Raum (Daniel, 07.09.2026:
               „die blaue box ist extra 2 zeilen hoch, verteilen sich die pills
               nicht über die 2 zeilen … 1 zeile die doppelt so hoch wie pills
               ist und flex-wrap hat, müsste es doch easy gefixed sein?").
            3. Jetzt `flex-wrap`: Die Pillen füllen die erste Reihe und
               brechen in die zweite um, wenn sie nicht passen.

            **Die feste Höhe bleibt trotzdem gewahrt.** Sie war Daniels Vorgabe
            vom 03.09. („height Änderung der Box durch feste Höhe verhindern"),
            und `check:panel` misst sie. Deshalb begrenzt `max-h` die Reihe auf
            zwei Zeilen; was auch dort nicht hineinpasst — bei fünf und mehr
            Anbietern — wird gescrollt, jetzt aber senkrecht und erst dann.
          */}
          {/*
            `max-h` deckt **genau zwei** Pillenreihen — 4,4rem sind zwei Pillen
            à 28 px plus Abstand. Größer gesetzt schneidet der Kasten ab, statt
            zu scrollen: Er hat eine feste Höhe, und was die Reihe darüber
            hinaus zulässt, ragt einfach hinaus (07.09.2026 an „Kill Blue" mit
            fünf Anbietern gemessen). Ab der dritten Reihe wird gescrollt — das
            ist die Ausnahme für fünf und mehr Wege, nicht der Normalfall.
          */}
          {/*
            **Zwei Reihen zweizeiliger Pillen, nicht einzeiliger.** Seit jede
            Pille ihre Folgenzahl trägt (14.09.2026), ist sie rund 42 px hoch;
            zwei Reihen brauchen damit etwa 94 px, `4.4rem` gab 70 — bei „Kill
            Blue" lag die vierte Pille abgeschnitten im Rollbereich.

            **Und drei einzeilige Reihen passen hinein (7.5rem).** Seit die
            Pillen ihr Anbieterzeichen tragen (16.09.2026), sind sie rund 20 px
            breiter; „Final Fantasy VII: Advent Children" mit sieben Wegen brach
            in eine dritte Reihe um, die bei 6rem 11 px in den Rollbereich hing.
          */}
          {/*
            **Und seit dem 17.09.2026 rollt hier gar nichts mehr — der Kasten wächst.**

            Die Höchsthöhe ist seit dem 07.09. dreimal nachgezogen worden (4.4 → 6 →
            7.5rem), jedes Mal auf den Fall, der gerade aufgefallen war. Mit JustWatchs
            Angeboten je Titel hat ein bekannter Film acht bis dreizehn Wege („Weathering
            with You": 13), und jede Zahl, die man hier einsetzt, schneidet die nächste
            Reihe an: Bei „Your Name." ragten 18 px aus dem Kasten, bei 9,25rem waren es
            27 px eine Reihe weiter.

            Ein Rollbereich **im** Panel, das selbst rollt, ist ohnehin die schlechtere
            Antwort — auf dem Handy trifft man ihn kaum, und eine halb verdeckte Pille
            sieht aus wie ein Fehler. Die Wege sind die Kernauskunft dieser Seite; sie
            stehen jetzt vollständig da. Die Mindesthöhe bleibt, der Kasten springt im
            Regelfall also weiterhin nicht.
          */}
          {/* `items-stretch`: Eine Pille ohne zweite Zeile wird so hoch wie ihre Nachbarn (Daniel, 19.09.2026, TOGGO neben RTL+). */}
          <div className="flex min-h-[2.1rem] flex-wrap items-stretch gap-x-1.5 gap-y-2.5 pb-1 pt-1">
            {mitBereichen ? (
              <div className="flex w-full flex-col gap-2.5">
{/* Der grüne Block nur, wo es wirklich etwas umsonst gibt — sonst wäre er eine leere Behauptung. */}
                {pillen.some((p) => gruppeVon(p) === 'frei') && (
                  <div className="flex flex-col gap-1.5 rounded-lg bg-emerald-500/[0.07] p-2 ring-1 ring-inset ring-emerald-600/25 dark:ring-emerald-400/30">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{kostenlosKopf}</span>
                    <div className="flex flex-wrap items-stretch gap-x-1.5 gap-y-2.5">{pillen.filter((p) => gruppeVon(p) === 'frei')}</div>
                  </div>
                )}
                {(['abo', 'kauf', 'tv', 'unbekannt', 'sonst'] as const).map((g) => {
                  const teil = pillen.filter((p) => gruppeVon(p) === g)
                  if (!teil.length) return null
                  return (
                    <div key={g} className="flex flex-col gap-1.5 px-2">
                      {g !== 'sonst' && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T(`bereich.${g}`)}</span>
                      )}
                      <div className="flex flex-wrap items-stretch gap-x-1.5 gap-y-2.5">{teil}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              pillen
            )}
          </div>
        </div>
      )}
    </section>
  )
}
