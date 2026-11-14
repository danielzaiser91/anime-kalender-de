


import { type ReactNode } from 'react'
import { type Antwort } from './antwort-typ.ts'
import { type Gruppe } from './stream-pillen.ts'

export function KastenPillen({ pillen, mitBereichen, gruppeVon, kostenlosKopf, T, legende, aktivDisc }: {
  pillen: ReactNode[]
  mitBereichen: boolean
  gruppeVon: (p: ReactNode) => Gruppe | 'sonst'
  kostenlosKopf: string | undefined
  T: (k: string, v?: Record<string, string | number>) => string
  legende: string | undefined
  aktivDisc: boolean
}) {
  return (
    <>
      {pillen.length > 0 && (
        <div className="mt-auto shrink-0 border-t border-slate-200/70 pt-2.5 dark:border-white/10">
          {/*
            Die Pillen brechen um, der Kasten wächst mit: Ein Rollbereich im scrollenden Panel trifft man am Handy kaum, und eine halb
            verdeckte Pille sieht aus wie ein Fehler. Die Mindesthöhe verhindert Sprünge im Regelfall (`check:panel` misst sie).
          */}
          {/* `items-stretch`: Eine Pille ohne zweite Zeile wird so hoch wie ihre Nachbarn (Daniel, 19.09.2026, TOGGO neben RTL+). */}
          <div className="flex flex-col pt-2">
            {mitBereichen ? (
              <div className="flex w-full flex-col gap-3">
{/* Der grüne Block nur, wo es wirklich etwas umsonst gibt — sonst wäre er eine leere Behauptung. */}
                {pillen.some((p) => gruppeVon(p) === 'frei') && (
                  <div className="flex flex-col gap-2 rounded-lg bg-ak-gut-grund p-2 ring-1 ring-inset ring-ak-gut/30">
                    <span className="text-t4 font-semibold text-ak-gut-text">{kostenlosKopf}</span>
                    <div className={PILLEN_REIHE}>{pillen.filter((p) => gruppeVon(p) === 'frei')}</div>
                  </div>
                )}
                {(['abo', 'kauf', 'tv', 'unbekannt', 'sonst', 'offen'] as const).map((g) => {
                  const teil = pillen.filter((p) => gruppeVon(p) === g)
                  if (!teil.length) return null
                  return (
                    <div key={g} className="flex flex-col gap-2">
                      {g !== 'sonst' && (
                        <span className="text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">{T(`bereich.${g}`)}</span>
                      )}
                      <div className={PILLEN_REIHE}>{teil}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={PILLEN_REIHE}>{pillen}</div>
            )}
          </div>
          {legende && !aktivDisc && <p className="mt-2 text-t4 text-ak-leise">{legende}</p>}
        </div>
      )}
    </>
  )
}

export function KastenWegeHinweis({ pillen, wegeHinweis, antwort }: {
  pillen: ReactNode[]
  wegeHinweis: string | undefined
  antwort: Antwort
}) {
  return (
    <>
      {pillen.length === 0 && wegeHinweis && (
        <div className="mt-auto shrink-0 border-t border-slate-200/70 pt-2.5 dark:border-white/10">
          {/* Beim Kinofilm ist der Satz ein Favoriten-Hinweis und trägt deren Gelb. */}
          <p
            className={[
              'flex min-h-[2.1rem] items-center text-t4',
              antwort.art === 'kino'
                ? 'text-ak-favorit-text'
                : 'text-slate-500 dark:text-slate-400',
            ].join(' ')}
          >
            {wegeHinweis}
          </p>
        </div>
      )}
    </>
  )
}

export function KastenSchnitt({ schnitt }: {
  schnitt: { was: string[]; quellen: string[]; } | undefined
}) {
  return (
    <>
      {schnitt && (
        <details className="mt-1 text-t5 text-ak-warnung-text">
          <summary className="cursor-pointer select-none font-semibold hover:underline">Was geschnitten ist</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {schnitt.was.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Quellen:{' '}
            {schnitt.quellen.map((q, i) => (
              <span key={q}>
                {i > 0 && ' · '}
                <a href={q} target="_blank" rel="noopener noreferrer" className="underline hover:text-ak-text">
                  {new URL(q).hostname.replace(/^www\./, '')}
                </a>
              </span>
            ))}
          </p>
        </details>
      )}
    </>
  )
}

export function KastenFakten({ fakten, anteil }: {
  fakten: { wert: string; was: string; }[] | undefined
  anteil: number | undefined
}) {
  return (
    <>
      {fakten ? (
        /* `mb-1` hält die Beschriftungen von der Trennlinie darunter frei — bei
           „Venus Wars" lag „erschienen / Altersfreigabe / Studio" halb darauf. */
        <div className="mb-1 mt-2 flex gap-4">
          {fakten.map((f) => (
            <span key={f.was} className="flex flex-col ">
              <b className="text-t4 font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {f.wert}
              </b>
              <span className="text-t5 text-slate-400 dark:text-slate-500">{f.was}</span>
            </span>
          ))}
        </div>
      ) : anteil === undefined ? (
        /*
          **Kein Balken, wo es nichts zu messen gibt.**

          Bei „vollständig" war er immer voll, bei „keine Fassung" immer leer —
          in beiden Fällen sagte er dasselbe wie die Zeile darüber. Er bleibt,
          wo er einen echten Zwischenstand zeigt: bei einer laufenden Staffel.
        */
        null
      ) : (
        <div
          className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
          aria-hidden="true"
        >
          <span
            className={anteil === 0 ? 'bg-slate-300 dark:bg-white/15' : 'bg-ak-gut'}
            style={{ width: `${anteil === 0 ? 100 : (anteil ?? 100)}%` }}
          />
          {anteil !== undefined && anteil > 0 && anteil < 100 && (
            <span className="bg-ak-gut/25" style={{ width: `${100 - anteil}%` }} />
          )}
        </div>
      )}
    </>
  )
}

/** Pillenreihe: 8 px zwischen den Pillen, 16 px zwischen den Zeilen (Platz für die Blase), 8 px über der ersten. */
const PILLEN_REIHE = 'flex flex-wrap items-start gap-x-2 gap-y-4 pt-2'
