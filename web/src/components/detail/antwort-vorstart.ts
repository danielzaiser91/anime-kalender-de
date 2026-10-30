/**
 * **Vor dem ersten deutschen Termin sagt der Kasten, wann es losgeht** (Daniel, 29.10.2026, Variante A der Bühne
 * `antwortkasten-vorstart`): „Vol. 1 (Folgen 1–4) erscheint am 06.11.2026“ bzw. „Die erste Folge mit deutscher Synchro erscheint
 * voraussichtlich am 20.10.2026“ statt „Auf Deutsch, ≈ 12 Folgen“ über „0 von 12 Folgen erschienen“. Der Satz ist die ganze
 * Überschrift: keine Nebenzeile, keine Zählzeile, kein leerer Balken.
 */
import { istAusgeblieben } from '@shared/logic.ts'
import { formatDate } from '@shared/time.ts'
import type { Release, Title } from '@shared/types.ts'
import type { Antwort } from './antwort-typ.ts'
import { belegteBereiche } from './antwort-regeln.ts'

type Disc = Extract<Antwort, { art: 'disc' }>
type Laeuft = Extract<Antwort, { art: 'laeuft' }>

/** „Folgen 1–4“ bzw. „Folge 3“. */
function folgenText(f: NonNullable<Disc['folgen']>): string {
  return f.von === f.bis ? `Folge ${f.von}` : `Folgen ${f.von}–${f.bis}`
}

/** Der Band am Ende des Terminnamens („Virgin Road – Vol. 1“ → „Vol. 1“); andere Namen („Limited Edition“) sind kein Band. */
export function bandName(name: string): string | undefined {
  return /(?:^|[\s:–—-])((?:Vol\.?|Volume|Band|Teil|Box)\s*\d+)\s*$/i.exec(name)?.[1]
}

/**
 * Welche Folgen ein Band enthält, steht nur, wo ein Händler es belegt: der Kaufweg des Titels mit derselben Adresse wie der
 * Termin trägt eine deutsche Folgenspanne. Ohne Beleg gibt es keine Zahl (nichts erfinden).
 */
export function bandFolgen(release: Release, title: Title): Disc['folgen'] {
  const adressen = [release.buyUrl, release.platformUrl].filter(Boolean)
  const bereiche = (title.watchLinks ?? [])
    .filter((w) => w.kind === 'buy' && adressen.includes(w.url))
    .flatMap(belegteBereiche)
    .filter((r) => r.dub)
  if (!bereiche.length) return undefined
  return { von: Math.min(...bereiche.map((r) => r.from)), bis: Math.max(...bereiche.map((r) => r.to)) }
}

/** Band und Folgenspanne des Disc-Termins für die Überschrift. */
export function bandAngaben(release: Release | undefined, title: Title): Pick<Disc, 'vol' | 'folgen'> {
  if (!release) return {}
  return { vol: bandName(release.name ?? ''), folgen: bandFolgen(release, title) }
}

/** Ist noch kein Band erschienen? Dann steht der Termin des ersten als Satz in der Überschrift. */
export function discSatz(a: Disc): string | undefined {
  if (a.baende?.some((b) => b.raus)) return undefined
  const datum = formatDate(a.datum)
  if (!a.vol) return `Die Disc erscheint am ${datum}`
  return `${a.vol}${a.folgen ? ` (${folgenText(a.folgen)})` : ''} erscheint am ${datum}`
}

/**
 * Noch keine Folge erschienen und die erste ist die nächste? „Voraussichtlich“ nur, wo das Datum geschätzt ist. Ohne Sprachbeleg
 * (alle Zeilen ohne DE-Haken) entfällt „mit deutscher Synchro“: der Satz behauptete sonst, was keine Zeile trägt.
 */
export function streamSatz(a: Laeuft, ohneSprachbeleg: boolean): string | undefined {
  const e = a.haupt
  if (a.raus !== 0 || a.sichtung || a.offenesEnde || a.verschobenVon || istAusgeblieben(e)) return undefined
  if (e.episode !== undefined && e.episode !== 1) return undefined
  const was = ohneSprachbeleg ? 'Die erste Folge' : 'Die erste Folge mit deutscher Synchro'
  return `${was} erscheint ${e.estimated ? 'voraussichtlich ' : ''}am ${formatDate(e.date)}`
}

/** Der Satz der Überschrift, wo die Lage „vor dem Start“ ist; sonst `undefined` und der Kasten bleibt, wie er ist. */
export function vorstartSatz(antwort: Antwort, ohneSprachbeleg: boolean): string | undefined {
  if (antwort.art === 'disc') return discSatz(antwort)
  if (antwort.art === 'laeuft') return streamSatz(antwort, ohneSprachbeleg)
  return undefined
}
