import type { EmpfehlungsDatei, Kandidat } from '../../shared/empfehlung-pool.ts'
import { antworte, naechstesPaar, neuerZustand, vorschlaege, type Antwort, type Zustand } from '../../shared/empfehlung-kern.ts'
import { cos, zufall, type Kontext } from '../../shared/empfehlung-vektor.ts'

/** Künstliche Nutzer mit fester Grundwahrheit (Spezifikation 17.3): Kernmenge = Titel, die dem Profil entsprechen. */
type Hat = (x: string) => boolean
export const PROFILE: Record<string, (hat: Hat, k: Kandidat) => boolean> = {
  'Isekai-Komödie': (h) => h('Isekai') && h('Comedy'),
  'ernste Sci-Fi': (h) => h('Sci-Fi') && !h('Comedy') && (h('Drama') || h('Psychological') || h('Dystopian') || h('Post-Apocalyptic')),
  'Shōjo-Romance': (h) => h('Romance') && (h('Shoujo') || h('School') || h('Slice of Life')) && !h('Ecchi') && !h('Gore'),
  'dunkle Action': (h) => h('Action') && (h('Gore') || h('Horror') || h('Dunkle Fantasy') || h('Demons')) && !h('Comedy'),
  Familienfilm: (h, k) => k.f === 'MOVIE' && (k.fsk === 0 || k.fsk === 6 || k.fsk === 12) && (h('Adventure') || h('Fantasy')),
}

export interface Profil {
  name: string
  kern: boolean[]
  nutzen: number[]
}

export function baueProfil(k: Kontext, name: string): Profil {
  const d: EmpfehlungsDatei = k.datei
  const kern = d.einstiege.map((e) => {
    const namen = new Set([...e.g.map((i) => d.genres[i]), ...e.k.map((i) => d.keywords[i])])
    return PROFILE[name]((x) => namen.has(x), e)
  })
  const mitte = kern.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
  const betrag = Math.sqrt(mitte.reduce((s, m) => s + mitte.reduce((t, n) => t + cos(k, m, n), 0), 0)) || 1
  const nutzen = d.einstiege.map((_, i) => 3 * Number(kern[i]) + 2 * Math.max(0, mitte.reduce((s, m) => s + cos(k, i, m), 0) / betrag))
  return { name, kern, nutzen }
}

/** Antwort des künstlichen Nutzers: `neutral` Wahrscheinlichkeit für „kann nicht“, `irrtum` für zufälliges Wählen. */
function antwortVon(p: Profil, a: number, b: number, neutral: number, irrtum: number, r: () => number): Antwort {
  if (r() < neutral) return 'N'
  if (r() < irrtum) return r() < 0.5 ? 'A' : 'B'
  if (p.nutzen[a] === p.nutzen[b]) return r() < 0.5 ? 'A' : 'B'
  return p.nutzen[a] > p.nutzen[b] ? 'A' : 'B'
}

export interface Lauf {
  zustand: Zustand
  paare: Array<[number, number]>
  treffer: number
}

/** Ein künstlicher Nutzer spielt `duelle` gewertete Duelle; `treffer` = Vorschläge in der Kernmenge. */
export function spiele(k: Kontext, p: Profil, startwert: number, duelle: number, neutral = 0.1, irrtum = 0.1): Lauf {
  const r = zufall(startwert * 7919 + 13)
  let z: Zustand = neuerZustand(k, startwert)
  const paare: Array<[number, number]> = []
  while (z.gewertet < duelle) {
    const paar = naechstesPaar(k, z)
    if (!paar) break
    paare.push(paar)
    z = antworte(k, z, antwortVon(p, paar[0], paar[1], neutral, irrtum, r))
  }
  const treffer = vorschlaege(k, z).filter((v) => p.kern[k.index.get(v.id)!]).length
  return { zustand: z, paare, treffer }
}

/** Profile mit weniger Titeln in der Kernmenge sind keine Messlatte mehr (Schlagwort umbenannt oder selten geworden). */
export const MIN_KERN = 10

/** Die Profile mit genug Kerntiteln und die Namen der übersprungenen; der Wächter meldet beides statt falsch Alarm zu schlagen. */
export function brauchbareProfile(k: Kontext): { profile: Profil[]; uebersprungen: string[] } {
  const alle = Object.keys(PROFILE).map((name) => baueProfil(k, name))
  return {
    profile: alle.filter((p) => p.kern.filter(Boolean).length >= MIN_KERN),
    uebersprungen: alle.filter((p) => p.kern.filter(Boolean).length < MIN_KERN).map((p) => `${p.name} (${p.kern.filter(Boolean).length})`),
  }
}
