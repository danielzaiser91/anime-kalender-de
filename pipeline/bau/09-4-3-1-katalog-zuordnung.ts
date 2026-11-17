import { readJson, log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { kapitelImBlock, type CrDubData } from '../lib/crunchyroll-dub.ts'

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
export function belegeAusKatalogZuordnung({ titles }: {
  titles: Map<number, Title>
}) {
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
}

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
export function belegeKapitelImBlock({ crDub, titles }: {
  crDub: CrDubData
  titles: Map<number, Title>
}) {
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
}

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
export function belegeFilmbloecke({ titles }: {
  titles: Map<number, Title>
}) {
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
}
