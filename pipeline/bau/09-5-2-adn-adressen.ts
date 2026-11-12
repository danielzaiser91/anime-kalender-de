import yaml from 'js-yaml'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ladeAdnStaffelzuordnung } from '../lib/adn-staffelzuordnung.ts'
import { adnAdresseSchaerfen } from '../lib/adn-sprachen.ts'
import { log, ROOT } from '../lib/util.ts'
import { type AdnData } from '../lib/adn.ts'
import { type Release, type Title } from '../../shared/types.ts'

export function staffelnAusAdnSlugs({ releases }: {
  releases: Release[]
}) {
  /**
   * **Die Staffel steht im Release-Slug — und sie entscheidet das Urteil.**
   *
   * Eine ADN-Serienkennung ist ein Franchise: 461 führt alle
   * Haikyu!!-Staffeln, 444 alle vier JoJo-Blöcke. Ein Verweis auf die nackte
   * Serie bekommt deshalb „gemischt" — richtig und unbrauchbar.
   *
   * Die Staffel liegt längst im Haus: `adn-461-s3-20231001` steht als Slug an
   * jedem ADN-Release, und sie stammt aus `staffelBloecke()`, das über die
   * **Folgenzahl** zuordnet. Sie wird hier also nicht ermittelt, sondern
   * abgelesen — und nur, wenn sie eindeutig ist: Nennen zwei Releases
   * desselben Titels verschiedene Blöcke, bleibt der Verweis, wie er ist.
   *
   * Gemessen am 06.09.2026: 25 weitere Verweise bekommen so ein Ja. Übrig
   * bleiben acht, deren Serie gemischt ist und zu denen kein ADN-Release
   * existiert — dort sagt niemand, welche Staffel gemeint ist.
   */
  const ausRelease = new Map<number, { show: number; staffel?: string } | null>()
  for (const release of releases) {
    if (release.platform !== 'adn') continue
    const teile = /^adn-(\d+)(?:-s(\d+))?/.exec(release.slug)
    if (!teile) continue
    const jetzt = { show: Number(teile[1]), staffel: teile[2] }
    const bisher = ausRelease.get(release.titleId)
    if (bisher === undefined) ausRelease.set(release.titleId, jetzt)
    else if (bisher && (bisher.show !== jetzt.show || bisher.staffel !== jetzt.staffel)) {
      // Zwei Blöcke, kein eindeutiger Bezug — dann lieber keine Schärfung.
      ausRelease.set(release.titleId, null)
    }
  }
  return { ausRelease }
}

export function ladeAdnAdressen() {
  /**
   * **Serien, die der Katalog gerade nicht führt.**
   *
   * `data/adn-adressen.yaml` hält je AniList-Kennung die ADN-Serienkennung
   * fest — gemessen über `gw.api.animationdigitalnetwork.com/show/<id>` mit
   * `X-Target-Distribution: de`, nicht über einen Seitenaufruf: Beide
   * ADN-Domains antworten jedem Skript mit 403, die alte wie die neue.
   */
  const adnAdressen: Record<number, number> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-adressen.yaml'), 'utf8'))
      const raus: Record<number, number> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
        raus[Number(k)] = Number(v)
      }
      return raus
    } catch {
      return {}
    }
  })()
  return { adnAdressen }
}

