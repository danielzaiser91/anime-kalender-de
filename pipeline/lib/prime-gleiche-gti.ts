import type { StreamLink, Title } from '../../shared/types.ts'
import { gtiAus } from './amazon-gti.ts'
import { log } from './util.ts'

/** ASIN → gti, wie `data/amazon-gti-belegt.json` sie führt (Schlüssel `amazon:<asin klein>`). */
export type GtiBelegt = Record<string, string>

const ASIN = /\/(?:dp|detail)\/([A-Z0-9]{10})(?:[/?]|$)/

/** Die Amazon-Kennung (gti) eines Prime-Wegs: aus der Adresse (gti-Brücke), sonst über die belegte ASIN der Adresse. */
export function primeGti(s: Pick<StreamLink, 'url'>, belegt: GtiBelegt): string | undefined {
  const direkt = gtiAus(s.url)
  if (direkt) return direkt
  const asin = ASIN.exec(s.url)?.[1]
  return asin ? belegt[`amazon:${asin.toLowerCase()}`] : undefined
}

/** Prime-Wege eines Titels, die als Weg zählen (ein Vermerk „nicht mehr im Katalog“ ist keiner). */
function primeWege(streams: StreamLink[]): StreamLink[] {
  return streams.filter((s) => s.platform === 'primevideo' && !s.entferntAm)
}

/** Zwei Wege sagen über Deutsch dasselbe oder einer schweigt; `true` gegen `false` ist ein Widerspruch. */
function widerspruchsfrei(gruppe: StreamLink[]): boolean {
  const urteile = new Set(gruppe.map((s) => s.dub).filter((d) => d !== undefined))
  return urteile.size < 2
}

/** Der Weg, der bleibt: einer mit Deutsch-Urteil (samt seinen Begleitfeldern), sonst der erste. */
function waehleBleibenden(gruppe: StreamLink[]): StreamLink {
  return gruppe.find((s) => s.dub !== undefined && !s.dubAbgeleitet) ?? gruppe.find((s) => s.dub !== undefined) ?? gruppe[0]!
}

/** Felder, die der bleibende Weg von den anderen übernimmt, wenn er sie nicht selbst trägt. */
const LUECKEN = ['kanal', 'zugang', 'seite', 'herkunft'] as const

function uebernimm(bleibend: StreamLink, andere: StreamLink[]): void {
  for (const a of andere) {
    for (const feld of LUECKEN) {
      if (bleibend[feld] === undefined && a[feld] !== undefined) (bleibend as unknown as Record<string, unknown>)[feld] = a[feld]
    }
    if (bleibend.dub === undefined && a.dub !== undefined) {
      bleibend.dub = a.dub
      if (a.dubRanges) bleibend.dubRanges = a.dubRanges
    }
  }
}

/** Gruppen gleicher gti unter den Prime-Wegen eines Titels (nur Gruppen mit mehr als einem Weg). */
export function primeGruppenGleicherGti(streams: StreamLink[], belegt: GtiBelegt): StreamLink[][] {
  const je = new Map<string, StreamLink[]>()
  for (const s of primeWege(streams)) {
    const g = primeGti(s, belegt)
    if (g) je.set(g, [...(je.get(g) ?? []), s])
  }
  return [...je.values()].filter((g) => g.length > 1)
}

/**
 * **Prime-Wege mit derselben gti am selben Titel sind ein Weg** (09.11.2026; auf main 18 Fälle, z. B. Goblin Slayer 2: zwei
 * Adressen, eine Ausgabe). Mit zwei Wegen vergibt `adresseDesWegs` dem Termin keine Adresse mehr. Es bleibt ein Weg, der von den
 * anderen fehlende Angaben übernimmt; widersprechen sich die Urteile (Ja gegen Nein), bleibt alles, wie es ist (der Wächter
 * `check-prime-gleiche-gti-bestand` meldet das). Gibt die Zahl der entfernten Wege zurück.
 */
export function fuehrePrimeWegeGleicherGtiZusammen(streams: StreamLink[], belegt: GtiBelegt): number {
  let entfernt = 0
  for (const gruppe of primeGruppenGleicherGti(streams, belegt)) {
    if (!widerspruchsfrei(gruppe)) continue
    const bleibend = waehleBleibenden(gruppe)
    const andere = gruppe.filter((s) => s !== bleibend)
    uebernimm(bleibend, andere)
    for (const a of andere) streams.splice(streams.indexOf(a), 1)
    entfernt += andere.length
  }
  return entfernt
}

/** Alle Titel; die entfernten Wege stehen mit Adresse im Protokoll. */
export function fuehrePrimeGleicheGtiZusammen(titel: Iterable<Title>, belegt: GtiBelegt): number {
  let summe = 0
  for (const t of titel) {
    const vorher = new Set(t.streams)
    const n = fuehrePrimeWegeGleicherGtiZusammen(t.streams, belegt)
    if (!n) continue
    summe += n
    const weg = [...vorher].filter((s) => !t.streams.includes(s)).map((s) => s.url)
    log(`Prime-Wege gleicher gti zusammengeführt: ${t.id} (${n} entfernt: ${weg.join(', ')})`)
  }
  return summe
}

/** Die Titel mit mehr als einem Prime-Weg derselben gti, als `<Kennung>@<gti>` (Wächter für den Bestand). */
export function findeGleicheGti(titel: { id: number; streams?: StreamLink[] }[], belegt: GtiBelegt): string[] {
  return titel.flatMap((t) => primeGruppenGleicherGti(t.streams ?? [], belegt).map((g) => `${t.id}@${primeGti(g[0]!, belegt)}`))
}
