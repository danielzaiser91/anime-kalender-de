import { useEffect } from 'react'
import '../tippziele.css'

/** Setzt `data-tippziele` am Dokument (Mindest-Trefferfläche 44 px); die Regeln stehen in `tippziele.css`. */
export function TippzieleSchalter(): null {
  useEffect(() => {
    document.documentElement.dataset.tippziele = 'gross'
  }, [])
  return null
}
