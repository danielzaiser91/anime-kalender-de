import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { NewsBeleg } from '@shared/types.ts'
import { belegLink, hostVon } from '@shared/quelle.ts'
import { BELEG_TYP_LABEL, belegTyp } from '@shared/beleg-anbieter.ts'
import { datumKurz } from '../lib/news-text.ts'
import { useSeiteGesperrt } from '../lib/use-seite-gesperrt.ts'
import { istSammelartikel } from '../lib/sammel-belege.ts'
import { quellenLabel } from './news-belege.tsx'
import { Ladeanzeige } from './ui.tsx'

/** **Das Beleg-Bild** an einer Quelle; öffentlich lesbar (Daniel, 04.10.2026). Der archivierte Text (HTML) bleibt privat (Daniel, 05.10.2026). */
const WORKER = import.meta.env?.VITE_NEWSLETTER_API ?? ''

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
        className="-my-2.5 ml-auto inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center px-1 text-t4 text-slate-600 underline underline-offset-2 hover:text-ak-text dark:text-slate-300"
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
  const sprache = b.ueberschrift ? (SPRACHEN[b.ueberschrift.sprache] ?? b.ueberschrift.sprache) : ''
  const ueberschrift = b.ueberschrift ? ` Überschrift der Seite (${sprache}): „${b.ueberschrift.text}“.` : ''
  return `Quelle: ${b.name}${wann}${spaeter}.${ueberschrift}`
}

/** Sprachen der Überschriften offizieller Websites (Art `offiziell`). */
const SPRACHEN: Record<string, string> = { ja: 'japanisch', en: 'englisch' }

/** Wann wir die Quelle geprüft haben: erstmals, zuletzt, und wann das Bild entstand (nur, was die Beleg-Lesung weiß). */
function pruefzeile(b: NewsBeleg, mitBild: boolean): string {
  const teile = [
    b.erstGeprueftAm && `erstmals geprüft am ${datumKurz(b.erstGeprueftAm)}`,
    b.zuletztGeprueftAm && b.zuletztGeprueftAm !== b.erstGeprueftAm && `zuletzt geprüft am ${datumKurz(b.zuletztGeprueftAm)}`,
    mitBild && b.bildAm && `Bild vom ${datumKurz(b.bildAm)}`,
  ].filter(Boolean)
  return teile.length ? ` ${(teile.join(' · ') as string).replace(/^./, (c) => c.toUpperCase())}.` : ''
}

/** Der Tag ohne Jahr, solange er im laufenden Jahr liegt: „09.10." statt „09.10.2026". */
function kurzTag(iso: string): string {
  const k = datumKurz(iso)
  return iso.startsWith(String(new Date().getFullYear())) ? k.slice(0, 6) : k
}

/**
 * Derselbe Anbieter erscheint je Aussage nur einmal je Typ (Bau: `entdoppeleBelege`); teilen sich zwei Reiter den Namen,
 * unterscheidet der Typ mit Tag: „anime2you.de · Artikel 09.10.", „anime2you.de · Feed".
 */
function tabName(b: NewsBeleg, alle: NewsBeleg[]): string {
  const name = quellenLabel(b)
  if (alle.filter((x) => quellenLabel(x) === name).length < 2) return name
  const wann = b.veroeffentlichtAm ?? b.gemessenAm ?? b.ausgabeAm
  return `${name} · ${BELEG_TYP_LABEL[belegTyp(b.url)]}${wann ? ` ${kurzTag(wann)}` : ''}`
}

const BTN = 'cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-ak-flaeche-2'

/**
 * **Das Fenster füllt den ganzen Bildschirm** und hängt am `<body>`: Im Detail-Panel (transformiert) bezog sich `fixed` auf das Panel,
 * und das Bild stand in dessen schmaler Spalte (Daniel, 04.10.2026). Oben die Reiter, darunter die gewählte Quelle.
 */
