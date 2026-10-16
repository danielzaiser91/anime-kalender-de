import type { ReactNode } from 'react'
import type { Title } from '@shared/types.ts'
import { Tooltip } from '../ui.tsx'
import { verweiseFuer, type Verweis } from './verweise.ts'
import type { Translate } from '../../lib/i18n.tsx'

const FLAGGE =
  'inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-l-[10px] bg-[rgba(8,12,18,.78)] pl-3.5 pr-3 text-t4 font-semibold text-white'

/** Die Wertung mit Komma: aus 85 Prozent wird „8,5“. */
export function wertungText(score: number): string {
  return (score / 10).toFixed(1).replace('.', ',')
}

/** Der Pfeil sagt „führt hinaus“ — ohne ihn liest sich das Wort als Quellenangabe. */
function Pfeil() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 opacity-80" fill="none" aria-hidden="true">
      <path d="M4 2h6v6M10 2 2.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Flagge({ name, wertung, verweis, hinweis }: { name: string; wertung?: string; verweis?: Verweis; hinweis: ReactNode }) {
  const inhalt = (
    <>
      {name}
      {wertung && <span className="text-[#f5c542]" aria-hidden="true">★</span>}
      {wertung && <span className="tabular-nums">{wertung}</span>}
      {verweis && <Pfeil />}
    </>
  )
  return (
    <Tooltip text={hinweis} eigenerFokus={Boolean(verweis)} className="shrink-0">
      {verweis ? (
        <a href={verweis.ziel} target="_blank" rel="noreferrer noopener" className={FLAGGE}>
          {inhalt}
        </a>
      ) : (
        <span className={FLAGGE}>{inhalt}</span>
      )}
    </Tooltip>
  )
}

/**
 * **Zwei Flaggen an der rechten Bildkante** (Daniel, 12.10.2026): Wertung und Absprung zur Quelle sind eine Flagge, weil die Wertung von
 * dort stammt („aniSearch ★ 8,5 ↗“, bei Cartoons „TMDB ★ 7,2 ↗“); MAL ist die zweite. Ohne Kennung entfällt der Absprung (`verweise.ts`),
 * ohne Wertung steht kein Stern. Direktlinks auf die Titelseite, nie eine Suche. `z-[11]`: der Namensblock darunter (`z-10`) ragt 72 px in das Banner und
 * risse sonst die untere Flagge an sich (16.10.2026); `panel-messen.mjs` prüft, dass jeder Link an seiner Mitte oben liegt.
 */
export function Flaggen({ title, ziel, t }: { title: Title; ziel?: string; t: Translate }) {
  const verweise = verweiseFuer(title, ziel)
  const quelle = verweise.find((v) => v.name !== 'MAL')
  const mal = verweise.find((v) => v.name === 'MAL')
  const quellenName = quelle?.name ?? (title.scoreQuelle === 'tmdb' ? 'TMDB' : 'aniSearch')
  const wertung = title.score === undefined ? undefined : wertungText(title.score)
  const quelleHinweis = [quelle?.hinweis, wertung ? t('detail.scoreHint', { quelle: quellenName }) : undefined].filter(Boolean).join(' — ')
  if (!quelle && !wertung && !mal) return null
  return (
    <div data-flaggen className="absolute bottom-6 right-0 z-[11] flex flex-col items-end gap-1">
      {(quelle || wertung) && <Flagge name={quellenName} wertung={wertung} verweis={quelle} hinweis={quelleHinweis} />}
      {mal && <Flagge name="MAL" verweis={mal} hinweis={mal.hinweis} />}
    </div>
  )
}
