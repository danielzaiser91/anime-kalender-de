import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NewsBeleg } from '@shared/types.ts'
import { hostVon } from '@shared/quelle.ts'
import { datumKurz } from '../lib/news-text.ts'
import { quellenLabel } from './news-belege.tsx'

/** **Das Beleg-Bild** an einer Quelle; öffentlich lesbar (Daniel, 04.10.2026). Der archivierte Text (HTML) bleibt privat (Daniel, 05.10.2026). */
const WORKER = import.meta.env.VITE_NEWSLETTER_API ?? ''

/**
 * **Ein Knopf je Meldung statt Hostnamen-Links** (Daniel, 05.10.2026): „Quelle"/„Quellen" öffnet das Beleg-Fenster mit einem Reiter je
 * Quelle. „Beleg" heißt, dass mindestens eine Quelle ein gesichertes Bild hat.
 */
export function QuellenKnopf({ belege, betreff }: { belege: NewsBeleg[]; betreff?: string }) {
  const [offen, setOffen] = useState(false)
  if (!belege.length) return null
  const archiv = (Boolean(WORKER) && belege.some((b) => b.bild)) || belege.some((b) => b.messung)
  const wort = archiv ? 'Beleg' : 'Quelle'
  const text = belege.length > 1 ? `${wort === 'Beleg' ? 'Belege' : 'Quellen'} ${belege.length}` : wort
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        title={belege.map(quellenLabel).join(' · ')}
        className="ml-auto shrink-0 cursor-pointer rounded border border-current px-1.5 text-[11px] font-bold leading-4 text-ak-akzent-text hover:bg-ak-akzent-text/10"
      >
        {archiv ? '▣ ' : ''}
        {text}
      </button>
      {offen && <BelegDialog belege={belege} betreff={betreff} zu={() => setOffen(false)} />}
    </>
  )
}

/** Was die Quelle zeigt, in einem Satz — mit dem Tag, an dem sie es sagte oder wir nachgesehen haben. */
function erklaerung(b: NewsBeleg): string {
  if (b.gemessenAm) return `Unsere Messung vom ${datumKurz(b.gemessenAm)}: So sah ${b.name} an diesem Tag aus.`
  if (b.ausgabeAm) return `Produktseite bei ${b.name}; die Ausgabe erscheint am ${datumKurz(b.ausgabeAm)}.`
  const wann = b.veroeffentlichtAm ? `, veröffentlicht am ${datumKurz(b.veroeffentlichtAm)}` : ''
  const spaeter = b.aktualisiertAm && b.aktualisiertAm !== b.veroeffentlichtAm ? `, aktualisiert am ${datumKurz(b.aktualisiertAm)}` : ''
  return `Quelle: ${b.name}${wann}${spaeter}.`
}

/** Wann wir die Quelle geprüft haben: erstmals, zuletzt, und wann das Bild entstand (nur, was die Beleg-Lesung weiß). */
function pruefzeile(b: NewsBeleg, mitBild: boolean): string {
  const teile = [
    b.erstGeprueftAm && `erstmals geprüft am ${datumKurz(b.erstGeprueftAm)}`,
    b.zuletztGeprueftAm && b.zuletztGeprueftAm !== b.erstGeprueftAm && `zuletzt geprüft am ${datumKurz(b.zuletztGeprueftAm)}`,
    mitBild && b.bildAm && `Bild vom ${datumKurz(b.bildAm)}`,
  ].filter(Boolean)
  return teile.length ? ` ${(teile.join(' · ') as string).replace(/^./, (c) => c.toUpperCase())}.` : ''
}

/** Zwei Quellen desselben Anbieters bekommen eine Nummer: „anime2you.de 1", „anime2you.de 2". */
function tabName(b: NewsBeleg, alle: NewsBeleg[]): string {
  const name = quellenLabel(b)
  const gleich = alle.filter((x) => quellenLabel(x) === name)
  return gleich.length > 1 ? `${name} ${gleich.indexOf(b) + 1}` : name
}

const BTN = 'cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-white/10'

/**
 * **Das Fenster füllt den ganzen Bildschirm** und hängt am `<body>`: Im Detail-Panel (transformiert) bezog sich `fixed` auf das Panel,
 * und das Bild stand in dessen schmaler Spalte (Daniel, 04.10.2026). Oben die Reiter, darunter die gewählte Quelle.
 */
