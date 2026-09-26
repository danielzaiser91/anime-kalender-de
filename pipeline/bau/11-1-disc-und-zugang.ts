import { readJson, log } from '../lib/util.ts'
import { adressKern } from '../lib/dub-confirmed.ts'
import { ausgabeZumDiscTermin, type DiscAusgabe } from '../lib/disc-termin.ts'
import { zugangsart } from '../../shared/zugangsart.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

export function ergaenzeDiscUndZugang({ titles, anisearch, releases, zugangJeAdresse }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  zugangJeAdresse: Map<string, 'abo' | 'kauf'>
}) {
  /*
    **Alles, was Verweise ändert, muss vor dieser Zeile stehen.**

    `allTitles` ist der Ausgangspunkt der Auslieferung: `slim` baut daraus flache
    Kopien. Eine **Mutation** an einem vorhandenen Objekt wirkt dort noch durch
    (die `streams`-Arrays sind dieselben Referenzen), eine **Zuweisung** wie
    `title.watchLinks = […]` nicht — die Kopie trägt dann den alten Wert.

    Am 29.08.2026 zweimal in einer Stunde erlebt: erst standen die Disc-Wege zu
    früh (vor den Bereinigungen, 87 statt 176 kamen an), dann zu spät (hinter
    `slim`, **null** kamen an). Dazwischen liegt genau ein richtiger Platz.
  */

  ergaenzeDiscWege(titles, releases)

  /**
   * **Zweite Stufe: die deutsche Veröffentlichung aus dem Sprachblock.**
   *
   * Der Block darüber liest `<section id="items">` aus dem HTML-Archiv — die
   * **kaufbaren Artikel**. Bei älteren Titeln steht dort nichts, obwohl es die
   * deutsche Ausgabe gab: Gemessen am 07.09.2026 führte
   * `data/disc-ausgaben.json` **keinen einzigen** der 489 weglosen Titel,
   * während aniSearchs Sprachblock für 360 von ihnen eine deutsche
   * Veröffentlichung nennt — mit Zeitraum, Status und Verlag:
   *
   *     School Rumble    Abgeschlossen  23.01.2006 - 26.10.2007
   *                      Tokyopop GmbH, Nipponart GmbH        dubbed: true
   *
   * Diese Angabe liegt in `data/anisearch.json` und wurde bisher von niemandem
   * für die Wegfrage gelesen. Sie halbiert die Lücke: **246 Titel** bekommen so
   * einen belegten Bezugsweg, die weglosen fallen von 489 auf 243.
   *
   * **Drei Riegel, jeder mit Grund:**
   *
   * - **Nur mit Verlag.** Ein Block ohne Verlag kann eine Ankündigung sein; mit
   *   Verlag ist es eine Veröffentlichung, die es gegeben hat. 252 der 360
   *   tragen einen.
   * - **Nur erschienene Status.** „Zukünftig" ist kein Bezugsweg, sondern ein
   *   Termin — und der gehört in den Kalender, nicht in die Wegliste.
   * - **Kein Synchro-Beleg.** Der Block trägt zwar `dubbed`, und das ist laut
   *   `CLAUDE.md` das belastbare Signal (917 von 967 Handbelegen). Der Weg hier
   *   sagt trotzdem nichts über die Sprache — genau wie der Disc-Weg darüber.
   *   Eine Auskunft nach der anderen; wer beides in einem Schritt macht, kann
   *   hinterher nicht sagen, worauf ein Urteil beruht.
   *
   * **Und der Name bleibt konstant**, aus demselben Grund wie oben: Die
   * „Wo?"-Ansicht bündelt über ihn.
   */
  {
    let ausgabeWege = 0
    for (const title of titles.values()) {
      if (title.streams.length || (title.watchLinks ?? []).length) continue
      const block = (anisearch[title.id]?.info?.languages ?? []).find(
        (l) => l.language === 'Deutsch',
      )
      if (!block?.publisher?.length) continue
      if (!['Abgeschlossen', 'Abgebrochen', 'Laufend'].includes(String(block.status))) continue
      /*
        **Ein Kinostart ist keine Ausgabe** (Daniel, 19.09.2026, „Detektiv Conan: Der gefallene
        Engel des Highways“: „diese disc pill führt auf die titelseite … ich seh dort auch keine
        disc“). aniSearchs deutscher Block trug „Laufend, 25.08.2026, Crunchyroll“ — das ist der
        Kinostart mit dem Verleih, und der Bau machte daraus „Ausgabe bei aniSearch“ unter Disc.
        Liegt das Datum des Blocks auf einem Kinotermin desselben Titels (±3 Tage), ist es keine.
      */
      const blockTag = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(block.released ?? ''))
      const blockIso = blockTag ? `${blockTag[3]}-${blockTag[2]}-${blockTag[1]}` : undefined
      const imKino =
        blockIso &&
        releases.some(
          (r) =>
            r.titleId === title.id &&
            r.platform === 'kino' &&
            Math.abs(Date.parse(r.schedule.firstEpisodeDate) - Date.parse(blockIso)) <= 3 * 86_400_000,
        )
      if (imKino) continue
      const as = anisearch[title.id]?.anisearchId
      title.watchLinks = [
        {
          /*
            **Der Name behauptet keine Sprachfassung** (Stichprobe 17.09.2026). Er hieß
            „Deutsche Ausgabe bei aniSearch" und stand bei allen 186 Titeln unter der
            Überschrift „Noch keine deutsche Fassung" — zwei Sätze, die sich für den
            Leser widersprechen. Der Sprachblock belegt eine Veröffentlichung hier, nicht
            ihre Tonspur; ohne Synchro-Marke kann es eine untertitelte Ausgabe sein.
          */
          name: 'Ausgabe bei aniSearch',
          url: as ? `https://www.anisearch.de/anime/${as}` : `https://www.anisearch.de/anime/${title.id}`,
          kind: 'buy',
        },
      ]
      ausgabeWege++
    }
    if (ausgabeWege)
      log(`${ausgabeWege} Titel ohne Weg haben jetzt eine belegte deutsche Veröffentlichung als Bezugsweg`)
  }

  /**
   * **Nachhut: kein Verweis verlässt den Bau ohne Zugangsart.**
   *
   * Die Hauptrunde dafür steht rund tausend Zeilen weiter oben — bewusst spät,
   * damit sie die ergänzten und umsortierten Verweise mitnimmt. Trotzdem wurde
   * sie seither dreimal überholt: am 25.08.2026 von drei Verweisen (Gintama,
   * DEATH NOTE Rewrite, Durarara!!), am 29.08.2026 von einem weiteren
   * (Kickers, Crunchyroll aus der Suchergänzung). Jedes Mal wurde die neue
   * Stelle einzeln nachgezogen, und jedes Mal kam die nächste.
   *
   * **Eine Reihenfolge, die man beim Einbau mitdenken muss, hält nicht** — das
   * steht für die Handbelege längst in CLAUDE.md und gilt hier genauso. Diese
   * Schleife braucht niemand mitzudenken: Sie läuft nach der letzten Stelle,
   * die Verweise anlegt, und füllt nur, was noch leer ist. Ein bereits
   * gesetzter Wert wird nicht angefasst — die Hauptrunde kennt die
   * JustWatch-Angabe und den YouTube-Kanal, hier fehlen beide.
   *
   * Wird sie einmal überflüssig, meldet sie es selbst: Sie zählt, was sie
   * nachträgt, und schweigt bei null.
   */
  let nachgetragen = 0
  for (const title of titles.values()) {
    for (const s of title.streams ?? []) {
      if (s.zugang) continue
      s.zugang = (s.platform === 'primevideo' ? zugangJeAdresse.get(adressKern(s.url)) : undefined) ?? zugangsart(s.platform, undefined, s.url)
      nachgetragen++
    }
    for (const w of title.watchLinks ?? []) {
      if (w.zugang) continue
      w.zugang = zugangsart(w.name, w.kind, w.url)
      nachgetragen++
    }
  }
  if (nachgetragen) {
    log(`${nachgetragen} Verweis(e) nachträglich mit Zugangsart versehen — sie entstanden nach der Hauptrunde`)
  }
}

