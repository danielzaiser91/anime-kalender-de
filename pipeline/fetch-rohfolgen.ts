/**
 * Die gemeldeten Rohfolgen abholen und unseren Folgen zuordnen.
 *
 * **Der Kern des Umbaus vom 28.08.2026.** Bis dahin entschied die Erweiterung im
 * Browser, welche Amazon-Folge welche unserer ist — und konnte es nicht: Prime
 * führt in einer Liste die deutsche Zählung neben der japanischen, Amazon mischt
 * in einer Staffel 26, 27, 28 und 105, Haikyu Staffel 1 hat dort 44 Folgen und
 * bei uns 25. Neununddreißig Fassungen an einem Abend gingen darauf zurück.
 *
 * Hier passiert es an der richtigen Stelle: Der Bau kennt TMDBs Folgentitel und
 * Erstausstrahlungsdaten (`data/tmdb-folgen.json`) und kann dagegen abgleichen.
 *
 * **Was nicht zugeordnet werden kann, bleibt offen.** `data/prime-unzugeordnet.json`
 * führt die Fälle mit Grund. Eine offene Frage bleibt damit sichtbar, statt zu
 * einer falschen Antwort zu werden — das ist der ganze Unterschied zu vorher.
 *
 * Aufruf: `npx tsx pipeline/fetch-rohfolgen.ts`
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import {
  ausAnisearch,
  englischeSchreibweisen,
  findeStaffel,
  folgenKern,
  ordneZu,
  type AnbieterFolge,
  type AsFolgeRoh,
  type TmdbFolge,
} from '../shared/folgen-zuordnung.ts'
import type { Title } from '../shared/types.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''

/** Eine Zeile aus `prime_folge`, so wie der Worker sie ausliefert. */
interface Rohfolge {
  id: number
  url: string
  asin: string | null
  gti: string | null
  nummer: number | null
  titel: string | null
  erschienen: string | null
  dauer_sek: number | null
  sprachen: string | null
  untertitel: string | null
  staffel_text: string | null
  staffel_nr: number | null
  gemeldet_am: string
  titel_id: number | null
  /*
    **Wer die Folge gemeldet hat** — seit dem 01.09.2026 nicht mehr nur Prime.
    Netflix und Disney+ melden auf denselben Weg; der Zuordner behandelt sie
    gleich, denn seine Anker (Folgentitel, Erstausstrahlung) sind bei allen
    dieselben. Die Spalte entscheidet nur, welcher Verweis im Bestand gemeint
    ist, wenn ein Titel bei mehreren Anbietern laeuft.
  */
  plattform?: string | null
  /*
    Der Serienname aus der Meldung derselben Adresse — der Worker liefert ihn
    als Unterabfrage mit. Er ist der letzte Anker, wenn unser Bestand die
    Adresse nicht kennt (Prime legt je Staffel eine eigene an).
  */
  serientitel?: string | null
}

