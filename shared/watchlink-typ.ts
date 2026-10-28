import type { Zugangsart } from './zugangsart.ts'

/** Woher ein angenommenes Ja stammt: Schwester-Shop und Telekom bei Kaufwegen, Joyn pauschal und Prime-Kanal bei Streams (Streams: `bau/joyn-pauschal.ts`, `bau/kanal-erbt-anbieter.ts`). */
export type DubAbgeleitet = 'schwester-shop' | 'telekom-annahme' | 'joyn-pauschal' | 'kanal-erbt'

/**
 * Ein Weg, den Titel zu sehen oder zu kaufen — jenseits der Plattformen, die
 * dieses Projekt selbst kennt.
 *
 * `PlatformId` ist eine geschlossene Liste der großen Anbieter. Für einen alten
 * Katalogtitel steht der einzige deutsche Weg aber oft bei Maxdome, Videobuster
 * oder schlicht als DVD bei Amazon. Diese Angebote hier zu verschweigen, nur
 * weil sie nicht in die Liste passen, wäre die schlechtere Antwort.
 */
export interface WatchLink {
  /** Anzeigename, wie ihn ein Mensch erwartet: „Amazon", „Videobuster". */
  name: string
  url: string
  /** Ansehen oder erwerben — Streams stehen in der Oberfläche zuerst. */
  kind: 'stream' | 'buy'
  /**
   * Die Adresse ist TMDBs Übersichtsseite, nicht der Anbieter (22.09.2026). TMDB nennt den Anbieter,
   * aber keine Adresse; die Pille schreibt dann „(über TMDB)" hinter den Namen.
   */
  ueberTmdb?: true
  /**
   * Was es kostet: nichts, ein Abo, oder Geld pro Titel.
   *
   * `kind` trennt Ansehen von Erwerben, aber nicht Abo von kostenlos — und für
   * einen Besucher ist genau das der Unterschied. Wird
   * beim Bauen aus Name und Adresse bestimmt, siehe `shared/zugangsart.ts`.
   */
  zugang?: Zugangsart
  /**
   * **Die eine Folge, auf die dieser Weg zeigt** — wo die Adresse es selbst sagt.
   *
   * Daniel am 12.09.2026 an „Banana Fish": Die Akibapass-Pille führt zu Folge 1,
   * die dort längst auf Deutsch läuft, und daneben stand als Termin der
   * 06.11.2026 — der zweite Blu-ray-Band. „da steht 06.11., das ist in 2
   * monaten, es muss besser kommuniziert werden. folge 1 jetzt, rest 06.11."
   *
   * Die Adresse trägt die Auskunft: `…/exklusive-dub-previews/videos/
   * banana-fish-s1e01-…`. Drei Wege im Bestand sind so gebaut (zwei bei ADN,
   * einer bei Akibapass); ohne die Angabe sieht ein Weg zu **einer** Folge
   * genauso aus wie einer zur ganzen Serie.
   */
  nurFolge?: number
  /**
   * **Welche Folgen dieser Weg auf Deutsch enthält** — von Hand belegt in
   * `watch-links.yaml`, gleiche Form wie am Stream-Verweis.
   *
   * Anlass: Die Dai-DVD-Box bei Animeversand führt „Episoden: 1-75", die Serie hat 100
   * Folgen. Ohne die Angabe stand an der Pille gar keine Zahl, und dass 76–100 bei
   * keinem bekannten Anbieter liegen, sagte niemand.
   */
  dubRanges?: Array<{ from: number; to: number; dub: boolean }>
  /**
   * Deutsch **abgeleitet** statt belegt (13.10.2026): Der Weg selbst nennt keine Tonspur, mindestens ein
   * Schwester-Shop desselben Titels belegt Deutsch, keiner widerspricht (`pipeline/lib/schwester-shop.ts`).
   * Nie mit `dubRanges` zusammen — es ist kein Beleg und zählt nirgends als Deutsch-Häkchen.
   *
   * `'telekom-annahme'` (13.10.2026): Videoload und MagentaTV (Kauf) gelten als deutsch, ohne dass der Weg oder
   * JustWatch die Tonspur nennt (`pipeline/lib/telekom-annahme.ts`). Hier steht `dubRanges` daneben (Daniels
   * Annahme vom 22.09.2026); sie zählt aber weder als Deutsch-Häkchen noch im Antwort-Kasten (`belegteBereiche` in `antwort-regeln.ts`).
   */
  dubAbgeleitet?: DubAbgeleitet
  /**
   * **Nur TOGGO: wann welche Folgen kostenlos abrufbar sind** (19.09.2026, `pipeline/fetch-toggo.ts`).
   * Blöcke aufeinanderfolgender Folgen mit gleichem Fenster; `ab`/`bis` in Berliner Ortszeit.
   * Ob eine Folge *jetzt* abrufbar ist, rechnet die Oberfläche — der Datensatz ist bis zu einem
   * Tag alt, und bei Daima schließt jeden Abend ein Fenster.
   */
  toggo?: Array<{ staffel: number; von: number; bis: number; ab: string; ende: string }>
}
