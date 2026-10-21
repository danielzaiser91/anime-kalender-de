import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiscAusgabe, Release, Title } from '@shared/types.ts'
import { addDays, todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import type { FranchiseMember } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import {
  ladeTitelBestand,
  loadDiscAusgaben,
  loadSynopsis, type Synopsis
} from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useSeiteGesperrt } from '../lib/use-seite-gesperrt.ts'
import { useTitelwechsel } from './detail/titelwechsel.ts'
import { useNewsletterVerbindung } from '../lib/newsletterSync.ts'
import { Quellenuebersicht } from './Quellenuebersicht.tsx'
import { useTvVorbei } from './detail/tv-vorbei.tsx'
import { useTerminReleases } from './detail/termin-releases.ts'
import { KEYWORD_PREVIEW } from './detail/hilfen.tsx'
import { folgenAuskunft } from './detail/folgen-angabe.ts'
import { titelMitTerminBereichen } from './detail/stream-bereiche.ts'
import { lueckeOhneAnbieter } from './detail/folgen-ohne-anbieter.ts'
import { dubZeilenVon } from './detail/dub-zeilen.ts'
import { DiscEinzelListe } from './detail/pillen.tsx'
import { KinoBanner } from './detail/kino.tsx'
import { VoiceCast, AehnlicheTitel } from './detail/weitere.tsx'
import { berechneAntwortMitDeFolgen } from './detail/antwort-de-folgen.ts'
import { EckdatenAbschnitt } from './detail/abschnitte.tsx'
import { HandlungAbschnitt } from './detail/abschnitte.tsx'
import { TermineAbschnitt } from './detail/abschnitte.tsx'
import { ReihenListe } from './detail/reihen-liste.tsx'
import { PANEL_KENNUNG } from './detail/reihen-spur-regeln.ts'
import { AntwortBereichOderNichts } from './detail/kasten-leer.tsx'
import { UnterDerAntwort } from './detail/unter-der-antwort.tsx'
import { PanelBuehne } from './detail/buehne.tsx'
import { sortiereNachZugang } from './detail/wege-sortieren.ts'
import { SchlagworteAbschnitt } from './detail/Schlagworte.tsx'
import { plotVon, eigenerAsZiel } from './detail/plot.ts'
import { reihenTeileVon, useReihe } from './detail/reihen-daten.ts'
import { reihenNameVon, teilNameVon } from './detail/reihen-namen.ts'
import { kastenNotizVon, kaufausgabeZeileVon, wegeHinweisVon } from './detail/kasten-hinweise.ts'
import { useErsatzHandlung } from './detail/ersatz-handlung.ts'
import { PanelLeer, PanelVersteckt } from './detail/panel-huellen.tsx'

