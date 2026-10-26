import { useEffect, type ComponentProps } from 'react'
import { DbKopfzeile as EchteKopfzeile } from '../../src/components/db-kopfzeile.tsx'
import { DbKopfbereich as EchterKopf } from '../../src/components/filter/DbWerkzeug.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { useMobil } from '../../src/lib/use-mobil.ts'
import { leseStand, merkeStand, useHinweisStand, useSuchhinweis, type HinweisStand, type Suchhinweis } from './suchhinweis-daten.ts'
import { loeseBlockade } from './suchhinweis-filter.ts'
import { einheitName } from './suchhinweis-namen.ts'
import { blockadeText, zusatzText } from './suchhinweis-zaehlen.ts'

type Form = 'zeile' | 'darunter'

const HUELLE: Record<Form, string> = {
  zeile: 'inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ak-text',
  darunter: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ak-text',
}

const KNOPF = 'min-h-11 shrink-0 cursor-pointer rounded-full border border-ak-rand px-4 text-sm font-semibold text-ak-akzent-text transition hover:bg-ak-flaeche-2'

/** Was der Knopf tut: gibt es Filter, die den exakten Treffer verstecken, geht er genau diese an (und schaltet bei Bedarf den Synchro-Schalter ein), sonst schaltet er nur den Schalter ein. */
function loese(stand: HinweisStand, hinweis: Suchhinweis): void {
  const b = hinweis.blockade
  if (b && b.einheiten.length > 0) stand.filterAendern(loeseBlockade(stand.filters, b))
  /* Der Schalter und die Filter schreiben je die ganze Adresse aus dem Stand ihres Aufrufs; der zweite Schritt wartet auf den ersten (die echte Umsetzung braucht einen gemeinsamen Adresswechsel). */
  if (!b || b.synchro || b.einheiten.length === 0) setTimeout(() => leseStand()?.einschalten(true), 0)
}

/** Der Hinweis zum Stand der Datenbank (Suche, Filter, Schalter); ohne etwas zu sagen nichts. */
function HinweisZumStand({ form }: { form: Form }) {
  const { tGenre } = useLang()
  const stand = useHinweisStand()
  const hinweis = useSuchhinweis(stand)
  if (!stand || !hinweis) return null
  const zusatz = !stand.ohneSynchro && hinweis.zusatz.gesamt > 0
  const b = hinweis.blockade
  const versteckt = b && b.einheiten.length > 0
  if (!zusatz && !versteckt) return null
  const filter = b ? [...b.einheiten.map((e) => einheitName(e, stand.filters, tGenre)), ...(b.synchro ? ['ohne deutsche Synchro'] : [])] : []
  const saetze = [...(zusatz ? [zusatzText(hinweis.zusatz)] : []), ...(b && versteckt ? [blockadeText(anzeigeName(b.titel), filter)] : [])]
  return (
    <span role="status" data-suchhinweis={form} className={HUELLE[form]}>
      <span>{saetze.join(' · ')}</span>
      <button type="button" onClick={() => loese(stand, hinweis)} className={KNOPF}>
        {versteckt ? 'Filter entfernen' : 'Anzeigen'}
      </button>
    </span>
  )
}

/** Trägt den Stand des Kopfes ein, damit Zählzeile und Hinweis ihn kennen. */
function useStandMerken(p: ComponentProps<typeof EchterKopf>): void {
  useEffect(() => {
    merkeStand({ suche: p.suche, filters: p.filters, ohneSynchro: p.ohneSynchro, ergebnisse: p.ergebnisse, einschalten: p.onOhneSynchroChange, filterAendern: p.onFiltersChange })
  })
}

/**
 * Variante A (Kopf): trägt den Stand ein; am Rechner steht der Hinweis in der Zählzeile. Am Handy liegt die Zählzeile
 * in der Leiste am unteren Rand, die für einen Hinweis zu schmal ist — dort steht er wie in B darunter.
 */
export function KopfOhneHinweis(p: ComponentProps<typeof EchterKopf>) {
  useStandMerken(p)
  const mobil = useMobil()
  return (
    <>
      <EchterKopf {...p} />
      {mobil && <HinweisZumStand form="darunter" />}
    </>
  )
}

/** Variante A (Zählzeile, Rechner): „0 Ergebnisse für …“ und der Hinweis in derselben Zeile. */
export function KopfzeileMitHinweis(p: ComponentProps<typeof EchteKopfzeile>) {
  if (p.zweizeilig) return <EchteKopfzeile {...p} />
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <EchteKopfzeile {...p} />
      <HinweisZumStand form="zeile" />
    </span>
  )
}

/** Variante B: Hinweis als Zeile direkt unter dem Kopf mit der Zählzeile. */
export function KopfMitZeile(p: ComponentProps<typeof EchterKopf>) {
  useStandMerken(p)
  return (
    <>
      <EchterKopf {...p} />
      <HinweisZumStand form="darunter" />
    </>
  )
}