/**
 * **Deutsche Disc-Ausgaben aus dem aniSearch-Archiv.**
 *
 * Für einen Anime von 2002 ist „Kein Anbieter bekannt" richtig und trotzdem
 * eine Sackgasse: Er lief nie bei einem Streamingdienst, es gab ihn auf DVD.
 * Am 29.08.2026 stand das bei **1.041 Titeln**, 693 davon mit belegter
 * deutscher Synchro.
 *
 * `extract-disc-ausgaben.ts` liest die Ausgaben aus dem Archiv, das der
 * aniSearch-Lauf ohnehin anlegt — kein zusätzlicher Abruf. 584 Titel haben
 * eine deutsche Ausgabe, **176 davon zeigen sonst keinen einzigen Weg**.
 *
 * **Ohne Sprachaussage.** Eine deutsche Disc kann untertitelt sein; im Archiv
 * steht wörtlich „Saber Marionette J (OmU)". Der Eintrag ist deshalb ein
 * `watchLink` vom Typ `buy` wie jeder andere und trägt kein `dub`.
 *
 * **Die Stelle im Bau entscheidet mit — sie steht deshalb hier hinten.**
 * Beim ersten Einbau am 29.08.2026 lief der Block **vor** den Bereinigungen:
 * Er sah 176 wegelose Titel, die Crunchyroll-Bereinigung machte danach
 * weitere wegelos, und die gingen leer aus. Gemessen kamen 87 statt 176 an.
 * Dieselbe Reihenfolge-Falle wie bei der Zugangsart darunter, und dieselbe
 * Antwort: Wer den Endzustand braucht, läuft am Ende.
 *
 * **Und nur, wo sonst nichts steht** (so bis 16.09.2026, siehe unten). Wer einen Stream hat, braucht keinen
 * Hinweis auf eine womöglich vergriffene DVD von 2005 — der Verweis wäre dort
 * Rauschen statt Auskunft.
 */
