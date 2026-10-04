import { useState } from 'react'
import type { NewsBeleg } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'
import { BelegKnopf } from './beleg-dialog.tsx'

/** Crunchyrolls News-Rubriken aus dem Pfad — „Crunchyroll News" dreimal sagte nicht, was dahinter steht. */
const RUBRIKEN: Record<string, string> = { 'seasonal-lineup': 'Season-Lineup', latest: 'News' }

/** Anzeigename eines Belegs: bei Crunchyroll-News die Rubrik aus dem Pfad (der Verlag steht im Tooltip), sonst der Verlag. */
export function quellenLabel(b: NewsBeleg): string {
  const rubrik = /crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/([a-z-]+)\//i.exec(b.url)?.[1]
  if (!rubrik) return b.name
  return RUBRIKEN[rubrik] ?? rubrik.replace(/-/g, ' ')
}

/** Der Tag, an dem die Quelle es sagte — oder an dem wir selbst nachsahen. Ohne beides nur der Name. */
function belegTitel(b: NewsBeleg, t: ReturnType<typeof useLang>['t']): string {
  if (b.gemessenAm) return t('news.quelleGemessen', { name: b.name, datum: datumKurz(b.gemessenAm) })
  if (b.ausgabeAm) return t('news.quelleAusgabe', { name: b.name, datum: datumKurz(b.ausgabeAm) })
  if (b.veroeffentlichtAm && b.aktualisiertAm)
    return t('news.quelleAktualisiert', { name: b.name, datum: datumKurz(b.veroeffentlichtAm), aktualisiert: datumKurz(b.aktualisiertAm) })
  if (b.veroeffentlichtAm) return t('news.quelleVeroeffentlicht', { name: b.name, datum: datumKurz(b.veroeffentlichtAm) })
  return b.name
}

/** Wie viele Quellen ohne Aufklappen in der Kopfzeile stehen. */
const SICHTBAR = 3

/**
 * **Die Quellen stehen in der Kopfzeile des Eintrags**, rechts neben Datum und Art — der Text darunter
 * hat so die volle Breite des Panels (Daniel, 03.10.2026: Datums- und Quellenspalte nahmen dem Text den
 * Platz). Mehr als drei klappen hinter „+N weitere Quellen" auf. Gezählt wird nach Dokument — ein
 * aktualisierter Artikel bleibt eine Quelle.
 */
export function QuellenZeile({ belege }: { belege: NewsBeleg[] }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  if (!belege.length) return null
  const gezeigt = offen ? belege : belege.slice(0, SICHTBAR)
  return (
    <span className="ml-auto flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 text-[11px] leading-4">
      {gezeigt.map((b) => (
        <a
          key={b.url}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          title={belegTitel(b, t)}
          className="max-w-[9rem] truncate font-bold text-ak-akzent-text hover:underline"
        >
          {quellenLabel(b)} ↗
        </a>
      ))}
      {gezeigt.map((b) => <BelegKnopf key={`bild-${b.url}`} beleg={b} titel={quellenLabel(b)} />)}
      {!offen && belege.length > SICHTBAR && (
        <button type="button" onClick={() => setOffen(true)} className="text-ak-leise hover:text-ak-text hover:underline">
          {t('news.weitereQuellen', { n: belege.length - SICHTBAR })}
        </button>
      )}
    </span>
  )
}
