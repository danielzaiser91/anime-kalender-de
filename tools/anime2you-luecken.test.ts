/** Tests für tools/anime2you-luecken.ts: nur Deutsch-Zusage + Start + fehlender Bestand zählt als Lücke. */
import type { Ergebnis } from '../pipeline/lib/aussagen-abgleich.ts'
import { luecken } from './anime2you-luecken.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ergebnis = (titel: string, extra: Record<string, unknown>) =>
  ({
    titel,
    art: 'start',
    plattformen: ['primevideo'],
    deutsch: 'ja',
    quelle: { url: `https://www.anime2you.de/news/1/${titel}/`, veroeffentlicht: '2026-10-01', leser: 'anime2you-sammel' },
    bestand: { status: 'neu' },
    ...extra,
  }) as unknown as Ergebnis

const liste = [
  ergebnis('Lücke', {}),
  ergebnis('Unbekannt', { bestand: { status: 'ohne-zuordnung' } }),
  ergebnis('Schon da', { bestand: { status: 'bekannt' } }),
  ergebnis('Anderer Tag', { bestand: { status: 'abweichend' } }),
  ergebnis('Nur Untertitel', { deutsch: 'nein' }),
  ergebnis('Unklar', { deutsch: 'unklar' }),
  ergebnis('Ankündigung', { art: 'synchro-angekuendigt' }),
  ergebnis('Alt', { quelle: { url: 'https://www.anime2you.de/news/2/alt/', veroeffentlicht: '2026-08-01', leser: 'anime2you-sammel' } }),
]

pruefe('Lücke: neu und ohne Zuordnung, alle Fälle mit Bestand oder ohne Deutsch-Zusage nicht', luecken(liste).map((l) => l.titel).join() === 'Lücke,Unbekannt,Alt', luecken(liste).map((l) => l.titel))
pruefe('Lücke: --seit schneidet ältere Artikel ab', luecken(liste, '2026-09-01').map((l) => l.titel).join() === 'Lücke,Unbekannt')
pruefe('Lücke: Status und Artikel stehen im Ergebnis', luecken(liste)[1]?.status === 'ohne-zuordnung' && luecken(liste)[0]?.artikel.endsWith('/Lücke/'))

if (fehler) process.exit(1)
