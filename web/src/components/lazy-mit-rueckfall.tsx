import { lazy, type ComponentType } from 'react'

/** Kleiner Rückfall, wenn ein Nachlade-Paket fehlt: Meldung und Neuladen, der Rest der Seite bleibt stehen. */
export function LadeRueckfall() {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-xs text-ak-leise">
      <span>Dieser Teil konnte nicht geladen werden.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche px-3 py-1 font-bold text-ak-text hover:bg-ak-flaeche-2"
      >
        Neu laden
      </button>
    </div>
  )
}

/**
 * `lazy` mit Rückfall: Nach `vite:preloadError` (preventDefault in `aktualisierung.ts`) löst `import()` mit `undefined` auf,
 * und ein alter Cache lässt es ablehnen; beides würde ohne Fehlergrenze den ganzen Baum abräumen.
 */
export function lazyMitRueckfall<P extends object>(laden: () => Promise<unknown>, waehle: (modul: any) => ComponentType<P>) {
  return lazy<ComponentType<P>>(() =>
    laden().then(
      (m) => ({ default: m ? waehle(m) : (LadeRueckfall as ComponentType<P>) }),
      () => ({ default: LadeRueckfall as ComponentType<P> }),
    ),
  )
}
