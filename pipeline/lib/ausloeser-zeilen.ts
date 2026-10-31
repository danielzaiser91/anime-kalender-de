/**
 * Logzeilen, die den Auslöser einer Bestandsprüfung/Quarantäne nennen (Kuroko Movie 3, 31.10.2026: das CI-Log zeigte nur Zählungen).
 * Rein: bekommt fertige Angaben, liest nichts.
 */
export interface Ausloeser {
  titleId: number
  name: string
  regel: string
  terminUrl?: string
  wegVorher: string[]
  wegNachher: string[]
}

/** Höchstens so viele Zeilen je Riegel, der Rest steht als „… und N weitere“. */
export const AUSLOESER_MAX = 20

const liste = (urls: string[]) => (urls.length ? urls.join(' ') : '–')

/** Eine Zeile: Kennung, Name, Regel, Termin-URL, Weg-URLs vorher/nachher, Weg-Zahl. */
export function ausloeserZeile(a: Ausloeser): string {
  return `    ${a.titleId} ${a.name} [${a.regel}] Termin: ${a.terminUrl || '–'} | Wege vorher: ${liste(a.wegVorher)} | nachher: ${liste(a.wegNachher)} | Weg-Zahl ${a.wegVorher.length}→${a.wegNachher.length}`
}

export function ausloeserZeilen(eintraege: Ausloeser[], max = AUSLOESER_MAX): string[] {
  const zeilen = eintraege.slice(0, max).map(ausloeserZeile)
  if (eintraege.length > max) zeilen.push(`    … und ${eintraege.length - max} weitere`)
  return zeilen
}
