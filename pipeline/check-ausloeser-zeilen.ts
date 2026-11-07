/**
 * Zusicherungen zu den Auslöser-Zeilen der Quarantäne-Riegel (31.10.2026): Titel, Termin-URL, Weg-URLs, Weg-Zahl, Kappung;
 * dazu je Riegel (Wege aus Terminen, Termin-Adresse vom Weg, primeOhneTitelseite) ein Lauf, der die Zeile wirklich ausgibt.
 */
import type { Release, Title } from '../shared/types.ts'
import { AUSLOESER_MAX, ausloeserZeile, ausloeserZeilen, type Ausloeser } from './lib/ausloeser-zeilen.ts'
import { ergaenzeWegeAusTerminen } from './bau/11-7-wege-aus-terminen.ts'
import { richteTerminAdressen } from './bau/13-1-termin-adressen.ts'
import { primeOhneTitelseite } from './lib/kalender-plausibilitaet.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail: unknown = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}${detail ? ` — ${JSON.stringify(detail)}` : ''}`)
  }
}

/** Fängt die Ausgabe von `log` (`console.log`) während `f` ab. */
function fange(f: () => void): string[] {
  const zeilen: string[] = []
  const alt = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    f()
  } finally {
    console.log = alt
  }
  return zeilen
}

const eintrag = (titleId: number, mehr: Partial<Ausloeser> = {}): Ausloeser => ({
  titleId,
  name: `Titel ${titleId}`,
  regel: 'regelX',
  terminUrl: 'https://t.example/termin',
  wegVorher: ['https://w.example/a'],
  wegNachher: ['https://w.example/a', 'https://w.example/b'],
  ...mehr,
})

const z = ausloeserZeile(eintrag(7))
pruefe('Zeile nennt Kennung, Name, Regel, Termin-URL', ['7', 'Titel 7', '[regelX]', 'https://t.example/termin'].every((s) => z.includes(s)), z)
pruefe('Zeile nennt nur den neuen Weg (nicht den vorhandenen) und Weg-Zahl 1→2', z.includes('| Weg neu: https://w.example/b |') && !z.includes('w.example/a') && !z.includes('weggefallen') && z.includes('Weg-Zahl 1→2'), z)
const weg = ausloeserZeile(eintrag(9, { wegVorher: ['https://w.example/a', 'https://w.example/c'], wegNachher: ['https://w.example/a'] }))
pruefe('Zeile nennt den weggefallenen Weg, nicht den bleibenden', weg.includes('Weg weggefallen: https://w.example/c |') && !weg.includes('w.example/a') && !weg.includes('Weg neu') && weg.includes('Weg-Zahl 2→1'), weg)
const gleich = ausloeserZeile(eintrag(10, { wegNachher: ['https://w.example/a'] }))
pruefe('ohne Verlust und ohne neuen Weg: „Wege unverändert“ mit dem Bestand als Kontext', gleich.includes('| Wege unverändert: https://w.example/a |') && gleich.includes('Weg-Zahl 1→1'), gleich)
const leer = ausloeserZeile(eintrag(8, { terminUrl: undefined, wegVorher: [], wegNachher: [] }))
pruefe('ohne Termin-URL steht „–“, ohne Wege „Wege unverändert“ und Weg-Zahl 0→0', leer.includes('Termin: – |') && leer.includes('Wege unverändert: –') && leer.includes('Weg-Zahl 0→0'), leer)

const viele = Array.from({ length: AUSLOESER_MAX + 3 }, (_, i) => eintrag(i + 1))
const gekappt = ausloeserZeilen(viele)
pruefe('Kappung: genau MAX Zeilen plus „… und 3 weitere“ mit den Kennungen der drei', gekappt.length === AUSLOESER_MAX + 1 && gekappt.at(-1)!.includes('… und 3 weitere') && gekappt.at(-1)!.includes(`Kennungen: ${AUSLOESER_MAX + 1}, ${AUSLOESER_MAX + 2}, ${AUSLOESER_MAX + 3})`), gekappt.at(-1))
const kappung29 = ausloeserZeilen(Array.from({ length: 29 }, (_, i) => eintrag(i + 1)))
pruefe('29 Einträge: 20 Zeilen, Rest „… und 9 weitere“ mit Kennungen 21 bis 29', kappung29.length === 21 && kappung29.at(-1)!.includes('… und 9 weitere (Kennungen: 21, 22, 23, 24, 25, 26, 27, 28, 29)'), kappung29.at(-1))
pruefe('genau MAX Einträge: keine „weitere“-Zeile', ausloeserZeilen(viele.slice(0, AUSLOESER_MAX)).length === AUSLOESER_MAX)
pruefe('ein Eintrag über MAX: „… und 1 weitere“', ausloeserZeilen(viele.slice(0, AUSLOESER_MAX + 1)).at(-1)!.includes('… und 1 weitere'))
pruefe('leere Liste: keine Zeilen', ausloeserZeilen([]).length === 0)

