import { MitFachwoertern } from '../fachwort.tsx'
import { type ReleaseEvent, type Title, type Release, PLATFORMS } from '@shared/types.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { type ReactNode, useState } from 'react'
import { useFolgenZaehlung } from './folgen-bereich.tsx'
import { ankuendigungOhneTermin } from '@shared/ankuendigung.ts'
import { VermerkAuskunft } from './vermerk.tsx'
import { Umschalter } from './umschalter.tsx'
import { gruppeVon as gruppeVonPille, sichtbareStreamPillen, type Gruppe } from './stream-pillen.ts'
import { erstausgabeAlsNeuigkeit } from './antwort-regeln.ts'
import { abstandImSatz } from '../../lib/abstand.ts'
import { type Antwort } from './antwort-typ.ts'
import { deSeitZeigen } from './de-seit.ts'
import { kostenlosKopfVon } from './kasten-texte.ts'
import { antwortKopf, deSeitZeile } from './antwort-kopf.tsx'

/** Pillenreihe: 8 px zwischen den Pillen, 16 px zwischen den Zeilen (Platz für die Blase), 8 px über der ersten. */
const PILLEN_REIHE = 'flex flex-wrap items-start gap-x-2 gap-y-4 pt-2'

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
  notiz, folgen,
  schnitt,
  angebotSeit,
  hinweis,
  pillenGruppen = new Map(),
  terminPillen = [],
  discZuerst = false,
  legende,
  ohneSprachbeleg,
  releases = [],
}: {
  /** Pillen mit Termin und Anbieter/Sender — sie stehen vor der ersten Folge statt der Streamwege. */
  terminPillen?: React.ReactNode[]
  /** Bereich je Pillen-Schlüssel (`key`) — nur gebraucht, wenn es einen kostenlosen Weg gibt. */
  pillenGruppen?: Map<string, Gruppe>
  /** Über einen Disc-Termin geöffnet — dann steht der Umschalter auf „Disc". */
  discZuerst?: boolean
  /** Erklärt die Zustände der Anbieterzeilen (Stream-Seite) — nur, was dort wirklich vorkommt. */
  legende?: string
  /** Alle Stream-Zeilen ohne Sprachbeleg: Die Überschrift „Auf Deutsch …“ entfällt. */
  ohneSprachbeleg?: boolean | 'omu' | 'anbieter'
  /** Die Termine des Titels — gebraucht für den frühesten deutschen Start (`de-seit.ts`). */
  releases?: Release[]
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
   * `Release.hinweis` trägt das, was aus keiner Zahl hervorgeht — „der Tag steht
   * noch nicht fest", „Netflix nennt den Termin auf der Titelseite; das Jahr
   * ist abgeleitet". Was nur unsere Zuordnung erklärt („Zum Start standen die
   * Folgen 1 bis 3 bereit", „Automatisch übernommen aus …"), steht seit dem
   * 13.09.2026 in `Release.herkunft` und nicht hier.
   * **45 Releases haben eine** (Stand 05.11.2026, `data/curated/*.yaml`), und sie standen bis zum 04.09.2026 als
   * orangefarbener Kasten im Terminbereich.
   *
   * Mit dem Bereich sind sie verschwunden — unbeabsichtigt, denn die Pille
   * nahm nur Name und Datum mit. Daniel hat es an der falschen Beschreibung im
   * Footer gemerkt: „was für 24 folgen mit belegtem termin? das ist staffel 3,
   * das erscheint erst ab 01.10.2026". Bei „Apothekerin" Staffel 3 stand dort
   * in Wahrheit: „Deutsche Fassung laut aniSearch für Oktober 2026
   * angekündigt — der Tag steht noch nicht fest."
   */
  notiz?: string; folgen?: React.ReactNode // Folgenliste (`folgen-bereich.tsx`)
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
  const [zeigeDisc, setZeigeDisc] = useState(discZuerst); const folgenZahl = useFolgenZaehlung(title.id)
  /*
    **Wo noch nichts erschienen ist, gibt es nichts zu sehen.**

    Bei „Apothekerin" Staffel 3 stand „01.10.2026 — Folge 1 … 0 von 12 Folgen
    erschienen" und darunter eine Crunchyroll-Pille mit „DE ✓" (Daniel,
    04.09.2026: „trotzdem crunchy pill? wenn 0, dann keine pill"). Die Pille
    sagt „dort läuft es auf Deutsch" — dort läuft aber noch gar nichts, und der
    Klick führt auf eine Seite ohne eine einzige Folge.

    **Kaufwege und Termin-Pillen bleiben:** Vorbestellung und Ankündigung sagen, wo es kommt.
  */
  const nochNichts = (antwort.art === 'laeuft' && antwort.raus === 0) || antwort.art === 'widerlegt'
  const gruppeVon = (p: ReactNode) => gruppeVonPille(pillenGruppen, p)
  const streamPillen = sichtbareStreamPillen(stream, antwort.art === 'widerlegt' ? [] : terminPillen, nochNichts)
  const beides = streamPillen.length > 0 && disc.length > 0
  /* Der Umschalter zeigt nur Seiten mit Pillen; eine einzelne bleibt als Etikett (Kaufpille = „Disc"). */
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
  /*
    **Die Bereiche stehen immer**. Bis dahin gliederte
    das Panel nur, wenn es einen kostenlosen Weg gab — bei Gachiakuta stand „Kostenlos / Abo / TV",
    bei One Piece lagen Netflix, ADN und die TV-Pille ohne Überschrift beieinander. Zwei Panels,
    zwei Ordnungen, und beim zweiten sah es nach Fehler aus.
  */
  const mitBereichen = !aktivDisc && pillen.length > 0
  const kostenlosKopf = mitBereichen && pillen.some((p) => gruppeVon(p) === 'frei') ? kostenlosKopfVon({ title, antwort, T }) : undefined

  /*
    Dieselbe Angabe, aber kleingeschrieben: Sie steht jetzt mitten im Satz
    („erscheint in 2 Tagen, am …") statt am Satzanfang. Ein großes „Heute"
    dort liest sich wie ein Fehler. Der Countdown steht bei jedem Abstand (`abstandImSatz`).
  */
  const relativImSatz = (datum: string): string => abstandImSatz(today, datum, T)
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
  /* „Auf Deutsch seit …“ der Zustände fertig und Film: Neuigkeit, Zukunft oder eine frühere Pille ersetzen die Zeile (`de-seit.ts`). */
  const deSeitNeben = !erstausgabeAlsNeuigkeit(title, today, releases) && deSeitZeigen(title, releases, today) ? deSeitZeile(title, T) : ''
  const { neben, gedaempft, haupt, nebenTitel, fakten, anteil, zaehl } = antwortKopf({ antwort, relativImSatz, T, betont, ohneSprachbeleg, releases, folgenZahl, deSeitNeben, title })

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
        `relative flex ${((antwort.art === 'fertig' || antwort.art === 'film') && !neben) || ankuendigungOhneTermin(title, antwort.art) ? '' : 'min-h-[11rem]'} flex-col rounded-2xl border p-4`,
        gedaempft
          ? 'border-slate-200 bg-[#f8fafc] [--kasten:#f8fafc] dark:border-white/10 dark:bg-[#111623] dark:[--kasten:#111623]'
          : 'border-[#f6cfc3] bg-[#fff6f3] [--kasten:#fff6f3] dark:border-[#4a2a24] dark:bg-[#1a1416] dark:[--kasten:#1a1416]',
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
          'text-t2 font-bold',
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
        <p className="mt-0.5 text-t4 text-slate-500 dark:text-slate-400" title={nebenTitel}>
          <MitFachwoertern text={neben} />
        </p>
      )}

      {fakten ? (
        /* `mb-1` hält die Beschriftungen von der Trennlinie darunter frei — bei
           „Venus Wars" lag „erschienen / Altersfreigabe / Studio" halb darauf. */
        <div className="mb-1 mt-2 flex gap-4">
          {fakten.map((f) => (
            <span key={f.was} className="flex flex-col ">
              <b className="text-t4 font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {f.wert}
              </b>
              <span className="text-t5 text-slate-400 dark:text-slate-500">{f.was}</span>
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
            className={anteil === 0 ? 'bg-slate-300 dark:bg-white/15' : 'bg-ak-gut'}
            style={{ width: `${anteil === 0 ? 100 : (anteil ?? 100)}%` }}
          />
          {anteil !== undefined && anteil > 0 && anteil < 100 && (
            <span className="bg-ak-gut/25" style={{ width: `${100 - anteil}%` }} />
          )}
        </div>
      )}

      {zaehl && <p className="mt-1 text-t4 text-slate-500 dark:text-slate-400">{zaehl}</p>}
      {angebotSeit && <p className="mt-1 text-t4 text-slate-500 dark:text-slate-400">{angebotSeit}</p>}
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
      {/* Die Erklärung zum Termin, leise: Sie erklärt, sie warnt nicht (Signalfarben nur für Signale). */}
      {notiz && (
        <p className="mt-1.5 text-t4 text-slate-600 dark:text-slate-300">
          <MitFachwoertern text={notiz} />
        </p>
      )}
      {schnitt && (
        <details className="mt-1 text-t5 text-ak-warnung-text">
          <summary className="cursor-pointer select-none font-semibold hover:underline">Was geschnitten ist</summary>
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
                <a href={q} target="_blank" rel="noopener noreferrer" className="underline hover:text-ak-text">
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
              'flex min-h-[2.1rem] items-center text-t4',
              antwort.art === 'kino'
                ? 'text-ak-favorit-text'
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
            Die Pillen brechen um, der Kasten wächst mit: Ein Rollbereich im scrollenden Panel trifft man am Handy kaum, und eine halb
            verdeckte Pille sieht aus wie ein Fehler. Die Mindesthöhe verhindert Sprünge im Regelfall (`check:panel` misst sie).
          */}
          {/* `items-stretch`: Eine Pille ohne zweite Zeile wird so hoch wie ihre Nachbarn (Daniel, 19.09.2026, TOGGO neben RTL+). */}
          <div className="flex flex-col pt-2">
            {mitBereichen ? (
              <div className="flex w-full flex-col gap-3">
{/* Der grüne Block nur, wo es wirklich etwas umsonst gibt — sonst wäre er eine leere Behauptung. */}
                {pillen.some((p) => gruppeVon(p) === 'frei') && (
                  <div className="flex flex-col gap-2 rounded-lg bg-ak-gut-grund p-2 ring-1 ring-inset ring-ak-gut/30">
                    <span className="text-t4 font-semibold text-ak-gut-text">{kostenlosKopf}</span>
                    <div className={PILLEN_REIHE}>{pillen.filter((p) => gruppeVon(p) === 'frei')}</div>
                  </div>
                )}
                {(['abo', 'kauf', 'tv', 'unbekannt', 'sonst', 'offen'] as const).map((g) => {
                  const teil = pillen.filter((p) => gruppeVon(p) === g)
                  if (!teil.length) return null
                  return (
                    <div key={g} className="flex flex-col gap-2">
                      {g !== 'sonst' && (
                        <span className="text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">{T(`bereich.${g}`)}</span>
                      )}
                      <div className={PILLEN_REIHE}>{teil}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={PILLEN_REIHE}>{pillen}</div>
            )}
          </div>
          {legende && !aktivDisc && <p className="mt-2 text-t4 text-ak-leise">{legende}</p>}
        </div>
      )}
      {folgen}
    </section>
  )
}
