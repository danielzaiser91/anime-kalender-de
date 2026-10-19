export interface TitelNamen {
  titleDe: string
  titleEn?: string
  titleRomaji?: string
}

export interface Abweichung {
  gefunden: string
  angezeigt: string
}

/** Festgeschriebene Altfunde (19.10.2026), je „Dateiname|gefundener Name“; neue Funde brechen ab, ein behobener Altfund muss hier gestrichen werden. */
export const ALTFUNDE: readonly string[] = [
  '56-ranma-deutsche-folgen-korrigiert-1-80|Ranma ½',
  'adn-synchro-86-fire-force-bestaetigt|86 EIGHTY-SIX',
  'digimon-haganai-bei-prime|Haganai',
  'sailor-moon-und-a-new-dawn-blu-ray-termine|Sailor Moon',
  'studio-bei-ueber-100-weiteren-titeln|Ao no Exorcist',
  'studio-bei-ueber-100-weiteren-titeln|Final Fantasy',
]

const maskiere = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Nennt der Text den englischen oder Romaji-Namen eines Titels (Großschreibung wörtlich, ganze Wörter), den die Seite anders anzeigt,
 * obwohl ein Titel mit genau diesem Namen als `titleDe` fehlt und der angezeigte Name nicht im Text steht? Reine Kleinwörter („orange“) zählen nicht.
 */
export function abweichendeTitel(text: string, titel: TitelNamen[]): Abweichung[] {
  const angezeigt = new Set(titel.map((t) => t.titleDe))
  const funde = new Map<string, string>()
  for (const t of titel) {
    if (text.includes(t.titleDe)) continue
    for (const n of [t.titleEn, t.titleRomaji]) {
      if (!n || n.length < 6 || n === n.toLowerCase() || angezeigt.has(n) || funde.has(n)) continue
      if (new RegExp(`(?<![\\p{L}\\p{N}])${maskiere(n)}(?![\\p{L}\\p{N}])`, 'u').test(text)) funde.set(n, t.titleDe)
    }
  }
  return [...funde].map(([gefunden, angez]) => ({ gefunden, angezeigt: angez }))
}

/** Meldungen für Einträge (Dateiname, Text + Untertitel), abzüglich der Altfunde; übrig gebliebene Altfunde melden sich selbst. */
export function titelMeldungen(eintraege: { name: string; text: string }[], titel: TitelNamen[], altfunde: readonly string[] = ALTFUNDE): string[] {
  const gesehen = new Set<string>()
  const neu: string[] = []
  for (const e of eintraege) {
    for (const a of abweichendeTitel(e.text, titel)) {
      const schluessel = `${e.name}|${a.gefunden}`
      gesehen.add(schluessel)
      if (!altfunde.includes(schluessel)) neu.push(`${e.name}: nennt „${a.gefunden}“, die Seite zeigt „${a.angezeigt}“ (Titel = titleDe, wörtlich)`)
    }
  }
  const behoben = altfunde.filter((s) => !gesehen.has(s)).map((s) => `Altfund ${s} kommt nicht mehr vor: aus ALTFUNDE streichen`)
  return [...neu, ...behoben]
}
