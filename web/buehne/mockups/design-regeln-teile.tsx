import type { ReactNode } from 'react'
import { PILLE_JA, PILLE_NEIN } from '../../src/components/filter/pille-zustand.ts'

/**
 * Tafel der Design-Regeln (docs/wissen/design-regeln.md): oben die Farbrollen als Felder, darunter jedes Bauteil in jedem Zustand.
 * **Vorher** sind die Klassen, die heute im Code stehen (Hover und Fokus nachgestellt, ohne Präfix); **Nachher** legt das
 * Mockup `design-regeln` per `stil` Regeln über `data-rolle`/`data-zustand` — dieselbe Tafel, andere Farben.
 */
const ROLLEN = [
  'grund', 'flaeche', 'flaeche-2', 'flaeche-3', 'rand', 'linie', 'text', 'leise', 'sehr-leise',
  'akzent', 'akzent-hover', 'akzent-text', 'auf-akzent', 'fokus', 'gewaehlt', 'link',
  'gut', 'gut-text', 'gut-grund', 'fehler', 'fehler-text', 'fehler-grund', 'warnung', 'warnung-text', 'warnung-grund',
  'info', 'info-text', 'info-grund', 'tv', 'tv-grund', 'katalog', 'katalog-text', 'finale', 'finale-text', 'heute',
]

export const ZUSTAENDE = ['ruhe', 'hover', 'fokus', 'gewaehlt', 'aus'] as const
export type Zustand = (typeof ZUSTAENDE)[number]

const FOKUS_VORHER = 'ring-2 ring-sky-400'

/** Ein Farbfeld: Textrollen als Schrift auf der Fläche, alle anderen als Füllung. */
function Farbfeld({ rolle }: { rolle: string }) {
  const schrift = /text$|^leise|^sehr-leise|^link$/.test(rolle)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ak-linie bg-ak-flaeche p-1.5 text-t5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-ak-linie font-extrabold"
        style={schrift ? { color: `var(--ak-${rolle})` } : { background: `var(--ak-${rolle})` }}
      >
        {schrift ? 'Aa' : ''}
      </span>
      <span className="text-ak-leise">{rolle}</span>
    </div>
  )
}

const zelle = (rolle: string, zustand: Zustand, klasse: string, kind: ReactNode, tag: 'button' | 'a' | 'div' = 'button') => {
  const Tag = tag
  return (
    <Tag data-rolle={rolle} data-zustand={zustand} className={`${klasse} transition`} {...(tag === 'a' ? { href: '#' } : {})}>
      {kind}
    </Tag>
  )
}

type Zeile = { rolle: string; name: string; zellen: Partial<Record<Zustand, ReactNode>> }

const PRIMAER = 'h-10 rounded-full bg-ak-akzent px-5 text-sm font-extrabold text-ak-auf-akzent'
const SEKUNDAER = 'h-10 rounded-full border border-ak-rand bg-ak-flaeche px-4 text-sm font-semibold text-ak-text'
const TERTIAER = 'grid h-10 w-10 place-items-center rounded-full text-xl text-ak-leise'
const SEGMENT = 'rounded-full px-3 py-1 text-sm font-bold'
const NEWS_CHIP = 'rounded-full px-3 py-1 text-xs font-semibold'
const PILLE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold'
const PILLE_RUHE = 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300'
const KACHEL = 'h-20 w-16 rounded-xl border border-ak-rand bg-ak-flaeche'
const LISTE = 'w-40 rounded px-3 py-2 text-left text-sm text-ak-text'

