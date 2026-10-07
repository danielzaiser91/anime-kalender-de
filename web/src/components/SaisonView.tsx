import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import { ANILIST_COVER_BASIS } from '@shared/mappings.ts'
import { loadJson, loadOhneSynchro, type Dataset } from '../lib/data.ts'
import { coverBild } from '../lib/cover.ts'
import { useLang } from '../lib/i18n.tsx'
import { saisonText, saisonVon, versetzt, zeilenDerSaison, type SaisonDatei, type SaisonZeile } from '../lib/saison.ts'

type Reiter = 'jetzt' | 'zuletzt' | 'ausblick'
const REITER = { jetzt: 'saison.reiterJetzt', zuletzt: 'saison.reiterZuletzt', ausblick: 'saison.reiterAusblick' } as const
const HINWEIS = { jetzt: 'saison.hinweisJetzt', zuletzt: 'saison.hinweisZuletzt', ausblick: 'saison.hinweisAusblick' } as const

/**
 * **Der Saison-Überblick** (Daniel, 07.10.2026, Anordnung 2 mit Reitern): aktuelle, letzte und nächste Anime-Saison in einer Ansicht — was davon auf Deutsch zu sehen ist,
 * ab wann, und wo. Gerechnet wird im Browser aus den Titeln mit Termin (`data.titles`); es gibt keine zusätzliche Datei.
 */
export function SaisonView({ data, favorites, oeffne }: { data: Dataset; favorites: Set<number>; oeffne: (id: number) => void }) {
  const { t } = useLang()
  const heute = saisonVon(todayIso())
  const saisons = { jetzt: heute, zuletzt: versetzt(heute, -1), ausblick: versetzt(heute, 1) }
  const [reiter, setReiter] = useState<Reiter>('jetzt')
  const [datei, setDatei] = useState<SaisonDatei>()
  useEffect(() => {
    let aktiv = true
    void loadJson<SaisonDatei>('saison.json').then((d) => aktiv && setDatei(d)).catch(() => undefined)
    return () => {
      aktiv = false
    }
  }, [])
  const zeilen = useMemo(
    () => zeilenDerSaison(data.titles, data.releasesByTitle, saisons[reiter], datei, reiter === 'ausblick'),
    [data, datei, reiter, heute.jahr, heute.saison], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const deutsch = zeilen.filter((z) => z.deutsch).length
  return (
    <section aria-labelledby="saison-titel" className="mx-auto max-w-6xl px-4 py-5">
      <h1 id="saison-titel" className="text-xl font-extrabold">{t('view.saison')}</h1>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2">
        {(['jetzt', 'zuletzt', 'ausblick'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === reiter}
            onClick={() => setReiter(r)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${r === reiter ? 'border-ak-akzent text-ak-text' : 'border-ak-rand text-ak-text hover:border-ak-leise'}`}
          >
            <span className="font-extrabold">{t(REITER[r])}</span>
            <span className="ml-1.5 font-normal text-ak-leise">{saisonText(saisons[r])}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ak-leise">{t(zeilen.length === 1 && reiter !== 'ausblick' ? 'saison.hinweisEins' : HINWEIS[reiter], { n: zeilen.length, de: deutsch })}</p>
      {zeilen.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-ak-rand p-4 text-sm text-ak-leise">{t('saison.leer', { saison: saisonText(saisons[reiter]) })}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {zeilen.map((z) => (
            <SaisonKarte key={z.id} z={z} data={data} favorit={favorites.has(z.id)} oeffne={oeffne} />
          ))}
        </ul>
      )}
    </section>
  )
}

const tag = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`

function SaisonKarte({ z, data, favorit, oeffne }: { z: SaisonZeile; data: Dataset; favorit: boolean; oeffne: (id: number) => void }) {
  const { t } = useLang()
  const name = z.titel ? anzeigeName(z.titel) : (z.katalog!.titleDe ?? z.katalog!.titleEn ?? z.katalog!.titleRomaji ?? String(z.id))
  const cover = z.titel?.coverImage ?? (z.katalog?.coverImage && !z.katalog.coverImage.startsWith('http') ? ANILIST_COVER_BASIS + z.katalog.coverImage : z.katalog?.coverImage)
  const anbieter = [...new Set((z.titel?.streams ?? []).filter((s) => s.dub === true).map((s) => PLATFORMS[s.platform]?.name ?? s.platform))].slice(0, 3)
  /* Ein Katalogtitel liegt hinter dem Schalter: Erst beim Klick wird die große Datei geholt, damit das Panel ihn kennt. */
  const klick = async () => {
    if (!z.titel) await loadOhneSynchro(data)
    oeffne(z.id)
  }
  return (
    <li>
      <button type="button" onClick={() => void klick()} className={`flex w-full cursor-pointer gap-2.5 rounded-xl border bg-ak-flaeche p-2 text-left transition ${favorit ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,.3)]' : 'border-ak-rand hover:border-ak-leise'}`}>
        {cover ? (
          <img {...coverBild(cover, 60)} alt="" width={60} height={85} loading="lazy" decoding="async" className="h-[85px] w-[60px] shrink-0 rounded-md object-cover" />
        ) : (
          <span className="h-[85px] w-[60px] shrink-0 rounded-md bg-ak-flaeche-2" />
        )}
        <span className="flex min-w-0 flex-col gap-1.5">
          <b className="line-clamp-2 text-sm leading-snug">{name}</b>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full border px-2 py-px font-bold ${z.deutsch ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300' : 'border-dashed border-ak-leise text-ak-leise'}`}>
              {z.deutsch ? t('saison.deutsch') : t('saison.offen')}
            </span>
          </span>
          <span className="flex flex-col text-xs text-ak-leise">
            {z.jp && <span>{t('saison.jp', { datum: tag(z.jp) })}</span>}
            <span>{z.de ? t(z.geschaetzt ? 'saison.deGeschaetzt' : 'saison.de', { datum: tag(z.de) }) : t('saison.deOffen')}</span>
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
