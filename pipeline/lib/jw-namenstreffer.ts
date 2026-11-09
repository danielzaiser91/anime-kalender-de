import { normalisiereName } from './treffer-erben.ts'

/**
 * **Der beste Namenstreffer bei „ohne Treffer“ — nur gespeichert, nie zugeordnet** (06.11.2026). Zugeordnet wird allein über die
 * TMDB-Kennung; findet die Suche den Titel unter einer anderen, bleibt er `ohneTreffer`. Damit die Kennungslücke zählbar wird
 * (Gegenprobe: Cardcaptor Sakura Clear Card 97881, JustWatch 282464, wir 207336), steht der nächste Treffer samt seiner
 * abweichenden Kennung im Befund. Kein Leser im Bau.
 */
export interface NamensTreffer {
  jwId: string
  jwPfad: string
  titel: string
  /** TMDB-Kennung laut JustWatch; `null`, wenn JustWatch keine nennt. */
  tmdbId: number | null
  /** Der Name des Treffers stimmt (normalisiert) mit einem unserer Namen überein; sonst nur der erste Treffer der Suche. */
  gleicherName: boolean
}

interface Kandidat {
  id: string
  content: { title: string; fullPath: string; externalIds?: { tmdbId?: number | string | null } | null }
}

/**
 * Aus den Treffern aller Namenssuchen (in Suchreihenfolge) der beste mit **abweichender** TMDB-Kennung: erst einer mit gleichem
 * Namen, sonst der erste. Ein Treffer mit der erwarteten Kennung ist kein Kandidat (der wäre zugeordnet worden).
 */
export function besterNamensTreffer(namen: string[], treffer: Kandidat[], erwartet: number | string): NamensTreffer | undefined {
  const fremd = treffer.filter((k) => String(k.content.externalIds?.tmdbId ?? '') !== String(erwartet))
  const unsere = new Set(namen.map(normalisiereName).filter(Boolean))
  const bester = fremd.find((k) => unsere.has(normalisiereName(k.content.title))) ?? fremd[0]
  if (!bester) return undefined
  const tmdb = Number(bester.content.externalIds?.tmdbId)
  return {
    jwId: bester.id,
    jwPfad: bester.content.fullPath,
    titel: bester.content.title,
    tmdbId: Number.isFinite(tmdb) && tmdb > 0 ? tmdb : null,
    gleicherName: unsere.has(normalisiereName(bester.content.title)),
  }
}
