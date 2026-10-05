import { loadJson } from './data.ts'

/**
 * **Einmaliger Umzug der gemerkten Titel auf unsere eigene Kennung** (Stufe 1, 05.10.2026).
 *
 * Favoriten, ausgeblendete und gesehene Titel standen im Browser unter der AniList-Kennung. Beim ersten Laden nach der Umstellung
 * werden sie über `anilist-ak.json` umgeschrieben; danach steht die Marke. **Entfällt am 05.11.2026** (ein Monat Karenz,
 * Daniel: danach nur noch unsere Kennung, keine Rückwärtskompatibilität) — mit `anilist-ak.json`, dem Worker-Gegenstück
 * (`worker/src/kennung-umzug.ts`) und der Prüfung in `pipeline/check-logic.ts`, die danach rot wird.
 */
const MARKE = 'kennung:ak1'
const LISTEN = ['favorites', 'hidden'] as const
const KARTEN = ['favorites:seit', 'gesehenBis'] as const

type Abbild = Map<number, number>

function umschreibenListe(schluessel: string, abbild: Abbild): void {
  const roh = localStorage.getItem(schluessel)
  if (!roh) return
  const alt: unknown = JSON.parse(roh)
  if (!Array.isArray(alt)) return
  const neu = alt.map((id) => (typeof id === 'number' ? abbild.get(id) : undefined)).filter((id): id is number => id !== undefined)
  localStorage.setItem(schluessel, JSON.stringify(neu))
}

function umschreibenKarte(schluessel: string, abbild: Abbild): void {
  const roh = localStorage.getItem(schluessel)
  if (!roh) return
  const alt = JSON.parse(roh) as Record<string, unknown>
  const neu: Record<string, unknown> = {}
  for (const [id, wert] of Object.entries(alt)) {
    const ak = abbild.get(Number(id))
    if (ak !== undefined) neu[String(ak)] = wert
  }
  localStorage.setItem(schluessel, JSON.stringify(neu))
}

/** Läuft vor dem ersten Rendern; ohne Speicher oder ohne Altbestand kostet es nichts. */
export async function kennungUmzug(): Promise<void> {
  try {
    if (localStorage.getItem(MARKE)) return
    const hatAltes = [...LISTEN, ...KARTEN].some((k) => localStorage.getItem(k))
    if (hatAltes) {
      const paare = await loadJson<[number, number][]>('anilist-ak.json')
      const abbild: Abbild = new Map(paare.map(([ak, anilist]) => [anilist, ak]))
      for (const k of LISTEN) umschreibenListe(k, abbild)
      for (const k of KARTEN) umschreibenKarte(k, abbild)
      localStorage.removeItem('newsletterSyncSent')
    }
    localStorage.setItem(MARKE, '1')
  } catch {
    /* Ohne Netz bleibt der Altbestand liegen und wird beim nächsten Laden umgeschrieben. */
  }
}
