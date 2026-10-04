import { useLang } from '../lib/i18n.tsx'
import { Toggle } from './ui.tsx'

/**
 * Die linke Hälfte der Zeile über der Datenbank: Zählung, „Staffeln zusammenfassen", „Cartoons ausblenden".
 *
 * Die Zählung trennt die Sorten, sobald beide in der Liste stehen — „17.856 Anime mit belegter deutscher Synchro"
 * wäre für 15.103 davon falsch (13.08.2026). Fasst die Ansicht Staffeln zusammen, zählt `treffer` die Kacheln:
 * die Zahl davor zählt Titel und bliebe sonst unverändert (Daniel, 04.10.2026).
 */
export function DbKopfzeile({ zaehl, treffer, grouped, onGroupedChange, cartoonsAus, onCartoonsAusChange }: {
  zaehl: string
  treffer?: number
  grouped: boolean
  onGroupedChange: (next: boolean) => void
  cartoonsAus: boolean
  onCartoonsAusChange: (next: boolean) => void
}) {
  const { t } = useLang()
  return (
    <>
      <span>
        {zaehl}
        {treffer !== undefined && ` · ${t('db.treffer', { count: treffer.toLocaleString('de-DE') })}`}
      </span>
      <Toggle checked={grouped} onChange={onGroupedChange} label={t('db.groupSeasons')} hint={t('db.groupSeasonsHint')} />
      <Toggle checked={cartoonsAus} onChange={onCartoonsAusChange} label={t('db.cartoonsAus')} hint={t('db.cartoonsAusHinweis')} />
    </>
  )
}
