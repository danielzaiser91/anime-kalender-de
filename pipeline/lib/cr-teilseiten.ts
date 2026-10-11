/**
 * **Welche Folgen einer geteilten Crunchyroll-Seite gehören zu welchem unserer Titel?**
 *
 * Mehrere Titel von uns (Staffel 2, Teil 2, Cour 2) zeigen oft auf dieselbe Serienseite, auf der Crunchyroll sie anders
 * schneidet (Re:ZERO Staffel 2 = 25 Folgen, bei uns 13 + 12). Die Folgenliste jeder Seite liegt komplett im Archiv
 * (`data/crunchyroll-raw/`, kein Abruf nötig); hier wird sie in Fenster je Titel zerlegt:
 *
 * 1. **Titelabgleich** (`folgenZuTitel`, Regel in `episodentitel-block.ts`): die aniSearch-Folgentitel des Titels gegen die
 *    deutschen Titel der Seite. Mindestens 80 % unserer Folgen müssen eindeutig treffen; der Versatz darf nur wachsen.
 * 2. **Folgenzahl**, wo die Titel nichts sagen: Entspricht die Summe unserer Staffeln (nach Ausstrahlung) genau der Zahl der
 *    regulären Folgen der Seite, liegen sie der Reihe nach hintereinander. Aus der Zahl allein wird nichts geraten, wenn die
 *    Reihenfolge der Staffelgrößen abweicht.
 * 3. Widersprechen sich Titel und Zahl, überlappen zwei Fenster oder passt ein Fenster nicht auf die Seite, gibt es keine
 *    Zuordnung, sondern einen Grund für die Prüfliste.
 */
import { folgenZuTitel, type UnsereFolge } from './episodentitel-block.ts'

/** Eine Folge der Seite, in der Reihenfolge der Seite (Staffeln nach Nummer, darin nach laufender Nummer). */
export interface CrPosition {
  titel: string | null
  deutsch: boolean
  /** Folge einer regulären Staffel (kein OVA/Special/Film-Block) — nur sie zählt für die Folgenzahl. */
  regulaer: boolean
  staffel: number
  /** So nennt die Seite die Folge, für Begründungen und Belege: Staffelname und Folgennummer. */
  staffelName: string
  nummer: string
}

/** Ein Zeilenstück des Archivs (`data/crunchyroll-raw/<Serie>.de.json.gz`), soweit hier gelesen. */
interface RohFolge {
  title?: string
  season_number?: number
  season_title?: string
  episode_number?: number | null
  sequence_number?: number
  versions?: { audio_locale?: string }[]
}
export interface RohArchiv {
  episodes?: Record<string, { items?: RohFolge[] }>
}

const PLATZHALTER = /^(folge|episode|ep\.?)\s*\d+$/i
const KEIN_REGULAER = /OAD|OVA|Special|Recap|Movie|Film/i

/** Je Staffel eine Folge je Nummer, die deutsche Fassung vor der fremden (dieselbe Regel wie `staffelAuszaehlen`). */
function jeNummer(items: RohFolge[]): RohFolge[] {
  const je = new Map<string, RohFolge>()
  items.forEach((f, i) => {
    const schluessel = typeof f.episode_number === 'number' ? `E${f.episode_number}` : `#${i}`
    const bisher = je.get(schluessel)
    if (!bisher || (!hatDe(bisher) && hatDe(f))) je.set(schluessel, f)
  })
  return [...je.values()].sort((a, b) => (a.sequence_number ?? a.episode_number ?? 0) - (b.sequence_number ?? b.episode_number ?? 0))
}

function hatDe(f: RohFolge): boolean {
  return (f.versions ?? []).some((v) => v.audio_locale === 'de-DE')
}

/** Alle Folgen der Seite als eine Liste (OVA-, Special- und Film-Blöcke sind nicht regulär). */
export function crPositionen(archiv: RohArchiv): CrPosition[] {
  const staffeln = Object.entries(archiv.episodes ?? {})
    .map(([id, s]) => ({ id, items: jeNummer(s.items ?? []) }))
    .filter((s) => s.items.length)
    .sort((a, b) => (a.items[0]!.season_number ?? 0) - (b.items[0]!.season_number ?? 0))
  return staffeln.flatMap((s) =>
    s.items.map((f) => {
      const titel = f.title?.trim()
      return {
        titel: titel && !PLATZHALTER.test(titel) ? titel : null,
        deutsch: hatDe(f),
        regulaer: !KEIN_REGULAER.test(f.season_title ?? ''),
        staffel: f.season_number ?? 0,
        staffelName: f.season_title ?? '?',
        nummer: String(f.episode_number ?? '?'),
      }
    }),
  )
}

/** Wo unser Titel auf der Seite liegt: unsere Folge k (ab 1) ist die Position `positionen[k - 1]` (ab 0) der Seitenliste. */
export interface Fenster {
  positionen: number[]
  /** `titel`: Titel passen; `zahl`: nur die Folgenzahl geht auf. */
  quelle: 'titel' | 'zahl'
}