function BelegDialog({ belege, betreff, zu }: { belege: NewsBeleg[]; betreff?: string; zu: () => void }) {
  const [aktiv, setAktiv] = useState(() => Math.max(0, belege.findIndex((b) => b.bild)))
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && zu()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [zu])
  /* Hinter dem Dialog bleibt die Seite stehen — und ihre Bildlaufleiste verschwindet (Daniel, 04.10.2026). */
  useSeiteGesperrt(true)
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Quellen: ${betreff ?? ''}`} className="ak-immer-dunkel fixed inset-0 z-[60] flex flex-col bg-black/90 text-slate-200" onClick={zu}>
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
                className={`shrink-0 cursor-pointer rounded-t border border-b-0 px-3 py-1 text-xs ${i === aktiv ? 'border-slate-500 bg-slate-800 font-bold text-white' : 'border-transparent text-slate-400 hover:text-ak-text'}`}
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

/** Ohne Marke zeigt das Bild die Seite von oben, nicht die Stelle des Titels (Rayearth, 29.10.2026): Das sagen wir, statt einen Ausschnitt vorzutäuschen. */
export function fundstellenHinweis(b: NewsBeleg, bildGezeigt: boolean): string {
  return bildGezeigt && !b.markierung && istSammelartikel(b.url) ? 'Auf dem Bild ist keine Stelle markiert.' : ''
}

/** Auf dem Handy zwei Zeilen; ein Tipp klappt den ganzen Text auf (Rooster Fighter: die Kopfzeile fraß den halben Bildschirm). */
export function Erklaerung({ beleg, mitBild }: { beleg: NewsBeleg; mitBild: boolean }) {
  const [lang, setLang] = useState(false)
  return (
    <p className={`min-w-0 flex-1 cursor-pointer md:cursor-auto ${lang ? '' : 'line-clamp-2 md:line-clamp-none'}`} onClick={() => setLang((l) => !l)} aria-expanded={lang}>
      {erklaerung(beleg)}
      {pruefzeile(beleg, mitBild)}
      {mitBild ? ' Wir sichern von jeder Quelle ein Bild, damit prüfbar bleibt, worauf die Meldung beruht.' : ''}
    </p>
  )
}

/** Holt das gesicherte Bild vom Worker und gibt es als Blob-Adresse zurück; räumt sie beim Schließen auf. */
function useBelegBild(bild: string | undefined, worker: string): { url?: string; fehler?: string } {
  const [url, setUrl] = useState<string>()
  const [fehler, setFehler] = useState<string>()
  useEffect(() => {
    if (!bild) return
    let aktiv = true
    let blobUrl: string | undefined
    fetch(`${worker}/beleg?key=${encodeURIComponent(bild)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Bild nicht gefunden' : `Fehler ${r.status}`)
        blobUrl = URL.createObjectURL(await r.blob())
        if (aktiv) setUrl(blobUrl)
      })
      .catch((e: Error) => aktiv && setFehler(e instanceof TypeError ? 'Beleg nicht erreichbar' : e.message))
    return () => {
      aktiv = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [bild, worker])
  return { url, fehler }
}

