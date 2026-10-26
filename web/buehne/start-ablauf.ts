import type { FaelleDatei, Fall } from './faelle.ts'
import { bereiteSpeicherVor } from './speicher-je-zelle.ts'
import { leseHash, zeitAus } from './zustand.ts'

/** Alles, was der Start von außen braucht; der Test setzt Attrappen ein (`tools/buehne-start.test.ts`). */
export interface StartUmgebung {
  hash: () => string
  fenster: object
  wurzel: () => HTMLElement
  ladeFaelle: () => Promise<FaelleDatei>
  friereZeitEin: (iso: string) => void
  biegeFetchUm: (faelle: FaelleDatei, fall: Fall) => void
  zeigeZelle: (root: HTMLElement, werte: URLSearchParams, fall: Fall) => Promise<void> | void
  zeigeRahmen: (root: HTMLElement, faelle: FaelleDatei) => Promise<void> | void
}

/*
  Reihenfolge ist Absicht: erst Fälle laden, dann Uhr, Speicher und `fetch` umbiegen, erst danach die App-Module laden —
  Teile der App lesen „heute" oder den Speicher beim Laden. Kein Netz: `fetch` kennt nur die Fälle.
*/
export async function startAblauf(u: StartUmgebung): Promise<void> {
  const faelle = await u.ladeFaelle()
  const { name, werte } = leseHash(u.hash())
  u.friereZeitEin(zeitAus(werte) || faelle.heute)
  bereiteSpeicherVor(name, u.fenster)
  const fall = faelle.faelle[werte.get('fall') ?? ''] ?? Object.values(faelle.faelle)[0]!
  u.biegeFetchUm(faelle, fall)
  if (name === 'zelle') await u.zeigeZelle(u.wurzel(), werte, fall)
  else await u.zeigeRahmen(u.wurzel(), faelle)
}
