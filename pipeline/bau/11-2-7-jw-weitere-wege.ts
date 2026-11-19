import { type IstTot } from '../lib/adresse-tot.ts'
import { type WatchLink, type Title } from '../../shared/types.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { PHYSISCHE_SHOPS, ohneBelegDeutsch } from './11-2-2-wege-ohne-weg.ts'

type JwAngebote = Record<string, { angebote?: { anbieter: string; art?: string; url?: string; audio?: string[] }[] }>

/**
 * **Auch Titel mit Wegen bekommen JustWatchs übrige Angebote** (Daniel, 17.09.2026,
 * zu Apple TV). TMDBs Anbieterliste ist dieselbe Datenbasis, aber je Titel teils
 * Wochen alt; JustWatch fragt der Wochenlauf jetzt reihum. Übernommen wird nur,
 * was keine eigene Plattform hat (die haben Verweise mit Sprachurteil) und noch
 * nicht als Weg dasteht — dieselben Regeln wie für Titel ohne jeden Weg.
 * Gilt für Anime und Cartoons gleich (Cartoons seit 18.11.2026). Gibt die Zahl der neuen Wege zurück.
 */
export function ergaenzeJwWeitereWege({ titles, jw, tmdbMehrdeutig, istTot }: {
  titles: Iterable<Title>
  jw: JwAngebote
  tmdbMehrdeutig: Set<string>
  istTot: IstTot
}): number {
  let jwNeu = 0
  for (const title of titles) {
    if (!(title.streams ?? []).length && !(title.watchLinks ?? []).length) continue
    if (tmdbMehrdeutig.has(String(title.id))) continue
    const angebote = jw[String(title.id)]?.angebote ?? []
    if (!angebote.length) continue
    const wege = title.watchLinks ?? []
    for (const a of angebote) {
      if (!a.url || /^justwatch/i.test(a.anbieter) || istTot(a.url)) continue
      if (providerToPlatform(a.anbieter)) continue
      const name = providerName(a.anbieter)
      if (!name || wege.some((w) => w.name === name)) continue
      /*
        Nur digital. Gemessen am 17.09.2026: 728 der 781 zusätzlichen Wege wären
        Disc-Händler gewesen (bücher.de, Thalia, Zavvi …) — ohne Angabe zur Ausgabe,
        Zavvi verkauft UK-Importe. Kinos sind keine Bezugswege.
      */
      if (PHYSISCHE_SHOPS.test(a.anbieter) || a.art === 'CINEMA') continue
      /* Wie in 11-2-2 bei Titeln mit Wegen: nennt JustWatch Tonspuren ohne `de`, ist es kein Weg zur Synchro (Synchro ist nicht Untertitel). */
      if (ohneBelegDeutsch(a)) continue
      wege.push({
        name,
        url: stripAffiliate(a.url),
        kind: 'stream',
        zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf',
      } as WatchLink)
      jwNeu++
    }
    if (wege.length) title.watchLinks = wege.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'stream' ? -1 : 1))
  }
  return jwNeu
}
