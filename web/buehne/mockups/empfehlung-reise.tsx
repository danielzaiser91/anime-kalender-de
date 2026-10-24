import { anzeigeName } from '@shared/titles.ts'
import { useDatensatz } from '../ausschnitte/datensatz.ts'
import type { Dataset } from '../../src/lib/data.ts'
import type { Fall } from '../faelle.ts'
import { mockup, type Entwurf } from '../register.ts'
import { waehleVorschlaege } from './empfehlung-reise-wahl.ts'

/** Prüfstein der neuen Bühnen-Ansicht „entwurf“: die Empfehlungsseite (T-133, Reise R4) als Einleitung und als Fünf Vorschläge. */
const Einleitung: Entwurf = () => (
  <section className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
    <p className="font-display text-sm text-ak-akzent-text">Was gucken?</p>
    <h1 className="text-3xl font-bold text-ak-text">Zeig uns, was du magst.</h1>
    <p className="max-w-sm text-ak-leise">Wir zeigen dir, was du als Nächstes guckst. Sechs schnelle Duelle, dann kommen die Vorschläge.</p>
    <button type="button" className="min-h-11 rounded-full bg-ak-akzent px-6 font-semibold text-white">Los geht&apos;s</button>
    <span className="text-xs text-ak-leise">Alles bleibt in deinem Browser.</span>
  </section>
)

const Vorschlaege: Entwurf = ({ fall }: { fall: Fall }) => {
  const data = useDatensatz()
  return data ? <VorschlaegeAnsicht fall={fall} data={data} /> : null
}

/** Die Vorschläge samt Datensatz (getrennt vom Laden, damit ein Render-Test sie ohne Browser sieht). */
export function VorschlaegeAnsicht({ fall, data }: { fall: Fall; data: Pick<Dataset, 'titles' | 'titleById'> }) {
  const ids = waehleVorschlaege(data.titles.map((t) => t.id), fall.nutzer, 5)
  const gemerkt = new Set(fall.nutzer?.merkliste ?? [])
  return (
    <section className="p-4">
      <h2 className="text-xl font-bold text-ak-text">Fünf Vorschläge für dich</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ids.map((id) => {
          const titel = data.titleById.get(id)!
          return (
            <li key={id} className="flex min-w-0 flex-col gap-2">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ak-flaeche-3">
                {titel.coverImage && <img src={titel.coverImage} alt="" className="h-full w-full object-cover" />}
                {gemerkt.has(id) && <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ak-favorit text-ak-grund" aria-label="Gemerkt">★</span>}
              </div>
              <p className="line-clamp-2 text-sm font-bold text-ak-text">{anzeigeName(titel)}</p>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-full bg-ak-akzent px-5 font-semibold text-white">Noch vier Duelle – genauer</button>
        <button type="button" className="min-h-11 rounded-full border border-ak-rand px-5 text-ak-text">Von vorn</button>
      </div>
    </section>
  )
}

mockup({
  name: 'empfehlung-reise',
  titel: 'Empfehlungen: Reise R4 (Prüfstein neue Ansicht)',
  ausschnitt: 'entwurf',
  faelle: ['nutzer-neu', 'nutzer-aktiv'],
  varianten: {
    A: { ersatz: {}, entwurf: Einleitung, notiz: 'Einleitung: ein Satz, ein Knopf. Vorher: es gibt die Seite heute nicht.' },
    B: { ersatz: {}, entwurf: Vorschlaege, notiz: 'Fünf Vorschläge; im Fall „3 gemerkt, 5 gesehen“ stehen Gemerktes vorn (★) und Gesehenes fehlt.' },
  },
})
