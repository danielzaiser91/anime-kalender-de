import { useLayoutEffect, useState, type RefObject } from 'react'
import type { NewsBeleg } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'

/** Crunchyrolls News-Rubriken aus dem Pfad — „Crunchyroll News" dreimal sagte nicht, was dahinter steht. */
const RUBRIKEN: Record<string, string> = { 'seasonal-lineup': 'Season-Lineup', latest: 'News' }

/** Anzeigename eines Belegs: bei Crunchyroll-News die Rubrik aus dem Pfad (der Verlag steht im Tooltip), sonst der Verlag. */
export function quellenLabel(b: NewsBeleg): string {
  const rubrik = /crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/([a-z-]+)\//i.exec(b.url)?.[1]
  if (!rubrik) return b.name
  return RUBRIKEN[rubrik] ?? rubrik.replace(/-/g, ' ')
}

/** Höhe einer Quellenzeile in px (text-[11px] mit leading-4). */
const ZEILE = 16

/**
 * **Die Quellen stehen rechts am Eintrag**: die erste auf Höhe des
 * Art-Labels, die weiteren darunter. Wie viele Zeilen Platz haben, bestimmt die Höhe des
 * Textes links; was nicht passt, steht als „+N weitere Quellen" da und klappt auf.
 * Gezählt wird nach Dokument — ein aktualisierter Artikel bleibt eine Quelle.
 */
export function QuellenSpalte({ belege, links }: { belege: NewsBeleg[]; links: RefObject<HTMLElement | null> }) {
  const { t } = useLang()
  const [platz, setPlatz] = useState(belege.length)
  const [offen, setOffen] = useState(false)
  useLayoutEffect(() => {
    const el = links.current
    if (!el) return
    const messen = () => setPlatz(Math.max(1, Math.floor(el.getBoundingClientRect().height / ZEILE)))
    messen()
    const ro = new ResizeObserver(messen)
    ro.observe(el)
    return () => ro.disconnect()
  }, [links])
  if (!belege.length) return null
  const passt = offen || belege.length <= platz
  const gezeigt = passt ? belege : belege.slice(0, Math.max(1, platz - 1))
  return (
    <span className="flex w-28 shrink-0 flex-col items-end gap-0 text-right text-[11px] leading-4 sm:w-36">
      {gezeigt.map((b) => (
        <a
          key={b.url}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          title={b.gelesenAm ? t('news.quelleGelesen', { name: b.name, datum: datumKurz(b.gelesenAm) }) : b.name}
          className="max-w-full truncate font-bold text-ak-akzent-text hover:underline"
        >
          {quellenLabel(b)} ↗
        </a>
      ))}
      {!passt && (
        <button type="button" onClick={() => setOffen(true)} className="text-ak-leise hover:text-ak-text hover:underline">
          {t('news.weitereQuellen', { n: belege.length - gezeigt.length })}
        </button>
      )}
    </span>
  )
}
