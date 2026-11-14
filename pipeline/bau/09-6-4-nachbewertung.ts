import { regionGesperrteWege, entferneVerweiseMitNein } from './verweis-grund.ts'
import { ladeHandbelege, type DubCheck } from '../lib/dub-confirmed.ts'
import { log } from '../lib/util.ts'
import { beurteile, kapitelImBlock, type CrDubData, type CrSerie } from '../lib/crunchyroll-dub.ts'
import { type Title, type PlatformId } from '../../shared/types.ts'
import { neinUeberholtMitLog, type OffenerBefund } from '../lib/cr-nein-ueberholt.ts'
import { beurteileAdnVerweis, type AdnArchiv } from '../lib/adn-sprachen.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

export function beurteileFrischeWege({ title, belegFuer, crOffeneBefunde, crSerienJeKennung, crNachUrl, adnArchiv, adnStreamSchaerfen }: {
  title: Title
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  crOffeneBefunde: Record<string, OffenerBefund>
  crSerienJeKennung: Map<string, CrSerie[]>
  crNachUrl: Map<string, CrSerie>
  adnArchiv: AdnArchiv
  adnStreamSchaerfen: (titleId: number, stream: { platform: string; url: string; }) => boolean
}) {
  for (const stream of title.streams) {
    if (stream.dub !== undefined) continue
    /*
      **Der Handbeleg zuerst — er ist der Grund, warum dieser Weg hier steht.**

      Seit dem 06.09.2026 legt die Ergänzung einen Verweis an, wenn ein
      Handbeleg ihn bejaht. Die Runde, die Handbelege anwendet, läuft aber
      weiter oben; der frisch entstandene Weg trug deshalb `dub: undefined`,
      obwohl die Antwort in derselben Datei stand. Bei „Sword Art Online II"
      hieß das: Netflix-Weg da, kein Urteil daran, und die Auskunft „🇩🇪 ?"
      für Folgen, die Daniel selbst gemessen hat.

      Dieselbe Lehre wie beim Rest dieses Blocks — wer unten ergänzt, muss
      unten auch beurteilen.
    */
    const handBeleg = belegFuer(title.id, stream.platform, stream.url, (title.streams ?? []).filter((x) => x.platform === stream.platform).length)
    if (handBeleg?.dub !== undefined) {
      stream.dub = handBeleg.dub
      if (handBeleg.dubRanges?.length) {
        stream.dubRanges = handBeleg.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub }))
      }
      continue
    }
    if (stream.platform === 'crunchyroll') {
      /**
       * **Auch `crunchyroll-offene.json` gehört hierher — sonst bleibt das
       * Urteil im Bestand liegen.**
       *
       * `crNachUrl` kennt nur, was der wöchentliche Lauf geprüft hat. Die
       * Adressen, die aniSearch hier gerade ergänzt hat, stehen dort selten:
       * `fruits-basket`, `the-promised-neverland`,
       * `watch/GE00266947DEDE/…` — für alle drei lag am 10.09.2026 ein
       * fertiges Urteil in der Datei (zweimal `false`, einmal `true`), und
       * alle drei standen trotzdem auf „🇩🇪 ?".
       *
       * Der Block, der diese Datei anwendet, läuft rund 800 Zeilen weiter
       * oben — also bevor es diese Verweise gibt. Dieselbe Lehre wie im
       * Absatz darüber, nur eine Quelle weiter.
       */
      const ausOffenen = crOffeneBefunde[stream.url]
      if (typeof ausOffenen?.dub === 'boolean' && !neinUeberholtMitLog(ausOffenen, crSerienJeKennung, title)) {
        stream.dub = ausOffenen.dub
        continue
      }
      const serie = crNachUrl.get(stream.url)
      if (!serie) continue
      const kapitelUrteil = kapitelImBlock(serie, title)
      if (kapitelUrteil !== undefined) {
        stream.dub = kapitelUrteil
        continue
      }
      for (const urteil of beurteile(serie, [title])) {
        if (urteil.titleId === title.id) stream.dub = urteil.dub
      }
    } else if (stream.platform === 'adn' && adnArchiv.serien.size) {
      /*
        **Erst schärfen, dann beurteilen.**

        Ein hier ergänzter ADN-Verweis trägt die Adresse, die aniSearch
        führt — oft `animationdigitalnetwork.de/video/<slug>` ohne
        Serienkennung, teils mit französischem Namensteil
        (`50-nuances-de-gras`). `beurteileAdnVerweis` findet dazu nichts,
        und der Verweis bleibt bei „🇩🇪 ?".

        Die Schärfung oben läuft, bevor dieser Block überhaupt Verweise
        anlegt. Gemessen am 07.09.2026 blieben deshalb sieben Verweise
        stumm — sechs davon mit einer Kennung, die seit dem Vortag in
        `data/adn-adressen.yaml` steht.
      */
      adnStreamSchaerfen(title.id, stream)
      const befund = beurteileAdnVerweis(stream.url, adnArchiv)
      if (befund.dub !== undefined) stream.dub = befund.dub
    }
  }
}

