import type { Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Button } from '../ui.tsx'
import { PANEL_KENNUNG } from './reihen-spur-regeln.ts'

/** Der Rahmen, solange der Titel fehlt: Ladehinweis oder „keine Metadaten“. */
export function PanelLeer({ holt, t, onClose }: { holt: boolean; t: Translate; onClose: () => void }) {
  /*
    **`overscroll-contain` nur mit Maus: Am Ende des Panels hört das Scrollen auf.**

    Sonst reicht der Browser das Rad an den Kalender dahinter weiter. Auf
    Touch-Geräten würde dieselbe Klasse das Neuladen per Herunterwischen
    verhindern — dort deckt das Panel die Seite ohnehin ganz ab. Dieselbe Klasse
    trägt die zweite Panel-Hülle. Die inneren Rollbereiche (Pillenreihe,
    Reihenliste) tragen sie nicht: Am Ende der Liste soll das Panel
    weiterscrollen, nur die Seite dahinter nicht.
  */
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto pointer-fine:overscroll-contain border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
      {/*
        **Nachladen statt aufgeben — die Adresse muss teilbar sein.**

        Der Erstaufruf lädt nur `titles-core.json`: die Titel, auf die ein
        Termin zeigt. Wer die Adresse eines Teils **ohne** Termin öffnet oder
        neu lädt — `#/woche?t=161802`, „Der Traum von Coleus" —, traf damit auf
        „Zu diesem Eintrag liegen keine Metadaten vor" (Daniel, 04.09.2026:
        „die url … ist nicht teilbar. fix das").

        Beim Wechsel **innerhalb** des Panels wurde schon nachgeladen; nur beim
        Einstieg von außen fehlte derselbe Griff. Der Ladehinweis steht so
        lange, bis beide Bestände da sind — danach entscheidet erst, ob es den
        Titel wirklich nicht gibt.
      */}
      <p className="mb-3 text-t3 text-slate-500">
        {holt ? t('detail.seasonLoading') : t('detail.noMeta')}
      </p>
      <Button onClick={onClose} size="sm">
        {t('detail.close')}
      </Button>
    </aside>
  )
}

// Ausgeblendet: Auch das Detail bleibt zu. Über die Kacheln kommt man ohnehin
// nicht mehr hierher, aber ein geteilter Link oder ein Lesezeichen schon —
// und dann soll nicht doch alles zu sehen sein, was jemand weggeklickt hat.
export function PanelVersteckt({ title, t, onClose, onToggleHidden }: {
  title: Title
  t: Translate
  onClose: () => void
  onToggleHidden: (id: number) => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col justify-center gap-4 border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        data-panel={PANEL_KENNUNG}
        aria-label={anzeigeName(title)}
      >
        <p className="text-t3 font-semibold italic text-slate-400 dark:text-slate-500">
          {anzeigeName(title)}
        </p>
        <p className="text-t3 text-slate-500 dark:text-slate-400">{t('detail.hiddenNote')}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => onToggleHidden(title.id)} size="sm">
            {t('card.unhide')}
          </Button>
          <Button onClick={onClose} size="sm">
            {t('detail.close')}
          </Button>
        </div>
      </div>
    </>
  )
}
