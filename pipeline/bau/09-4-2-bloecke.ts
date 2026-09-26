import {
  deutscheFolgenNachDemEnde,
  beurteileNachFolgennummern,
  beurteileJeBlock,
  beurteileBlockketten,
  beurteileTeilblock,
  type CrDubData,
} from '../lib/crunchyroll-dub.ts'
import { log, slugify } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'

export function ordneCrBloeckeZu({ crDub, nachUrl, titles, katalogEintraege }: {
  crDub: CrDubData
  nachUrl: Map<string, Title[]>
  titles: Map<number, Title>
  katalogEintraege: KatalogEintrag[]
}) {
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
}