export function schaerfeAdnAdressen({ adnKatalog, releases, titles, adnVerweiseErgaenzt }: {
  adnKatalog: AdnData
  releases: Release[]
  titles: Map<number, Title>
  adnVerweiseErgaenzt: number
}) {
  /**
   * **Alte ADN-Adressen bekommen ihre Serienkennung — vor der Auswertung.**
   *
   * `animationdigitalnetwork.de/video/<slug>` trägt keine Kennung, und der
   * Namensteil ist teils französisch (`50-nuances-de-gras` für „Plus-Sized
   * Elf"). `beurteileAdnVerweis` steigt dort aus, obwohl die Serie im Archiv
   * liegt: Gemessen am 06.09.2026 bekamen **48 von 135** ADN-Verweisen kein
   * Urteil aus dem Archiv, 33 davon allein aus diesem Grund. (Im Datensatz
   * sichtbar offen waren zwölf — der Rest trägt sein `dub` aus einer anderen
   * Quelle und wäre bei deren Ausfall genauso stumm.)
   *
   * Die Kennung wird nicht gesucht, sondern nachgeschlagen — zwei Quellen, und
   * keine davon rät:
   *
   * - **Der Katalog** trägt je Serie eine `anisearchId` (im Bau `titleId`). Sie entsteht über
   *   `lib/adn-anisearch.ts` (`bewerteTreffer`/`passtZuSerie`, seit 13.10.2026 aus aniSearchs Titelliste), wird je Serie nur
   *   einmal vergeben und ist damit dieselbe Zuordnung, aus der die übrigen
   *   ADN-Adressen im Bestand stammen. 33 der 65 alten Adressen sind so
   *   aufgelöst.
   * - **`data/adn-adressen.yaml`** für Serien, die der Katalog gerade nicht
   *   führt — die Liste ist gemessen, nicht geschätzt.
   *
   * Wirkung im selben Lauf gemessen: 38 Adressen berichtigt, danach 31 belegte
   * Ja und 6 belegte Nein; genau ein Verweis bleibt offen, weil seine Serie
   * gemischt ist (Chained Soldier, 1 von 24 Folgen mit `vde`).
   *
   * **Umgeschrieben wird nur die Serienadresse.** Ein Folgenverweis behält
   * seine alte Form, siehe `adnAdresseMitKennung`.
   */
    const { adnAdressen } = ladeAdnAdressen()
    /**
   * **Titel ohne eigenes ADN-Release — die Staffel steht dann hier.**
   *
   * Die Staffel kommt sonst aus dem Release-Slug (`adn-461-s3-20231001`). Zu
   * manchen Titeln gibt es kein ADN-Release; ihr Verweis zeigt auf die nackte
   * Serienkennung und bekommt den Befund „gemischt" — richtig und unbrauchbar.
   *
   * `data/adn-staffelzuordnung.yaml` hält je AniList-Kennung die ADN-Staffel
   * fest, belegt über die **Folgenzahl** und nur dort, wo sie eindeutig ist.
   * Gemessen am 07.09.2026 an JoJo (Serie 444): Staffel 1 hat 26 Folgen,
   * Staffel 2 achtundvierzig, Staffel 3 und 4 je 39 — die ersten drei unserer
   * fünf Titel sind damit eindeutig, die beiden 39er ausdrücklich nicht.
   */
  const adnStaffeln = ladeAdnStaffelzuordnung()
  const katalogKennung = new Map<number, number>()
    // Derselbe Katalog wie oben, samt den dort verworfenen Zuordnungen.
    for (const s of adnKatalog.shows) {
      if (s.titleId && !katalogKennung.has(s.titleId)) katalogKennung.set(s.titleId, s.showId)
    }
    const { ausRelease } = staffelnAusAdnSlugs({ releases })
    let berichtigt = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const ausSlug = ausRelease.get(title.id) ?? undefined
        const kennung = adnAdressen[title.id] ?? katalogKennung.get(title.id) ?? ausSlug?.show
        const neu = adnAdresseSchaerfen(stream.url, { kennung, staffel: ausSlug?.staffel })
        if (!neu) continue
        stream.url = neu
        berichtigt++
      }
    }
    if (berichtigt) log(`${berichtigt} ADN-Adressen um Serienkennung oder Staffel geschärft`)
    if (adnVerweiseErgaenzt) log(`${adnVerweiseErgaenzt} ADN-Verweise aus ADN-Terminen angelegt`)
  return { ausRelease, adnAdressen, katalogKennung, adnStaffeln }
}
