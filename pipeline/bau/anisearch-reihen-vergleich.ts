import { komponenten } from './anisearch-reihen.ts'

/**
 * **Reihen aus aniSearch gegen die heutige `franchiseId`** (Stufe C der AniList-Ablösung, 10.10.2026). Verglichen werden nur Titel mit archivierter aniSearch-Seite;
 * beide Seiten zählen als Mitglieder ebenfalls nur solche Titel. Ansicht 1 je Titel (gleiche Mitglieder?), Ansicht 2 je Cluster (zerlegt aniSearch eine Reihe,
 * verschmilzt es mehrere?). Zwei Hälften nach geradem/ungeradem kleinstem Titel der Referenz-Reihe: an A wird die Regel eingestellt, an B geprüft.
 */
/** `haupt`: Titel des Hauptbestands (die übrigen stammen aus dem Katalog). */
export type Einheit = { id: number; name: string; anisearchId: number; haupt?: boolean }
export type TitelUrteil = 'gleich' | 'fehlen' | 'zusaetzlich' | 'gemischt'
export type TitelZaehler = Record<TitelUrteil, number> & { titel: number }
export type ClusterArt = 'einzel' | 'gleich' | 'zerlegt' | 'verschmilzt' | 'gemischt'
export type ClusterBeispiel = { id: number; name: string; titel: number; referenz: number; anisearch: number }
export type ReihenBericht = {
  gesamt: TitelZaehler
  /** Nur Titel des Hauptbestands (Maßstab der Stufe A). */
  hauptbestand: TitelZaehler
  haelfteA: TitelZaehler
  haelfteB: TitelZaehler
  cluster: Record<ClusterArt, number>
  beispiele: Record<'zerlegt' | 'verschmilzt' | 'gemischt', ClusterBeispiel[]>
}

export const BEISPIELE_JE_ART = 20
const leerZaehler = (): TitelZaehler => ({ titel: 0, gleich: 0, fehlen: 0, zusaetzlich: 0, gemischt: 0 })

function gruppiere<T>(liste: T[], schluessel: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of liste) m.set(schluessel(x), [...(m.get(schluessel(x)) ?? []), x])
  return m
}

/** gleich = dieselben Mitglieder; fehlen = aniSearch hat nur einen Teil der Reihe; zusätzlich = aniSearch hat mehr; sonst gemischt. */
function titelUrteil(referenz: Einheit[], anisearch: Einheit[]): TitelUrteil {
  const a = new Set(anisearch.map((e) => e.id))
  const gemeinsam = referenz.filter((e) => a.has(e.id)).length
  if (gemeinsam === referenz.length && referenz.length === a.size) return 'gleich'
  if (gemeinsam === a.size) return 'fehlen'
  return gemeinsam === referenz.length ? 'zusaetzlich' : 'gemischt'
}

function clusterArt(titel: number, referenz: number, anisearch: number): ClusterArt {
  if (referenz === 1 && anisearch === 1) return titel === 1 ? 'einzel' : 'gleich'
  if (referenz === 1) return 'zerlegt'
  return anisearch === 1 ? 'verschmilzt' : 'gemischt'
}

/** Cluster = zusammenhängende Teile des zweigeteilten Graphen aus Referenz-Reihen und aniSearch-Komponenten. */
function clusterAuswerten(einheiten: Einheit[], refSchluessel: (e: Einheit) => string, compSchluessel: (e: Einheit) => string): Pick<ReihenBericht, 'cluster' | 'beispiele'> {
  const index = new Map<string, number>()
  const nr = (s: string): number => {
    if (!index.has(s)) index.set(s, index.size)
    return index.get(s)!
  }
  const wurzel = komponenten(einheiten.map((e): [number, number] => [nr(`R${refSchluessel(e)}`), nr(`A${compSchluessel(e)}`)]))
  const cluster = gruppiere(einheiten, (e) => String(wurzel(nr(`R${refSchluessel(e)}`))))
  const zaehler: Record<ClusterArt, number> = { einzel: 0, gleich: 0, zerlegt: 0, verschmilzt: 0, gemischt: 0 }
  const beispiele: ReihenBericht['beispiele'] = { zerlegt: [], verschmilzt: [], gemischt: [] }
  const ordnung = [...cluster.values()].sort((x, y) => y.length - x.length || Math.min(...x.map((e) => e.id)) - Math.min(...y.map((e) => e.id)))
  for (const mitglieder of ordnung) {
    const [r, a] = [new Set(mitglieder.map(refSchluessel)).size, new Set(mitglieder.map(compSchluessel)).size]
    const art = clusterArt(mitglieder.length, r, a)
    zaehler[art]++
    if (art !== 'zerlegt' && art !== 'verschmilzt' && art !== 'gemischt') continue
    const kopf = mitglieder.reduce((k, e) => (e.id < k.id ? e : k))
    if (beispiele[art].length < BEISPIELE_JE_ART) beispiele[art].push({ id: kopf.id, name: kopf.name, titel: mitglieder.length, referenz: r, anisearch: a })
  }
  return { cluster: zaehler, beispiele }
}

/**
 * `referenz`: Reihenschlüssel je Titel (die heutige `franchiseId`); `wurzel`: Komponente je aniSearch-Kennung unter der Regel.
 * Titel ohne Eintrag in `referenz` sind eine Reihe für sich.
 */
export function vergleicheReihen(einheiten: Einheit[], referenz: Map<number, string>, wurzel: (anisearchId: number) => number): ReihenBericht {
  const refSchluessel = (e: Einheit): string => referenz.get(e.id) ?? `E${e.id}`
  const compSchluessel = (e: Einheit): string => String(wurzel(e.anisearchId))
  const jeRef = gruppiere(einheiten, refSchluessel)
  const jeComp = gruppiere(einheiten, compSchluessel)
  const [gesamt, haupt, a, b] = [leerZaehler(), leerZaehler(), leerZaehler(), leerZaehler()]
  const haelfteJeRef = new Map([...jeRef].map(([k, l]) => [k, Math.min(...l.map((x) => x.id)) % 2 === 0 ? a : b]))
  const bekannt = new Map<string, TitelUrteil>()
  for (const e of einheiten) {
    const paar = `${refSchluessel(e)}|${compSchluessel(e)}`
    if (!bekannt.has(paar)) bekannt.set(paar, titelUrteil(jeRef.get(refSchluessel(e))!, jeComp.get(compSchluessel(e))!))
    const u = bekannt.get(paar)!
    for (const z of [gesamt, haelfteJeRef.get(refSchluessel(e))!, ...(e.haupt ? [haupt] : [])]) {
      z.titel++
      z[u]++
    }
  }
  return { gesamt, hauptbestand: haupt, haelfteA: a, haelfteB: b, ...clusterAuswerten(einheiten, refSchluessel, compSchluessel) }
}
