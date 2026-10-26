import { biegeFetchUm, ladeFaelle } from './faelle.ts'
import { friereZeitEin } from './feste-zeit.ts'
import { startAblauf } from './start-ablauf.ts'

/* Die App-Module werden erst im Ablauf geladen (`start-ablauf.ts`, Reihenfolge ist Absicht). */
void startAblauf({
  hash: () => location.hash,
  fenster: window,
  wurzel: () => document.getElementById('root')!,
  ladeFaelle,
  friereZeitEin,
  biegeFetchUm,
  zeigeZelle: async (root, werte, fall) => (await import('./zelle.tsx')).zeigeZelle(root, werte, fall),
  zeigeRahmen: async (root, faelle) => (await import('./rahmen.tsx')).zeigeRahmen(root, faelle),
})
