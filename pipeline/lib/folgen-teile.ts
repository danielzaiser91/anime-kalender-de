/**
 * **Aufgeteilte Staffeln: ein Amazon-Teil gehört in die Staffel seines Folgenjahrs** (31.10.2026).
 *
 * Amazon zerlegt eine Staffel in Teile mit eigener Seite (Miraculous: 24 Teile zu 6–8 Folgen, unsere
 * Staffeln 1–4 haben 26/25/26/26). Ohne Anker (aniSearch, TMDB) hängte `ordneFolgenZu` jede Folge an
 * den Auftragstitel („einziger-kandidat“) — Jahr und Staffel egal. Hier wird je **Teil** (`seiten_kennung`)
 * entschieden, nie je Folge: ein Teil hat eine Staffel, auch wenn eine Folge ein Jahr abweicht.
 *
 * Regeln, in dieser Reihenfolge; jede Verneinung heißt „offen“, geraten wird nicht:
 * 1. Kein Folgenjahr → unberührt.
 * 2. Der Auftragstitel gilt, wenn ein Folgenjahr höchstens ein Jahr neben seinem Startjahr liegt (`imFenster`: bei
 *    langen Reihen länger, ohne Folgenzahl offen). Ohne Startjahr am Auftragstitel, bei einem Film (eine Folge)
 *    oder ohne zweite Staffel in der Reihe gibt es nichts zu unterscheiden → unberührt.
 * 3. Sonst: Einzelfolge-Teil → offen (Specials wie „Tagebuch Besonders“ tragen das Jahr einer Hauptstaffel,
 *    sind aber keine); mehrere Folgen → die Staffel der Reihe, deren Startjahr in den meisten Folgen des
 *    Teils vorkommt (genau gleich vor ±1 Jahr), eindeutig und mit Platz für die Folgen; sonst offen.
 */
import type { Title } from '../../shared/types.ts'
import type { Beobachtung, FolgenZuordnung } from './folgen-je-folge.ts'

/** Ein Teil: die Folgen einer Seite. `jahre` hat je Folge einen Eintrag (null: ohne Jahr). */
export interface Teil {
  schluessel: string
  staffelNr: number | null
  jahre: (number | null)[]
}

export type JahresUrteil = { art: 'unberuehrt' } | { art: 'offen' } | { art: 'titel'; titel: number }

/** Das Jahr einer Amazon-Angabe („17. Mai 2016“) oder eines ISO-Datums. */
export function folgenJahr(erschienen: string | null | undefined): number | null {
  const j = /\b(?:19|20)\d{2}\b/.exec(erschienen ?? '')?.[0]
  return j ? Number(j) : null
}

const zaehle = (jahre: number[], pruefe: (j: number) => boolean) => jahre.filter(pruefe).length

/** Die Staffel mit den meisten Folgen im Jahr (`abstand` 0) bzw. ein Jahr daneben (1); nur eine eindeutige. */
function eindeutigNach(abstand: 0 | 1, jahre: number[], staffeln: Title[]): Title | undefined {
  const punkte = staffeln.map((t) => ({ t, n: zaehle(jahre, (j) => Math.abs(j - t.jpYear!) === abstand) }))
  const beste = Math.max(0, ...punkte.map((p) => p.n))
  const spitze = punkte.filter((p) => p.n === beste)
  return beste > 0 && spitze.length === 1 ? spitze[0]!.t : undefined
}

/** Titel, in die der Teil von `groesse` Folgen noch passt (`belegt`: Folgen, die frühere Teile schon füllen). */
function mitPlatz(pool: Title[], groesse: number, belegt: Map<number, number>): Title[] {
  return pool.filter((t) => t.jpYear != null && (t.episodes == null || (belegt.get(t.id) ?? 0) + groesse <= t.episodes))
}

/**
 * Liegt das Jahr höchstens ein Jahr neben dem Start des Titels, bei mehr als 26 Folgen (zwei Cours) ein Jahr je weitere 26
 * später? Ohne Folgenzahl läuft der Titel nach oben offen weiter.
 */
export function imFenster(t: Title, jahr: number): boolean {
  const von = t.jpYear!
  const bis = t.episodes == null ? Infinity : von + Math.floor(Math.max(0, t.episodes - 1) / 26)
  return jahr >= von - 1 && jahr <= bis + 1
}

/**
 * Ein Teil mit einer Folge und Amazon-Nummer ab 100 („Tagebuch Besonders“ s101, „Besonders“ s102, „Best of“) ist ein
 * Special; die Folge einer Staffel mit mehr als einer Folge zuzuschlagen, wäre geraten. Mehrfolgen-Teile mit Nummer
 * ab 100 („Staffel 1 Teil 1“ = 101) sind keine Specials.
 */
function istSpecial(teil: Teil, auftrag: Title | undefined): boolean {
  return teil.jahre.length === 1 && (teil.staffelNr ?? 0) >= 100 && (auftrag?.episodes ?? 2) > 1
}

export function urteilFuerTeil(
  teil: Teil,
  pool: Title[],
  auftrag: Title | undefined,
  belegt: Map<number, number>,
): JahresUrteil {
  const jahre = teil.jahre.filter((j): j is number => j != null)
  if (!jahre.length) return { art: 'unberuehrt' }
  if (istSpecial(teil, auftrag)) return { art: 'offen' }
  if (auftrag && (auftrag.jpYear == null || (auftrag.episodes ?? 2) <= 1 || jahre.some((j) => imFenster(auftrag, j)))) return { art: 'unberuehrt' }
  if (auftrag && !pool.some((t) => t.id !== auftrag.id && t.jpYear != null)) return { art: 'unberuehrt' }
  if (teil.jahre.length <= 1) return { art: 'offen' }
  const staffeln = mitPlatz(pool, teil.jahre.length, belegt).filter((t) => jahre.every((j) => imFenster(t, j)))
  const wahl = eindeutigNach(0, jahre, staffeln) ?? eindeutigNach(1, jahre, staffeln)
  return wahl ? { art: 'titel', titel: wahl.id } : { art: 'offen' }
}

