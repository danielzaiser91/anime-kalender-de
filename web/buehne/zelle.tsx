import { createRoot } from 'react-dom/client'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource-variable/manrope'
import './zelle.css'
import { AUSSCHNITTE } from './ausschnitte/index.ts'
import type { Fall } from './faelle.ts'
import { ladeMockups } from './mockups-laden.ts'
import { mockupMit } from './register.ts'

/** Hell oder dunkel genauso wie in `main.tsx`: Klasse am `<html>` ist die Wahrheit. */
function setzeThema(dunkel: boolean): void {
  document.documentElement.classList.toggle('dark', dunkel)
  document.documentElement.style.colorScheme = dunkel ? 'dark' : 'light'
}

function Zelle({ werte, fall }: { werte: URLSearchParams; fall: Fall }) {
  const def = mockupMit(werte.get('mockup') ?? '')
  if (!def) return null
  const Ausschnitt = AUSSCHNITTE[def.ausschnitt]
  const variante = def.varianten[werte.get('v') ?? '']
  return (
    <>
      {variante?.stil && <style>{variante.stil}</style>}
      <Ausschnitt fall={fall} ersatz={variante?.ersatz ?? {}} />
    </>
  )
}

/** Eine Zelle des Rasters: ein Mockup, ein Fall, ein Thema, eine Variante (leer = Vorher) — in einem eigenen Rahmen, damit Breite und Thema echt sind. */
export function zeigeZelle(root: HTMLElement, werte: URLSearchParams, fall: Fall): void {
  ladeMockups()
  setzeThema(werte.get('thema') === 'dunkel')
  createRoot(root).render(<Zelle werte={werte} fall={fall} />)
}
