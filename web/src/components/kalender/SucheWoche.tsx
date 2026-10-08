import type { ReleaseEvent } from '@shared/types.ts'
import { formatDate, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../../lib/data.ts'
import { useDbTreffer } from '../../lib/db-treffer.ts'
import { useLang } from '../../lib/i18n.tsx'
import { EMPTY_FILTERS } from '../../lib/filters.ts'
import type { AppRoute } from '../../lib/router.ts'
import { useVorschau } from '../../lib/vorschau.ts'

/** Gilt die Vorschau „suche-woche" gerade (Woche, Suche nicht leer)? Liefert den bereinigten Suchbegriff mit. */
export function useSucheZusammen(search: string, monat: boolean): [string, boolean] {
  const v = useVorschau('suche-woche')
  const suche = search.trim()
  return [suche, !monat && suche !== '' && v === 'zusammen']
}

/**
 * Vorschau „suche-woche": Eine Zeile sagt, wie viele Titel die Suche in dieser Woche und in der Datenbank trifft,
 * mit Sprung in die Datenbank. Gezählt werden Titel, nicht Termine.
 */
export function SucheWocheZeile({
  data,
  suche,
  imZeitraum,
  navigate,
}: {
  data: Dataset
  suche: string
  imZeitraum: ReleaseEvent[]
  navigate: (next: Partial<AppRoute>) => void
}) {
  const onDatenbank = () => navigate({ view: 'datenbank', filters: { ...EMPTY_FILTERS, search: suche }, title: undefined, disc: undefined })
  const { t } = useLang()
  const inWoche = new Set(imZeitraum.map((e) => e.titleId)).size
  const db = useDbTreffer(data, suche, true)
  return (
    <p role="status" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-2xl border border-ak-rand bg-ak-flaeche px-4 py-2.5 text-sm text-ak-text">
      <span className="font-semibold">{inWoche === 1 ? t('kal.sucheWoche1') : t('kal.sucheWocheN', { n: inWoche })}</span>
      <span aria-hidden="true" className="text-ak-sehr-leise">
        ·
      </span>
      <span className="text-ak-leise">{db === undefined ? t('kal.sucheDbLaedt') : t('kal.sucheDb', { n: db.toLocaleString('de-DE') })}</span>
      {db !== undefined && db > 0 && (
        <button
          type="button"
          onClick={onDatenbank}
          className="min-h-11 cursor-pointer font-bold text-ak-akzent-text hover:underline sm:min-h-0"
        >
          → {t('kal.sucheAnzeigen')}
        </button>
      )}
    </p>
  )
}

/** Ein Tag ohne Treffer als schmale Zeile — behält `data-datum`, damit Sprünge zu Tagen weiter greifen. */
export function LeererTag({ datum, heute }: { datum: string; heute: boolean }) {
  const { t } = useLang()
  return (
    <section
      data-datum={datum}
      data-heute={heute ? '1' : undefined}
      aria-label={`${weekdayName(datum)}, ${formatDate(datum)}`}
      className="flex items-baseline gap-3 border-t border-ak-linie py-2 text-xs text-ak-sehr-leise"
    >
      <span className={`font-bold uppercase tracking-[0.12em] ${heute ? 'text-ak-akzent-text' : ''}`}>
        {weekdayName(datum, true)} {Number(datum.slice(8))}
      </span>
      <span>{t('kal.keinTreffer')}</span>
    </section>
  )
}