const SUCHE = 'https://www.amazon.de/s?k=Kuroko'
const SEITE = 'https://www.amazon.de/gp/video/detail/B0TEST0001'
const titel = (id: number, streams: Title['streams'] = []) => ({ id, titleDe: `Kuroko ${id}`, streams }) as unknown as Title
const termin = (titleId: number, platform: string, mehr: Partial<Release> = {}) =>
  ({ slug: `t${titleId}-${platform}`, titleId, platform, releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-02' }, sources: ['https://q.example/'], ...mehr }) as unknown as Release

// Riegel 1: Weg aus Termin (11-7)
const t1 = new Map([[1, titel(1, [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true }])]])
const r1 = [termin(1, 'disneyplus', { platformUrl: 'https://www.disneyplus.com/de-de/browse/entity-x' })]
const l1 = fange(() => ergaenzeWegeAusTerminen({ titles: t1, releases: r1, istTot: () => false, verweiseEntfernt: [], belegFuer: () => undefined }))
const z1 = l1.find((s) => s.includes('[wegAusTermin:disneyplus]')) ?? ''
pruefe('Wege aus Terminen: Zeile mit Termin-URL, Weg vorher/nachher', z1.includes('1 Kuroko 1') && z1.includes('Termin: https://www.disneyplus.com/de-de/browse/entity-x') && z1.includes('Weg neu: https://www.disneyplus.com/') && !z1.includes('netflix.com') && z1.includes('Weg-Zahl 1→2'), l1)

// Riegel 1 mit zwei neuen Wegen am selben Titel: jede Zeile zählt vom Bestand vor der Runde, nicht vom anderen neuen Weg
const t1b = new Map([[4, titel(4, [{ platform: 'netflix', url: 'https://www.netflix.com/title/4', dub: true }])]])
const r1b = [termin(4, 'disneyplus', { platformUrl: 'https://www.disneyplus.com/de-de/browse/entity-y' }), termin(4, 'primevideo', { platformUrl: SEITE })]
const l1b = fange(() => ergaenzeWegeAusTerminen({ titles: t1b, releases: r1b, istTot: () => false, verweiseEntfernt: [], belegFuer: () => undefined }))
const z1b = l1b.filter((s) => s.includes('[wegAusTermin:'))
pruefe('zwei neue Wege: zwei Zeilen, je Weg-Zahl 1→2 und genau ein neuer Weg', z1b.length === 2 && z1b.every((s) => s.includes('Weg-Zahl 1→2') && (s.match(/Weg neu: \S+/g) ?? []).length === 1 && !s.includes('Weg neu: https://www.netflix') && !/Weg neu: \S+ \S+/.test(s.split(' | ')[2] ?? '')), l1b)

// Riegel 2: Termin ohne Adresse übernimmt die des Weges (13-1)
const t2 = [titel(2, [{ platform: 'primevideo', url: SEITE, dub: true }] as Title['streams'])]
const r2 = [termin(2, 'primevideo', { platformUrl: SUCHE })]
const l2 = fange(() => richteTerminAdressen(r2, t2))
const z2 = l2.find((s) => s.includes('[terminAdresseVomWeg]')) ?? ''
pruefe('Termin-Adresse vom Weg: Zeile mit alter und neuer Termin-URL und Weg', z2.includes(`${SUCHE} → ${SEITE}`) && z2.includes('Weg-Zahl 1→1'), l2)

// Riegel 3: primeOhneTitelseite (Treffer-Text geht in die Quarantäne-Meldung)
const prime = primeOhneTitelseite({ titles: [titel(3, [{ platform: 'primevideo', url: SEITE }] as Title['streams'])], releases: [termin(3, 'primevideo', { platformUrl: SUCHE })], events: [], news: [], urteile: {}, kanal: new Set(), heute: '2999-12-31' })
pruefe('primeOhneTitelseite: Treffer nennt Termin-URL und Weg-URL', prime.length === 1 && prime[0]!.text.includes(`Termin: ${SUCHE}`) && prime[0]!.text.includes(SEITE) && prime[0]!.schluessel === 't3-primevideo', prime)

if (fehler) process.exit(1)
console.log('Auslöser-Zeilen: Fälle (Zeile, Unterschied, Kappung, drei Riegel) grün')
