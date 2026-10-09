import { useEffect, useMemo, useState } from 'react'
import { todayIso } from '@shared/time.ts'
import { loadJson, type Dataset } from '../lib/data.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { saisonText, saisonVon, versetzt, zeilenDerSaison, type SaisonDatei, type SaisonZeile } from '../lib/saison.ts'
import { SaisonKarte } from './SaisonKarte.tsx'

type Reiter = 'jetzt' | 'zuletzt' | 'ausblick'
const REITER = { jetzt: 'saison.reiterJetzt', zuletzt: 'saison.reiterZuletzt', ausblick: 'saison.reiterAusblick' } as const
const HINWEIS = { jetzt: 'saison.hinweisJetzt', zuletzt: 'saison.hinweisZuletzt', ausblick: 'saison.hinweisAusblick' } as const

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
    () => zeilenDerSaison(data.titles, data.releasesByTitle, saisons[reiter], datei),
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