export function bewerteErgaenzteWegeNach({ crDub, titles, belegFuer, crOffeneBefunde, crSerienJeKennung, adnArchiv, adnStreamSchaerfen, verweiseEntfernt }: {
  crDub: CrDubData
  titles: Map<number, Title>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  crOffeneBefunde: Record<string, OffenerBefund>
  crSerienJeKennung: Map<string, CrSerie[]>
  adnArchiv: AdnArchiv
  adnStreamSchaerfen: (titleId: number, stream: { platform: string; url: string; }) => boolean
  verweiseEntfernt: EntfernterVerweis[]
}) {
  /*
    **Ein frisch ergänzter Verweis wird im selben Lauf beurteilt.**

    Die Auswertungen laufen weiter oben — sie sehen nur, was zu ihrem
    Zeitpunkt dastand. Ohne diese Nachrunde bekäme ein hier entstandener
    Verweis sein Urteil erst beim nächsten Bau, und der Fall, der die ganze
    Ergänzung ausgelöst hat, sähe im ausgelieferten Datensatz einen Tag lang
    unverändert aus: Detektiv Conan mit einem Crunchyroll-Weg und „🇩🇪 ?",
    obwohl der Prüflauf am selben Vormittag 581 deutsche Folgen belegt hat.

    Gefragt werden dieselben Quellen wie oben, nur je Verweis: die geprüften
    Crunchyroll-Serien nach ihrer Adresse, und das ADN-Archiv. Beide sind an
    dieser Stelle bereits geladen; ein zweiter Abruf entsteht nicht.
  */
  const crNachUrl = new Map(crDub.serien.map((serie) => [serie.url, serie] as const))
  let nachJa = 0
  let nachNein = 0
  const regionGesperrt = regionGesperrteWege(ladeHandbelege())
  for (const title of titles.values()) {
    beurteileFrischeWege({ title, belegFuer, crOffeneBefunde, crSerienJeKennung, crNachUrl, adnArchiv, adnStreamSchaerfen })
    /*
      **Ein Nein entfernt den Verweis — auch hier unten.**

      Der Hauptfilter ist längst durchgelaufen; ein `dub: false`, das erst
      jetzt entsteht, bliebe sonst im ausgelieferten Datensatz stehen. Dort
      steht bei **keinem** Verweis ein Nein, und zwar nicht zufällig: Die
      Seite beantwortet eine Frage, und „dort nur Originalton" ist keine
      Antwort darauf.
    */
    nachJa += title.streams.filter((s) => s.dub === true).length // dub-lesart: irgendwie – jeder Weg mit Ja zählt (Menge/Weiche), auch ein abgeleiteter
    nachNein += entferneVerweiseMitNein(title, verweiseEntfernt, regionGesperrt)
  }
  if (nachNein) log(`${nachNein} frisch ergänzte Verweise gleich wieder entfernt: dort gibt es keine deutsche Tonspur`)
}