export type Urteil = { fenster: Fenster } | { grund: string }

export interface UnserTitel {
  id: number
  /** 0 = unbekannt. */
  episodes: number
  /** Nur Staffeln, die die Folgenzahl mitzählen (TV, TV_SHORT) — andere kommen nur über die Titel zu einem Fenster. */
  zaehlt: boolean
  folgen: UnsereFolge[] | null
}

function reihe(von: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => von + i)
}

/** Mindestanteil unserer Folgen, die mit eindeutigem Titel auf der Seite stehen müssen (Regel `episodentitel-block.ts`). */
const MIN_TREFFER = 0.8
/** Wie weit der Versatz im Lauf eines Titels wachsen darf: eine Zusammenfassung oder ein Special in der Zählung der Seite. */
const MAX_VERSATZ_SPRUNG = 3

/**
 * Fenster über die Titel. Jede Folge mit eindeutigem Treffer nennt ihre Position auf der Seite; der Versatz darf im Lauf des
 * Titels nur wachsen (eingeschobene Zusammenfassung), nie schrumpfen. `null`: zu wenige Treffer, die Zahl entscheidet.
 */
function ueberTitel(t: UnserTitel, crListe: UnsereFolge[]): Urteil | null {
  if (!t.folgen || !t.episodes) return null
  const treffer = t.folgen
    .flatMap((f) => {
      const h = folgenZuTitel(f.de, crListe)
      return h.length === 1 ? [{ nr: f.nr, versatz: h[0]! - f.nr }] : []
    })
    .sort((a, b) => a.nr - b.nr)
  if (treffer.length < 2 || treffer.length < MIN_TREFFER * t.episodes) return null
  const versaetze = treffer.map((x) => x.versatz)
  const kleinster = Math.min(...versaetze)
  const groesster = Math.max(...versaetze)
  if (versaetze.some((v, i) => i > 0 && v < versaetze[i - 1]!)) return { grund: 'Titel widersprechen sich: der Versatz schrumpft im Lauf der Staffel' }
  if (kleinster < 0 || groesster - kleinster > MAX_VERSATZ_SPRUNG) return { grund: `Titel widersprechen sich: Versatz ${kleinster} bis ${groesster}` }
  const positionen = reihe(1, t.episodes).map((k) => k + (treffer.findLast((x) => x.nr <= k)?.versatz ?? versaetze[0]!) - 1)
  return { fenster: { positionen, quelle: 'titel' } }
}

/** Die regulären Staffeln der Seite in ihrer Reihenfolge, je Staffel die Positionen ihrer Folgen. */
function regulaereStaffeln(liste: CrPosition[]): number[][] {
  const je = new Map<number, number[]>()
  liste.forEach((p, i) => {
    if (p.regulaer) je.set(p.staffel, [...(je.get(p.staffel) ?? []), i])
  })
  return [...je.values()]
}

/** Alle Zuordnungen unserer Staffelgrößen (der Reihe nach) auf Staffeln gleicher Größe, in derselben Reihenfolge; höchstens zwei gesucht. */
function einbettungen(unsere: number[], seiten: number[][], ab = 0): number[][] {
  if (!unsere.length) return [[]]
  const gefunden: number[][] = []
  for (let j = ab; j < seiten.length && gefunden.length < 2; j++) {
    if (seiten[j]!.length !== unsere[0]) continue
    for (const rest of einbettungen(unsere.slice(1), seiten, j + 1)) gefunden.push([j, ...rest])
  }
  return gefunden.slice(0, 2)
}

/**
 * Fenster über die Zahl, unsere zählenden Titel in der Reihenfolge der Ausstrahlung. Zwei Wege, beide nur bei Eindeutigkeit:
 * 1. Jede unserer Staffeln hat auf der Seite eine gleich große, und es gibt genau eine Zuordnung in derselben Reihenfolge.
 * 2. Die Summe geht genau auf und die Größen der Seite stehen nicht nur anders sortiert da: Dann liegen sie hintereinander
 *    (Seite zählt Staffel 2 durch, wir teilen sie in zwei Teile).
 */
function ueberZahl(zaehlende: UnserTitel[], liste: CrPosition[]): Map<number, Fenster> | string {
  if (!zaehlende.length) return 'keine zählende Staffel an dieser Adresse'
  if (zaehlende.some((t) => !t.episodes)) return 'bei einem Titel fehlt die Folgenzahl'
  const staffeln = regulaereStaffeln(liste)
  const unsere = zaehlende.map((t) => t.episodes)
  const gefunden = einbettungen(unsere, staffeln)
  if (gefunden.length > 1) return 'mehrere Staffeln der Seite haben dieselbe Folgenzahl'
  if (gefunden.length === 1) return fensterAus(zaehlende, gefunden[0]!.map((j) => staffeln[j]!))
  const seiten = staffeln.map((s) => s.length)
  const summe = unsere.reduce((s, n) => s + n, 0)
  const gesamt = seiten.reduce((s, n) => s + n, 0)
  if (summe !== gesamt) return `Folgenzahl ${summe} bei uns, ${gesamt} auf der Seite`
  if (sortiert(seiten) === sortiert(unsere)) return 'gleiche Staffelgrößen in anderer Reihenfolge'
  const alle = staffeln.flat()
  const fenster: number[][] = []
  let weiter = 0
  for (const n of unsere) {
    fenster.push(alle.slice(weiter, weiter + n))
    weiter += n
  }
  return fensterAus(zaehlende, fenster)
}

