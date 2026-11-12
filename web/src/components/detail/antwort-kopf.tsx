import { type ReactNode } from 'react'
import { folgenKopf, laeuftNeben } from './antwort-block.ts'
import {
  terminSatz,
  ungefaehr,
  teilweiseHaupt,
  teilweiseNeben,
  fertigZahlText,
  deFolgenZahlText,
  deSeitQuelleSchluessel,
  kopfSchluesselOhneBeleg,
} from './antwort-regeln.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { ausgebliebenTerminText, widerlegtTexte } from './kasten-texte.ts'
import { Countdown } from './hilfen.tsx'
import { vorstartSatz } from './antwort-vorstart.ts'
import { discKopf } from './antwort-disc-kopf.ts'
import { KINO_LAND, kinoDatum } from './kino.tsx'
import { formatDate } from '@shared/time.ts'
import { ankuendigungOhneTermin, titelSynchroAngekuendigt, ankuendigungZeile } from '@shared/ankuendigung.ts'
import { PLATFORMS, type Release, type Title } from '@shared/types.ts'
import { type Antwort } from './antwort-typ.ts'

/**
 * „Auf Deutsch seit …" — die Nebenzeile aus `deErstausgabe`.
 *
 * Zwei Formen, weil aniSearch zwei liefert: ein Tagesdatum („08.01.2003") oder
 * nur einen Zeitraum („1997", „10.1990 - 03.1991"). Der Zeitraum wird
 * unverändert durchgereicht — ein erfundener 1. Januar wäre falsch, der Text
 * ist richtig.
 */
