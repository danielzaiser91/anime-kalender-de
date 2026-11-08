export type Kennzeichen = { ok: true; art: string; dringlichkeit: string; ziel: string; tag: number; monat: number; wartet: string | null }
export type Eintrag = { nr: number; abschnitt: string; zeile: string; k: Kennzeichen; titel: string; eingang: number }
export type Fehler = { nr: number; zeile: string; grund: string }
export function auswerten(text: string, jetzt: number): { rangliste: Eintrag[]; naechster: Eintrag | null; laufend: Eintrag[]; fehler: Fehler[] }
