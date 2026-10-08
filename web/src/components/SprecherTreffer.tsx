import { useEffect, useState } from 'react'
import type { SprecherGruppe, SprecherIndex } from '@shared/sprecher.ts'
import { annUrl } from '@shared/ann.ts'
import { anzeigeName } from '@shared/titles.ts'
import { formatDate } from '@shared/time.ts'
import { loadAllTitles, type Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { ladeSprecherGruppe, ladeSprecherIndex, sucheSprecher, titelVon, type SprecherTreffer as Treffer } from '../lib/sprecher.ts'

/**
 * Vorschau `sprecher-suche`: Die Gruppe „Sprecher" über den Suchergebnissen (eigener Chunk, geladen erst bei einer
 * Suche ab drei Zeichen). Je Sprecher eine Zeile mit Titelzahl; aufgeklappt die Titel mit Rolle, jeder ein Sprung ins
 * Panel. Genau ein Treffer mit vollem Namen (Sprung aus dem Panel) klappt von selbst auf.
 */
export function SprecherTreffer({ suche, data, onOpen }: { suche: string; data: Dataset; onOpen: (id: number) => void }) {
  const { t } = useLang()
  const [index, setIndex] = useState<SprecherIndex | 'fehler'>()
  const [offen, setOffen] = useState<string>()

  useEffect(() => {
    let verworfen = false
    ladeSprecherIndex()
      .then((i) => !verworfen && setIndex(i))
      .catch(() => !verworfen && setIndex('fehler'))
    return () => {
      verworfen = true
    }
  }, [])

  const ergebnis = index && index !== 'fehler' ? sucheSprecher(index, suche) : undefined
  const einziger = ergebnis?.treffer.length === 1 && ergebnis.treffer[0]!.guete === 0 ? ergebnis.treffer[0]!.name : undefined
  /* Der eine volle Treffer klappt auf; bei einer neuen Suche klappt zu, was nicht mehr in der Liste steht. */
  useEffect(() => {
    setOffen((o) => (einziger ? einziger : ergebnis?.treffer.some((s) => s.name === o) ? o : undefined))
  }, [einziger, ergebnis?.treffer])

  if (index === 'fehler') return <p role="status" className="text-sm text-ak-leise">{t('sprecher.fehler')}</p>
  if (!index || !ergebnis) return <p role="status" className="text-sm text-ak-leise">{t('sprecher.laedt')}</p>
  const n = ergebnis.treffer.length
  return (
    <section aria-labelledby="sprecher-treffer" className="rounded-2xl border border-ak-rand bg-ak-flaeche px-4 py-3">
      <h2 id="sprecher-treffer" className="text-xs font-bold uppercase tracking-wide text-ak-leise">
        {t('sprecher.titel')}
      </h2>
      <p role="status" className="mt-0.5 text-sm text-ak-leise">
        {n === 0 ? t('sprecher.keine', { suche }) : n === 1 ? t('sprecher.gefunden1') : t('sprecher.gefundenN', { n })}
        {ergebnis.weitere > 0 && ` · ${t('sprecher.weitere', { n: ergebnis.weitere })}`}
      </p>
      {n > 0 && (
        <ul className="mt-1 divide-y divide-ak-linie">
          {ergebnis.treffer.map((s) => (
            <SprecherZeile key={s.name} s={s} offen={offen === s.name} umschalten={() => setOffen((o) => (o === s.name ? undefined : s.name))} data={data} onOpen={onOpen} />
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ak-leise">{t('sprecher.quelle', { stand: formatDate(index.stand) })}</p>
    </section>
  )
}

function SprecherZeile({ s, offen, umschalten, data, onOpen }: { s: Treffer; offen: boolean; umschalten: () => void; data: Dataset; onOpen: (id: number) => void }) {
  const { t } = useLang()
  const kennung = `sprecher-${s.gruppe}-${s.name.replace(/\W+/g, '-')}`
  return (
    <li>
      <button
        type="button"
        onClick={umschalten}
        aria-expanded={offen}
        aria-controls={kennung}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left text-sm text-ak-text hover:text-ak-akzent-text"
      >
        <span aria-hidden className={`transition-transform ${offen ? 'rotate-90' : ''}`}>›</span>
        <span className="font-semibold">{s.name}</span>
        <span className="text-ak-leise">{s.titel === 1 ? t('sprecher.titel1') : t('sprecher.titelN', { n: s.titel })}</span>
      </button>
      {offen && <TitelListe kennung={kennung} s={s} data={data} onOpen={onOpen} />}
    </li>
  )
}

function TitelListe({ kennung, s, data, onOpen }: { kennung: string; s: Treffer; data: Dataset; onOpen: (id: number) => void }) {
  const { t } = useLang()
  const [gruppe, setGruppe] = useState<SprecherGruppe | 'fehler'>()
  useEffect(() => {
    let verworfen = false
    Promise.all([ladeSprecherGruppe(s.gruppe), loadAllTitles(data)])
      .then(([g]) => !verworfen && setGruppe(g))
      .catch(() => !verworfen && setGruppe('fehler'))
    return () => {
      verworfen = true
    }
  }, [s.gruppe, data])
  if (gruppe === 'fehler') return <p id={kennung} className="pb-2 pl-5 text-sm text-ak-leise">{t('sprecher.fehler')}</p>
  if (!gruppe) return <p id={kennung} role="status" className="pb-2 pl-5 text-sm text-ak-leise">{t('sprecher.laedt')}</p>
  return (
    <ul id={kennung} className="pb-2 pl-5">
      {titelVon(gruppe, s.name).map((eintrag) => {
        const titel = data.titleById.get(eintrag.id)
        return (
          <li key={eintrag.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <button type="button" onClick={() => onOpen(eintrag.id)} className="min-h-11 cursor-pointer text-left font-semibold text-ak-akzent-text hover:underline">
              {titel ? anzeigeName(titel) : `#${eintrag.id}`}
            </button>
            <span className="text-ak-leise">{t('sprecher.als', { rolle: eintrag.rollen.join(', ') })}</span>
            {eintrag.ann && titel?.annId && (
              <a href={annUrl(titel.annId)} target="_blank" rel="noopener noreferrer" className="min-h-11 text-[11px] text-ak-leise underline hover:text-ak-akzent-text" aria-label={`Anime News Network: ${anzeigeName(titel)}`}>
                ANN ↗
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