export function deSeitZeile(
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

/** Haupt- und Nebenzeile, Anteil, Zähler und Fakten des Antwortkastens je Antwortart (aus `AntwortKasten`). */
export function antwortKopf({ antwort, relativImSatz, T, betont, ohneSprachbeleg, releases, folgenZahl, deSeitNeben, title }: {
  antwort: Antwort
  relativImSatz: (datum: string) => string
  T: (k: string, v?: Record<string, string | number>) => string
  betont: (text: string) => ReactNode
  ohneSprachbeleg: boolean | 'omu' | 'anbieter' | undefined
  releases: Release[]
  folgenZahl: [number, number] | undefined
  deSeitNeben: string
  title: Title
}) {
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
    const kopf = folgenKopf(antwort, T)
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
    const termin = terminSatz(antwort.komplett, rel, e.date, T, antwort.blockBis !== undefined)
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
        <span className="text-ak-fehler-text">
          ⚠{' '}
          {antwort.ausgebliebenBis
            ? T('antwort.ausgebliebenMehrere', { von: e.episode ?? '', bis: antwort.ausgebliebenBis })
            : T('antwort.ausgeblieben', { n: e.episode ?? '' })}
        </span>
        <span className="font-normal text-slate-700 dark:text-slate-300">
          {', '}
          {ausgebliebenTerminText(e, T)}
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
              <span className="font-semibold text-ak-gut-text">{rel}</span>
              {mitZeit.slice(mitZeit.indexOf(rel) + rel.length)}
            </>
          ) : (
            mitZeit
          )}
        </span>
        {e.time && !e.estimated && !e.timeEstimated && <Countdown date={e.date} time={e.time} />}
      </>
    )
    neben = laeuftNeben(antwort, T)
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
            <span className="font-semibold text-ak-gut-text">{antwort.raus}</span>
            {' '}
            {T('antwort.erschienenRest', { gesamt: ungefaehr(antwort.gesamt, antwort.gesamtGeschaetzt) })}
          </>
        )
      : ''
    const vorstart = vorstartSatz(antwort, Boolean(ohneSprachbeleg), releases)
    if (vorstart) [haupt, neben, anteil, zaehl] = [betont(vorstart), '', undefined, '']
  } else if (antwort.art === 'teilweise') {
    /*
      **Teilweise synchronisiert — die Zahl statt „alle".**

      Der Zustand entsteht, wenn ein Verweis `dub: true` trägt, seine Bereiche
      die Serie aber nicht abdecken. Vorher fiel dieser Fall in „fertig" und
      wurde zu „Alle 12 Folgen auf Deutsch", obwohl vier belegt waren.
    */
    haupt = teilweiseHaupt(antwort, T)
    neben = teilweiseNeben(antwort, T)
    anteil = antwort.raus === undefined || !antwort.gesamtBelegt ? undefined : Math.round((antwort.raus / antwort.gesamt) * 100)
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
    haupt = antwort.heuteOffen && antwort.gesamt && antwort.gesamt > 1 ? T('antwort.heuteUhrzeitOffen', { count: antwort.gesamt }) : antwort.gesamt && antwort.gesamt > 1
      ? fertigZahlText(antwort.gesamt, antwort.gesamtAbgeleitet, T)
      : folgenZahl && !antwort.gesamt && folgenZahl[1] > 1 ? deFolgenZahlText(folgenZahl, releases, T) : T('antwort.fertigTitel')
    /*
      **„Seit wann?" ist die einzige Frage, die hier noch offen war.**

      Bei 1.985 Titeln haben wir keinen eigenen Termin, aber aniSearch nennt die
      deutsche Erstveröffentlichung mit Verlag — „Cowboy Bebop, 08.01.2003,
      Dybex". Sie füllt die Nebenzeile, die seit dem Zusammenlegen der drei
      Dopplungen leer war, und sagt etwas Neues statt desselben noch einmal.

      Das Feld steht auch bei Titeln mit eigenem Termin (14.10.2026: 366 von 2.559
      Titeln mit Erstausgabe); die Pillen nennen ihr „seit“ dann nicht doppelt.
    */
    neben = deSeitNeben
    nebenTitel = title.deErstausgabe
      ? T(deSeitQuelleSchluessel(title.deErstausgabe.quelle))
      : undefined
    zaehl = ''
  } else if (antwort.art === 'disc') {
    const vorstart = vorstartSatz(antwort, false)
    haupt = vorstart ? betont(vorstart) : discKopf(antwort, T)
    neben = vorstart ? '' : T('antwort.discNeben')
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
    haupt = antwort.hatSynchro ? T(antwort.ohneWeg ? 'antwort.filmSynchronisiert' : 'antwort.filmTitel') : T('antwort.filmOhneTitel')
    /*
      Unter einem Kino-Banner ohne Stream-Weg fehlt genau eine Angabe, und der Leser
      sucht sie: wann er den Film zu Hause sehen kann (Madoka, 17.09.2026).
    */
    neben = antwort.hatSynchro
      ? deSeitNeben
      : antwort.imKino && !(title.streams ?? []).length
        ? T('antwort.filmDeStreamOffen')
        : antwort.ohneWeg
          ? T('antwort.filmOhneNeben')
          : ''
    gedaempft = !antwort.hatSynchro
    zaehl = ''
    nebenTitel = antwort.hatSynchro && title.deErstausgabe ? T(deSeitQuelleSchluessel(title.deErstausgabe.quelle)) : undefined
    /*
      **Hier stand dreimal, was oben schon steht.** „2022 erschienen · ab 12 Altersfreigabe · 8-bit Studio" — und in der
      Unterzeile am Cover, drei Zentimeter darüber: „Film · JP 2022 · 8-bit".
      Die Altersfreigabe stand als einzige nur
      hier — sie ist jetzt eine Marke an der Unterzeile, wo die anderen
      Werkangaben ohnehin sitzen.

      Ein Film bekommt damit keine Faktenzeile mehr. Der Kasten beantwortet die
      Frage, ob es ihn auf Deutsch gibt; das Werk beschreibt der Kopf.
    */
    fakten = []
  } else if (antwort.art === 'widerlegt') {
    const w = widerlegtTexte(antwort, T)
    haupt = w.haupt
    neben = w.neben
    gedaempft = w.gedaempft
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
    const ankuendigung = title.westlich || ankuendigungOhneTermin(title, antwort.art) ? undefined : title.ankuendigung
    haupt = title.westlich
      ? T(title.dubHinweis ? 'antwort.westlichJw' : title.streams.length ? 'antwort.westlichVerfuegbar' : 'antwort.synchroOffen')
      : titelSynchroAngekuendigt(title)
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
    neben = title.dubHinweis
      ? T('antwort.westlichJwNeben', { anbieter: title.dubHinweis.anbieter.join(', ') })
      : ankuendigung ? ankuendigungZeile(ankuendigung, T) : deSeitZeile(title, T, true)
    nebenTitel = ankuendigung
      ? T('antwort.ankuendigungQuelle', { anbieter: PLATFORMS[ankuendigung.platform]?.name ?? ankuendigung.platform, datum: formatDate(ankuendigung.stand) })
      : title.deErstausgabe
        ? T(deSeitQuelleSchluessel(title.deErstausgabe.quelle))
        : undefined
    /* Eine angekündigte Synchro ist eine Nachricht, kein Nein — der Kasten steht dann nicht gedämpft. */
    gedaempft = !titelSynchroAngekuendigt(title)
    zaehl = ''
  }
  /* Keine Zeile mit Sprachbeleg: „Auf Deutsch …“ wäre eine Behauptung, die keine Zeile darunter trägt. */
  if (ohneSprachbeleg && (antwort.art === 'fertig' || antwort.art === 'film')) haupt = T(kopfSchluesselOhneBeleg(ohneSprachbeleg))
  return { neben, gedaempft, haupt, nebenTitel, fakten, anteil, zaehl }
}
