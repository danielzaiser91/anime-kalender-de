import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'

/** Die Einstellungen: ein Zahnrad, ein Dialog. Cartoons werden nur über den Schnellfilter ein- und ausgeblendet. */
export function EinstellungenDialog({
  offen,
  schliessen,
}: {
  offen: boolean
  schliessen: () => void
}) {
  const { t } = useLang()

  useEffect(() => {
    if (!offen) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    document.addEventListener('keydown', beiTaste)
    return () => document.removeEventListener('keydown', beiTaste)
  }, [offen, schliessen])

  if (!offen) return null

  /*
    **Am Körper, nicht im Kopfbereich.** `position: fixed` bezieht sich auf
    einen Vorfahren mit `transform` — und die Kopfleiste trägt beim Scrollen
    einen. Derselbe Fall wie beim Trailer-Dialog am 12.09.2026, dort hat es
    einen halben Bildschirm gekostet.
  */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('einstellungen.titel')}
      onClick={schliessen}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-ak-rand bg-ak-flaeche p-5 text-ak-text shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 font-display text-lg font-bold">
            {t('einstellungen.titel')}
          </h2>
          <button
            type="button"
            onClick={schliessen}
            aria-label={t('einstellungen.schliessen')}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-lg text-ak-leise transition hover:bg-ak-flaeche-2 hover:text-ak-text"
          >
            ✕
          </button>
        </div>

        <ThemaZeile />
      </div>
    </div>,
    document.body,
  )
}

/** Hell/Dunkel — auf dem Handy nur hier, am Rechner zusätzlich als Knopf im Kopf. */
function ThemaZeile() {
  const { t } = useLang()
  const [dunkel, umschalten] = useThema()
  return (
    <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-ak-rand p-3 transition hover:bg-ak-flaeche-2 md:hidden">
      <input type="checkbox" checked={!dunkel} onChange={umschalten} className="h-4 w-4 shrink-0 accent-[#ff5a36]" />
      <span className="text-sm font-semibold">{t('kopf.hell')}</span>
    </label>
  )
}
