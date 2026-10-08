import type { Title } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { DeFlaggeZeichen } from './de-flagge.tsx'
import { ergebnisText, zaehlTeile } from './db-kopfzeile.tsx'

/* Bausteine der Vorschauen `db-reserve` und `db-ohne-synchro` (lib/vorschau.ts). */

/** Gleiches Raster wie die Datenbank selbst — sonst springt die Seite beim Füllen. */
const RASTER = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'

/** Farbfläche aus dem Namen (stabil je Titel) mit dem Anfangsbuchstaben; ersetzt die graue Leere ohne Cover. */
export function CoverPlatzhalter({ name }: { name: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.codePointAt(0)!) % 360
  const buchstabe = [...name.replace(/^[^\p{L}\p{N}]+/u, '')][0]?.toUpperCase() ?? '?'
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-white/85"
      style={{ background: `hsl(${h} 32% 38%)` }}
    >
      {buchstabe}
    </span>
  )
}

/** Platzhalter für die Datenbank, solange die Titelliste lädt: Schalterzeile, Zählzeile und Kacheln in ihrer späteren Größe, mindestens eine Bildschirmhöhe. */
export function DbGeruest({ label }: { label: string }) {
  return (
    <div className="flex min-h-[100svh] flex-col gap-4" role="status" aria-label={label}>
      <div className="h-[34px] w-full max-w-xl animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none dark:bg-white/5" />
      <div className="h-[30px] w-full animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none dark:bg-white/[0.04]" />
      <div className={RASTER}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-slate-200 motion-reduce:animate-none dark:border-white/10">
            <div className="aspect-[2/3] bg-slate-200 dark:bg-white/5" />
            <div className="h-[96px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Vorschau `db-ohne-synchro`: statt der doppelten Zählung ein Hinweis und eine Zählzeile. */
export function OhneSynchroZeile({ titles, ergebnisse, gebuendelt, suche }: { titles: Title[]; ergebnisse: number; gebuendelt: boolean; suche: string }) {
  const { t } = useLang()
  const z = zaehlTeile(titles)
  const zahl = (n: number) => n.toLocaleString('de-DE')
  return (
    <span className="flex flex-col gap-1">
      <span className="font-semibold text-slate-800 dark:text-slate-100">{ergebnisText(ergebnisse, gebuendelt, suche, t)}</span>
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        <DeFlaggeZeichen /> <b className="font-semibold text-slate-700 dark:text-slate-200">{zahl(z.anime + z.cartoons)}</b> mit deutscher Synchro ·{' '}
        <b className="font-semibold text-slate-700 dark:text-slate-200">{zahl(z.ohneAnime + z.ohneCartoons)}</b> ohne
      </span>
      <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[13px] text-slate-700 dark:text-slate-200">
        Titel mit gestricheltem Rand haben keine deutsche Synchro. Mit dem Stern erfährst du, wenn sich das ändert.
      </span>
    </span>
  )
}