function fensterAus(titel: UnserTitel[], positionen: number[][]): Map<number, Fenster> {
  return new Map(titel.map((t, i) => [t.id, { positionen: positionen[i]!, quelle: 'zahl' as const }]))
}

function sortiert(zahlen: number[]): string {
  return [...zahlen].sort((a, b) => a - b).join(',')
}

/**
 * Das Urteil je Titel einer Seite. `titel` in der Reihenfolge der Ausstrahlung. Ein Fenster gilt erst, wenn es auf die Seite
 * passt, sich mit keinem anderen überlappt und Titel und Zahl (wo beide etwas sagen) nicht auseinanderliegen.
 */
export function ordneSeiteZu(titel: UnserTitel[], liste: CrPosition[]): Map<number, Urteil> {
  const zahl = ueberZahl(titel.filter((t) => t.zaehlt), liste)
  const crListe: UnsereFolge[] = liste.map((p, i) => ({ nr: i + 1, de: p.titel, en: null }))
  const aus = new Map<number, Urteil>()
  for (const t of titel) {
    const ueberT = ueberTitel(t, crListe)
    const ueberZ = typeof zahl === 'string' ? undefined : zahl.get(t.id)
    if (ueberT && ueberZ && 'fenster' in ueberT && ueberT.fenster.positionen[0] !== ueberZ.positionen[0]) {
      aus.set(t.id, { grund: `Titel nennen ${stelleVon(ueberT.fenster, liste)}, die Folgenzahl ${stelleVon(ueberZ, liste)}` })
    } else if (ueberT) aus.set(t.id, ueberT)
    else if (ueberZ) aus.set(t.id, { fenster: ueberZ })
    else aus.set(t.id, { grund: `Titel ohne Treffer, und ${typeof zahl === 'string' ? zahl : 'die Folgenzahl ordnet nur Fernsehstaffeln zu'}` })
  }
  return pruefeFenster(titel, liste, aus)
}

/** Fenster, die über das Seitenende ragen oder sich mit einem anderen überlappen, fallen zurück auf die Prüfliste. */
function pruefeFenster(titel: UnserTitel[], liste: CrPosition[], urteile: Map<number, Urteil>): Map<number, Urteil> {
  const belegt = new Map<number, number>()
  for (const t of titel) {
    const u = urteile.get(t.id)
    if (u && 'fenster' in u) for (const p of u.fenster.positionen) belegt.set(p, (belegt.get(p) ?? 0) + 1)
  }
  for (const t of titel) {
    const u = urteile.get(t.id)
    if (!u || !('fenster' in u)) continue
    const p = u.fenster.positionen
    const text = stelleVon(u.fenster, liste)
    if (p[p.length - 1]! >= liste.length + 3) urteile.set(t.id, { grund: `Fenster ${text} ragt über die ${liste.length} Folgen der Seite` })
    else if (p.some((x) => (belegt.get(x) ?? 0) > 1)) urteile.set(t.id, { grund: `Fenster ${text} überlappt das eines anderen Titels` })
  }
  return urteile
}

/** Anfang und Ende eines Fensters, wie die Seite sie nennt. */
export function stelleVon(f: Fenster, liste: CrPosition[]): string {
  const erste = liste[f.positionen[0]!]
  const letzte = liste[f.positionen[f.positionen.length - 1]!]
  if (!erste || !letzte) return 'hinter dem Ende der Seite'
  const ende = letzte.staffelName === erste.staffelName ? letzte.nummer : `${letzte.staffelName} Folge ${letzte.nummer}`
  return `${erste.staffelName} Folge ${erste.nummer} bis ${ende}`
}

/** Die deutschen Folgen eines Fensters als Bereiche in **unserer** Nummerierung (ab 1); leer, wo keine deutsch ist. */
export function bereicheImFenster(f: Fenster, liste: CrPosition[]): { from: number; to: number; dub: boolean }[] {
  const bereiche: { from: number; to: number; dub: boolean }[] = []
  f.positionen.forEach((pos, i) => {
    if (!liste[pos]?.deutsch) return
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter.to === i) letzter.to = i + 1
    else bereiche.push({ from: i + 1, to: i + 1, dub: true })
  })
  return bereiche
}
