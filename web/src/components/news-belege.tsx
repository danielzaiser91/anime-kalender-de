import type { NewsBeleg } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'

/**
 * **„Sicherheit der Angaben" — die Belege einer Meldung** (Daniel, 01.10.2026).
 *
 * **Gezählt wird nach Adresse, nicht nach Verlagen** (Daniel am 01.10.2026: „wenn crunchyroll
 * 1 artikel und anime2you 1 artikel, aber crunchyroll artikel wird aktualisiert, zählt es weiter
 * als 1 und nicht 2"). Dieselbe Entscheidung nimmt den Verlagen die zweite Zählweise: Nicht
 * „wer sagt es" wird gemessen, sondern **wie viele Dokumente** dieselbe Aussage tragen.
 *
 * **Und sie werden benannt, mit Link** (Daniel am 02.10.2026 an der Apothekerin: „da steht 3
 * quellen, was ist die 3. quelle? … wir müssen hier alle 3 quellen benennen, direkt am news
 * eintrag inkl link zu den 2 artikeln"). Eine Zahl ohne die Dokumente dahinter lässt sich nicht
 * nachprüfen; vorher standen sie nur im Tooltip. Jetzt steht die Zahl **und** die Liste da.
 *
 * **Noch nicht gebaut — der zweite Teil seiner Ansage:** Eine **Aktualisierung** desselben Artikels
 * zählt nicht als neue Quelle, **bestätigt** sie aber; das soll sichtbar werden, aber „nicht durch
 * quellen zähler, sondern separiert als zuversicht der news zähler". Dafür braucht es die
 * **Lesungen** (Quelle → Lesung → Snapshot, Stufe 4 des Datenbank-Plans): Solange alle Lesungen
 * dasselbe `gesehenAm` tragen, wäre „zuletzt aktualisiert" geraten.
 */
export function BelegZeile({ belege, className = '' }: { belege?: NewsBeleg[]; className?: string }) {
  const { t } = useLang()
  if (!belege || belege.length < 1) return null
  return (
    <span className={`flex flex-wrap items-center gap-x-1.5 text-[10px] leading-tight text-ak-leise ${className}`}>
      <span>{belege.length === 1 ? t('news.belegeEins') : t('news.belege', { n: belege.length })}</span>
      {belege.map((b) => (
        <a
          key={b.url}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          title={b.gelesenAm ? `${b.name} · gelesen ${datumKurz(b.gelesenAm)}` : b.name}
          className="underline decoration-dotted underline-offset-2 hover:text-ak-text"
        >
          {b.name}
        </a>
      ))}
    </span>
  )
}
