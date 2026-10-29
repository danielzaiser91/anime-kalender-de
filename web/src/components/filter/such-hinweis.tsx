import type { Translate } from '../../lib/i18n.tsx'
import type { BereichsSuche } from '../../lib/filter-suche.ts'
import { ecchiSetzen, ecchiZeigen } from '../../lib/ecchi.ts'

/**
 * **Hinweis unter der Filtersuche, wenn kein Bereich passt.** Gehört ans Ende des Filterfensters:
 * die Bereiche davor haben beim Rendern gezählt (`suche.treffer`). „ecchi" führt zum Schalter,
 * weil Ecchi-Titel und -Genre standardmäßig ausgeblendet sind (`ecchi.ts`).
 */
export function SuchHinweis({
  t,
  suche,
  neuLaden = () => location.reload(),
}: {
  t: Translate
  suche?: BereichsSuche
  neuLaden?: () => void
}) {
  if (!suche || suche.treffer() > 0) return null
  const ecchi = suche.query.toLocaleLowerCase('de').includes('ecchi') && !ecchiZeigen()
  return (
    <div role="status" className="flex flex-col items-start gap-2 px-3 py-3 text-xs text-ak-leise">
      <span>{ecchi ? t('filter.sucheEcchi') : t('filter.sucheLeer')}</span>
      {ecchi && (
        <button
          type="button"
          className="rounded-lg border-2 border-ak-text px-3 py-2 text-xs font-semibold text-ak-text"
          onClick={() => {
            ecchiSetzen(true)
            neuLaden()
          }}
        >
          {t('filter.sucheEcchiZeigen')}
        </button>
      )}
    </div>
  )
}
