import { useLang } from '../../lib/i18n.tsx'
import { LogoZeichen } from '../kalender/Zeichen.tsx'

/** Oben links auf allen Entdecken-Seiten: „zurück zum“ plus Wortmarke wie in der Kopfleiste, Link zur Startseite. */
export function ZumKalender({ aufBild }: { aufBild: boolean }) {
  const { t } = useLang()
  return (
    <a href="#/woche" title={t('empf.zumKalender')} className={`inline-flex min-h-11 items-center gap-2 no-underline ${aufBild ? 'empf-auf-bild' : 'text-ak-text'}`}>
      <span className={`whitespace-nowrap text-xs ${aufBild ? 'max-[480px]:hidden' : 'text-ak-leise'}`}>{t('empf.zurueckZum')}</span>
      <LogoZeichen className="size-6" />
      <span className="whitespace-nowrap font-display text-base font-bold tracking-[-0.01em]">
        anime<span className="text-ak-akzent">·</span>kalender
      </span>
    </a>
  )
}
