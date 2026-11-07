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

/** Der Unterschied zum Vorlauf: neu hinzugekommene und weggefallene Weg-URLs; ohne Änderung „Wege unverändert“. */
function wegUnterschied(a: Ausloeser): string {
  const neu = a.wegNachher.filter((u) => !a.wegVorher.includes(u))
  const weg = a.wegVorher.filter((u) => !a.wegNachher.includes(u))
  if (!neu.length && !weg.length) return `Wege unverändert: ${liste(a.wegNachher)}`
  return [neu.length ? `Weg neu: ${liste(neu)}` : '', weg.length ? `Weg weggefallen: ${liste(weg)}` : ''].filter(Boolean).join(' | ')
}

/** Eine Zeile: Kennung, Name, Regel, Termin-URL, Unterschied der Weg-URLs zum Vorlauf, Weg-Zahl. */
export function ausloeserZeile(a: Ausloeser): string {
  return `    ${a.titleId} ${a.name} [${a.regel}] Termin: ${a.terminUrl || '–'} | ${wegUnterschied(a)} | Weg-Zahl ${a.wegVorher.length}→${a.wegNachher.length}`
}

/** Über der Kappung nennt die letzte Zeile Zahl und Kennungen der übrigen, damit keiner still verschwindet. */
export function ausloeserZeilen(eintraege: Ausloeser[], max = AUSLOESER_MAX): string[] {
  const zeilen = eintraege.slice(0, max).map(ausloeserZeile)
  const rest = eintraege.slice(max)
  if (rest.length) zeilen.push(`    … und ${rest.length} weitere (Kennungen: ${rest.map((e) => e.titleId).join(', ')})`)
  return zeilen
}
