import type { ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { BEREICHE, bereichVon } from '../lib/bereiche.ts'

/**
 * Nur der schlichte Linksklick geht durch die App. Mittlere Maustaste, Strg-,
 * Shift- und Meta-Klick sollen die echte Adresse öffnen — dafür steht am
 * Element ein `href` (Daniel, 01.10.2026: Logo und Reiter per mittlerer
 * Maustaste im neuen Tab).
 */
export function einfacherKlick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/** Die Bereiche als Reiter (ab `md`); auf dem Handy stehen sie unten in `HandyNavigation`. */
export function KopfNavigation({ view, aktiv, onView, hrefFuer }: {
  view: ViewId
  aktiv: ReturnType<typeof bereichVon>
  onView: (v: ViewId) => void
  hrefFuer: (ziel: ViewId) => string
}) {
  const { t } = useLang()
  return (
    <nav aria-label={t('nav.bereich')} className="hidden gap-3 text-[15px] font-semibold md:flex lg:gap-6">
      {BEREICHE.map((b) => {
        const ziel = b.id === 'kalender' && aktiv === 'kalender' ? view : b.ziel
        return (
          <a
            key={b.id}
            href={hrefFuer(ziel)}
            onClick={(e) => {
              if (einfacherKlick(e)) {
                e.preventDefault()
                onView(ziel)
              }
            }}
            aria-current={aktiv === b.id ? 'page' : undefined}
            className={[
              'cursor-pointer whitespace-nowrap border-b-2 py-2 transition',
              b.id === 'empfehlung' ? 'hidden xl:block' : '',
              aktiv === b.id ? 'border-ak-gewaehlt text-ak-text' : 'border-transparent text-ak-leise hover:text-ak-text',
            ].join(' ')}
          >
            {t(b.id === 'kalender' ? 'nav.kalender' : (`view.${b.id}` as TranslationKey))}
          </a>
        )
      })}
    </nav>
  )
}

