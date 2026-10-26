import { useEffect, type ComponentProps } from 'react'
import { DbLeer as EchtesLeer, DbRaster as EchtesRaster } from '../../src/components/db-bedienung.tsx'
import { DbKopfzeile as EchteKopfzeile } from '../../src/components/db-kopfzeile.tsx'
import { DbKopfbereich as EchterKopf } from '../../src/components/filter/DbWerkzeug.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { useMobil } from '../../src/lib/use-mobil.ts'
import { leseStand, merkeDaten, merkeStand, useHinweisStand, useSuchhinweis, type HinweisStand, type Suchhinweis } from './suchhinweis-daten.ts'
import { loeseBlockade } from './suchhinweis-filter.ts'
import { einheitName } from './suchhinweis-namen.ts'
import { blockadeText, zusatzText } from './suchhinweis-zaehlen.ts'

type Form = 'zeile' | 'darunter'

/** Die Zählzeile selbst („0 Ergebnisse · 0 mit …“) trennt mit „·“; in der Zeile fließt der Hinweis als Text hinter ihr (bricht er um, bleibt der Trenner an der Zählung), darunter (Handy) steht er für sich. */
const HUELLE: Record<Form, string> = {
  zeile: 'text-sm leading-7 text-ak-text',
  darunter: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ak-text',
}

const KNOPF = 'inline-flex min-h-11 shrink-0 items-center align-middle cursor-pointer rounded-full border border-ak-rand px-4 text-sm font-semibold text-ak-akzent-text transition hover:bg-ak-flaeche-2'

/** Was der Knopf tut: gibt es Filter, die den exakten Treffer verstecken, geht er genau diese an (und schaltet bei Bedarf den Synchro-Schalter ein), sonst schaltet er nur den Schalter ein. */
function loese(stand: HinweisStand, hinweis: Suchhinweis): void {
  const b = hinweis.blockade
  if (b && b.einheiten.length > 0) stand.filterAendern(loeseBlockade(stand.filters, b))
  /* Der Schalter und die Filter schreiben je die ganze Adresse aus dem Stand ihres Aufrufs; der zweite Schritt wartet auf den ersten (die echte Umsetzung braucht einen gemeinsamen Adresswechsel). */
  if (!b || b.synchro || b.einheiten.length === 0) setTimeout(() => leseStand()?.einschalten(true), 0)
}

/** Der Inhalt des Hinweises zum Stand der Datenbank (Suche, Filter, Schalter); `null`, wenn es nichts zu sagen gibt. */
function useHinweisInhalt(): { stand: HinweisStand; hinweis: Suchhinweis; text: string; versteckt: boolean } | null {
  const { tGenre } = useLang()
  const stand = useHinweisStand()
  const hinweis = useSuchhinweis(stand)
  if (!stand || !hinweis) return null
  const zusatz = !stand.ohneSynchro && hinweis.zusatz.gesamt > 0
  const b = hinweis.blockade
  const versteckt = !!b && b.einheiten.length > 0
  if (!zusatz && !versteckt) return null
  const filter = b ? [...b.einheiten.map((e) => einheitName(e, stand.filters, tGenre)), ...(b.synchro ? ['ohne deutsche Synchro'] : [])] : []
  const saetze = [...(zusatz ? [zusatzText(hinweis.zusatz)] : []), ...(b && versteckt ? [blockadeText(anzeigeName(b.titel), filter)] : [])]
  return { stand, hinweis, text: saetze.join(' · '), versteckt }
}

function HinweisZumStand({ form }: { form: Form }) {
  const inhalt = useHinweisInhalt()
  if (!inhalt) return null
  return (
    <span role="status" data-suchhinweis={form} className={HUELLE[form]}>
      {form === 'zeile' && <span aria-hidden="true">· </span>}
      <span>{inhalt.text}</span>{' '}
      <button type="button" onClick={() => loese(inhalt.stand, inhalt.hinweis)} className={KNOPF}>
        {inhalt.versteckt ? 'Filter entfernen' : 'Anzeigen'}
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
 * Kopf: trägt den Stand ein; am Rechner steht der Hinweis in der Zählzeile. Am Handy liegt die Zählzeile
 * in der Leiste am unteren Rand, die für einen Hinweis zu schmal ist — dort steht er darunter.
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

/** Zählzeile (Rechner): „0 Ergebnisse für …“, Trenner und Hinweis in derselben Zeile. */
export function KopfzeileMitHinweis(p: ComponentProps<typeof EchteKopfzeile>) {
  if (p.zweizeilig) return <EchteKopfzeile {...p} />
  return (
    <span className="min-w-0 text-sm leading-7">
      <span className="inline-flex align-middle"><EchteKopfzeile {...p} /></span>{" "}
      <HinweisZumStand form="zeile" />
    </span>
  )
}

/** Raster der Datenbank: trägt den Datensatz der App ein, den der Hinweis braucht (siehe `merkeDaten`). */
export function RasterMitDaten(p: ComponentProps<typeof EchtesRaster>) {
  useEffect(() => merkeDaten(p.data))
  return <EchtesRaster {...p} />
}

/** Leere Liste: der alte Knopf „Auch Anime ohne deutsche Synchro zeigen“ entfällt, solange der Hinweis dieselbe Handlung anbietet. */
export function LeerMitHinweis(p: ComponentProps<typeof EchtesLeer>) {
  const hinweisDa = useHinweisInhalt() !== null
  return <EchtesLeer {...p} ohneSynchro={p.ohneSynchro || hinweisDa} />
}
