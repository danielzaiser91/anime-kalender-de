import { loadDubChecks, dubKey } from '../lib/dub-confirmed.ts'
import { log } from '../lib/util.ts'
import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'
import { type MotnDaten } from '../lib/motn.ts'
import { type PlatformId } from '../../shared/types.ts'
import { zugangsart } from '../../shared/zugangsart.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'
import { type SlimTitel } from './13-2-auslieferung.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'

/**
 * Titel ganz ohne Weg bekommen einen — wenn **zwei** Quellen ihn belegen.
 *
 * Gemessen am 25.08.2026: **875 der 2.762 Titel** zeigen weder einen
 * Anbieter-Verweis noch einen Kauflink. Für den Besucher heißt das „dieser
 * Anime hat eine deutsche Synchronfassung" — und dann nichts. Das ist die
 * größte Lücke am vierten Punkt des Projektziels („Nicht nur wann, auch wo.
 * Bei den meisten Titeln ist das die eigentliche Frage").
 *
 * Darunter sind keine Randfälle: „One Punch Man", „Gintama", „Durarara!!",
 * „Mahouka Koukou no Rettousei", „Fate/stay night: Unlimited Blade Works".
 *
 * **Zwei unabhängige Quellen müssen sich einig sein**, und beide liegen im
 * Haus:
 *
 * - `data/tmdb-titles.json` nennt je Titel die Anbieter in Deutschland
 *   (`providers`) — das ist die Aussage „dort läuft es".
 * - `data/motn-links.json` nennt je IMDb-Kennung den Deep-Link — das ist die
 *   Adresse dazu.
 *
 * Verbunden werden sie über die IMDb-Kennung aus `data/motn.json`. Ein
 * Verweis entsteht nur, wo **beide** etwas sagen: TMDB allein liefert keine
 * Adresse (und eine Anbieter-Startseite wäre kein Verweis, sondern eine
 * Zumutung), das Archiv allein keine Bestätigung, dass der Titel dort heute
 * noch läuft.
 *
 * **Die Sprachangabe bleibt offen.** TMDB belegt sie nicht (siehe
 * `fetch-tmdb-kino.ts`), das Archiv auch nicht. Der Verweis trägt deshalb
 * kein `dub` — die Oberfläche schreibt „🇩🇪 ?", und das ist die ehrliche
 * Antwort. Ein Weg ohne Sprachangabe ist trotzdem mehr wert als gar keiner.
 */
/**
 * **Ein Titel ohne Verweis ist nicht dasselbe wie ein Titel ohne geprüften
 * Verweis** — und diese Unterscheidung hat der erste Anlauf verfehlt.
 *
 * Am 25.08.2026 ergänzte er 14 Titeln einen Weg, weil TMDB einen Anbieter
 * nannte und das MOTN-Archiv eine Adresse dazu hatte. Fünf davon hatten ihren
 * Verweis aber **aus gutem Grund** nicht: Daniel hatte sie geprüft und als
 * „ohne deutsche Tonspur" oder „nicht verfügbar" eingetragen, woraufhin der
 * Bau sie entfernt. „Kino's Journey" auf Netflix etwa, geprüft am 22.08.2026
 * — Folgen 1 bis 13 ohne deutschen Ton.
 *
 * Die Ergänzung holte sie zurück und überschrieb damit eine Handprüfung.
 * Das ist der schwerste Fehler, den dieses Projekt kennt: **Was ein Mensch
 * geprüft hat, schlägt jede Ableitung** — und eine Ableitung, die es
 * stillschweigend überstimmt, macht die teuerste Datenquelle wertlos.
 *
 * Gefangen hat es `check:handbelege`, genau wofür der Lauf gebaut ist. Der
 * Deploy wurde rot, bevor etwas ausgeliefert war.
 *
 * Ergänzt wird deshalb nur, wo zu Titel **und** Plattform **keine**
 * Handprüfung vorliegt. Ein `dub: true` von Hand wäre ohnehin schon im
 * Datensatz; alles andere ist ein ausdrückliches Nein.
 */
export function ergaenzeWegeAusTmdbUndMotn({ slim, tmdbTitles, tmdbZuTitel, motnTmdb, motnLinks }: {
  slim: SlimTitel[]
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tmdbZuTitel: Record<string, { tmdbId?: number; kind?: string }>
  motnTmdb: NonNullable<MotnDaten['tmdb']>
  motnLinks: Record<string, Record<string, string>>
}) {
  const handgeprueft = new Set(
    loadDubChecks().map((c) => dubKey(c.anilistId, c.platform)),
  )
  let wegeErgaenzt = 0
  let wegenHandpruefung = 0
  for (const eintrag of slim) {
    /* Nur bei aniSearch geführte Titel (Specials, OVAs) hängen bei TMDB oft an der Hauptserie; deren Anbieter wären erraten (12.10.2026: Fate/Stay Night UBW Prologue, GGO Refrain, Veldora’s Journal). */
    if (eintrag.id >= ANISEARCH_ID_BASIS) continue
    if ((eintrag.streams ?? []).length || (eintrag.watchLinks ?? []).length) continue
    const zu = tmdbZuTitel[String(eintrag.id)]
    if (!zu?.tmdbId || !zu.kind) continue
    const anbieter = (zu as { providers?: string[] }).providers
    if (!anbieter?.length) continue
    const imdb = motnTmdb[`${zu.kind}/${zu.tmdbId}`]?.imdbId
    if (!imdb) continue
    const links = motnLinks[imdb]
    if (!links) continue

    const neue = []
    for (const [platform, url] of Object.entries(links)) {
      // Nur was TMDB **auch** nennt: Das Archiv kann einen Link führen, den es
      // heute nicht mehr gibt.
      if (!anbieter.includes(platform)) continue
      // Und nichts, worüber ein Mensch schon entschieden hat.
      if (handgeprueft.has(dubKey(eintrag.id, platform))) {
        wegenHandpruefung++
        continue
      }
      /*
        **Die Zugangsart gehört an den Verweis, sobald er entsteht.** Die
        Schleife, die sie sonst für alle Verweise setzt, läuft weiter oben —
        was hier später hinzukommt, hätte sie nie gesehen und stünde ohne
        Preisangabe im Kalender. `check:zugangsart` hat genau das gemeldet
        (25.08.2026, drei Verweise: Gintama, DEATH NOTE Rewrite, Durarara!!).
      */
      neue.push({
        platform: platform as PlatformId,
        url: platform === 'netflix' ? netflixTitelAdresse(url) : url,
        // Prime Video führt Abo- und Kauftitel nebeneinander; die lizenzierte
        // JustWatch-Angabe entscheidet, wo sie vorliegt. Ohne sie greift die
        // Vorgabe des Anbieters.
        zugang: zugangsart(
          platform,
          undefined,
          url,
          (tmdbTitles[eintrag.id]?.offers ?? []).find(
            (o) => providerToPlatform(o.name) === platform,
          )?.kind,
        ),
      })
    }
    if (!neue.length) continue
    eintrag.streams = neue
    wegeErgaenzt++
  }
  if (wegenHandpruefung) {
    log(`${wegenHandpruefung} Verweis(e) nicht ergänzt — dort liegt eine Handprüfung vor`)
  }
  if (wegeErgaenzt) {
    log(`${wegeErgaenzt} Titel ohne jeden Weg haben jetzt einen (TMDB-Anbieter + MOTN-Adresse)`)
  }
}
