import type { Title } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'
import { MosaikHintergrund } from './MosaikHintergrund.tsx'

/** Folie 1: treibendes Cover-Mosaik, darüber die Einladung. */
export function Einleitung({ titel, ids, los }: { titel?: Map<number, Title>; ids: number[]; los: () => void }) {
  const { t } = useLang()
  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden" aria-label={t('view.entdecken')}>
      <MosaikHintergrund titel={titel} ids={ids} />
      <div className="empf-rein relative z-10 m-auto flex max-w-[620px] flex-col items-center gap-4 p-6 text-center">
        <p className="m-0 text-xs uppercase tracking-[0.16em] text-ak-leise">{t('view.entdecken')}</p>
        <h1 className="m-0 text-[clamp(36px,8vw,76px)] font-extrabold leading-[0.98] tracking-tight">{t('empf.einstiegTitel')}</h1>
        <p className="m-0 max-w-[34ch] text-[clamp(16px,2.4vw,21px)]">{t('empf.einstiegText')}</p>
        <button type="button" onClick={los} className="mt-2 min-h-14 rounded-2xl bg-ak-akzent px-8 text-[17px] font-semibold text-ak-auf-akzent">
          {t('empf.los')}
        </button>
        <span className="text-xs text-ak-sehr-leise">{t('empf.imBrowser')}</span>
      </div>
    </section>
  )
}
