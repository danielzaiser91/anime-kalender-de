import type { Title } from '../../shared/types.ts'
import type { TmdbBanner } from './tmdb-banner.ts'

/**
 * **Rahmen der Lückenlisten** (Daniel, 13.10.2026): je Feld des Detail-Panels eine Liste der Titel, denen es fehlt, A vor B.
 * A = Termin im Fenster oder viele aniSearch-Stimmen (Schwelle gemessen 13.10.2026: A 675, B 2.249 von 2.924, Bericht `berichte/lueckenlisten-inventur-2026-10-13.md`).
 * Rein und ohne Dateizugriff; die Felder stehen in `luecken-felder.ts`, das Laden in `luecken-kontext.ts`.
 */
export const A_MIN_STIMMEN = 1500
export const FENSTER_TAGE = { von: -90, bis: 180 }
export const TITEL_LINK = 'https://anime-kalender.de/#/woche?t='

export type Synopse = { en?: string; de?: string; cg?: string }
export type Beleg = { quellen: number; mitBild: number }

/** Alles, was ein Feld über den Titel hinaus zum Urteilen braucht. */
export type Kontext = {
  heute: string
  stimmen: Map<number, number>
  /** Tage ab `heute` je Titel (negativ = vergangen), aus Events und Erstterminen. */
  tage: Map<number, number[]>
  synopsen: Record<number, Synopse>
  belege: Map<number, Beleg>
  hqGrund: Map<number, string>
  banner: TmdbBanner
  zuordnung: Record<string, { tmdbId?: number; kind?: string }>
  /** Titel mit Zuordnung zu einer Folge der Staffel 0 (`data/tmdb-staffel0.json`): sie tragen keine Serienkennung. */
  staffel0: Record<string, unknown>
  ak: Map<number, number>
  alle: Title[]
}

/** Ein Feld: `fehlt` liefert den Grund, wenn es fehlt, sonst `undefined`; `gilt` begrenzt auf Titel, für die das Feld überhaupt in Frage kommt. */
export type Feld = {
  datei: string
  name: string
  pflicht: boolean
  gilt?: (t: Title, k: Kontext) => boolean
  fehlt: (t: Title, k: Kontext) => string | undefined
  hinweis?: (t: Title, k: Kontext) => string
}

export type Zeile = { t: Title; stimmen: number; imFenster: boolean; grund: string; hinweis: string }
export type Ergebnis = { feld: Feld; gilt: number; a: Zeile[]; b: Zeile[]; aGesamt: number; bGesamt: number }

export const imFenster = (tage: number[] | undefined): boolean =>
  (tage ?? []).some((d) => d >= FENSTER_TAGE.von && d <= FENSTER_TAGE.bis)

export function istListeA(t: Title, k: Kontext): boolean {
  return imFenster(k.tage.get(t.id)) || (k.stimmen.get(t.id) ?? 0) >= A_MIN_STIMMEN
}

const nachStimmen = (x: Zeile, y: Zeile): number => y.stimmen - x.stimmen || x.t.id - y.t.id

/** Wertet ein Feld über den ganzen Hauptbestand aus; `aGesamt`/`bGesamt` zählen alle Titel der Liste, auch die, für die das Feld nicht gilt. */
export function werteFeldAus(feld: Feld, k: Kontext): Ergebnis {
  const e: Ergebnis = { feld, gilt: 0, a: [], b: [], aGesamt: 0, bGesamt: 0 }
  for (const t of k.alle) {
    const a = istListeA(t, k)
    if (a) e.aGesamt++
    else e.bGesamt++
    if (feld.gilt && !feld.gilt(t, k)) continue
    e.gilt++
    const grund = feld.fehlt(t, k)
    if (grund === undefined) continue
    const zeile: Zeile = {
      t,
      stimmen: k.stimmen.get(t.id) ?? 0,
      imFenster: imFenster(k.tage.get(t.id)),
      grund,
      hinweis: feld.hinweis?.(t, k) ?? '–',
    }
    if (a) e.a.push(zeile)
    else e.b.push(zeile)
  }
  e.a.sort(nachStimmen)
  e.b.sort(nachStimmen)
  return e
}

