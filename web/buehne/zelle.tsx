import { createRoot } from 'react-dom/client'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource-variable/manrope'
import './zelle.css'
import { AUSSCHNITTE } from './ausschnitte/index.ts'
import type { Fall } from './faelle.ts'
import { ladeMockups } from './mockups-laden.ts'
import { ZelleInhalt } from './zelle-inhalt.tsx'

/** Hell oder dunkel genauso wie in `main.tsx`: Klasse am `<html>` ist die Wahrheit. */
function setzeThema(dunkel: boolean): void {
  document.documentElement.classList.toggle('dark', dunkel)
  document.documentElement.style.colorScheme = dunkel ? 'dark' : 'light'
}

/** Eine Zelle des Rasters: ein Mockup, ein Fall, ein Thema, eine Variante (leer = Vorher) — in einem eigenen Rahmen, damit Breite und Thema echt sind. */
export function zeigeZelle(root: HTMLElement, werte: URLSearchParams, fall: Fall): void {
  ladeMockups()
  setzeThema(werte.get('thema') === 'dunkel')
  createRoot(root).render(<ZelleInhalt werte={werte} fall={fall} ausschnitte={AUSSCHNITTE} />)
}
