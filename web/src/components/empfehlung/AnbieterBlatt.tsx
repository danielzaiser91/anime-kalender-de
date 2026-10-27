import { PLATFORMS, type PlatformId } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'

/** Die Anbieter, die im Pool Synchro-Titel haben, nach Zahl der Einstiege (häufigste zuerst). */
export function poolAnbieter(einstiege: Array<{ p: Array<[string] | [string, string]> }>): string[] {
  const zahl = new Map<string, number>()
  for (const k of einstiege) for (const p of new Set(k.p.map(([a]) => a))) zahl.set(p, (zahl.get(p) ?? 0) + 1)
  return [...zahl].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p)
}

/** Optionales Blatt „Wo guckst du?“: Vorrang für die eigenen Anbieter, kein Filter. Handy: von unten, Rechner: Leiste rechts. */
export function AnbieterBlatt({ offen, zu, alle, gewaehlt, setze }: {
  offen: boolean
  zu: () => void
  alle: string[]
  gewaehlt: string[]
  setze: (anbieter: string[]) => void
}) {
  const { t } = useLang()
  const umschalten = (p: string) => setze(gewaehlt.includes(p) ? gewaehlt.filter((x) => x !== p) : [...gewaehlt, p])
  return (
    <>
      <div onClick={zu} aria-hidden className={`cursor-pointer fixed inset-0 z-[54] bg-ak-grund/60 transition-opacity min-[900px]:hidden ${offen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside
        aria-label={t('empf.anbieterFrage')}
        aria-hidden={!offen}
        inert={!offen}
        className={`empf-blatt fixed z-[55] flex flex-col border border-ak-rand bg-ak-flaeche max-[899px]:inset-x-0 max-[899px]:bottom-0 max-[899px]:max-h-[88vh] max-[899px]:rounded-t-[20px] min-[900px]:bottom-4 min-[900px]:right-4 min-[900px]:top-[92px] min-[900px]:w-[360px] min-[900px]:rounded-[18px] ${offen ? '' : 'max-[899px]:translate-y-full min-[900px]:translate-x-[calc(100%+32px)]'}`}
      >
        <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
          <h2 className="m-0 text-xl leading-tight">{t('empf.anbieterFrage')}</h2>
          <button type="button" onClick={zu} className="min-h-11 rounded-full border border-ak-rand px-3 text-[13px]">{t('empf.fertig')}</button>
        </header>
        <div className="flex flex-col gap-3 overflow-auto px-4 pb-5 pt-1">
          <p className="m-0 text-sm text-ak-leise">{t('empf.anbieterText')}</p>
          <div className="grid grid-cols-2 gap-2">
            {alle.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={gewaehlt.includes(p)}
                onClick={() => umschalten(p)}
                style={{ borderColor: gewaehlt.includes(p) ? PLATFORMS[p as PlatformId]?.color : undefined }}
                className="flex min-h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-ak-rand bg-ak-flaeche px-3 text-left text-sm font-semibold aria-pressed:bg-ak-flaeche-2"
              >
                <i className="h-3 w-3 flex-none rounded-full" style={{ background: PLATFORMS[p as PlatformId]?.color }} />
                {PLATFORMS[p as PlatformId]?.name ?? p}
                {gewaehlt.includes(p) && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setze([])} className="min-h-11 self-end rounded-full px-3 text-[13px] text-ak-leise">{t('empf.anbieterLeeren')}</button>
        </div>
      </aside>
    </>
  )
}
