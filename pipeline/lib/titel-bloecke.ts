/**
 * Die Anbieter-Blöcke einer Adresse über die Folgentitel unserer Liste zuordnen (Regel: `episodentitel-block.ts`).
 *
 * Gilt, wo **ein** Titel von uns hinter der Adresse steht und der Anbieter ihn in mehrere Blöcke teilt: Cartoons
 * (`data/cartoon-folgen.json`, TMDB) und Anime-Einträge mit aniSearch-Folgentiteln. Mehrere Titel von uns an einer Adresse
 * bleiben beim Anker je Folge (`folgentitel-anker.ts`) und bei den Folgenzahlen.
 */
import { readJson } from './util.ts'
import { ladeAnisearchAbruf } from './anisearch-verworfen.ts'
import { folgentitelAusNotiz } from './folgentitel-anker.ts'
import { ordneBlockZu, unsereFolgen, type CartoonFolge, type Blockurteil, type UnsereFolge } from './episodentitel-block.ts'
import type { AnbieterStaffel } from './folgenbereiche.ts'

type AsListe = Record<string, { folgen?: Array<{ nr?: number; de?: string | null }> }>

let cartoonDatei: Record<string, { folgen: CartoonFolge[] }> | null = null
let asDatei: AsListe | null = null
let asKennung: Record<string, { anisearchId?: number }> | null = null

/** Feste Listen für `check-episodentitel.ts`: sie gehen den Dateien vor, damit die Prüfung ohne die große Datei läuft. */
export const probelisten = new Map<number, UnsereFolge[]>()

/** Unsere Folgen mit Titeln — Cartoon aus TMDB, Anime aus aniSearch; `null`, wo keine Liste vorliegt (dann gilt die Zahl). */
export function folgenlisteVon(id: number): UnsereFolge[] | null {
  const probe = probelisten.get(id)
  if (probe) return probe
  if (id < 0) {
    cartoonDatei ??= readJson('data/cartoon-folgen.json', {})
    const roh = cartoonDatei![String(id)]?.folgen
    return roh?.length ? unsereFolgen(roh) : null
  }
  asDatei ??= readJson('data/anisearch-folgen.json', {})
  asKennung ??= ladeAnisearchAbruf()
  const asId = asKennung![String(id)]?.anisearchId
  const folgen = (asId ? asDatei![String(asId)]?.folgen : undefined) ?? []
  const liste = folgen.flatMap((f) => (typeof f.nr === 'number' ? [{ nr: f.nr, de: f.de ?? null, en: null }] : []))
  return liste.length ? liste : null
}

export interface BlockEingang {
  staffel: number | null
  folge_nr: number | null
  notiz: string | null
  befund: string
}

/** Die Stelle einer Meldung im Block des Anbieters (ab 1), `null` außerhalb. */
function stelleImBlock(m: BlockEingang, st: AnbieterStaffel): number | null {
  if (m.folge_nr == null) return null
  const pos = m.folge_nr - st.erste + 1
  return pos >= 1 && pos <= st.folgen ? pos : null
}

/** Ein Urteil je Block (Schlüssel = `seq` des Anbieters); Blöcke ohne Meldung fehlen. */
export function blockUrteile(gruppe: BlockEingang[], anbieter: AnbieterStaffel[], liste: UnsereFolge[]): Map<number, Blockurteil> {
  const urteile = new Map<number, Blockurteil>()
  for (const st of anbieter) {
    const meldungen = gruppe.flatMap((m) => {
      const pos = m.staffel === st.seq && m.befund !== 'weg' ? stelleImBlock(m, st) : null
      return pos ? [{ pos, titel: folgentitelAusNotiz(m.notiz) }] : []
    })
    if (meldungen.length) urteile.set(st.seq, ordneBlockZu(meldungen, liste, st.folgen))
  }
  return urteile
}

/**
 * Unsere Folgennummer für eine Meldung: Zahl bei sicherem Block, `'pruefen'` bei Widerspruch (der Grund steht im Urteil),
 * `null`, wo die Titel nichts sagen und die Zahl entscheidet.
 */
export function nummerUeberBlock(m: BlockEingang, anbieter: AnbieterStaffel[], urteile: Map<number, Blockurteil>): number | 'pruefen' | null {
  const st = anbieter.find((x) => x.seq === m.staffel)
  const urteil = st ? urteile.get(st.seq) : undefined
  if (!st || !urteil) return null
  if (!urteil.sicher) return urteil.widerspruch ? 'pruefen' : null
  const pos = stelleImBlock(m, st)
  return pos ? pos + urteil.versatz : null
}
