import { PLATFORMS } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { ANILIST_COVER_BASIS } from '@shared/mappings.ts'
import { loadOhneSynchro, type Dataset } from '../lib/data.ts'
import { coverBild } from '../lib/cover.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import type { SaisonZeile, Stufe } from '../lib/saison.ts'

/** Die Farbe der Stufe: voll grün = auf Deutsch zu sehen, grüner Rand = bestätigt, violett = angekündigt, grau gestrichelt = unklar. */
const STUFE_FARBE: Record<Stufe, string> = {
  'auf-deutsch': 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-900',
  bestaetigt: 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300',
  angekuendigt: 'border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300',
  termin: 'border-dashed border-ak-leise text-ak-leise',
  ungeklaert: 'border-dashed border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300',
  offen: 'border-dashed border-ak-leise text-ak-leise',
}

const tag = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`

export function SaisonKarte({ z, data, favorit, oeffne }: { z: SaisonZeile; data: Dataset; favorit: boolean; oeffne: (id: number) => void }) {
  const { t } = useLang()
  const name = z.titel ? anzeigeName(z.titel) : (z.katalog!.titleDe ?? z.katalog!.titleEn ?? z.katalog!.titleRomaji ?? String(z.id))
  const cover = z.titel?.coverImage ?? (z.katalog?.coverImage && !z.katalog.coverImage.startsWith('http') ? ANILIST_COVER_BASIS + z.katalog.coverImage : z.katalog?.coverImage)
  const anbieter = [...new Set((z.titel?.streams ?? []).filter((s) => s.dub === true).map((s) => PLATFORMS[s.platform]?.name ?? s.platform))].slice(0, 3)
  const rand = favorit ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,.3)]' : z.erschienen ? 'border-ak-rand hover:border-ak-leise' : 'border-dashed border-ak-rand hover:border-ak-leise'
  /* Ein Katalogtitel liegt hinter dem Schalter: Erst beim Klick wird die große Datei geholt, damit das Panel ihn kennt. */
  const klick = async () => {
    if (!z.titel) await loadOhneSynchro(data)
    oeffne(z.id)
  }
  return (
    <li className="flex">
      <button type="button" onClick={() => void klick()} className={`flex w-full cursor-pointer gap-2.5 rounded-xl border bg-ak-flaeche p-2 text-left transition ${rand}`}>
        {cover ? (
          <img {...coverBild(cover, 60)} alt="" width={60} height={85} loading="lazy" decoding="async" className={`h-[85px] w-[60px] shrink-0 rounded-md object-cover ${z.erschienen ? '' : 'opacity-60 grayscale-[40%]'}`} />
        ) : (
          <span className="h-[85px] w-[60px] shrink-0 rounded-md bg-ak-flaeche-2" />
        )}
        <span className="flex min-w-0 flex-col gap-1.5">
          <b className="line-clamp-2 text-sm leading-snug">{name}</b>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full border px-2 py-px font-bold ${STUFE_FARBE[z.stufe]}`}>{t(`saison.stufe.${z.stufe}` as TranslationKey)}</span>
          </span>
          <span className="flex flex-col text-xs text-ak-leise">
            {z.jp && <span>{t('saison.jp', { datum: tag(z.jp) })}</span>}
            <span>{z.de ? t(z.erschienen ? 'saison.erschienenAm' : z.geschaetzt ? 'saison.erscheintVoraussichtlich' : 'saison.erscheintAm', { datum: tag(z.de) }) : t('saison.deOffen')}</span>
          </span>
          {anbieter.length > 0 && (
            <span className="flex flex-wrap gap-1 text-xs">
              {anbieter.map((a) => (
                <span key={a} className="rounded-md border border-ak-rand px-1.5">{a}</span>
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
