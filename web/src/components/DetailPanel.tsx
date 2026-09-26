import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiscAusgabe, Release, StreamLink, Title } from '@shared/types.ts'
import { bereicheGekuerzt, bereicheKurz, dubAbdeckung, dubBild, dubGrenze, dubLuecken, folgenOhneAnbieter } from '@shared/dub-grenze.ts'
import { expandEvents, istErschienen, releaseStatus, bereicheMitTermin } from '@shared/logic.ts'
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
import { syncSharePath } from '../lib/router.ts'
import { useNewsletterVerbindung } from '../lib/newsletterSync.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import {
  Button,
  Chip, Tooltip, SectionTitle
} from './ui.tsx'
import { Quellenuebersicht } from './Quellenuebersicht.tsx'
import { jetztBerlin } from '../lib/toggo.ts'
import { joynAngabe } from '../lib/joyn.ts'
import { tvAngabe } from '../lib/tv-angabe.ts'
import { KEYWORD_PREVIEW } from './detail/hilfen.tsx'
import { DiscEinzelListe } from './detail/pillen.tsx'
import { jpAngabe, KinoBanner } from './detail/kino.tsx'
import { VoiceCast, AehnlicheTitel } from './detail/weitere.tsx'
import { berechneAntwort } from './detail/antwort-berechnen.ts'
import { EckdatenAbschnitt } from './detail/abschnitte.tsx'
import { HandlungAbschnitt } from './detail/abschnitte.tsx'
import { TermineAbschnitt } from './detail/abschnitte.tsx'
import { ReihenListe } from './detail/reihen-liste.tsx'
import { AntwortBereich } from './detail/antwort-bereich.tsx'
import { PanelKopf } from './detail/kopf.tsx'
import { PanelBuehne } from './detail/buehne.tsx'
import { sortiereNachZugang } from './detail/wege-sortieren.ts'

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
    return sortiereNachZugang({ title })
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
    return berechneAntwort({ title, releases, today })
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
        <PanelBuehne
          reihenName={reihenName}
          buehnenBild={buehnenBild}
          title={title}
          onToggleHidden={onToggleHidden}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          reihenIds={reihenIds}
          onClose={onClose}
          t={t}
          unterzeile={unterzeile}
          eigenerTeil={eigenerTeil}
        />

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
        <PanelKopf
          bewertung={bewertung}
          reihenTeile={reihenTeile}
          teilName={teilName}
          reihenName={reihenName}
          title={title}
          kinoRelease={kinoRelease}
        />

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
          <AntwortBereich
            antwort={antwort}
            sortiertNachZugang={sortiertNachZugang}
            streamReleases={streamReleases}
            title={title}
            t={t}
            today={today}
            wegeHinweis={wegeHinweis}
            kastenNotiz={kastenNotiz}
            kaufausgabeZeile={kaufausgabeZeile}
            folgenLuecke={folgenLuecke}
            verbindung={verbindung}
            favorites={favorites}
            folgenAngabeFuer={folgenAngabeFuer}
            dubZeilen={dubZeilen}
            releaseJePlattform={releaseJePlattform}
            releases={releases}
            discAusgaben={discAusgaben}
            discOffen={discOffen}
            setDiscOffen={setDiscOffen}
            discReleases={discReleases}
          />
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
          <ReihenListe
            reihenTeile={reihenTeile}
            t={t}
            reihenName={reihenName}
            title={title}
            favorites={favorites}
            wechselt={wechselt}
            wechsleZu={wechsleZu}
            reiheOhneOffen={reiheOhneOffen}
            reihenSchluessel={reihenSchluessel}
            reiheSuche={reiheSuche}
            reiheReiter={reiheReiter}
            setReiheOhneOffen={setReiheOhneOffen}
            setReiheSuche={setReiheSuche}
            setReiheReiter={setReiheReiter}
          />

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
          <TermineAbschnitt releases={releases} title={title} />

          {/*
            Hier stand „Alles aus dieser Reihe" — dieselben Einträge, die zwei
            Handbreit darüber schon im Umschalter stehen. Zwei Listen mit
            identischem Inhalt sind keine doppelte Auskunft, sondern doppelte
            Länge (Daniel, 12.08.2026).
          */}
          <HandlungAbschnitt plot={plot} t={t} plotOffen={plotOffen} setPlotOffen={setPlotOffen} />

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
          <EckdatenAbschnitt
            title={title}
            t={t}
            genresOffen={genresOffen}
            onFilterBy={onFilterBy}
            tGenre={tGenre}
            setGenresOffen={setGenresOffen}
            faktenImKasten={faktenImKasten}
          />

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
