import type { DataMeta } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'

export function Footer({ meta }: { meta: DataMeta }) {
  const { t } = useLang()
  const generated = new Date(meta.generatedAt)
  // Zwei Zeilen, mehr nicht: Zahlen und Stand, darunter die Wege. Die
  // Quellenliste hat eine eigene Ansicht bekommen — sie stand hier unter jeder
  // Seite und wurde nach dem ersten Lesen nie wieder gebraucht.
  return (
    <footer className="mt-10 border-t border-slate-200 pb-24 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4">
        <p>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{t('app.title')}</span>
          {' · '}
          {/* Ein Datensatz vor dem ersten Bau mit `belegtCount` (Übergang 09.10.2026) kennt die Aufteilung nicht — dann ohne „belegt“. */}
          {t(meta.belegtCount === undefined ? 'footer.statsGesamt' : 'footer.stats', {
            titles: meta.titleCount.toLocaleString('de-DE'),
            belegt: (meta.belegtCount ?? 0).toLocaleString('de-DE'),
            rest: (meta.titleCount - (meta.belegtCount ?? 0)).toLocaleString('de-DE'),
            releases: meta.releaseCount,
            events: meta.eventCount,
          })}
          {' · '}
          {t('footer.updated')}{' '}
          <time dateTime={meta.generatedAt}>
            {generated.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a className="hover:underline" href="#/quellen">
            {t('footer.sources')}
          </a>
          <a className="hover:underline" href="#/impressum">
            {t('view.impressum')}
          </a>
          <a className="hover:underline" href="#/datenschutz">
            {t('view.datenschutz')}
          </a>
          <a className="hover:underline" href="#/abo">
            {t('view.abo')}
          </a>
          <a
            className="hover:underline"
            href="https://github.com/danielzaiser91/anime-kalender-de"
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('footer.code')}
          </a>
        </p>
      </div>
    </footer>
  )
}
