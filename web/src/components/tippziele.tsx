import { useEffect } from 'react'
import { useVorschau } from '../lib/vorschau.ts'
import '../tippziele.css'

/** Setzt `data-tippziele` am Dokument, solange die Vorschau „tippziele“ an ist; die Regeln stehen in `tippziele.css`. */
export function TippzieleSchalter(): null {
  const v = useVorschau('tippziele')
  useEffect(() => {
    if (!v) return
    document.documentElement.dataset.tippziele = v
    return () => {
      delete document.documentElement.dataset.tippziele
    }
  }, [v])
  return null
}
