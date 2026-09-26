import { readJson, log, writeJson, warn, clearDir } from '../lib/util.ts'
import {
  type WatchLink,
  type FolgenFenster,
  type Title,
  type PlatformId,
  type Release,
  SYNOPSIS_GROUPS,
  type DiscAusgabe,
  type FranchiseMember, type ReleaseEvent,
  type DataMeta
} from '../../shared/types.ts'
import { amazonAdresseRichten } from '../lib/amazon-adresse.ts'
import { adressKern, loadDubChecks, dubKey } from '../lib/dub-confirmed.ts'
import { providerName, ANILIST_COVER_BASIS } from '../../shared/mappings.ts'
import { anisearchHand, kinoFeld, OUT, NEIN_GILT_TAGE, type EntfernterVerweis, mitAnkuendigung } from './grundlagen.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { type MotnDaten, LEER as MOTN_LEER } from '../lib/motn.ts'
import { zugangsart } from '../../shared/zugangsart.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { schreibeOhneSynchro, schreibeNeuMitSynchro, schreibeMeldungen } from './nebendateien.ts'
import { nachAusstrahlung, unterscheidenderZusatz } from '../../shared/titles.ts'
import { baueNews, type NewsHistorie } from '../lib/news.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'

export function schreibeDatensatz({
  allTitles,
  releases,
  kanalJeAdresse,
  anisearch,
  tmdbTitles,
  mitStimmen,
  verschoben,
  verweiseEntfernt,
  titles,
  jpStartAnzeige,
  events,
  meta,
}: {
  allTitles: Title[]
  releases: Release[]
  kanalJeAdresse: Map<string, string | undefined>
  anisearch: Record<string, AnisearchEintrag>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  mitStimmen: Set<number>
  verschoben: Title[]
  verweiseEntfernt: EntfernterVerweis[]
  titles: Map<number, Title>
  jpStartAnzeige: Map<number, string>
  events: ReleaseEvent[]
  meta: DataMeta
}) {
  // Synopsen liegen getrennt, damit die Startseite nicht Megabytes laden muss.
  //
  // Drei Quellen, in dieser Reihenfolge: aniSearch schreibt redaktionelle
  // deutsche Texte, TMDB oft nur einen übersetzten Stummel, AniList gar kein
  // Deutsch. Vorher gewann TMDB — und bei „You and I Are Polar Opposites
  // Staffel 2" stand deshalb „The second season of …" auf der Seite, obwohl es
  // eine ausführliche deutsche Inhaltsangabe gibt.
  /** Handlung je Titel, mit belegter Herkunft der deutschen Fassung. */
  interface SynopsisEintrag {
    de?: string
    en?: string
    deSource?: { name: string; url: string }
  }
  const synopses: Record<number, SynopsisEintrag> = {}


  /**
   * Die Quelle aus dem Beschreibungstext herauslösen.
   *
   * aniSearch hängt sie an den Text an: „… hinterher.\n\nQuelle:
   * www.anisearch.de/anime/1572". Das stand bei 2.385 von 2.683 deutschen
   * Beschreibungen mitten im Fließtext — und darunter dann noch einmal unsere
   * eigene, anders gestaltete Quellenzeile, die obendrein „themoviedb.org"
   * behauptete, obwohl der Text von aniSearch kam (Daniel, 12.08.2026).
   *
   * Herausgelöst wird sie hier, einmal beim Bauen, statt in der Oberfläche bei
   * jedem Öffnen eines Panels.
   */
  function trenneQuelle(text: string): { text: string; url?: string } {
    const treffer = /\n+\s*Quelle:\s*(\S+)\s*$/.exec(text)
    if (!treffer) return { text: text.trim() }
    const roh = treffer[1]
    return {
      text: text.slice(0, treffer.index).trim(),
      url: roh.startsWith('http') ? roh : `https://${roh}`,
    }
  }

  /* `data/ann-ids.json` führt die Zuordnung unter `ann`: AniList-Kennung -> ANN-Kennung. */
  const annKennungen = readJson<{ ann?: Record<string, number> }>('data/ann-ids.json', {}).ann ?? {}

  /*
    **Die Trailer, je Titel eine YouTube-Kennung.** Geholt von
    `fetch-trailer.ts` aus KinoChecks offizieller API und dem Index seines
    Kanals; hier wird nur zugeordnet. Ein Titel ohne Eintrag bekommt kein Feld
    — die Pille im Panel hängt an seinem Dasein.
  */
  const trailer = readJson<Record<string, { video: string; titel: string; sprache?: 'de' | 'en' | 'ja' }>>(
    'data/trailer.json',
    {},
  )

  /*
    **TOGGO: die Fenster je Folge an den TOGGO-Weg** (19.09.2026, `pipeline/fetch-toggo.ts`).
    Zusammengefasst zu Blöcken gleicher Fenster: Boruto hat 30 Folgen mit demselben Fenster
    bis 31.12.2026 (ein Block), Daima fünf Folgen mit je eigenem 7-Tage-Fenster (fünf Blöcke).
  */
  {
    const toggo = readJson<{
      titel?: Record<string, { adresse?: string; folgen: { staffel: number; folge: number; ab: string; bis: string }[] }>
    }>(
      'data/toggo.json',
      {},
    ).titel ?? {}
    let mitFenster = 0
    for (const t of allTitles) {
      const folgen = toggo[String(t.id)]?.folgen
      if (!folgen) continue
      const bloecke: NonNullable<WatchLink['toggo']> = []
      for (const f of [...folgen].sort((a, b) => a.staffel - b.staffel || a.folge - b.folge)) {
        const letzter = bloecke[bloecke.length - 1]
        if (letzter && letzter.staffel === f.staffel && letzter.bis === f.folge - 1 && letzter.ab === f.ab && letzter.ende === f.bis) letzter.bis = f.folge
        else bloecke.push({ staffel: f.staffel, von: f.folge, bis: f.folge, ab: f.ab, ende: f.bis })
      }
      const adresse = toggo[String(t.id)]?.adresse
      /*
        Kein TOGGO-Weg bekannt, aber die Serie steht im TOGGO-Katalog und hat gerade freie
        Folgen: Weg anlegen. TOGGO zeigt nur deutsche Fassungen (Daniel, 19.09.2026).
      */
      if (adresse && folgen.length && !(t.watchLinks ?? []).some((w) => /(^|\.)toggo\.de\//i.test(w.url.replace(/^https?:\/\//, ''))))
        (t.watchLinks ??= []).push({ name: 'TOGGO', url: adresse, kind: 'stream', zugang: 'kostenlos' })
      for (const w of t.watchLinks ?? []) {
        if (!/(^|\.)toggo\.de\//i.test(w.url.replace(/^https?:\/\//, ''))) continue
        /* Figuren- oder Übersichtsseite → Serienseite (Beyblade X, Daniel 19.09.2026). */
        if (adresse && /toggo\.de\/[a-z0-9-]+\/?$/i.test(w.url)) w.url = adresse
        w.toggo = bloecke
        mitFenster++
      }
    }
    if (mitFenster) log(`${mitFenster} TOGGO-Weg(e) mit Abruffenstern je Folge`)
  }

  /*
    **Joyn: Abruffenster je Folge aus den ProSieben-MAXX-Terminen** (22.09.2026).

    Joyn selbst lesen wir nicht (Impressum: TDM-Vorbehalt nach § 44b). Gemessen an der
    Dragon-Ball-Super-Seite (Folgen 108–127, docs/wissen/quellen.md): Eine Folge ist mit dem Sendeende
    auf ProSieben MAXX online und fällt heraus, wenn die Folge 20 Nummern später zu Ende gesendet
    ist, spätestens am 29. Tag nach der Ausstrahlung um 23:59. Daraus und aus den tv.de-Sichtungen
    (`releasesAusTvProgramm`, Nummern über die Wikipedia-Liste) entstehen die Fenster.

    **Eine Erstsichtung zwischen 0 und 5 Uhr ist kein Start.** Unser tv.de-Verlauf beginnt am
    19.09.2026; Folge 116–125 sahen wir zuerst im Nachtblock am 20.09., Joyn nennt für 116 aber den
    14.09. — die Nacht wiederholt. Solche Folgen bleiben ohne Fenster (die Pille zählt dann zu
    wenig, nie zu viel). Gemessen nur an ProSieben MAXX; andere Sender der Gruppe erst nach Messung.
  */
  {
    const SENDER = new Set(['prosieben maxx'])
    const titelNachId = new Map(allTitles.map((t) => [t.id, t]))
    const plusTage = (tag: string, n: number) => new Date(Date.parse(tag + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
    const plusMinuten = (ab: string, n: number) =>
      new Date(Date.parse(ab + ':00Z') + n * 60_000).toISOString().slice(0, 16)
    let joynFenster = 0
    for (const r of releases) {
      if (r.platform !== 'tv' || !r.folgenBelegt || !SENDER.has((r.sender ?? '').toLowerCase())) continue
      const t = titelNachId.get(r.titleId)
      const joyn = (t?.streams ?? []).find((s) => s.platform === 'joyn')
      const beobachtet = r.schedule.observed ?? {}
      if (!joyn || !Object.keys(beobachtet).length) continue
      const zeit = (nr: number) => r.schedule.zeiten?.[nr] ?? r.schedule.time
      const start = new Map<number, string>()
      for (const [nr, tag] of Object.entries(beobachtet)) {
        const z = zeit(Number(nr))
        if (!z || Number(z.slice(0, 2)) < 5) continue
        start.set(Number(nr), `${tag}T${z}`)
      }
      const fenster: FolgenFenster[] = []
      for (const [nr, ab] of [...start].sort((a, b) => a[0] - b[0])) {
        const frist = `${plusTage(ab.slice(0, 10), 29)}T23:59`
        /* Nachfolger +20 gesendet: Ende mit dessen Sendeende (gemessen: je 25 Minuten nach Beginn). */
        const nachfolger = start.get(nr + 20)
        const ende = nachfolger && plusMinuten(nachfolger, 25) < frist ? plusMinuten(nachfolger, 25) : frist
        /*
          Abrufbar ab dem **Sendeende**, nicht dem Sendebeginn: Joyns `airdate` ist der TV-Termin.
          Gemessen 22.09.2026 (Daniel): 128 lief 17:05–17:30, fehlte um 17:25 und 17:28, war um 17:31 da.
        */
        fenster.push({ nr, ab: plusMinuten(ab, 25), ende })
      }
      /*
        **Die 19 Folgen vor der ersten sicheren Sichtung** (Daniel, 22.09.2026: „die Folgen in der pill
        sind falsch" — „≈ Fg. 126–129", bei Joyn standen 110–129). Joyn hält die letzten 20 Folgen
        (bestätigt 22.09. 17:30: 108 fiel mit dem Sendeende von 128). Premieren laufen in
        Nummernfolge, also sind die 19 davor schon ausgestrahlt — wann genau, wissen wir nicht, wenn
        es vor unserem tv.de-Verlauf lag. Beginn ist dann „vor der ersten sicheren Sichtung", Ende
        das Sendeende von Folge +20, sonst höchstens 29 Tage nach der ersten sicheren Sichtung
        (obere Grenze; die Pille schreibt ohnehin „≈").
      */
      const erste = Math.min(...start.keys())
      const ersteAb = start.get(erste)
      if (ersteAb) {
        const obergrenze = `${plusTage(ersteAb.slice(0, 10), 29)}T23:59`
        const davor = `${plusTage(ersteAb.slice(0, 10), -1)}T00:00`
        for (let nr = Math.max(1, erste - 19); nr < erste; nr++) {
          const nachfolger = start.get(nr + 20)
          const ende = nachfolger && plusMinuten(nachfolger, 25) < obergrenze ? plusMinuten(nachfolger, 25) : obergrenze
          fenster.push({ nr, ab: davor, ende })
        }
        fenster.sort((a, b) => a.nr - b.nr)
      }
      if (!fenster.length) continue
      joyn.fenster = fenster
      joynFenster++
    }
    if (joynFenster) log(`${joynFenster} Joyn-Weg(e) mit Abruffenstern aus dem ProSieben-MAXX-Programm`)
  }
  let gerichtet = 0
  let kanalBenannt = 0
  for (const t of allTitles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'primevideo') continue
      const neu = amazonAdresseRichten(s.url)
      if (neu !== s.url) gerichtet++
      s.url = neu
      /* Hier, hinter allen Quellen, trifft der Kanal auch Wege, deren Adresse spät entsteht. */
      const kanal = kanalJeAdresse.get(adressKern(s.url))
      if (kanal) s.kanal = kanal
    }
    /*
      **Und die Bezugswege zum Ansehen ebenso** (21.09.2026). JustWatchs „Amazon Prime
      (Aniverse)" und Verwandte standen unter `/dp/` — bei „The Legend of Hei" eine 404-Seite,
      während dieselbe Kennung unter der Video-Adresse lebt (Daniel mit Bild). Gegenprobe an
      fünf Kanal-Wegen: fünfmal lebendig unter `/gp/video/detail/`, einmal tot unter `/dp/`.
      Betroffen waren 597 Wege. Kaufwege (`kind: 'buy'`) bleiben: Eine DVD gibt es nur unter `/dp/`.
    */
    for (const w of t.watchLinks ?? []) {
      if (w.kind !== 'stream' || !/amazon\.de\/dp\//i.test(w.url)) continue
      const neu = amazonAdresseRichten(w.url)
      if (neu !== w.url) gerichtet++
      w.url = neu
    }
    /*
      **Ein Kanal mit Amazon-Adresse heißt „Amazon Prime (Kanal)"** (21.09.2026). aniSearch
      führt Kanäle teils unter dem Anbieter selbst (`anime-digital-network-(de)`, `aniverse`,
      `pokémon-(de)`), TMDB als „Anime Digital Network Amazon Channel". Bei „Super Cube" stand
      so eine zweite Pille „ADN", die zu Amazon führte (Daniel mit Bild). Gemessen am selben
      Tag: 16 solche Wege, gegen 600 richtig benannte „Amazon Prime (…)".
    */
    for (const w of t.watchLinks ?? []) {
      if (w.kind !== 'stream' || !/(^|\.)amazon\.de\//i.test(w.url.replace(/^https?:\/\//, '')) || /^amazon/i.test(w.name))
        continue
      const kanal = / Amazon Channel$/i.test(w.name) ? providerName(w.name.replace(/ Amazon Channel$/i, '')) : w.name
      w.name = `Amazon Prime (${kanal})`
      kanalBenannt++
    }
  }
  if (kanalBenannt) log(`${kanalBenannt} Kanal-Wege mit Amazon-Adresse als „Amazon Prime (Kanal)" benannt`)
  for (const r of releases) {
    if (r.platform !== 'primevideo' || !r.platformUrl) continue
    const neu = amazonAdresseRichten(r.platformUrl)
    if (neu !== r.platformUrl) gerichtet++
    r.platformUrl = neu
  }
  if (gerichtet) log(`${gerichtet} Prime-Verweise auf die Video-Adresse gerichtet`)

  const slim = allTitles.map((t) => {
    const ausAnisearch = anisearch[t.id]?.descriptionDe
    const ausTmdb = tmdbTitles[t.id]
    if (t.synopsis || ausAnisearch || ausTmdb?.overviewDe) {
      const eintrag: SynopsisEintrag = { en: t.synopsis }
      if (ausAnisearch) {
        const { text, url } = trenneQuelle(ausAnisearch)
        eintrag.de = text
        /*
          **Ein Quellenverweis führt zum Werk, nicht in ein Verzeichnis.**

          Der Rückfall lautete `anisearch.de/anime/` — die Anime-Übersicht der
          ganzen Seite, für 221 von 2.497 Verweisen (gemessen 12.09.2026). Wer
          dort klickt, sucht danach von Hand weiter; die Angabe „Quelle:
          aniSearch" wird damit unüberprüfbar.

          Die Kennung liegt im Haus: 2.621 Titel tragen `anisearchId`. Wo auch
          die fehlt, geht es zur Suche mit dem Titel — `/search?q=`, denn
          `/anime/index?text=` antwortet mit „Deine Suchanfrage ist ungültig"
          (Daniel, 12.09.2026, mit Bild: „die anisearch verlinkung läuft ins
          leere … pack auf die todo diese stelle und alle anderen zu
          verbessern").
        */
        eintrag.deSource = {
          name: 'anisearch.de',
          url:
            url ??
            (t.anisearchId
              ? `https://www.anisearch.de/anime/${t.anisearchId}`
              : `https://www.anisearch.de/search?q=${encodeURIComponent(
                  t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
                )}`),
        }
      } else if (ausTmdb?.overviewDe) {
        eintrag.de = ausTmdb.overviewDe
        eintrag.deSource = {
          name: 'themoviedb.org',
          url: ausTmdb.tmdbId
            ? `https://www.themoviedb.org/${ausTmdb.kind === 'movie' ? 'movie' : 'tv'}/${ausTmdb.tmdbId}`
            : 'https://www.themoviedb.org/',
        }
      }
      synopses[t.id] = eintrag
    }
    const { synopsis: _drop, ...rest } = t
    /*
      **Die Kennungen der Quellen gehören an den Titel.**

      Sie kosten je Titel wenige Bytes und beantworten eine Frage, die die
      Quellenübersicht sonst offen lässt: „und wo steht das?". aniSearch führt
      den deutschen Titel und die Beschreibung, ANN die deutschen Sprechrollen —
      beide Kennungen lagen im Bestand und erreichten die Seite nie.

      `annId` nur, wo auch Stimmen belegt sind: Ohne sie führt der Verweis auf
      eine Seite, die zu unserer Frage nichts sagt.
    */
    const asId = anisearchHand[t.id] ?? anisearch[t.id]?.anisearchId
    const annId = mitStimmen.has(t.id) ? annKennungen[String(t.id)] : undefined
    return {
      ...rest,
      ...(mitStimmen.has(t.id) ? { hasVoices: true as const } : {}),
      ...(Number.isFinite(asId) ? { anisearchId: asId } : {}),
      ...(Number.isFinite(annId) ? { annId } : {}),
      /* Nur die beiden Felder, die die Oberfläche braucht — Herkunft und Prüfdatum bleiben in der Quelle. */
      ...(trailer[String(t.id)]
        ? {
            trailer: {
              video: trailer[String(t.id)]!.video,
              titel: trailer[String(t.id)]!.titel,
              /* Ältere Einträge kannten das Feld nicht — sie stammen aus der deutschen Erstfassung. */
              sprache: trailer[String(t.id)]!.sprache ?? ('de' as const),
            },
          }
        : {}),
      ...kinoFeld(t.id),
    }
  })

  // Der Kalender braucht nur die Titel, zu denen es einen Termin gibt. Die
  // vollständige Liste (mehrere Megabyte) lädt erst die Datenbank-Ansicht nach.
  const referenced = new Set(releases.map((r) => r.titleId))
  writeJson(`${OUT}/titles-core.json`, slim.filter((t) => referenced.has(t.id)))
  /**
   * Kein Titel geht verloren — der Build bricht lieber ab.
   *
   * Gemessen am 24.08.2026: Ein Bau mit aeltererem `data/cache/` erzeugte
   * 2.752 statt 2.762 Titeln. Die zehn fehlenden waren nicht falsch, sie
   * waren nur im lokalen Cache nicht vorhanden -- darunter "Kill Ao" und
   * "Mononoke Chapter III", beide mit Termin im Kalender.
   *
   * Ein verlorener Titel faellt nicht auf: Der Termin bleibt stehen, das
   * Detail-Panel sagt "keine Metadaten". So hat Daniel es am 23.08. entdeckt,
   * nicht der Lauf.
   */
  {
    /** Ein einzelner Wegfall ist erklaerbar, mehrere sind ein Symptom. */
    const ERLAUBTER_VERLUST = 1
    let vorher: number[] = []
    try {
      const alt = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
      vorher = (Array.isArray(alt) ? alt : Object.values(alt)).map((t) => t.id)
    } catch {
      /* Kein voriger Stand — dann gibt es nichts zu verlieren. */
    }
    if (vorher.length) {
      const jetzt = new Set(slim.map((t) => t.id))
      /**
       * **Wer hinter den Toggle verschoben wurde, ist kein Verlust** (PR #187, Issue #186).
       *
       * `schreibeOhneSynchro` trägt jeden Titel aus `verschoben` nachweislich in
       * `ohne-synchro.json` nach — genau die Zusicherung aus dem Fix vom 17.08.2026 („Ein
       * Vorfilter verschiebt, er löscht nicht"). Der Riegel kannte sie nicht: Am 21.09.2026
       * verloren „Black Clover 2nd Season" (195604) und „Kusuriya no Hitorigoto 3rd Season"
       * (195516) ihren einzigen, unbestätigten Crunchyroll-Termin, wanderten korrekt hinter
       * den Toggle — und der Bau brach ab, obwohl nichts verloren war (Lauf 35550446358).
       *
       * Der Pull Request lag seit dem 21.09. offen und ließ sich nach den Änderungen vom
       * 23.09. nicht mehr sauber zusammenführen; die Zeile steht deshalb direkt hier.
       */
      const hinterToggle = new Set(verschoben.map((t) => t.id))
      const verloren = vorher.filter((id) => !jetzt.has(id) && !hinterToggle.has(id))
      if (verloren.length > ERLAUBTER_VERLUST) {
        warn(
          `ABBRUCH: ${verloren.length} Titel wuerden aus dem Datensatz fallen ` +
            `(${vorher.length} → ${slim.length}).`,
        )
        warn(`   Betroffen: ${verloren.slice(0, 10).join(', ')}`)
        warn(
          '   Meist ist der lokale data/cache/ aelter als der des letzten Laufs. Datenlaeufe gehoeren nach GitHub — siehe CLAUDE.md.',
        )
        process.exit(1)
      }
      if (verloren.length) {
        warn(`${verloren.length} Titel faellt aus dem Datensatz: ${verloren.join(', ')}`)
      }
    }
  }

  /*
    **Das Gedächtnis wird erst geschrieben, wenn der Lauf gültig ist.**

    `data/verweise-entfernt.json` hält fest, was frühere Läufe als belegtes Nein
    entfernt haben — ohne diese Datei legt der nächste Bau alles wieder an. Sie
    stand bis zum 06.09.2026 rund 430 Zeilen weiter oben, also **vor** dem
    Riegel darüber. Ein lokaler Lauf mit älterem `data/cache/` brach dort ab
    („2 Titel würden aus dem Datensatz fallen") — und die Datei war da bereits
    von 782 Zeilen auf zwei geschrumpft, weil dieser Lauf weniger entfernte
    Verweise gesehen hatte.

    Gefangen hat es `git status` vor dem Commit. Ein Riegel, der den Datensatz
    schützt und die Nebendatei daneben unbeschädigt lässt, schützt aber nur die
    Hälfte: Wer den Diff nicht durchsieht, committet ein leeres Gedächtnis.
  */
  /*
    **Was das Gedächtnis gesperrt hat, schreibt es auch wieder mit.**

    Bis zum 17.09.2026 enthielt die Datei nur, was **dieser** Lauf entfernt hat.
    Ein Verweis, den aniSearch ergänzt und der Bau als belegtes Nein wieder
    entfernt, stand danach drin — der nächste Lauf ergänzte ihn deshalb nicht,
    entfernte ihn also auch nicht, und schrieb ihn nicht mehr. Der übernächste
    legte ihn wieder an. 78 Crunchyroll-Adressen (One Piece, DearS …) flatterten
    so von Bau zu Bau, sichtbar in `data/bestand-historie.jsonl` als 836 ↔ 769.
    Übernommen wird ein alter Eintrag, solange seine Frist läuft, dieser Lauf
    ihn nicht selbst neu geschrieben hat und kein Verweis mit dieser Adresse im
    Datensatz steht.
  */
  if (verweiseEntfernt.length) {
    const grenze = addDays(todayIso(), -NEIN_GILT_TAGE)
    const schluessel = (e: { titleId?: number; plattform?: string; url?: string }) =>
      `${e.titleId}|${e.plattform}|${adressKern(e.url)}`
    const schonDa = new Set(verweiseEntfernt.map(schluessel))
    const imBestand = new Set<string>()
    for (const t of allTitles) for (const st of t.streams ?? []) imBestand.add(adressKern(st.url))
    const uebernommen = (
      readJson<{ verweise?: EntfernterVerweis[] }>('data/verweise-entfernt.json', {}).verweise ?? []
    ).filter(
      (e) => (e.entferntAm ?? '') >= grenze && !schonDa.has(schluessel(e)) && !imBestand.has(adressKern(e.url)),
    )
    if (uebernommen.length) log(`${uebernommen.length} gesperrte Verweise aus dem Gedächtnis übernommen`)
    writeJson(
      'data/verweise-entfernt.json',
      { stand: new Date().toISOString(), verweise: [...verweiseEntfernt, ...uebernommen] },
      true,
    )
  }

  /**
   * **Jetzt** die Such-Verweise ersetzen — auf dem, was gleich geschrieben wird.
   *
   * Prime-Video-Verweise stammen aus dem aniSearch-Bestand, und dort steht
   * meist eine **Suche** statt einer Titelseite. Wer darauf klickt, muss den
   * richtigen Treffer selbst heraussuchen. Selbst nachsehen können wir nicht:
   * `amazon.de/robots.txt` sperrt ClaudeBot namentlich mit `Disallow: /`.
   *
   * Die Adressen liegen im MOTN-Archiv — `pipeline/motn-links.ts` zieht sie
   * ohne einen einzigen neuen Abruf heraus. Genau dafür archiviert dieses
   * Projekt Rohantworten.
   *
   * Ersetzt wird ausschließlich eine Suchadresse: Ein Verweis, der schon auf
   * einen Titel zeigt, ist von Hand geprüft oder stammt aus einer Quelle, die
   * ihn genauer kennt.
   */
  const motnLinks = readJson<{ links: Record<string, Record<string, string>> }>(
    'data/motn-links.json',
    { links: {} },
  ).links
  const motnTmdb = readJson<MotnDaten>('data/motn.json', MOTN_LEER).tmdb ?? {}
  const tmdbZuTitel = readJson<Record<string, { tmdbId?: number; kind?: string }>>(
    'data/tmdb-titles.json',
    {},
  )
  /**
   * Netflix: `/browse?jbv=<id>` ist ein Overlay, keine Seite.
   *
   * Die Adressform öffnet die Browse-Ansicht und legt eine Karte darüber. Wer
   * sie teilt oder ohne Anmeldung aufruft, landet auf einer Startseite mit
   * einem Fenster, das sich nicht immer aufbaut — Daniel am 24.08.2026 zu
   * „AnoHana": „der titel lässt sich nicht abspielen, kein melden möglich von
   * der overview".
   *
   * `/title/<id>` ist dieselbe Kennung auf der eigentlichen Titelseite.
   * Betroffen sind zwei Verweise; die Normalisierung steht hier trotzdem,
   * damit auch der dritte gar nicht erst durchkommt.
   */
  let netflixBerichtigt = 0
  for (const eintrag of slim) {
    for (const s of eintrag.streams ?? []) {
      if (s.platform !== 'netflix') continue
      const id = /\/browse\?jbv=(\d+)/.exec(s.url)?.[1]
      if (!id) continue
      s.url = `https://www.netflix.com/title/${id}`
      netflixBerichtigt++
    }
  }
  if (netflixBerichtigt) {
    log(`${netflixBerichtigt} Netflix-Overlay-Adressen auf die Titelseite umgeschrieben`)
  }

  let tiefeErsetzt = 0
  for (const eintrag of slim) {
    const suchen = (eintrag.streams ?? []).filter((s) => /\/s\?/.test(s.url))
    if (!suchen.length) continue
    const zu = tmdbZuTitel[String(eintrag.id)]
    if (!zu?.tmdbId || !zu.kind) continue
    const imdb = motnTmdb[`${zu.kind}/${zu.tmdbId}`]?.imdbId
    if (!imdb) continue
    for (const s of suchen) {
      const adresse = motnLinks[imdb]?.[s.platform]
      if (!adresse) continue
      s.url = adresse
      tiefeErsetzt++
    }
  }
  if (tiefeErsetzt) {
    log(`${tiefeErsetzt} Such-Verweise durch die echte Titelseite ersetzt (MOTN-Archiv)`)
  }

  /**
   * Titel ganz ohne Weg bekommen einen — wenn **zwei** Quellen ihn belegen.
   *
   * Gemessen am 25.08.2026: **875 der 2.762 Titel** zeigen weder einen
   * Anbieter-Verweis noch einen Kauflink. Für den Besucher heißt das „dieser
   * Anime hat eine deutsche Synchronfassung" — und dann nichts. Das ist die
   * größte Lücke am vierten Punkt des Projektziels („Nicht nur wann, auch wo.
   * Bei den meisten Titeln ist das die eigentliche Frage").
   *
   * Darunter sind keine Randfälle: „One Punch Man", „Gintama", „Durarara!!",
   * „Mahouka Koukou no Rettousei", „Fate/stay night: Unlimited Blade Works".
   *
   * **Zwei unabhängige Quellen müssen sich einig sein**, und beide liegen im
   * Haus:
   *
   * - `data/tmdb-titles.json` nennt je Titel die Anbieter in Deutschland
   *   (`providers`) — das ist die Aussage „dort läuft es".
   * - `data/motn-links.json` nennt je IMDb-Kennung den Deep-Link — das ist die
   *   Adresse dazu.
   *
   * Verbunden werden sie über die IMDb-Kennung aus `data/motn.json`. Ein
   * Verweis entsteht nur, wo **beide** etwas sagen: TMDB allein liefert keine
   * Adresse (und eine Anbieter-Startseite wäre kein Verweis, sondern eine
   * Zumutung), das Archiv allein keine Bestätigung, dass der Titel dort heute
   * noch läuft.
   *
   * **Die Sprachangabe bleibt offen.** TMDB belegt sie nicht (siehe
   * `fetch-tmdb-kino.ts`), das Archiv auch nicht. Der Verweis trägt deshalb
   * kein `dub` — die Oberfläche schreibt „🇩🇪 ?", und das ist die ehrliche
   * Antwort. Ein Weg ohne Sprachangabe ist trotzdem mehr wert als gar keiner.
   */
  /**
   * **Ein Titel ohne Verweis ist nicht dasselbe wie ein Titel ohne geprüften
   * Verweis** — und diese Unterscheidung hat der erste Anlauf verfehlt.
   *
   * Am 25.08.2026 ergänzte er 14 Titeln einen Weg, weil TMDB einen Anbieter
   * nannte und das MOTN-Archiv eine Adresse dazu hatte. Fünf davon hatten ihren
   * Verweis aber **aus gutem Grund** nicht: Daniel hatte sie geprüft und als
   * „ohne deutsche Tonspur" oder „nicht verfügbar" eingetragen, woraufhin der
   * Bau sie entfernt. „Kino's Journey" auf Netflix etwa, geprüft am 22.08.2026
   * — Folgen 1 bis 13 ohne deutschen Ton.
   *
   * Die Ergänzung holte sie zurück und überschrieb damit eine Handprüfung.
   * Das ist der schwerste Fehler, den dieses Projekt kennt: **Was ein Mensch
   * geprüft hat, schlägt jede Ableitung** — und eine Ableitung, die es
   * stillschweigend überstimmt, macht die teuerste Datenquelle wertlos.
   *
   * Gefangen hat es `check:handbelege`, genau wofür der Lauf gebaut ist. Der
   * Deploy wurde rot, bevor etwas ausgeliefert war.
   *
   * Ergänzt wird deshalb nur, wo zu Titel **und** Plattform **keine**
   * Handprüfung vorliegt. Ein `dub: true` von Hand wäre ohnehin schon im
   * Datensatz; alles andere ist ein ausdrückliches Nein.
   */
  const handgeprueft = new Set(
    loadDubChecks().map((c) => dubKey(c.anilistId, c.platform)),
  )
  let wegeErgaenzt = 0
  let wegenHandpruefung = 0
  for (const eintrag of slim) {
    if ((eintrag.streams ?? []).length || (eintrag.watchLinks ?? []).length) continue
    const zu = tmdbZuTitel[String(eintrag.id)]
    if (!zu?.tmdbId || !zu.kind) continue
    const anbieter = (zu as { providers?: string[] }).providers
    if (!anbieter?.length) continue
    const imdb = motnTmdb[`${zu.kind}/${zu.tmdbId}`]?.imdbId
    if (!imdb) continue
    const links = motnLinks[imdb]
    if (!links) continue

    const neue = []
    for (const [platform, url] of Object.entries(links)) {
      // Nur was TMDB **auch** nennt: Das Archiv kann einen Link führen, den es
      // heute nicht mehr gibt.
      if (!anbieter.includes(platform)) continue
      // Und nichts, worüber ein Mensch schon entschieden hat.
      if (handgeprueft.has(dubKey(eintrag.id, platform))) {
        wegenHandpruefung++
        continue
      }
      /*
        **Die Zugangsart gehört an den Verweis, sobald er entsteht.** Die
        Schleife, die sie sonst für alle Verweise setzt, läuft weiter oben —
        was hier später hinzukommt, hätte sie nie gesehen und stünde ohne
        Preisangabe im Kalender. `check:zugangsart` hat genau das gemeldet
        (25.08.2026, drei Verweise: Gintama, DEATH NOTE Rewrite, Durarara!!).
      */
      neue.push({
        platform: platform as PlatformId,
        url,
        // Prime Video führt Abo- und Kauftitel nebeneinander; die lizenzierte
        // JustWatch-Angabe entscheidet, wo sie vorliegt. Ohne sie greift die
        // Vorgabe des Anbieters.
        zugang: zugangsart(
          platform,
          undefined,
          url,
          (tmdbTitles[eintrag.id]?.offers ?? []).find(
            (o) => providerToPlatform(o.name) === platform,
          )?.kind,
        ),
      })
    }
    if (!neue.length) continue
    eintrag.streams = neue
    wegeErgaenzt++
  }
  if (wegenHandpruefung) {
    log(`${wegenHandpruefung} Verweis(e) nicht ergänzt — dort liegt eine Handprüfung vor`)
  }
  if (wegeErgaenzt) {
    log(`${wegeErgaenzt} Titel ohne jeden Weg haben jetzt einen (TMDB-Anbieter + MOTN-Adresse)`)
  }




  /**
   * „Im Angebot seit" — für Titel, die sonst gar kein Datum hätten.
   *
   * 1.089 Titel mit belegter deutscher Synchro haben keinen einzigen Termin.
   * Sie sind nicht falsch, nur alt: erschienen, bevor der Kalender sie kannte.
   * Im Detail-Panel steht dann nichts, wo eine Zeitangabe hingehört.
   *
   * MOTN führt für 340 davon ein `availableSince` — die Angabe des Anbieters,
   * seit wann er den Titel listet. **Das ist nicht das Erscheinungsdatum der
   * deutschen Fassung**, und deshalb trägt der Eintrag `dateMeaning:
   * 'available-from'`; die Oberfläche schreibt „Im Angebot seit".
   *
   * **Nur was 2026 dazukam, wird ein Kalendereintrag.** Daniels Entscheidung am
   * 27.08.2026: 201 Einträge aus diesem Jahr sind noch von Interesse, die 139
   * aus 2024 und 2025 würden die Vergangenheitsansicht fluten, ohne jemandem zu
   * helfen. Ihr Datum steht trotzdem am Titel und damit im Panel.
   */
  {
    const GRENZE = '2026-01-01'
    const motnDaten = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
    const tmdbFuerTermine = readJson<Record<string, { tmdbId?: string; kind?: string }>>(
      'data/tmdb-titles.json',
      {},
    )
    const nachImdb = new Map(
      Object.entries(motnDaten.shows ?? {}).map(([k, v]) => [v.imdbId ?? k, v]),
    )
    const hatTermin = new Set(releases.map((r) => r.titleId))
    let alsTermin = 0
    let nurAmTitel = 0

    for (const title of titles.values()) {
      if (hatTermin.has(title.id)) continue
      if (!title.streams?.some((x) => x.dub === true)) continue
      const t = tmdbFuerTermine[title.id]
      if (!t?.tmdbId) continue
      const imdb = motnDaten.tmdb?.[`${t.kind === 'movie' ? 'movie' : 'tv'}/${t.tmdbId}`]?.imdbId
      const show = imdb ? nachImdb.get(imdb) : undefined
      if (!show) continue

      /*
        Der früheste Anbieter gewinnt — er hat den Titel zuerst gehabt. Gezählt
        wird nur, wo wir auch einen Verweis führen: Ein Datum zu einem Anbieter,
        auf den wir gar nicht verlinken, hilft niemandem weiter.
      */
      const unsere = new Set(title.streams.map((x) => x.platform))
      const kandidaten = Object.entries(show.dienste ?? {})
        .filter(([anbieter, d]) => d.seit && unsere.has(anbieter as PlatformId))
        .sort((a, b) => (a[1].seit ?? '').localeCompare(b[1].seit ?? ''))
      const bester = kandidaten[0]
      if (!bester) continue
      const [anbieter, dienst] = bester
      const seit = dienst.seit!

      /*
        Am Titel steht es immer — das Panel zeigt es auch ohne Kalendereintrag.

        **Und zwar an beiden Fassungen.** `slim` entsteht weiter oben aus
        Kopien; wer nur `titles` beschreibt, sieht sein Feld im ausgelieferten
        Datensatz nie wieder. Der erste Lauf schrieb 329-mal ein Feld, das
        nirgends ankam (27.08.2026).
      */
      const angebot = { platform: anbieter as PlatformId, date: seit }
      title.angebotSeit = angebot
      const ausgeliefert = slim.find((x) => x.id === title.id)
      if (ausgeliefert) ausgeliefert.angebotSeit = angebot
      nurAmTitel++

      if (seit < GRENZE) continue
      const verweis = title.streams.find((x) => x.platform === anbieter)
      releases.push({
        slug: `motn-${title.id}-${anbieter}`,
        titleId: title.id,
        name: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
        platform: anbieter as PlatformId,
        platformUrl: verweis?.url,
        releaseType: title.format === 'MOVIE' ? 'movie' : 'batch',
        dateMeaning: 'available-from',
        schedule: {
          firstEpisodeDate: seit,
          episodeCount: title.episodes ?? 1,
          lastEpisodeDate: seit,
        },
        year: Number(seit.slice(0, 4)),
        sources: ['https://www.movieofthenight.com/about/api'],
        quellen: [
          {
            url: 'https://www.movieofthenight.com/about/api',
            name: 'movieofthenight.com',
            gesehenAm: todayIso(),
            sagt: seit,
            stand: 'aktuell',
          },
        ],
      } as Release)
      alsTermin++
    }
    if (nurAmTitel) {
      log(
        `${nurAmTitel} Titel ohne Termin tragen jetzt ein „Im Angebot seit" ` +
          `(${alsTermin} davon aus ${GRENZE.slice(0, 4)} auch als Kalendereintrag)`,
      )
    }
  }

  writeJson(`${OUT}/titles.json`, slim.map(mitAnkuendigung))

  /*
    **Weitere Namen für die Suche — eine eigene Datei, geladen erst in der Datenbank.**

    Wer „abenteuer von dai" sucht, meint „Dragon Quest: The Adventure of Dai"; der
    deutsche Name „Dais Abenteuer" steht nur unter aniSearchs Synonymen (Daniel,
    16.09.2026: „google schafft es"). Die Suche kannte bis dahin nur die vier
    angezeigten Namen. Gemessen: 4.539 Synonyme zu 1.934 Titeln, 160 KB, gepackt 61 KB
    — zu viel für `titles.json`, das der Kalender nicht braucht.
  */
  {
    const katalogTitel = readJson<Record<string, { synonyme?: string[] }>>('data/anisearch-titel.json', {})
    const synonyme: Record<string, string[]> = {}
    const aufnehmen = (id: number, liste: string[] | undefined, schon: (string | undefined)[]) => {
      const bekannt = new Set(schon.filter(Boolean).map((s) => s!.toLowerCase()))
      const neu = [...new Set((liste ?? []).map((s) => (s.endsWith('Alle anzeigen') ? s.slice(0, -13) : s).trim()))]
        .filter((s) => s && !bekannt.has(s.toLowerCase()))
        .slice(0, 12)
      if (neu.length) synonyme[id] = neu
    }
    for (const t of titles.values()) {
      aufnehmen(t.id, anisearch[t.id]?.info?.synonyms, [t.titleDe, t.titleEn, t.titleRomaji, t.titleNative])
    }
    for (const [id, e] of Object.entries(katalogTitel)) {
      if (!synonyme[id]) aufnehmen(Number(id), e.synonyme, [])
    }
    writeJson(`${OUT}/synonyme.json`, synonyme)
    log(`${Object.keys(synonyme).length} Titel mit weiteren Namen für die Suche`)
  }
  // Kennung → Reihe: das Erste sortiert die schon gepflegten Titel aus, das
  // Zweite hält Reihen zusammen, die über die Grenze der beiden Bestände gehen.
  /*
    Wie jede Reihe auf Deutsch heißt — der Maßstab, an dem ein AniList-Synonym
    als deutsch erkennbar wird. Genommen wird der Name des Reihenkopfs; ein
    Staffeltitel („… Staffel 2") wäre ein zu enger Vorsatz.
  */
  const deutscheReihe = new Map<number, string>()
  for (const t of slim) if ((t.franchiseId ?? t.id) === t.id && t.titleDe) deutscheReihe.set(t.id, t.titleDe)
  schreibeOhneSynchro(
    new Map(slim.map((t) => [t.id, t.franchiseId ?? t.id])),
    verschoben,
    deutscheReihe,
  )
  schreibeNeuMitSynchro(slim, releases)
  // Synopsen in Gruppen statt in einer Datei.
  //
  // Vorher lag alles in `synopses.json`: 3,8 MB, die beim ersten Öffnen eines
  // Detail-Panels über die Leitung gingen — für **eine** Beschreibung wurden
  // 2.753 geladen. Bei 32 Gruppen sind es rund 120 KB, und die Gruppe deckt
  // beim Durchklickeln oft gleich mehrere weitere Titel mit ab.
  //
  // Die Gruppe ergibt sich aus der AniList-ID, nicht aus einer laufenden
  // Nummer: So bleibt sie über Datenläufe hinweg dieselbe, und ein gecachter
  // Abruf verfällt nicht, nur weil ein Titel dazukam.
  const gruppen = new Map<number, Record<number, { de?: string; en?: string }>>()
  for (const [id, wert] of Object.entries(synopses)) {
    const gruppe = Number(id) % SYNOPSIS_GROUPS
    const eintrag = gruppen.get(gruppe) ?? {}
    eintrag[Number(id)] = wert
    gruppen.set(gruppe, eintrag)
  }
  clearDir(`${OUT}/synopses`)
  for (const [gruppe, inhalt] of gruppen) writeJson(`${OUT}/synopses/${gruppe}.json`, inhalt)
  log(`Synopsen in ${gruppen.size} Gruppen geschrieben (vorher eine Datei mit ${Object.keys(synopses).length} Einträgen)`)

  /*
    **Die deutschen Disc-Ausgaben je Titel, in denselben Gruppen.** Das Panel zeigt je
    Format die Gesamtausgabe und klappt die Einzelbände auf (Daniel, 16.09.2026: „2 discs
    pills dvd und blueray, führen zu gesamtpaket, darunter ausklappbar die volumes").
  */
  {
    const roh = readJson<Record<string, { kurz?: string; format?: string; art?: string; datum: string; url?: string }[]>>(
      'data/disc-ausgaben.json',
      {},
    )
    const discGruppen = new Map<number, Record<number, DiscAusgabe[]>>()
    for (const [id, liste] of Object.entries(roh)) {
      if (!titles.has(Number(id))) continue
      const kompakt = liste.flatMap((a): DiscAusgabe[] => {
        const artikel = Number(/article\/(\d+)/.exec(a.url ?? '')?.[1])
        if (!artikel || !a.kurz || !a.format || !a.art) return []
        const f = a.format === 'Blu-ray' ? 'b' : a.format === 'DVD' ? 'd' : 'u'
        return [[a.kurz, f, a.art[0] as 'g' | 't' | 'e', a.datum, artikel]]
      })
      if (!kompakt.length) continue
      const gruppe = Number(id) % SYNOPSIS_GROUPS
      const eintrag = discGruppen.get(gruppe) ?? {}
      eintrag[Number(id)] = kompakt
      discGruppen.set(gruppe, eintrag)
    }
    clearDir(`${OUT}/disc`)
    for (const [gruppe, inhalt] of discGruppen) writeJson(`${OUT}/disc/${gruppe}.json`, inhalt)
  }
  /**
   * Die Reihen — welche Staffeln, Filme und Specials zusammengehören.
   *
   * Eine eigene Datei, weil das Detail-Panel die Frage „welche Staffeln gibt es
   * noch?" auch im Kalender beantworten muss, wo nur `titles-core.json` geladen
   * ist. Vorher las es dafür `data.titles` — und das sind dort die 133 Titel
   * mit Termin. Ergebnis (gemeldet von Daniel, 12.08.2026): Bei „That Time I
   * Got Reincarnated as a Slime" stand unter „Staffeln dieser Reihe" allein
   * Staffel 4, weil nur die einen Termin hat; bei „I've Been Killing Slimes"
   * fehlte der Abschnitt ganz, obwohl es eine zweite Staffel gibt.
   *
   * Nur Reihen mit mehr als einem Eintrag — ein Einzeltitel hat keine Reihe.
   * 462 Reihen, nachgeladen beim ersten Öffnen eines Detail-Panels.
   *
   * **Cover stehen seit dem 13.08.2026 mit drin.** Vorher nicht, mit der
   * Begründung „für eine Auswahlliste braucht es sie nicht" — aus der
   * Auswahlliste ist ein Karussell aus Vorschaukarten geworden, und eine Karte
   * ohne Bild ist keine. Gespeichert wird nur der Dateiname ohne
   * Adressvorsatz; den hängt `loadFranchises` wieder an.
   */
  /*
    **Eine Reihe ist vollständig oder sie ist keine.**

    Bis zum 03.09.2026 entstand `franchises.json` allein aus `slim`, also aus
    den Titeln **mit** belegter Synchro. Was hinter dem Toggle liegt, fehlte —
    und damit hängte der Inhalt des Panels davon ab, ob der Toggle gerade an
    war: Bei „Die Tagebücher der Apothekerin" standen ohne ihn zwei Teile, mit
    ihm sechs. Daniel am 03.09.2026: „alle 6 sollten im panel immer sein,
    unabhängig vom toggle."

    Er hat recht, und zwar aus einem Grund, der über die Bequemlichkeit
    hinausgeht: Der Toggle beantwortet die Frage „welche Titel will ich in der
    **Liste** sehen". Die Reihe eines geöffneten Titels ist keine Liste, sondern
    ein Bestandteil dieses Titels — dass Staffel 3 existiert, hört nicht auf
    wahr zu sein, weil sie noch keine deutsche Fassung hat.

    Die Katalogtitel gehen deshalb mit, tragen aber `ohneSynchro` — die Liste
    stellt sie gestrichelt dar, statt sie als gleichwertig auszugeben.
  */
  /*
    **Der früheste deutsche Termin je Titel.** Er ist das einzige Datum, das in
    die Auswahlbox des Panels gehört (Daniel, 12.09.2026) — die japanische
    Ausstrahlung bleibt für die Sortierung im Datensatz, wird dort aber nicht
    mehr angezeigt. Gezählt wird der Beginn jedes Releases, Disc wie Stream:
    Gefragt ist „seit wann gibt es das hier", nicht „auf welchem Weg".
  */
  const deStart = new Map<number, string>()
  for (const r of releases) {
    const d = r.schedule?.firstEpisodeDate
    /* Eine TV-Sichtung nennt unseren ersten Blick, keinen Start (Pokémon Horizonte „16.09.2026", 16.09.2026). */
    if (!d || r.tvLetzteSichtung) continue
    const bisher = deStart.get(r.titleId)
    if (!bisher || d < bisher) deStart.set(r.titleId, d)
  }

  const ausKatalog = readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])
  const imBestand = new Set(slim.map((t) => t.id))
  const fuerReihen = [
    ...slim,
    ...ausKatalog.filter((t) => !imBestand.has(t.id)).map((t) => ({ ...t, ohneSynchro: true })),
  ]

  /**
   * **Was an einem anderen Teil der Reihe hängt, ist Beiwerk.**
   *
   * AniLists `PARENT`-Kante sagt es, das Format nicht: Bei chinesischen
   * Produktionen ist jeder Teil eine ONA, und ohne dieses Feld standen bei
   * „Lord of Mysteries" die Specials und das Chibi-Theater unter „Hauptserie"
   * (Daniel, 12.09.2026). Der Katalog führt die Kante für **alle** Titel, auch
   * für die im Bestand — er ist der vollständige AniList-Abzug.
   */
  const elternVon = new Map<number, number[]>()
  for (const e of readJson<{ eintraege?: { id: number; eltern?: number[] }[] }>(
    'data/cache/anilist-katalog.json',
    {},
  ).eintraege ?? []) {
    if (e.eltern?.length) elternVon.set(e.id, e.eltern)
  }

  const nachReihe = new Map<number, typeof fuerReihen>()
  for (const t of fuerReihen) {
    const key = t.franchiseId ?? t.id
    const liste = nachReihe.get(key) ?? []
    liste.push(t)
    nachReihe.set(key, liste)
  }
  const reihen: Record<number, FranchiseMember[]> = {}
  for (const [key, liste] of nachReihe) {
    if (liste.length < 2) continue
    /*
      **Eine Reihe aus lauter Katalogtiteln ist keine.** Sie gehört zu keinem
      Eintrag, den jemand öffnen könnte, und blähte die Datei nur auf.
    */
    if (!liste.some((t) => imBestand.has(t.id))) continue
    /*
      **Zwei Reihenteile dürfen nicht gleich heißen.**

      Gemessen am 03.09.2026: In 74 Reihen tragen zwei oder mehr Einträge genau
      dieselbe Beschriftung — dreimal „Bleach: Thousand-Year Blood War", bei
      „Schleim" zweimal „Staffel 2". In der Reihenliste des Panels kann niemand
      sehen, was er anklickt (Daniel, 02.09.2026: „es ist total unklar was man
      dort anklickt").

      Der Unterschied steht im Originaltitel: AniList führt „2nd Season" und
      „2nd Season Part 2", die deutsche Fassung nennt beide „Staffel 2".
      `unterscheidenderZusatz` holt ihn von dort zurück — verglichen wird mit dem
      Geschwistereintrag, der denselben Namen trägt.
    */
    const sortiert = liste.sort(nachAusstrahlung)
    const anzeigename = (t: (typeof sortiert)[number]) =>
      t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`
    const wieOft = new Map<string, number>()
    for (const t of sortiert) {
      const n = anzeigename(t)
      wieOft.set(n, (wieOft.get(n) ?? 0) + 1)
    }
    reihen[key] = sortiert.map((t) => ({
      id: t.id,
      name: (() => {
        const basis = anzeigename(t)
        if ((wieOft.get(basis) ?? 0) < 2) return basis
        const original = t.titleEn ?? t.titleRomaji
        /*
          Verglichen wird mit dem **frühesten** Geschwister gleichen Namens: Bei
          drei Bleach-Einträgen soll jeder seinen eigenen Zusatz bekommen, und
          der gemeinsame Anfang steckt im ersten.
        */
        const geschwister = sortiert.find(
          (x) => x.id !== t.id && anzeigename(x) === basis,
        )
        const zusatz = unterscheidenderZusatz(original, geschwister?.titleEn ?? geschwister?.titleRomaji)
        return zusatz ? `${basis} — ${zusatz}` : basis
      })(),
      format: t.format,
      jpYear: t.jpYear,
      episodes: t.episodes,
      /*
        **Der Termin, soweit bekannt.**

        Bei einem Katalogtitel steht er am Titel selbst; bei einem Titel aus
        dem Bestand steht er nur in `jpStart` — der Karte, die der Bau ohnehin
        führt. Ohne diesen Rückgriff blieben ausgerechnet die Titel ohne
        Datum, die auf der Seite sichtbar sind: „Lord of Mysteries Specials"
        zeigte im Panel nur sein Format, obwohl AniList den 20.06.2026 führt
        (Daniel, 12.09.2026: „jp release date fehlt dort").
      */
      jpStart: t.jpStart ?? jpStartAnzeige.get(t.id),
      jpStatus: t.jpStatus,
      deStart: deStart.get(t.id),
      ohneSynchro: (t as { ohneSynchro?: boolean }).ohneSynchro || undefined,
      /* Hängt er an einem anderen Teil **dieser** Reihe? Eine fremde Elternkante zählt nicht. */
      beiwerk: (elternVon.get(t.id) ?? []).some((e) => sortiert.some((x) => x.id === e)) || undefined,
      // Nur der Dateiname; den Vorsatz hängt `loadFranchises` wieder an.
      cover: t.coverImage?.startsWith(ANILIST_COVER_BASIS)
        ? t.coverImage.slice(ANILIST_COVER_BASIS.length)
        : t.coverImage,
    }))
  }
  writeJson(`${OUT}/franchises.json`, reihen)
  log(`${Object.keys(reihen).length} Reihen mit mehr als einem Eintrag geschrieben`)

  schreibeMeldungen(slim)

  /**
   * Wie lange ein Kinofilm läuft, steht nur im Kinoprogramm.
   *
   * Ein Kinostart hat kein angekündigtes Ende — er ergibt sich daraus, wie
   * lange die Häuser ihn spielen. `data/cinestar.json` sammelt genau das: die
   * Vorstellungstage über 43 Standorte. Der späteste davon ist das belegte
   * Ende, und mehr als belegt wird hier nicht behauptet.
   *
   * Gebraucht wird es für eine einzige Unterscheidung, die dem Besucher sonst
   * verborgen bliebe: Solange der Film läuft, ist „Kein Anbieter bekannt" eine
   * Irreführung — der Anbieter ist das Kino. Danach ist derselbe Satz die
   * richtige Auskunft.
   */
  const cinestar = readJson<{
    filme?: Record<string, { anilistId?: number; detailLink?: string; tage?: Record<string, unknown> }>
  }>(
    'data/cinestar.json',
    {},
  ).filme
  if (cinestar) {
    const letzterTag = new Map<number, string>()
    /*
      Auch über die Veranstaltungsadresse: „Your Name – CineAnime" hat zwei Wörter
      und bekommt im Abruf keine AniList-Kennung (die Zuordnung verlangt drei). Der
      kuratierte Kinotermin nennt dieselbe CineStar-Seite als Quelle (17.09.2026).
    */
    const veranstaltung = (u: string | undefined) => /\/veranstaltung-([a-z0-9-]+)/.exec(u ?? '')?.[1]
    const letzterJeVeranstaltung = new Map<string, string>()
    for (const f of Object.values(cinestar)) {
      const tage = Object.keys(f.tage ?? {}).sort()
      const letzter = tage.at(-1)
      if (!letzter) continue
      const v = veranstaltung(f.detailLink)
      if (v && letzter > (letzterJeVeranstaltung.get(v) ?? '')) letzterJeVeranstaltung.set(v, letzter)
      if (!f.anilistId) continue
      // Läuft ein Film in mehreren Fassungen oder Reihen, gewinnt der spätere Tag.
      const bisher = letzterTag.get(f.anilistId)
      if (!bisher || letzter > bisher) letzterTag.set(f.anilistId, letzter)
    }
    let kinoEnden = 0
    for (const r of releases) {
      if (r.platform !== 'kino') continue
      const ueberQuelle = (r.sources ?? [])
        .map((q) => letzterJeVeranstaltung.get(veranstaltung(q) ?? ''))
        .filter((x): x is string => Boolean(x))
      const bis = [letzterTag.get(r.titleId), ...ueberQuelle].filter((x): x is string => Boolean(x)).sort().at(-1)
      if (!bis) continue
      r.cinemaUntil = bis
      kinoEnden++
    }
    if (kinoEnden) log(`${kinoEnden} Kino-Release(s) mit belegtem letzten Spieltag`)
  }

  /*
    **Prime-Verweise gehen unter die Video-Adresse — einmal für alle, zum Schluss.**

    Die Adressen kommen aus sechs Quellen (AniList, JustWatch, MOTN, Meldungen,
    Handpflege, Kanal-Gegenprobe), und jede hat ihre eigene Schreibweise. Eine
    Stichprobe am 20.09.2026 zeigte, was das kostet: Sieben von fünfzehn
    `/dp/`-Verweisen mit Befund „lebt" antworteten selbst mit 404, weil die
    Prüfung bei einem 404 still auf die Video-Adresse ausweicht und den Erfolg
    unter der alten bucht. Fünfzehn von fünfzehn lebten unter
    `/gp/video/detail/`.

    Deshalb hier, hinter allen Quellen: Was als Prime-Video-Weg im Datensatz
    steht, trägt die Video-Adresse. Discs und Shop-Artikel laufen über
    `watchLinks` mit eigener Plattform und bleiben unberührt.
  */
  writeJson(`${OUT}/releases.json`, releases)
  writeJson(`${OUT}/events.json`, events)

  /*
    **Die Nachrichten — aus dem, was ohnehin dasteht.** Kein neuer Abruf: neue
    Synchros, neue Folgen, Termine und verpasste Termine stehen bereits im
    Datensatz. Das Gedächtnis daneben hält fest, wann eine Meldung zum ersten
    Mal wahr war; ohne das rutschte bei jedem Bau alles auf heute.
  */
  let newsFuerRss: ReturnType<typeof baueNews> | undefined
  {
    const newsHistorie = readJson<NewsHistorie>('data/news-historie.json', { zuerst: {} })
    const meldungen = baueNews(
      [...titles.values()],
      releases,
      readJson<{ id: number; seit: string }[]>(`${OUT}/neu-mit-synchro.json`, []),
      readJson<{ folgen?: { serieId: string; serie: string; nummer?: number; gesehenAm: string }[] }>(
        'data/crunchyroll-neu.json',
        {},
      ).folgen ?? [],
      newsHistorie,
    )
    writeJson(`${OUT}/news.json`, meldungen)
    newsFuerRss = meldungen
    writeJson('data/news-historie.json', newsHistorie)
    const jeArt = new Map<string, number>()
    let einzeln = 0
    for (const e of meldungen)
      for (const m of e.meldungen) {
        einzeln++
        jeArt.set(m.art, (jeArt.get(m.art) ?? 0) + 1)
      }
    log(
      `${meldungen.length} Einträge für die Nachrichtenseite, ${einzeln} Meldungen darin (` +
        [...jeArt].map(([a, n]) => `${a} ${n}`).join(', ') +
        ')',
    )
  }
  writeJson(`${OUT}/meta.json`, meta, true)
  return { newsFuerRss }
}
