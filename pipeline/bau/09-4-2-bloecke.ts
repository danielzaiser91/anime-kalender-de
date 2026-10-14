import {
  deutscheFolgenNachDemEnde,
  beurteileNachFolgennummern,
  beurteileJeBlock,
  beurteileBlockketten,
  beurteileTeilblock,
  type CrDubData,
} from '../lib/crunchyroll-dub.ts'
import { log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { vorDemStart } from '../lib/crunchyroll-vollstaendig.ts'
import { ordneGeschwisterBloeckeZu } from './09-4-2-1-geschwister.ts'

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
      // Der Eintrag mit den meisten Folgendaten gewinnt — je nach Abruf tragen Adressen verschieden viel.
      const bisher = (eintrag.serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      const jetzt = (serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
      if (jetzt > bisher) eintrag.serie = serie
      // Ein Titel, der erst nach dem Abruf startet, kann in dessen Blöcken nicht stehen.
      for (const t of nachUrl.get(serie.url) ?? []) if (!vorDemStart(t, serie.geprueftAm)) eintrag.titel.set(t.id, t)
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

    ordneGeschwisterBloeckeZu({ nachSerienId, titles, katalogEintraege })
}