export function DetailPanel({
  data,
  titleId,
  discZuerst = false,
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
  /** Über einen Disc-Termin geöffnet: Der Stream/Disc-Umschalter startet auf „Disc". */
  discZuerst?: boolean
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
  const title = useMemo(
    () => titelMitTerminBereichen(titelRoh, data.releasesByTitle.get(titleId) ?? []),
    [titelRoh, data, titleId],
  )
  useTitelwechsel(titleId, title, (data.releasesByTitle.get(titleId)?.length ?? 0) > 0)
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
  /* Das Panel liegt über der Seite: sie bleibt dahinter stehen (Daniel, 11.10.2026). */
  useSeiteGesperrt(true)

  const reihe = useReihe(title)

  const reihenTeile: FranchiseMember[] = useMemo(() => reihenTeileVon(title, reihe, data), [title, reihe, data])

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

  const reihenName = useMemo(() => reihenNameVon(title, reihe, data), [reihe, title, data])

  const teilName = useMemo(() => teilNameVon(title, reihenName, reihenTeile), [title, reihenName, reihenTeile])

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
    **Lange Reihen brauchen Suche und einen Aufklapper** (die Reiter wichen am 20.10.2026 den Zeilen je Gruppe) (Daniel, 17.09.2026, Pokémon
    mit 112 Teilen: „sehr schwer dort für nutzer gesuchte titel der reihe zu finden").
    Der Zustand gilt je Reihe und fällt beim Wechsel der Reihe zurück.
  */
  const reihenSchluessel = reihenTeile[0]?.id ?? 0
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
    ladeTitelBestand(data, titleId)
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
  const terminReleases = useTerminReleases(releases, title, kinoRelease?.slug, today)
  /* Führt der Titel den Anbieter schon als Link, steht dort dessen Pille; der Termin allein erst vor der ersten Folge. */
  const streamReleases = useMemo(
    () => terminReleases.filter((r) => !(title?.streams ?? []).some((s) => s.platform === r.platform)),
    [terminReleases, title],
  )

  /*
    **Die Pille nennt, wie viele Folgen es dort gibt.**

    Daniel am 13.09.2026: „in den pills muss überall drin stehen wieviele
    episoden bei dem jeweiligen anbieter sind. einfaches de ✅ reicht nicht, und
    seit datum ist uninteressant." Am 14.10.2026 kehrte er das um: „seit" steht in der Pille (`pilleUnten`).

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
   * **Der Hinweis an der Pille: zeilenweise, Deutsch zuerst**.
   *
   * Drei Mengen, drei Zeilen, und keine davon steht da, wenn sie leer ist: wie viele Folgen
   * auf Deutsch (und wovon), welche das sind, welche nur fremdsprachig dort liegen, und
   * welche der Anbieter gar nicht führt. Deckt ein Weg alles auf Deutsch ab, sagt das
   * Häkchen daneben schon alles — dann bleibt der Hinweis leer.
   */
  const dubZeilen = dubZeilenVon({ title, t, releases, today })
  /* Die Folgenangabe kommt aus `detail/folgen-angabe.ts` (Zerlegung, 29.09.2026) — einmal gebunden. */
  const folgenAngabeFuer = folgenAuskunft({ releases, title, t, releaseJePlattform, today })

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
      sobald der Toggle den Katalog geladen hatte.

      Ein Eintrag, den die Liste zeigt, muss sich auch öffnen lassen. Beide
      Ladewege sind gegen Mehrfachaufrufe gesichert und tun beim zweiten Mal
      nichts, das Paar kostet also nur beim ersten Wechsel etwas.
    */
    ladeTitelBestand(data, id)
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
    return berechneAntwortMitDeFolgen({ title, releases, today, deFolgen: synopsis?.deFolgen })
    // `today` steht in der Abhängigkeitsliste, weil `titleStatus` es benutzt.
  }, [title, releases, today, synopsis?.deFolgen])

  const kaufausgabeZeile = useMemo(() => kaufausgabeZeileVon({ title, releases, today, antwort, t }), [title, releases, today, antwort, t])

  const wegeHinweis = wegeHinweisVon({ title, antwort, favorites, verbindung, releases, today, t })

  const tvVorbei = useTvVorbei(wegeHinweis, streamReleases, releases, today)

  const kastenNotiz = useMemo(() => kastenNotizVon(releases, today), [releases, today])

  /* Welche Folgen bei keinem bekannten Anbieter liegen — Begründung in `lueckeOhneAnbieter`. */
  const folgenLuecke = useMemo(
    () => lueckeOhneAnbieter({ title, antwort, releaseJePlattform, today }),
    [title, antwort, releaseJePlattform, today],
  )
  /* Zeigt der Kasten eine Zählzeile („2 von 13 Folgen erschienen", „Alle 24 Folgen"), steht die Folgenzahl nicht noch einmal auf dem Cover. */
  const folgenImKasten =
    (antwort?.art === 'laeuft' && Boolean(antwort.gesamt)) || (antwort?.art === 'fertig' && (antwort.gesamt ?? 0) > 1) || antwort?.art === 'teilweise'

  const ersatz = useErsatzHandlung({ titleId, title, synopsis, reihenTeile })

  if (!title) return <PanelLeer holt={holt} t={t} onClose={onClose} />
  if (hidden.has(title.id)) return <PanelVersteckt title={title} t={t} onClose={onClose} onToggleHidden={onToggleHidden} />


  // Handlung auf Deutsch; fehlt sie, lieber den englischen Text mit Hinweis
  // zeigen als gar keinen.
  //
  // Der englische Rückfall bleibt bewusst, obwohl die Oberfläche seit dem
  // 10.08.2026 einsprachig ist: Er stammt nicht aus einer Übersetzung der
  // Seite, sondern aus der Quelle. Für rund 700 der 2.750 Titel gibt es

  // nirgends eine deutsche Inhaltsangabe — dort wäre die Alternative eine
  // leere Fläche.
  const { plot } = plotVon({ synopsis, anilistId: title.al, ersatz, erschienen: (title.jpEnd ?? '9999') < today })
  const asZiel = eigenerAsZiel(plot, synopsis?.asUrl)
  const keywords = allKeywords ? title.keywords : title.keywords.slice(0, KEYWORD_PREVIEW)

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        /*
          Von `max-w-md` (28 rem) auf `max-w-lg` (32 rem) — vier Rem mehr.

          Der Gewinn ist kein Selbstzweck: Die Terminzeilen tragen jetzt Datum,
          Ausgabe und Aktion **nebeneinander**. Bei 28 rem brach die Aktion in
          eine eigene Zeile um, und aus einer Zeile je Ausgabe wurden zwei —
          genau die Platzverschwendung, die verschwinden sollte. Auf schmalen
          Schirmen greift weiterhin `w-full`, dort ändert sich nichts.
        */
        className="animate-slide-in text-t3 fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto pointer-fine:overscroll-contain border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        data-panel={PANEL_KENNUNG}
        aria-label={anzeigeName(title)}
      >
        {/* Kopf (Bild, Name, Knöpfe) steht in `detail/buehne.tsx`; der Kasten beginnt darunter. */}
        <PanelBuehne
          reihenName={reihenName}
          teilName={teilName}
          reihenTeile={reihenTeile}
          buehnenBild={buehnenBild}
          grossBild={synopsis?.cg}
          title={title}
          onToggleHidden={onToggleHidden}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onClose={onClose}
          t={t}
          folgenImKasten={folgenImKasten}
          eigenerTeil={eigenerTeil}
          kinoRelease={kinoRelease}
          asZiel={asZiel}
        />
        <div className="relative flex flex-col gap-3 px-4 pb-8">
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
          <AntwortBereichOderNichts
            antwort={antwort}
            sortiertNachZugang={sortiertNachZugang}
            streamReleases={streamReleases}
            terminReleases={terminReleases}
            title={title}
            t={t}
            today={today}
            wegeHinweis={wegeHinweis}
            tvVorbei={tvVorbei}
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
            discZuerst={discZuerst}
          />
          <UnterDerAntwort
            data={data}
            title={title}
            favorites={favorites}
            reihe={
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
              setReiheOhneOffen={setReiheOhneOffen}
              setReiheSuche={setReiheSuche}
            />
            }
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
            Länge.
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
          />

          {title.hasVoices && <VoiceCast titleId={title.id} />}

          <SchlagworteAbschnitt
            title={title}
            t={t}
            keywords={keywords}
            onFilterBy={onFilterBy}
            tKeyword={tKeyword}
            setAllKeywords={setAllKeywords}
            allKeywords={allKeywords}
          />

          {/*
            **Die Quellen stehen gesammelt unten, nicht an jedem Bereich.**

            Hier stand bis zum 29.08.2026 eine Zeile „Metadaten von AniList ·
            MAL 12345 · Beleg ≥4" — richtig, aber unvollständig: Sie nannte
            eine Quelle von sechs und war nicht klickbar.
          */}
          <AehnlicheTitel title={title} data={data} onOpenTitle={onOpenTitle} />
          <Quellenuebersicht title={title} releases={releases} asZiel={asZiel} />
        </div>
      </div>
    </>
  )
}
