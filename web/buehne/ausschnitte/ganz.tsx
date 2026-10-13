import App from '../../src/App.tsx'
import { ErsatzKontext } from '../ersatz.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Ausschnitt `ganz`: die ganze App, die ihre Daten selbst lädt (aus dem Gesamtbestand der Fälle). */
export function Ganz({ ersatz }: AusschnittEigenschaften) {
  return (
    <ErsatzKontext.Provider value={ersatz}>
      <App />
    </ErsatzKontext.Provider>
  )
}
