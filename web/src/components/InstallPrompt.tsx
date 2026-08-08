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
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pwa.title')}
        className="animate-slide-in fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
      >
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="flex items-start gap-3">
            <AppMark />
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900 dark:text-white">{t('pwa.title')}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('pwa.pitch')}</p>
            </div>
          </div>

          {needsManual ? (
            // Safari lässt sich nicht fernsteuern — hier hilft nur der Weg.
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {t('pwa.iosHint')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
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
    </>
  )
}

/** Dauerhafter Installations-Knopf für die Kopfzeile. */
export function InstallButton() {
  const { t } = useLang()
  const { canPrompt, install } = useInstall()
  if (!canPrompt) return null
  return (
    <Button size="sm" onClick={() => void install()} title={t('pwa.pitch')}>
      ⬇ {t('pwa.install')}
    </Button>
  )
}
