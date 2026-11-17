// Prüfer-Erkennung: Agententyp `pruefer` oder Beschreibung, die mit „Prüfer“ beginnt. Die Grenze in
// .claude/hooks/agenten-grenze.js nimmt Typ `pruefer` aus (AUSGENOMMEN); beide Regeln gemeinsam ändern.
export const istPruefer = (a: { type?: string; description: string }): boolean =>
  a.type === 'pruefer' || /^prüfer/i.test(a.description.trim())

// Knopftext: „Agents 0+2“ (Nicht-Prüfer + Prüfer), ohne Prüfer einfach „Agents 3“.
export const agentenText = (agenten: number, pruefer: number): string =>
  pruefer ? `Agents ${agenten}+${pruefer}` : `Agents ${agenten}`
