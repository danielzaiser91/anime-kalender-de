import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import {
  installDialogAnswered,
  isHandheld,
  rememberInstallDialog,
  useInstall,
  useMenueInstall,
  type InstallState,
} from '../lib/pwa.ts'
import { HerunterladenZeichen } from './kalender/Zeichen.tsx'
import { Button, Tooltip } from './ui.tsx'

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
  /* Rangfolge im Kopf (Daniel, 09.10.2026): unter 390 px kein Knopf, bis 639 px nur das Symbol, darüber mit Text. */
  return (
    <>
      <span className="hidden min-[390px]:block sm:hidden">
        <Tooltip text={t('pwa.install')} seite="unten">
          <button
            type="button"
            onClick={() => void install()}
            aria-label={t('pwa.install')}
            className={`flex size-11 shrink-0 cursor-pointer items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise`}
          >
            <HerunterladenZeichen groesse={20} />
          </button>
        </Tooltip>
      </span>
      <span className="hidden sm:block">
        <Button size="sm" onClick={() => void install()} title={t('pwa.pitch')}>
          <span className="whitespace-nowrap">⬇ {t('pwa.install')}</span>
        </Button>
      </span>
    </>
  )
}

/**
 * Zeile „App installieren“ im Glocken-Menü — nur am Handy und nur, wenn der Kopf-Knopf nicht da ist
 * (Tabelle in `install-stellen.ts`). Der Zustand kommt von außen, weil das Menü seinen Inhalt erst
 * beim Öffnen baut und `beforeinstallprompt` dort verpasst hätte.
 */
export function InstallZeile(state: InstallState) {
  const { t } = useLang()
  const [showHint, setShowHint] = useState(false)
  const stelle = useMenueInstall(state)
  if (!stelle) return null
  const symbol = <span className="text-ak-leise"><HerunterladenZeichen groesse={20} /></span>
  if (stelle === 'hinweis') {
    return (
      <div className="flex min-h-11 w-full items-center gap-3 p-3 text-ak-text">
        {symbol}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-bold">{t('pwa.install')}</span>
          <span className="text-xs text-ak-leise">{t('pwa.manualHint')}</span>
        </span>
      </div>
    )
  }
  const direkt = stelle === 'direkt'
  return (
    <button
      type="button"
      data-schliesst={direkt ? '' : undefined}
      onClick={() => (direkt ? void state.install() : setShowHint((v) => !v))}
      className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left text-ak-text transition hover:bg-ak-flaeche-2"
    >
      {symbol}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-bold">{t('pwa.install')}</span>
        <span className="text-xs text-ak-leise">{showHint ? t('pwa.iosHint') : t('pwa.pitch')}</span>
      </span>
    </button>
  )
}
