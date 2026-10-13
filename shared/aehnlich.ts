import type { Title } from './types.ts'
import { synchroBelegt } from './titles.ts'

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

/** Ohne belegte deutsche Synchro zählt ein Vorschlag nur mit diesem Teil seines Anteils: Die Seite führt Synchro, belegte Titel rücken vor (13.10.2026). */
const UNBELEGT_FAKTOR = 0.6

const gewichteJeListe = new WeakMap<readonly Title[], Map<string, number>>()
/** Der Seitenbau fragt für jeden Titel alle anderen ab (2.900 × 2.900); einmal je Titel gerechnet reicht. */
const merkmaleJeTitel = new WeakMap<Title, string[]>()

/*
  **Ein Name, ein Merkmal.** „Cyberpunk" steht bei Ghost in the Shell als Genre
  und als Keyword; ohne Zusammenlegen zählte es doppelt und stand in der Zeile
  „gemeinsam: Cyborg, Cyberpunk, Cyberpunk" (15.09.2026, Bildprüfung).
*/
function merkmale(t: Title): string[] {
  const bekannt = merkmaleJeTitel.get(t)
  if (bekannt) return bekannt
  const genres = (t.genres ?? []).map((g) => 'g:' + g)
  const schon = new Set((t.genres ?? []).map((g) => g.toLowerCase()))
  const keywords = (t.keywords ?? []).filter((k) => !schon.has(k.toLowerCase())).map((k) => 'k:' + k)
  const alle = [...new Set([...genres, ...keywords])]
  merkmaleJeTitel.set(t, alle)
  return alle
}

/** Die Reihenfolge der Vorschläge: Anteil, bei fehlendem Synchro-Beleg abgeschwächt. */
function rang(v: Vorschlag): number {
  return v.anteil * (synchroBelegt(v.title) ? 1 : UNBELEGT_FAKTOR)
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

/** Höchstens fünf. */
/**
 * **Cartoons messen am Mittel beider Listen** (16.09.2026). TMDB-Schlagwortlisten sind
 * sehr ungleich lang: „The Mighty Nein" hat 6, „The Legend of Vox Machina" 15, und die
 * beiden teilen die seltensten („dungeons and dragons", „based on web series"). Geteilt
 * durch die Vereinigung blieben sie unter der Schwelle, und das Panel sagte „keine
 * ähnlichen Titel". Geteilt wird deshalb durch das geometrische Mittel beider Gewichte,
 * und ein gemeinsames Schlagwort ist Pflicht — sonst lag jeder Titel ohne Schlagwörter
 * bei 1,00. Anime rechnen weiter wie bisher.
 */
export function aehnlicheTitel(titel: Title, alle: readonly Title[], anzahl = 5): Vorschlag[] {
  const kuerzere = Boolean(titel.westlich)
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
    let fremdesGewicht = 0
    const gemeinsam: string[] = []
    for (const m of merkmale(b)) {
      const g = w.get(m) ?? 0
      fremdesGewicht += g
      if (eigene.has(m)) {
        schnitt += g
        gemeinsam.push(m)
      } else {
        verein += g
      }
    }
    if (!schnitt || !verein) continue
    /* Mindestens ein gemeinsames Schlagwort — ein Genre allein ist bei Cartoons Allerwelt. */
    if (kuerzere && !gemeinsam.some((m) => m.startsWith('k:'))) continue
    const anteil = kuerzere ? schnitt / Math.sqrt(eigenesGewicht * fremdesGewicht) : schnitt / verein
    if (anteil < MINDESTANTEIL) continue
    const bisher = besteJeReihe.get(reihe)
    const neu = { title: b, anteil, gemeinsam }
    if (!bisher || rang(bisher) < rang(neu)) besteJeReihe.set(reihe, neu)
  }

  return [...besteJeReihe.values()]
    .sort((a, b) => rang(b) - rang(a))
    .slice(0, anzahl)
    .map((v) => ({ ...v, gemeinsam: v.gemeinsam.sort((x, y) => (w.get(y) ?? 0) - (w.get(x) ?? 0)).slice(0, 3) }))
}