/** Eine Quelle: Erklärung, Originaladresse und — wo gesichert — das Bild mit der Fundstelle. */
export function BelegAnsicht({ beleg, zu, worker = WORKER }: { beleg: NewsBeleg; zu: () => void; worker?: string }) {
  const bild = worker ? beleg.bild : undefined
  const original = belegLink(beleg)
  const { url, fehler } = useBelegBild(bild, worker)
  const hinweis = fundstellenHinweis(beleg, Boolean(url))
  const [einpassen, setEinpassen] = useState(false)
  /* Mit Markierung öffnet das Bild gleich an der Fundstelle (Daniel, 11.10.2026); der Schalter nimmt die Marke zurück. */
  const [markiert, setMarkiert] = useState(Boolean(beleg.markierung))
  const startScroll = useRef(Boolean(beleg.markierung))
  const marke = useRef<HTMLDivElement>(null)
  const [x, y, b, h] = beleg.markierung ?? []
  const bildBereit = () => {
    if (!startScroll.current) return
    startScroll.current = false
    marke.current?.scrollIntoView({ block: 'center' })
  }
  const zurFundstelle = () => {
    if (markiert) {
      setMarkiert(false)
      return
    }
    setEinpassen(false)
    setMarkiert(true)
    /* Erst nach dem Umschalten auf volle Breite liegt die Marke an ihrem Platz. */
    window.setTimeout(() => marke.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
  }
  return (
    <>
      <div className="shrink-0 border-b border-white/10 bg-slate-800 px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 text-xs leading-snug text-slate-300">
          <Erklaerung beleg={beleg} mitBild={Boolean(bild)} />
          {x !== undefined && url && (
            <button type="button" onClick={zurFundstelle} className={`${BTN} border-ak-fehler text-ak-fehler-text`}>{markiert ? 'Marke aus' : 'Zur Fundstelle'}</button>
          )}
          {url && (
            <button type="button" onClick={() => setEinpassen((e) => !e)} aria-pressed={einpassen} className={BTN}>
              {einpassen ? 'Volle Breite' : 'Einpassen'}
            </button>
          )}
          {original && (
            <a href={original} target="_blank" rel="noopener noreferrer" className={`${BTN} border-ak-fehler font-semibold text-ak-fehler-text`}>
              Originalseite bei {hostVon(original)} ↗
            </a>
          )}
        </div>
        {hinweis && <p className="mt-1 text-xs">{hinweis}</p>}
      </div>
      <div className={`min-h-0 flex-1 ${einpassen ? 'flex items-center justify-center p-3 md:p-6' : 'overflow-auto p-3 md:p-6'}`} onClick={zu}>
        {!bild ? (
          beleg.messung ? <Messung m={beleg.messung} /> : null
        ) : fehler ? (
          <p className="p-4 text-sm text-ak-fehler-text">{fehler}</p>
        ) : (
          <BelegBild url={url} alt={`Beleg: ${beleg.name}`} einpassen={einpassen} bereit={bildBereit}>
            {markiert && x !== undefined && (
              <div
                ref={marke}
                aria-label="Fundstelle"
                className="pointer-events-none absolute rounded border-[3px] border-ak-fehler bg-ak-fehler/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${x * 100}%`, top: `${(y ?? 0) * 100}%`, width: `${(b ?? 0) * 100}%`, height: `${(h ?? 0) * 100}%` }}
              />
            )}
          </BelegBild>
        )}
      </div>
    </>
  )
}

/**
 * Das Bild samt Ladeanzeige: Bis es geladen und gezeichnet ist, hält die Hülle Platz (nichts springt) und zeigt den Kringel;
 * `bereit` läuft erst, wenn das Bild steht — vorher liegt die Marke noch an der falschen Stelle (Daniel, 12.10.2026, Handy).
 */
function BelegBild({ url, alt, einpassen, bereit, children }: { url?: string; alt: string; einpassen: boolean; bereit: () => void; children: ReactNode }) {
  const [stand, setStand] = useState<'laedt' | 'fertig' | 'kaputt'>('laedt')
  useLayoutEffect(() => {
    if (stand === 'fertig') bereit()
  }, [stand]) // eslint-disable-line react-hooks/exhaustive-deps -- `bereit` liest nur Refs
  if (stand === 'kaputt') return <p className="p-4 text-sm text-ak-fehler-text">Bild konnte nicht angezeigt werden</p>
  const fertig = stand === 'fertig'
  const hoehe = fertig ? '' : 'min-h-[60svh]'
  return (
    <div className={`relative ${hoehe} ${einpassen ? 'h-full max-w-full' : 'mx-auto w-full max-w-[1800px]'}`} onClick={(e) => e.stopPropagation()}>
      {!fertig && <Ladeanzeige label="Beleg wird geladen …" className="absolute inset-0 text-slate-300" />}
      {url && (
        <img
          src={url}
          alt={alt}
          className={`${einpassen ? 'h-full w-auto max-w-full rounded object-contain' : 'block w-full rounded'} ${fertig ? '' : 'opacity-0'}`}
          onLoad={() => setStand('fertig')}
          onError={() => setStand('kaputt')}
        />
      )}
      {fertig && children}
    </div>
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
