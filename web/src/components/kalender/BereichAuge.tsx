import { useLang } from '../../lib/i18n.tsx'
import { TIPPFLAECHE } from '../detail/tippziel.ts'

/** Das Auge am Kopf von „Im Fernsehen" und „Im Handel": für die Tageszeilen der Woche und den Zustand des Filters dahinter. */
export interface Auge {
  /** Offen: der Bereich zeigt seine Einträge (der Filter blendet ihn nicht aus). */
  an: boolean
  umschalten: () => void
}

/**
 * **Auge am Bereichskopf** (Daniel, 05.11.2026): offen = Einträge sichtbar, geschlossen = Filter blendet sie aus;
 * ein Tipp schaltet denselben Filter wie der Chip im Filterfenster. Der Kopf bleibt stehen, damit das Auge erreichbar bleibt.
 * Trefferfläche 44 px (`TIPPFLAECHE`); der Name bleibt gleich, der Zustand steht in `aria-pressed`.
 */
export function BereichAuge({ auge, bereich, klasse }: { auge: Auge; bereich: string; klasse: string }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      aria-pressed={auge.an}
      aria-label={t('kal.augeBereich', { bereich })}
      data-bereich-auge={bereich}
      onClick={auge.umschalten}
      className={`ml-auto inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition ${TIPPFLAECHE} ${klasse}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        {auge.an ? <circle cx="12" cy="12" r="2.7" /> : <path d="M3.5 3.5 20.5 20.5" />}
      </svg>
    </button>
  )
}
