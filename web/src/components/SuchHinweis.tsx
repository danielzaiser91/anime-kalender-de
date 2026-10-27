import { anzeigeName } from '@shared/titles.ts'
import type { FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import type { Suchhinweis } from '../lib/suchhinweis.ts'
import { loeseBlockade } from '../lib/suchhinweis-filter.ts'
import { einheitName } from '../lib/suchhinweis-namen.ts'
import { blockadeText, zusatzText } from '../lib/suchhinweis-zaehlen.ts'

/** Wo der Hinweis steht: in der Zählzeile (Rechner) oder für sich unter der Werkzeugleiste (Handy, dort liegt die Zählzeile in der unteren Leiste). */
export type HinweisForm = 'zeile' | 'darunter'

/** Was der Knopf auslöst: die Filter, die den exakten Treffer verstecken (sonst keine Änderung) und ob der Schalter „ohne Synchro“ an soll. */
export type HinweisLoesen = (filters: FilterState | undefined, schalterAn: boolean) => void

export interface SuchHinweisProps {
  hinweis?: Suchhinweis
  filters: FilterState
  ohneSynchro: boolean
  onLoesen: HinweisLoesen
}

const HUELLE: Record<HinweisForm, string> = {
  zeile: 'text-sm leading-7 text-ak-text',
  darunter: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ak-text',
}

const KNOPF = 'inline-flex min-h-11 shrink-0 items-center align-middle cursor-pointer rounded-full border border-ak-rand px-4 text-sm font-semibold text-ak-akzent-text transition hover:bg-ak-flaeche-2'

/** Satz und Knopf des Hinweises; `null`, wenn es nichts zu sagen gibt (kein Zusatz und kein verstecktes Ergebnis). */
export function useHinweisInhalt({ hinweis, filters, ohneSynchro }: Omit<SuchHinweisProps, 'onLoesen'>): { text: string; versteckt: boolean } | null {
  const { tGenre } = useLang()
  if (!hinweis) return null
  const zusatz = !ohneSynchro && hinweis.zusatz.gesamt > 0
  const b = hinweis.blockade
  const versteckt = !!b && b.einheiten.length > 0
  if (!zusatz && !versteckt) return null
  const filter = b ? [...b.einheiten.map((e) => einheitName(e, filters, tGenre)), ...(b.synchro ? ['ohne deutsche Synchro'] : [])] : []
  const saetze = [...(zusatz ? [zusatzText(hinweis.zusatz)] : []), ...(b && versteckt ? [blockadeText(anzeigeName(b.titel), filter)] : [])]
  return { text: saetze.join(' · '), versteckt }
}

/** Was der Knopf tut: gibt es Filter, die den exakten Treffer verstecken, geht er genau diese an (und schaltet bei Bedarf den Synchro-Schalter ein), sonst schaltet er nur den Schalter ein. */
export function loesen(hinweis: Suchhinweis, filters: FilterState, onLoesen: HinweisLoesen): void {
  const b = hinweis.blockade
  const filtern = !!b && b.einheiten.length > 0
  onLoesen(filtern ? loeseBlockade(filters, b) : undefined, !filtern || b.synchro)
}

export function SuchHinweis({ form, ...p }: SuchHinweisProps & { form: HinweisForm }) {
  const inhalt = useHinweisInhalt(p)
  if (!inhalt || !p.hinweis) return null
  const hinweis = p.hinweis
  return (
    <span role="status" data-suchhinweis={form} className={HUELLE[form]}>
      {form === 'zeile' && <span aria-hidden="true">· </span>}
      <span>{inhalt.text}</span>{' '}
      <button type="button" onClick={() => loesen(hinweis, p.filters, p.onLoesen)} className={KNOPF}>
        {inhalt.versteckt ? 'Filter entfernen' : 'Anzeigen'}
      </button>
    </span>
  )
}
