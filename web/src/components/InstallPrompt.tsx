import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import {
  installDialogAnswered,
  isHandheld,
  rememberInstallDialog,
  useInstall,
} from '../lib/pwa.ts'
import { Button } from './ui.tsx'

/** Das App-Symbol, dasselbe Motiv wie auf dem Startbildschirm. */
function AppMark() {
  return (
    <img
      src="/icons/icon-192.png"
      alt=""
      width={56}
      height={56}
      className="size-14 shrink-0 rounded-xl shadow-lg"
    />
  )
}

/**
 * Fragt auf dem Handy einmalig, ob die Seite als App installiert werden soll —
 * und stellt sonst einen Knopf bereit.
 *
 * Die Frage kommt genau einmal. Ein Hinweis, der bei jedem Besuch wieder
 * hochklappt, ist keine Einladung mehr, sondern eine Belästigung; die Antwort
 * merkt sich der Browser. Wer „im Browser weiter" wählt, findet die
 * Installation danach über den Knopf in der Kopfzeile.
 */
export function InstallDialog() {
  const { t } = useLang()
  const { canPrompt, needsManual, install } = useInstall()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (installDialogAnswered()) return
    if (!isHandheld()) return
    if (!canPrompt && !needsManual) return
    // Nicht sofort ins Gesicht springen — erst darf die Seite ankommen.
    const id = window.setTimeout(() => setOpen(true), 1200)
    return () => window.clearTimeout(id)
  }, [canPrompt, needsManual])

  if (!open) return null

  const close = () => {
    rememberInstallDialog()
    setOpen(false)
  }

  return (
    // Mittig statt am unteren Rand: Eine Leiste unten wird als Werbebanner
    // gelesen und weggewischt. Der kräftige Hintergrund nimmt der Seite
    // dahinter die Aufmerksamkeit — sonst wirkt die Frage wie eine Randnotiz.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pwa.title')}
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <AppMark />
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900 dark:text-white">{t('pwa.title')}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('pwa.pitch')}</p>
            </div>
          </div>

          {needsManual ? (
            // Safari lässt sich nicht fernsteuern — hier hilft nur der Weg.
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {t('pwa.iosHint')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            {canPrompt && (
              <Button
                variant="primary"
                onClick={async () => {
                  await install()
                  close()
                }}
              >
                {t('pwa.install')}
              </Button>
            )}
            <Button onClick={close}>{t('pwa.stayInBrowser')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Installations-Knopf in der Kopfzeile — nur auf Geräten, die man in der Hand
 * hält. Auf dem Desktop ist eine installierte Fensteranwendung selten das, was
 * jemand von einem Kalender will, und der Knopf nähme nur Platz weg.
 */
export function InstallButton() {
  const { t } = useLang()
  const { canPrompt, install } = useInstall()
  if (!canPrompt || !isHandheld()) return null
  return (
    <Button size="sm" onClick={() => void install()} title={t('pwa.pitch')}>
      ⬇ {t('pwa.install')}
    </Button>
  )
}

/**
 * Das Angebot im Seitenfuß — der ruhige Ort dafür.
 *
 * Wer die Frage einmal beantwortet hat, bekommt sie nie wieder als Popup.
 * Weg ist die Möglichkeit damit aber nicht: Hier steht sie weiter, ohne sich
 * aufzudrängen. Auch auf iOS, wo es keinen Knopf geben kann — dort erscheint
 * die Anleitung.
 */
export function InstallFooterOffer() {
  const { t } = useLang()
  const { canPrompt, needsManual, install } = useInstall()
  const [showHint, setShowHint] = useState(false)
  // `isHandheld()` fehlte hier, während der Knopf im Kopf es längst prüfte —
  // deshalb bot der Fuß die Installation auch am Schreibtisch an, wo sie nicht
  // gewollt ist (bemerkt am 10.08.2026).
  if ((!canPrompt && !needsManual) || !isHandheld()) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => (canPrompt ? void install() : setShowHint((v) => !v))}
        className="cursor-pointer underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
      >
        ⬇ {t('pwa.install')}
      </button>
      {showHint && <span className="text-slate-500 dark:text-slate-400">{t('pwa.iosHint')}</span>}
    </span>
  )
}
