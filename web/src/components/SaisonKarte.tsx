import { PLATFORMS } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import { ANILIST_COVER_BASIS } from '@shared/mappings.ts'
import { ladeTitelBestand, type Dataset } from '../lib/data.ts'
import { coverBild } from '../lib/cover.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { anbieterVon, type SaisonZeile, type Stufe } from '../lib/saison.ts'
import { terminText } from '../lib/saison-termin.ts'
import { useHoverCover } from './kalender/HoverCover.tsx'

/** Die Farbe der Stufe: voll grün = auf Deutsch zu sehen, grüner Rand = bestätigt, violett = angekündigt, grau gestrichelt = unklar. */
const STUFE_FARBE: Record<Stufe, string> = {
  'auf-deutsch': 'border-ak-gut bg-ak-gut text-ak-auf-gut',
  bestaetigt: 'border-ak-gut text-ak-gut-text',
  angekuendigt: 'border-ak-info text-ak-info-text',
  termin: 'border-dashed border-ak-leise text-ak-leise',
  ungeklaert: 'border-dashed border-ak-leise text-ak-leise',
  offen: 'border-dashed border-ak-leise text-ak-leise',
}

export const zeilenName = (z: SaisonZeile): string => (z.titel ? anzeigeName(z.titel) : (z.katalog!.titleDe ?? z.katalog!.titleEn ?? z.katalog!.titleRomaji ?? String(z.id)))

export function SaisonKarte({ z, data, favorit, oeffne, ausblick }: { z: SaisonZeile; data: Dataset; favorit: boolean; oeffne: (id: number) => void; ausblick?: boolean }) {
  const { t } = useLang()
  const name = zeilenName(z)
  const cover = z.titel?.coverImage ?? (z.katalog?.coverImage && !z.katalog.coverImage.startsWith('http') ? ANILIST_COVER_BASIS + z.katalog.coverImage : z.katalog?.coverImage)
  const { zeiger, vorschau } = useHoverCover(cover)
  const anbieter = (z.titel ? anbieterVon(z.titel, data.releasesByTitle.get(z.id)) : (z.katalog?.anbieter ?? [])).map((p) => PLATFORMS[p]?.name ?? p).slice(0, 3)
  const termin = terminText(z, Boolean(ausblick), todayIso().slice(0, 4), t)
  const rand = favorit ? 'border-ak-favorit/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ak-favorit)_30%,transparent)]' : z.erschienen ? 'border-ak-rand hover:border-ak-leise' : 'border-dashed border-ak-rand hover:border-ak-leise'
  /* Ein Titel außerhalb des Kerns liegt in titles.json, ein Katalogtitel hinter dem Schalter: Erst beim Klick wird geholt, was das Panel zum Finden braucht. */
  const klick = async () => {
    if (!z.titel) await ladeTitelBestand(data, z.id)
    oeffne(z.id)
  }
  return (
    <li className="flex">
      {vorschau}
      <button type="button" onClick={() => void klick()} {...zeiger} className={`flex w-full cursor-pointer gap-2.5 rounded-xl border bg-ak-flaeche p-2 text-left transition ${rand}`}>
        {cover ? (
          <img {...coverBild(cover, 60)} alt="" width={60} height={85} loading="lazy" decoding="async" className={`h-[85px] w-[60px] shrink-0 rounded-md object-cover ${z.erschienen ? '' : 'opacity-45 grayscale-[40%]'}`} />
        ) : (
          <span className="h-[85px] w-[60px] shrink-0 rounded-md bg-ak-flaeche-2" />
        )}
        <span className="flex min-w-0 flex-col gap-1.5">
          <b className="line-clamp-2 text-sm leading-snug">{name}</b>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full border px-2 py-px font-bold ${STUFE_FARBE[z.stufe]}`}>{t(`saison.stufe.${z.stufe}` as TranslationKey)}</span>
          </span>
          {termin && <span className="text-xs text-ak-leise">{termin}</span>}
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
