import {
  FRANCHISE_RELATIONS,
  otherZaehlt,
  stripAffiliate,
  anisearchPlatform,
  providerName,
  providerKind,
  PLATFORM_PRIORITY,
} from '../../shared/mappings.ts'
import { resolve } from 'node:path'
import { ROOT, log, warn } from '../lib/util.ts'
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { ladeTitelDe } from '../lib/titel-de.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { werkTitel, providerToPlatform } from './titel-hilfen.ts'
import { type WatchLink, type PlatformId, type Title } from '../../shared/types.ts'
import { entwirreWeiterleitung, adressePasst, plattformAusAdresse } from '../../shared/adresse-passt.ts'
import { loadWatchLinks } from '../lib/curated.ts'
import { type AniListMedia } from '../lib/anilist.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'

export function fuehreReihenZusammen({ byAniId, byMal, titles, tmdbTitles, anisearch }: {
  byAniId: Record<string, AniListMedia>
  byMal: Record<string, AniListMedia>
  titles: Map<number, Title>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  anisearch: Record<string, AnisearchEintrag>
}) {
  // Staffeln, Cours und Specials derselben Serie bekommen eine gemeinsame ID,
  // damit die Datenbank sie auf Wunsch zu einer Karte bündeln kann.
  // Welche Beziehungen zählen, steht in `shared/mappings.ts` — der
  // Katalog-Abruf braucht dieselbe Liste.
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== undefined && parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // Die kleinere ID gewinnt — das ist in aller Regel die erste Staffel.
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  /**
   * **Ein Crossover gehört zwei Reihen an — und verschmilzt sie deshalb.**
   *
   * „Lupin III. vs Detektiv Conan" ist ein Lupin-Film und ein Conan-Film
   * zugleich, und AniList sagt das auch: Der Titel trägt **zwei**
   * `PARENT`-Kanten, eine zu „Detective Conan" (235), eine zu „Lupin the 3rd"
   * (1412). Union-Find kennt aber nur eine Zugehörigkeit je Knoten, also zog
   * dieser eine Film beide Reihen zusammen — und über „Lupin III. vs. Cat's
   * Eye" kam Cat's Eye gleich mit dazu.
   *
   * Das Ergebnis stand am 25.08.2026 im Panel: eine Reihe mit **114 Teilen**,
   * deren Name „Lupin III.: Teil 1" lautete, weil der Vertreter der älteste
   * Teil ist — und der ältere Lupin von 1971 schlägt Conan von 1996. Daniel:
   * „die reihe heißt detektiv conan, lupin muss davon getrennt werden."
   *
   * **Erkannt wird das an AniLists eigener Auskunft, nicht am Namen.** Ein
   * Namensmuster auf „vs" / „x" wurde gemessen und verworfen: Es trifft
   * „Hunter x Hunter", „SPY x FAMILY" und „HAIKYU!! LAND VS. AIR" — allesamt
   * gewöhnliche Teile ihrer eigenen Reihe. Es hätte drei echte Reihen zerlegt,
   * um zwei falsche zu trennen.
   *
   * Der Prüfstein sind stattdessen zwei `PARENT`-Kanten, die in **verschiedene**
   * Reihen zeigen. Gemessen am Bestand vom 25.08.2026:
   *
   * | | Zahl |
   * |---|---|
   * | Titel mit zwei oder mehr `PARENT`-Kanten | 24 |
   * | davon beide Eltern in derselben Reihe (unberührt) | 17 |
   * | **echte Crossover** | **7** |
   *
   * Die 17 harmlosen sind Specials und Kurzfilme, die zweimal auf dieselbe
   * Serie zeigen („Evangelion: Death & Rebirth", zwei One-Piece-Kurzfilme,
   * zwei Naruto-Specials). Sie werden ganz normal vereint — die Regel greift
   * nur dort, wo sie etwas trennt.
   *
   * Wirkung: Conan 114 → 63 Teile, Lupin 114 → 45, Cat's Eye 114 → 3.
   *
   * **Der Crossover selbst bleibt sichtbar.** Er verbindet die Reihen nicht
   * mehr, wird aber der Reihe seines ersten Elternteils zugeschlagen — „Lupin
   * III. vs Detektiv Conan" steht also weiter bei Conan. Ihn heimatlos zu
   * lassen wäre die schlechtere Antwort: Wer die Conan-Reihe durchsieht, sucht
   * genau diesen Film.
   */
  /*
    Nachgeschlagen wird über die **AniList-Kennung**, nicht über den Index von
    `byMal` — der ist nach MAL-Kennung geschlüsselt, und dieselbe Zahl meint
    dort einen anderen Anime.
  */
  const medienNachAniId = new Map<number, (typeof byAniId)[number]>()
  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (media?.id && !medienNachAniId.has(media.id)) medienNachAniId.set(media.id, media)
  }
  /**
   * Zählt diese Kante als Reihenzugehörigkeit?
   *
   * Die sieben eindeutigen Arten immer; `OTHER` nur, wenn die Namen beider
   * Seiten zusammenpassen — sonst klebt AniLists Sammelbecken Gundam an
   * Patlabor. Begründung und Messwerte bei `otherZaehlt` in
   * `shared/mappings.ts`; dieselbe Regel steckt im Katalog-Abruf
   * (`lib/anilist.ts`), damit beide Wege dieselben Reihen bauen.
   */
  const istReihenKante = (
    media: { title: { romaji: string | null; english: string | null } },
    edge: {
      relationType: string
      node?: { title?: { romaji: string | null; english: string | null } }
    },
  ): boolean =>
    FRANCHISE_RELATIONS.has(edge.relationType) ||
    (edge.relationType === 'OTHER' &&
      otherZaehlt(
        [media.title.romaji, media.title.english],
        [edge.node?.title?.romaji, edge.node?.title?.english],
      ))

  const crossoverEltern = new Map<number, number[]>()
  for (const [id, media] of medienNachAniId) {
    const eltern = (media.relations?.edges ?? [])
      .filter((e) => e.relationType === 'PARENT' && e.node?.type === 'ANIME')
      .map((e) => e.node!.id)
    if (eltern.length >= 2) crossoverEltern.set(id, eltern)
  }

  // Erster Durchgang: alles vereinen, was keinen Kandidaten berührt.
  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (!media?.id) continue
    parent.set(media.id, parent.get(media.id) ?? media.id)
    if (crossoverEltern.has(media.id)) continue
    for (const edge of media.relations?.edges ?? []) {
      if (!istReihenKante(media, edge)) continue
      if (edge.node?.type !== 'ANIME') continue
      if (crossoverEltern.has(edge.node.id)) continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(media.id, edge.node.id)
    }
  }

  /*
    Zweiter Durchgang: Wer trennt wirklich? Ein Kandidat, dessen Eltern jetzt
    dieselbe Wurzel tragen, ist kein Crossover — seine Kanten werden nachträglich
    vereint, als wäre nichts gewesen.
  */
  const echteCrossover = new Map<number, number>()
  for (const [id, eltern] of crossoverEltern) {
    const reihen = new Set(eltern.map((e) => find(e)))
    if (reihen.size > 1) {
      echteCrossover.set(id, eltern[0])
      continue
    }
    const media = medienNachAniId.get(id)
    for (const edge of media?.relations?.edges ?? []) {
      if (!media || !istReihenKante(media, edge)) continue
      if (edge.node?.type !== 'ANIME') continue
      if (crossoverEltern.has(edge.node.id) && !echteCrossover.has(edge.node.id)) continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(id, edge.node.id)
    }
  }

  /*
    **Wo AniList eine Kante vergessen hat, verbindet `data/reihen-von-hand.yaml`** (21.09.2026).
    Danganronpa 3 zerfiel in zwei Reihen, weil AniList Future Arc und Despair Arc nicht
    miteinander verbindet — im Panel fehlten zwei Teile.
  */
  {
    const datei = resolve(ROOT, 'data/reihen-von-hand.yaml')
    const eintraege = existsSync(datei)
      ? ((yaml.load(readFileSync(datei, 'utf8')) as Array<{ ids?: number[] }> | null) ?? [])
      : []
    let verbunden = 0
    for (const e of eintraege) {
      const ids = (e.ids ?? []).filter((id) => titles.has(id))
      for (const id of ids.slice(1)) {
        parent.set(id, parent.get(id) ?? id)
        parent.set(ids[0]!, parent.get(ids[0]!) ?? ids[0]!)
        union(ids[0]!, id)
        verbunden++
      }
    }
    if (verbunden) log(`${verbunden} Reihen-Verbindung(en) aus data/reihen-von-hand.yaml`)
  }

  for (const title of titles.values()) title.franchiseId = find(title.id)
  // Der Crossover erbt die Reihe seines ersten Elternteils, ohne sie zu verbinden.
  for (const [id, ersterElternteil] of echteCrossover) {
    const t = titles.get(id)
    if (t) t.franchiseId = find(ersterElternteil)
  }
  if (echteCrossover.size) {
    log(`${echteCrossover.size} Crossover trennen keine Reihen mehr (${crossoverEltern.size} geprüft)`)
  }

  // FSK aus TMDB für alle Titel übernehmen, nicht nur für kuratierte.
  /*
    **Ein `available: false` gilt auch für einen Kaufweg.**

    Bisher wirkte es nur auf `streams` — die `watchLinks` aus aniSearch liefen
    daran vorbei. Bei „Nicht schon wieder, Takagi-san" stand deshalb
    „Crunchyroll über Prime Video" im Panel, und die Adresse antwortete mit
    Amazons Fehlerseite: „Die eingegebene Webadresse ist keine funktionsfähige
    Seite" (Daniel, 04.09.2026, mit Bild). Sie stammt aus aniSearch und ist dort
    veraltet.

    Ein Weg, der ins Leere führt, ist schlechter als kein Weg: Er sieht aus wie
    eine Antwort und kostet einen Klick, um sich als keine zu erweisen.
  */
  /** Von Hand geprüfte deutsche Werktitel, siehe unten bei `deutscheTitelHand`. */
  const handTitel = ladeTitelDe()

  const toteAdressen = new Set(
    loadDubChecks()
      .filter((c) => c.available === false && c.url)
      .map((c) => c.url!),
  )
  for (const title of titles.values()) {
    const extra = tmdbTitles[title.id]
    if (extra?.fsk !== undefined && title.fsk === undefined) title.fsk = extra.fsk
  }

  // Anbieter von aniSearch dazunehmen. Die decken genau die Lücke, die AniList
  // lässt: alte Katalogtitel, die nur noch als DVD oder bei einem kleinen
  // Dienst zu haben sind.
  let fremdeAdressen = 0
  let umsortiert = 0
  /*
    **Von Hand geprüfte deutsche Werktitel — sie schlagen jede Quelle.**

    Am 16.09.2026 standen 132 Titel ohne deutschen Namen da, 57 davon mit
    belegter deutscher Fassung (Sprechrollen, deutsche Erstausgabe oder ein
    Verweis mit `dub: true`) — die haben also einen, wir kannten ihn nur nicht.
    Beide automatischen Quellen sind dort erschöpft: aniSearch führt für die 54
    archivierten Seiten drei deutsche Sprachblöcke und keinen Namen darin, TMDB
    fällt bei `language=de-DE` still auf den Originaltitel zurück.

    `data/titel-de.yaml` ist die dritte Stufe, dieselbe wie bei der Synchro:
    nachgesehen, mit zwei Quellen belegt, mit Datum. Sie steht vor den beiden
    automatischen Runden, damit ein geprüfter Name nicht von einer Datenbank
    überschrieben wird.
  */
  let deutscheTitelHand = 0
  for (const eintrag of handTitel) {
    const title = titles.get(eintrag.id)
    if (!title || !eintrag.titleDe) continue
    title.titleDe = werkTitel(eintrag.titleDe)
    deutscheTitelHand++
  }
  if (deutscheTitelHand) log(`${deutscheTitelHand} deutsche Titel aus data/titel-de.yaml übernommen`)

  let deutscheTitel = 0
  let deutscheTitelTmdb = 0
  let netflixOhneKennung = 0
  for (const title of titles.values()) {
    const extra = anisearch[title.id]

    /**
     * Der deutsche Name des Werks — die Antwort auf „warum finde ich das nicht".
     *
     * aniSearch ist eine deutsche Datenbank und führt den Titel je Sprache.
     * Für AniList 169969 steht dort:
     *
     *     Japanisch   Mushoku no Eiyuu: Betsu ni Skill nanka Iranakattan da ga
     *     Englisch    Hero Without a Class: Who Even Needs Skills?!
     *     Deutsch     Der Held ohne Klasse: Der Aufstieg eines Talentlosen
     *
     * Genau danach hat Daniel am 24.08.2026 gesucht und nichts gefunden — der
     * Anime stand im Kalender, aber unter seinem japanischen Namen. Die Suche
     * im Frontend liest `titleDe` längst; es war nur bei **99 von 2.762**
     * Titeln gefüllt, während diese Datei für **2.553** einen deutschen Namen
     * hergibt. Die Daten lagen seit Tagen im Repo und wurden nie ausgewertet.
     *
     * Steht hier derselbe Text wie im englischen Feld, ist das kein Fehler: Ein
     * Werk, das hier unter seinem englischen Namen läuft, heißt eben so.
     *
     * **Ein vorhandener Wert bleibt unangetastet** — ein kuratierter oder vom
     * Anbieter gemeldeter Titel ist näher am Sprachgebrauch als ein
     * Datenbankeintrag.
     */
    if (!title.titleDe) {
      const de = (extra?.info?.languages ?? []).find((l) => /deutsch/i.test(l.language ?? ''))
      if (de?.title?.trim()) {
        title.titleDe = werkTitel(de.title.trim())
        deutscheTitel++
      }
    }

    /*
      **TMDB als zweite Quelle für den deutschen Titel.**

      194 Titel hatten am 28.08.2026 keinen — `titleDe` kam allein aus aniSearch.
      TMDB antwortet auf `language=de-DE` mit dem deutschen Namen, wenn es einen
      gibt, und **sonst mit dem Originaltitel**. Genau darum wird hier
      verglichen: Stimmt der Name mit einem unserer Originaltitel überein, ist es
      keine Übersetzung, sondern dieselbe Auskunft noch einmal.

      Ein deutscher Titel, der dem englischen gleicht, ist kein Gewinn — er
      füllt nur ein Feld und lässt die Lücke unsichtbar werden.
    */
    if (!title.titleDe && tmdbTitles[title.id]?.nameDe) {
      const kandidat = tmdbTitles[title.id]!.nameDe!.trim()
      const gleichWie = [title.titleEn, title.titleRomaji, title.titleNative]
        .filter(Boolean)
        .map((x) => x!.toLowerCase().replace(/[^a-z0-9]/g, ''))
      const kern = kandidat.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (kandidat && !gleichWie.includes(kern)) {
        title.titleDe = werkTitel(kandidat)
        deutscheTitelTmdb++
      }
    }

    if (!extra?.streams?.length) continue
    const watchLinks: WatchLink[] = []
    for (const { provider, url: raw } of extra.streams) {
      const url = stripAffiliate(entwirreWeiterleitung(raw))
      const platform = anisearchPlatform(provider)
      if (platform) {
        /**
         * Der Name nennt den Anbieter, die Adresse muss ihn auch tragen.
         *
         * Bei aniSearch stehen beide getrennt, und sie gehören nicht immer
         * zusammen: Unter „Crunchyroll" fanden sich am 22.08.2026 ein
         * Amazon-Link („Attack on Titan: The Roar of Awakening") und eine
         * Google-Weiterleitung („NANA"). Beide landeten als Crunchyroll-Verweis
         * im Datensatz und kosteten bei jedem Abruflauf einen Aufruf, ohne je
         * etwas zu liefern.
         */
        let ziel = platform
        if (!adressePasst(url, platform)) {
          /**
           * Nicht wegwerfen, sondern richtig einsortieren.
           *
           * Von 33 falsch einsortierten Adressen zeigten am 22.08.2026 alle auf
           * Amazon — 30 unter „Aniverse", 3 unter „Crunchyroll". Sie zu
           * verwerfen hätte 33 gültige Kaufwege gekostet. Nur was zu **gar
           * keinem** bekannten Anbieter führt, fällt raus.
           */
          const echt = plattformAusAdresse(url)
          if (!echt) {
            fremdeAdressen++
            continue
          }
          ziel = echt
          umsortiert++
        }
        // Kennt unsere Plattformliste den Dienst, gehört er zu den Streams —
        // aber nur, wenn dort nicht schon ein Link steht.
        if (!title.streams.some((s) => s.platform === ziel)) {
          title.streams.push({ platform: ziel, url })
        }
        continue
      }
      // Ein Anbieter genügt einmal. Zwei Amazon-Zeilen nebeneinander sind
      // keine Auswahl, sondern Rauschen — aniSearch führt dort oft mehrere
      // Ausgaben desselben Titels.
      const name = providerName(provider)
      // Leerer Name heißt: der Anbieter gehört nicht auf eine deutsche Seite.
      if (!name) continue
      if (!watchLinks.some((w) => w.name === name)) {
        /*
          **Zeigt die Adresse auf eine einzelne Folge, sagt der Weg das.**

          Bei „Banana Fish" führt die Akibapass-Pille auf
          `…/exklusive-dub-previews/videos/banana-fish-s1e01-…` — eine
          Dub-Vorschau der ersten Folge. Im Panel sah sie aus wie ein Weg zur
          ganzen Serie, daneben stand als Termin der 06.11.2026 (Daniel,
          12.09.2026: „folge 1 jetzt, rest 06.11.").

          Erkannt wird nur, was die Adresse selbst nennt — `s1e01`, `folge-1`,
          `episode-3`. Drei Wege im Bestand tragen so etwas; alles Weitere wäre
          Raten über fremde Adressen.
        */
        const nurFolge = Number(/(?:s\d+e|episode-|folge-|-ep-?)(\d{1,3})(?:[^\d]|$)/i.exec(url)?.[1])
        watchLinks.push({
          name,
          url,
          kind: providerKind(provider),
          ...(Number.isFinite(nurFolge) && nurFolge > 0 ? { nurFolge } : {}),
        })
      }
    }
    if (watchLinks.length) {
      // Ansehen vor Kaufen — wer ein Abo hat, will nicht erst zur Kasse.
      title.watchLinks = watchLinks
        .filter((w) => !toteAdressen.has(w.url))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }
  if (netflixOhneKennung) log(`${netflixOhneKennung} Netflix-Verweise ohne Kennung entfernt — sie führen ins Leere`)
  if (deutscheTitelTmdb) log(`${deutscheTitelTmdb} deutsche Titel von TMDB ergänzt (aniSearch hatte keinen)`)
  if (umsortiert) log(`${umsortiert} aniSearch-Verweise umsortiert: Adresse gehört zu einem anderen Anbieter als dem genannten`)
  if (fremdeAdressen) log(`${fremdeAdressen} aniSearch-Verweise verworfen: Adresse führt zu gar keinem bekannten Anbieter`)

  // Angebote von TMDB (Datenbasis JustWatch) — dieselbe Quelle, aus der auch
  // werstreamt.es schöpft. Bisher behielten wir davon nur die Dienste mit
  // eigener Plattform und warfen Videobuster, maxdome, Sky Store und Apple TV
  // weg. Die Daten waren immer da.
  //
  // Einen Link je Anbieter liefert TMDB nicht, nur eine Übersichtsseite für
  // die Region. Also zeigt jede Zeile den Anbieternamen und führt dorthin —
  // besser als ein erfundener Deeplink, der ins Leere geht.
  /*
    **Ein Special unter der Kennung einer TV-Serie erbt deren Anbieter nicht.**

    TMDB legt OVAs und Specials oft als „Staffel 0" der Hauptserie ab; die Anbieterliste
    gilt dann für die Serie. „The Testament of Sister New Devil Burst: Basara Tojos äußerst
    friedlicher Alltag" (OVA, TMDB tv/64163) bekam so eine Akibapass-Pille auf die
    TMDB-Seite — Akibapass führt nur die zwölf Folgen der ersten Staffel (Daniel,
    21.09.2026, mit Bildschirmfoto). Gemessen am selben Tag: drei solche Fälle im Bestand
    (21489, 8465, 1335), alle OVA/Special neben einer TV-Serie derselben Kennung.
  */
  const tvJeTmdb = new Set<string>()
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (info?.tmdbId && title.format === 'TV') tvJeTmdb.add(`${info.kind}${info.tmdbId}`)
  }
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (!info?.offers?.length || !info.justwatchUrl) continue
    if (title.format !== 'TV' && tvJeTmdb.has(`${info.kind}${info.tmdbId}`)) continue
    const watchLinks = title.watchLinks ?? []
    for (const offer of info.offers) {
      if (providerToPlatform(offer.name)) continue
      // Denselben Weg über providerName wie die aniSearch-Angebote — sonst
      // stünden „maxdome" und „maxdome Store" als zwei Anbieter nebeneinander.
      const name = providerName(offer.name)
      if (!name) continue
      if (watchLinks.some((w) => w.name === name)) continue
      /*
        **Kauf und Leihe sind hier digital — sie gehören zum Streamen, nicht zur Disc.**

        TMDB listet unter `watch/providers` ausschließlich Video-on-Demand-Anbieter.
        Bis zum 16.09.2026 wurde aus `rent`/`buy` ein `kind: 'buy'`, und damit standen
        maxdome und freenet meinVOD im Disc-Reiter des Panels (Daniel: „die pills sind
        falsch als disc eingeordnet, das sind streambare titel"). Die Zugangsart trägt
        den Unterschied zwischen Abo und Kauf; der Reiter trägt nur, ob man es
        anschaut oder ins Regal stellt.
      */
      watchLinks.push({
        name,
        url: info.justwatchUrl,
        kind: 'stream',
        zugang: offer.kind === 'flatrate' ? 'abo' : 'kauf',
        /*
          Gekennzeichnet beim Anlegen, nicht erst am Ende: `pruefeErgebnis()` läuft vor den
          JustWatch-Runden, die eine direkte Adresse einsetzen (und die Kennzeichnung dann löschen).
          Der Bestandslauf vom 22.09.2026 17:33 brach mit 1.172 ungekennzeichneten Wegen ab, weil die
          Kennzeichnung erst nach der Prüfung kam.
        */
        ueberTmdb: true,
      })
    }
    if (watchLinks.length) {
      title.watchLinks = watchLinks
        .filter((w) => !toteAdressen.has(w.url))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
  }

  // Von Hand gepflegte Bezugswege. Sie stehen vorn: Wer sie einträgt, hat
  // nachgesehen — das schlägt jede automatische Liste.
  for (const entry of loadWatchLinks()) {
    const title = titles.get(entry.anilistId)
    if (!title) {
      warn(`watch-links.yaml: AniList-ID ${entry.anilistId} (${entry.title ?? '?'}) ist unbekannt`)
      continue
    }
    const existing = title.watchLinks ?? []
    const curated = (entry.links ?? []).filter((l) => !existing.some((e) => e.url === l.url))
    /**
     * Eine von Hand herausgesuchte Produktseite ersetzt die Suche.
     *
     * AniList liefert fuer die meisten Titel keinen Deeplink, deshalb steht dort
     * ein Suchlink — am 20.08.2026 bei **225 von 226** Prime-Verweisen. Wer die
     * echte Adresse eintraegt, hat nachgesehen; das schlaegt die Suche.
     */
    for (const s of entry.streams ?? []) {
      const vorhanden = title.streams.find((x) => x.platform === s.platform)
      if (vorhanden) vorhanden.url = s.url
      else title.streams.push({ platform: s.platform as PlatformId, url: s.url })
    }
    title.watchLinks = [...curated, ...existing].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1,
    )
  }

  for (const title of titles.values()) {
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }
  return { tvJeTmdb, toteAdressen, netflixOhneKennung }
}
