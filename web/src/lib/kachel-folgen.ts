import { anbieterName, type ReleaseEvent } from '@shared/types.ts'
import type { Translate } from './i18n.tsx'
import { istStaffelfinale, istStaffelstart } from '@shared/tv-signale.ts'

/** Was eine Kachel an Auszeichnung trägt: Katalog-Release schlägt Staffelstart, der schlägt das Finale. */
export type KartenArt = 'start' | 'finale' | 'katalog' | 'katalogVermutlich' | 'imAngebot' | 'erstausgabe'

/** Ring um das Cover (`ring`, `innen` für den Doppelrand eines Favoriten), Farbe der Fahne und Texte (`kal.*`) je Auszeichnung — Woche und Monat teilen sie. */
export const ART_STIL = {
  start: { ring: 'ring-ak-akzent', innen: 'inset-ring-ak-akzent', fahne: 'bg-ak-akzent', name: 'kal.start', hinweis: 'kal.startHinweis' },
  finale: { ring: 'ring-ak-finale', innen: 'inset-ring-ak-finale', fahne: 'bg-ak-finale', name: 'kal.finale', hinweis: 'kal.finaleHinweis' },
  katalog: { ring: 'ring-ak-katalog', innen: 'inset-ring-ak-katalog', fahne: 'bg-ak-katalog', name: 'kal.katalog', hinweis: 'kal.katalogHinweis' },
  katalogVermutlich: { ring: 'ring-ak-katalog', innen: 'inset-ring-ak-katalog', fahne: 'bg-ak-katalog', name: 'kal.katalogVermutlich', hinweis: 'kal.katalogVermutlichHinweis' },
  imAngebot: { ring: 'ring-transparent', innen: '', fahne: 'bg-ak-marke', name: 'kal.imAngebot', hinweis: 'kal.imAngebotHinweis' },
  erstausgabe: { ring: 'ring-transparent', innen: '', fahne: 'bg-ak-akzent', name: 'kal.erstausgabe', hinweis: 'kal.erstausgabeHinweis' },
} as const

/**
 * Rand einer Kachel (Woche und Monat). Favorit: Gold außen, wo sonst der Art-Ring säße; trägt die Kachel eine Auszeichnung,
 * liegt deren Farbe als Innenring darin (Doppelrand, dazwischen 1 px Grundfarbe als Rand des Innenrings). So bleibt das Maß gleich, und der Rand ragt nicht weiter in die Nachbarn.
 */
export function randKlassen(art: KartenArt | undefined, favorit: boolean): { aussen: string; innen: string } {
  if (!favorit) return { aussen: art ? ART_STIL[art].ring : '', innen: '' }
  return { aussen: 'ring-ak-favorit-rand', innen: art ? ART_STIL[art].innen : '' }
}

/** Zwei Spalten breit nur Staffelstart, -finale und Katalog-Release; „Neu bei …“ und „Erstveröffentlichung“ sind Fahnen an der schmalen Kachel. */
export function istBreit(art: KartenArt | undefined): boolean {
  return !!art && art !== 'imAngebot' && art !== 'erstausgabe'
}

/** Der Anbieter, den die Fahne „Neu bei …“ nennt: der erste Termin der Kachel mit der Marke. */
export function markenAnbieter(art: KartenArt | undefined, termine: ReleaseEvent[]): string | undefined {
  const ev = art === 'imAngebot' ? termine.find((e) => e.imAngebot) : undefined
  return ev && anbieterName(ev.platform, ev.sender)
}

/** Text der Fahne; „Neu bei {anbieter}“ nennt den Anbieter des Termins, der die Marke trägt. */
export function artName(art: KartenArt, termine: ReleaseEvent[], t: Translate): string {
  const anbieter = markenAnbieter(art, termine)
  return t(ART_STIL[art].name, anbieter ? { anbieter } : undefined)
}

/**
 * Anbieternamen einer Kachel für die Beschriftung. Nennt die Fahne den einzigen Anbieter schon, entfällt er (keine Dopplung);
 * bei mehreren Anbietern bleibt die Liste vollständig, sie sagt, wo es sonst läuft.
 */
export function anbieterNamenDerKachel(koepfe: ReleaseEvent[], art: KartenArt | undefined, termine: ReleaseEvent[]): string[] {
  const namen = koepfe.map((k) => anbieterName(k.platform, k.sender))
  return koepfe.length === 1 && namen[0] === markenAnbieter(art, termine) ? [] : namen
}

/** Alle Termine der Kachel eines Termins (alle Anbieter, ganze Bündel) — daraus liest `artName` den Anbieter der Marke. */
export function termineDerKachel(ev: ReleaseEvent, mehrere?: Map<string, ReleaseEvent[][]>, buendel?: Map<string, ReleaseEvent[]>): ReleaseEvent[] {
  return (mehrere?.get(ev.id) ?? [buendel?.get(ev.id) ?? [ev]]).flat()
}

export interface FolgenSpanne {
  von: number
  bis: number
}

/**
 * Die Folgen eines Bündels als lückenlose Spanne („13–14“); `undefined` bei einer einzigen Folge, bei Terminen ohne Nummer
 * oder mit Lücke — dort stünde „11–13“ für Folgen, die der Tag nicht bringt.
 */
export function folgenSpanne(buendel: ReleaseEvent[] | undefined): FolgenSpanne | undefined {
  if (!buendel || buendel.length < 2 || buendel.some((e) => !e.episode)) return undefined
  const nummern = buendel.map((e) => e.episode!).sort((a, b) => a - b)
  const von = nummern[0]!
  const bis = nummern.at(-1)!
  return nummern.every((n, i) => n === von + i) ? { von, bis } : undefined
}

type MitReleases = Parameters<typeof istStaffelstart>[1]

/** Die Auszeichnung der Kachel aus ihrem ganzen Bündel: Das Finale steht jetzt neben den anderen Folgen des Tages. */
export function kartenArt(buendel: ReleaseEvent[], data: MitReleases): KartenArt | undefined {
  if (buendel.some((e) => e.katalog === 'belegt')) return 'katalog'
  if (buendel.some((e) => e.katalog)) return 'katalogVermutlich'
  if (buendel.some((e) => e.imAngebot)) return 'imAngebot'
  if (buendel.some((e) => e.erstausgabe)) return 'erstausgabe'
  if (buendel.some((e) => istStaffelstart(e, data))) return 'start'
  return buendel.some((e) => istStaffelfinale(e, data)) ? 'finale' : undefined
}
