import { type PlatformId, type Title } from '../../shared/types.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { adressKern, type DubCheck } from '../lib/dub-confirmed.ts'
import { zugangsart, type Zugangsart } from '../../shared/zugangsart.ts'
import { log } from '../lib/util.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'

/**
 * Jedem Verweis seine Zugangsart geben.
 *
 * Steht spät, damit auch die ergänzten und umsortierten Verweise sie bekommen.
 * Was es kostet, entscheidet `shared/zugangsart.ts` aus Name, Adresse und der
 * Angabe des Anbieters selbst — `kind: 'buy'` ist die stärkste davon.
 */
export function pflegeWegeNachBelegen({ titles, tmdbTitles, ytKanal, zugangJeAdresse, joynZugang, ytKauf, checks, geprueft, entfernt, ytAusTonspur, adressen, totEntfernt, ytEntfernt }: {
  titles: Map<number, Title>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  ytKanal: Record<string, string>
  zugangJeAdresse: Map<string, 'abo' | 'kauf'>
  joynZugang: Map<string, Zugangsart>
  ytKauf: Set<string>
  checks: Map<string, DubCheck>
  geprueft: number
  entfernt: number
  ytAusTonspur: number
  adressen: number
  totEntfernt: number
  ytEntfernt: number
}) {
  for (const title of titles.values()) {
    /**
     * Die lizenzierte Angabe von JustWatch (über TMDB) schlägt die Namensliste.
     *
     * Sie gilt für **diesen Titel bei diesem Anbieter**, nicht für den Anbieter
     * im Allgemeinen — und genau daran scheiterte das Raten: Prime Video führt
     * Abo-Titel und Kauftitel nebeneinander. Gemessen am 23.08.2026 betraf das
     * 28 von 774 belegbaren Verweisen, alle bei Prime Video als „abo" geraten.
     *
     * Die Daten lagen die ganze Zeit in `data/tmdb-titles.json`; ausgewertet
     * wurden sie bisher nur für Anbieter **ohne** eigene Plattform.
     */
    const angebote = tmdbTitles[title.id]?.offers ?? []
    const jwArt = (platform: PlatformId) =>
      angebote.find((o) => providerToPlatform(o.name) === platform)?.kind

    for (const s of title.streams ?? []) {
      // Der YouTube-Kanal entscheidet über Kauf oder kostenlos — siehe
      // `zugangsart()`. Er steht in den Befunden, nicht im Verweis selbst.
      const kanal = s.platform === 'youtube' ? ytKanal[s.url] : undefined
      /* Auf der Seite gemessen schlägt JustWatch je Titel — siehe `zugangJeAdresse`. */
      const gemessen =
        s.platform === 'primevideo'
          ? zugangJeAdresse.get(adressKern(s.url))
          : s.platform === 'joyn'
            ? joynZugang.get(s.url)
            : undefined
      s.zugang = gemessen ?? zugangsart(s.platform, undefined, s.url, jwArt(s.platform), kanal, ytKauf.has(s.url))
    }
    for (const w of title.watchLinks ?? []) {
      w.zugang = zugangsart(w.name, w.kind, w.url, jwArt(providerToPlatform(w.name) as PlatformId))
    }
  }

  if (checks.size) {
    log(
      `${geprueft} geprüfte Synchro-Angaben übernommen, ${entfernt} tote Verweise entfernt (${checks.size} Prüfungen)` +
        (ytAusTonspur ? `, ${ytAusTonspur} YouTube-Urteile aus der Tonspur-Angabe` : ''),
    )
  }
  if (adressen) {
    log(`${adressen} Anbieter-Adressen durch die von Hand geprüfte ersetzt`)
  }
  if (totEntfernt) log(`${totEntfernt} Verweise entfernt: die Seite dahinter antwortet mit 404`)
  if (ytEntfernt) log(`${ytEntfernt} YouTube-Verweise entfernt: dort ist in Deutschland kein Video abrufbar`)
}
