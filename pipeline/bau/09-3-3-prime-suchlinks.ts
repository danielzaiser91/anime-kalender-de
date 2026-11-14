import { dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { amazonTitelAdresse } from '../lib/amazon-adresse.ts'
import { log } from '../lib/util.ts'
import { type Title, type PlatformId } from '../../shared/types.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

/**
 * Ein Suchlink weicht der echten Produktseite.
 *
 * AniList liefert für die meisten Titel keinen Deeplink zu Prime Video,
 * deshalb steht dort eine Suche — am 20.08.2026 bei **225 von 226**
 * Verweisen. Das ist besser als ins Nichts zu schicken, aber schlechter als
 * die Seite selbst: Daniel musste beim Prüfen jedes Mal erst den richtigen
 * Treffer heraussuchen („zu mühselig, alles von Hand zu prüfen").
 *
 * Für 137 dieser Titel steht die echte Adresse längst in unserem
 * aniSearch-Bestand — nur unter dem Anbieternamen `amazon`, der bei uns als
 * **Kauf** gilt. Ob dahinter ein Video oder eine Disc liegt, lässt sich den
 * Daten nicht ansehen; es steht im Seitentitel, und genau den liest
 * `check-links.ts` mit („Amazon.de: … ansehen | Prime Video").
 *
 * Ersetzt wird deshalb nur, was **belegt** ein Prime-Video-Eintrag ist und
 * mit 200 antwortet. Alles andere bleibt die Suche.
 */
/*
  **Gesucht wird in zwei Beständen, nicht in einem.**

  Bis zum 25.08.2026 sah dieser Block nur in `watchLinks` nach. Dorthin schafft
  es eine aniSearch-Amazon-Adresse aber nur als Kaufweg — und Kaufwege werden
  weiter oben aussortiert, sobald die Seite tot oder hier gesperrt ist. Für
  „The Ghost in the Shell" blieb dadurch die Suchadresse stehen, obwohl
  `amazon.de/dp/B0GZD5N2GP` seit dem aniSearch-Abruf im Haus lag; Daniel
  schickte genau diese Kennung von Hand („führt beim klick auf ‚bei prime
  ansehen' auf die suchseite statt hierhin").

  Der zweite Bestand ist deshalb `data/anisearch.json` selbst. Die Bedingung
  bleibt dieselbe und ist der ganze Punkt: **belegt** ein Prime-Video-Eintrag,
  Status 200. Hinter `/dp/` kann auch eine DVD liegen, und eine Disc als Stream
  auszugeben wäre schlimmer als eine Suche.
*/
export function ersetzePrimeSuchlinks({ titles, linkBefunde, checksJePlattform, anisearch, lautPruefungTot, belegFuer }: {
  titles: Map<number, Title>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  checksJePlattform: Map<string, DubCheck[]>
  anisearch: Record<string, AnisearchEintrag>
  lautPruefungTot: (url: string) => boolean
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
}) {
  let ersetzt = 0
  for (const title of titles.values()) {
    const prime = title.streams.find((s) => s.platform === 'primevideo')
    if (!prime || !/amazon\.[a-z.]+\/s\?/.test(prime.url)) continue
    const belegt = (u: string | undefined): u is string => {
      if (!u) return false
      const b = linkBefunde[u]
      return b?.prime === true && b.status === 200
    }
    /**
     * **Die zweite Quelle für „diese Seite gibt es": Daniels eigene Notiz.**
     *
     * Der Riegel darüber verlangt einen Link-Befund mit Status 200. Den gibt es
     * für Amazon nur in Losen — der Prüflauf kommt nach rund 660 Abrufen in die
     * Abwehr und bucht danach `unklar` (623 Adressen am 07.09.2026). Deshalb
     * stand am 10.09.2026 für 33 Titel eine Amazon-**Suche** im Kalender,
     * obwohl aniSearch die Titelseite kennt und Daniel sie beim Prüfen selbst
     * offen hatte.
     *
     * Genau das ist der Beleg: Seine Notiz nennt die Kennung, auf der er
     * nachgesehen hat („Amazon-Seite B0F2GXP162 … Seitenadresse: B0DXS2THFS").
     * Steht **dieselbe** Kennung auch in aniSearchs Quellenliste, haben zwei
     * unabhängige Stellen dieselbe Seite genannt — ein Mensch mit der Seite vor
     * Augen schlägt einen HTTP-Statuscode.
     *
     * Gemessen: 19 der 33 tragen das. Die übrigen 14 bleiben bei der Suche —
     * entweder kennt aniSearch keine Kennung (7) oder die Notiz nennt eine
     * andere Seite als aniSearch (7), und dann entscheidet nichts.
     */
    const ausNotiz = (): string | undefined => {
      const notizen = (checksJePlattform.get(dubKey(title.id, 'primevideo')) ?? [])
        .map((c) => c.note ?? '')
        .join(' ')
      if (!notizen) return undefined
      for (const quelle of anisearch[title.id]?.streams ?? []) {
        const kennung = /amazon\.[a-z.]+\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,})/i.exec(
          String(quelle.url ?? ''),
        )?.[1]
        if (kennung && notizen.includes(kennung)) return amazonTitelAdresse(kennung)
      }
      return undefined
    }
    const echt =
      (title.watchLinks ?? []).find((w) => belegt(w.url))?.url ??
      (anisearch[title.id]?.streams ?? [])
        .map((s) => s.url?.split('?')[0])
        .find((u) => belegt(u)) ??
      ausNotiz()
    /*
      **Auch hier keine Adresse, die die Linkprüfung als tot kennt** (18.09.2026,
      Mob Psycho 100 und Horimiya). `ausNotiz()` baut die Adresse aus der Kennung
      neu (`amazonTitelAdresse`) und fragt dabei nicht nach, ob sie noch lebt.
      Ein zweiter, per `verweise-von-hand.yaml` angelegter Verweis auf dieselbe
      — lebende — Kennung wurde danach als Dublette verworfen, und übrig blieb
      die hier neu eingesetzte tote Adresse. Dieselbe Stelle wie bei den
      Handbelegen und den Rohfolgen: Der Riegel gehört vor jede Zuweisung.
    */
    if (!echt || lautPruefungTot(echt)) continue
    /*
      **Und keine Adresse, die ein Handbeleg als nicht verfügbar führt** (21.09.2026).
      Golden Wind stand mit einer Prime-Suche im Bestand; der Belegfilter weiter oben lief
      über die Suchadresse und fand nichts. Erst hier wurde daraus B0CG7KDCTS — der Kopf
      der JoJo-Sammelseite, den ein Handbeleg am selben Morgen mit `available: false`
      ausgetragen hatte. `check:handbelege` brach den Bau ab (Lauf 35566086288), und
      gefunden hat es eine Instrumentierung, die jede Änderung an den Streams des Titels
      mitschrieb. Dritte Stelle dieser Art nach dem 26.08. und dem 17.09.2026: Jede
      Zuweisung einer Adresse fragt den Beleg zu genau dieser Adresse.
    */
    const belegZurAdresse = belegFuer(title.id, 'primevideo', echt, 2)
    if (belegZurAdresse?.available === false || belegZurAdresse?.dub === false) continue
    prime.url = echt
    ersetzt++
  }
  if (ersetzt) log(`${ersetzt} Prime-Suchlinks durch die echte Produktseite ersetzt`)
}
