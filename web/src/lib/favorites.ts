import { useCallback, useEffect, useState } from 'react'

const KEY = 'favorites'

/**
 * Favoriten liegen im Browser des Nutzers, nicht auf einem Server — die Seite
 * ist statisch und soll ohne Konto auskommen. Ein eigenes Event hält mehrere
 * gleichzeitig sichtbare Sterne in Gleichklang.
 */
const CHANGED = 'favorites:changed'

function read(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [])
  } catch {
    return new Set()
  }
}

function write(ids: Set<number>): void {
  localStorage.setItem(KEY, JSON.stringify([...ids]))
  window.dispatchEvent(new CustomEvent(CHANGED))
}

export function useFavorites(): {
  favorites: Set<number>
  isFavorite: (id: number) => boolean
  toggle: (id: number) => void
  count: number
} {
  const [favorites, setFavorites] = useState<Set<number>>(read)

  useEffect(() => {
    const sync = () => setFavorites(read())
    window.addEventListener(CHANGED, sync)
    // Auch Änderungen aus einem zweiten Tab übernehmen.
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

  return {
    favorites,
    isFavorite: (id) => favorites.has(id),
    toggle,
    count: favorites.size,
  }
}
