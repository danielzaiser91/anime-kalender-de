import { useCallback, useState } from 'react'

/**
 * Adresse unter `/r/<slug>/` statt der Hash-Adresse aus der Browserleiste.
 * Nur diese Seite existiert als echte Datei und trägt deshalb ein eigenes
 * Vorschaubild — alles hinter dem `#` erreicht weder Server noch Crawler.
 */
export function shareUrl(slug: string): string {
  return new URL(`${import.meta.env.BASE_URL}r/${slug}/`, window.location.origin).toString()
}

export function useShare(): {
  share: (slug: string, title: string) => Promise<void>
  copiedSlug: string | undefined
} {
  const [copiedSlug, setCopiedSlug] = useState<string>()

  const share = useCallback(async (slug: string, title: string) => {
    const url = shareUrl(slug)
    // Auf Mobilgeräten das Teilen-Menü des Systems, sonst in die Zwischenablage.
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // Abbruch durch den Nutzer oder kein Ziel vorhanden — dann kopieren.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(undefined), 1800)
    } catch {
      window.prompt('Link kopieren:', url)
    }
  }, [])

  return { share, copiedSlug }
}
