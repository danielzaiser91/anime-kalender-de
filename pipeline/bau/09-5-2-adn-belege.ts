import { adnFolgenAdresse, beurteileAdnVerweis, type AdnArchiv } from '../lib/adn-sprachen.ts'
import { log, normSchluessel, readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'

export function belegeAdnUeberKatalog({ titles }: {
  titles: Map<number, Title>
}) {
  /**
   * **Ein ADN-Katalogeintrag mit gleichem Namen und gleicher Folgenzahl belegt Deutsch.**
   *
   * `data/adn-catalog.json` enthält **nur Serien mit deutschen Folgen**, und in
   * ihren `episodes` stehen **ausschließlich** die deutschen — der Katalog-Lauf
   * filtert vor dem Schreiben auf `vde`. Das steht so in `fetch-adn.ts`, und
   * `episodeAus()` schreibt deshalb bewusst kein `languages`-Feld.
   *
   * **Genau daran bin ich am 29.08.2026 gescheitert**, und der Irrtum gehört
   * hierher: Eine Auswertung suchte in den Katalogfolgen nach `vde`, fand in
   * allen 4.078 nichts und meldete „0 von 113 deutsch" für JoJo — während
   * CLAUDE.md „113 von 152 mit vde" festhält. Das sah nach einem Widerspruch in
   * den Daten aus und war ein Messfehler: gesucht nach einem Feld, das dort nie
   * steht. **Wahr ist das Gegenteil — jede Folge im Katalog ist deutsch.**
   *
   * Was diese Runde löst: Unser Bestand führt ADN unter zwei Adressformen, 70
   * mit Kennung und 65 als Slug aus aniSearch. Die Slugs finden über die
   * Adresse keinen Anschluss an den Katalog; über **Name und Folgenzahl**
   * finden sie ihn.
   *
   * **Zwei Sperren:** Der Name muss eindeutig treffen (ein Katalogtitel, nicht
   * zwei), und die Folgenzahl muss übereinstimmen. „JoJo's Bizarre Adventure"
   * hat bei uns 26 Folgen, der Katalogeintrag 113 — das ist die Sammelserie
   * aller Staffeln und bleibt offen.
   *
   * Nur Ja: Ein Titel, den der Katalog **nicht** führt, hat dort vielleicht
   * trotzdem etwas — der Katalog ist ein Ausschnitt, keine Gesamtschau.
   */
  {
    const katalog = readJson<{ shows?: { title?: string; originalTitle?: string; episodes?: unknown[] }[] }>(
      'data/adn-catalog.json',
      {},
    ).shows ?? []
    const nachName = new Map<string, { titel: string; folgen: number }[]>()
    for (const s of katalog) {
      const folgen = (s.episodes ?? []).length
      if (!folgen) continue
      for (const n of [s.title, s.originalTitle]) {
        if (!n) continue
        const k = normSchluessel(n)
        if (!nachName.has(k)) nachName.set(k, [])
        nachName.get(k)!.push({ titel: n, folgen })
      }
    }
    let ausKatalog = 0
    for (const title of titles.values()) {
      const stream = title.streams.find((s) => s.platform === 'adn' && s.dub === undefined)
      if (!stream) continue
      const namen = [title.titleDe, title.titleEn, title.titleRomaji].filter(Boolean).map((n) => normSchluessel(n))
      const treffer = namen.map((n) => nachName.get(n)).find(Boolean)
      if (!treffer || treffer.length !== 1) continue
      if (treffer[0]!.folgen !== title.episodes) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) {
      log(`${ausKatalog} ADN-Verweise über den Katalog belegt (Name und Folgenzahl treffen)`)
    }
  }
}

export function belegeAdnAusArchiv({ adnArchiv, titles }: {
  adnArchiv: AdnArchiv
  titles: Map<number, Title>
}) {
  if (adnArchiv.serien.size) {
    let adnJa = 0
    let adnNein = 0
    const adnOffen: string[] = []
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn' || stream.dub !== undefined) continue
        const befund = beurteileAdnVerweis(stream.url, adnArchiv)
        if (befund.dub === undefined) {
          adnOffen.push(`${title.id}: ${befund.grund}`)
          continue
        }
        stream.dub = befund.dub
        if (befund.dub) adnJa++
        else adnNein++
      }
    }
    log(
      `${adnJa + adnNein} ADN-Verweise aus dem Archiv belegt (${adnJa}× deutsche Synchro, ${adnNein}× nur Untertitel; ` +
        `${adnArchiv.folgenMitVde} von ${adnArchiv.folgenGesamt} Folgen aus ${adnArchiv.serien.size} Serien tragen vde)`,
    )
    // Die offenen Fälle stehen im Protokoll, damit sie nicht still liegenbleiben:
    // Das Archiv wächst mit jedem Montagslauf, und was heute fehlt, kann nächste
    // Woche beantwortet sein.
    if (adnOffen.length) log(`${adnOffen.length} ADN-Verweise bleiben offen — ${adnOffen.join('; ')}`)
  }
}

export function stelleAdnFolgenverweiseUm({ titles, adnArchiv }: {
  titles: Map<number, Title>
  adnArchiv: AdnArchiv
}) {
  {
    // Folgenverweise auf die alte Domain — Begründung an `adnFolgenAdresse`.
    let umgestellt = 0
    for (const title of titles.values())
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const neu = adnFolgenAdresse(stream.url, adnArchiv)
        if (!neu) continue
        stream.url = neu
        umgestellt++
      }
    if (umgestellt) log(`${umgestellt} ADN-Folgenverweise von animationdigitalnetwork.de auf ADNs eigene Adresse umgestellt`)
  }
}
