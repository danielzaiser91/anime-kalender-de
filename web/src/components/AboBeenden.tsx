import { useLang } from '../lib/i18n.tsx'
import { getSyncToken, unsubscribeByToken } from '../lib/newsletterSync.ts'

export type AbmeldeState = 'idle' | 'fragt' | 'laeuft' | 'weg'

/**
 * „Abo beenden" steht im Kasten „Dein Abo", nicht bei „Dieses Gerät": Es beendet das Abo für alle Geräte (Daniel, 06.10.2026).
 * Zweistufig, weil Löschen nicht umkehrbar ist: Der erste Klick fragt, der zweite handelt. Der Zustand liegt beim Aufrufer,
 * weil die Seite nach dem Abmelden den Hinweis im Kasten „Dieses Gerät" zeigt.
 */
export function AboBeenden({ state, setState }: { state: AbmeldeState; setState: (s: AbmeldeState) => void }) {
  const { t } = useLang()
  const setAbmeldeState = setState
  const abmeldeState = state
  return (
    <>
      {abmeldeState === 'weg' ? (
        <span className="text-[13px] text-slate-500 dark:text-slate-400">{t('news.unsubDone')}</span>
      ) : abmeldeState === 'fragt' ? (
        <span className="flex items-center gap-2 text-[13px]">
          <span className="text-slate-600 dark:text-slate-300">{t('news.unsubConfirm')}</span>
          <button
            type="button"
            onClick={() => {
              const token = getSyncToken()
              if (!token) return
              setAbmeldeState('laeuft')
              unsubscribeByToken(token)
                .then(() => setAbmeldeState('weg'))
                .catch(() => setAbmeldeState('idle'))
            }}
            className="cursor-pointer font-medium text-red-500 underline underline-offset-2 hover:text-red-400"
          >
            {t('news.unsubYes')}
          </button>
          <button
            type="button"
            onClick={() => setAbmeldeState('idle')}
            className="cursor-pointer text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
          >
            {t('news.unsubNo')}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={abmeldeState === 'laeuft'}
          onClick={() => setAbmeldeState('fragt')}
          className="cursor-pointer text-[13px] text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-red-500 disabled:opacity-60 dark:text-slate-400"
        >
          {t('news.unsub')}
        </button>
      )}
    </>
  )
}
