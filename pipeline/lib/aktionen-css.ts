/**
 * Regeln über die Knopfreihe unter den Vorschlägen (`empfehlung.css`): Zerlegung in Regeln und die Frage, welche Regel den Text
 * „Schon gesehen“ verbergen kann. Rein, damit der Check sie mit Fixture-CSS prüft.
 */

export interface Regel {
  selektor: string
  versteckt: boolean
  /** Köpfe der umgebenden At-Regeln ohne Leerraum, z. B. `@media(min-width:1001px)and(max-height:800px)`. */
  medien: string
}

export const LAPTOP_BLOCK = '@media(min-width:1001px)and(max-height:800px)'

const VERSTECKEND = new Set(['display:none', 'visibility:hidden', 'font-size:0', 'font-size:0px', 'width:0', 'width:0px', 'max-width:0', 'max-width:0px'])

const versteckt = (koerper: string): boolean => koerper.split(';').some((d) => VERSTECKEND.has(d.replace(/!important/, '')))

/** Zerlegt CSS in Regeln; verschachtelte At-Regeln werden durchlaufen und in `medien` festgehalten. */
export function regeln(css: string): Regel[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const aus: Regel[] = []
  const medien: string[] = []
  let kopf = ''
  for (let i = 0; i < text.length; i++) {
    const z = text[i]
    if (z === '{') {
      const k = kopf.trim()
      kopf = ''
      if (k.startsWith('@')) {
        medien.push(k.replace(/\s+/g, ''))
        continue
      }
      const ende = text.indexOf('}', i)
      const koerper = text.slice(i + 1, ende).replace(/\s+/g, '')
      aus.push({ selektor: k, versteckt: versteckt(koerper), medien: medien.join('') })
      i = ende
    } else if (z === '}') {
      medien.pop()
      kopf = ''
    } else kopf += z
  }
  return aus
}

/** Kann der Selektor (kommagetrennt) die Knopfreihe, ihre Nachfahren oder den Text des Gesehen-Knopfs treffen? Im Zweifel ja. */
export function trifftGesehenText(selektor: string, textKlassen: string[]): boolean {
  return selektor.split(',').some((teil) => {
    if (teil.includes('.empf-aktionen')) return true
    if (textKlassen.some((c) => teil.includes(`.${c}`))) return true
    return /\.empf-galerie[^,]*(\bspan|\bi|\bbutton|\bli|\*)\s*$/.test(teil.trim())
  })
}

/** Selektoren der Regeln, die verbergen und den Gesehen-Text erreichen können. */
export function versteckerDesGesehenTexts(alle: Regel[], textKlassen: string[]): string[] {
  return alle.filter((r) => r.versteckt && trifftGesehenText(r.selektor, textKlassen)).map((r) => r.selektor)
}

/** Liegt die Regel des breiten Mittelknopfs der Laptop-Reihe im Block `min-width: 1001px` und `max-height: 800px`? */
export function laptopReiheImBlock(alle: Regel[]): boolean {
  return alle.some((r) => r.selektor.includes('.empf-aktionen button:nth-child(2)') && r.medien === LAPTOP_BLOCK)
}
