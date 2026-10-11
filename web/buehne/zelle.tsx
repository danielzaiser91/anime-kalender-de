import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource-variable/manrope'
import './zelle.css'
import { loadDataset, type Dataset } from '../src/lib/data.ts'
import { Detailpanel } from './ausschnitte/detailpanel.tsx'
import type { Fall } from './faelle.ts'
import { ladeMockups } from './mockups-laden.ts'
import { mockupMit } from './register.ts'

/** Hell oder dunkel genauso wie in `main.tsx`: Klasse am `<html>` ist die Wahrheit. */
function setzeThema(dunkel: boolean): void {
  document.documentElement.classList.toggle('dark', dunkel)
  document.documentElement.style.colorScheme = dunkel ? 'dark' : 'light'
}

function Zelle({ werte, fall }: { werte: URLSearchParams; fall: Fall }) {
  const [data, setData] = useState<Dataset>()
  const def = mockupMit(werte.get('mockup') ?? '')
  useEffect(() => {
    void loadDataset().then(setData)
  }, [])
  if (!data || !def) return null
  const ersatz = def.varianten[werte.get('v') ?? '']?.ersatz ?? {}
  return <Detailpanel data={data} titleId={fall.titleId} ersatz={ersatz} />
}

/** Eine Zelle des Rasters: ein Mockup, ein Fall, ein Thema, eine Variante (leer = Vorher) — in einem eigenen Rahmen, damit Breite und Thema echt sind. */
export function zeigeZelle(root: HTMLElement, werte: URLSearchParams, fall: Fall): void {
  ladeMockups()
  setzeThema(werte.get('thema') === 'dunkel')
  createRoot(root).render(<Zelle werte={werte} fall={fall} />)
}
