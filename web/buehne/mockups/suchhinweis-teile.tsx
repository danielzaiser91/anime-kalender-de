import { useEffect, type ComponentProps } from 'react'
import { DbLeer as EchtesLeer, DbRaster as EchtesRaster } from '../../src/components/db-bedienung.tsx'
import { DbKopfbereich as EchterKopf } from '../../src/components/filter/DbWerkzeug.tsx'
import { EMPTY_FILTERS } from '../../src/lib/filters.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { merkeStand, useHinweisStand, useZusatzTreffer } from './suchhinweis-daten.ts'
import { hinweisText } from './suchhinweis-zaehlen.ts'

type Form = 'zeile' | 'karte' | 'leer'

const HUELLE: Record<Form, string> = {
  zeile: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ak-text',
  karte: 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-ak-rand px-4 py-2 text-sm text-ak-text',
  leer: 'flex flex-col items-center gap-2 text-sm text-ak-text',
}

const KNOPF = 'min-h-11 shrink-0 cursor-pointer rounded-full border border-ak-rand px-4 text-sm font-semibold text-ak-akzent-text transition hover:bg-ak-flaeche-2'

/** Der Hinweis selbst: Zahl, Knopf, der den Schalter einschaltet. `zeile` ist Fließtext, `karte` eine gestrichelte Reihe am Listenende. */
function Hinweis({ text, einschalten, form }: { text: string; einschalten: () => void; form: Form }) {
  return (
    <div role="status" data-suchhinweis={form} className={HUELLE[form]}>
      <span>{text}</span>
      <button type="button" onClick={einschalten} className={KNOPF}>
        Anzeigen
      </button>
    </div>
  )
}

/** Der Hinweis zum Stand der Datenbank (Suche, Filter, Schalter); ohne Zusatztreffer oder bei eingeschaltetem Schalter nichts. */
function HinweisZumStand({ form, ohneLeereListe }: { form: Form; ohneLeereListe?: boolean }) {
  const stand = useHinweisStand()
  const treffer = useZusatzTreffer(stand?.suche ?? '', stand?.filters ?? EMPTY_FILTERS)
  if (!stand || stand.ohneSynchro || !treffer || treffer.gesamt === 0) return null
  if (ohneLeereListe && stand.ergebnisse === 0) return null
  return <Hinweis text={hinweisText(treffer)} einschalten={() => stand.einschalten(true)} form={form} />
}

/** Trägt den Stand des Kopfes ein, damit Raster und Leer-Anzeige ihn kennen. */
function useStandMerken(p: ComponentProps<typeof EchterKopf>): void {
  useEffect(() => {
    merkeStand({ suche: p.suche, filters: p.filters, ohneSynchro: p.ohneSynchro, ergebnisse: p.ergebnisse, einschalten: p.onOhneSynchroChange })
  })
}

/** Variante A: Textzeile mit Knopf direkt unter der Trefferzahl. */
export function KopfMitZeile(p: ComponentProps<typeof EchterKopf>) {
  useStandMerken(p)
  return (
    <>
      <EchterKopf {...p} />
      <HinweisZumStand form="zeile" ohneLeereListe />
    </>
  )
}

/** Variante B (Kopf): unverändert, trägt nur den Stand ein. */
export function KopfOhneHinweis(p: ComponentProps<typeof EchterKopf>) {
  useStandMerken(p)
  return <EchterKopf {...p} />
}

/** Variante B (Liste): das echte Raster, als letzte Zeile der Liste der Hinweis. */
export function RasterMitHinweis(p: ComponentProps<typeof EchtesRaster>) {
  return (
    <div className="flex flex-col gap-3">
      <EchtesRaster {...p} />
      <HinweisZumStand form="karte" ohneLeereListe />
    </div>
  )
}

/** Keine Treffer mit Synchro: statt des allgemeinen Knopfs („Auch Anime ohne deutsche Synchro zeigen“) die Zahl, die er bringt. */
export function LeerMitZahl(p: ComponentProps<typeof EchtesLeer>) {
  const { t } = useLang()
  const stand = useHinweisStand()
  const treffer = useZusatzTreffer(stand?.suche ?? '', stand?.filters ?? EMPTY_FILTERS)
  if (p.ohneSynchro || !treffer || treffer.gesamt === 0) return <EchtesLeer {...p} />
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-ak-rand px-6 py-10 text-center">
      <p className="text-sm text-ak-leise">{t('db.leerTipps')}</p>
      <Hinweis text={hinweisText(treffer)} einschalten={p.onOhneSynchro} form="leer" />
    </div>
  )
}
