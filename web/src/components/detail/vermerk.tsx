import { addDays, formatDate } from '@shared/time.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useState, useEffect, type ReactNode } from 'react'
import { type Meldung, type VermerkAusgeblieben } from '@shared/types.ts'
import { loadMeldungen } from '../../lib/data.ts'
import { naechsteRecherche } from '@shared/recherche-plan.ts'
import { Tooltip } from '../ui.tsx'

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
export function Meldungen({ titleId }: { titleId: number }) {
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
        className="cursor-pointer text-xs text-sky-700 dark:text-sky-300 hover:underline"
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
 * **Was in der Pille steht, steht im Datensatz.** Seit dem 14.09.2026 nennt die
 * zweite Zeile die Folgenzahl **unseres Titels** bei diesem Anbieter (Regeln an
 * der Stelle, an der sie entsteht). Der Einwand vom 25.08.2026 bleibt der
 * Maßstab — ein Stream-Verweis zeigt auf die **Serie**, und „12 Folgen" darf
 * nur dastehen, wo es für diesen Titel gilt (Daniel damals: "ADN hat folgen
 * 1-24, netflix auch, crunchy auch"). Deshalb zählt die Zahl die Folgen des
 * Titels, nicht die der Anbieter-Seite.
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
/**
 * **Was wir zu einer ausgebliebenen Folge wissen — und was wir tun.**
 *
 * Daniel am 13.09.2026 unter „Folge 8 ist nicht erschienen": „aber wann
 * erscheint sie nun? klar, wir wissen es nicht, aber genau das werden sich
 * nutzer fragen … sodass nutzer beruhigt sind und sich sicher sein können, das
 * sie sich auf den kalender verlassen können."
 *
 * Die Antwort auf „wann" ist meist „unbekannt". Was sich trotzdem sagen lässt,
 * steht hier, und jede Zeile nur, wenn sie belegt ist:
 *
 * 1. dass wir beim Anbieter nachsehen, wann zuletzt, und dass man selbst
 *    nachsehen kann (der Anbietername ist der Verweis — die Pille darunter
 *    wäre sonst dieselbe Auskunft zweimal);
 * 2. was Anime2You meldet, oder dass es nichts meldet — nur wenn der Feed
 *    **nach** dem Termin gelesen wurde;
 * 3. was die tägliche Recherche ergab, mit Quelle, oder bis wann sie nichts
 *    fand.
 *
 * Ist die Folge auf einen Ersatztermin verschoben, entfällt Zeile 1: Dann gibt
 * es einen Termin, und der steht in der Überschrift.
 */
export function VermerkAuskunft({
  vermerk,
  ausgeblieben,
  episode,
  anbieter,
  anbieterUrl,
  today,
  T,
}: {
  vermerk: VermerkAusgeblieben
  ausgeblieben: boolean
  episode?: number
  anbieter: string
  anbieterUrl?: string
  today: string
  T: (k: string, v?: Record<string, string | number>) => string
}) {
  /*
    **Ein Ersatztermin beendet den Ausfall nicht** (Daniel, 20.09.2026, mit
    Bild): Bei „You and I Are Polar Opposites" Staffel 2 stand nur noch
    „Nächste Folge (Folge 8) erscheint am 27.09., verschoben vom 13.09." — kein
    Wort darüber, dass die Folge seit zwei Wochen aussteht und wir weiter
    nachsehen. Sein Auftrag: „entsprechend muss eine ausfallnotiz im detail
    panel stehen".

    `ausgeblieben` gilt dem **Termin**, den die Überschrift zeigt; `offen` gilt
    der **Folge**. Die Auskunft darunter gehört der Folge, also hängt sie an
    `offen`. Was die Überschrift schon sagt, steht hier nicht noch einmal: der
    Termin selbst.
  */
  const offen = !vermerk.erschienenAm
  const ueberfaellig = offen && !ausgeblieben
  const link = 'text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700 dark:text-sky-300 dark:decoration-sky-300/30'
  const [vor, nach] = T('antwort.vermerkPruefen', { anbieter: '\u0000' }).split('\u0000')
  const zeilen: ReactNode[] = []
  /*
    **Wann zuletzt, wann als Nächstes — je Stufe** (Daniel, 15.09.2026: „wann war
    das letzte mal das wir geprüft haben, und wann steht die nächste Prüfung an?
    Offen kommunizieren"). Die nächste Recherche rechnet dieselbe Regel aus wie
    der Lauf (`shared/recherche-plan.ts`); weil GitHub geplante Läufe oft später
    startet, heißt es „voraussichtlich … ab".
  */
  const naechsteSuche = (): string | null => {
    const n = naechsteRecherche(vermerk, new Date())
    if (!n) return null
    const tag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(n)
    const zeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(n)
    const vorn =
      tag === today
        ? T('antwort.relHeute')
        : tag === addDays(today, 1)
          ? T('antwort.relMorgen')
          : T('antwort.amDatum', { datum: formatDate(tag) })
    return T('antwort.naechsteVoraussichtlich', { tag: vorn, zeit })
  }
  const planZeile = (): string | null => {
    if (!offen) return null
    const naechste = naechsteSuche()
    if (vermerk.rechercheAm) {
      return naechste
        ? T('antwort.vermerkRechercheZuletzt', { wann: zeitpunktText(vermerk.rechercheAm, today, T), naechste })
        : T('antwort.vermerkRechercheEnde')
    }
    return naechste ? T('antwort.vermerkRechercheStart', { naechste }) : null
  }
  /* Die Überschrift nennt nur den neuen Termin — dass die Folge seit dem alten aussteht, steht hier. */
  if (ueberfaellig && vermerk.erwartetAm) {
    zeilen.push(
      T('antwort.vermerkUeberfaellig', {
        n: episode ?? '',
        datum: formatDate(String(vermerk.erwartetAm).slice(0, 10)),
      }),
    )
  }
  if (offen) {
    zeilen.push(
      <>
        {vor}
        {anbieterUrl ? (
          <a href={anbieterUrl} target="_blank" rel="noopener noreferrer" className={link}>
            {anbieter}
          </a>
        ) : (
          anbieter
        )}
        {nach}
        {vermerk.geprueftAm && ` ${T('antwort.vermerkZuletzt', { wann: zeitpunktText(vermerk.geprueftAm, today, T) })}`}
        {` ${T('antwort.vermerkNaechsterBlick')}`}
      </>,
    )
  }
  if (vermerk.hinweise?.length) {
    for (const h of vermerk.hinweise) {
      zeilen.push(
        <>
          {T('antwort.vermerkNews', { quelle: h.quelle, datum: formatDate(h.datum.slice(0, 10)) })}{' '}
          <a href={h.url} target="_blank" rel="noopener noreferrer" className={link}>
            {h.titel}
          </a>
        </>,
      )
    }
  } else if (offen && vermerk.newsGeprueftAm) {
    zeilen.push(T('antwort.vermerkNewsLeerStand', { wann: zeitpunktText(vermerk.newsGeprueftAm, today, T) }))
  }
  if (vermerk.recherche) {
    zeilen.push(
      <>
        {vermerk.recherche}
        {vermerk.rechercheQuelle && (
          <>
            {' '}
            <a href={vermerk.rechercheQuelle} target="_blank" rel="noopener noreferrer" className={link}>
              {T('antwort.vermerkQuelle')}
            </a>
          </>
        )}
      </>,
    )
  } else if (offen && vermerk.rechercheAm) {
    zeilen.push(T('antwort.vermerkRechercheLeer', { datum: formatDate(vermerk.rechercheAm.slice(0, 10)) }))
  }
  const plan = planZeile()
  if (plan) zeilen.push(plan)
  /* Zum Schluss, was der Leser mitnehmen soll: Der Termin oben ist eine Annahme, und wir bleiben dran. */
  if (ueberfaellig) zeilen.push(T('antwort.vermerkAnnahme'))
  if (!zeilen.length) return null
  return (
    <div className="mt-2 space-y-0.5 border-t border-slate-200/70 pt-1.5 text-[11px] leading-snug text-slate-600 dark:border-white/10 dark:text-slate-300">
      {zeilen.map((z, i) => (
        <p key={i}>{z}</p>
      ))}
    </div>
  )
}

/*
  **Der DE-Beleg als Häkchen auf der Ecke** (Daniel, 19.09.2026, aus vier Entwürfen: „nur das
  häkchen oben rechts … bei hover tooltip"). „DE ✓" kostete rund 35 px je Pille; unbelegte
  Wege tragen gar kein Zeichen mehr — der Tooltip sagt, was das Häkchen heißt.
*/
export function DubEcke({ dub }: { dub?: boolean }) {
  const { t } = useLang()
  if (dub !== true) return null
  return (
    <span className="absolute -right-1 -top-1.5 z-10">
      <Tooltip text={t('detail.dubYes')} seite="oben">
        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-[9px] font-black leading-none text-white ring-2 ring-white dark:ring-[#0f1b2e]">
          ✓
        </span>
      </Tooltip>
    </span>
  )
}

/**
 * „heute, 16:29 Uhr" — wann zuletzt nachgesehen wurde, in Berliner Zeit.
 *
 * Die Uhrzeit gehört dazu: „heute nachgesehen" beruhigt um 23 Uhr nicht, wenn
 * es um sieben Uhr morgens war.
 */
function zeitpunktText(iso: string, today: string, T: (k: string) => string): string {
  const d = new Date(iso)
  const tag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d)
  const zeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(d)
  const vorn = tag === today ? T('antwort.relHeute') : tag === addDays(today, -1) ? T('antwort.relGestern') : formatDate(tag)
  return `${vorn}, ${zeit} Uhr`
}
