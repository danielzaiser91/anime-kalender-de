import { type PlatformId, type Title } from '../../shared/types.ts'
import { netflixTitelAdresse } from '../lib/netflix-adresse.ts'
import { log } from '../lib/util.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'

export function ergaenzeWegeAusAnisearch({ titles, anisearch, adressKern, frueherEntfernt, toteCrSerien, toteCrAdressen, belegFuer, linkBefunde, lautPruefungTot }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  adressKern: (u: string) => string
  frueherEntfernt: { has: (kern: string, titleId: number) => boolean; }
  toteCrSerien: Set<string>
  toteCrAdressen: Set<string>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  lautPruefungTot: (url: string) => boolean
}) {
  let wegeErgaenzt = 0
  const jeAnbieter: Record<string, number> = {}
  for (const title of titles.values()) {
    const quellen = anisearch[title.id]?.streams ?? []
    if (!quellen.length) continue
    const bekannt = new Set(
      [...title.streams, ...(title.entfernteStreams ?? []), ...(title.watchLinks ?? [])].map((x) =>
        adressKern(x.url),
      ),
    )
    const vorhanden = new Set(title.streams.map((x) => x.platform))
    for (const quelle of quellen) {
      const ziel = asAnbieter[quelle.provider ?? '']
      /*
        **Auch ein ergänzter Verweis geht durch die Adressnormalisierung.**

        `netflixTitelAdresse()` bringt jede Netflix-Adresse auf die Form
        `/title/<id>` — nur läuft sie weiter oben, und dieser Block hängt
        hinten. Am 06.09.2026 landeten dadurch zwei aniSearch-Adressen als
        `/watch/` im Datensatz, und die Pille der Statusanzeige öffnete
        Daniel direkt den laufenden Player: „mach pill clicks zu overview,
        nicht direkt player."

        Der Ort für die Regel ist die Regel selbst, nicht die Reihenfolge:
        Wer hier ergänzt, ergänzt in derselben Form wie alle anderen.
      */
      const url =
        ziel === 'netflix'
          ? netflixTitelAdresse((quelle.url ?? '').split('?')[0])
          : (quelle.url ?? '').split('?')[0]
      if (!ziel || !url) continue
      if (vorhanden.has(ziel)) continue
      if (bekannt.has(adressKern(url)) || frueherEntfernt.has(adressKern(url), title.id)) continue
      if (ziel === 'crunchyroll') {
        /* Die Kennung entscheidet, nicht die Schreibweise der Adresse — siehe `toteCrSerien`. */
        const kennung = /\/series\/([A-Z0-9]+)/.exec(url)?.[1]
        if (kennung && toteCrSerien.has(kennung)) continue
        /* Und wo keine Kennung steht, entscheidet die Adresse — siehe `toteCrAdressen`. */
        if (toteCrAdressen.has(adressKern(url))) continue
      }
      /*
        **Ein verneinender Handbeleg hält den Verweis draußen — ein bejahender
        nicht.**

        Der Riegel stand bis zum 06.09.2026 auf `checks.has(...)`, fragte also
        nur, **ob** jemand hingesehen hat. Das ist für ein Nein genau richtig
        (ein fehlender Verweis ist selbst eine Angabe, siehe CLAUDE.md,
        25.08.2026) und für ein Ja verkehrt herum: Wer geprüft hat, dass es
        dort auf Deutsch läuft, hat den besten Grund geliefert, den Weg
        anzulegen.

        Aufgefallen an „Sword Art Online II" (20594): aniSearch führt für den
        Titel `netflix.com/title/70302573`, zwei Handbelege sagen `dub: true`
        für die Folgen 1–24 — und im Datensatz stand kein Netflix-Weg. Über
        den ganzen Bestand gemessen ist das **der einzige** Fall (1 von 1.092
        bejahenden Handbelegen), die Änderung ist also so eng wie ihr Anlass.
      */
      const beleg = belegFuer(title.id, ziel, url)
      if (beleg && (beleg.dub !== true || beleg.available === false)) continue
      if (ziel === 'primevideo' && linkBefunde[url]?.prime !== true) continue
      if (lautPruefungTot(url)) continue
      title.streams.push({ platform: ziel, url })
      vorhanden.add(ziel)
      jeAnbieter[ziel] = (jeAnbieter[ziel] ?? 0) + 1
      wegeErgaenzt++
    }
  }
  if (wegeErgaenzt) {
    const verteilung = Object.entries(jeAnbieter)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')
    log(`${wegeErgaenzt} Anbieter-Verweise aus aniSearch ergänzt (${verteilung})`)
  }
}

/** aniSearch-Anbieterkennung → unsere Plattform; was hier fehlt, legt keinen Weg an (Bilanz 06.11.2026: `animation-digital-network-(de)`, `aniverse` fehlten). */
export const asAnbieter: Record<string, PlatformId> = {
  crunchyroll: 'crunchyroll',
  'adn-de': 'adn',
  adn: 'adn',
  'animation-digital-network-(de)': 'adn',
  'anime-digital-network-(de)': 'adn',
  aniverse: 'primevideo',
  netflix: 'netflix',
  disneyplus: 'disneyplus',
  youtube: 'youtube',
  joyn: 'joyn',
  'rtl-plus': 'rtlplus',
  'prime-video': 'primevideo',
  'amazon-de': 'primevideo',
  'amazon-(de)': 'primevideo',
  'primevideo-channel-crunchyroll-de': 'primevideo',
  'primevideo-channel-aniverse-de': 'primevideo',
}
