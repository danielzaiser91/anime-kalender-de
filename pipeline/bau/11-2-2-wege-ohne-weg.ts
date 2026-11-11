import { type IstTot } from '../lib/adresse-tot.ts'
import { log, readJson } from '../lib/util.ts'
import { type Title, type WatchLink } from '../../shared/types.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'
import { plattformVon } from '../lib/cartoons.ts'

export type JwAngebot = { anbieter: string; art: string; url?: string; audio?: string[] }
export type JwEintrag = { ohneTreffer?: boolean; jwId?: string; angebote?: JwAngebot[]; staffeln?: { nr?: number; folgen?: number; angebote?: JwAngebot[] }[] }

/**
 * Händler, die bei JustWatch eine **Disc** verkaufen oder verleihen. Alle übrigen
 * Kauf- und Leihangebote dort sind digital. Belegt an den Anbietern im Bestand vom
 * 16.09.2026; Videobuster steht hier, weil es vor allem Discs per Post verleiht.
 */
export const PHYSISCHE_SHOPS =
  /amazon dvd|blu-ray|thalia|hugendubel|buecher|zavvi|jpc|zoxs|medimops|verleihshop|behind the tree|videobuster/i

/**
 * Der Disc-Weg aus `11-1` (aniSearch-Artikel, `data/disc-ausgaben.json`) sagt nichts darüber, wo man den Titel sehen kann, und schließt den
 * Riegel „ohne jeden Weg" deshalb nicht: Mit dem Weg gingen 26 Titel ihre JustWatch-Rückfallwege verloren (Netflix, ADN, Rtl+), 06.11.2026.
 */
const istAnisearchDisc = (w: WatchLink): boolean => w.kind === 'buy' && w.name === 'aniSearch'

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
 * | nur Anbieter, die der Titel **noch nicht** hat (`vorhandeneAnbieter`) | unsere Adresse beim selben Anbieter ist die geprüfte; ein anderer Stream beantwortet die Frage nach Netflix oder Disney+ nicht (06.11.2026: 292 von 298 Titeln mit JustWatch-Angeboten blieben so ohne sie); gilt nur bei Titeln mit Stream, ohne Stream schließt jeder Bezugsweg außer dem aniSearch-Disc-Link (PR 3029, `check-disc-folgewirkung.ts`) |
 * | nichts, was einmal entfernt wurde | sonst kommt ein belegtes Nein über die Hintertür zurück |
 * | „JustWatch TV" fliegt raus | die Eigenwerbung des Dienstes, führt zurück auf justwatch.com |
 * | höchstens vier je Titel | eine Liste von zwölf Amazon-Varianten beantwortet keine Frage |
 */
