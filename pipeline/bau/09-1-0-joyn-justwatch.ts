import { type Zugangsart } from '../../shared/zugangsart.ts'
import { readJson, log } from '../lib/util.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { type StreamLink, type Title } from '../../shared/types.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'

/**
 * **Joyn-Angebote von JustWatch werden Joyn-Verweise** (22.09.2026).
 *
 * `providerToPlatform` ordnet „Joyn" und „Joyn Plus" der eigenen Plattform `joyn` zu. Die
 * JustWatch-Runden unten überspringen solche Angebote, weil ein Verweis mit Sprachurteil sie
 * trägt — nur legte für Joyn niemand einen an. Gemessen am 22.09.2026: JustWatch nennt 81
 * Joyn-Adressen, im Datensatz standen 2. Naruto, Detektiv Conan, Frieren, Solo Leveling,
 * My Hero Academia waren dort nicht zu finden, obwohl kostenlos abrufbar.
 *
 * Joyn selbst taugt nicht als Quelle: Das Impressum behält Text- und Data-Mining nach § 44b
 * UrhG ausdrücklich vor, `api.joyn.de` sperrt per robots.txt alles. JustWatch ist der
 * erlaubte Weg (docs/wissen/quellen.md).
 *
 * Stichprobe am selben Tag, 7 Seiten: 6 leben, die Lizenz stimmt mit JustWatch überein
 * (ADS = kostenlos, Joyn Plus = Abo); der Film „Ame & Yuki" lieferte 404. Tote Adressen
 * nimmt die Linkprüfung weiter unten heraus (`linkBefunde`), sobald sie gemessen sind.
 * Joyn zeigt oft nur ein rollendes Fenster (Frieren: 5 Folgen) — der Verweis sagt „läuft
 * dort", nicht „alle Folgen".
 *
 * Ein Special unter der TMDB-Kennung einer TV-Serie erbt deren Angebote nicht (`tvJeTmdb`).
 */
export function ergaenzeJoynAusJustwatch({ titles, tmdbMehrdeutig, tmdbTitles, tvJeTmdb, toteAdressen }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tvJeTmdb: Set<string>
  toteAdressen: Set<string>
}) {
  let joynVonJw = 0
  /*
    Adresse → Zugang, aus JustWatchs `art`. TMDB kennt nur flatrate/rent/buy, keine
    Werbefinanzierung, und `joyn` steht in der Abo-Liste von `zugangsart()` — ohne diese Karte
    stünde jeder kostenlose Joyn-Titel als „Abo" da (Angels of Death: JustWatch ADS, Pille „abo").
  */
  const joynZugang = new Map<string, Zugangsart>()
  {
    const jw = readJson<Record<string, { angebote?: { anbieter: string; art?: string; url?: string }[] }>>(
      'data/justwatch-audio.json',
      {},
    )
    /*
      Ein Joyn-Weg von Hand bringt seine Zugangsart mit (`verweise-von-hand.yaml`, Feld `zugang`) —
      Dragon Ball Super stand sonst als „Abo" da, obwohl die Folgen kostenlos sind (22.09.2026).
      Die Karte gilt vor JustWatch: `zugangsart()` setzt sonst später „abo".
    */
    for (const t of titles.values())
      for (const st of t.streams ?? []) if (st.platform === 'joyn' && st.zugang) joynZugang.set(st.url, st.zugang)
    for (const b of Object.values(jw))
      for (const x of b.angebote ?? []) {
        if (!x.url || providerToPlatform(x.anbieter) !== 'joyn') continue
        /* Kostenlos schlägt Abo: Dieselbe Seite steht bei JustWatch oft als „Joyn" und „Joyn Plus". */
        if (x.art === 'ADS' || x.art === 'FREE') { if (!joynZugang.has(x.url) || joynZugang.get(x.url) === 'abo') joynZugang.set(x.url, 'kostenlos') }
        else if (!joynZugang.has(x.url)) joynZugang.set(x.url, 'abo')
      }
    for (const title of titles.values()) {
      if ((title.streams ?? []).some((s) => s.platform === 'joyn')) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const info = tmdbTitles[title.id]
      if (title.format !== 'TV' && info && tvJeTmdb.has(`${info.kind}${info.tmdbId}`)) continue
      const a = (jw[String(title.id)]?.angebote ?? []).find(
        (x) => x.url && providerToPlatform(x.anbieter) === 'joyn' && !toteAdressen.has(x.url),
      )
      if (!a?.url) continue
      title.streams = [...(title.streams ?? []), { platform: 'joyn', url: a.url } as StreamLink]
      joynVonJw++
    }
  }
  if (joynVonJw) log(`${joynVonJw} Joyn-Verweise aus JustWatch ergänzt`)
  return { joynZugang }
}
