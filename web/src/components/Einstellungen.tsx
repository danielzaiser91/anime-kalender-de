import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'

/**
 * **Die Einstellungen — ein Zahnrad, ein Dialog, eine Liste von Schaltern.**
 *
 * Daniel am 12.09.2026, als er entschied, die westlichen Serien aufzunehmen:
 * „immer sichtbar, aber bau eine einstellung seite, zahnrad icon sichtbar
 * platzieren, öffnet dialog, dort als erste option einfügen, ‚westliche anime
 * (Cartoons) ausblenden' - standardmäßig aus".
 *
 * Die Seite hatte bis dahin keine Einstellungen: Was einstellbar war — Thema,
 * Staffeln zusammenfassen, Titel ohne Synchro — stand jeweils dort, wo es
 * wirkt. Das trägt, solange eine Einstellung zu **einer** Ansicht gehört. Der
 * Cartoon-Schalter gehört zu allen, und dafür braucht es einen Ort.
 *
 * **Gespeichert wird im Browser, nicht in der Adresse.** Eine Einstellung ist
 * keine Ansicht: Wer einen Link teilt, teilt nicht seine Vorlieben mit.
 */
export const CARTOONS_AUS = 'cartoonsAus'

/** Liest den gespeicherten Stand — die Vorgabe ist „aus", also Cartoons sichtbar. */
export function cartoonsAusGespeichert(): boolean {
  try {
    return localStorage.getItem(CARTOONS_AUS) === '1'
  } catch {
    /* Privater Modus oder gesperrte Site-Daten: dann eben die Vorgabe. */
    return false
  }
}

export function EinstellungenDialog({
  offen,
  schliessen,
  cartoonsAus,
  setCartoonsAus,
}: {
  offen: boolean
  schliessen: () => void
  cartoonsAus: boolean
  setCartoonsAus: (next: boolean) => void
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
        className="w-full max-w-md rounded-3xl border border-ak-rand bg-ak-flaeche p-5 text-ak-text shadow-2xl"
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

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ak-rand p-3 transition hover:bg-ak-flaeche-2">
          <input
            type="checkbox"
            checked={cartoonsAus}
            onChange={(e) => setCartoonsAus(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff5a36]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t('einstellungen.cartoonsAus')}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-ak-leise">
              {t('einstellungen.cartoonsAusHinweis')}
            </span>
          </span>
        </label>
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
