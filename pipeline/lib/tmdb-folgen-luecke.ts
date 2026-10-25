import { PLATZHALTER } from '../bau/folgentitel-tmdb.ts'
import { waehleFaellige, type BestandKurz } from './tmdb-folgen-auswahl.ts'

/** Eine Folgendatei `public/data/folgen/<id>.json`, soweit die Lückenzählung sie liest. */
export interface FolgenDatei {
  /** Zeilen `[Nummer, Titel, …]`; ein Titel ist leer, wenn der Bau keinen deutschen kennt. */
  f: (string | number)[][]
  /** Belegt deutsch synchronisierte Folgenbereiche `[von, bis]`. */
  de?: [number, number][]
}

/**
 * TMDB-Abrufe, die der erste volle Lückenlauf höchstens macht (Messung 24.10.2026: Ø 2,06 Staffeln je Eintrag, je Titel 1 Serien-Abruf
 * plus 3 je Staffel mit deutscher und englischer Liste ≈ 7 Abrufe). Daraus folgt die Titelzahl des Standard-Limits.
 */
export const LUECKE_ABRUFE = 900
export const ABRUFE_JE_TITEL = 7
export const LUECKE_LIMIT = Math.floor(LUECKE_ABRUFE / ABRUFE_JE_TITEL)

/** Folgen im belegt deutschen Bereich ohne deutschen Titel (leer oder „Folge N"). */
export function dubLuecke(datei: FolgenDatei | undefined): number {
  if (!datei) return 0
  const bereiche = datei.de ?? []
  return datei.f.filter(([nr, titel]) => {
    if (!bereiche.some(([von, bis]) => (nr as number) >= von && (nr as number) <= bis)) return false
    const t = String(titel ?? '').trim()
    return !t || PLATZHALTER.test(t)
  }).length
}

/** Titel mit Lücke im Dub-Bereich, die noch keinen TMDB-Eintrag haben: größte Lücke zuerst, bei Gleichstand Katalogreihenfolge. */
export function waehleLuecke<T extends { id: string }>(
  kandidaten: T[], bestand: Record<string, unknown>, luecke: (id: string) => number, limit: number,
): T[] {
  return kandidaten
    .filter((k) => !bestand[k.id])
    .map((k, i) => ({ k, i, n: luecke(k.id) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.k)
}

export interface AbrufKandidat {
  id: string
  t: { streams?: unknown[]; episodes?: number | null }
}

export interface AbrufWahl<T extends AbrufKandidat> {
  /** Alle Serien mit TMDB-Verweis, auch ohne Anbieter (Heimvideo-Synchros haben keinen). */
  alle: T[]
  bestand: Record<string, BestandKurz>
  heute: string
  alterTage: number
  limit: number
  /** Nur die Lückentitel, ohne die regulären Fälligen (Probelauf `--nur-luecke`). */
  nurLuecke: boolean
  luecke: (id: string) => number
}

/** Lückentitel zuerst (höchstens `LUECKE_LIMIT`, auch bei `nurLuecke`), danach die regulär Fälligen von Titeln mit Anbieter; insgesamt höchstens `limit`. */
export function waehleAbrufe<T extends AbrufKandidat>(w: AbrufWahl<T>): T[] {
  // Unbekannte Folgenzahl (laufende Langläufer wie Shin-chan) zählt für Lückentitel als Serie, regulär nicht.
  const serien = w.alle.filter((k) => (k.t.episodes ?? 2) > 1)
  const grenze = Math.min(LUECKE_LIMIT, w.limit)
  const luecke = waehleLuecke(serien, w.bestand, w.luecke, grenze)
  if (w.nurLuecke) return luecke
  const mitAnbieter = w.alle.filter((k) => (k.t.streams ?? []).length > 0 && (k.t.episodes ?? 0) > 1 && !luecke.includes(k))
  return [...luecke, ...waehleFaellige(mitAnbieter, w.bestand, w.heute, w.alterTage, w.limit)].slice(0, w.limit)
}
