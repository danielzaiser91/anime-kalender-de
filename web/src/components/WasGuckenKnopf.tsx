import { useLang, type TranslationKey } from '../lib/i18n.tsx'

/** Einstieg in „Was gucken?“ aus der Datenbank; am Handy der einzige, denn die Leiste hat keinen fünften Platz. */
export function WasGuckenKnopf({ navigate }: { navigate: (next: { view: 'empfehlung' }) => void }) {
  const { t } = useLang()
  return (
    <div className="mx-auto flex max-w-[1600px] justify-end px-4 pt-3 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={() => navigate({ view: 'empfehlung' })}
        className="cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche px-4 py-2 text-sm font-semibold text-ak-text transition hover:border-ak-leise"
      >
        {t('empf.zuDatenbankKnopf' as TranslationKey)}
      </button>
    </div>
  )
}
