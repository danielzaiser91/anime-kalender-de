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
pruefe('Zeile nennt Weg-URLs vorher/nachher und Weg-Zahl 1→2', z.includes('vorher: https://w.example/a |') && z.includes('nachher: https://w.example/a https://w.example/b') && z.includes('Weg-Zahl 1→2'), z)
const leer = ausloeserZeile(eintrag(8, { terminUrl: undefined, wegVorher: [], wegNachher: [] }))
pruefe('ohne Termin-URL und Wege steht „–“ und Weg-Zahl 0→0', leer.includes('Termin: – |') && leer.includes('vorher: – |') && leer.includes('nachher: – |') && leer.includes('Weg-Zahl 0→0'), leer)

const viele = Array.from({ length: AUSLOESER_MAX + 3 }, (_, i) => eintrag(i + 1))
const gekappt = ausloeserZeilen(viele)
pruefe('Kappung: genau MAX Zeilen plus „… und 3 weitere“', gekappt.length === AUSLOESER_MAX + 1 && gekappt.at(-1)!.includes('… und 3 weitere'), gekappt.length)
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
const l1 = fange(() => ergaenzeWegeAusTerminen({ titles: t1, releases: r1, toteAdressen: new Set(), verweiseEntfernt: [], belegFuer: () => undefined }))
const z1 = l1.find((s) => s.includes('[wegAusTermin:disneyplus]')) ?? ''
pruefe('Wege aus Terminen: Zeile mit Termin-URL, Weg vorher/nachher', z1.includes('1 Kuroko 1') && z1.includes('Termin: https://www.disneyplus.com/de-de/browse/entity-x') && z1.includes('vorher: https://www.netflix.com/title/1 |') && z1.includes('Weg-Zahl 1→2'), l1)

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
console.log('Auslöser-Zeilen: 10 Fälle (Zeile, Kappung, drei Riegel) grün')
