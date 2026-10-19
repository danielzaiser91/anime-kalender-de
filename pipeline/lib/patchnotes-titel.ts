import { anzeigeName } from '../../shared/titles.ts'

export interface TitelNamen {
  id: number
  titleDe?: string
  titleEn?: string
  titleRomaji?: string
}

export interface Abweichung {
  gefunden: string
  angezeigt: string
}

const MIN_LAENGE = 6

const maskiere = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Ganze Wörter, auch gegenüber Ziffern („2Ao no Exorcist“ ist kein Fund). */
const wortRegex = (n: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${maskiere(n)}(?![\\p{L}\\p{N}])`, 'u')

/** Beginnt `name` mit `kopf` als ganzem Wort (oder ist gleich)? */
const beginntMitWort = (name: string, kopf: string): boolean => name.startsWith(kopf) && !/[\p{L}\p{N}]/u.test(name.charAt(kopf.length))

/** Englischer/Romaji-Name samt dem Teil vor „: “ („Tempal: Item no Chikara“ → „Tempal“). */
function kandidaten(t: TitelNamen): string[] {
  const namen = [t.titleEn, t.titleRomaji].filter((n): n is string => !!n)
  return namen.flatMap((n) => (n.includes(': ') ? [n, n.slice(0, n.indexOf(': '))] : [n]))
}

/**
 * Nennt der Text den englischen oder Romaji-Namen eines Titels (Großschreibung wörtlich, ganze Wörter), den die Seite anders anzeigt
 * (`anzeigeName`), ohne dass der angezeigte Name im Text steht? Kein Fund sind Kleinwörter („orange“), Namen unter 6 Zeichen und Namen,
 * die als ganzes Wort am Anfang eines angezeigten Namens stehen: Kurzform des eigenen („Pororo“ für „Pororo: The Racing Adventure“) oder
 * Reihenname („Sailor Moon“, „Haganai“, „Boonie Bears“). Grenze: Eine Kurzform ohne eigenen Titel („Villainess“ für „Though I Am an Inept
 * Villainess“) erkennt der Wächter nicht.
 */
export function abweichendeTitel(text: string, titel: TitelNamen[]): Abweichung[] {
  const angezeigt = titel.map(anzeigeName)
  const funde = new Map<string, string>()
  titel.forEach((t, i) => {
    if (text.includes(angezeigt[i])) return
    for (const n of kandidaten(t)) {
      if (n.length < MIN_LAENGE || n === n.toLowerCase() || funde.has(n)) continue
      if (!wortRegex(n).test(text)) continue
      if (angezeigt.some((a) => beginntMitWort(a, n))) continue
      funde.set(n, angezeigt[i])
    }
  })
  return [...funde].map(([gefunden, angez]) => ({ gefunden, angezeigt: angez }))
}

/** Meldungen für Einträge (Dateiname, Text + Untertitel). */
export function titelMeldungen(eintraege: { name: string; text: string }[], titel: TitelNamen[]): string[] {
  return eintraege.flatMap((e) =>
    abweichendeTitel(e.text, titel).map((a) => `${e.name}: nennt „${a.gefunden}“, die Seite zeigt „${a.angezeigt}“`),
  )
}
