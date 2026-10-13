export type Geraet = '375' | '512' | '1200' | 'beide'
export type Thema = 'hell' | 'dunkel' | 'beide'
export type Seitenteil = 'vorher' | 'nachher' | 'beide'

/** Alles, was ein Link zur Bühne trägt: `#<mockup>?v=A&fall=…&geraet=…&thema=…&teil=…`. */
export interface Zustand {
  mockup: string
  variante: string
  fall: string
  geraet: Geraet
  thema: Thema
  teil: Seitenteil
  /** Eingefrorene Uhrzeit als ISO mit Versatz; leer = `faelle.heute`. */
  zeit: string
}

export const STANDARD: Omit<Zustand, 'mockup'> = { variante: '', fall: '', geraet: '375', thema: 'beide', teil: 'beide', zeit: '' }

/** Ein `+` im Link wird beim Lesen zum Leerzeichen; die Uhrzeit trägt ihren Versatz mit `+`. */
export const zeitAus = (w: URLSearchParams): string => (w.get('zeit') ?? STANDARD.zeit).replace(' ', '+')

/** Teilt `#name?a=1` in Namen und Werte. */
export function leseHash(hash: string): { name: string; werte: URLSearchParams } {
  const [name = '', abfrage = ''] = hash.replace(/^#/, '').split('?')
  return { name: dekodiert(name), werte: new URLSearchParams(abfrage) }
}

/** Ein kaputtes `%` im Link soll die Bühne nicht abstürzen lassen. */
function dekodiert(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

const wahl = <T extends string>(wert: string | null, erlaubt: readonly T[], sonst: T): T => (erlaubt.includes(wert as T) ? (wert as T) : sonst)

export function zustandAus(name: string, w: URLSearchParams): Zustand {
  return {
    mockup: name,
    variante: w.get('v') ?? STANDARD.variante,
    fall: w.get('fall') ?? STANDARD.fall,
    geraet: wahl(w.get('geraet'), ['375', '512', '1200', 'beide'], STANDARD.geraet),
    thema: wahl(w.get('thema'), ['hell', 'dunkel', 'beide'], STANDARD.thema),
    teil: wahl(w.get('teil'), ['vorher', 'nachher', 'beide'], STANDARD.teil),
    zeit: zeitAus(w),
  }
}

export function hashVon(z: Zustand): string {
  const w = new URLSearchParams({ v: z.variante, fall: z.fall, geraet: z.geraet, thema: z.thema, teil: z.teil })
  if (z.zeit) w.set('zeit', z.zeit)
  return `#${encodeURIComponent(z.mockup)}?${w}`
}
