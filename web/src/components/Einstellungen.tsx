import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../lib/i18n.tsx'
import { Tooltip } from './ui.tsx'

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

export function EinstellungenKnopf({
  offen,
  setOffen,
}: {
  offen: boolean
  setOffen: (next: boolean) => void
}) {
  const { t } = useLang()
  return (
    <Tooltip text={t('einstellungen.titel')}>
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-label={t('einstellungen.titel')}
        aria-expanded={offen}
        className="cursor-pointer rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-200/60 dark:hover:bg-white/10"
      >
        ⚙️
      </button>
    </Tooltip>
  )
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
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/15 dark:bg-slate-900"
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 text-base font-bold text-slate-900 dark:text-white">
            {t('einstellungen.titel')}
          </h2>
          <button
            type="button"
            onClick={schliessen}
            aria-label={t('einstellungen.schliessen')}
            className="grid h-8 w-8 place-items-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
          <input
            type="checkbox"
            checked={cartoonsAus}
            onChange={(e) => setCartoonsAus(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
              {t('einstellungen.cartoonsAus')}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
              {t('einstellungen.cartoonsAusHinweis')}
            </span>
          </span>
        </label>
      </div>
    </div>,
    document.body,
  )
}
