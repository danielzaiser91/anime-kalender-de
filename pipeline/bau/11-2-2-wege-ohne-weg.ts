import { log } from '../lib/util.ts'
import { type Title, type WatchLink } from '../../shared/types.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'

export type JwEintrag = { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string }[] }

/**
 * Händler, die bei JustWatch eine **Disc** verkaufen oder verleihen. Alle übrigen
 * Kauf- und Leihangebote dort sind digital. Belegt an den Anbietern im Bestand vom
 * 16.09.2026; Videobuster steht hier, weil es vor allem Discs per Post verleiht.
 */
export const PHYSISCHE_SHOPS =
  /amazon dvd|blu-ray|thalia|hugendubel|buecher|zavvi|jpc|zoxs|medimops|verleihshop|behind the tree|videobuster/i

/**
 * **Ein Titel ohne jeden Bezugsweg — was JustWatch dazu kennt.**
 *
 * 243 Titel im Hauptbestand hatten am 07.09.2026 keinen einzigen Weg. Für
 * sie beantwortet der Kalender Punkt 4 des Projektziels gar nicht („Nicht
 * nur wann, auch wo"), und das ist bei den meisten Titeln **die** Frage: Nur
 * gut hundert haben überhaupt einen anstehenden Termin.
 *
 * `data/justwatch-audio.json` nennt zu jedem Angebot eine Adresse. Sie
 * kommen hier als **Bezugswege** an, nicht als Verweise mit Sprachurteil:
 * Die Tonspurangabe gilt der Serie, nicht der Folge, und daraus wird
 * grundsätzlich kein `dub`.
 *
 * Vier Riegel, jeder mit belegtem Anlass:
 *
 * | Riegel | warum |
 * |---|---|
 * | nur Titel **ohne** jeden Weg | wo schon einer steht, ist die Frage beantwortet — und unsere Adresse ist die geprüfte |
 * | nichts, was einmal entfernt wurde | sonst kommt ein belegtes Nein über die Hintertür zurück |
 * | „JustWatch TV" fliegt raus | die Eigenwerbung des Dienstes, führt zurück auf justwatch.com |
 * | höchstens vier je Titel | eine Liste von zwölf Amazon-Varianten beantwortet keine Frage |
 */
export function ergaenzeWegeOhneWeg({ titles, jw, tmdbMehrdeutig, toteAdressen }: {
  titles: Map<number, Title>
  jw: Record<string, JwEintrag>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}) {
  let jwWege = 0
  for (const title of titles.values()) {
    if ((title.streams ?? []).length || (title.watchLinks ?? []).length) continue
    /* JustWatch findet den Titel über dieselbe TMDB-Kennung — mehrdeutig heißt auch hier: nicht verwenden. */
    if (tmdbMehrdeutig.has(String(title.id))) continue
    const b = jw[String(title.id)]
    if (!b || b.ohneTreffer || !b.angebote?.length) continue
    const wege: WatchLink[] = []
    for (const a of b.angebote) {
      if (!a.url || /^justwatch/i.test(a.anbieter)) continue
      if (toteAdressen.has(a.url)) continue
      const name = providerName(a.anbieter)
      if (!name || wege.some((w) => w.name === name)) continue
      /*
        **Ein Kino ist kein Bezugsweg** (Daniel, 19.09.2026: Cinestar führte nach Leipzig,
        Filmspiegel nach Essen). JustWatch kennzeichnet Kinoangebote selbst mit `art: CINEMA`
        (gemessen: Cinestar 3, UCI 2, Filmspiegel 1) — das ist sicherer als eine Namensliste,
        die „Netzkino" (ein Streamingdienst) mitgeschluckt hat. Die Spielzeiten stehen im
        Kinobanner, bundesweit über kinoheld.
      */
      if (a.art === 'CINEMA') continue
      /*
        JustWatch führt Disc-Händler und Online-Videotheken in derselben Liste. Ein
        Disc-Händler bleibt ein Kaufweg; alles andere ist digital und zählt zum
        Streamen — gemessen an 3.279 Kauf- und Leihangeboten im Bestand vom 16.09.2026.
      */
      const physisch = PHYSISCHE_SHOPS.test(a.anbieter)
      wege.push({
        name,
        /* JustWatch hängt an Amazon-Links seine Partnerkennung (`tag=movie0c6-21`). */
        url: stripAffiliate(a.url),
        kind: physisch ? 'buy' : 'stream',
        ...(physisch
          ? {}
          : { zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf' }),
      } as WatchLink)
      if (wege.length >= 4) break
    }
    if (!wege.length) continue
    title.watchLinks = wege
    jwWege += wege.length
  }
  if (jwWege) log(`${jwWege} Bezugswege aus JustWatch für Titel ohne jeden Weg ergänzt`)
}