export function ergaenzeWegeOhneWeg({ titles, jw, handNein, tmdbMehrdeutig, istTot, entfernt = new Set() }: {
  titles: Map<number, Title>
  jw: Record<string, JwEintrag>
  /** Nein-Handbelege (`neinHandbelege`): Ein Weg zu einem Anbieter, den eine Handprüfung verneint hat, wird nicht angelegt. */
  handNein: Set<string>
  tmdbMehrdeutig: Set<string>
  istTot: IstTot
  /** `entfernteVerweise()`: Titel und Plattform, deren Verweis ein früherer Lauf entfernt hat; bei Titeln mit Wegen kommt dort nichts zurück. */
  entfernt?: ReadonlySet<string>
}) {
  let jwWege = 0
  for (const title of titles.values()) {
    /* Mit Stream gilt `vorhandeneAnbieter`; ohne Stream schließt jeder Bezugsweg außer dem aniSearch-Disc-Link den Riegel (PR 3029). */
    if (!(title.streams ?? []).length && (title.watchLinks ?? []).some((w) => !istAnisearchDisc(w))) continue
    /* JustWatch findet den Titel über dieselbe TMDB-Kennung — mehrdeutig heißt auch hier: nicht verwenden. */
    if (tmdbMehrdeutig.has(String(title.id))) continue
    const b = jw[String(title.id)]
    if (!b || b.ohneTreffer || !b.angebote?.length) continue
    const wege: WatchLink[] = []
    const da = vorhandeneAnbieter(title)
    /* Nur der aniSearch-Disc-Link am Titel (ohne Stream) gilt weiter als „ohne jeden Weg“ (PR 3029). */
    const leer = !da.plattformen.size && [...da.namen].every((n) => n === 'aniSearch')
    for (const a of nachArt(b.angebote)) {
      if (!a.url || /^justwatch/i.test(a.anbieter)) continue
      if (istTot(a.url)) continue
      const name = providerName(a.anbieter)
      if (!name || wege.some((w) => w.name === name) || da.namen.has(name)) continue
      const plattform = plattformVon(a.anbieter)
      /* Amazon Video (Leihe, Kauf) führt zu derselben Seite wie der Prime-Weg. */
      const gleich = plattform ?? (name === 'Amazon Video' ? 'primevideo' : undefined)
      if (gleich && da.plattformen.has(gleich)) continue
      if (!leer && gleich && entfernt.has(`${title.id}|${gleich}`)) continue
      if (plattform && wegVerneint(handNein, title.id, plattform, a.url)) continue
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
      /* Disc ist eine eigene Runde: ein Händler kommt nur zu Titeln ohne jeden Weg (wie bisher). */
      if (physisch && !leer) continue
      if (!leer && ohneBelegDeutsch(a)) continue
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
    title.watchLinks = [...wege, ...(title.watchLinks ?? [])]
    jwWege += wege.length
  }
  if (jwWege) log(`${jwWege} Bezugswege aus JustWatch für Anbieter ergänzt, die der Titel noch nicht hatte`)
}

/** Sub-Dienste mit eigener Sprachquelle (Crunchyroll, ADN, Aniverse): fehlt dort der Weg, ist das ein Befund, kein Loch. */
const EIGENE_SPRACHQUELLE = /crunchyroll|animation digital network|anime digital network|aniverse/i

/**
 * Bei einem Titel, der schon Wege hat, kommt ein Angebot nicht dazu, wenn JustWatch die Tonspuren nennt und `de` fehlt,
 * oder wenn der Dienst eine eigene Sprachquelle hat (Synchro ist nicht Untertitel).
 */
export function ohneBelegDeutsch(a: { anbieter: string; audio?: string[] }): boolean {
  return EIGENE_SPRACHQUELLE.test(a.anbieter) || (!!a.audio?.length && !a.audio.includes('de'))
}

/** Abo und Gratis vor Leihe und Kauf, sonst füllen vier Kaufangebote die Reihe, bevor Netflix drankommt (stabil). */
function nachArt<T extends { art: string }>(angebote: T[]): T[] {
  const rang = (a: T) => (a.art === 'FLATRATE' || a.art === 'FREE' || a.art === 'ADS' ? 0 : 1)
  return [...angebote].sort((x, y) => rang(x) - rang(y))
}

/** Titel und Plattform aus dem Gedächtnis der entfernten Verweise (`data/verweise-entfernt.json`), als `<titleId>|<plattform>`. */
export function entfernteVerweise(datei = 'data/verweise-entfernt.json'): Set<string> {
  const verweise = readJson<{ verweise?: { titleId?: number; plattform?: string }[] }>(datei, {}).verweise ?? []
  return new Set(verweise.map((v) => `${v.titleId}|${v.plattform}`))
}

/** Anbieter, die der Titel schon trägt: Stream-Plattformen und Namen der Bezugswege. */
export function vorhandeneAnbieter(title: Title): { plattformen: Set<string>; namen: Set<string> } {
  return {
    plattformen: new Set((title.streams ?? []).map((s) => s.platform)),
    namen: new Set((title.watchLinks ?? []).map((w) => w.name)),
  }
}
