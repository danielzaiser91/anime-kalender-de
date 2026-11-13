import { providerName } from '../../shared/mappings.ts'
import { dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

export function ergaenzeKanalUndKaufWege({ titles, anisearch, checks, adressKern, frueherEntfernt }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  checks: Map<string, DubCheck>
  adressKern: (u: string) => string
  frueherEntfernt: { has: (kern: string, titleId: number) => boolean; }
}) {

  /*
    **Kanal-Angebote sind Bezugswege, keine Prime-Verweise.**

    aniSearch trennt sauber, was Amazon in einer Oberfläche vermischt:
    `prime-video` ist Amazons eigenes Angebot, `primevideo-channel-<kanal>-de`
    ein Kanal-Abo, das man dort dazubucht. Der Unterschied entscheidet, was
    die Angabe wert ist — bei einem Kanal-Titel zeigt Amazon die Sprachen des
    **Kanals**, nicht die der Folge (CLAUDE.md, 24.08.2026, gemessen an „Kill
    Blue": Amazon behauptet 12 deutsche Folgen, ADN und Netflix sagen vier).

    Als **Weg** stimmt der Verweis trotzdem, und für „wo läuft es" ist er die
    Antwort. Er landet deshalb in `watchLinks` unter dem Namen, den die
    Oberfläche ohnehin führt („Crunchyroll über Prime Video"), statt als
    Stream mit einer Sprachfrage, die dort niemand beantworten kann.

    Der Shop-Verweis `amazon-de` bleibt ein **Kaufweg**: Hinter `/dp/` kann
    eine DVD liegen, und ohne Beleg ist „kaufen" die vorsichtige und richtige
    Auskunft.

    Unbekannte Kanäle werden übersprungen. Ein Name, den die Oberfläche nicht
    kennt, wäre geraten — und ein geratener Anbietername sieht aus wie eine
    Auskunft.
  */
  /*
    **Der Name kommt aus `providerName()`, nicht aus einer zweiten Liste.**

    Hier standen die vier Namen ausgeschrieben — eine Kopie dessen, was
    `shared/mappings.ts` ohnehin führt. Am 07.09.2026 fiel auf, was das
    kostet: Die Umbenennung auf „Prime Video — Crunchyroll Kanalabo" traf nur
    die eine Fassung, und in der „Wo sehen?"-Liste standen beide nebeneinander
    — 376 Einträge unter dem neuen Namen, 54 unter dem alten.

    Zwei Fassungen derselben Zuordnung laufen auseinander; das ist dieselbe
    Lehre, die in `CLAUDE.md` für Regeltexte steht. Die aniSearch-Kennung
    trägt ein `-de` am Ende, das `canonicalProvider()` nicht kennt — deshalb
    wird es abgeschnitten, bevor gefragt wird.
  */
  const kanalName = (provider: string): string | undefined => {
    if (!provider.startsWith('primevideo-channel-')) return undefined
    /* Die aniSearch-Kennung trägt ein `-de`, das `canonicalProvider()` nicht kennt. */
    const name = providerName(provider.replace(/-de$/, ''))
    /* Ein Name, den die Oberfläche nicht kennt, wäre geraten — dann lieber keiner. */
    return name && !/^Primevideo/i.test(name) ? name : undefined
  }
  let kanalWege = 0
  let kaufWege = 0
  for (const title of titles.values()) {
    const quellen = anisearch[title.id]?.streams ?? []
    if (!quellen.length) continue
    if (title.streams.some((x) => x.platform === 'primevideo')) continue
    if (checks.has(dubKey(title.id, 'primevideo'))) continue
    const bekannt = new Set(
      [...title.streams, ...(title.entfernteStreams ?? []), ...(title.watchLinks ?? [])].map((x) =>
        adressKern(x.url),
      ),
    )
    for (const quelle of quellen) {
      const url = (quelle.url ?? '').split('?')[0]
      if (!url || bekannt.has(adressKern(url)) || frueherEntfernt.has(adressKern(url), title.id)) continue
      const kanal = kanalName(quelle.provider ?? '')
      const istShop = quelle.provider === 'amazon-de' || quelle.provider === 'amazon-(de)'
      if (!kanal && !istShop) continue
      title.watchLinks = [
        ...(title.watchLinks ?? []),
        kanal
          ? { name: kanal, url, kind: 'stream' as const, zugang: 'abo' as const }
          : { name: 'Amazon', url, kind: 'buy' as const, zugang: 'kauf' as const },
      ]
      bekannt.add(adressKern(url))
      if (kanal) kanalWege++
      else kaufWege++
    }
  }
  if (kanalWege || kaufWege)
    log(`${kanalWege} Kanal-Angebote und ${kaufWege} Kaufwege aus aniSearch ergänzt`)
}