const zelle = (s: string): string => s.replace(/[[\]]/g, '').replace(/\|/g, '/').replace(/\s+/g, ' ')

function zeileText(z: Zeile, k: Kontext): string {
  const name = zelle(z.t.titleDe ?? z.t.titleEn ?? z.t.titleRomaji ?? String(z.t.id))
  const termin = z.imFenster ? 'ja' : '–'
  const ak = k.ak.get(z.t.id) ?? '–'
  return `| [${name}](${TITEL_LINK}${z.t.id}) | ${ak} | ${z.t.jpYear || '–'} | ${z.stimmen} | ${termin} | ${z.grund} | ${z.hinweis} |`
}

function abschnitt(titel: string, zeilen: Zeile[], k: Kontext): string[] {
  const gruende = new Map<string, number>()
  for (const z of zeilen) gruende.set(z.grund, (gruende.get(z.grund) ?? 0) + 1)
  const uebersicht = [...gruende].map(([g, n]) => `${g} (${n})`).join(', ') || '–'
  return [
    `## ${titel} (${zeilen.length})`,
    '',
    `Gründe: ${uebersicht}`,
    '',
    '| Titel | ak | Jahr | Stimmen | Termin im Fenster | Grund | Hinweis |',
    '|---|---|---|---|---|---|---|',
    ...zeilen.map((z) => zeileText(z, k)),
    '',
  ]
}

/** Die Datei eines Feldes: Liste A zuerst, dann B, je nach Stimmen absteigend. */
export function feldMarkdown(e: Ergebnis, k: Kontext): string {
  return [
    `# Lücke: ${e.feld.name}`,
    '',
    `Stand ${k.heute}. Fehlt bei ${e.a.length + e.b.length} von ${e.gilt} Titeln des Hauptbestands${e.feld.pflicht ? '' : ' (bedingtes Feld, nur zur Information)'}.`,
    `Liste A: Termin von ${-FENSTER_TAGE.von} Tagen zurück bis ${FENSTER_TAGE.bis} Tage voraus oder mindestens ${A_MIN_STIMMEN} aniSearch-Stimmen; Liste B: der Rest.`,
    'Erzeugt von `pipeline/lueckenlisten.ts` (`npm run data:lueckenlisten`); Übersicht: `00-uebersicht.md`.',
    '',
    ...abschnitt('Liste A', e.a, k),
    ...abschnitt('Liste B', e.b, k),
  ].join('\n')
}

/** Die Übersicht: Tabelle Feld × A/B × fehlt mit Datum und Schwelle. */
export function uebersichtMarkdown(ergebnisse: Ergebnis[], k: Kontext): string {
  const eins = ergebnisse[0]
  const zeilen = ergebnisse.map((e) => {
    const f = e.feld
    return `| [${f.name}](${f.datei}) | ${f.pflicht ? 'Pflicht' : 'bedingt'} | ${e.gilt} | ${e.a.length} | ${e.b.length} | ${e.a.length + e.b.length} |`
  })
  return [
    '# Lückenlisten: Übersicht',
    '',
    `Stand ${k.heute}. Hauptbestand ${k.alle.length} Titel: Liste A ${eins?.aGesamt ?? 0}, Liste B ${eins?.bGesamt ?? 0}.`,
    `A = Termin im Fenster ${FENSTER_TAGE.von} bis +${FENSTER_TAGE.bis} Tage oder mindestens ${A_MIN_STIMMEN} aniSearch-Stimmen. Katalog (ohne Synchro) und Cartoons haben vorerst keine Liste.`,
    'Zeile = ein Titel; Link führt ins Detail-Panel. Innerhalb A und B nach Stimmen absteigend.',
    '',
    '| Feld | Art | gilt für | fehlt in A | fehlt in B | fehlt gesamt |',
    '|---|---|---|---|---|---|',
    ...zeilen,
    '',
  ].join('\n')
}
