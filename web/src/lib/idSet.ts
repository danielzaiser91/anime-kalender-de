import { useCallback, useEffect, useState } from 'react'

/**
 * Eine Menge von Titel-IDs im Browser des Nutzers.
 *
 * Grundlage für Favoriten und für ausgeblendete Titel — beide sind dasselbe
 * Datending: eine Liste von AniList-IDs, die lokal bleibt. Die Seite ist
 * statisch und soll ohne Konto auskommen.
 *
 * Das eigene Event hält mehrere gleichzeitig sichtbare Schalter in Gleichklang:
 * Wer in der Wochenansicht etwas ausblendet, sieht die Änderung sofort auch im
 * gerade offenen Detail-Panel. `storage` deckt zusätzlich einen zweiten Tab ab.
 */
export function createIdSet(key: string) {
  const CHANGED = `${key}:changed`

  function read(): Set<number> {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return new Set()
      const parsed: unknown = JSON.parse(raw)
      return new Set(Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [])
    } catch {
      return new Set()
    }
  }

  function write(ids: Set<number>): void {
    localStorage.setItem(key, JSON.stringify([...ids]))
    window.dispatchEvent(new CustomEvent(CHANGED))
  }

  function use(): { ids: Set<number>; has: (id: number) => boolean; toggle: (id: number) => void; count: number } {
    const [ids, setIds] = useState<Set<number>>(read)

    useEffect(() => {
      const sync = () => setIds(read())
      window.addEventListener(CHANGED, sync)
      window.addEventListener('storage', sync)
      return () => {
        window.removeEventListener(CHANGED, sync)
        window.removeEventListener('storage', sync)
      }
    }, [])

    const toggle = useCallback((id: number) => {
      const next = read()
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(next)
    }, [])

    return { ids, has: (id) => ids.has(id), toggle, count: ids.size }
  }

  return { read, write, use }
}
