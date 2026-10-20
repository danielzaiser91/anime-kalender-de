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

export interface Messwerte {
  q4: number
  q6: number
  q12: number
  /** Trefferquote nach 6 gewerteten Duellen bei 30 % „kann nicht“. */
  q6neutral: number
  /** Restmenge nach 2 / 4 / 6 gewerteten Duellen. */
  rest: number[]
}

/**
 * Schwellen der Bestandswache. Spezifikation 17.3: 54 % nach 6 Duellen (300 Läufe, 10 % neutral), Streuung ±3 Punkte, Tagesdrift
 * (5 % der Einstiege zufällig fort) 54–59 %, also Untergrenze 50 %. Zufall plus Zählen (A0) trifft nach 4 Duellen 26 %: darunter
 * lernt der Kern nicht. Restmenge hier mit lauter gewerteten Duellen (186 / 52 / 16 am 20.10.2026), Bänder weit gesteckt.
 */
export function schwellenFehler(m: Messwerte): string[] {
  const fehler: string[] = []
  if (m.q6 < 0.5) fehler.push(`Trefferquote nach 6 Duellen ${(m.q6 * 100).toFixed(1)} % < 50 % (Spezifikation 17.3: 54 %)`)
  if (!(m.q4 < m.q6 && m.q6 < m.q12)) fehler.push(`Trefferquote steigt nicht mit den Duellen: 4 ${m.q4.toFixed(3)} · 6 ${m.q6.toFixed(3)} · 12 ${m.q12.toFixed(3)}`)
  if (m.q4 <= 0.3) fehler.push(`Trefferquote nach 4 Duellen ${m.q4.toFixed(3)} liegt im Bereich des Zufalls`)
  if (m.q6neutral < 0.4) fehler.push(`Trefferquote nach 6 Duellen bei 30 % „kann nicht“ ${(m.q6neutral * 100).toFixed(1)} % < 40 % (Spezifikation 17.3: 46 %)`)
  const [r2, r4, r6] = m.rest
  if (!(r2 > 120 && r2 < 400 && r4 > 35 && r4 < 140 && r6 > 12 && r6 < 50)) fehler.push(`Restmenge nach 2/4/6 Duellen ${m.rest.map((r) => r.toFixed(0)).join('/')} außerhalb 120–400 / 35–140 / 12–50`)
  return fehler
}
