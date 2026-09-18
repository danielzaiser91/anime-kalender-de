/**
 * **Kontrast nach WCAG 2.x** (18.09.2026). Reine Rechnung ohne DOM, damit `check:logic` die
 * Plakettenfarben prüfen kann — die axe-Messung hängt vom Datenstand ab und taugt nicht als
 * Sperrklinke.
 */
export const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const kanal = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const helligkeit = ([r, g, b]: number[]) => 0.2126 * kanal(r!) + 0.7152 * kanal(g!) + 0.0722 * kanal(b!)
export const kontrast = (a: number[], b: number[]) => {
  const [x, y] = [helligkeit(a), helligkeit(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const mische = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + b[i]! * t))
const alsHex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

/** Die beiden hellen Gründe, auf denen Plaketten stehen: Karte und Seite. */
export const HELLE_GRUENDE = [
  [255, 255, 255],
  [246, 247, 251],
]
/** Tönung `${farbe}22` über einem Grund. */
export const toenung = (grund: number[], farbe: number[]) => mische(grund, farbe, 0x22 / 255)

/*
  **Plakettenfarben mit lesbarem Kontrast** (Daniel, 18.09.2026: „hell B, dunkel C“).
  Die Markenfarbe als Schrift auf ihrer eigenen blassen Tönung lag im hellen Thema bei
  allen Anbietern unter 4,5:1 (Prime 2,2, Kino 1,7). Hell bleibt die Tönung, die Schrift
  wird nur so weit Richtung Schwarz gemischt, bis sie auf Tönung über Weiß **und** über
  dem Seitengrund 4,5:1 hält. Dunkel wird die Markenfarbe zur Fläche, Schrift weiß oder
  fast schwarz — was mehr Kontrast hat. Einmal je Farbe gerechnet, nicht je Plakette.
*/
const plakettenFarben = new Map<string, Record<string, string>>()
export function plakettenStil(farbe: string): Record<string, string> {
  let stil = plakettenFarben.get(farbe)
  if (stil) return stil
  const f = rgb(farbe)
  const toenungen = HELLE_GRUENDE.map((grund) => toenung(grund, f))
  let schrift = f
  for (let t = 0; t <= 1 && toenungen.some((g) => kontrast(schrift, g) < 4.5); t += 0.02) schrift = mische(f, [0, 0, 0], t)
  stil = {
    '--pl-bg': `${farbe}22`,
    '--pl-text': alsHex(schrift),
    '--pl-rand': `${farbe}55`,
    '--pl-voll': farbe,
    '--pl-voll-text': kontrast([255, 255, 255], f) >= kontrast([17, 17, 17], f) ? '#fff' : '#111',
  }
  plakettenFarben.set(farbe, stil)
  return stil
}
