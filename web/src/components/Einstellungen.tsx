import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'
import { setzeVorschau, useDebug, useVorschau, VORSCHAUEN } from '../lib/vorschau.ts'

/**
 * **Die Einstellungen — ein Zahnrad, ein Dialog, eine Liste von Schaltern.**
 *
 * Daniel am 12.09.2026, als er entschied, die westlichen Serien aufzunehmen:
 * „immer sichtbar, aber bau eine einstellung seite, zahnrad icon sichtbar
 * platzieren, öffnet dialog, dort als erste option einfügen, ‚westliche anime
 * (Cartoons) ausblenden' - standardmäßig aus".
 *
 * Die Seite hatte bis dahin keine Einstellungen: Was einstellbar war — Thema,
 * Staffeln zusammenfassen, Titel ohne Synchro — stand jeweils dort, wo es
 * wirkt. Das trägt, solange eine Einstellung zu **einer** Ansicht gehört. Der
 * Cartoon-Schalter gehört zu allen, und dafür braucht es einen Ort.
 *
 * **Gespeichert wird im Browser, nicht in der Adresse.** Eine Einstellung ist
 * keine Ansicht: Wer einen Link teilt, teilt nicht seine Vorlieben mit.
 */
export const CARTOONS_AUS = 'cartoonsAus'

/** Liest den gespeicherten Stand — die Vorgabe ist „aus", also Cartoons sichtbar. */
export function cartoonsAusGespeichert(): boolean {
  try {
    return localStorage.getItem(CARTOONS_AUS) === '1'
  } catch {
    /* Privater Modus oder gesperrte Site-Daten: dann eben die Vorgabe. */
    return false
  }
}

export function EinstellungenDialog({
  offen,
  schliessen,
  cartoonsAus,
  setCartoonsAus,
}: {
  offen: boolean
  schliessen: () => void
  cartoonsAus: boolean
  setCartoonsAus: (next: boolean) => void
}) {
  const { t } = useLang()

  useEffect(() => {
    if (!offen) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    document.addEventListener('keydown', beiTaste)
    return () => document.removeEventListener('keydown', beiTaste)
  }, [offen, schliessen])

  if (!offen) return null

  /*
    **Am Körper, nicht im Kopfbereich.** `position: fixed` bezieht sich auf
    einen Vorfahren mit `transform` — und die Kopfleiste trägt beim Scrollen
    einen. Derselbe Fall wie beim Trailer-Dialog am 12.09.2026, dort hat es
    einen halben Bildschirm gekostet.
  */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('einstellungen.titel')}
      onClick={schliessen}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl border border-ak-rand bg-ak-flaeche p-5 text-ak-text shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 font-display text-lg font-bold">
            {t('einstellungen.titel')}
          </h2>
          <button
            type="button"
            onClick={schliessen}
            aria-label={t('einstellungen.schliessen')}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-lg text-ak-leise transition hover:bg-ak-flaeche-2 hover:text-ak-text"
          >
            ✕
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ak-rand p-3 transition hover:bg-ak-flaeche-2">
          <input
            type="checkbox"
            checked={cartoonsAus}
            onChange={(e) => setCartoonsAus(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff5a36]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t('einstellungen.cartoonsAus')}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-ak-leise">
              {t('einstellungen.cartoonsAusHinweis')}
            </span>
          </span>
        </label>
        <ThemaZeile />
        <DebugBereich schliessen={schliessen} />
      </div>
    </div>,
    document.body,
  )
}

/** Hell/Dunkel — auf dem Handy nur hier, am Rechner zusätzlich als Knopf im Kopf. */
function ThemaZeile() {
  const { t } = useLang()
  const [dunkel, umschalten] = useThema()
  return (
    <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-ak-rand p-3 transition hover:bg-ak-flaeche-2 md:hidden">
      <input type="checkbox" checked={!dunkel} onChange={umschalten} className="h-4 w-4 shrink-0 accent-[#ff5a36]" />
      <span className="text-sm font-semibold">{t('kopf.hell')}</span>
    </label>
  )
}

/**
 * **Debug-Bereich: alle Vorschauen auf einen Blick** (Daniel, 07.10.2026). Sichtbar nur mit dem Flag `ak-debug` (Konsole: `akDebug()`). Je Vorschau: Name, Kurzbeschreibung,
 * ein Schalter (aus oder eine der Varianten) und ein Sprung zu einem Beispielort, an dem man sie sieht.
 */
function DebugBereich({ schliessen }: { schliessen: () => void }) {
  if (!useDebug()) return null
  return (
    <section className="mt-3 rounded-2xl border border-dashed border-amber-500/60 p-3" aria-label="Debug">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Debug · Vorschauen</h3>
      <ul className="flex flex-col gap-2.5">
        {Object.entries(VORSCHAUEN).map(([name, v]) => (
          <VorschauZeile key={name} name={name} v={v} schliessen={schliessen} />
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ak-leise">Ausschalten: <code>akDebug(false)</code> in der Konsole.</p>
    </section>
  )
}

function VorschauZeile({ name, v, schliessen }: { name: string; v: (typeof VORSCHAUEN)[string]; schliessen: () => void }) {
  const aktiv = useVorschau(name)
  return (
    <li className="text-sm">
      <div className="flex items-center gap-2">
        <b className="min-w-0 flex-1">{v.titel}</b>
        <select
          aria-label={`Variante von ${v.titel}`}
          value={aktiv ?? ''}
          onChange={(e) => setzeVorschau(name, e.target.value === '' ? false : e.target.value)}
          className="cursor-pointer rounded-lg border border-ak-rand bg-ak-flaeche-2 px-2 py-1 text-xs"
        >
          <option value="">aus</option>
          {v.varianten.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
      </div>
      <p className="mt-0.5 text-xs leading-snug text-ak-leise">{v.text}</p>
      <a href={v.beispiel} onClick={schliessen} className="mt-1 inline-block text-xs font-semibold text-ak-akzent-text underline">Beispiel ansehen: {v.beispielText} →</a>
    </li>
  )
}
