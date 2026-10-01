import type { NewsBeleg } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'
import { Tooltip } from './ui.tsx'

/**
 * **„Sicherheit der Angaben" — die Belege einer Meldung** (Daniel, 01.10.2026).
 *
 * **Gezählt wird nach Adresse, nicht nach Verlagen** (Daniel am 01.10.2026: „wenn crunchyroll
 * 1 artikel und anime2you 1 artikel, aber crunchyroll artikel wird aktualisiert, zählt es weiter
 * als 1 und nicht 2"). Dieselbe Entscheidung nimmt den Verlagen die zweite Zählweise: Nicht
 * „wer sagt es" wird gemessen, sondern **wie viele Dokumente** dieselbe Aussage tragen — der
 * zweite, unabhängige Artikel ist der Zugewinn, die zweite Lesung desselben Artikels nicht.
 *
 * Erst **ab zwei Belegen** steht die Zeile da: Bei einem sagt sie nichts, was der Quellenlink
 * nicht schon sagt (Projektregel „keine Information zweimal"). Angezeigt wird die Zahl, die
 * einzelnen Dokumente stehen im Tooltip — sonst rauscht es in der Zeile.
 */
export function BelegZeile({ belege, className = '' }: { belege?: NewsBeleg[]; className?: string }) {
  const { t } = useLang()
  if (!belege || belege.length < 2) return null
  const hinweis = belege.map((b) => (b.gelesenAm ? `${b.name} · gelesen ${datumKurz(b.gelesenAm)}` : b.name)).join(' · ')
  return (
    <Tooltip
      text={
        <>
          <span className="font-semibold text-ak-text">{t('news.belegeTitel')}</span>
          <br />
          {hinweis}
        </>
      }
      seite="oben"
      className={className}
    >
      <span className="cursor-help text-[10px] text-ak-leise underline decoration-dotted underline-offset-2">
        {t('news.belege', { n: belege.length })}
      </span>
    </Tooltip>
  )
}