/** Die Bauteile, Zustand für Zustand mit den heutigen Klassen; `gewaehlt` zeigt alle Formen, die es heute für dieselbe Bedeutung gibt. */
const ZEILEN: Zeile[] = [
  {
    rolle: 'primaer',
    name: 'Primärknopf',
    zellen: {
      ruhe: zelle('primaer', 'ruhe', PRIMAER, 'Fertig'),
      hover: zelle('primaer', 'hover', PRIMAER, 'Fertig'),
      fokus: zelle('primaer', 'fokus', `${PRIMAER} ${FOKUS_VORHER}`, 'Fertig'),
      aus: zelle('primaer', 'aus', `${PRIMAER} opacity-60`, 'Fertig'),
    },
  },
  {
    rolle: 'sekundaer',
    name: 'Sekundärknopf',
    zellen: {
      ruhe: zelle('sekundaer', 'ruhe', SEKUNDAER, '☆ Merken'),
      hover: zelle('sekundaer', 'hover', `${SEKUNDAER} bg-ak-flaeche-2`, '☆ Merken'),
      fokus: zelle('sekundaer', 'fokus', `${SEKUNDAER} ${FOKUS_VORHER}`, '☆ Merken'),
      aus: zelle('sekundaer', 'aus', `${SEKUNDAER} opacity-40`, '☆ Merken'),
    },
  },
  {
    rolle: 'tertiaer',
    name: 'Textknopf',
    zellen: {
      ruhe: zelle('tertiaer', 'ruhe', TERTIAER, '✕'),
      hover: zelle('tertiaer', 'hover', `${TERTIAER} bg-ak-flaeche-2 text-ak-text`, '✕'),
      fokus: zelle('tertiaer', 'fokus', `${TERTIAER} ${FOKUS_VORHER}`, '✕'),
      aus: zelle('tertiaer', 'aus', `${TERTIAER} opacity-30`, '✕'),
    },
  },
  {
    rolle: 'reiter',
    name: 'Reiter, Segment, Navigation',
    zellen: {
      ruhe: zelle('reiter', 'ruhe', `${SEGMENT} text-ak-leise`, 'Monat'),
      hover: zelle('reiter', 'hover', `${SEGMENT} text-ak-text`, 'Monat'),
      fokus: zelle('reiter', 'fokus', `${SEGMENT} text-ak-leise ${FOKUS_VORHER}`, 'Monat'),
      gewaehlt: (
        <span className="flex flex-wrap items-center gap-2">
          {zelle('reiter', 'gewaehlt', `${SEGMENT} bg-ak-akzent text-ak-auf-akzent`, 'Woche')}
          {zelle('reiter-news', 'gewaehlt', `${NEWS_CHIP} bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt`, 'Alles')}
          {zelle('reiter-nav', 'gewaehlt', 'border-b-2 border-ak-akzent py-1 text-sm font-semibold text-ak-text', 'Kalender', 'a')}
        </span>
      ),
      aus: zelle('reiter', 'aus', `${SEGMENT} text-ak-leise opacity-40`, 'Monat'),
    },
  },
  {
    rolle: 'pille',
    name: 'Filter-Pille',
    zellen: {
      ruhe: zelle('pille', 'ruhe', `${PILLE} ${PILLE_RUHE}`, 'Action'),
      hover: zelle('pille', 'hover', `${PILLE} border-slate-400 text-slate-900 dark:border-white/40 dark:text-white`, 'Action'),
      fokus: zelle('pille', 'fokus', `${PILLE} ${PILLE_RUHE} ${FOKUS_VORHER}`, 'Action'),
      gewaehlt: (
        <span className="flex flex-wrap items-center gap-2">
          {zelle('pille', 'gewaehlt', `${PILLE} ${PILLE_JA}`, 'Action')}
          {zelle('pille-nein', 'gewaehlt', `${PILLE} ${PILLE_NEIN}`, <><span aria-hidden="true" className="no-underline">⊘</span>Ecchi</>)}
        </span>
      ),
      aus: zelle('pille', 'aus', `${PILLE} ${PILLE_RUHE} opacity-40`, 'Action'),
    },
  },
  {
    rolle: 'link',
    name: 'Link im Text',
    zellen: {
      ruhe: zelle('link', 'ruhe', 'text-sm text-sky-700 dark:text-sky-300', '2 weitere Schreibweisen', 'a'),
      hover: zelle('link', 'hover', 'text-sm text-sky-700 underline dark:text-sky-300', '2 weitere Schreibweisen', 'a'),
      fokus: zelle('link', 'fokus', `text-sm text-sky-700 dark:text-sky-300 ${FOKUS_VORHER}`, '2 weitere Schreibweisen', 'a'),
    },
  },
  {
    rolle: 'kachel',
    name: 'Kachel, Karte',
    zellen: {
      ruhe: zelle('kachel', 'ruhe', KACHEL, '', 'div'),
      hover: zelle('kachel', 'hover', `${KACHEL} border-ak-leise`, '', 'div'),
      fokus: zelle('kachel', 'fokus', `${KACHEL} ${FOKUS_VORHER}`, '', 'div'),
      gewaehlt: zelle('kachel', 'gewaehlt', `${KACHEL} ring-2 ring-ak-akzent`, '', 'div'),
      aus: zelle('kachel', 'aus', `${KACHEL} opacity-50`, '', 'div'),
    },
  },
  {
    rolle: 'liste',
    name: 'Listeneintrag',
    zellen: {
      ruhe: zelle('liste', 'ruhe', LISTE, '16:45 Yashahime'),
      hover: zelle('liste', 'hover', `${LISTE} bg-slate-50 dark:bg-slate-900/60`, '16:45 Yashahime'),
      fokus: zelle('liste', 'fokus', `${LISTE} ${FOKUS_VORHER}`, '16:45 Yashahime'),
      gewaehlt: zelle('liste', 'gewaehlt', `${LISTE} bg-ak-flaeche-2`, '16:45 Yashahime'),
      aus: zelle('liste', 'aus', `${LISTE} opacity-60`, '16:45 Yashahime'),
    },
  },
]

/** Die ganze Tafel: Farbfelder, dann die Zustandsmatrix. */
export function DesignTafel() {
  return (
    <div className="min-h-full bg-ak-grund p-4 text-ak-text">
      <h1 className="mb-3 font-display text-t2 font-bold">Farbrollen</h1>
      <div className="mb-6 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {ROLLEN.map((r) => (
          <Farbfeld key={r} rolle={r} />
        ))}
      </div>
      <h1 className="mb-3 font-display text-t2 font-bold">Zustände je Bauteil</h1>
      <table className="w-full border-separate border-spacing-y-2 text-t4">
        <thead>
          <tr className="text-left text-t5 font-bold tracking-wide text-ak-leise uppercase">
            <th className="pr-2">Bauteil</th>
            {ZUSTAENDE.map((z) => (
              <th key={z} className="pr-2">{z === 'aus' ? 'deaktiviert' : z}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZEILEN.map((zeile) => (
            <tr key={zeile.rolle} className="align-middle">
              <td className="pr-2 font-semibold text-ak-leise">{zeile.name}</td>
              {ZUSTAENDE.map((z) => (
                <td key={z} className="pr-2">{zeile.zellen[z] ?? <span className="text-ak-sehr-leise">—</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
