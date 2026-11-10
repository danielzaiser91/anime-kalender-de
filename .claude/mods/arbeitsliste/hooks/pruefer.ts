// Prüfer-Erkennung wie savvy-progress (hooks/pruefer.ts): Agententyp `pruefer` oder Beschreibung, die mit „Prüfer“ beginnt.
// Dort nachführen, falls Savvy die Regel ändert; ein Import über Modgrenzen ist nicht möglich.
export const istPruefer = (a: { type?: string; description: string }): boolean =>
  a.type === 'pruefer' || /^prüfer/i.test(a.description.trim())

// Knopftext: „Agents 0+2“ (Nicht-Prüfer + Prüfer), ohne Prüfer einfach „Agents 3“.
export const agentenText = (agenten: number, pruefer: number): string =>
  pruefer ? `Agents ${agenten}+${pruefer}` : `Agents ${agenten}`
