import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsArt, type NewsEintrag, type PlatformId } from '@shared/types.ts'
import { loadNews } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { todayIso, addDays } from '@shared/time.ts'

/**
 * **Was sich getan hat — kurz.**
 *
 * Daniel am 12.09.2026: „a news section for the website, where all our news
 * regarding dubs (ankündigungen und releases) are published in a bite-sized
 * format (short and simple)". Also: eine Zeile je Meldung, nach Tagen
 * gruppiert, keine Fließtexte.
 *
 * Die Sätze entstehen hier und nicht im Bau — sonst stünde die deutsche
 * Fassung fest in einer Datei, und die Seite kann zwei Sprachen.
 */
const FARBE: Record<NewsArt, string> = {
  neu: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  folgen: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  angekuendigt: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  disc: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  kino: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  verspaetet: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}

function datumKurz(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

export function NewsView({ oeffne }: { oeffne: (titelId: number) => void }): React.JSX.Element {
  const { t } = useLang()
  const [meldungen, setMeldungen] = useState<NewsEintrag[] | null>(null)

  useEffect(() => {
    let abgebrochen = false
    void loadNews().then((liste) => {
      if (!abgebrochen) setMeldungen(liste)
    })
    return () => {
      abgebrochen = true
    }
  }, [])

  const tage = useMemo(() => {
    const jeTag = new Map<string, NewsEintrag[]>()
    for (const m of meldungen ?? []) {
      const liste = jeTag.get(m.am) ?? []
      liste.push(m)
      jeTag.set(m.am, liste)
    }
    return [...jeTag.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [meldungen])

  const satz = (m: NewsEintrag): string => {
    const anbieter = m.anbieter ? (PLATFORMS[m.anbieter as PlatformId]?.name ?? m.anbieter) : ''
    const datum = m.datum ? datumKurz(m.datum) : ''
    switch (m.art) {
      case 'neu':
        return anbieter ? t('news.neu', { anbieter }) : t('news.neuOhne')
      case 'folgen':
        return m.von === m.bis || m.bis === undefined
          ? t('news.folge', { von: m.von ?? '', anbieter })
          : t('news.folgen', { von: m.von ?? '', bis: m.bis, anbieter })
      case 'angekuendigt':
        return t('news.angekuendigt', { datum, anbieter })
      case 'disc':
        return t('news.disc', { datum })
      case 'kino':
        return t('news.kino', { datum })
      case 'verspaetet':
        return m.nachgereichtAm
          ? t('news.nachgereicht', { von: m.von ?? '', datum: datumKurz(m.nachgereichtAm) })
          : t('news.verspaetet', { von: m.von ?? '', datum })
    }
  }

  const tagName = (iso: string): string =>
    iso === todayIso() ? t('news.heute') : iso === addDays(todayIso(), -1) ? t('news.gestern') : datumKurz(iso)

  return (
    <section className="mx-auto w-full max-w-3xl px-3 py-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">{t('news.titel')}</h2>
      {meldungen && !meldungen.length && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('news.leer')}</p>
      )}
      {tage.map(([tag, liste]) => (
        <div key={tag} className="mb-5">
          <h3 className="sticky top-0 z-10 bg-slate-50/90 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-950/90 dark:text-slate-400">
            {tagName(tag)}
          </h3>
          <ul className="mt-1 space-y-1">
            {liste.map((m) => (
              <li key={`${m.art}-${m.titelId}-${m.datum ?? ''}-${m.von ?? ''}`}>
                <button
                  type="button"
                  onClick={() => oeffne(m.titelId)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-sky-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  {m.cover && (
                    <img src={m.cover} alt="" loading="lazy" className="h-10 w-7 shrink-0 rounded object-cover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {m.titel}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{satz(m)}</span>
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${FARBE[m.art]}`}>
                    {t(`news.art.${m.art}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
