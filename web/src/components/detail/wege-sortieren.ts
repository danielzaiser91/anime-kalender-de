import { type Zugangsart } from '@shared/zugangsart.ts'
import { gruppiereKaufwege } from './pillen.tsx'
import { type Title } from '@shared/types.ts'

export function sortiereNachZugang({ title }: {
  title: Title | undefined
}) {
  const arten: Zugangsart[] = ['kostenlos', 'abo', 'kauf', 'unbekannt']
  const gruppen = arten.map((art) => ({
    art,
    /*
      **Zwei gleiche Wege sind eine Pille** (18.09.2026). Amazon führt manchen Film
      unter zwei Kennungen mit demselben Angebot („Giovannis Insel": B00TCOTQHS und
      B00TE2CQLQ, beide Abo, beide DE ✓). 14 Titel zeigten zwei Prime-Pillen, die
      sich durch nichts unterschieden. Zusammengelegt wird nur, was in Plattform,
      Zugang, Sprachurteil und Folgenbereich übereinstimmt — sonst sagen die Pillen
      Verschiedenes und bleiben beide. Im Datensatz stehen weiter beide.
    */
    plattformen: (title?.streams ?? [])
      .filter((s) => (s.zugang ?? 'abo') === art)
      .filter((s, i, alle) => {
        const sig = (x: typeof s) =>
          `${x.platform}|${x.zugang ?? ''}|${x.dub}|${JSON.stringify((x.dubRanges ?? []).filter((r) => r.dub).map((r) => [r.from, r.to]))}`
        return alle.findIndex((x) => sig(x) === sig(s)) === i
      }),
    /*
      **Was man ansieht, ist Stream — was man kauft, ist Disc.**

      Hier stand `kind === 'stream'` ohne Rücksicht auf die Zugangsart, und
      weil die ganze `shops`-Liste in die **Disc**-Spalte geht, landete
      „Crunchyroll über Prime Video" — ein Abo, `kind: stream`,
      `zugang: abo` — unter Disc (Daniel, 04.09.2026: „dieser link führt
      nicht zum disc, sondern zum crunchy-abo auf prime … gehört in
      stream").

      Der Umschalter verspricht „Stream | Disc". Ein Abo unter Disc bricht
      genau dieses Versprechen — und zwar an der Stelle, an der jemand
      nachsieht, ob er die Serie kaufen kann.
    */
    /*
      **Ein digitaler Kauf ist Streamen, keine Disc.**

      Hier wanderte jeder Weg mit `zugang: 'kauf'` in den Disc-Reiter, auch wenn
      er als `kind: 'stream'` angelegt war — maxdome und freenet meinVOD standen
      dadurch unter „Disc" (Daniel, 16.09.2026: „die pills sind falsch als disc
      eingeordnet, das sind streambare titel"). Der Reiter fragt „anschauen oder
      ins Regal stellen"; ob das Anschauen Geld kostet, sagt die Zugangsart, und
      die steht in der Gruppenüberschrift.

      Der Disc-Reiter nimmt deshalb nur noch `kind: 'buy'` — Händler, die einen
      Datenträger verschicken.
    */
    streamWege: gruppiereKaufwege(
      (title?.watchLinks ?? []).filter((w) => w.kind === 'stream' && (w.zugang ?? 'abo') === art),
    ),
    shops: gruppiereKaufwege([
      /**
       * Kaufwege gehören in die Kauf-Gruppe, nicht in einen zweiten Block.
       *
       * Bis zum 23.08.2026 standen sie darunter mit **derselben Überschrift**
       * — „Kaufen oder leihen" kam bei 61 Titeln zweimal hintereinander, weil
       * die eine Liste aus `streams` stammte und die andere aus `watchLinks`.
       * Für einen Besucher ist das dieselbe Frage, also ist es eine Liste.
       */
      ...(art === 'kauf' ? (title?.watchLinks ?? []).filter((w) => w.kind === 'buy') : []),
    ]),
  }))
  const belegte = gruppen.filter((g) => g.plattformen.length || g.shops.length || g.streamWege.length)
  /**
   * Die Überschrift steht nur da, wo es etwas zu trennen gibt — mit einer
   * Ausnahme: **Was Geld kostet, sagt das immer.** Ein Titel, den es nur zu
   * kaufen gibt, sähe sonst aus wie einer, den man einfach ansehen kann.
   */
  return belegte.map((g) => ({
    ...g,
    zeigeUeberschrift: belegte.length > 1 || g.art === 'kauf',
  }))
}
