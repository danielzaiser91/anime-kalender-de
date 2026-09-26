import { readJson, writeJson, log, clearDir } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { schreibeOhneSynchro, schreibeNeuMitSynchro, schreibeMeldungen } from './nebendateien.ts'
import {
  SYNOPSIS_GROUPS,
  type DiscAusgabe,
  type Title,
  type FranchiseMember, type Release
} from '../../shared/types.ts'
import { nachAusstrahlung, unterscheidenderZusatz } from '../../shared/titles.ts'
import { ANILIST_COVER_BASIS } from '../../shared/mappings.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type SynopsisEintrag } from './13-1-anreichern.ts'
import { type SlimTitel } from './13-2-auslieferung.ts'

export function schreibeZusatzdateien({ titles, anisearch, slim, verschoben, releases, synopses, jpStartAnzeige }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  slim: SlimTitel[]
  verschoben: Title[]
  releases: Release[]
  synopses: Record<number, SynopsisEintrag>
  jpStartAnzeige: Map<number, string>
}) {
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
}
