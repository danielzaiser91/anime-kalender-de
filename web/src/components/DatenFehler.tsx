import { useLang } from '../lib/i18n.tsx'

/**
 * Wenn nach allen Neuversuchen keine Daten kommen: ein Satz für Besucher und ein Knopf, der neu lädt, ohne die Seite zu verlassen.
 * Dateiname und Status stehen nur im Entwicklungsmodus (sonst in der Konsole, `start-daten.ts`).
 */
export function DatenFehler({ detail, onNeuLaden }: { detail?: string; onNeuLaden: () => void }) {
  const { t } = useLang()
  return (
    <div role="alert" className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-t2 font-semibold text-ak-text">{t('app.loadError')}</h1>
      <button
        type="button"
        onClick={onNeuLaden}
        className="min-h-11 min-w-44 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche-2 px-5 text-t3 font-semibold text-ak-text transition hover:border-ak-leise"
      >
        {t('app.loadRetry')}
      </button>
      {import.meta.env.DEV && detail ? <p className="text-t4 text-ak-leise">{detail}</p> : null}
    </div>
  )
}
