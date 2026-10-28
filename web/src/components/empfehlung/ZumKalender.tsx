import { useLang } from '../../lib/i18n.tsx'
import { LogoZeichen } from '../kalender/Zeichen.tsx'

/** Oben links auf allen Entdecken-Seiten: zweizeilig, „zurück zum“ über der Wortmarke (pl-8 = Logo 24 px + Lücke 8 px), darunter Logo und Wortmarke wie in der Kopfleiste. */
export function ZumKalender({ aufBild }: { aufBild: boolean }) {
  const { t } = useLang()
  return (
    <a href="#/woche" title={t('empf.zumKalender')} className={`inline-flex min-h-11 flex-col justify-center leading-none no-underline ${aufBild ? 'empf-auf-bild' : 'text-ak-text'}`}>
      <span className={`whitespace-nowrap pl-8 text-center text-xs ${aufBild ? 'max-[480px]:hidden' : 'text-ak-leise'}`}>{t('empf.zurueckZum')}</span>
      <span className="flex items-center gap-2">
        <LogoZeichen className="size-6" />
        <span className="whitespace-nowrap font-display text-base font-bold tracking-[-0.01em]">
          anime<span className="text-ak-akzent">·</span>kalender
        </span>
      </span>
    </a>
  )
}
