import type { Title } from '@shared/types.ts'
import { Cover } from './bilder.tsx'

const SPALTEN = 6
const JE_SPALTE = 4

/** Treibendes Cover-Mosaik mit Schleier: der Hintergrund der Einleitung und der Fortsetzen-Seite. Die Cover kommen, sobald der Titelbestand da ist. */
export function MosaikHintergrund({ titel, ids }: { titel?: Map<number, Title>; ids: number[] }) {
  const mosaik = Array.from({ length: SPALTEN }, (_, s) => Array.from({ length: JE_SPALTE }, (_, i) => ids[(s * JE_SPALTE + i) % Math.max(1, ids.length)]))
  return (
    <>
      {titel && ids.length > 0 && (
        <div className="empf-mosaik" aria-hidden>
          {mosaik.map((spalte, s) => (
            <div key={s} className="empf-spalte" style={{ animationDelay: `-${s * 7}s` }}>
              {spalte.map((id, i) => (
                <Cover key={i} titel={titel.get(id)} breite={92} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="empf-schleier" />
    </>
  )
}
