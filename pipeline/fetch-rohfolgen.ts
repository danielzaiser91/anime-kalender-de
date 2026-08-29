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

  /* Je Adresse gruppieren — eine Meldung betrifft immer eine Staffel-Seite. */
  const jeUrl = new Map<string, Rohfolge[]>()
  for (const f of folgen) {
    const l = jeUrl.get(f.url) ?? []
    l.push(f)
    jeUrl.set(f.url, l)
  }

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

  for (const [url, liste] of jeUrl) {
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
    if (treffer.length !== 1) {
      offen.push({
        url,
        titel: liste[0]?.titel ?? null,
        grund: treffer.length ? `${treffer.length} Titel teilen diese Adresse` : 'kein Titel zu dieser Adresse',
        folgen: liste.length,
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
      zugeordnet[url] = {
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

    zugeordnet[url] = {
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
  log(`${Object.keys(zugeordnet).length} Adressen zugeordnet (${gesamtZugeordnet} Folgen), ${offen.length} offen`)
  for (const o of offen.slice(0, 5)) log(`  offen: ${o.titel ?? o.url} — ${o.grund}`)
  recordSource('rohfolgen', gesamtZugeordnet, undefined, Object.keys(zugeordnet).length)
}

await main()
