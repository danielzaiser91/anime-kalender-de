import { useState, type ReactNode } from 'react'
import { useLang } from '../../src/lib/i18n.tsx'
import { useNewsletterVerbindung } from '../../src/lib/newsletterSync.ts'
import { GlockeZeichen, PanelKarte } from '../../src/components/detail/panel-karte.tsx'
import { quelleVon, standText, zeilenTeile, grossAnfang, type Ankuendigung } from './synchro-angekuendigt-text.ts'

const LEISE = 'text-t4 text-slate-500 dark:text-slate-400'
const KNOPF =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-t3 font-semibold text-ak-text transition hover:bg-ak-flaeche-2'
const AUS = 'border-slate-300 dark:border-white/20'
const AN = 'border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200'

function Stern({ gefuellt }: { gefuellt: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={gefuellt ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
    </svg>
  )
}

/** Merkt den Titel wie das ☆ im Kopf; hier nennt der Knopf seinen Nutzen. Im Mockup nur lokaler Zustand (die Bühne führt keine Favoriten). */
export function BescheidKnopf() {
  const [gemerkt, setGemerkt] = useState(false)
  const { verbunden } = useNewsletterVerbindung()
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" aria-pressed={gemerkt} onClick={() => setGemerkt(!gemerkt)} className={`${KNOPF} ${gemerkt ? AN : AUS}`}>
        <Stern gefuellt={gemerkt} />
        {gemerkt ? 'Gemerkt' : 'Bescheid bei Termin'}
      </button>
      {gemerkt && (
        <p className="text-t4 font-semibold text-ak-favorit-text">
          {verbunden ? 'Wir schreiben dir, sobald es einen Termin gibt.' : 'Melde dich noch beim Newsletter an, dann sagen wir Bescheid.'}
        </p>
      )}
    </div>
  )
}

const LINK = 'underline decoration-dotted underline-offset-2 hover:text-ak-text'

/** Der Anbietername als Link zur Serie beim Anbieter (die Pille unter „Weitere Anbieter“ entfällt, ihr Link wandert hierher). */
function AnbieterLink({ name, url }: { name: string; url: string | undefined }) {
  if (!url) return <>{name}</>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK}>
      {name}
    </a>
  )
}

function QuelleLink({ a }: { a: Ankuendigung }) {
  const url = quelleVon(a)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center ${LINK}`}>
      Quelle <span aria-hidden="true">↗</span>
    </a>
  )
}

/** Variante A: im Kasten, wo heute die Nebenzeile steht — Anbieter einmal (als Link), darunter Stand mit Quelle, daneben der Knopf. */
export function ZeileImKasten({ a, anbieterUrl }: { a: Ankuendigung; anbieterUrl: string | undefined }) {
  const { t } = useLang()
  const z = zeilenTeile(a, t)
  return (
    <div className="mt-0.5 flex flex-col gap-1">
      <p className={LEISE}>
        <AnbieterLink name={z.anbieter} url={anbieterUrl} /> · {z.untertitel} · {z.termin}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={LEISE}>
          Angekündigt, {standText(a)} · <QuelleLink a={a} />
        </p>
        <BescheidKnopf />
      </div>
    </div>
  )
}

/** Variante B: eigene Karte unter dem Kasten mit Anbieter, Stand, Quelle und Knopf. */
export function KarteUnterKasten({ a, anbieterUrl }: { a: Ankuendigung; anbieterUrl: string | undefined }) {
  const { t } = useLang()
  const z = zeilenTeile(a, t)
  const inhalt: ReactNode = (
    <div className="flex flex-col gap-2">
      <p className="text-t3 text-ak-text">
        <AnbieterLink name={z.anbieter} url={anbieterUrl} /> hat die deutsche Synchro angekündigt.
      </p>
      <p className={LEISE}>
        {standText(a)} · <QuelleLink a={a} />
      </p>
      <p className={LEISE}>
        {grossAnfang(z.untertitel)}. {z.termin}.
      </p>
      <BescheidKnopf />
    </div>
  )
  return (
    <PanelKarte symbol={<GlockeZeichen />} titel="Termin offen" akzent="akzent" label="Synchro angekündigt, Termin offen">
      {inhalt}
    </PanelKarte>
  )
}
