import type { Title, WatchLink } from '../../shared/types.ts'

/**
 * **Nummerierte Filmkapitel bei den Telekom-Shops: der „über TMDB"-Weg ist nicht überprüfbar und wird verworfen.**
 *
 * Daniel am 31.10.2026 an „Princess Principal: Crown Handler 3": maxdome und freenet meinVOD („über TMDB")
 * führten über TMDB und JustWatch zur Seite von Chapter 2; maxdome führt nur Chapter 1 und 2. TMDB nennt für alle
 * drei Kapitel dieselbe Anbieterliste (`offers`: maxdome Store, Freenet meinVOD), JustWatch hängt das eine Shop-Angebot
 * an jedes Kapitel. Wir kennen das Ziel des Klicks nicht (die TMDB-Seite sperrt robots.txt), also lässt sich die Nummer
 * nicht abgleichen. Direkte Adressen (JustWatch, Handpflege) bleiben — nur der Umweg über TMDB entfällt.
 */
const TELEKOM_SHOPS = /^(maxdome|freenet meinvod|videoload|magentatv)$/i

/** Nummer aus dem Namen („… Crown Handler 3", „Chapter 2", „Teil 4") oder, wo der Name keine trägt, aus dem TMDB-Kürzel (`/movie/347187-4/`). */
export function kapitelNummer(t: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji'>, tmdbUrl: string): number | null {
  for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
    const m = /(?:^|[\s~:-])(?:chapter|teil|part|kapitel|case)?\s*(\d{1,2})\s*$/i.exec((name ?? '').trim())
    if (m) return Number(m[1])
  }
  const slug = /themoviedb\.org\/movie\/\d+-([a-z0-9-]*?)\/watch/i.exec(tmdbUrl)?.[1]
  const m = slug ? /(?:^|-)(\d{1,2})$/.exec(slug) : null
  return m ? Number(m[1]) : null
}

const istTmdbWeg = (w: WatchLink): boolean => /themoviedb\.org/.test(w.url) && TELEKOM_SHOPS.test(w.name)

/** Ein verworfener Weg: für Log und Zählung. */
export type VerworfenerKapitelWeg = { id: number; name: string; weg: string; nummer: number }

/** Entfernt die „über TMDB"-Telekom-Wege nummerierter Filmkapitel und nennt sie. */
export function entferneKapitelShopWege(titles: Iterable<Title>): VerworfenerKapitelWeg[] {
  const weg: VerworfenerKapitelWeg[] = []
  for (const t of titles) {
    if (t.format !== 'MOVIE' || !t.watchLinks?.length) continue
    t.watchLinks = t.watchLinks.filter((w) => {
      if (!istTmdbWeg(w)) return true
      const nummer = kapitelNummer(t, w.url)
      if (nummer === null) return true
      weg.push({ id: t.id, name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? '?', weg: w.name, nummer })
      return false
    })
  }
  return weg
}