/**
 * Das Urteil je Teil, in der Reihenfolge der Amazon-Staffelnummer (frühe Teile belegen zuerst den Platz).
 * `poolVon`/`auftragVon` liefern je Teil die Staffeln der Reihe und den Auftragstitel.
 */
export function urteileJeTeil(
  teile: Teil[],
  poolVon: (teil: Teil) => Title[],
  auftragVon: (teil: Teil) => Title | undefined,
): Map<string, JahresUrteil> {
  const belegt = new Map<number, number>()
  const aus = new Map<string, JahresUrteil>()
  const geordnet = [...teile].sort((a, b) => (a.staffelNr ?? 0) - (b.staffelNr ?? 0) || a.schluessel.localeCompare(b.schluessel))
  for (const teil of geordnet) {
    const u = urteilFuerTeil(teil, poolVon(teil), auftragVon(teil), belegt)
    if (u.art === 'titel') belegt.set(u.titel, (belegt.get(u.titel) ?? 0) + teil.jahre.length)
    aus.set(teil.schluessel, u)
  }
  return aus
}

/** Eine Folge ohne Anker (einziger Kandidat oder offen), die das Teiljahr noch umhängen kann. */
export interface RestFolge {
  schluessel: string
  /** Kandidaten der Folge (Auftrag, Adresse, Namen). */
  kandidaten: number[]
}

/** Die Teile aus den Folgen: eine Folge zählt zu der Seite (`seiten_kennung`) ihrer jüngsten Beobachtung. */
export function teileSammeln(jeFolge: Map<string, Beobachtung[]>): { teile: Map<string, Teil>; teilVon: Map<string, string> } {
  const teile = new Map<string, Teil>()
  const teilVon = new Map<string, string>()
  for (const [s, liste] of jeFolge) {
    const jung = liste.reduce((a, b) => (b.gemeldet_am > a.gemeldet_am ? b : a))
    if (!jung.seiten_kennung) continue
    const schluessel = `${jung.plattform}:${jung.seiten_kennung}`
    const jahr = folgenJahr(jung.erschienen) ?? liste.map((b) => folgenJahr(b.erschienen)).find((j) => j != null) ?? null
    const t = teile.get(schluessel) ?? { schluessel, staffelNr: jung.staffel_nr ?? null, jahre: [] }
    t.jahre.push(jahr)
    teile.set(schluessel, t)
    teilVon.set(s, schluessel)
  }
  return { teile, teilVon }
}

/**
 * Hängt Folgen ohne Anker nach dem Teiljahr um oder lässt sie offen. Ein Teil mit einer Anker-Folge (`datum`/`titel`,
 * auch aus einem früheren Lauf) bleibt, wie er ist; was bisher nur „einziger Kandidat“ war, gilt sonst nicht mehr.
 */
export function korrigiereNachTeiljahr(
  aus: Record<string, FolgenZuordnung>,
  rest: RestFolge[],
  jeFolge: Map<string, Beobachtung[]>,
  titel: Map<number, Title>,
  reihen: Map<number, number[]>,
): void {
  const { teile, teilVon } = teileSammeln(jeFolge)
  /* Hat eine Folge des Teils einen Anker, gibt der den Teil vor: die übrigen bleiben, wie sie sind. */
  const verankert = new Set([...teilVon].filter(([s]) => aus[s]?.grund === 'datum' || aus[s]?.grund === 'titel').map(([, t]) => t))
  const mitglieder = new Map<string, RestFolge[]>()
  for (const r of rest) {
    const t = teilVon.get(r.schluessel)
    if (t && !verankert.has(t)) mitglieder.set(t, [...(mitglieder.get(t) ?? []), r])
  }
  const poolIds = (teil: Teil) => {
    const ids = new Set<number>()
    for (const r of mitglieder.get(teil.schluessel) ?? []) {
      for (const id of r.kandidaten) for (const t of reihen.get(titel.get(id)?.franchiseId ?? id) ?? [id]) ids.add(t)
    }
    return ids
  }
  const alsTitel = (ids: Iterable<number>) => [...ids].flatMap((id) => titel.get(id) ?? [])
  const auftragVon = (teil: Teil): Title | undefined => {
    const ms = mitglieder.get(teil.schluessel) ?? []
    const ids = new Set(ms.map((r) => (aus[r.schluessel]?.grund === 'einziger-kandidat' ? aus[r.schluessel]!.titel : undefined)))
    return ids.size === 1 && ids.values().next().value != null ? titel.get(ids.values().next().value!) : undefined
  }
  const betroffen = [...teile.values()].filter((t) => mitglieder.has(t.schluessel))
  const urteile = urteileJeTeil(betroffen, (t) => alsTitel(poolIds(t)), auftragVon)
  for (const [teilKey, ms] of mitglieder) {
    const u = urteile.get(teilKey)
    if (!u || u.art === 'unberuehrt') continue
    for (const r of ms) {
      const gesehen = aus[r.schluessel]!.gesehen
      aus[r.schluessel] = u.art === 'titel' ? { titel: u.titel, grund: 'jahr', gesehen } : { grund: 'offen', kandidaten: [...poolIds(teile.get(teilKey)!)], gesehen }
    }
  }
}
