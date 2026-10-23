import { PLATFORMS, type ReleaseEvent } from '@shared/types.ts'
import type { Zweitanbieter } from '@shared/zweitanbieter.ts'
import { formatDate } from '@shared/time.ts'
import type { Dataset } from '../../lib/data.ts'
import { coverBild } from '../../lib/cover.ts'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import { nurFolge } from './Marken.tsx'
import { useHoverCover } from './HoverCover.tsx'

type ZweitTermin = ReleaseEvent & { zweitanbieter: Zweitanbieter }

/** Tooltip der Zeile: wer zuerst da war, seit wann; ein Katalogdatum ist nur ein Mindestwert. */
function hinweis(ev: ZweitTermin, t: Translate): string {
  const z = ev.zweitanbieter
  const werte = { erster: PLATFORMS[z.erster].name, datum: formatDate(z.seit), anbieter: PLATFORMS[ev.platform].name }
  return t(z.mindestens ? 'kal.zweitHinweisKatalog' : 'kal.zweitHinweis', werte)
}

/** Eine Zeile; eigener Baustein, weil jede Zeile ihre eigene Cover-Vorschau (nur Maus, wie Handel und Fernsehen) hält. */
function ZweitZeile({
  ev,
  data,
  versteckt,
  vorbei,
  onOpen,
}: {
  ev: ZweitTermin
  data: Dataset
  versteckt: boolean
  vorbei: boolean
  onOpen: (slug: string, date: string) => void
}) {
  const { t } = useLang()
  const cover = data.titleById.get(ev.titleId)?.coverImage
  const { zeiger, vorschau } = useHoverCover(versteckt ? undefined : cover)
  const anbieter = PLATFORMS[ev.platform].name
  return (
    <li className={vorbei ? 'ak-vorbei' : ''} {...zeiger}>
      {versteckt ? (
        <span className="block px-2 py-1 text-[13px] text-ak-sehr-leise italic">{ev.name}</span>
      ) : (
        <button
          type="button"
          title={hinweis(ev, t)}
          onClick={() => onOpen(ev.releaseSlug, ev.date)}
          className="grid min-h-11 w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 rounded-xl border border-ak-linie bg-ak-flaeche px-2 py-1.5 text-left transition hover:bg-ak-flaeche-2"
        >
          <span className="relative h-[42px] w-7 overflow-hidden rounded-[5px] bg-ak-flaeche-2">
            {cover && <img {...coverBild(cover, 28)} alt="" loading="lazy" className="size-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: PLATFORMS[ev.platform].color }} />
          </span>
          <span className="flex min-w-0 flex-col text-xs text-ak-leise">
            <span className="truncate">
              <b className="text-[13px] font-bold text-ak-text">{ev.name}</b>
              {nurFolge(ev, t) && ` · ${nurFolge(ev, t)}`}
            </span>
            <span>{t('kal.zweitSatz', { anbieter, erster: PLATFORMS[ev.zweitanbieter.erster].name })}</span>
          </span>
        </button>
      )}
      {vorschau}
    </li>
  )
}

/**
 * **Zweitanbieter als schmale Zeile unter dem Raster** (Daniels Wahl B, 11.10.2026): Dieselbe Folge lief bei einem anderen
 * Streaming-Anbieter mindestens eine Woche früher (`shared/zweitanbieter.ts`). Das Raster zeigt nur den Ersten;
 * wer die Folge heute bei seinem Anbieter bekommt, findet sie hier mit dem Hinweis, wo sie zuerst erschien.
 */
export function ZweitanbieterZeilen({
  termine,
  data,
  hidden,
  vorbeiBis,
  onOpen,
}: {
  termine: ReleaseEvent[]
  data: Dataset
  hidden: Set<number>
  /** Uhrzeit, bis zu der heute alles vorbei ist; an anderen Tagen leer. */
  vorbeiBis?: string
  onOpen: (slug: string, date: string) => void
}) {
  const liste = termine.filter((ev): ev is ZweitTermin => !!ev.zweitanbieter)
  if (!liste.length) return null
  return (
    <ul data-zweitanbieter className="flex flex-col gap-1">
      {liste.map((ev) => (
        <ZweitZeile key={ev.id} ev={ev} data={data} versteckt={hidden.has(ev.titleId)} vorbei={!!vorbeiBis && !!ev.time && ev.time < vorbeiBis} onOpen={onOpen} />
      ))}
    </ul>
  )
}
