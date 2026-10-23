/**
 * Ablauftest zur Verdrahtung des Prime-Kaufwegs (`bau/11-2-4-kauf-wege.ts`): Der Aufrufer `ergaenzeWegeAusJustwatch` lädt die Handbelege selbst
 * und liest `data/justwatch-audio.json`. Hier läuft er auf einer Kulisse im Temp-Ordner (`AK_ROOT`) mit einem Nein-Handbeleg für Prime —
 * ein leeres `new Set()` am Aufruf oder ein ausgelassener Aufruf bliebe in den Funktionstests grün. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StreamLink, Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'prime-kaufweg-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

const angebote = (n: number) => [
  { anbieter: 'Amazon Video', art: 'BUY', audio: ['de', 'ja'], untertitel: [], url: `https://watch.amazon.de/detail?gti=amzn1.dv.gti.kaufweg${n}` },
]
const befund = (n: number) => ({ geprueftAm: '2999-12-31', jwId: `tm${n}`, altersangabe: '16', angebote: angebote(n) })
writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify({ 900101: befund(1), 900102: befund(2), 900103: befund(3), 900104: befund(4) }))
writeFileSync(join(wurzel, 'data', 'verweise-entfernt.json'), JSON.stringify({ verweise: [{ titleId: 900104, plattform: 'primevideo', grund: 'belegtes Nein (Handprüfung)' }] }))
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  [
    '- anilistId: 900102',
    '  title: Kulisse Nein',
    '  platform: primevideo',
    '  available: false',
    "  checkedAt: '2026-10-23'",
    '',
  ].join('\n'),
)

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

try {
  const { ergaenzeWegeAusJustwatch } = await import('./bau/11-2-justwatch.ts')
  const blu = { name: 'aniSearch', url: 'https://www.anisearch.de/article/1,x', kind: 'buy', zugang: 'kauf' }
  const titel = (id: number) => ({ id, streams: [], watchLinks: [blu], keywords: [], genres: [] }) as unknown as Title
  const titles = new Map([900101, 900102, 900103, 900104].map((id) => [id, titel(id)] as [number, Title]))
  ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig: new Set(['900103']), toteAdressen: new Set() })
  const prime = (id: number) => ((titles.get(id)?.streams ?? []) as StreamLink[]).filter((s) => s.platform === 'primevideo' && s.zugang === 'kauf')
  pruefe('Titel mit Blu-ray-Zeile bekommt den Prime-Kauf', prime(900101).length === 1, titles.get(900101))
  pruefe('Nein-Handbeleg für Prime hält ihn zurück', prime(900102).length === 0, titles.get(900102))
  pruefe('mehrdeutige TMDB-Kennung hält ihn zurück', prime(900103).length === 0, titles.get(900103))
  pruefe('belegtes Nein im Gedächtnis der entfernten Verweise hält ihn zurück', prime(900104).length === 0, titles.get(900104))
  pruefe('die Blu-ray-Zeile bleibt stehen', (titles.get(900101)?.watchLinks ?? []).some((w) => w.name === 'aniSearch'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-prime-kaufweg-ablauf: ok')
