import { type PlatformId, type Title } from '../../shared/types.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { readJson } from '../lib/util.ts'
import { serienNachKennung, type OffenerBefund } from '../lib/cr-nein-ueberholt.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import type { AdnArchiv } from '../lib/adn-sprachen.ts'
import { bewerteErgaenzteWegeNach } from './09-6-4-nachbewertung.ts'
import { ergaenzeKanalUndKaufWege } from './09-6-3-kanal-kauf.ts'
import { ergaenzeCrWegeAusKatalog } from './09-6-2-cr-katalog.ts'
import { ergaenzeWegeAusAnisearch } from './09-6-1-wege-aus-anisearch.ts'
import { frueherEntfernteWege } from './09-6-0-gedaechtnis.ts'

export function ergaenzeAnisearchWege({
  verweiseEntfernt,
  crDub,
  usNeinWiderlegt,
  titles,
  anisearch,
  belegFuer,
  linkBefunde,
  lautPruefungTot,
  crAdresseZu,
  crKatalogDeutsch,
  checks,
  adnArchiv,
  adnStreamSchaerfen,
}: {
  verweiseEntfernt: EntfernterVerweis[]
  crDub: CrDubData
  usNeinWiderlegt: (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null; }) => boolean
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  lautPruefungTot: (url: string) => boolean
  crAdresseZu: (name: string) => string | undefined
  crKatalogDeutsch: Set<string>
  checks: Map<string, DubCheck>
  adnArchiv: AdnArchiv
  adnStreamSchaerfen: (titleId: number, stream: { platform: string; url: string; }) => boolean
}) {
  /*
    **aniSearch nennt Bezugsquellen — und wir haben sie nie gelesen.**

    Der Abruf archiviert je Werk die Anbieter, bei denen es zu sehen ist. Der
    Bau benutzte davon genau eine Zeile: Sie ersetzt eine Prime-Suchadresse
    durch die echte Produktseite. Alles andere lag ungenutzt.

    **Der teuerste Einzelfall steht in CLAUDE.md und war nie behoben.**
    Detektiv Conan läuft bei Crunchyroll mit 405 deutschen Folgen — von Hand
    belegt am 25.08.2026, Kennung GW4HM7NV3. Im Bestand stand dazu ein
    Amazon-Kaufweg und sonst nichts: Der falsche Verweis (`case-closed`, der
    englische Block) wurde als belegtes Nein entfernt, der richtige nie
    angelegt. aniSearch führt ihn seit jeher — `crunchyroll.com/detektiv-conan`.

    Das ist kein Zufall, sondern die Bauart. `scrape-crunchyroll-dub.ts` bildet
    seine Warteschlange aus den Verweisen, die schon im Bestand stehen: Wo
    keiner steht, wird keiner geprüft, und wo keiner geprüft wird, entsteht auch
    keiner. Ein Kreis, der sich nur von außen öffnen lässt.

    **Der Block steht hier unten mit Absicht** — nach dem Entfernen der belegten
    Neins. Weiter oben sind die Anbieter noch besetzt, und ergänzt würde nichts;
    gemessen am 06.09.2026 kamen an der früheren Stelle 83 Verweise heraus
    statt der 625, die im ausgelieferten Datensatz wirklich fehlen.

    **Vier Riegel, jeder mit belegtem Anlass:**

    - **Die Adresse zählt, nicht der Anbieter.** Ein Crunchyroll-Block ist nicht
      das Werk (Conan oben, Blue Exorcist in CLAUDE.md). Ein Nein zu
      `case-closed` ist deshalb kein Nein zu `detektiv-conan`.
    - **Was einmal entfernt wurde, bleibt entfernt.** `data/verweise-entfernt.json`
      ist das Gedächtnis über Läufe hinweg; ohne diesen Riegel legte der Bau
      jede Woche wieder an, was der Prüflauf gerade verworfen hat — ein Flattern
      zwischen zwei Läufen, das niemandem auffällt.
    - **Ein Handbeleg schlägt alles**, auch ein verneinender. Das ist die Regel,
      an der am 25.08.2026 ein Lauf fünf geprüfte Neins überschrieben hat.
    - **Bei Amazon nur, was als Video belegt ist.** Hinter `/dp/` kann eine DVD
      liegen, und eine Disc als Stream auszugeben wäre schlimmer als gar kein
      Weg. Entschieden wird über `linkBefunde[url].prime` — dieselbe Bedingung
      wie bei der Ersetzung der Suchadressen.

    Die Verweise tragen **keine** Sprachangabe. Sie sagen „hier gibt es das",
    nicht „hier gibt es das auf Deutsch" — und genau so füllen sie die
    Warteschlangen, die bisher an ihrer eigenen Lücke verhungert sind.
  */
  {
    /** Adressen vergleichen sich nur ohne Protokoll, Parameter und Schrägstrich am Ende. */
    const adressKern = (u: string): string =>
      u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    const { frueherEntfernt } = frueherEntfernteWege({ adressKern, verweiseEntfernt })
    /**
     * **Eine tote Crunchyroll-Serie erkennt man an ihrer Kennung, nicht an der
     * Adresse.**
     *
     * Am 07.09.2026 ist der Bau daran rot geworden (Lauf 34106061181):
     * `.../de/series/G4PH0WJDQ/captain-tsubasa-junior-youth-arc` flog als
     * belegtes Nein aus dem Bestand — Crunchyroll meldet für die Serie „Videos
     * nicht mehr verfügbar" —, und dieselbe Runde hier legte Sekunden später
     * `.../series/G4PH0WJDQ/...` **ohne** `/de/` aus aniSearch neu an.
     * `check:cr-zuordnung` hat es zu Recht gemeldet: eine tote Serie, frisch
     * verlinkt.
     *
     * Weder `bekannt` noch `frueherEntfernt` konnten greifen: Beide vergleichen
     * normalisierte **Adressen**, und `adressKern()` gleicht den `/de/`-Teil
     * nicht aus. Die zweite Adresse war nie ein Stream, stand also in keiner
     * der beiden Mengen.
     *
     * **Nur `nichtVerfuegbar` zählt, nicht „gerade keine deutsche Folge".**
     * Der Vorschlag aus dem Reparatur-Lauf (PR #55) nahm zusätzlich jede Serie
     * mit `katalog: 'de'` und leerer Staffelliste — gemessen sind das **227
     * lebendige** Serien. Genau das ist das Kill-Blue-Muster vom selben Tag:
     * Am 22.08. hatte Crunchyroll dort null deutsche Folgen, am 06.09. lagen
     * acht vor. Heute keine Synchro zu haben ist kein Beleg dafür, nie eine zu
     * bekommen — und ein Ausschluss über die Kennung kennt keine Frist.
     */
    const toteCrSerien = new Set(
      crDub.serien.filter((s) => s.nichtVerfuegbar && s.seriesId && !usNeinWiderlegt(s)).map((s) => s.seriesId as string),
    )
    /**
     * **Dieselbe Sperre über die Adresse — für alles ohne Kennung.**
     *
     * Der Riegel unten fragte nur nach `/series/<Kennung>`. Crunchyroll-Adressen
     * im alten Format tragen keine (`crunchyroll.com/inuyashiki-last-hero`), und
     * genau eine davon kam am 07.09.2026 durch: als tot entfernt, von aniSearch
     * im selben Lauf neu ergänzt, Zusicherung rot („keine der 150 toten
     * Crunchyroll-Adressen steht noch im Datensatz", Lauf 34160329089, Issue #54).
     *
     * Verglichen wird über `adressKern()` — dieselbe Serie steht mit und ohne
     * `www.`, mit und ohne Schrägstrich am Ende.
     */
    /**
     * **Auch die Befunde aus `crunchyroll-offene.json` gehören hierher.**
     *
     * `crDub.serien` kennt nur, was der wöchentliche Lauf geprüft hat.
     * `fetch-crunchyroll-offene.ts` belegt daneben eigene Adressen als tot —
     * abgelaufene Videokennung, oder im deutschen Katalog nicht geführt und von
     * JustWatch gegengeprüft.
     *
     * Ohne diese Zeile legt die Nachrunde sie **jeden Lauf** neu an: Gemessen
     * am 10.09.2026 an „Millennium Actress" — die Serienadresse
     * `crunchyroll.com/de/millennium-actress` flog als „nicht mehr verfügbar"
     * heraus, und aus aniSearch kam `…/watch/GPWUKPVP4/…` zurück, eine andere
     * Adresse mit demselben Ziel. Der Verweis stand danach wieder da, ohne
     * Urteil, und mein Block weiter oben sah ihn nie — er läuft vorher.
     *
     * Das ist dieselbe Klasse wie „Wer unten ergänzt, muss unten auch
     * beurteilen" (06.09.2026), nur eine Quelle weiter.
     */
    /* Die Befunde aus dem Einzellauf — beide Blöcke unten lesen sie. */
    const crOffeneBefunde = readJson<Record<string, OffenerBefund>>('data/crunchyroll-offene.json', {})
    const crSerienJeKennung = serienNachKennung(crDub.serien)
    const toteCrAdressen = new Set([
      ...crDub.serien
        .filter((s) => !usNeinWiderlegt(s) && (s.nichtVerfuegbar || /nicht mehr verf|404/.test(s.fehler ?? '')))
        .map((s) => adressKern(s.url)),
      ...Object.entries(crOffeneBefunde)
        .filter(([, b]) => b?.herkunft === 'tot')
        .map(([url]) => adressKern(url)),
    ])
    ergaenzeWegeAusAnisearch({ titles, anisearch, adressKern, frueherEntfernt, toteCrSerien, toteCrAdressen, belegFuer, linkBefunde, lautPruefungTot })

    ergaenzeCrWegeAusKatalog({ titles, crAdresseZu, crKatalogDeutsch, adressKern, frueherEntfernt, toteCrSerien, belegFuer, lautPruefungTot })

    ergaenzeKanalUndKaufWege({ titles, anisearch, checks, adressKern, frueherEntfernt })

    bewerteErgaenzteWegeNach({ crDub, titles, belegFuer, crOffeneBefunde, crSerienJeKennung, adnArchiv, adnStreamSchaerfen, verweiseEntfernt })
  }
}
