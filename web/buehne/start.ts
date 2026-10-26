import { biegeFetchUm, ladeFaelle } from './faelle.ts'
import { friereZeitEin } from './feste-zeit.ts'
import { bereiteSpeicherVor } from './speicher-je-zelle.ts'
import { leseHash, zeitAus } from './zustand.ts'

/*
  Reihenfolge ist Absicht: erst Fälle laden, dann Uhr und `fetch` umbiegen, erst danach die App-Module laden —
  Teile der App lesen „heute" beim Laden. Kein Netz: `fetch` kennt nur die Fälle.
*/
async function start() {
  const faelle = await ladeFaelle()
  const { name, werte } = leseHash(location.hash)
  friereZeitEin(zeitAus(werte) || faelle.heute)
  bereiteSpeicherVor(name, window)
  const fall = faelle.faelle[werte.get('fall') ?? ''] ?? Object.values(faelle.faelle)[0]!
  biegeFetchUm(faelle, fall)
  const root = document.getElementById('root')!
  if (name === 'zelle') (await import('./zelle.tsx')).zeigeZelle(root, werte, fall)
  else (await import('./rahmen.tsx')).zeigeRahmen(root, faelle)
}

void start()
