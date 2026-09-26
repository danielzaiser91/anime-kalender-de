import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { DiscAusgabe, Release, StreamLink, Title } from '@shared/types.ts'
import { bereicheGekuerzt, bereicheKurz, dubAbdeckung, dubBild, dubGrenze, dubLuecken, folgenOhneAnbieter } from '@shared/dub-grenze.ts'
import type { Zugangsart } from '@shared/zugangsart.ts'
import { PLATFORMS, anbieterName } from '@shared/types.ts'
import { expandEvents, titleStatus, istErschienen, istAusgeblieben, releaseStatus, bereicheMitTermin } from '@shared/logic.ts'
import { addDays, formatDate, todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import type { FranchiseMember, Franchises } from '@shared/types.ts'
import {
  anzeigeName,
  eindeutschenStaffel,
  hauptstaffeln,
  staffelBeschriftungen,
  reihenAnfang,
  istStaffel,
  ohneStaffelEins,
  reihenVertreter,
} from '@shared/titles.ts'
import {
  loadAllTitles, loadFranchises, loadOhneSynchro,
  loadDiscAusgaben,
  loadSynopsis, type Synopsis
} from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { coverBild } from '../lib/cover.ts'
import { syncSharePath } from '../lib/router.ts'
import { useNewsletterVerbindung } from '../lib/newsletterSync.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import {
  Button,
  Chip,
  ReihenStern,
  Tooltip,
  FavoriteStar,
  HideEye,
  SectionTitle,
} from './ui.tsx'
import { Quellenuebersicht } from './Quellenuebersicht.tsx'
import { AnbieterIcon, anbieterDatei } from '../lib/anbieter-icon.tsx'
import { jetztBerlin, toggoAngabe } from '../lib/toggo.ts'
import { joynAngabe } from '../lib/joyn.ts'
import { tvAngabe } from '../lib/tv-angabe.ts'
import { KEYWORD_PREVIEW, PLOT_PREVIEW, ShareIcon } from './detail/hilfen.tsx'
import { DiscZeichen, AniSearchVerweis, Pille, discPillen, DiscEinzelListe, ReleasePille, istToggo, farbeZuAnbieter, gruppiereKaufwege } from './detail/pillen.tsx'
import { MerkenKnopf } from './detail/merken.tsx'
import { TrailerKino, jpErschienen, KINO_LAND, jpAngabe, KinoBanner } from './detail/kino.tsx'
import { WeitereTitel, VoiceCast, AehnlicheTitel } from './detail/weitere.tsx'
import { Meldungen, DubEcke } from './detail/vermerk.tsx'
import { ausgebliebenBis, AntwortKasten } from './detail/antwort-kasten.tsx'

