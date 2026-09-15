import type { Title } from '@shared/types.ts'

/**
 * **Ähnliche Titel über Genres und Keywords — gewichtet nach Seltenheit.**
 *
 * Idee von Daniel (24.08.2026), gebaut am 15.09.2026: „aber einklappbar".
 * Grundlage ist die Überschneidung der Merkmale, gerechnet als gewichteter
 * Jaccard-Wert: Schnittmenge durch Vereinigungsmenge, jedes Merkmal mit
 * `log(N / Häufigkeit)`. „Action" trägt damit fast nichts bei, „Cyberpunk" viel.
 *
 * Gemessen am Hauptbestand (2.771 Titel, alle mit deutscher Fassung): Zu „Ghost
 * in the Shell" kommen No Guns Life, Psycho-Pass 2, Battle Angel Alita und
 * Cyberpunk: Edgerunners; zu „Skeleton Knight in Another World" Isekai-Titel wie
 * Overlord und Shield Hero.
 *
 * **Eine Reihe erscheint einmal** — mit ihrem ähnlichsten Teil. Der Probelauf
 * vom 24.08.2026 zeigte sonst viermal Psycho-Pass unter acht Vorschlägen. Die
 * eigene Reihe fehlt ganz; sie steht ohnehin darüber.
 */
export interface Vorschlag {
  title: Title
  /** Gewichteter Anteil der gemeinsamen Merkmale, 0 bis 1. */
  anteil: number
  /** Die gewichtigsten gemeinsamen Merkmale, mit Präfix `g:` (Genre) oder `k:` (Keyword). */
  gemeinsam: string[]
}

/** Unter diesem Anteil ist die Überschneidung Zufall — gemessen: meist ein, zwei Allerwelts-Genres. */
const MINDESTANTEIL = 0.15

const gewichteJeListe = new WeakMap<readonly Title[], Map<string, number>>()

/*
  **Ein Name, ein Merkmal.** „Cyberpunk" steht bei Ghost in the Shell als Genre
  und als Keyword; ohne Zusammenlegen zählte es doppelt und stand in der Zeile
  „gemeinsam: Cyborg, Cyberpunk, Cyberpunk" (15.09.2026, Bildprüfung).
*/
function merkmale(t: Title): string[] {
  const genres = (t.genres ?? []).map((g) => 'g:' + g)
  const schon = new Set((t.genres ?? []).map((g) => g.toLowerCase()))
  const keywords = (t.keywords ?? []).filter((k) => !schon.has(k.toLowerCase())).map((k) => 'k:' + k)
  return [...new Set([...genres, ...keywords])]
}

/** Einmal je Titelliste gerechnet — die Liste wird beim Aufklappen einmal geladen und bleibt dieselbe. */
function gewichte(alle: readonly Title[]): Map<string, number> {
  const bekannt = gewichteJeListe.get(alle)
  if (bekannt) return bekannt
  const haeufigkeit = new Map<string, number>()
  for (const t of alle) for (const m of merkmale(t)) haeufigkeit.set(m, (haeufigkeit.get(m) ?? 0) + 1)
  const n = alle.length
  const w = new Map<string, number>()
  for (const [m, df] of haeufigkeit) w.set(m, Math.log(n / df))
  gewichteJeListe.set(alle, w)
  return w
}

/** Höchstens fünf (Daniel, 15.09.2026: „max 5 ähnliche titel"). */
export function aehnlicheTitel(titel: Title, alle: readonly Title[], anzahl = 5): Vorschlag[] {
  const eigene = new Set(merkmale(titel))
  if (!eigene.size) return []
  const w = gewichte(alle)
  let eigenesGewicht = 0
  for (const m of eigene) eigenesGewicht += w.get(m) ?? 0
  const wurzel = titel.franchiseId ?? titel.id
  const besteJeReihe = new Map<number, Vorschlag>()

  for (const b of alle) {
    const reihe = b.franchiseId ?? b.id
    if (reihe === wurzel) continue
    let schnitt = 0
    let verein = eigenesGewicht
    const gemeinsam: string[] = []
    for (const m of merkmale(b)) {
      const g = w.get(m) ?? 0
      if (eigene.has(m)) {
        schnitt += g
        gemeinsam.push(m)
      } else {
        verein += g
      }
    }
    if (!schnitt || !verein) continue
    const anteil = schnitt / verein
    if (anteil < MINDESTANTEIL) continue
    const bisher = besteJeReihe.get(reihe)
    if (!bisher || bisher.anteil < anteil) besteJeReihe.set(reihe, { title: b, anteil, gemeinsam })
  }

  return [...besteJeReihe.values()]
    .sort((a, b) => b.anteil - a.anteil)
    .slice(0, anzahl)
    .map((v) => ({ ...v, gemeinsam: v.gemeinsam.sort((x, y) => (w.get(y) ?? 0) - (w.get(x) ?? 0)).slice(0, 3) }))
}