function BelegDialog({ belege, betreff, zu }: { belege: NewsBeleg[]; betreff?: string; zu: () => void }) {
  const [aktiv, setAktiv] = useState(() => Math.max(0, belege.findIndex((b) => b.bild)))
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && zu()
    document.addEventListener('keydown', esc)
    /* Hinter dem Dialog bleibt die Seite stehen — und ihre Bildlaufleiste verschwindet (Daniel, 04.10.2026). */
    const vorher = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.documentElement.style.overflow = vorher
    }
  }, [zu])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Quellen: ${betreff ?? ''}`} className="fixed inset-0 z-[60] flex flex-col bg-black/90 text-slate-200" onClick={zu}>
      <div className="shrink-0 border-b border-white/10 bg-slate-900 px-4 pt-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 text-sm">
          <b className="min-w-0 flex-1 truncate">{belege.length > 1 ? 'Quellen' : 'Quelle'}{betreff ? `: ${betreff}` : ''}</b>
          <button type="button" onClick={zu} className={BTN}>Schließen</button>
        </div>
        {belege.length > 1 && (
          <div role="tablist" className="mt-2 flex gap-1 overflow-x-auto">
            {belege.map((b, i) => (
              <button
                key={b.url}
                type="button"
                role="tab"
                aria-selected={i === aktiv}
                onClick={() => setAktiv(i)}
                className={`shrink-0 cursor-pointer rounded-t border border-b-0 px-3 py-1 text-xs ${i === aktiv ? 'border-slate-500 bg-slate-800 font-bold text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                {b.bild && WORKER ? '▣ ' : ''}
                {tabName(b, belege)}
              </button>
            ))}
          </div>
        )}
      </div>
      <BelegAnsicht key={belege[aktiv]!.url} beleg={belege[aktiv]!} zu={zu} />
    </div>,
    document.body,
  )
}

/** Eine Quelle: Erklärung, Originaladresse und — wo gesichert — das Bild mit der Fundstelle. */
function BelegAnsicht({ beleg, zu }: { beleg: NewsBeleg; zu: () => void }) {
  const bild = WORKER ? beleg.bild : undefined
  const [url, setUrl] = useState<string>()
  const [fehler, setFehler] = useState<string>()
  const [einpassen, setEinpassen] = useState(false)
  const [markiert, setMarkiert] = useState(false)
  const marke = useRef<HTMLDivElement>(null)
  const [x, y, b, h] = beleg.markierung ?? []
  useEffect(() => {
    if (!bild) return
    let aktiv = true
    let blobUrl: string | undefined
    fetch(`${WORKER}/beleg?key=${encodeURIComponent(bild)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Bild nicht gefunden' : `Fehler ${r.status}`)
        blobUrl = URL.createObjectURL(await r.blob())
        if (aktiv) setUrl(blobUrl)
      })
      .catch((e: Error) => aktiv && setFehler(e.message))
    return () => {
      aktiv = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [bild])
  const zurFundstelle = () => {
    setEinpassen(false)
    setMarkiert(true)
    /* Erst nach dem Umschalten auf volle Breite liegt die Marke an ihrem Platz. */
    window.setTimeout(() => marke.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
  }
  return (
    <>
      <div className="shrink-0 border-b border-white/10 bg-slate-800 px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 text-xs leading-snug text-slate-300">
          <p className="min-w-0 flex-1">
            {erklaerung(beleg)}
            {pruefzeile(beleg, Boolean(bild))}
            {bild ? ' Wir sichern von jeder Quelle ein Bild, damit prüfbar bleibt, worauf die Meldung beruht.' : ''}
          </p>
          {x !== undefined && url && (
            <button type="button" onClick={zurFundstelle} className={`${BTN} border-rose-400 text-rose-200`}>Zur Fundstelle</button>
          )}
          {url && (
            <button type="button" onClick={() => setEinpassen((e) => !e)} aria-pressed={einpassen} className={BTN}>
              {einpassen ? 'Volle Breite' : 'Einpassen'}
            </button>
          )}
          <a href={beleg.url} target="_blank" rel="noopener noreferrer" className={`${BTN} border-rose-400 font-semibold text-rose-200`}>
            Originalseite bei {hostVon(beleg.url)} ↗
          </a>
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${einpassen ? 'flex items-center justify-center p-3 md:p-6' : 'overflow-auto p-3 md:p-6'}`} onClick={zu}>
        {!bild ? (
          beleg.messung ? <Messung m={beleg.messung} /> : null
        ) : fehler ? (
          <p className="p-4 text-sm text-rose-300">{fehler}</p>
        ) : url ? (
          <div className={einpassen ? 'relative max-h-full max-w-full' : 'relative mx-auto w-full max-w-[1800px]'} onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={`Beleg: ${beleg.name}`} className={einpassen ? 'max-h-full max-w-full rounded object-contain' : 'block w-full rounded'} />
            {markiert && x !== undefined && (
              <div
                ref={marke}
                aria-label="Fundstelle"
                className="pointer-events-none absolute rounded border-[3px] border-rose-500 bg-rose-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${x * 100}%`, top: `${(y ?? 0) * 100}%`, width: `${(b ?? 0) * 100}%`, height: `${(h ?? 0) * 100}%` }}
              />
            )}
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-400">Lädt …</p>
        )}
      </div>
    </>
  )
}

/** Unsere Messung als Beleg, wo kein Bild möglich ist: was der Anbieter-Katalog an dem Tag zu den Folgen sagte. */
function Messung({ m }: { m: NonNullable<NewsBeleg['messung']> }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-white/10 bg-slate-900 p-4 text-sm text-slate-200" onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 font-semibold">Unsere Messung vom {datumKurz(m.am)} ({m.quelle})</p>
      <ul className="space-y-1">
        {m.zeilen.map((z) => (
          <li key={z}>{z}</li>
        ))}
      </ul>
    </div>
  )
}