function ergaenzeDiscWege(titles: Map<number, Title>, releases: Release[]) {
  const discAusgaben = readJson<Record<string, DiscAusgabe[]>>(
    'data/disc-ausgaben.json',
    {},
  )
  let discWege = 0
  for (const title of titles.values()) {
    /*
      **Überholt am 16.09.2026: auch neben anderen Wegen.** Der Riegel „nur, wo
      sonst nichts steht" stammt aus der Zeit vor dem Disc-Reiter. Seit Stream
      und Disc getrennt stehen, ist eine Disc kein Rauschen neben einem Stream.
      Anlass: „Dragon Quest: The Adventure of Dai" zeigte nur die Animeversand-DVD
      (Folgen 1–75), während aniSearch vier Blu-ray-Boxen und ein Komplettset von
      Kazé führt — dazu der Hinweis, 76–100 biete niemand an (Daniel, mit Bild).
      Gemessen: 1.073 Titel mit belegter deutscher Disc-Ausgabe und einem anderen
      Weg bekamen bisher keine.
    */
    if ((title.watchLinks ?? []).some((w) => w.name === 'aniSearch')) continue
    const ausgaben = discAusgaben[String(title.id)]
    if (!ausgaben?.length) continue
    const erste = ausgaben[0]!
    title.watchLinks = [
      ...(title.watchLinks ?? []),
      {
        /*
          **Der Name ist konstant, die Zahl nicht.** Die „Wo?"-Ansicht buendelt
          ueber den Anbieternamen; „aniSearch — 6 Disc-Ausgaben" und
          „aniSearch — 2 Disc-Ausgaben" waeren dort zwei verschiedene
          Anbieter, und aus 176 Titeln wuerden Dutzende Einzelgruppen.
          Beinahe eingebaut am 29.08.2026, gefangen beim Nachlesen.
        */
        /*
          **Das Wort „Disc" ist weg, das Zeichen sagt es besser.** Daniel am
          07.09.2026: „füg ein cd icon links in die pill statt disc zu
          schreiben. einfach icon + anisearch". Die Pille trägt seither ein
          Silberscheiben-Zeichen; der Name nennt nur noch die Quelle.
        */
        name: 'aniSearch',
        url: erste.url ?? `https://www.anisearch.de/anime/${title.id}`,
        kind: 'buy',
      },
    ]
    discWege++
  }
  if (discWege) log(`${discWege} Titel haben jetzt ihre deutsche Disc-Ausgabe als Bezugsweg`)

  /* Ein Disc-Termin aus den News bekommt Namen und Ziel seiner Ausgabe — siehe `lib/disc-termin.ts`. */
  let verknuepft = 0
  for (const r of releases) {
    if (r.releaseType !== 'disc' || !r.automatisch || r.edition || r.buyUrl || r.platformUrl) continue
    const datum = r.schedule?.firstEpisodeDate
    if (!datum) continue
    const a = ausgabeZumDiscTermin({ datum, hinweise: [...(r.sources ?? []), r.herkunft ?? ''] }, discAusgaben[String(r.titleId)] ?? [])
    if (!a) continue
    r.edition = a.edition
    r.platformUrl = a.url
    verknuepft++
  }
  log(`${verknuepft} Disc-Termin(e) aus den News mit ihrer aniSearch-Ausgabe verknüpft`)
}