/** Ein Name auf seinen Kern — dieselbe Formel wie in `fetch-pruefungen.ts`. */
function titelSchluessel(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

interface TmdbEintrag {
  tmdbId: number
  folgen: TmdbFolge[]
}

/** Ein Fall, der geklärt werden muss, statt geraten zu werden. */
interface Offen {
  url: string
  titel: string | null
  grund: string
  folgen: number
  /** Ob mindestens eine Rohfolge eine Titel-Kennung mitbrachte — siehe unten. */
  mitKennung?: boolean
}

async function main(): Promise<void> {
  if (!TOKEN) {
    warn('LAUF_TOKEN fehlt — ohne Token gibt der Worker die Rohfolgen nicht heraus.')
    recordSource('rohfolgen', 0, 'kein Token')
    return
  }

  /*
    **Seitenweise, nicht in einem Zug.** Der Worker gibt höchstens 5.000 Zeilen
    je Antwort heraus; am 29.08.2026 lagen 5.620 offen, und die 620 dahinter
    hätten den Bau nie erreicht — sie wären erst nach der Übernahme der älteren
    nachgerückt, also nach einem Lauf, den es ohne sie gar nicht gegeben hätte.

    `weiter` trägt die letzte gelesene Kennung, oder `null`, wenn nichts mehr
    aussteht. Die Obergrenze von zwanzig Seiten ist ein Notausgang gegen einen
    Endlos-Lauf, keine Mengenbegrenzung: Bei 5.000 Zeilen je Seite sind das
    100.000 Folgen.
  */
  let folgen: Rohfolge[] = []
  let gesamt = 0
  let nach = 0
  for (let seite = 0; seite < 20; seite++) {
    const antwort = await fetch(
      `${WORKER}/pruefung?rohfolgen=1&nach=${nach}&token=${encodeURIComponent(TOKEN)}`,
    )
    if (!antwort.ok) {
      warn(`Rohfolgen nicht abrufbar: HTTP ${antwort.status}`)
      recordSource('rohfolgen', 0, `HTTP ${antwort.status}`)
      return
    }
    const teil = (await antwort.json()) as { folgen: Rohfolge[]; gesamt: number; weiter?: number | null }
    folgen.push(...teil.folgen)
    gesamt = teil.gesamt
    if (!teil.weiter) break
    nach = teil.weiter
  }
  if (!folgen.length) {
    log(`keine offenen Rohfolgen (Bestand ${gesamt})`)
    /*
      **Ein leerer Briefkasten ist der Idealzustand, kein Ausfall.**

      Sobald Daniel ein paar Tage nichts meldet, steht hier 0 — und ohne
      `leerIstOk` gaelte die Quelle nach drei Tagen als stumm und machte den
      Tageslauf rot. Am 29.08.2026 ist genau das `youtube-check` zweimal
      passiert.
    */
    recordSource('rohfolgen', 0, undefined, undefined, true)
    return
  }
  if (folgen.length < gesamt) {
    warn(`${gesamt - folgen.length} Rohfolgen nicht geholt — die Seitengrenze greift, der nächste Lauf holt sie`)
  }
  log(`${folgen.length} Rohfolgen geholt (offen insgesamt: ${gesamt})`)

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdbFolgen = readJson<Record<string, TmdbEintrag>>('data/tmdb-folgen.json', {})
  /*
    **aniSearch zuerst.** Seine Folgen sind auf Deutsch, tragen die japanische
    Erstausstrahlung und sind **wie unser Bestand aufgeteilt** — je Eintrag eine
    eigene Zählung ab 1. Damit entfällt `findeStaffel` und mit ihm die Stelle,
    an der die Zuordnung bisher scheiterte.
  */
  const asFolgen = readJson<Record<string, { folgen: AsFolgeRoh[] }>>('data/anisearch-folgen.json', {})
  const asKennung = readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})

  /*
    Jede Suchadresse, die aus einem unserer Titel entstehen kann — mit allen
    Einträgen, auf die sie passt. Eine Adresse mit mehr als einem Eintrag wird
    unten nicht verwendet.
  */
  const suchZuTitel = new Map<string, Set<number>>()
  for (const t of titles) {
    for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
      if (!name) continue
      const u = `https://www.amazon.de/s?k=${encodeURIComponent(name)}&i=instant-video`
      const da = suchZuTitel.get(u) ?? new Set<number>()
      da.add(t.id)
      suchZuTitel.set(u, da)
    }
  }

  /*
    **Dubletten aus dem Altbestand wegräumen.**

    Bis zum 28.08.2026 hängte jede erneute Meldung derselben Adresse ihre Folgen
    an, statt die offenen zu ersetzen — der Worker macht es seitdem richtig, aber
    was davor entstand, liegt noch da: **3.569 Zeilen allein unter „Captain
    Tsubasa"**, einer Seite mit 91 Folgen, weil Daniel an dem Titel oft gemeldet
    hat. Sie machen zwei Drittel des Briefkastens aus und blockieren jeden Lauf.

    Behalten wird je Adresse und Folgennummer die **jüngste** Zeile; die
    überzähligen werden abgehakt. Das ist kein Datenverlust: Es sind wörtliche
    Wiederholungen derselben Meldung.
  */
  const jungste = new Map<string, Rohfolge>()
  const veraltet: number[] = []
  for (const f of folgen) {
    /*
      **Der Schlüssel ist der Inhalt, nicht nur die Nummer.**

      Prime führt in einer Liste die deutsche Zählung neben der japanischen
      Gesamtzählung (Detektiv Conan: 149–151 neben 1146–1148, siehe CLAUDE.md).
      Zwei verschiedene Folgen mit derselben Nummer sind damit möglich, und ein
      Schlüssel aus Adresse und Nummer allein würde eine davon wegwerfen.

      Gemessen am Altbestand vom 29.08.2026: 5.633 Zeilen, 1.169 Gruppen, und in
      **keiner einzigen** unterscheidet sich der Inhalt. Die Verschärfung kostet
      also nichts und schließt den Fall trotzdem aus, bevor er eintritt.
    */
    const k = `${f.url}|${f.nummer ?? ""}|${f.titel ?? ""}|${f.erschienen ?? ""}|${f.sprachen ?? ""}`
    const da = jungste.get(k)
    if (!da) {
      jungste.set(k, f)
      continue
    }
    /* Die spätere Meldung gewinnt; bei gleichem Zeitpunkt die höhere Kennung. */
    const neuer = f.gemeldet_am > da.gemeldet_am || (f.gemeldet_am === da.gemeldet_am && f.id > da.id)
    if (neuer) {
      veraltet.push(da.id)
      jungste.set(k, f)
    } else {
      veraltet.push(f.id)
    }
  }
  if (veraltet.length) {
    log(`${veraltet.length} doppelte Rohfolgen aussortiert (Altbestand vor dem 28.08.2026)`)
    folgen = [...jungste.values()]
  }

  /**
   * Je Adresse **und Ausgabe** gruppieren.
   *
   * Eine Meldung betrifft eine Staffel-Seite — aber Prime führt regelmäßig zwei
   * Ausgaben desselben Titels unter derselben Adresse aus unserer Liste. „My
   * First Girlfriend is a Gal" liegt als Kauftitel mit 11 Folgen und FSK 16 (die
   * KAZÉ-Fassung samt OVA) und über den Crunchyroll-Kanal mit 10 Folgen und FSK
   * 18, mit völlig anderen Folgentiteln, weil zwei Verlage unabhängig übersetzt
   * haben (Daniel, 30.08.2026, mit Bildern).
   *
   * Nach Adresse allein gruppiert lägen beide in einem Topf, und die Zuordnung
   * sähe eine Staffel mit 21 widersprüchlichen Folgen.
   *
   * Getrennt wird über die `asin` **der Folge** — sie steht seit jeher je Zeile
   * und nennt die Seite, von der die Folge gelesen wurde. Folgen ohne sie
   * bleiben unter ihrer Adresse zusammen; das ist der Stand vor dem 30.08.2026
   * und der Fall einer Suchadresse, die noch keine Titelseite kennt.
   */
  const jeUrl = new Map<string, Rohfolge[]>()
  for (const f of folgen) {
    const schluessel = f.asin ? `${f.url}#${f.asin}` : f.url
    const l = jeUrl.get(schluessel) ?? []
    l.push(f)
    jeUrl.set(schluessel, l)
  }

  /*
    **Welcher Titel führt welche Folgentitel — der Anker für den letzten Fall.**

    Gebaut aus beiden Quellen: aniSearch (deutsche Folgentitel, wie unser
    Bestand aufgeteilt) und TMDB (dieselben aus zweiter Hand). Ein Titel, dessen
    Folgen die gemeldeten treffen, ist der gesuchte — ganz ohne eine Angabe des
    Anbieters.

    Gebaut wird die Karte einmal, nicht je Adresse: 510 aniSearch-Titel und 808
    von TMDB, zusammen rund 17.000 Folgentitel.
  */
  const folgenJeTitel = new Map<number, Set<string>>()
  for (const t of titles) {
    const menge = new Set<string>()
    const asId = asKennung[String(t.id)]?.anisearchId
    for (const f of asId ? (asFolgen[String(asId)]?.folgen ?? []) : []) {
      for (const name of [f.de, f.en]) {
        const k = folgenKern(name)
        if (k && k.length >= 5) menge.add(k)
      }
    }
    for (const f of tmdbFolgen[String(t.id)]?.folgen ?? []) {
      const k = folgenKern(f.titel)
      if (k && k.length >= 5) menge.add(k)
    }
    if (menge.size) folgenJeTitel.set(t.id, menge)
  }
  /** Wie viele Adressen allein über ihre Folgentitel gefunden wurden. */
  let ueberFolgentitel = 0

  const offen: Offen[] = []
  /**
   * Was der Bau am Ende bekommt.
   *
   * `unsere: null` heißt „gilt dem Titel, nicht einer Folge" — der Fall eines
   * einzigen Eintrags, siehe unten. `asin` ist der eigentliche Ertrag einer
   * Meldung von einer **Suchadresse**: Aus ihr wird damit eine echte
   * Titelseite, und die nächste Prüfung beginnt nicht wieder bei der Suche.
   */
  const zugeordnet: Record<
    string,
    { titleId: number; asin: string | null; folgen: { unsere: number | null; sprachen: string[] }[] }
  > = {}
  /** Die Rohfolgen-Kennungen, die verwertet wurden — sie werden danach abgehakt. */
  const erledigt: number[] = []

  for (const [schluessel, liste] of jeUrl) {
    /*
      Der Schlüssel trägt seit dem 30.08.2026 die Ausgabe mit (`url#asin`) —
      gesucht und gespeichert wird aber unter der Adresse selbst. Sie steht in
      jeder Zeile der Gruppe, alle tragen dieselbe.
    */
    const url = liste[0]!.url
    /*
      Welcher unserer Titel gehört zu dieser Adresse? Über den Bestand, nicht über
      den Namen: Die Adresse steht dort, der Name kann bei Prime jede Form haben.
    */
    /*
      **Die gemeldete Kennung entscheidet, nicht die Adresse.**

      Bis zum 28.08.2026 lief die Zuordnung ueber `titles.streams.url`. Ein
      Titel ohne Verweis steht dort nicht — und genau die stehen in der
      Pruefliste. Gemessen: 1 von 67 Adressen zugeordnet, 66-mal „kein Titel
      zu dieser Adresse".

      Seit Migration 018 traegt jede Rohfolge `titel_id`. Die Adresse bleibt
      als Rueckfall fuer alles, was vorher gemeldet wurde.
    */
    const gemeldeteId = liste.find((f) => Number.isFinite(f.titel_id))?.titel_id ?? null
    const treffer = gemeldeteId
      ? titles.filter((t) => t.id === gemeldeteId)
      : titles.filter((t) => (t.streams ?? []).some((s) => s.url === url)) ||
        []
    /*
      **Eine Suchadresse trägt ihre Herkunft im Suchbegriff — sie stammt von uns.**

      `tools/extension-offene-amazon.mjs` baut sie als
      `amazon.de/s?k=${encodeURIComponent(unserTitel)}&i=instant-video`. Die
      Rückrichtung ist damit kein Namensabgleich, sondern das Umkehren einer
      Kodierung: Wer denselben Ausdruck über alle unsere Titel legt, findet
      genau den einen, aus dem die Adresse entstand.

      **Der Ertrag ist der Grund, warum es das gibt.** Am 29.08.2026 lagen 95
      Adressen mit **5.435 gemeldeten Folgen** unzugeordnet — Daniels Arbeit von
      Tagen. 79 davon sind Suchadressen, und **alle 79** lösen sich hierüber
      auf: 4.398 Folgen.

      **Mehrdeutige bleiben offen.** 69 der 6.461 möglichen Adressen führen auf
      mehr als einen Eintrag — „Appleseed" gibt es als Film von 1988 und als
      Serie, „Gantz" zweimal. Dort entscheidet nicht die Adresse, sondern nur
      eine Meldung mit Kennung; ein Ratespiel wäre schlimmer als ein offener
      Fall.
    */
    if (!treffer.length && suchZuTitel.has(url)) {
      const ids = suchZuTitel.get(url)!
      if (ids.size === 1) treffer.push(titles.find((t) => t.id === [...ids][0])!)
    }
    /*
      **Und wo die Adresse nichts trifft, spricht der gemeldete Name.**

      Am 01.09.2026 lagen 795 Rohfolgen auf 50 Adressen unzugeordnet, alle mit
      „kein Titel zu dieser Adresse". Gemessen an zweien davon: Sie gehören zu
      „Card Captor Sakura", und der Titel steht im Bestand — nur unter einer
      **anderen** Prime-Adresse. Prime führt je Staffel eine eigene, unser
      Bestand kennt eine.

      Der Name ist hier ein **Vorschlag**, kein Beleg, und das ist vertretbar:
      Was danach kommt, prüft ihn. `ordneZu` legt die gemeldeten Folgen über
      Folgentitel und Erstausstrahlung; ein Namensvorschlag, dessen Folgen nicht
      passen, fällt dort durch und bleibt offen. Das ist der Unterschied zu
      `fetch-pruefungen.ts`, wo ein Namenstreffer direkt ein Urteil setzen
      würde — dort bleibt er deshalb ein Vorschlag für die Handarbeit.

      **Nur bei genau einem Treffer.** „Cardcaptor Sakura" gibt es fünfmal im
      Bestand (Serie, zwei Filme, ein Special, „Clear Card Arc"); ohne die
      Eindeutigkeit wäre das ein Ratespiel.
    */
    if (!treffer.length) {
      const name = liste.find((f) => f.serientitel)?.serientitel ?? null
      if (name) {
        const k = titelSchluessel(name)
        const passt = (t: Title, genau: boolean) =>
          [t.titleDe, t.titleEn, t.titleRomaji].some((x) => {
            if (!x) return false
            const y = titelSchluessel(x)
            return genau ? y === k : y.startsWith(k)
          })
        /*
          **Erst genau, dann als Anfang — und nie beides gemischt.**

          Prime nennt die Serie „Das Dschungelbuch", unser Bestand „Das
          Dschungelbuch: Die Serie"; 26 Folgen lagen deshalb unzugeordnet. Ein
          Bestandstitel, der mit dem gemeldeten Namen **beginnt**, ist ein
          brauchbarer Vorschlag — einer, der ihn irgendwo enthält, wäre es
          nicht: „Gantz" steckt in jedem „Gantz:O".

          Die Stufen bleiben getrennt: Gibt es einen genauen Treffer, gewinnt
          er, auch wenn drei Titel mit demselben Namen anfangen.
        */
        const genau = titles.filter((t) => passt(t, true))
        const kandidaten = genau.length ? genau : titles.filter((t) => passt(t, false))
        if (kandidaten.length === 1) treffer.push(kandidaten[0]!)
      }
    }
    /*
      **Und wenn nicht einmal ein Name da ist, sprechen die Folgentitel selbst.**

      Bei 16 Adressen mit 198 Folgen steht in der Meldung kein Serienname,
      sondern der Titel der **Folge**: „Kyogre in der Falle!", „Ein beschwingter
      Kampf!". Über die Adresse und den Namen ist damit nichts zu holen.

      Über die Folgentitel schon — und genau das ist der Anker, den Daniel am
      01.09.2026 gemeint hat: „einzeln episoden korrekt aus gesammeltem zustand
      rauspicken und korrekt zuordnen … anhand von verlaesslichen sicheren
      quellen wie zB anisearch."

      `data/anisearch-folgen.json` führt je Titel die deutschen Folgentitel,
      `data/tmdb-folgen.json` dieselben aus zweiter Quelle. Wer dort nachsieht,
      welcher Titel diese Folgen führt, hat die Zuordnung — ohne eine einzige
      Angabe des Anbieters.

      **Die Schwelle ist hoch, und sie muss es sein.** Ein einzelner Folgentitel
      kann zufällig doppelt vorkommen („Der Anfang", „Abschied"); erst wenn
      **mindestens drei** und **mehr als die Hälfte** der gemeldeten Folgen
      denselben Titel treffen, ist es eine Auskunft. Und nur, wenn kein zweiter
      Titel gleich viele trifft.
    */
    /*
      **Und derselbe Griff entscheidet, wo zwei Titel eine Adresse teilen.**

      Prime führt „Golden Kamuy" Staffel 1 und 2 unter einer Adresse, beide mit
      zwölf Folgen — die Adresse allein sagt nicht, welche gemeint ist, und ohne
      Entscheidung blieben zwölf Folgen liegen. Die Folgentitel sagen es.

      Der Unterschied zum Fall darüber ist nur die Ausgangsmenge: dort **alle**
      Titel, hier die beiden Kandidaten. Die Schwelle bleibt dieselbe.
    */
    if (treffer.length !== 1) {
      const kerne = liste.map((f) => folgenKern(f.titel)).filter((x) => x && x.length >= 5)
      if (kerne.length >= 3) {
        const menge = treffer.length ? treffer.map((t) => t.id) : [...folgenJeTitel.keys()]
        const punkte = new Map<number, number>()
        for (const id of menge) {
          const folgen = folgenJeTitel.get(id)
          if (!folgen) continue
          let n = 0
          for (const k of kerne) if (folgen.has(k)) n++
          if (n >= 3 && n > kerne.length / 2) punkte.set(id, n)
        }
        const sortiert = [...punkte.entries()].sort((a, b) => b[1] - a[1])
        if (sortiert.length === 1 || (sortiert.length > 1 && sortiert[0]![1] > sortiert[1]![1])) {
          const gefunden = titles.find((t) => t.id === sortiert[0]![0])
          if (gefunden) {
            treffer.length = 0
            treffer.push(gefunden)
            ueberFolgentitel++
          }
        }
      }
    }
    if (treffer.length !== 1) {
      offen.push({
        url,
        titel: liste[0]?.titel ?? null,
        grund: treffer.length ? `${treffer.length} Titel teilen diese Adresse` : 'kein Titel zu dieser Adresse',
        folgen: liste.length,
        /*
          **Ob die Meldung überhaupt eine Kennung mitbrachte.**

          Ohne sie kann die Zuordnung nur über die Adresse gehen, und die kennt
          unser Bestand oft nicht — dann ist „nicht zugeordnet" kein Fehler,
          sondern die Folge einer alten Meldung. Vom 28. bis 31.08.2026 kamen
          alle 795 Rohfolgen so an (`titelId` lag in der Prüfliste eine Ebene
          zu tief). Die Zusicherung in `check-logic.ts` unterscheidet daran,
          ob eine Null Anlass zur Sorge ist.
        */
        mitKennung: liste.some((f) => f.titel_id != null),
      })
      continue
    }
    const titel = treffer[0]!

    /*
      **Anker suchen: aniSearch, dann TMDB.**

      Bei aniSearch ist die Zuordnung eine Zeile — der Eintrag entspricht unserem
      Titel, seine Folgen sind unsere Folgen. Bei TMDB muss erst die richtige
      Staffel gefunden werden, und genau dort ging es schief: Am 28.08.2026 ließ
      sich **1 von 67** Adressen zuordnen.
    */
    /*
      **Ein einziger Eintrag ist nichts zuzuordnen — er ist der Titel.**

      Prime führt „Halo Legends" als **einen Film**: die neun Kurzfilme, die
      unser Bestand als neun Folgen kennt, zu einem Stück zusammengeschnitten
      (Daniel, 29.08.2026: „1 film bei amazon, culmination of all 9 episodes
      into a movie"). Es gibt dort keine Folge 1, der man unsere Folge 1
      gegenüberstellen könnte, und die Suche nach einer TMDB-Staffel mit neun
      Folgen musste scheitern.

      **Die Frage, die dieses Projekt stellt, ist trotzdem beantwortet:** Läuft
      der Titel dort auf Deutsch? Der eine Eintrag nennt seine Tonspuren, und
      welche unserer Folgen gemeint ist, spielt für die Antwort keine Rolle.

      Der Beleg wird deshalb ohne Folgennummer abgelegt (`unsere: null`) — er
      gilt dem Titel, nicht einer Folge. Das ist die ehrliche Form: Eine erfundene
      „Folge 1" wäre eine Behauptung über etwas, das die Seite nicht sagt.

      **Nur bei genau einem Eintrag.** Zwei oder mehr heißen, dass Prime die
      Sache aufteilt — dann ist die Zuordnung wieder die richtige Frage. 36 der
      101 offenen Adressen tragen genau einen.
    */
    if (liste.length === 1) {
      zugeordnet[schluessel] = {
        titleId: titel.id,
        asin: liste[0]!.asin ?? null,
        folgen: [{ unsere: null, sprachen: JSON.parse(liste[0]!.sprachen ?? '[]') as string[] }],
      }
      erledigt.push(liste[0]!.id)
      continue
    }

    const asId = asKennung[String(titel.id)]?.anisearchId
    const asEintrag = asId ? asFolgen[String(asId)] : undefined
    let anker: TmdbFolge[] | null = null
    let ankerQuelle = ''

    if (asEintrag?.folgen?.length) {
      anker = [...ausAnisearch(asEintrag.folgen), ...englischeSchreibweisen(asEintrag.folgen)]
      ankerQuelle = 'aniSearch'
    } else {
      const tmdb = tmdbFolgen[String(titel.id)]
      if (!tmdb) {
        offen.push({
          url,
          titel: titel.titleDe ?? titel.titleEn ?? null,
          grund: 'keine Folgentitel vorhanden (weder aniSearch noch TMDB)',
          folgen: liste.length,
        })
        continue
      }
      const staffel = findeStaffel(tmdb.folgen, titel.episodes ?? null, titel.jpYear ?? null)
      if (staffel === null) {
        offen.push({
          url,
          titel: titel.titleDe ?? titel.titleEn ?? null,
          grund: `keine TMDB-Staffel mit ${titel.episodes ?? '?'} Folgen eindeutig`,
          folgen: liste.length,
        })
        continue
      }
      anker = tmdb.folgen.filter((f) => f.s === staffel)
      ankerQuelle = 'TMDB'
    }
    const tmdbStaffel = anker
    const anbieter: AnbieterFolge[] = liste.map((f) => ({
      nummer: f.nummer,
      titel: f.titel,
      datum: f.erschienen ? f.erschienen.slice(0, 10) : null,
      minuten: f.dauer_sek ? Math.round(f.dauer_sek / 60) : null,
    }))

    const paare = ordneZu(anbieter, tmdbStaffel)
    const treffend = paare.filter((p) => p.unsere !== null)
    if (!treffend.length) {
      offen.push({
        url,
        titel: titel.titleDe ?? titel.titleEn ?? null,
        grund: `keine einzige Folge zuzuordnen (Anker: ${ankerQuelle})`,
        folgen: liste.length,
      })
      continue
    }

    zugeordnet[schluessel] = {
      titleId: titel.id,
      /* Alle Zeilen einer Adresse stammen von derselben Seite — die erste genügt. */
      asin: liste.find((f) => f.asin)?.asin ?? null,
      folgen: treffend.map((p) => ({
        unsere: p.unsere!,
        sprachen: JSON.parse(liste[p.index]!.sprachen ?? '[]') as string[],
      })),
    }
    /*
      **Abgehakt wird die ganze Adresse, nicht nur die getroffenen Zeilen.**

      Was von dieser Seite nicht zugeordnet werden konnte, wird es beim nächsten
      Lauf auch nicht — die Anker sind dieselben. Es offen zu lassen hieße, die
      Zeilen für immer erneut zu holen; ihr Inhalt steht ohnehin im Archiv der
      Meldung. Kommt später ein Anker dazu, ist die Meldung neu zu holen, und
      das ist ein Klick.
    */
    for (const f of liste) erledigt.push(f.id)
  }

  writeJson('data/prime-zugeordnet.json', zugeordnet)
  writeJson('data/prime-unzugeordnet.json', offen)

  /*
    **Erst schreiben, dann abhaken.** Die Zuordnung steht committet im Repo,
    bevor der Briefkasten sie vergisst — andersherum wäre ein Netzfehler zwischen
    beiden Schritten ein Datenverlust.
  */
  erledigt.push(...veraltet)
  if (erledigt.length) {
    try {
      const res = await fetch(`${WORKER}/pruefung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
        body: JSON.stringify({ rohfolgenUebernommen: erledigt }),
      })
      if (res.ok) log(`${erledigt.length} Rohfolgen abgehakt`)
      else warn(`Rohfolgen nicht abgehakt: HTTP ${res.status} — sie kommen beim nächsten Lauf erneut`)
    } catch (e) {
      warn(`Rohfolgen nicht abgehakt: ${(e as Error).message}`)
    }
  }

  const gesamtZugeordnet = Object.values(zugeordnet).reduce((n, z) => n + z.folgen.length, 0)
  log(
    `${Object.keys(zugeordnet).length} Adressen zugeordnet (${gesamtZugeordnet} Folgen), ${offen.length} offen` +
      (ueberFolgentitel ? `, davon ${ueberFolgentitel} allein über die Folgentitel gefunden` : ''),
  )
  for (const o of offen.slice(0, 5)) log(`  offen: ${o.titel ?? o.url} — ${o.grund}`)
  recordSource('rohfolgen', gesamtZugeordnet, undefined, Object.keys(zugeordnet).length)
}

await main()
