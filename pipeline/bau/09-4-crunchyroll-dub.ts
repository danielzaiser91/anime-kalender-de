import { readJson, log, slugify, discSlug, writeJson } from '../lib/util.ts'
import {
  type CrDubData,
  beurteile,
  deutscheFolgenNachDemEnde,
  beurteileNachFolgennummern,
  beurteileJeBlock,
  beurteileBlockketten,
  beurteileTeilblock,
  kapitelImBlock,
} from '../lib/crunchyroll-dub.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { alleTermine, ausgelassen as termineAusgelassen, beobachtungenAusBlock } from '../lib/crunchyroll-termine.ts'
import { beobachtungenZusammenfuehren } from '../lib/crunchyroll.ts'
import { meldeAnClaude } from '../lib/meldung.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

export function werteCrunchyrollDubAus({ crDub, titles, usNeinWiderlegt, verweiseEntfernt, katalogEintraege, anisearch, releases }: {
  titles: Map<number, Title>
  usNeinWiderlegt: (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null; }) => boolean
  verweiseEntfernt: EntfernterVerweis[]
  katalogEintraege: KatalogEintrag[]
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  crDub: CrDubData
}) {
  if (crDub.serien.length) {
    const nachUrl = new Map<string, Title[]>()
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'crunchyroll') continue
        const liste = nachUrl.get(stream.url) ?? []
        liste.push(title)
        nachUrl.set(stream.url, liste)
      }
    }
    let belegt = 0
    let verschwunden = 0
    let usNeinOffen = 0
    /**
     * Was entfernt wurde, und warum — der Datenbestand behält es.
     *
     * Daniel am 27.08.2026: „wenn du für tracking zwecke intern die links
     * weiterhin benötigst kannst du sie im datenbestand bestehen lassen und
     * entsprechend markieren. auf der webseite sichtbar für user sollten sie
     * jedenfalls nicht werden."
     *
     * `data/` ist der Bestand, `public/data/` die Auslieferung. Die Trennung
     * ist genau die gewünschte: Hier steht jeder entfernte Verweis mit Grund
     * und Prüfdatum, ausgeliefert wird er nicht.
     */
    /* Die Liste steht weiter oben auf Funktionsebene — auch spätere
       Entfernungen sollen hineinschreiben, nicht nur die dieses Blocks. */
    for (const serie of crDub.serien) {
      /**
       * „Leider sind die Videos dieser Serie nicht mehr verfügbar."
       *
       * Crunchyroll sagt es selbst — dann gibt es dort kein Angebot mehr, und
       * ein Verweis darauf führt Besucher ins Leere. Das ist `available: false`
       * und ausdrücklich **nicht** `dub: false`: Es fehlt das Angebot, nicht die
       * deutsche Fassung (Daniel, 21.08.2026, an „Dragon Ball" gezeigt).
       *
       * Der Verweis wird entfernt, so wie bei jeder anderen toten Adresse auch.
       * Kommt die Serie zurück, bringt der nächste Katalogabruf sie mit.
       */
      /**
       * **Kein Block im deutschen Katalog heißt: dort läuft nichts.**
       *
       * Bis zum 27.08.2026 galt nur Crunchyrolls ausdrückliches „Leider sind
       * die Videos dieser Serie nicht mehr verfügbar" als Nein. Daneben stand
       * ein zweiter Fall, der genauso endet und nichts auslöste: Die
       * Content-API antwortet mit HTTP 200 und **null Staffeln**.
       *
       * 287 unserer Verweise sind so. Der Grund, sie stehen zu lassen, war
       * Vorsicht: Der erste Beleg war lange Crunchyrolls Fehlerseite aus
       * **US**-Sicht, und `CLAUDE.md` verlangt deshalb einen zweiten. Der liegt
       * jetzt vor, und beide stammen aus Deutschland:
       *
       *  1. Die Content-API mit deutschem Token (`katalog: de`) findet unter
       *     der Serienkennung keine einzige Staffel.
       *  2. Die Suche im deutschen Katalog findet den Titel nicht — während
       *     dieselbe Suche „Detektiv Conan", „Fairy Tail", „Frieren" und
       *     „JUJUTSU KAISEN" auf Anhieb und exakt trifft.
       *
       * Dazu Daniels Augenschein vom 27.08.2026 an drei Stichproben aus seiner
       * angemeldeten deutschen Sitzung — Witch Hunter Robin, Trinity Blood,
       * Chrono Crusade: dreimal „Keine Videos verfügbar", mit Bild.
       *
       * Seine Ansage dazu: „auf unserem kalender sollen nur funktionierende
       * links angezeigt werden." Ein Verweis, der auf eine Fehlermeldung führt,
       * ist schlechter als kein Verweis — er kostet einen Klick und liefert
       * nichts.
       *
       * **Verloren geht dabei nichts.** Was entfernt wird, steht mit Grund und
       * Datum in `data/verweise-entfernt.json`; kommt die Serie zurück, bringt
       * der nächste Katalogabruf sie mit, denn der liest den Katalog, nicht
       * unseren Bestand.
       *
       * Zwei Bedingungen halten die Regel eng: Es braucht eine **Serienkennung**
       * (sonst wurde gar nicht richtig gefragt) und den **deutschen** Katalog
       * (`katalog: de`). Ein Befund aus dem US-Katalog entfernt weiterhin nichts
       * — das ist genau der Fehler, vor dem `CLAUDE.md` warnt.
       */
      const ohneBlock = Boolean(serie.seriesId) && serie.katalog === 'de' && !(serie.staffeln ?? []).length
      if (usNeinWiderlegt(serie)) {
        usNeinOffen++
        continue
      }
      if (serie.nichtVerfuegbar || ohneBlock) {
        for (const title of nachUrl.get(serie.url) ?? []) {
          const vorher = title.streams.length
          title.streams = title.streams.filter(
            (s) => !(s.platform === 'crunchyroll' && s.url === serie.url),
          )
          const weg = vorher - title.streams.length
          verschwunden += weg
          if (weg) {
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: serie.url,
              seriesId: serie.seriesId ?? null,
              grund: serie.nichtVerfuegbar
                ? 'Crunchyroll meldet: Videos dieser Serie nicht mehr verfügbar'
                : 'deutscher Katalog führt unter dieser Kennung keine einzige Staffel',
              geprueftAm: serie.geprueftAm ?? null,
              entferntAm: todayIso(),
              /* Bleibt der Titel danach ganz ohne Weg? Das gehoert ins Protokoll. */
              letzterWeg: title.streams.length === 0,
            })
          }
        }
        continue
      }
      for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        belegt++
      }
    }

    /*
      **Was Crunchyroll je Folge weiß, gehört an den Verweis.**

      Daniel am 12.09.2026 an „Das Band der Unterwelt": Im Panel stand „8 von 24
      Folgen auf Deutsch", während Crunchyroll 19 führte. Die 8 kam von Disney+,
      wo ein Handbeleg Folgen 1–8 nennt — und die Regel im Panel lautet zu
      Recht: Sobald **ein** Verweis Bereiche belegt, entscheiden nur noch diese.
      Der Crunchyroll-Verweis trug keine.

      Gemessen am selben Tag: Von 625 Crunchyroll-Verweisen mit `dub: true`
      trugen **625 minus einen** keine Bereiche, obwohl `crunchyroll-dub.json`
      23.404 deutsche Folgen mit Nummern führt. Das Wissen lag im Haus und kam
      nie an — dieselbe Klasse wie „Eine Datei zu schreiben ist nicht dasselbe
      wie sie zu benutzen" (CLAUDE.md).

      **Streng, wie bei den Terminen.** Übernommen wird nur, wo nichts zu raten
      ist: genau ein Titel an dieser Adresse, genau ein Block mit deutschen
      Folgen, und dessen Folgenzahl passt zu unserer. Sonst entscheidet die
      Zuordnung über das Ergebnis, und eine falsche Bereichsangabe behauptet
      etwas über einzelne Folgen — schlimmer als gar keine.

      Ein Handbeleg wird nie überschrieben: Er ist gemessen, das hier ist
      abgeleitet.
    */
    let bereicheNeu = 0
    for (const serie of crDub.serien) {
      const unsere = nachUrl.get(serie.url) ?? []
      if (unsere.length !== 1) continue
      const title = unsere[0]!
      const stream = title.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
      if (!stream || stream.dub !== true || stream.dubRanges?.length) continue
      const bloecke = (serie.staffeln ?? []).filter((st) => (st.deutscheFolgen ?? []).length)
      if (bloecke.length !== 1) continue
      const nummern = [
        ...new Set(
          (bloecke[0]!.deutscheFolgen ?? [])
            .map((f) => Number(f.nummer))
            .filter((n) => Number.isFinite(n) && n >= 1),
        ),
      ].sort((a, b) => a - b)
      if (!nummern.length) continue
      /* Mehr deutsche Folgen als der Titel hat, heißt: Der Block ist nicht seiner. */
      if (title.episodes && nummern[nummern.length - 1]! > title.episodes) continue
      /* Neu beginnende Nummern: Die laufende Nummer entscheidet (Captain Tsubasa, 17.09.2026). */
      if (deutscheFolgenNachDemEnde(bloecke, title.episodes)) continue
      const bereiche: { from: number; to: number; dub: boolean }[] = []
      for (const n of nummern) {
        const letzter = bereiche[bereiche.length - 1]
        if (letzter && n === letzter.to + 1) letzter.to = n
        else bereiche.push({ from: n, to: n, dub: true })
      }
      /* „Alle Folgen deutsch" sagt der Kasten ohnehin — ein Bereich über alles ist Ballast. */
      if (bereiche.length === 1 && bereiche[0]!.from === 1 && bereiche[0]!.to === (title.episodes ?? 0)) continue
      stream.dubRanges = bereiche
      bereicheNeu++
    }
    if (bereicheNeu) log(`${bereicheNeu} Crunchyroll-Verweise mit Folgenbereichen aus dem Dub-Bestand`)

    /**
     * Zweite Runde: über die **Serienkennung** statt über die Adresse.
     *
     * Dieselbe Crunchyroll-Serie steht bei uns unter mehreren Schreibweisen —
     * `http://…/golden-kamuy`, `https://…/golden-kamuy` und
     * `…/series/GY8DWQN5Y/golden-kamuy` sind für die Zuordnung drei verschiedene
     * Töpfe, obwohl `seriesId` dreimal `GY8DWQN5Y` lautet. Unsere fünf
     * Golden-Kamuy-Staffeln verteilen sich genau so und kommen über die Adresse
     * nie zusammen.
     *
     * Erst zusammen ergeben sie die Summe, die `beurteileNachFolgennummern`
     * braucht: 12+12+12+13+13 = 62, und genau bis 62 zählt Crunchyroll dort
     * seine deutschen Folgen (Daniels Vorschlag vom 23.08.2026, die Zuordnung
     * episodenspezifisch statt über Blockgrößen zu machen).
     *
     * Diese Runde läuft **nach** der ersten und respektiert deren Ergebnis:
     * Was schon ein Urteil hat, wird nicht angefasst.
     */
    const nachSerienId = new Map<string, { serie: (typeof crDub.serien)[number]; titel: Map<number, Title> }>()
    for (const serie of crDub.serien) {
      if (!serie.seriesId || serie.nichtVerfuegbar) continue
      const eintrag = nachSerienId.get(serie.seriesId) ?? { serie, titel: new Map<number, Title>() }
      // Der Eintrag mit den meisten Folgendaten gewinnt — Adressen derselben
      // Serie tragen unterschiedlich viel, je nachdem wann sie geholt wurden.
      const bisher = (eintrag.serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      const jetzt = (serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      if (jetzt > bisher) eintrag.serie = serie
      for (const t of nachUrl.get(serie.url) ?? []) eintrag.titel.set(t.id, t)
      nachSerienId.set(serie.seriesId, eintrag)
    }
    let ueberNummern = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      for (const urteil of beurteileNachFolgennummern(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        ueberNummern++
      }
    }
    if (ueberNummern) log(`${ueberNummern} weitere über die durchgezählten Folgennummern belegt`)

    /**
     * Dritte Runde: **je Titel der passende Block**, wo die Gesamtrechnung
     * scheitert.
     *
     * Die beiden Runden davor verlangen, dass unsere Einträge die Blöcke einer
     * Serie vollständig decken. Das ist bei `dub: false` richtig und bei
     * `dub: true` zu streng: Gemessen am 26.08.2026 lag für 60 Titel die
     * deutsche Fassung in den Daten und bekam trotzdem kein Urteil, weil
     * irgendein Nachbarblock nicht aufging — „One-Punch Man" an einem
     * Ein-Folgen-Block, „PSYCHO-PASS 2" an einer gleich langen Extended Edition,
     * „Durarara!!" an 24 gegen 25 Folgen.
     *
     * Diese Runde setzt ausschließlich `true` und nur bei Namensgleichheit.
     * 23 Titel bekommen dadurch ein Urteil, das die Daten längst hergaben.
     */
    let jeBlock = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      for (const urteil of beurteileJeBlock(serie, offene)) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        jeBlock++
      }
    }
    if (jeBlock) log(`${jeBlock} weitere über den Blocknamen belegt`)

    /*
      **Vierte Runde: ein Block deckt mehrere unserer Staffeln.**

      Crunchyroll bündelt, wo wir trennen: „Dr. STONE Season 3" führt 22
      deutsche Folgen, bei uns sind das „New World" (11) und „New World Cour 2"
      (11). Für `beurteileNachFolgennummern` ist das nichts, weil dort jeder
      Block bei 1 zu zählen beginnt; für `beurteileJeBlock` auch nicht, weil
      der Name nicht passt.

      `beurteileBlockketten` legt die Blöcke der Reihe nach auf unsere nach
      Jahr sortierten Einträge und verlangt, dass die Summen **exakt** aufgehen.
      Gemessen am 29.08.2026 an fünfzehn offenen TV-Verweisen.
    */
    let ketten = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      /* Die Kette rechnet über **alle** Einträge der Adresse, nicht nur die offenen. */
      for (const urteil of beurteileBlockketten(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        ketten++
      }
    }
    if (ketten) log(`${ketten} weitere über Blockketten belegt (ein Block deckt mehrere Staffeln)`)

    /*
      **Fünfte Runde: ein Block, den ein Titel und sein zweiter Teil zusammen füllen.**

      Die Kette oben bricht ab, sobald **ein** Block der Adresse unvollständig deutsch ist —
      bei Sword Art Online ist das „Alicization" (25 Folgen, 24 deutsch), und deshalb blieb
      „War of Underworld – Teil 2" ohne Urteil, obwohl sein Block restlos deutsch ist.
      `beurteileTeilblock` sieht jeden Block für sich an und verlangt Blocknamen, Teil-Namen
      und exakte Summe zugleich; gemessen am 23.09.2026: acht Treffer, sieben davon
      Bestätigungen vorhandener Urteile, kein Widerspruch.
    */
    let teilbloecke = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      const offene = [...gruppe.values()].filter((t) =>
        t.streams.some((s) => s.platform === 'crunchyroll' && s.dub === undefined),
      )
      if (!offene.length) continue
      /* Gerechnet wird über **alle** Einträge der Adresse — der erste Teil hat oft schon ein Urteil. */
      for (const urteil of beurteileTeilblock(serie, [...gruppe.values()])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        teilbloecke++
      }
    }
    if (teilbloecke) log(`${teilbloecke} weitere über Teilblöcke belegt (Titel plus zweiter Teil füllen einen Block)`)

    /**
     * **Ein deutscher Block, den keiner unserer Titel führt — das Special.**
     *
     * Der teuerste Fall dieser Woche (Daniel, 12.09.2026): „Lord of Mysteries"
     * führt bei Crunchyroll vier Blöcke. Unser Datensatz kannte nur den ersten,
     * denn die drei anderen sind bei AniList **eigene Einträge** — Specials,
     * Chibi-Kurzfilme, der nächste Arc. Am 10.09.2026 erschienen die drei
     * Specials auf Deutsch; auf der Seite stand davon nichts, und zwar nicht
     * wegen eines fehlenden Abrufs: `beurteile()` fragt nur Titel, die diese
     * Adresse schon **tragen**. Ein Titel ohne Verweis wird nie beurteilt, und
     * ohne Urteil bekommt er keinen Verweis — eine Warteschlange, die ihre
     * eigene Lücke bewacht (dieselbe Klasse wie in `CLAUDE.md`, „Eine
     * Warteschlange, die sich aus dem Bestand bildet").
     *
     * Diese Runde schließt sie, und zwar eng:
     *
     * - Der Block muss **vollständig deutsch** sein (`deutsch === folgen`).
     * - Keiner der Titel dieser Adresse darf dieselbe Folgenzahl haben — sonst
     *   gehört der Block ihm, nicht einem Geschwister.
     * - Unter den Geschwistern derselben Reihe darf es **genau einen** Titel
     *   mit dieser Folgenzahl geben, und der darf noch keinen
     *   Crunchyroll-Verweis tragen.
     *
     * Bleibt es mehrdeutig, passiert nichts: Eine falsche Zuordnung behauptet
     * eine Sprachfassung über den falschen Titel, und das ist schlimmer als
     * eine Lücke, die eine Zeile im Log nennt.
     */
    let geschwisterBloecke = 0
    for (const { serie, titel: gruppe } of nachSerienId.values()) {
      if (serie.katalog !== 'de' || !serie.deutschImAngebot || serie.nichtVerfuegbar) continue
      const unsere = [...gruppe.values()]
      if (!unsere.length) continue
      const reihe = unsere[0]!.franchiseId ?? unsere[0]!.id
      const belegteZahlen = new Set(unsere.map((t) => t.episodes).filter(Boolean))
      for (const block of serie.staffeln ?? []) {
        const zahl = block.folgen ?? 0
        if (!zahl || block.deutsch !== zahl) continue
        if (belegteZahlen.has(zahl)) continue
        /* Geschwister aus dem Bestand **und** aus dem Katalog — das Special steht meist dort. */
        const ausBestand = [...titles.values()].filter(
          (t) => (t.franchiseId ?? t.id) === reihe && t.id !== reihe && t.episodes === zahl,
        )
        const ausKatalog = katalogEintraege.filter(
          (e) =>
            e.folgen === zahl &&
            !titles.has(e.id) &&
            (e.eltern ?? []).some((x) => unsere.some((t) => t.id === x)),
        )
        const treffer = [...ausBestand.map((t) => t.id), ...ausKatalog.map((e) => e.id)]
        if (treffer.length !== 1) continue
        const id = treffer[0]!
        let ziel = titles.get(id)
        if (!ziel) {
          const e = katalogEintraege.find((x) => x.id === id)!
          const anzeige = e.t[1] ?? e.latein ?? e.t[0] ?? String(e.id)
          ziel = {
            id: e.id,
            slug: `${slugify(anzeige)}-${e.id}`,
            keywords: [],
            dubConfidence: 'low' as const,
            titleRomaji: e.t[0] ?? undefined,
            titleEn: e.t[1] ?? e.latein ?? undefined,
            titleNative: e.t[2] ?? undefined,
            format: e.format ?? undefined,
            jpYear: e.jahr ?? undefined,
            episodes: e.folgen ?? undefined,
            genres: e.genres?.length ? [...e.genres] : [],
            coverImage: e.cover ? `https://s4.anilist.co/file/anilistcdn/media/anime/cover/${e.cover}` : undefined,
            streams: [],
            franchiseId: reihe,
          }
          titles.set(e.id, ziel)
        }
        if (ziel.streams.some((x) => x.platform === 'crunchyroll')) continue
        ziel.streams.push({ platform: 'crunchyroll', url: serie.url, dub: true })
        geschwisterBloecke++
        log(
          `  Crunchyroll-Block „${block.name}" (${zahl} Folgen, deutsch) dem Titel ${ziel.id} ` +
            `(${ziel.titleDe ?? ziel.titleEn ?? ziel.titleRomaji}) zugeordnet`,
        )
      }
    }
    if (geschwisterBloecke)
      log(`${geschwisterBloecke} deutsche Blöcke einem Geschwistertitel zugeordnet, der bisher keinen Weg hatte`)


    /**
     * **Fünfte Runde: Filme und Specials, die der Katalog einzeln führt.**
     *
     * Die Suche nach Serienkennungen läuft mit `type=series` — Filme findet sie
     * nie. Am 29.08.2026 hatten 26 der 56 offenen Verweise deshalb keine
     * Kennung, davon 18 Filme. `data:cr-einzelwerke` sucht ohne Typ-Filter und
     * findet sie als `movie_listing`, mit ihren Tonspuren.
     *
     * **Der Beleggrad ist derselbe wie bei einer Serie:** Der deutsche Katalog
     * nennt für diesen Titel `de-DE`. Der Namensvergleich ist exakt (nach
     * Kleinschreibung ohne Sonderzeichen) — ein Film hat keinen zweiten
     * Prüfstein, keine Folgenzahl und keine Staffelstruktur, deshalb wird hier
     * nichts geraten.
     *
     * **Nur Ja, kein Nein.** Findet der Katalog den Film nicht, heißt das „hier
     * nicht geführt" — und daraus wird kein `dub: false` (CLAUDE.md).
     */
    let einzeln = 0
    for (const eintrag of readJson<
      { id: number; treffer?: { audio?: string[] } | null }[]
    >('data/cr-einzelwerke.json', [])) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      einzeln++
    }
    if (einzeln) log(`${einzeln} Filme/Specials über den deutschen Katalog belegt (Einzelwerk-Suche)`)

    /**
     * **Sechste Runde: der Film hat einen eigenen Block in einer Filmreihe.**
     *
     * Crunchyroll führt Filmreihen als eigene Serie — „Fairy Tail Movies" mit
     * je einem Block pro Film, jeder mit eigener Sprachangabe. Unser Eintrag
     * „Fairy Tail: The Movie - Phoenix Priestess" findet dort seinen Block; die
     * Serie „Fairy Tail" mit ihren 175 deutschen Folgen sagt über ihn nichts.
     *
     * Verglichen wird das **Kennwort** — „Phoenix Priestess" —, nicht der ganze
     * Name: Reihenname und Nummerierung schreibt jede Seite anders.
     *
     * Auch hier nur Ja: Wird kein Block gefunden, heißt das „nicht gefunden".
     */
    let filmbloecke = 0
    for (const eintrag of readJson<{ id: number; treffer?: { audio?: string[] } | null }[]>(
      'data/cr-filmbloecke.json',
      [],
    )) {
      if (!eintrag.treffer?.audio?.includes('de-DE')) continue
      const title = titles.get(eintrag.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      filmbloecke++
    }
    if (filmbloecke) log(`${filmbloecke} Filme/Specials über ihren eigenen Block in einer Filmreihe belegt`)

    /**
     * **Ein Kapitel ist eine Folge im Block der Filmreihe.**
     *
     * Crunchyroll führt „Princess Principal: Crown Handler" als **einen** Block
     * mit vier Folgen („Crown Handler I" bis „IV"), unser Bestand vier Filme
     * „… - Chapter 1" bis „4". Deutsch sind nur I und II (17.09.2026, deutscher
     * Katalog, je Folge). Zugeordnet wird, wenn der Name ohne „Chapter N" genau
     * einen Block derselben Adresse benennt und N in dessen Folgenzahl liegt.
     * Gemessen über den Bestand: genau diese vier Filme, das Kurz-OVA „Chapter
     * 1: BUSY EASY MONEY" fällt zu Recht heraus. Nur aus dem deutschen Katalog
     * wird daraus ein Nein.
     */
    {
      let kapitel = 0
      const crNachAdresse = new Map(crDub.serien.map((s) => [s.url, s]))
      for (const title of titles.values()) {
        for (const stream of title.streams) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const serie = crNachAdresse.get(stream.url)
          const urteil = serie ? kapitelImBlock(serie, title) : undefined
          if (urteil === undefined) continue
          stream.dub = urteil
          kapitel++
        }
      }
      if (kapitel) log(`${kapitel} Kapitel einer Filmreihe über ihre Folge im Block beurteilt`)
    }

    /**
     * **Siebte Runde: der Abgleich gegen den vollständigen deutschen Katalog.**
     *
     * `discover/browse` gibt ihn ganz heraus — 1.591 Einträge in 16 Abrufen.
     * Danach braucht es keine Suchanfrage mehr, und Titel, die dort völlig
     * anders heißen, finden trotzdem ihren Eintrag: „Fruits Basket: Prelude"
     * steht im Katalog als **„-prelude-"**.
     *
     * **Der Filter ist streng, und das ist der Kern.** Ein Namensteil trifft
     * immer den Reihennamen; ein erster Versuch ordnete 16 von 30 zu, davon die
     * Mehrzahl falsch („One Punch Man OVAs" → „One-Punch Man"). Verlangt wird
     * deshalb ein zweites, **zählbares** Merkmal: die Folgenzahl, bei einem Film
     * 0 oder 1. Übrig bleibt einer — und der ist richtig.
     */
    let ausKatalog = 0
    for (const z of readJson<{ id: number; audio?: string[] }[]>('data/cr-katalog-zuordnung.json', [])) {
      if (!z.audio?.includes('de-DE')) continue
      const title = titles.get(z.id)
      const stream = title?.streams.find((s) => s.platform === 'crunchyroll')
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) log(`${ausKatalog} über den vollständigen deutschen Katalog belegt`)

    /**
     * **Achte Runde: die Serienkennung aus der Adresse gegen den Katalog.**
     *
     * Die Runde darüber gleicht **Namen** ab und ist deshalb streng gefiltert —
     * ein Namensteil trifft immer den Reihennamen. Wo der Verweis aber selbst
     * eine Serienkennung trägt (`crunchyroll.com/de/series/GXXXXXXXX/…`),
     * braucht es keinen Namensabgleich: Die Kennung steht in beiden Beständen,
     * und `data/cr-katalog-de.json` nennt zu ihr die Tonspuren.
     *
     * Das ist derselbe Unterschied, der die RTL+-Umstellung am 07.09.2026
     * tragfähig gemacht hat: **Zeichenkette gegen Zeichenkette statt Name gegen
     * Name.** An den Fällen, an denen dieses Projekt gescheitert ist
     * (`To Love-Ru`, `Wolf's Rain OVA`, die 16 Katalogzuordnungen vom
     * 29.08.2026), war der Name jedes Mal das einzige Merkmal.
     *
     * **Der Katalog ist der deutsche** — er entsteht mit einem anonymen Token,
     * dessen Region die der abrufenden IP ist, und läuft deshalb von Daniels
     * Rechner (siehe `refresh-weekly.yml`). Damit gilt hier die Regel aus
     * `CLAUDE.md`: Aus **diesem** Katalog ist auch ein fehlendes `de-DE` ein
     * Beleg — anders als aus dem US-Katalog, wo es gar nichts heißt.
     *
     * **Eine Serie ohne Folgen wird übersprungen.** `folgen: 0` steht im
     * Katalog für Einträge ohne abrufbare Folgen; über deren Tonspuren sagt die
     * Liste nichts Belastbares.
     *
     * Gemessen am 07.09.2026: vier der 52 offenen Crunchyroll-Verweise tragen
     * eine Kennung, die der Katalog führt — drei mit `de-DE`, einer ohne.
     */
    let ausKennung = 0
    {
      const katalog = readJson<{
        geholtAm?: string
        eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
      }>('data/cr-katalog-de.json', {})
      const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
      /**
       * **Die Kennung steht nicht immer in der Adresse — dann steht sie im Gedächtnis.**
       *
       * Crunchyrolls alte Slug-Form (`/de/<name>`) trägt keine Serienkennung,
       * und diese Runde stieg dort bisher aus. Gemessen am 07.09.2026: **43
       * der 44 offenen Crunchyroll-Verweise** haben genau diese Form.
       *
       * `data/crunchyroll-series-ids.json` löst sie längst auf — jede der 396
       * betroffenen Adressen steht dort, mit Kennung und Prüfdatum. Gelesen hat
       * die Datei nur `scrape-crunchyroll-dub.ts`, also der Abruf, der sie
       * schreibt. Wieder der Fall aus `CLAUDE.md`: „Eine Datei zu schreiben ist
       * nicht dasselbe wie sie zu benutzen."
       *
       * Der Gewinn ist heute klein — drei Verweise, alle mit belegtem Nein —
       * und wächst mit jeder Serie, die der Katalog künftig führt. Die übrigen
       * 29 hängen am Franchise-Problem: Ihre Kennung nennt mehrere Blöcke, und
       * welcher unsere Staffel ist, sagt die Serienebene nicht.
       */
      const kennungsGedaechtnis = readJson<{ adressen?: Record<string, { seriesId?: string }> }>(
        'data/crunchyroll-series-ids.json',
        {},
      ).adressen
      const kernVon = (u: string): string =>
        u
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('?')[0]!
          .replace(/\/$/, '')
          .toLowerCase()
      const kennungJeAdresse = new Map(
        Object.entries(kennungsGedaechtnis ?? {})
          .filter(([, v]) => v.seriesId)
          .map(([u, v]) => [kernVon(u), v.seriesId as string]),
      )
      /*
        Eine Staffel im Katalog kann trotzdem zwei Werke tragen: Captain Tsubasa
        2018 und „Junior Youth" liegen unter `GZJH3D7G9` in einem Block, deutsch
        sind nur die laufenden Nummern 53–91 (17.09.2026). Die laufende Nummer
        aus dem Prüflauf sperrt das Ja. Gemessen über 106 Kandidaten dieser
        Runde: genau dieser eine Fall. Die breitere Regel „Katalog hat mehr
        Folgen als der Titel" träfe 24, fast alle zu Recht deutsch (geteilte
        Cours wie 86 oder Dead Mount Death Play).
      */
      const crBloeckeJeKennung = new Map(
        crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.staffeln ?? []]),
      )
      const hinterDemEnde = (kennung: string, title: Title): boolean =>
        deutscheFolgenNachDemEnde(crBloeckeJeKennung.get(kennung) ?? [], title.episodes)
      if (nachKennung.size) {
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
            const kennung =
              /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1] ?? kennungJeAdresse.get(kernVon(stream.url))
            if (!kennung) continue
            const eintrag = nachKennung.get(kennung)
            if (!eintrag || !eintrag.folgen) continue
            if (hinterDemEnde(kennung, title)) continue
            /*
              **Nur wo die Serie genau ein Werk ist.**

              Der Katalog antwortet auf **Serienebene**, und eine Serienkennung
              bei Crunchyroll ist ein Franchise: `GRDQV2VWY` heißt „Free! -
              Iwatobi Swim Club" und führt **neun** Staffeln mit 51 Folgen. Ein
              `de-DE` dort sagt nichts über „Free! Take Your Marks", einen Film
              — genau dieses falsche Ja hätte die erste Fassung dieser Runde am
              07.09.2026 gesetzt.

              Widerlegt hat es Bofuri: Der Katalog meldet `de-DE` für die Serie,
              der Prüflauf fand **12 deutsche Folgen in Staffel 1 und null in
              Staffel 2** — und unser Titel ist Staffel 2. Dieselbe Lehre steht
              seit dem 25.08.2026 in `CLAUDE.md` („Eine Serie ist bei
              Crunchyroll kein Block"); sie beim Bauen nicht angewandt zu haben,
              war der Fehler.

              **Bei genau einer Staffel fallen Serie und Werk zusammen**, und
              dann trägt die Angabe. 321 der 1.589 Katalogeinträge (20 %) tun
              das nicht — für sie bleibt der Verweis offen, bis der Prüflauf je
              Folge antwortet.
            */
            if ((eintrag.staffeln ?? 0) !== 1) continue
            stream.dub = (eintrag.audio ?? []).includes('de-DE')
            ausKennung++
          }
        }
        /**
         * **Der jüngere Katalog überstimmt ein älteres Nein.**
         *
         * Das ist Daniels eigentliche Kill-Blue-Meldung vom 07.09.2026: „im
         * anime-kalender hat dieser eintrag gar keine crunchy-pill, also
         * behaupten wir es wäre nicht synchronisiert auf crunchy."
         *
         * Die Runde darüber fasst nur unbeurteilte Verweise an, und der von
         * Kill Blue war beurteilt — mit einem **16 Tage alten** Befund:
         *
         * | Quelle | Stand | Aussage |
         * |---|---|---|
         * | `crunchyroll-dub.json`, Serie `GT00371896` | **22.08.2026** | `deutschImAngebot: true`, Staffel 1 mit **0** deutschen Folgen |
         * | `cr-katalog-de.json`, derselbe Eintrag | **07.09.2026, 06:44** | `audio` enthält **`de-DE`** |
         *
         * Der ältere Befund gewann, der Verweis flog mit „belegtes Nein" heraus
         * — und der Kalender behauptete das Gegenteil der Wirklichkeit. Am
         * 06.09. sind dort die Folgen 1–8 auf Deutsch erschienen.
         *
         * Damit ist es derselbe Fehler wie beim Gedächtnis der entfernten
         * Verweise (Frist von 28 Tagen, weiter unten): **Ein Nein ist eine
         * Aussage über einen Tag, nicht über alle Zeit.** Nur steht hier eine
         * jüngere Messung daneben, die es widerlegt — es braucht also gar keine
         * Frist, sondern nur den Blick auf das Datum.
         *
         * **Nur in diese Richtung.** Ein `de-DE` im Katalog hebt ein Nein auf;
         * ein fehlendes `de-DE` hebt umgekehrt **kein** Ja auf. Der Katalog
         * antwortet auf Serienebene, und die Trennung „Serie ist kein Block"
         * gilt unverändert — deshalb weiterhin nur bei genau einer Staffel.
         */
        const dubStand = crDub.scrapedAt?.slice(0, 10) ?? ''
        const katalogStand = (katalog.geholtAm ?? '').slice(0, 10)
        let ausKatalogNeuer = 0
        const geprueftJe = new Map(
          crDub.serien.filter((s) => s.seriesId).map((s) => [s.seriesId as string, s.geprueftAm ?? dubStand]),
        )
        for (const title of titles.values()) {
          for (const stream of title.streams) {
            if (stream.platform !== 'crunchyroll' || stream.dub !== false) continue
            const kennung = /\/series\/([A-Z0-9]+)/.exec(stream.url)?.[1]
            if (!kennung) continue
            const eintrag = nachKennung.get(kennung)
            if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
            if (!(eintrag.audio ?? []).includes('de-DE')) continue
            if (hinterDemEnde(kennung, title)) continue
            /* Nur wenn der Katalog wirklich jünger ist als die Messung, die das Nein trug. */
            if (katalogStand <= (geprueftJe.get(kennung) ?? '')) continue
            stream.dub = true
            ausKatalogNeuer++
            log(
              `  ${title.titleDe ?? title.id}: Nein vom ${geprueftJe.get(kennung)} durch den Katalog vom ${katalogStand} überholt`,
            )
          }
        }
        if (ausKatalogNeuer)
          log(`${ausKatalogNeuer} Nein(s) vom Katalog überholt: er ist jünger und führt de-DE`)
      }
      if (ausKennung) log(`${ausKennung} über die Serienkennung im deutschen Katalog belegt`)
    }

    /**
     * **Die Verweise, die alle Runden davor nicht beurteilen konnten.**
     *
     * Daniel am 07.09.2026: „39 Fragezeichen? wir haben crunchyroll
     * automatisiert, es sollte 0 fragezeichen geben." Gemessen am 09.09.2026
     * blieben 34 übrig, und keiner davon aus einem Fehler: 27 tragen eine
     * Adresse im alten Format ohne Serienkennung, der Rest sind Filme und OVAs,
     * die eine Serienrunde bauartbedingt nicht beurteilt.
     *
     * `pipeline/fetch-crunchyroll-offene.ts` geht sie einzeln an — Kennung aus
     * der Adresse auflösen, sonst die Serie im Katalog suchen und ihre
     * **Staffelliste** lesen. Hier wird nur angewandt, was dort belegt wurde.
     *
     * **Ein `tot` ist kein Sprachurteil.** Die Videokennung ist abgelaufen, die
     * Adresse führt ins Leere; der Verweis fliegt weiter unten über dieselbe
     * Regel wie jede andere tote Adresse. Ihn hier auf `dub: false` zu setzen
     * hieße, ein fehlendes Angebot als „ohne deutschen Ton" auszugeben — die
     * Unterscheidung, die `DubCheck.available` seit dem 12.08.2026 zieht.
     */
    {
      const offene = readJson<Record<string, { herkunft?: string; dub?: boolean; grund?: string }>>(
        'data/crunchyroll-offene.json',
        {},
      )
      let ausOffenen = 0
      let toteOffene = 0
      for (const title of titles.values()) {
        for (const stream of [...title.streams]) {
          if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
          const b = offene[stream.url]
          if (!b) continue
          /**
           * **Ein `tot` wurde gezählt und nie angewandt — 11 Verweise standen so
           * dauerhaft auf „🇩🇪 ?".**
           *
           * Der Kommentar darüber sagte, der Verweis fliege „weiter unten über
           * dieselbe Regel wie jede andere tote Adresse". Die Regel gibt es, nur
           * kennt sie diese Adressen nicht: Sie läuft über `crDub.serien`, also
           * über die Serien, die der wöchentliche Lauf geprüft hat. Was
           * `fetch-crunchyroll-offene.ts` als tot belegt, steht dort nicht.
           *
           * Gemessen am 10.09.2026: 28 Verweise ohne Sprachurteil im Datensatz,
           * 17 davon beim Lauf offen — und **11 als tot beurteilt**, ohne jede
           * Wirkung. Die Erklärung vom Vortag („das macht die aniSearch-Nachrunde
           * wieder auf") war falsch: Dem Lauf war keine einzige dieser Adressen
           * unbekannt.
           *
           * Entfernt wird, nicht auf `dub: false` gesetzt: Es fehlt das Angebot,
           * nicht die deutsche Fassung — dieselbe Unterscheidung wie bei
           * „Videos dieser Serie nicht mehr verfügbar".
           */
          if (b.herkunft === 'tot') {
            title.streams = title.streams.filter((s) => s !== stream)
            toteOffene++
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: stream.url,
              seriesId: null,
              grund: b.grund ?? 'Adresse führt ins Leere (fetch-crunchyroll-offene)',
              geprueftAm: null,
              entferntAm: todayIso(),
              letzterWeg: title.streams.length === 0,
            })
            continue
          }
          if (typeof b.dub !== 'boolean') continue
          stream.dub = b.dub
          ausOffenen++
        }
      }
      if (ausOffenen)
        log(`${ausOffenen} Crunchyroll-Verweise über Videokennung oder Staffelliste beurteilt`)
      if (toteOffene)
        log(`${toteOffene} Crunchyroll-Verweise entfernt: die Adresse führt ins Leere (abgelaufene Videokennung oder im deutschen Katalog nicht geführt)`)
    }

    /**
     * **Neunte Runde: der Katalog legt den Verweis an, nicht nur das Urteil.**
     *
     * Die Runde darüber beurteilt einen Verweis, der schon dasteht. Genau daran
     * ist am 07.09.2026 „Kill Blue" gescheitert, von Daniel gemeldet:
     *
     * - Am 24.08. hatte Crunchyroll dort **null** deutsche Folgen — der Verweis
     *   flog zu Recht heraus.
     * - Am **06.09.** erschienen die Folgen 1–8 auf Deutsch.
     * - Der Kalender zeigte weiter keinen Crunchyroll-Weg und behauptete damit
     *   das Gegenteil.
     *
     * **Kein einziger Lauf hätte es finden können**, und das ist der eigentliche
     * Befund:
     *
     * | Lauf | was er sieht |
     * |---|---|
     * | `crunchyroll` (stündlich) | den **Sendekalender** — dort steht Kill Blue nicht, denn eine nachgereichte Katalog-Synchro ist kein Simulcast-Termin |
     * | `crunchyroll-dub` (wöchentlich) | nur Serien, die **schon** einen Verweis haben |
     * | `cr-katalog` | den ganzen deutschen Katalog — läuft aber nicht automatisch, weil er eine deutsche IP braucht |
     *
     * Diese Runde schließt die Lücke: Der Katalog nennt zu jeder Serienkennung
     * ihre Tonspuren. Führt er `de-DE` und der Titel hat keinen
     * Crunchyroll-Weg, entsteht er hier — mit Urteil, denn dieselbe Antwort
     * belegt beides.
     *
     * **Die Zuordnung läuft über die aniSearch-Adresse**, nicht über den Namen.
     * Ein Namensabgleich gegen 1.589 Katalogeinträge ist genau der Fehler, der
     * am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch gemacht hat. Wo
     * aniSearch eine Crunchyroll-Adresse mit Kennung führt, ist die Zuordnung
     * dagegen eine Zeichenkette.
     *
     * **Und nur bei genau einer Staffel** — aus demselben Grund wie eine Runde
     * darüber: Eine Serienkennung ist ein Franchise.
     */
    let ausKatalogNeu = 0
    {
      const katalog = readJson<{
        eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
      }>('data/cr-katalog-de.json', {})
      const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
      if (nachKennung.size) {
        for (const title of titles.values()) {
          if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
          const asCr = (anisearch[title.id]?.streams ?? []).find((q) => q.provider === 'crunchyroll')
          const kennung = /\/series\/([A-Z0-9]+)/.exec(asCr?.url ?? '')?.[1]
          if (!kennung) continue
          const eintrag = nachKennung.get(kennung)
          if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
          if (!(eintrag.audio ?? []).includes('de-DE')) continue
          const url = (asCr?.url ?? '').split('?')[0]!
          title.streams.push({ platform: 'crunchyroll', url, dub: true })
          ausKatalogNeu++
        }
      }
      if (ausKatalogNeu)
        log(`${ausKatalogNeu} Crunchyroll-Wege neu angelegt: der deutsche Katalog führt sie mit deutscher Tonspur`)
    }
    log(`${belegt} Synchro-Angaben aus den Crunchyroll-Serienseiten belegt (${crDub.serien.length} Seiten gelesen)`)
    if (verschwunden) log(`${verschwunden} Crunchyroll-Verweise entfernt — die Serie ist dort nicht mehr verfügbar`)
    if (usNeinOffen) log(`${usNeinOffen} Crunchyroll-Serien mit US-„nicht verfügbar" bleiben offen — der deutsche Katalog führt sie`)
    /*
      **Und aus denselben Daten kommen die Termine.**

      Bis zum 02.09.2026 endete der Crunchyroll-Abschnitt hier: Er beantwortete
      **ob** es eine deutsche Fassung gibt und warf weg, **wann** sie kam —
      obwohl beides in derselben Antwort steht. Der Kalender zeigte für „Die
      Tagebücher der Apothekerin“ deshalb nur eine Blu-ray im September 2026,
      für eine Serie, die seit dem 18.11.2023 vollständig deutsch läuft
      (Daniel, 02.09.2026: „CRUNCHY WIRD VON UNS GESCANNED!!! WIE Kann so
      unglaublich falsche info bei uns stehen???“). 21.689 datierte deutsche
      Folgen lagen ungenutzt im Repo.

      Die Ableitung steht in `lib/crunchyroll-termine.ts` und ist bewusst
      streng: Sie liefert nur, wo genau ein Titel an der Adresse hängt, genau
      ein Block datierte Folgen hat und dessen Folgenzahl exakt zur unseren
      passt. Was sie liegen lässt, lässt sie mit Absicht liegen.
    */
    const crTermine = alleTermine(crDub.serien, nachUrl)
    let termineNeu = 0
    let termineSchonDa = 0
    for (const t of crTermine) {
      const title = titles.get(t.titleId)
      if (!title) continue
      /*
        **Ein vorhandener Streaming-Termin gewinnt.** Was aus dem Kalender oder
        aus einem kuratierten Eintrag stammt, ist näher an der Quelle als eine
        Ableitung — und ein zweites Release derselben Plattform würde
        behaupten, es gäbe die Staffel zweimal.
      */
      const vorhanden = releases.filter((r) => r.titleId === t.titleId && r.platform === 'crunchyroll')
      if (vorhanden.length) {
        /*
          **Ein gemessener Wochentakt schlägt den Aufnahmetag** (Daniel, 20.09.2026, „Das Band
          der Unterwelt"): Die Serie kam als Katalogtitel herein — ein Eintrag vom 04.04.2026,
          `available-from`, alles an einem Tag. Ihre deutsche Fassung erscheint seitdem Folge
          für Folge; Folge 21 lief am 19.09., im Kalender stand nichts. Crunchyrolls
          Simulcast-Kalender kennt solche Titel nicht, die Folgendaten schon.

          Ersetzt wird nur der **Termin**, nicht der Eintrag: Der Slug bleibt, damit die
          Adresse nicht wandert (CLAUDE.md, „Ein Slug ist eine Adresse").
        */
        const sammel = vorhanden.find(
          (r) =>
            r.schedule?.firstEpisodeDate === r.schedule?.lastEpisodeDate &&
            (r.dateMeaning === 'available-from' || r.releaseType === 'batch'),
        )
        if (t.rhythmus !== 'weekly' || !sammel || vorhanden.length > 1) {
          termineSchonDa++
          continue
        }
        sammel.releaseType = 'weekly'
        sammel.dateMeaning = undefined
        sammel.schedule = {
          ...sammel.schedule,
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time ?? sammel.schedule?.time,
          episodeCount: t.episodeCount,
          observed: beobachtungenZusammenfuehren(t.beobachtet, sammel.schedule?.observed),
        }
        sammel.herkunft = `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}"), Sammeldatum ersetzt`
        termineNeu++
        continue
      }
      const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? `Titel ${t.titleId}`
      const adresse = title.streams.find((x) => x.platform === 'crunchyroll')?.url
      releases.push({
        /*
          **Der Slug wird gebaut, nicht gekappt.** `slugify` schneidet bei 80
          Zeichen ab — bei „I Was Reincarnated as the 7th Prince…“ (84 Zeichen)
          fiel damit genau der unterscheidende Teil weg, das Datum, und beide
          Staffeln beanspruchten dieselbe Adresse. Der Bau brach ab: „Termin
          2025-07-30 (Folge 1) liegt nach dem belegten Ende 2024-07-16“ — zwei
          Staffeln in einem Eintrag.

          Denselben Fehler gab es am 30.08.2026 schon einmal bei den
          Disc-Terminen, und `discSlug()` ist die Antwort darauf: Der **Name**
          wird gekappt, das Datum danach angehängt.
        */
        slug: discSlug(`${name} crunchyroll de`, t.firstEpisodeDate),
        titleId: t.titleId,
        name,
        platform: 'crunchyroll',
        platformUrl: adresse,
        releaseType: t.rhythmus,
        schedule: {
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time,
          episodeCount: t.episodeCount,
          /* Die gemessenen Tage je Folge — sonst rechnet die Fortschreibung an Pausen vorbei. */
          ...(Object.keys(t.beobachtet).length ? { observed: t.beobachtet } : {}),
        },
        /*
          **„Im Angebot seit“, wenn alles an einem Tag kam.** Bei einem
          Katalogtitel nimmt Crunchyroll die ganze Staffel auf einmal auf; das
          Datum ist dann der Tag der Aufnahme, nicht der Erstausstrahlung —
          dieselbe Unterscheidung wie bei ADN.
        */
        dateMeaning: t.rhythmus === 'batch' ? 'available-from' : undefined,
        fsk: title.fsk,
        herkunft: `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}“)`,
        year: Number(t.firstEpisodeDate.slice(0, 4)),
        sources: [adresse ?? 'https://www.crunchyroll.com/de'],
      })
      termineNeu++
    }
    /*
      **Was die Ableitung verworfen hat, wird sichtbar** (Daniel, 20.09.2026): Riegel, die
      eine Serie stumm durchfallen lassen, kosten Termine, die niemand vermisst — „Das Band
      der Unterwelt" fehlte ein halbes Jahr. Die Gründe stehen ab jetzt in einer Datei, die
      Zahl im Lauf (Skill `stille-ausfaelle-verhindern`).
    */
    if (termineAusgelassen.length) {
      const jeGrund = new Map<string, number>()
      for (const a of termineAusgelassen) jeGrund.set(a.grund, (jeGrund.get(a.grund) ?? 0) + 1)
      const vorher = readJson<{ jeGrund?: Record<string, number> }>('data/termine-ausgelassen.json', {})
      writeJson('data/termine-ausgelassen.json', {
        erzeugtAm: new Date().toISOString(),
        jeGrund: Object.fromEntries(jeGrund),
        faelle: termineAusgelassen.slice(0, 400),
      })
      /*
        **Ein Zuwachs geht in den Posteingang** (Daniel, 20.09.2026): eine Datei, die niemand
        öffnet, ist keine Meldung. `~/.claude/hooks/posteingang.js` liest
        `data/meldungen-an-claude.jsonl` und nennt neue Zeilen beim nächsten Prompt.
      */
      const gestiegen = [...jeGrund].filter(([g, n]) => n > (vorher.jeGrund?.[g] ?? 0))
      if (gestiegen.length && Object.keys(vorher.jeGrund ?? {}).length) {
        meldeAnClaude(
          'bestand-bauen',
          'warnung',
          `Terminableitung verwirft mehr: ${gestiegen
            .map(([g, n]) => `${g} ${vorher.jeGrund?.[g] ?? 0} → ${n}`)
            .join(', ')}`,
          'data/termine-ausgelassen.json',
        )
      }
      log(
        `Terminableitung übersprungen: ${termineAusgelassen.length} Serien — ` +
          [...jeGrund].map(([g, n]) => `${n}× ${g}`).join(', ') +
          ' (data/termine-ausgelassen.json)',
      )
    }
    if (termineNeu || termineSchonDa)
      log(
        `${termineNeu} deutsche Streaming-Termine aus den Crunchyroll-Folgendaten abgeleitet` +
          (termineSchonDa ? ` (${termineSchonDa} hatten schon einen)` : ''),
      )

    /* Vorhandene Wochentermine bekommen die Tage der Folgen, die das Kalenderfenster nicht sah — siehe `beobachtungenAusBlock()`. */
    const crNachKennung = new Map(crDub.serien.map((s) => [s.seriesId, s]))
    let folgenDatiert = 0
    for (const r of releases) {
      if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || !r.schedule.observed) continue
      const kennung = /series\/([A-Z0-9]+)/.exec(r.platformUrl ?? '')?.[1]
      const serie = kennung ? crNachKennung.get(kennung) : undefined
      if (!serie) continue
      const erste = r.schedule.firstEpisodeNumber ?? 1
      const letzte = erste + (r.schedule.episodeCount ?? 0) - 1
      const neu = Object.entries(beobachtungenAusBlock(serie, r.schedule.observed)).filter(
        ([n]) => Number(n) >= erste && Number(n) <= letzte,
      )
      for (const [n, datum] of neu) r.schedule.observed[Number(n)] = datum
      folgenDatiert += neu.length
    }
    if (folgenDatiert) log(`${folgenDatiert} Crunchyroll-Folgen mit ihrem deutschen Tag nachgetragen (vorher geschätzt)`)

    /* Geschrieben wird erst am Ende — nach der letzten Stelle, die entfernt. */
  }
}