export function DetailPanel({
  data,
  titleId,
  terminOffen = false,
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
  /** Über einen Termin geöffnet — dann gehört die Adresse dem Termin (`/r/`). */
  terminOffen?: boolean
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
  const titelRoh: Title | undefined = data.titleById.get(titleId)
  /*
    **Belegte Bereiche plus erschienene Folgen des deutschen Wochenplans** (25.09.2026,
    `bereicheMitTermin`): Sonst zählte das Panel bei einer laufenden Serie nur den Beleg vom
    Prüftag — „10 von 12" neben „Ep 12/12" in der Woche (Vom Landei zum Schwertheiligen II).
  */
  const title = useMemo(() => {
    if (!titelRoh?.streams?.length) return titelRoh
    const rels = data.releasesByTitle.get(titelRoh.id) ?? []
    if (!rels.some((r) => r.releaseType === 'weekly')) return titelRoh
    return {
      ...titelRoh,
      streams: titelRoh.streams.map((s) => ({ ...s, dubRanges: bereicheMitTermin(s.dubRanges, rels, s.platform) })),
    }
  }, [titelRoh, data])
  /*
    **Ein offener Titel bekommt seinen Teilen-Pfad `/t/<slug>/`** (19.09.2026). Bis dahin
    schrieb nur ein offener Termin einen Pfad in die Adressleiste; wer bei einem Titel die
    Adresse kopierte, teilte `/#/woche?t=…` und Discord zeigte die Startseiten-Vorschau
    (Daniel, an Boruto). Hier und nicht in `App.tsx`: Nur das Panel hat den Titel sicher —
    `titleById` wird beim Nachladen erweitert, ohne dass ein Effekt davon erfährt.
  */
  useEffect(() => {
    /* Cartoons (negative Kennung) und Titel ohne Synchro haben keine Titel-Seite. */
    if (!terminOffen && title?.slug && title.id > 0 && !title.ohneSynchro) syncSharePath(undefined, title.slug)
  }, [terminOffen, title?.slug, title?.id, title?.ohneSynchro])
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
  const [discAusgaben, setDiscAusgaben] = useState<DiscAusgabe[]>([])
  const [discOffen, setDiscOffen] = useState(false)

  useEffect(() => {
    let alive = true
    setDiscAusgaben([])
    setDiscOffen(false)
    loadDiscAusgaben(titleId)
      .then((a) => {
        if (alive) setDiscAusgaben(a)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [titleId])

  useEffect(() => {
    let alive = true
    setSynopsis(undefined)
    /* Cartoons (negative Kennung) tragen ihre Beschreibung im Titel — für sie gibt es keine Gruppendatei (16.09.2026). */
    if (titleId < 0) {
      setSynopsis(title?.synopsis ? { de: title.synopsis } : undefined)
    } else {
      loadSynopsis(titleId)
        .then((s) => {
          if (alive) setSynopsis(s)
        })
        .catch(() => {})
    }
    setAllKeywords(false)
    setPlotOffen(false)
    return () => {
      alive = false
    }
  }, [titleId, title?.synopsis])

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
      /*
        **Was `franchises.json` sagt, gewinnt — und zwar vollständig.**

        Feld für Feld aufzuzählen hieß: Jedes Feld, das später dazukommt,
        fehlt hier. Bei „Lord of Mysteries" fielen so `beiwerk`, `jpStart`
        und `jpStatus` heraus, sobald `titles.json` nachgeladen war — die
        Specials standen zwei Sekunden lang richtig unter „Specials" und
        danach unter „Hauptserie" (Daniel, 12.09.2026: „für paar sek war
        chibi theatre unter specials eingeordnet, dann wieder in
        hauptserie").

        Der Titel liefert deshalb nur noch die Vorgabe; der Eintrag der
        Reihe liegt darüber. Fehlende Felder stehen in der Datei gar nicht
        erst, überschreiben also nichts.
      */
      teile.set(t.id, {
        id: t.id,
        name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`,
        format: t.format,
        jpYear: t.jpYear,
        episodes: t.episodes,
        cover: t.coverImage,
        ...bisher,
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
   * Der eigene Eintrag in der Reihe — er trägt Felder, die `titles.json` nicht
   * führt. `jpStart` etwa steht dort bei keinem einzigen der 2.771 Titel; in
   * `franchises.json` bei jedem, für den AniList mehr weiß als das Jahr.
   */
  const eigenerTeil = useMemo(
    () => reihenTeile.find((m) => m.id === title?.id),
    [reihenTeile, title],
  )

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
    const vertreter = reihenVertreter(reihe.map((m) => ({ ...m, id: m.id })))
    const kopf = ohneStaffelEins(vertreter.name)
    const kopfIstDeutsch = data.titleById.get(vertreter.id)?.titleDe === vertreter.name
    /* Der erste Teil nennt oft sich selbst, nicht die Reihe — siehe `reihenAnfang()`. */
    return reihenAnfang(kopf, reihe.map((m) => m.name), kopfIstDeutsch)
  }, [reihe, title, data])

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
    let rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    /*
      **Trägt der Name einen fremden Reihennamen, zählt nur die Staffelangabe.**

      Über „Staffel 3 Teil 2" stand im Kopf „Kusuriya no Hitorigoto Staffel 3
      Teil 2", in der Liste darunter korrekt „Staffel 3 Teil 2" — bei Teil 1
      stimmten beide (Daniel, 12.09.2026). Der Grund ist der Abzug oben: Für
      Teil 2 kennen wir keinen deutschen Namen, der Titel beginnt deshalb nicht
      mit unserem Reihennamen, und der Abzug greift nicht.

      Die Liste zieht dieselbe Regel seit dem 03.09.2026 — der Kopf nicht, und
      damit stand derselbe Teil an zwei Stellen verschieden da. Welche Reihe
      gemeint ist, sagt die Zeile darüber; einen deutschen Namen erfindet auch
      diese Regel nicht.

      **Nur bei einer Staffel.** Beim Beiwerk ist der fremde Reihenname gerade
      das Unterscheidende — „Maomao no Hitorigoto Staffel 2" ist nicht die
      zweite Staffel der Hauptserie.
    */
    const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
    /* Nur ein fremder Name (rest === voll) wird gekürzt — „Pokémon: Schwarz & Weiß Staffel 2" behält „Schwarz & Weiß" (17.09.2026). */
    if (istStaffel(title.format) && staffelTeil && rest === voll && rest !== staffelTeil[1] && staffelBeschriftungen(hauptstaffeln(reihenTeile), reihenName).has(title.id)) rest = staffelTeil[1]!
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
    /*
      **Staffel und Teil kommen aus derselben Zählung wie in der Liste.**

      Über Mushoku Tensei Staffel 3 stand „Staffel 5": Gezählt wurde die
      Position unter allen Fernsehstaffeln, und AniList führt die beiden
      zweiten Hälften („Cour 2") als eigene Einträge (Daniel, 13.09.2026).
      `staffelBeschriftungen()` ordnet einen Teil seiner Staffel zu.
    */
    const beschriftung = staffelBeschriftungen(hauptstaffeln(reihenTeile), reihenName).get(title.id)
    if (beschriftung) return beschriftung
    if (rest) return rest
    return voll
  }, [title, reihenName, reihenTeile])

  /*
    Vorher stand hier eine Zählung nach Position, mit dieser Begründung — sie
    gilt weiter, die Rechnung steht jetzt in `staffelBeschriftungen()`:

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

  /**
   * Beim Wechsel auf eine Staffel ohne Termin fehlen die Metadaten — die liegen
   * in `titles.json`, das im Kalender nicht geladen ist. Erst holen, dann
   * öffnen, sonst zeigt das Panel „keine Metadaten".
   */
  const [wechselt, setWechselt] = useState(false)
  /*
    **Lange Reihen brauchen Reiter, Suche und einen Aufklapper** (Daniel, 17.09.2026, Pokémon
    mit 112 Teilen: „sehr schwer dort für nutzer gesuchte titel der reihe zu finden").
    Der Zustand gilt je Reihe und fällt beim Wechsel der Reihe zurück.
  */
  const reihenSchluessel = reihenTeile[0]?.id ?? 0
  const [reiheReiter, setReiheReiter] = useState<{ reihe: number; titel: string } | null>(null)
  const [reiheSuche, setReiheSuche] = useState<{ reihe: number; text: string }>({ reihe: 0, text: '' })
  const [reiheOhneOffen, setReiheOhneOffen] = useState<number | null>(null)

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
      /*
        **Zwei gleiche Wege sind eine Pille** (18.09.2026). Amazon führt manchen Film
        unter zwei Kennungen mit demselben Angebot („Giovannis Insel": B00TCOTQHS und
        B00TE2CQLQ, beide Abo, beide DE ✓). 14 Titel zeigten zwei Prime-Pillen, die
        sich durch nichts unterschieden. Zusammengelegt wird nur, was in Plattform,
        Zugang, Sprachurteil und Folgenbereich übereinstimmt — sonst sagen die Pillen
        Verschiedenes und bleiben beide. Im Datensatz stehen weiter beide.
      */
      plattformen: (title?.streams ?? [])
        .filter((s) => (s.zugang ?? 'abo') === art)
        .filter((s, i, alle) => {
          const sig = (x: typeof s) =>
            `${x.platform}|${x.zugang ?? ''}|${x.dub}|${JSON.stringify((x.dubRanges ?? []).filter((r) => r.dub).map((r) => [r.from, r.to]))}`
          return alle.findIndex((x) => sig(x) === sig(s)) === i
        }),
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
      /*
        **Ein digitaler Kauf ist Streamen, keine Disc.**

        Hier wanderte jeder Weg mit `zugang: 'kauf'` in den Disc-Reiter, auch wenn
        er als `kind: 'stream'` angelegt war — maxdome und freenet meinVOD standen
        dadurch unter „Disc" (Daniel, 16.09.2026: „die pills sind falsch als disc
        eingeordnet, das sind streambare titel"). Der Reiter fragt „anschauen oder
        ins Regal stellen"; ob das Anschauen Geld kostet, sagt die Zugangsart, und
        die steht in der Gruppenüberschrift.

        Der Disc-Reiter nimmt deshalb nur noch `kind: 'buy'` — Händler, die einen
        Datenträger verschicken.
      */
      streamWege: gruppiereKaufwege(
        (title?.watchLinks ?? []).filter((w) => w.kind === 'stream' && (w.zugang ?? 'abo') === art),
      ),
      shops: gruppiereKaufwege([
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
  /*
    **Der Kinostart steht im Banner, nicht als Pille** (17.09.2026). Gezeigt wird er,
    solange er läuft (belegter letzter Spieltag) oder bevorsteht — und bis 60 Tage nach
    dem Start, solange niemand ein Ende belegt hat.
  */
  const kinoRelease = useMemo(
    () =>
      releases
        .filter((r) => r.platform === 'kino' && r.schedule?.firstEpisodeDate)
        .filter((r) =>
          r.cinemaUntil ? r.cinemaUntil >= today : r.schedule!.firstEpisodeDate! >= addDays(today, -60),
        )
        .sort((a, b) => a.schedule!.firstEpisodeDate!.localeCompare(b.schedule!.firstEpisodeDate!))[0],
    [releases, today],
  )
  const streamReleases = useMemo(
    () =>
      releases.filter(
        (r) =>
          r.releaseType !== 'disc' &&
          r.slug !== kinoRelease?.slug &&
          !(title?.streams ?? []).some((s) => s.platform === r.platform) &&
          /*
            Ein Fernsehtermin, der vorbei ist, ist kein Weg zur Folge (Daniel, 22.09.2026):
            „niemand kann in die vergangenheit reisen und dort die folge gucken". Eine TV-Pille
            steht deshalb nur, solange eine Sendung läuft oder eine kommt.
          */
          (r.platform !== 'tv' || !title || Boolean(tvAngabe(r, title, releases, today, jetztBerlin().slice(11, 16)))),
      ),
    [releases, title, kinoRelease, today],
  )

  /*
    **Die Pille nennt, wie viele Folgen es dort gibt — nicht, seit wann.**

    Daniel am 13.09.2026: „in den pills muss überall drin stehen wieviele
    episoden bei dem jeweiligen anbieter sind. einfaches de ✅ reicht nicht, und
    seit datum ist uninteressant." Das Datum bleibt im Datensatz.

    Vier Quellen, gemessen am 14.09.2026 über 1.982 deutsche Verweise (517 Filme,
    783 mit Einzelbeleg je Anbieter, 682 abgeschlossene Serien, 0 laufende ohne
    Beleg), von Daniel so bestätigt:

    1. **Film:** keine Zahl — ein Film ist eine Folge.
    2. **Belegte Bereiche:** was sie sagen — „nur Fg. 1" (Date a Live auf
       YouTube, 07.09.2026: „was da ist, nicht was fehlt"), eine Lücke, eine
       Grenze oder die Summe.
    3. **Laufende Wochenserie:** die bei diesem Anbieter erschienenen Folgen,
       gezählt wie im Kasten darüber.
    4. **Abgeschlossene Serie:** die Folgen des Titels — dieselbe Rechnung wie
       „Alle 12 Folgen auf Deutsch".

    Eine laufende Serie ohne Wochenplan und ohne Beleg bekommt keine Zahl — dort
    wüssten wir sie nicht. Ein Bezugsweg („Amazon Prime (Crunchyroll)") erbt die
    Angaben des Verweises mit derselben Adresse; ohne ihn gilt die Regel des Titels.
  */
  /**
   * **Der Hinweis an der Pille: zeilenweise, Deutsch zuerst** (Daniel, 23.09.2026: „im
   * tooltip nicht in selbe zeile sondern untereinander, also zeilenumbruch vor nicht im
   * angebot").
   *
   * Drei Mengen, drei Zeilen, und keine davon steht da, wenn sie leer ist: wie viele Folgen
   * auf Deutsch (und wovon), welche das sind, welche nur fremdsprachig dort liegen, und
   * welche der Anbieter gar nicht führt. Deckt ein Weg alles auf Deutsch ab, sagt das
   * Häkchen daneben schon alles — dann bleibt der Hinweis leer.
   */
  const dubZeilen = (s: { dubRanges?: StreamLink['dubRanges'] }): string[] => {
    const bild = dubBild(s.dubRanges, title?.episodes)
    if (!bild?.deutsch.length || (!bild.ohneTon.length && !bild.nichtImAngebot.length)) {
      const grenze = dubGrenze(s.dubRanges)
      return [
        dubLuecken(s.dubRanges) ? t('detail.dubLueckenTitel') : '',
        grenze
          ? t(grenze.schluessel === 'detail.dubUntil' ? 'detail.dubUntilTitel' : 'detail.dubFromTitel', {
              n: grenze.n,
            })
          : '',
      ].filter(Boolean)
    }
    return [
      title?.episodes
        ? t('detail.dubKopfVon', { n: bild.deutscheFolgen, m: title.episodes })
        : t('detail.dubKopf', { n: bild.deutscheFolgen }),
      bereicheKurz(bild.deutsch),
      bild.ohneTon.length ? t('detail.dubOhneTonZeile', { bereiche: bereicheKurz(bild.ohneTon) }) : '',
      bild.nichtImAngebot.length
        ? t('detail.dubNichtImAngebot', { bereiche: bereicheKurz(bild.nichtImAngebot) })
        : '',
    ].filter(Boolean)
  }

  const folgenAngabeFuer = (
    s:
      | { platform?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; dub?: boolean; fenster?: StreamLink['fenster'] }
      | undefined,
  ): string => {
    /*
      **Joyn: nur das gerechnete Fenster, nie die Folgenzahl des Titels** (Daniel, 22.09.2026). Joyn hält
      ein rollendes Fenster; bei Dragon Ball Super stand sonst „131 Fg.“, abrufbar waren 20.
    */
    if (s?.platform === 'joyn') return joynAngabe(s.fenster) ?? ''
    /*
      **Alle Releases des Anbieters zusammen** (21.09.2026, Steel Ball Run). Netflix führt Folge 1
      als eigenes Release (19.03.) und die Folgen 2–12 als Wochenserie ab 25.09.; AniList kennt nur
      die erste. Die Pille zählte ein Release und hielt das Werk für einfolgig — sie blieb leer
      (Daniel mit Bild: „warum steht in der pill nicht wieviele folgen auf netflix … sind").
    */
    const anbieterReleases = s?.platform ? releases.filter((r) => r.platform === s.platform) : []
    const folgenLautReleases = Math.max(
      0,
      ...anbieterReleases.map((r) => (r.schedule?.firstEpisodeNumber ?? 1) - 1 + (r.schedule?.episodeCount ?? 1)),
    )
    /* Ein Werk mit genau einer Folge ist wie ein Film: „1 Fg." sagt nichts (Dr. Stone Ryusui, Stichprobe 17.09.2026). */
    if (!title || title.format === 'MOVIE' || (title.episodes === 1 && folgenLautReleases <= 1)) return ''
    const deutsch = (s?.dubRanges ?? []).filter((r) => r.dub)
    /*
      **„nur" nur, wo der Weg wirklich nur diese Folge enthält** (18.09.2026). Bei Date a
      Live auf YouTube stimmte es — dort liegt ein einzelnes Video. Bei „Monster" auf
      Netflix (74 Folgen, belegt ist Folge 1) behauptete es eine Lücke, die niemand
      gemessen hat; dort steht jetzt der Bereich („Fg. 1") wie bei jedem anderen
      Teilbeleg.
    */
    const einzelneFolge =
      s?.nurFolge != null || (/youtube\.com\/watch\?/.test(s?.url ?? '') && !/[?&]list=/.test(s?.url ?? ''))
    if (einzelneFolge && deutsch.length === 1 && deutsch[0]!.from === 1 && deutsch[0]!.to === 1)
      return t('detail.dubNurEine')
    /*
      **Gemischt heißt: das Label nennt die deutschen Folgen** (Daniel, 23.09.2026: „de in
      fokus und nicht de in tooltip"). Vorher stand dort die Lücke („✕ DE 5–7") oder die
      Grenze („✓ DE 1–155"). Beide beantworten nur einen Teil der Frage, und die Lücken-Form
      stellt sogar das Fehlende nach vorn. Bei drei Bereichen und mehr kürzt die Pille; der
      Hinweis daneben zählt alle auf.
    */
    const bild = dubBild(s?.dubRanges, title.episodes)
    if (bild?.ohneTon.length && bild.deutsch.length) {
      const { text: bereiche, rest } = bereicheGekuerzt(bild.deutsch)
      return rest ? t('detail.dubDeMehr', { bereiche, n: rest }) : t('detail.dubDe', { bereiche })
    }
    const luecken = dubLuecken(s?.dubRanges)
    if (luecken) return t('detail.dubLuecken', { n: luecken })
    const grenze = dubGrenze(s?.dubRanges)
    if (grenze) return t(grenze.schluessel, { n: grenze.n })
    const release = s?.platform ? releaseJePlattform.get(s.platform) : undefined
    /*
      Ein RTL+-Wochentermin setzt mitten in der Serie ein (Beyblade X ab Folge 101); die
      erschienenen zu zählen ergäbe „16 Fg." bei 115 Folgen auf RTL+ (19.09.2026).
    */
    if (release?.tvLetzteSichtung && release.platform !== 'tv' && releaseStatus(release, today) === 'airing')
      return t('detail.neuAm', { d: formatDate(release.tvLetzteSichtung) })
    if (release?.releaseType === 'weekly' && releaseStatus(release, today) === 'airing') {
      const raus = expandEvents(release).filter((e) => istErschienen(e)).length
      return raus ? t('detail.folgenKurz', { n: raus }) : ''
    }
    /* Mehrere Releases, eines davon als Wochenserie: gezählt wird, was bei diesem Anbieter schon da ist. */
    if (anbieterReleases.length > 1 && anbieterReleases.some((r) => r.releaseType === 'weekly')) {
      const raus = anbieterReleases.flatMap((r) => expandEvents(r)).filter((e) => istErschienen(e)).length
      return raus ? t('detail.folgenKurz', { n: raus }) : ''
    }
    /* Decken die Bereiche den Titel nicht ab, nennt die Pille sie selbst — „Fg. 1–75" statt
       „75 Fg." (Dai-DVD-Box, 16.09.2026): Die Zahl allein sagt nicht, welche fehlen. */
    if (deutsch.length && !dubAbdeckung(s?.dubRanges, title.episodes).vollstaendig)
      return t('detail.folgenBereich', { bereich: bereicheKurz(deutsch) })
    if (deutsch.length) return t('detail.folgenKurz', { n: dubAbdeckung(s?.dubRanges, title.episodes).belegt })
    /*
      **Ohne Sprachbeleg keine Titelzahl** (21.09.2026). Regel 4 war an 1.982 deutschen
      Verweisen gemessen — für einen Weg ohne Urteil schrieb sie trotzdem die Folgen des
      Titels hin. Golden Wind: zwei Prime-Pillen über den Crunchyroll-Kanal, dort nur
      Französisch und Japanisch, und beide zeigten „39 Fg." unter „Alle 39 Folgen auf
      Deutsch" (Daniel mit Bild: „wieso tauchen diese 2 prime pills auf, obwohl sie keine
      deutsche synchro haben?"). Eine Zahl am Weg braucht einen Beleg an genau diesem Weg.
    */
    if (s && s.dub !== true) return ''
    const abgeschlossen = title.jpEnd
      ? title.jpEnd < today
      : Boolean(title.jpYear && title.jpYear < Number(today.slice(0, 4)))
    return abgeschlossen && title.episodes ? t('detail.folgenKurz', { n: title.episodes }) : ''
  }

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
    /*
      **Synchro belegt heißt nicht nur „ein Stream mit DE ✓".** „Undefeated Bahamut Chronicle"
      stand als „Noch keine deutsche Fassung" da — mit belegten deutschen Sprechrollen und
      einer Blu-ray-Gesamtausgabe seit 2020 im Disc-Reiter (Daniel, 16.09.2026). Belegt ist
      sie auch durch die Sprechrollen und durch einen Kaufweg mit deutscher Folgenspanne.
    */
    /*
      Und durch aniSearchs Marke „Synchronisiert" am deutschen Block (18.09.2026, Stichprobe
      1809): „Niklaas: Der Junge aus Flandern" und „Jakobus Nimmersatt" standen als „Noch
      keine deutsche Fassung" da, während der Kasten daneben ihre deutsche Ausgabe nannte.
      Gemessen 253 Titel mit Marke ohne jeden anderen Beleg, 180 davon Filme und Specials.
    */
    const hatSynchro =
      (title.streams ?? []).some((s) => s.dub === true) ||
      Boolean(title.hasVoices) ||
      Boolean(title.deErstausgabe?.synchro) ||
      (title.watchLinks ?? []).some((w) => w.dubRanges?.some((r) => r.dub))
    /*
      **Was der Kino-Banner zeigt, ist für den Kasten erledigt** (17.09.2026). Sonst liest
      er den Kinotermin als Folge und schreibt „Erste Folge erscheint am … · Wöchentlich ·
      0 von 1 Folgen" über einen Film — derselbe Fehler wie bei Madoka am selben Tag.
    */
    const imKinoBanner = (r: (typeof releases)[number]) =>
      r.platform === 'kino' &&
      (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60))
    /*
      **Eine TV-Sichtung ist keine Erstausstrahlung, wenn es die Synchro schon gibt**
      (Daniel, 19.09.2026, an „Beyblade X": „wir sagen heute erscheint die erste folge? … warum
      weiß unsere seite nicht das es bereits mindestens 2 staffeln komplett synchronisiert
      gibt?"). Das RTL+-TV-Programm zeigte zwei Sendungen bei TOGGO plus; der automatische
      Import machte daraus „Folge 1 und 2 am 19.09." — ohne Folgennummern, denn das Programm
      nennt keine. Der Kasten nahm den Termin als Antwort, zählte 0 erschienene Folgen und
      blendete deshalb **alle** Stream-Pillen aus (Netflix, Disney+, RTL+). Dasselbe Muster wie
      die Kaufausgabe darunter: Gibt es einen belegten deutschen Stream, ist er die Antwort; die
      Sichtung steht als TV-Pille daneben. Ein Handeintrag (`automatisch` fehlt) bleibt Termin.
    */
    const ohneDisc = releases.filter(
      (r) => r.releaseType !== 'disc' && !imKinoBanner(r) && !(hatSynchro && r.platform === 'tv' && r.automatisch),
    )
    /*
      **Eine Kaufausgabe beantwortet nicht die Frage „wann kommt es".**

      Bei „Code Geass" stand über einem Titel, der seit September 2023 auf
      Deutsch bei Crunchyroll liegt: „In 2 Tagen, 18.09.2026 · Kaufausgabe" —
      während die Pillen im selben Kasten „Crunchyroll · 25 Fg. · 🇩🇪 ✓" zeigten
      (Daniel, 16.09.2026, mit Bild: „der titel ist schon lange erschienen …
      es muss klar sein was gemeint ist, worauf bezieht sich das?"). Der Termin
      gehört zu einer **neuen Blu-ray-Ausgabe**, nicht zur Erstveröffentlichung.

      Der Rückfall auf die Disc bleibt richtig, wo sie wirklich die einzige
      Auskunft ist — also **ohne** belegten deutschen Stream. Gibt es einen,
      ist er die Antwort, und die Kaufausgabe steht als eigene Zeile darunter.
      44 Titel sind betroffen, darunter beide Code-Geass-Staffeln, fünf
      Naruto-Filme und „Mila Superstar".
    */
    const fuerKopf = ohneDisc.length ? ohneDisc : hatSynchro ? [] : releases.filter((r) => !imKinoBanner(r))
    const alleEvents = fuerKopf.flatMap((r) => expandEvents(r))
    const offen = alleEvents.filter((e) => !istErschienen(e))
    /*
      **Eine ausgebliebene Folge mit Ersatztermin steht zweimal da — gezählt wird sie einmal.**

      `expandEvents` führt den verstrichenen Tag weiter (durchgestrichen im
      Kalender) und legt die Folge zusätzlich auf ihren recherchierten neuen
      Termin. Für „noch X bis zum Finale" ist das eine Folge, nicht zwei.
    */
    const kuenftig = offen
      .filter((e) => !istAusgeblieben(e) || !offen.some((o) => o.episode === e.episode && !istAusgeblieben(o)))
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
    /* Eine TV-Sichtung zählt Sendungen, keine Folgen der Serie (Pokémon Horizonte: „Alle 2 Folgen", 16.09.2026). */
    const nurWochen = fuerKopf.every((r) => r.releaseType === 'weekly' && !r.tvLetzteSichtung)
    /*
      **Die Releases kennen die Zählung besser als AniList, solange die Staffel läuft.**
      „Steel Ball Run": AniList führt eine Folge (nur die vorab gezeigte), die
      Releases belegen Folge 1 und 2–12 — im Kasten stand „1 von 1 Folgen
      erschienen" neben „Die Folgen 2 bis 12 im Wochentakt" (Stichprobe 17.09.2026).
      Nur **lückenlos ab Folge 1 aneinandergereihte** Teile zählen, mit belegter
      Stückzahl: Über den Bestand gemessen hätte eine einfache Höchstzahl acht
      Titel verfälscht — ADN-Pakete mit OVAs (Wolf's Rain 30 statt 26) und
      Staffeln mit durchlaufender Zählung (Wistoria 13–24 als „24").
    */
    const teile = fuerKopf
      .filter((r) => r.schedule?.episodeCount && !r.schedule.episodeCountAssumed)
      .map((r) => {
        const von = r.schedule!.firstEpisodeNumber ?? 1
        return { von, bis: von + r.schedule!.episodeCount! - 1 }
      })
      .sort((x, y) => x.von - y.von)
    const aneinander =
      teile.length > 1 && teile[0]!.von === 1 && teile.every((x, i) => i === 0 || x.von === teile[i - 1]!.bis + 1)
    const ausReleases = aneinander ? teile[teile.length - 1]!.bis : 0
    const gesamt =
      Math.max(title.episodes ?? 0, ausReleases) ||
      (nurWochen && alleEvents.length > 1 ? alleEvents.length : undefined)
    /*
      **„Alle N Folgen" nur, wenn alle N belegt sind.**

      Am 07.09.2026 von Daniel gemeldet: „Kill Blue" hat zwölf Folgen, der
      ADN-Verweis trug `dub: true` mit `dubRanges: [{ from: 1, to: 4 }]` — und
      darüber stand **„Alle 12 Folgen auf Deutsch"**. Auf ADN hat Folge 12 nur
      Untertitel; seine Messung ergab 1–8 deutsch, 9–12 nicht.

      **Warum keine vorhandene Prüfung es sah:** `dubLuecken()` sucht Bereiche
      mit `dub: false`. Hier gab es keine — die Folgen 5 bis 12 waren schlicht
      **nicht erfasst**, und die Kopfzeile las nur `dub === true`.

      Nicht erfasst ist nicht dasselbe wie deutsch. Genau diese Unterscheidung
      zieht das Projekt überall sonst („ein unbeantwortetes `undefined` heißt
      ‚wir wissen es nicht'"); in den Bereichen fehlte sie.

      Deckt kein Verweis die Serie vollständig ab, gilt sie als **teilweise**
      synchronisiert — dann zeigt der Kasten die Zahl statt „alle".
    */
    /*
      **Wer Bereiche nennt, hat nachgesehen — wer keine nennt, hat es nicht.**

      Am 07.09.2026 stand über „Kill Blue" zum zweiten Mal an einem Tag „Alle 12
      Folgen auf Deutsch", diesmal aus einer anderen Richtung: Der frisch
      angelegte Crunchyroll-Weg trägt `dub: true` **ohne** `dubRanges` — der
      deutsche Katalog antwortet auf Serienebene und sagt über einzelne Folgen
      nichts. `dubAbdeckung()` liest ein fehlendes Bereichsfeld zu Recht als
      „nichts dagegen bekannt", und damit galt die Serie wieder als vollständig,
      obwohl die ADN-Pille daneben „✕ DE 9–12" trug.

      Zwei Angaben über dieselbe Sache, und die vage überstimmte die gemessene.
      **Sobald überhaupt ein Verweis Bereiche belegt**, entscheiden nur noch
      diese: Sie stammen aus einer Prüfung je Folge, die anderen aus einer
      Angabe über die Serie. Gibt es gar keine Bereiche, bleibt alles wie
      bisher — dann ist „alle" die beste verfügbare Auskunft, und 2.700 Titel
      hängen daran.
    */
    const mitUrteil = (title.streams ?? []).filter((s) => s.dub === true)
    /*
      **Bei einer abgeschlossenen Serie zählt ein Verweis ohne Bereiche wie in der Pille.**
      Die Pille zeigt dort alle Folgen (Regel 4 an `folgenAngabeFuer()`, mit Daniel am
      14.09.2026 abgestimmt); der Kasten ließ ihn weg, sobald ein anderer Verweis Bereiche
      trug, und schrieb „36 von 145" neben „ADN 145 Fg. ✓" (Eyeshield 21, Monster, Death
      Note — Stichprobe 16.09.2026). Die Vorsicht aus Kill Blue gilt weiter für laufende Serien.
    */
    const abgeschlossenFuerKasten = title.jpEnd
      ? title.jpEnd < today
      : Boolean(title.jpYear && title.jpYear < Number(today.slice(0, 4)))
    const belegen =
      mitUrteil.some((s) => s.dubRanges?.length) && !abgeschlossenFuerKasten
        ? mitUrteil.filter((s) => s.dubRanges?.length)
        : mitUrteil
    /*
      Auch Kaufwege mit belegter Spanne zählen — und ein Titel, dessen Synchro nur über
      Sprechrollen belegt ist, gilt als vollständig: Dort ist keine Spanne bekannt, und
      „0 von 100" stand über der Dai-Box mit allen 100 Folgen (16.09.2026).
    */
    const abdeckung = [
      ...belegen.map((s) => dubAbdeckung(s.dubRanges, gesamt)),
      ...(title.watchLinks ?? [])
        .filter((w) => w.dubRanges?.some((r) => r.dub))
        .map((w) => dubAbdeckung(w.dubRanges, gesamt)),
    ]
    if (!abdeckung.length && hatSynchro) abdeckung.push(dubAbdeckung(undefined, gesamt))
    /*
      **Zwei Wege, zwei Hälften — gezählt wird die Vereinigung** (18.09.2026). Prime teilt
      „Berserk" von 1997 in zwei Staffeln; die Pillen zeigten „Fg. 1–13 ✓" und „Fg. 14–25
      ✓", der Kasten „13 von 25 Folgen", weil er je Weg das Maximum nahm. Gezählt wird über
      eine Menge, damit sich überlappende Bereiche zweier Anbieter nicht doppelt zählen.
    */
    const vereint = new Set<number>()
    for (const r of [
      ...belegen.flatMap((s) => s.dubRanges ?? []),
      ...(title.watchLinks ?? []).flatMap((w) => w.dubRanges ?? []),
    ]) {
      if (!r.dub) continue
      for (let n = r.from; n <= Math.min(r.to, gesamt ?? r.to); n++) vereint.add(n)
    }
    const vollstaendig = abdeckung.some((a) => a.vollstaendig) || Boolean(gesamt && vereint.size >= gesamt)
    const belegteFolgen = Math.max(0, vereint.size, ...abdeckung.map((a) => a.belegt))
    /* Sind die übrigen Folgen als „ohne Deutsch" belegt, fehlt keine Angabe (Gundam GQuuuuuuX, Stichprobe 17.09.2026). */
    const restBelegt = mitUrteil.some((s) => {
      const bereiche = s.dubRanges ?? []
      if (!gesamt || !bereiche.some((b) => !b.dub)) return false
      const gedeckt = new Set<number>()
      for (const b of bereiche) for (let n = b.from; n <= Math.min(b.to, gesamt); n++) gedeckt.add(n)
      return gedeckt.size >= gesamt
    })

    /*
      **Kino und Stream eines Films gehören in einen Kasten** (Daniel, 17.09.2026:
      „Meistens kommt Kinofilm wochen vor online streaming, manchmal zeitgleich,
      manchmal streaming zuerst"). Vorher stand über einem Kinostart „Erste Folge
      erscheint … Wöchentlich · 0 von 1 Folgen".
    */
    const filmTermine = () => {
      const start = (r: (typeof releases)[number]) => r.schedule.firstEpisodeDate
      /*
        **Was im Banner steht, steht nicht noch einmal im Kasten** (17.09.2026). „Ab
        29.09.2026 im Kino" stand nach dem Einbau zweimal untereinander.
      */
      const alleKino = releases.filter((r) => r.platform === 'kino' && start(r)).sort((a, b) => start(a)!.localeCompare(start(b)!))
      const imBanner = (r: (typeof releases)[number]) =>
        r.cinemaUntil ? r.cinemaUntil >= today : start(r)! >= addDays(today, -60)
      const kinoRel = alleKino.filter((r) => !imBanner(r))[0]
      const streamRel = releases
        .filter((r) => r.platform !== 'kino' && r.releaseType !== 'disc' && start(r))
        .sort((a, b) => start(a)!.localeCompare(start(b)!))[0]
      if (!kinoRel && !streamRel) return null
      /* Ein Kinostart, der länger als 60 Tage zurückliegt, ist keine Auskunft mehr. */
      if (!streamRel && start(kinoRel!)! < addDays(today, -60)) return null
      return {
        art: 'filmDe' as const,
        kino: kinoRel ? { datum: start(kinoRel)!, raus: start(kinoRel)! <= today } : undefined,
        stream: streamRel
          ? { datum: start(streamRel)!, raus: start(streamRel)! <= today, anbieter: anbieterName(streamRel.platform, streamRel.sender) }
          : undefined,
        streamWege: Boolean(
          (title.streams ?? []).length ||
            (title.watchLinks ?? []).some((w) => w.kind === 'stream'),
        ),
        verleih: kinoRel?.publisher ?? title.kino?.verleih,
        fassung: title.kino?.fassung,
      }
    }
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
        /*
          **Jeder Band mit seinem Termin, nicht nur der nächste.**

          Der Bandname steht in `name` („Banana Fish – Vol. 1"); abgezogen wird
          der Titel selbst, sonst stünde er in jeder Zeile noch einmal. Bleibt
          nichts übrig — bei einer einzelnen Gesamtausgabe der Normalfall —,
          trägt die Zeile nur ihr Datum.
        */
        const eigenerName = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
        const baende = releases
          .flatMap((r) =>
            expandEvents(r).map((e) => ({
              name:
                r.name && r.name !== eigenerName
                  ? r.name.replace(eigenerName, '').replace(/^[\s:–—-]+/, '').trim() || undefined
                  : undefined,
              datum: e.date,
              raus: istErschienen(e),
            })),
          )
          .sort((a, b) => a.datum.localeCompare(b.datum))
        return {
          art: 'disc' as const,
          datum: n.date,
          publisher: quelle?.publisher,
          edition: quelle?.edition,
          baende: baende.length > 1 ? baende : undefined,
        }
      }
      /*
        **„Noch X bis zum Finale" zählt die Ausgabe der nächsten Folge, nicht alle.**
        Dragon Ball DAIMA läuft im TV bis 22.09. und steht ab 25.09. bei RTL+; der
        Kasten nannte „noch 5 bis zum Finale am 25.09." (16.09.2026).
      */
      if (title.format === 'MOVIE' || releases.find((r) => r.slug === n.releaseSlug)?.releaseType === 'movie') {
        const film = filmTermine()
        if (film) return film
      }
      const derselben = kuenftig.filter((e) => e.releaseSlug === n.releaseSlug)
      return {
        art: 'laeuft' as const,
        haupt: n,
        rest: derselben.length,
        raus,
        gesamt,
        letzter: derselben[derselben.length - 1]?.date,
        sendetage: releases.find((r) => r.slug === n.releaseSlug)?.schedule.wochentage,
        sichtung: n.sichtung,
        offenesEnde: Boolean(releases.find((r) => r.slug === n.releaseSlug)?.tvLetzteSichtung),
        verschobenVon: istAusgeblieben(n)
          ? undefined
          : offen.find((o) => istAusgeblieben(o) && o.episode === n.episode)?.date,
        ausgebliebenBis: istAusgeblieben(n) ? ausgebliebenBis(n, kuenftig) : undefined,
        vermerk: istAusgeblieben(n)
          ? n.verpasst
          : offen.find((o) => istAusgeblieben(o) && o.episode === n.episode)?.verpasst,
      }
    }
    if (title.format === 'MOVIE') {
      /*
        **Ein angekündigter Kinofilm bekommt seinen Kinostart statt eines Neins.**

        Daniel am 13.09.2026 zum Apothekerin-Film: Statt „Noch keine deutsche
        Fassung — Kein deutscher Anbieter führt ihn bisher" soll dort stehen,
        wann er in Japan ins Kino kommt, dass der deutsche Termin noch fehlt und
        was der Stern bringt. AniList führt `MOVIE` als Film mit Kinostart.

        Als angekündigt gilt: von Hand recherchiert (`kino`), noch nicht
        erschienen, oder in Japan seit höchstens einem Jahr im Kino. Ein Film,
        der vor Jahren lief und nie nach Deutschland kam, behält das Nein — dort
        wäre „seit 2019 in japanischen Kinos" keine Auskunft, auf die jemand
        wartet.
      */
      /* Läuft der Film gerade in deutschen Kinos und ist noch nicht gestreamt, bleibt es die Kino-Auskunft. */
      const filmDe = !(title.streams ?? []).some((s) => s.dub === true) ? filmTermine() : null
      if (filmDe) return filmDe
      const jp = title.kino?.jp ?? title.jpStart
      const land = title.land ?? 'JP'
      /*
        Mit Termin entscheidet der Termin, nicht AniLists Status: „King Gesar"
        steht dort als angekündigt und lief 2023 in China. Ohne Termin bleibt
        nur der Status.
      */
      const angekuendigt = jp
        ? !jpErschienen(jp, today) || jp >= addDays(today, -365)
        : title.jpStatus === 'NOT_YET_RELEASED' || title.jpStatus === 'RELEASING' || Boolean(title.kino)
      if (!hatSynchro && KINO_LAND[land] && title.kino?.kinofilm !== false && angekuendigt) {
        return {
          art: 'kino' as const,
          jp,
          jpRaus: jp !== undefined && jpErschienen(jp, today),
          land,
          deTermin: title.kino?.deTermin,
          deZeitraum: title.kino?.deZeitraum,
          verleih: title.kino?.verleih,
          fassung: title.kino?.fassung,
        }
      }
      /*
        „Kein deutscher Anbieter führt ihn" nur ohne jeden Weg — Digimon tri. 5 hat sechs
        Kaufangebote (Stichprobe 17.09.2026). Und nicht unter einem Kino-Banner: Dort steht
        der Anbieter, es ist das Kino (Madoka, 17.09.2026).
      */
      const imKino = releases.some(
        (r) =>
          r.platform === 'kino' &&
          (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60)),
      )
      const ohneWeg = !(title.streams ?? []).length && !(title.watchLinks ?? []).length && !imKino
      return { art: 'film' as const, hatSynchro, raus, gesamt, ohneWeg, imKino }
    }
    if (hatSynchro && !vollstaendig && gesamt) {
      /*
        Teilweise synchronisiert: Der Kasten nennt die belegte Zahl statt „alle".
        `laeuft` ist der Zustand, der genau das kann — er zeigt „x von y".
      */
      return { art: 'teilweise' as const, raus: belegteFolgen, gesamt, restBelegt }
    }
    if (hatSynchro || titleStatus(releases, today, title) === 'erschienen') {
      return { art: 'fertig' as const, raus: raus || gesamt, gesamt }
    }
    return { art: 'ohne' as const, gesamt }
    // `today` steht in der Abhängigkeitsliste, weil `titleStatus` es benutzt.
  }, [title, releases, today])

  /*
    **Der Disc-Termin, den der Kopf nicht mehr trägt.**

    Nur wenn die Antwort oben aus den Streams kommt (also kein Disc-Zustand
    ist) und es wirklich eine künftige Kaufausgabe gibt. Sonst stünde die Zeile
    neben einer Überschrift, die dasselbe Datum schon nennt.
  */
  const kaufausgabeZeile = useMemo(() => {
    if (!title || antwort?.art === 'disc') return undefined
    const naechste = releases
      .filter((r) => r.releaseType === 'disc' && (r.schedule?.firstEpisodeDate ?? '') > today)
      .sort((a, b) => (a.schedule?.firstEpisodeDate ?? '').localeCompare(b.schedule?.firstEpisodeDate ?? ''))[0]
    if (!naechste?.schedule?.firstEpisodeDate) return undefined
    const label = naechste.publisher ?? naechste.edition
    const datum = formatDate(naechste.schedule.firstEpisodeDate)
    return label
      ? t('antwort.kaufausgabeAm', { datum, label })
      : t('antwort.kaufausgabeAmOhne', { datum })
  }, [title, releases, today, antwort, t])

  /**
   * Zeigt der Kasten oben eine Faktenzeile statt eines Balkens?
   *
   * Dann stehen Jahr, Altersfreigabe und Studio bereits dort, und die
   * Werkangaben weiter unten lassen sie weg.
   */
  /*
    **Kein Weg bekannt — der Satz steht jetzt im Kasten.**

    Die Bedingung ist dieselbe wie im früheren Abschnitt „WO LÄUFT ES", nur
    ihr Ort hat sich geändert. Vier Ausschlüsse gehören dazu, jeder mit
    eigenem Anlass:

    - **Es gibt Wege** — dann sagen die Pillen alles.
    - **Kein Titel ohne deutsche Fassung** (Daniel, 01.09.2026): Oben steht
      dann schon „Noch keine deutsche Fassung", und ein zweites Nein liest
      sich wie eine eigene Feststellung. Sind Sprechrollen belegt, bleibt der
      Satz — dort sagt er etwas anderes.
    - **Kein laufender Kinofilm** (Daniel, 25.08.2026, „Detektiv Conan Film
      29" lief in 36 Städten): Der Anbieter ist dann das Kino, und der Termin
      steht darüber. Entschieden wird am belegten letzten Spieltag, nicht an
      einer geschätzten Laufzeit.
  */
  /*
    **Bei einem angekündigten Kinofilm steht dort, was der Stern bringt.**
    „Kein Anbieter bekannt" ist bei einem Film, der noch gar nicht erschienen
    ist, keine Auskunft — die Frage des Lesers ist, wann er ihn sehen kann.
  */
  const wegeHinweis =
    title && antwort?.art === 'kino'
      ? /*
          Steht der deutsche Kinostart schon fest (dann ohne Synchro, sonst wäre
          es ein Release), wartet der Stern auf die deutsche Fassung.
        */
        antwort.deTermin
        ? favorites.has(title.id)
          ? t('antwort.kinoGemerktFassung')
          : verbindung.verbunden
            ? t('antwort.kinoMerkenFassungMail', { mail: verbindung.mail ?? '' })
            : t('antwort.kinoMerkenFassung')
        : favorites.has(title.id)
          ? t('antwort.kinoGemerkt')
          : verbindung.verbunden
            ? t('antwort.kinoMerkenMail', { mail: verbindung.mail ?? '' })
            : t('antwort.kinoMerken')
      : title &&
    title.streams.length === 0 &&
    (title.watchLinks?.length ?? 0) === 0 &&
    (title.hasVoices || antwort?.art !== 'ohne') &&
    /* Ein Film ohne Synchro sagt „Kein deutscher Anbieter führt ihn bisher" schon im Kasten (Stichprobe 17.09.2026). */
    !(antwort?.art === 'film' && !antwort.hatSynchro && !title.hasVoices) &&
    !releases.some(
      (r) =>
        r.platform === 'kino' &&
        (r.cinemaUntil
          ? r.cinemaUntil >= today
          : (r.schedule?.firstEpisodeDate ?? '') >= today),
    )
      ? t(title.hasVoices ? 'detail.whereDubbedButGone' : 'detail.whereUnknown')
      : undefined

  /*
    **Welche Notiz gilt?** Die des Releases, dessen Termin oben steht.

    Bei mehreren Releases je Titel ist das der nächste künftige, sonst der
    zuletzt erschienene — dieselbe Wahl, die der Kasten für sein Datum trifft.
  */
  const kastenNotiz = useMemo(() => {
    const mitNotiz = releases.filter(
      (r) =>
        r.note &&
        /* Die Notiz des Kinostarts steht im Banner darüber. */
        !(r.platform === 'kino' && (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60))),
    )
    if (!mitNotiz.length) return undefined
    const kuenftig = mitNotiz
      .filter((r) => (r.schedule?.firstEpisodeDate ?? '') >= today)
      .sort((a, b) => (a.schedule?.firstEpisodeDate ?? '').localeCompare(b.schedule?.firstEpisodeDate ?? ''))
    const vergangen = mitNotiz
      .filter((r) => (r.schedule?.firstEpisodeDate ?? '') < today)
      .sort((a, b) => (b.schedule?.firstEpisodeDate ?? '').localeCompare(a.schedule?.firstEpisodeDate ?? ''))
    return kuenftig[0] ?? vergangen[0]
  }, [releases, today])

  /*
    **Welche Folgen bei keinem bekannten Anbieter liegen.** Die Dai-DVD-Box enthält 1–75,
    die Serie hat 100 Folgen; ohne diese Zeile blieb offen, wo 76–100 zu sehen sind
    (Daniel, 16.09.2026). Gezählt werden **alle** Wege; einer ohne Bereiche — eine
    aniSearch-Ausgabe, ein Stream mit „DE ?" — kann die fehlenden Folgen enthalten und
    gilt deshalb als vollständig. So stand „76–100 bei keinem Anbieter", während
    aniSearch vier Blu-ray-Boxen und ein Komplettset führte (Daniel, mit Bild).
  */
  const folgenLuecke = useMemo(() => {
    if (!title || title.format === 'MOVIE') return null
    /*
      Ein Anbieter mit laufendem deutschen Wochenplan führt jede erschienene Folge — sein
      Dub-Bestand hinkt nur hinterher. Black Torch: Bestand „1–10", Folge 11 seit dem
      12.09. im Plan, und im Kasten stand „Für Folgen 11 kennen wir keinen deutschen
      Anbieter" (Stichprobe 17.09.2026). Ein solcher Weg gilt wie einer ohne Bereiche.
    */
    const laufendBei = (plattform: string): boolean => {
      const r = releaseJePlattform.get(plattform)
      return r?.releaseType === 'weekly' && releaseStatus(r, today) === 'airing'
    }
    const wege = [
      ...(title.streams ?? []).map((s) => (s.dub === true && !laufendBei(s.platform) ? s.dubRanges : undefined)),
      ...(title.watchLinks ?? []).map((w) => w.dubRanges),
    ]
    /*
      Bei einer laufenden Serie zählt nur, was erschienen ist — „Folgen 11–12 führt kein
      Anbieter" stand über „Vom Landei zum Schwertheiligen II", deren Folge 11 heute kommt
      (Daniel, 16.09.2026).
    */
    /* Im Teilweise-Zustand sagt der Kasten es schon („Für die übrigen fehlt uns eine Angabe"). */
    if (antwort?.art === 'teilweise') return null
    const gesamt = antwort?.art === 'laeuft' ? antwort.raus : title.episodes
    return folgenOhneAnbieter(wege, gesamt)
  }, [title, antwort, releaseJePlattform, today])
  const faktenImKasten = antwort?.art === 'film' || antwort?.art === 'disc'

  /** Die vier Werkangaben der Unterzeile — leer heißt: kein Kasten. */
  const unterzeile = !title
    ? []
    : [
        title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
        title.episodes && title.episodes > 1
          ? `${title.episodes} ${t('detail.episodes')}`
          : undefined,
        jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
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
    /*
      **Eine Staffel schlägt einen Film — auch einen neueren.**

      Bei „Black Clover" Staffel 2 stand als Ersatz die Handlung von „Sword of
      the Wizard King" (2023), weil der Film jünger ist als Staffel 1 (2017).
      Daniel hatte aber „die handlung der zuletzt erschienenen **staffel**"
      verlangt, und das ist auch die brauchbarere Auskunft: Ein Film erzählt
      eine abgeschlossene Nebengeschichte, die Serie den Strang, den eine
      Fortsetzung aufnimmt.
    */
    const vorher = reihenTeile
      .filter((m) => m.id !== titleId && (m.jpYear ?? 9999) <= (title?.jpYear ?? 9999))
      .sort(
        (a, b) =>
          Number(istStaffel(b.format)) - Number(istStaffel(a.format)) ||
          (b.jpYear ?? 0) - (a.jpYear ?? 0) ||
          b.id - a.id,
      )
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
          <span className="font-normal text-slate-500 dark:text-slate-400">{title.scoreQuelle === 'tmdb' ? 'TMDB' : 'AniList'}</span>
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
    /*
      **`overscroll-contain`: Am Ende des Panels hört das Scrollen auf.**

      Ohne die Klasse reicht der Browser das Rad an die Seite dahinter weiter,
      sobald das Panel unten angekommen ist — der Kalender scrollte weg, während
      das Panel offen stand (Daniel, 16.09.2026: „wenn maus auf detailpanel, dann
      darf scrollen nur fürs detail panel gelten"). Dieselbe Klasse trägt die
      zweite Panel-Hülle.

      **Die inneren Rollbereiche tragen sie ausdrücklich nicht** (Pillenreihe,
      Reihenliste). Der erste Anlauf gab sie ihnen mit — und damit stand das Rad
      still, sobald die Maus über „Teile dieser Reihe" war: Am Ende der Liste
      soll das **Panel** weiterscrollen, nur die Seite dahinter nicht. Daniel
      eine halbe Stunde später: „maus in ‚teile dieser reihe'-box, scrollen nach
      oben führt nicht dazu, dass das detail panel scrollt."

      Die Grenze liegt also genau eine Ebene höher, als sie zuerst gezogen war:
      zwischen Panel und Seite, nicht zwischen Liste und Panel.
    */
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
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
        <div
          className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col justify-center gap-4 border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
          role="dialog"
          data-panel="titel"
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
        </div>
      </>
    )
  }


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
      <div
        /*
          Von `max-w-md` (28 rem) auf `max-w-lg` (32 rem) — vier Rem mehr
          (Daniel, 15.08.2026: „evtl die gesamte card paar pixel breiter").

          Der Gewinn ist kein Selbstzweck: Die Terminzeilen tragen jetzt Datum,
          Ausgabe und Aktion **nebeneinander**. Bei 28 rem brach die Aktion in
          eine eigene Zeile um, und aus einer Zeile je Ausgabe wurden zwei —
          genau die Platzverschwendung, die verschwinden sollte. Auf schmalen
          Schirmen greift weiterhin `w-full`, dort ändert sich nichts.
        */
        className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto overscroll-contain border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        data-panel="titel"
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
                jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
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
            {/*
              **Der aniSearch-Verweis steht rechts in derselben Zeile.**

              Daniel am 07.09.2026: „hier im grün markierten bereich wäre platz
              für ein AniSearch Link. mach das" — und gleich danach der
              Geltungsbereich: „anisearch link für alle titel dort einfügen wo
              wir anisearch links haben, ansonsten anisearch search seite mit dem
              titel da einfügen. überall soll da ein link sein."

              Deshalb wird die Zeile jetzt **immer** gerendert, nicht mehr nur
              bei einem Reihenteil mit eigenem Namen. Der Staffelname darin folgt
              weiter seiner alten Bedingung; ohne ihn bleibt eine Zeile aus
              Wertung links und Verweis rechts — beides Angaben, die vorher
              entweder gar nicht oder nur an einer Stelle standen.
            */}
            <div className="flex flex-wrap items-baseline gap-2">
              {bewertung}
              {reihenTeile.length > 1 && teilName !== reihenName && (
                <h3 className="min-w-0 flex-1 text-xl font-bold leading-tight text-slate-900 dark:text-white">
                  {teilName}
                </h3>
              )}
              {/*
                **Der Trailer steht bei den Angaben zum Werk, nicht bei den
                Anbietern.** Er beantwortet eine andere Frage als „wo kann ich
                das sehen" — nämlich „will ich das überhaupt".
              */}
              {(title.trailer || kinoRelease) && <TrailerKino trailer={title.trailer} titel={anzeigeName(title)} />}
              <AniSearchVerweis title={title} />
            </div>
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
          {title && kinoRelease && (
            <KinoBanner release={kinoRelease} title={title} today={today} t={t as never} />
          )}
          {/*
            **Der Banner trägt die Auskunft — dann schweigt der Kasten** (17.09.2026).
            Über „Ab 24.11.2026 im Kino" stand „Noch keine deutsche Fassung · Kein deutscher
            Anbieter führt ihn bisher": zwei Sätze, die einander widersprechen. Wo es außer
            dem Kinostart nichts zu sagen gibt, bleibt es beim Banner.
          */}
          {antwort && (
            <AntwortKasten
              pillenGruppen={
                new Map([
                  ...sortiertNachZugang.flatMap(({ art, plattformen, streamWege }) =>
                    [
                      ...plattformen.map((x) => `${x.platform}|${x.url}`),
                      ...streamWege.map((g) => `sw-${g.shop}-${g.eintraege[0].url}`),
                    ].map((k) => [k, art === 'kostenlos' ? 'frei' : art] as const),
                  ),
                  ...streamReleases.map((r) => [r.slug, r.platform === 'tv' ? 'tv' : 'abo'] as const),
                ])
              }
              antwort={antwort}
              title={title}
              t={t}
              today={today}
              wegeHinweis={wegeHinweis}
              notiz={kastenNotiz?.note}
              schnitt={kastenNotiz?.schnitt}
              angebotSeit={
                /* Nennt die Erstausgabe denselben Anbieter früher, ist das spätere Angebot keine
                   Auskunft mehr („Auf Deutsch seit 28.12.2023 · Netflix, Inc." über „Bei Netflix im
                   Angebot seit 08.03.2024", Pokémon-Concierge, Stichprobe 16.09.2026). */
                title.angebotSeit &&
                !(
                  title.deErstausgabe?.von &&
                  title.deErstausgabe.von <= title.angebotSeit.date &&
                  (title.deErstausgabe.publisher ?? '').toLowerCase().includes((PLATFORMS[title.angebotSeit.platform]?.name ?? '§').toLowerCase())
                )
                  ? t('antwort.imAngebotSeit', {
                      datum: formatDate(title.angebotSeit.date),
                      anbieter: PLATFORMS[title.angebotSeit.platform]?.name ?? title.angebotSeit.platform,
                    })
                  : undefined
              }
              kaufausgabe={kaufausgabeZeile}
              hinweis={
                folgenLuecke ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {t(/^\d+$/.test(folgenLuecke) ? 'detail.folgeOhneAnbieter' : 'detail.folgenOhneAnbieter', { bereich: folgenLuecke })}
                  </p>
                ) : /* Beim Kinofilm sagt der Kino-Hinweis darunter dasselbe (Daniel, 17.09.2026: „doppelte info"). */
                title.ohneSynchro && antwort?.art !== 'kino' ? (
                  <>
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
                  </>
                ) : undefined
              }
                /*
                  **Stream ist, wo man es ansehen kann.** Die Zugangsart
                  (kostenlos, Abo, Kauf) stand bis zum 03.09.2026 als eigene
                  Zwischenüberschrift darüber; sie steht jetzt an der Pille
                  selbst, wo sie hingehört — drei Überschriften über je einer
                  Pille waren mehr Gliederung als Inhalt.
                */
                stream={sortiertNachZugang.flatMap(({ plattformen }) =>
                  plattformen.map((s) => {
                    /*
                      **Was da ist, nicht was fehlt.**

                      Der Verlag hat von „Date a Live" genau Folge 1 auf YouTube
                      (Daniel, 07.09.2026: „schreib auch das es nur diese ep
                      unter diesem verweis gibt, sodass kein falscher eindruck
                      entsteht"). `dubLuecken` machte daraus „✕ DE 2–12" —
                      richtig, aber von hinten gedacht: Wer die Pille sieht, will
                      wissen, was er bekommt, nicht was ihm fehlt.

                      Der Fall ist eng gefasst — **ein** deutscher Bereich, und
                      der ist Folge 1. Alles Übrige bleibt bei der Lücken-Form,
                      die dort die kürzere Auskunft ist.
                    */
                    /* Regeln an `folgenAngabeFuer()` — Film, Bereiche, laufend, abgeschlossen. */
                    const folgenAngabe = folgenAngabeFuer(s)
                    return (
                      <Pille
                        /*
                          Anbieter **und** Adresse (21.09.2026): Mit `key={s.platform}` trugen zwei
                          Prime-Pillen denselben Schlüssel, und beim Umschalten auf „Disc" blieb eine
                          als verwaister Knoten stehen — Lupin III. Part 6 zeigte die Kanal-Pille
                          unter „Disc" (Daniel mit Bild: „das ist keine disc").
                        */
                        key={`${s.platform}|${s.url}`}
                        name={s.kanal ? `${PLATFORMS[s.platform].name} (${s.kanal})` : PLATFORMS[s.platform].name}
                        farbe={PLATFORMS[s.platform].color}
                        icon={<AnbieterIcon was={s.platform} />}
                        url={s.url}
                        unten={
                          [
                            folgenAngabe,
                            s.teilBereich
                              ? t('detail.teilBereich', { von: s.teilBereich.von, bis: s.teilBereich.bis })
                              : '',
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
                            ...dubZeilen(s),
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
                            .join('\n') || undefined
                        }
                        rechts={
                          <>
                            <DubEcke dub={s.dub} />
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
                  /*
                    **Zwei Ausgaben derselben Staffel — die ohne Deutsch steht
                    daneben, durchgestrichen.**

                    Daniel am 14.09.2026 an Digimon: Prime führt die Serie „In
                    Prime enthalten" mit deutscher Synchro und über den
                    Crunchyroll-Kanal nur mit Untertiteln. Wer bei Prime sucht,
                    findet beide; die Pille sagt, welche es nicht ist, statt sie
                    zu verschweigen („sodass nutzer sich selbst ein bild machen
                    können"). Welche Ausgaben es gibt, entscheidet der Bau
                    (`ausgabenOhneDe`).
                  */
                  .concat(
                    (title.ausgabenOhneDe ?? []).map((a) => (
                      <Pille
                        key={`ausgabe-${a.url}`}
                        name={PLATFORMS[a.platform]?.name ?? a.platform}
                        farbe={PLATFORMS[a.platform]?.color}
                        url={a.url}
                        durchgestrichen
                        unten={[
                          a.kanal ? t('detail.ausgabeKanal', { kanal: a.kanal }) : t('detail.ausgabeAndere'),
                          t(a.untertitelDe ? 'detail.ausgabeNurUt' : 'detail.ausgabeOhneDe'),
                        ].join(' · ')}
                        titel={t('detail.ausgabeTitel', { anbieter: PLATFORMS[a.platform]?.name ?? a.platform })}
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
                          /*
                            **Dasselbe Zeichen wie am Verweis mit derselben Adresse.**

                            Daniel am 07.09.2026 an „Kill Blue": „warum ist bei
                            ‚… über prime' pills kein ‚DE' zeichen?" Die Pille
                            „Aniverse über Prime Video" und der Prime-Verweis
                            zeigen auf dieselbe Kennung — der eine trug „DE ✓",
                            die andere nichts.

                            Das Urteil erbt der Bezugsweg beim Bauen (`build.ts`,
                            „Ein Weg, ein Urteil"); hier wird es nur angezeigt.
                            Wo keins geerbt wurde, zeigt `DubMark` weiterhin das
                            Fragezeichen — das ist die ehrliche Antwort.
                          */
                          /*
                            **Ein Weg zu einem Anbieter, den wir kennen, sieht aus wie einer.**

                            Die Bezugswege standen weiß und randlos neben den
                            farbigen Anbieter-Pillen, obwohl beide dasselbe
                            beantworten: wo man es sehen kann. Daniel am
                            07.09.2026: „vom blau gefärbten button style ist es
                            deutlich besser als die weiße pill daneben, deshalb
                            mach das so wie beschrieben für alle pills die
                            aktuell noch das weiße style haben".

                            Die Farbe kommt aus dem Namen, und der ist unsere
                            eigene Erzeugung („Amazon Prime
                            (Crunchyroll)"): Wo er mit dem Namen einer bekannten
                            Plattform beginnt, gilt deren Farbe. Ein Shop, den
                            wir nicht als Plattform führen (Videobuster,
                            maxdome), bleibt neutral — dort gibt es keine Farbe,
                            die etwas bedeuten würde.
                          */
                          farbe={farbeZuAnbieter(g.shop)}
                          icon={g.shop === 'aniSearch' ? <DiscZeichen /> : <AnbieterIcon was={g.shop} />}
                          /*
                            **Ein Weg zu einer einzelnen Folge sagt das.**

                            Bei „Banana Fish" führt die Akibapass-Pille auf eine
                            Dub-Vorschau der ersten Folge, und daneben stand als
                            Termin der 06.11.2026 — der zweite Blu-ray-Band.
                            Beides zusammen las sich, als gäbe es bis November
                            gar nichts (Daniel, 12.09.2026: „folge 1 jetzt, rest
                            06.11."). Die Angabe steht am Weg, weil sie zu ihm
                            gehört, nicht zum Titel.
                          */
                          /*
                            **Eine Folgenzahl nur, wo die deutsche Fassung an diesem Weg belegt ist.**

                            „Amazon Prime (Crunchyroll) · 100 Fg." stand über „Dragon Quest: The
                            Adventure of Dai" — der Kanal führt die Serie nur auf Japanisch (Daniel,
                            16.09.2026, mit Bild; Crunchyrolls deutscher Katalog: 0 von 101 Folgen
                            deutsch). Die Zahl stammte aus der Titelregel von `folgenAngabeFuer()`,
                            die für Verweise mit `dub: true` gemessen war und hier ohne jeden Verweis
                            griff. 160 Titel zeigten so eine Stream-Pille mit Folgenzahl, ohne dass
                            dort Deutsch belegt war.

                            Ohne Urteil also keine Zahl — und rechts das Zeichen, das der Kommentar
                            darüber schon lange versprach: „DE ?", die ehrliche Antwort.
                          */
                          unten={(() => {
                            if (istToggo(g.eintraege[0].url))
                              return toggoAngabe((title.watchLinks ?? []).find((w) => w.url === g.eintraege[0].url)?.toggo)
                            if (g.eintraege[0].nurFolge) return t('detail.nurFolge', { n: g.eintraege[0].nurFolge })
                            if (g.eintraege[0].dubRanges?.length) return folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges, url: g.eintraege[0].url, nurFolge: g.eintraege[0].nurFolge }) || undefined
                            const verweis = (title.streams ?? []).find((x) => x.url === g.eintraege[0].url)
                            return verweis?.dub === true ? folgenAngabeFuer(verweis) || undefined : undefined
                          })()}
                          rechts={
                            <DubEcke
                              dub={
                                istToggo(g.eintraege[0].url) ||
                                g.eintraege[0].dubRanges?.some((r) => r.dub) ||
                                (title.streams ?? []).find((x) => x.url === g.eintraege[0].url)?.dub
                              }
                            />
                          }
                        />
                      )),
                    ),
                  )
                  .concat(
                    streamReleases.map((r) => (
                      <ReleasePille
                        key={r.slug}
                        release={r}
                        titel={anzeigeName(title)}
                        today={today}
                        tvText={tvAngabe(r, title, releases, today, jetztBerlin().slice(11, 16))}
                      />
                    )),
                  )}
                /*
                  **Disc ist, was man kauft** — Händler und Vorbestellungen.
                  Vier Ausgaben desselben Verlags sind **eine** Auskunft, keine
                  vier (Daniel, 20.08.2026): eine Pille je Shop, die Zahl der
                  Ausgaben in der zweiten Zeile.
                */
                disc={[
                  /* Die aniSearch-Ausgaben ersetzen die eine aniSearch-Pille, sobald sie geladen sind. */
                  ...discPillen(discAusgaben, discOffen, () => setDiscOffen((o) => !o), t as unknown as (k: string, v?: Record<string, string | number>) => string),
                  ...sortiertNachZugang.flatMap(({ shops }) =>
                    shops
                      .filter((g) => !(g.shop === 'aniSearch' && discAusgaben.length))
                      .map((g) => (
                      <Pille
                        key={g.shop + g.eintraege[0].url}
                        name={g.shop}
                        url={g.eintraege[0].url}
                        unten={
                          g.eintraege.length > 1
                            ? t('where.angebote', { count: g.eintraege.length })
                            : g.eintraege[0].dubRanges?.length
                              ? folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges }) || undefined
                              : undefined
                        }
                        rechts={g.eintraege[0].dubRanges?.some((r) => r.dub) ? <DubEcke dub /> : undefined}
                        /*
                          Auch hier trägt der Weg die Farbe seines Anbieters —
                          derselbe Grund wie bei den Stream-Wegen darüber. Für
                          aniSearch kommt die Silberscheibe dazu: Sie ersetzt
                          das Wort „Disc", das bis zum 07.09.2026 im Namen stand.
                        */
                        farbe={farbeZuAnbieter(g.shop)}
                        icon={anbieterDatei(g.shop) ? <AnbieterIcon was={g.shop} /> : <DiscZeichen />}
                      />
                    )),
                  ),
                  ...discReleases.map((r) => (
                    <ReleasePille key={r.slug} release={r} titel={anzeigeName(title)} today={today} />
                  )),
                ]}
            />
          )}
          {discOffen && discAusgaben.length > 0 && <DiscEinzelListe ausgaben={discAusgaben} />}
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
                  /*
                    **AniList sagt es selbst, wo wir bisher gerechnet haben.**

                    Der Jahresvergleich ist eine Ableitung und irrt am
                    Jahreswechsel in beide Richtungen. `NOT_YET_RELEASED` ist
                    dagegen eine Auskunft — für „Lord of the Mysteries 2" steht
                    dort 2027 und genau dieser Status (Daniel, 12.09.2026: „2027
                    release date ankündigung fehlt, und sollte entsprechend
                    gekennzeichnet werden, das es noch nicht erschienen ist und
                    noch erscheint"). Der Vergleich bleibt als Rückfall für
                    Einträge ohne Status.
                  */
                  const kuenftig = (m: FranchiseMember) =>
                    m.jpStatus === 'NOT_YET_RELEASED' ||
                    (m.jpStatus !== 'FINISHED' &&
                      ((m.jpYear ?? 0) > jahr || (Boolean(m.ohneSynchro) && (m.jpYear ?? 0) >= jahr)))
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
                  /*
                    **Und bei chinesischen Produktionen entscheidet das Format
                    gar nichts.** Dort ist jeder Teil eine ONA — Serie, Specials
                    und Chibi-Kurzfilme gleichermaßen. Bei „Lord of Mysteries"
                    standen deshalb alle vier Teile unter „Hauptserie" (Daniel,
                    12.09.2026: „they are specials and categorized as
                    hauptserie").

                    AniList sagt es trotzdem: Ein Special nennt die Serie, zu
                    der es gehört (`PARENT`), eine Staffel tut das nicht. Der
                    Bau reicht das als `beiwerk` durch.
                  */
                  const hauptIds = new Set(hauptstaffeln(reihenTeile).map((m) => m.id))
                  const istHauptstaffel = (m: FranchiseMember) => hauptIds.has(m.id)
                  /*
                    **Was noch nicht da ist, gehört trotzdem zu seiner Art.**

                    Bis zum 04.09.2026 gab es dafür eine vierte Gruppe, „NOCH
                    NICHT ERSCHIENEN", ganz unten. Bei „Black Clover" stand
                    Staffel 2 damit **unter** zwei Specials und einem Film —
                    Daniel sah sie erst nach dem Scrollen und hielt sie für
                    fehlend: „ich hab staffel 2 nicht gesehen unter hauptserie
                    … keine seperate kategorie ,noch nicht erschienen', sondern
                    direkt dort einsortieren wozu es gehört."

                    Er hat recht, und zwar nicht nur für diesen Fall: Wer eine
                    Reihe aufschlägt, sucht die nächste Staffel — und die ist
                    per Definition die, die noch aussteht. Sie ans Ende aller
                    Kategorien zu schieben versteckt genau das, wonach gesucht
                    wird.

                    Innerhalb einer Kategorie stehen die künftigen Teile hinten,
                    nach Jahr sortiert. Als **gestrichelt** bleiben sie erkennbar
                    — das war ohnehin die Zeilenmarkierung, nicht die Überschrift.
                  */
                  const nachStandUndJahr = (a: FranchiseMember, b: FranchiseMember) =>
                    Number(kuenftig(a)) - Number(kuenftig(b)) || nachJahr(a, b)
                  const gruppen: { titel: string; teile: FranchiseMember[] }[] = [
                    {
                      titel: t('detail.gruppeStaffeln'),
                      teile: reihenTeile.filter(istHauptstaffel).sort(nachStandUndJahr),
                    },
                    /* Filme vor Specials (Daniel, 04.09.2026): Ein Film ist ein
                       eigenständiges Werk der Reihe, ein Special ist Beiwerk. */
                    {
                      titel: t('detail.gruppeFilme'),
                      teile: reihenTeile.filter((m) => m.format === 'MOVIE').sort(nachStandUndJahr),
                    },
                    {
                      titel: t('detail.gruppeSpecials'),
                      teile: reihenTeile
                        .filter((m) => !istHauptstaffel(m) && m.format !== 'MOVIE')
                        .sort(nachStandUndJahr),
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
                  /* Seit dem 13.09.2026 zählt `staffelBeschriftungen()` — auch „Teil 2" gehört zu seiner Staffel. */
                  const staffelLabel = staffelBeschriftungen(reihenTeile.filter(istHauptstaffel), reihenName)

                  const zeile = (m: FranchiseMember, offen: boolean) => {
                    const gewaehlt = m.id === title.id
                    const gemerkt = favorites.has(m.id)
                    /* `offen` heißt hier „noch nicht erschienen" — dort ist eine fehlende Synchro kein Befund. */
                    const ohneDe = Boolean(m.ohneSynchro) && !offen
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
                    /*
                      **Und nur bei einer Hauptstaffel.**

                      Unter „Specials & OVAs" stand „Staffel 2" — der Eintrag ist
                      aber „Maomao no Hitorigoto Staffel 2", die zweite Staffel
                      einer Mini-Serie, nicht die der Hauptserie (Daniel,
                      12.09.2026: „solche staffel bezeichnungen dürfen nur bei
                      hauptserie einzeln so aufgelistet sein … Maomao no
                      Hitorigoto Staffel 2 müsste da stehen").

                      Die Kürzung lebt davon, dass die Reihe eine Zeile höher
                      steht — und das trägt nur für die Hauptserie. Beim Beiwerk
                      gehört der fremde Reihenname dazu: Er ist gerade das, was
                      den Eintrag von der Hauptserie unterscheidet.
                    */
                    const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
                    if (istHauptstaffel(m) && staffelTeil && rest === voll && rest !== staffelTeil[1]) rest = staffelTeil[1]!
                    /* Und die erste Staffel heißt „Staffel 1", ein Teil „Staffel 1 - Teil 2". */
                    const beschriftung = (istHauptstaffel(m) && staffelLabel.get(m.id)) || rest || voll
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
                          /*
                            **Eine Zeile je Teil, nicht zwei.**

                            Gemessen am 04.09.2026: 70 px je Zeile, davon 26 px
                            Luft — das Cover (40×56) gab die Höhe vor, der Text
                            brauchte 37. Bei 216 px sichtbarer Höhe waren das
                            drei Teile; eine Reihe mit acht sah nach dreien aus.

                            Titel und Angaben stehen jetzt nebeneinander statt
                            untereinander, das Cover ist auf 24×36 gekürzt: 44 px
                            je Zeile, fünf statt drei sichtbar.
                          */
                          'flex w-full items-center gap-2 rounded-lg border p-1 text-left transition',
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
                            'block h-9 w-6 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-white/5',
                            offen ? 'opacity-60' : '',
                          ].join(' ')}
                        >
                          {m.cover && (
                            <img
                              {...coverBild(m.cover, 24)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-2">
                          {/*
                            **Ohne deutsche Synchro steht vor dem Namen, nicht dahinter** (Daniel,
                            23.09.2026: „dieser in der reihe hat keine synchro, das muss sichtbar sein
                            bevor man ihn anklickt"). „Super Dragon Ball Heroes" sah in der Reihe von
                            Dragon Ball Super aus wie jeder andere Teil; den Unterschied erfuhr man
                            erst nach dem Klick.

                            Vier Entwürfe an der echten Liste, Daniels Wahl: Rot mit Fahne und Kreuz,
                            dazu der gedämpfte Name. Rot heißt auf dieser Seite sonst „Fehler" — hier
                            heißt es „gibt es nicht auf Deutsch", und genau das ist die Auskunft, um
                            die es geht.

                            Künftige Teile tragen es nicht: Bei ihnen steht „ab <Datum>", und eine
                            fehlende Synchro ist dort kein Befund, sondern der Normalzustand.
                          */}
                          {ohneDe && (
                            <span
                              title={t('detail.reiheOhneSynchro')}
                              className="shrink-0 rounded border border-rose-400/50 bg-rose-500/15 px-1.5 py-px text-[9px] font-extrabold leading-tight tracking-wider text-rose-600 dark:text-rose-400"
                            >
                              🇩🇪 ✕
                            </span>
                          )}
                          <span
                            className={[
                              'min-w-0 truncate text-sm leading-tight',
                              ohneDe ? 'opacity-75' : '',
                              gewaehlt
                                ? 'font-medium text-sky-700 dark:text-sky-300'
                                : 'text-slate-700 dark:text-slate-200',
                            ].join(' ')}
                          >
                            {beschriftung}
                          </span>
                          {/* Rechts, damit der Titel den ganzen übrigen Platz bekommt —
                              „2026 · 12 Fg." ist immer kurz, ein Titel selten. */}
                          <span className="ml-auto shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                            {[
                              m.format && m.format !== 'TV' ? (FORMAT_DE[m.format] ?? m.format) : '',
                              /*
                                **Der Termin schlägt das Jahr — wo es einen gibt.**

                                Bei „Lord of Mysteries" stand hinter drei von vier
                                Teilen nur das Format: kein Jahr, kein Datum
                                (Daniel, 12.09.2026: „why important info like
                                release dates or estimated release dates are
                                missing"). AniList kennt für die Specials den
                                19.06.2026; seit dem 12.09.2026 holt der
                                Katalogabruf `startDate` mit.

                                Angezeigt wird so genau, wie die Quelle ist:
                                „2026", „06.2026" oder „19.06.2026".
                              */
                              (() => {
                                /*
                                  **Was noch aussteht, sagt es mit einem Wort.**
                                  Eine gestrichelte Linie allein hat Daniel am
                                  12.09.2026 nicht genügt; „ab 2027" beantwortet
                                  die Frage, ohne eine Zeile zu kosten.
                                */
                                /*
                                  **Hier steht der deutsche Termin oder gar
                                  keiner.**

                                  Bis zum 12.09.2026 stand die japanische
                                  Ausstrahlung da — erst nackt, dann als
                                  „JP 02.10.2026", weil der Kasten darüber den
                                  deutschen 01.10. nannte und niemand den
                                  Unterschied sah. Daniels Antwort auf die
                                  Kennzeichnung: „jp release dates sind fast
                                  komplett irrelevant … dürfen aber nie
                                  prominent präsentiert werden … falls
                                  unbekannt, lieber kein datum dort."

                                  Das ist dieselbe Trennlinie wie überall in
                                  diesem Projekt: Die Seite beantwortet eine
                                  deutsche Frage. Ein japanisches Datum an
                                  dieser Stelle sieht aus wie eine Antwort
                                  darauf und ist keine.

                                  `jpStart` bleibt im Datensatz — die Reihe
                                  wird danach sortiert.
                                */
                                /*
                                  **In der Reihenliste steht das japanische Erscheinungsjahr**
                                  (Daniel, 23.09.2026: „da sollte jp release year stehen vom
                                  anime, also 1989"). Die Liste ordnet die Teile einer Reihe
                                  zeitlich ein — dafür ist das Jahr des Anime die stabile Angabe.
                                  Vorher stand hier der deutsche Termin, und bei Dragon Ball Z war
                                  das der Disc-Kauftermin 20.11.2026 zwischen „1986" und „1996".

                                  Ein kommender Teil behält sein „ab", denn dort ist der deutsche
                                  Termin die Auskunft, auf die jemand wartet.
                                */
                                if (offen && m.deStart) {
                                  const [jahr, monat, tag] = m.deStart.split('-')
                                  if (tag) return `ab ${tag}.${monat}.${jahr}`
                                  if (monat) return `ab ${monat}.${jahr}`
                                  return `ab ${jahr}`
                                }
                                return m.jpYear ? String(m.jpYear) : m.deStart ? m.deStart.slice(0, 4) : ''
                              })(),
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

                  /* Teile ohne deutsche Synchro sind eingeklappt — angekündigte und der gewählte Teil bleiben sichtbar. */
                  const ohneOffen = reiheOhneOffen === reihenSchluessel
                  const eingeklappt = (m: FranchiseMember) => Boolean(m.ohneSynchro) && !kuenftig(m) && m.id !== title.id
                  const sichtbar = (m: FranchiseMember) => ohneOffen || !eingeklappt(m)
                  const lang = reihenTeile.length >= 15
                  const suchText = reiheSuche.reihe === reihenSchluessel ? reiheSuche.text.trim() : ''
                  const suchKern = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
                  const passtSuche = (m: FranchiseMember) =>
                    !suchText || suchKern(`${m.name} ${m.jpYear ?? ''}`).includes(suchKern(suchText))
                  const gefiltert = gruppen
                    .map((g) => ({ ...g, teile: g.teile.filter((m) => passtSuche(m) && (suchText ? true : sichtbar(m))) }))
                    .filter((g) => g.teile.length > 0)
                  /* Reiter nur bei langen Reihen ohne laufende Suche; vorausgewählt ist die Gruppe des geöffneten Titels. */
                  const mitReitern = lang && !suchText && gefiltert.length > 1
                  const eigeneGruppe = gefiltert.find((g) => g.teile.some((m) => m.id === title.id))?.titel
                  const aktiverReiter =
                    reiheReiter?.reihe === reihenSchluessel && gefiltert.some((g) => g.titel === reiheReiter.titel)
                      ? reiheReiter.titel
                      : (eigeneGruppe ?? gefiltert[0]?.titel)
                  const angezeigt = mitReitern ? gefiltert.filter((g) => g.titel === aktiverReiter) : gefiltert
                  /*
                    **Die Zahl am Schalter gilt dem Reiter, nicht der Reihe** (Daniel, 22.09.2026:
                    „auf hauptserie reiter gibt es keine ohne synchro, also soll toggle auch nicht
                    angezeigt werden dort … die zahl der anzahl der ohne synchro unter diesem reiter
                    entsprechen"). Gezählt wird in der ungefilterten Gruppe — die Filterung blendet
                    genau diese Teile ja aus.
                  */
                  const zahlOhne = (
                    mitReitern ? (gruppen.find((g) => g.titel === aktiverReiter)?.teile ?? []) : reihenTeile
                  ).filter(eingeklappt).length
                  /*
                    **Ein Schalter in der Leiste statt einer Zeile unter der Liste** (Daniel,
                    19.09.2026: „ohne deutsche synchro ausblenden zeile entfernen und stattdessen
                    toggle oben in die leiste … default toggle state auf ausgeblendet").
                  */
                  const ohneSchalter =
                    zahlOhne > 0 && !suchText ? (
                      <label className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!ohneOffen}
                          onChange={() => setReiheOhneOffen(ohneOffen ? null : reihenSchluessel)}
                        />
                        <span
                          aria-hidden="true"
                          className={[
                            'relative h-3.5 w-6 rounded-full transition',
                            ohneOffen ? 'bg-slate-300 dark:bg-white/20' : 'bg-sky-500',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'absolute top-0.5 size-2.5 rounded-full bg-white shadow transition-all',
                              ohneOffen ? 'left-0.5' : 'left-3',
                            ].join(' ')}
                          />
                        </span>
                        {t('detail.reiheOhneSchalter', { n: zahlOhne })}
                      </label>
                    ) : null

                  return (
                    <div className="flex flex-col gap-0.5">
                      {lang && (
                        <div className="sticky -top-2 z-10 -mx-2 -mt-2 mb-1 flex flex-col gap-1.5 bg-white/95 px-2 pb-1.5 pt-2 backdrop-blur dark:bg-slate-900/95">
                          <input
                            type="search"
                            value={suchText ? reiheSuche.text : ''}
                            onChange={(e) => setReiheSuche({ reihe: reihenSchluessel, text: e.target.value })}
                            placeholder={t('detail.reiheSuche')}
                            aria-label={t('detail.reiheSuche')}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1 text-xs outline-none focus:border-sky-400 dark:border-white/10"
                          />
                          {(mitReitern || ohneSchalter) && (
                            <div className="flex flex-wrap items-center gap-1">
                          {mitReitern && (
                            <div role="tablist" className="flex flex-wrap gap-1">
                              {gefiltert.map((g) => (
                                <button
                                  key={g.titel}
                                  type="button"
                                  role="tab"
                                  aria-selected={g.titel === aktiverReiter}
                                  onClick={() => setReiheReiter({ reihe: reihenSchluessel, titel: g.titel })}
                                  className={[
                                    'cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] transition',
                                    g.titel === aktiverReiter
                                      ? 'bg-sky-500/20 font-medium text-sky-700 dark:text-sky-200'
                                      : 'text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-white/10',
                                  ].join(' ')}
                                >
                                  {g.titel} <span className="tabular-nums opacity-70">{g.teile.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {ohneSchalter}
                            </div>
                          )}
                        </div>
                      )}
                      {!lang && ohneSchalter && <div className="mb-1 flex">{ohneSchalter}</div>}
                      {!angezeigt.length && (
                        <span className="px-1 py-2 text-xs text-slate-500 dark:text-slate-400">{t('detail.reiheKeinTreffer')}</span>
                      )}
                      <div role="tablist" aria-label={t('detail.seriesParts')} className="flex flex-col gap-0.5">
                      {angezeigt.map((g, i) => (
                        <Fragment key={g.titel}>
                          {/*
                            Die Überschrift der ersten Gruppe steht ohne Linie
                            darüber — dort trennt sie nichts, sie benennt nur.
                          */}
                          {!mitReitern && <div
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
                          </div>}
                          {g.teile.map((m) => zeile(m, kuenftig(m)))}
                        </Fragment>
                      ))}
                      </div>
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
            /*
              **Hier stand der Bereich „Release-Termine für deutsche Synchro".**

              Er ist am 16.09.2026 ersatzlos entfallen (Daniel, mit Bild: „das
              sollte doch alles hochgewandert sein in die obere box, und dann gibt
              es keinen verwendungszweck mehr für die untere"). Wohin seine drei
              Angaben gegangen sind:

              | Angabe | wohin |
              |---|---|
              | Status-Plakette („Erschienen") | der Kasten oben sagt es in Worten |
              | FSK („16") | steht als Marke am Cover, 493 der 943 Titel hatten sie zweimal |
              | „Im Angebot seit 25.07.2024 (Netflix)" | als Zeile in den Kasten, 267 Titel |
              | „Erscheinungstermin: unbekannt" | gestrichen — eine Nicht-Auskunft |
              | „Keine deutsche Synchro bekannt" samt Merken-Hinweis | der Satz stand doppelt, der Hinweis ist im Kasten |
            */
            null
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
                  className="mt-1 cursor-pointer text-xs text-sky-700 dark:text-sky-300 hover:underline"
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
          <AehnlicheTitel title={title} data={data} onOpenTitle={onOpenTitle} />

          <Quellenuebersicht title={title} releases={releases} />
        </div>
      </div>
    </>
  )
}
