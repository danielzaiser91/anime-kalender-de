import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import { ANILIST_COVER_BASIS } from '@shared/mappings.ts'
import { loadJson, loadOhneSynchro, type Dataset } from '../lib/data.ts'
import { coverBild } from '../lib/cover.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { saisonText, saisonVon, versetzt, zeilenDerSaison, type SaisonDatei, type SaisonZeile, type Stufe } from '../lib/saison.ts'

type Reiter = 'jetzt' | 'zuletzt' | 'ausblick'
const REITER = { jetzt: 'saison.reiterJetzt', zuletzt: 'saison.reiterZuletzt', ausblick: 'saison.reiterAusblick' } as const
const HINWEIS = { jetzt: 'saison.hinweisJetzt', zuletzt: 'saison.hinweisZuletzt', ausblick: 'saison.hinweisAusblick' } as const

/** Die Farbe der Stufe: voll grün = auf Deutsch zu sehen, grüner Rand = bestätigt, violett = angekündigt, grau gestrichelt = unklar. */
const STUFE_FARBE: Record<Stufe, string> = {
  'auf-deutsch': 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-900',
  bestaetigt: 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300',
  angekuendigt: 'border-violet-500 text-violet-700 dark:border-violet-400 dark:text-violet-300',
  termin: 'border-dashed border-ak-leise text-ak-leise',
  ungeklaert: 'border-dashed border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300',
  offen: 'border-dashed border-ak-leise text-ak-leise',
}

/**
 * **Der Saison-Überblick** (Daniel, 07.10.2026, Anordnung 2 mit Reitern): aktuelle, letzte und nächste Anime-Saison in einer Ansicht — was davon auf Deutsch zu sehen ist,
 * ab wann, und wo. Gerechnet wird im Browser aus den Titeln mit Termin (`data.titles`) und der kleinen Datei `saison.json`. Schon Erschienenes steht getrennt von dem, was noch kommt.
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
  const erschienen = zeilen.filter((z) => z.erschienen)
  const kommt = zeilen.filter((z) => !z.erschienen)
  const gruppe = (titel: TranslationKey | undefined, liste: SaisonZeile[]) =>
    liste.length > 0 && (
      <div className="mt-4">
        {titel && <h2 className="mb-2 text-sm font-bold text-ak-leise">{t(titel)} <span className="font-normal">· {liste.length}</span></h2>}
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {liste.map((z) => (
            <SaisonKarte key={z.id} z={z} data={data} favorit={favorites.has(z.id)} oeffne={oeffne} />
          ))}
        </ul>
      </div>
    )
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
      {zeilen.length === 0 && <p className="mt-6 rounded-lg border border-dashed border-ak-rand p-4 text-sm text-ak-leise">{t('saison.leer', { saison: saisonText(saisons[reiter]) })}</p>}
      {gruppe(kommt.length > 0 && erschienen.length > 0 ? 'saison.erschienen' : undefined, erschienen)}
      {gruppe(erschienen.length > 0 ? 'saison.kommt' : undefined, kommt)}
    </section>
  )
}

const tag = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`

function SaisonKarte({ z, data, favorit, oeffne }: { z: SaisonZeile; data: Dataset; favorit: boolean; oeffne: (id: number) => void }) {
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
    <li>
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
