export type Geraet = '375' | '512' | 'beide'
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
}

export const STANDARD: Omit<Zustand, 'mockup'> = { variante: '', fall: '', geraet: '375', thema: 'beide', teil: 'beide' }

/** Teilt `#name?a=1` in Namen und Werte. */
export function leseHash(hash: string): { name: string; werte: URLSearchParams } {
  const [name = '', abfrage = ''] = hash.replace(/^#/, '').split('?')
  return { name: decodeURIComponent(name), werte: new URLSearchParams(abfrage) }
}

const wahl = <T extends string>(wert: string | null, erlaubt: readonly T[], sonst: T): T => (erlaubt.includes(wert as T) ? (wert as T) : sonst)

export function zustandAus(name: string, w: URLSearchParams): Zustand {
  return {
    mockup: name,
    variante: w.get('v') ?? STANDARD.variante,
    fall: w.get('fall') ?? STANDARD.fall,
    geraet: wahl(w.get('geraet'), ['375', '512', 'beide'], STANDARD.geraet),
    thema: wahl(w.get('thema'), ['hell', 'dunkel', 'beide'], STANDARD.thema),
    teil: wahl(w.get('teil'), ['vorher', 'nachher', 'beide'], STANDARD.teil),
  }
}

export function hashVon(z: Zustand): string {
  const w = new URLSearchParams({ v: z.variante, fall: z.fall, geraet: z.geraet, thema: z.thema, teil: z.teil })
  return `#${encodeURIComponent(z.mockup)}?${w}`
}
