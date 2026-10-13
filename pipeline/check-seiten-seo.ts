/**
 * Zusicherungen zu den Seiten für Suchmaschinen (13.10.2026): Ähnliche Titel bevorzugen belegte Synchro,
 * das A–Z-Verzeichnis, Brotkrumen und die Überschriften der Titelseiten. Läuft in `check:logic`, ohne Bestand.
 */
import { readFileSync } from 'node:fs'
import { aehnlicheTitel } from '../shared/aehnlich.ts'
import type { Title } from '../shared/types.ts'
import { startseiteInhalt } from './lib/startseite.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, dubConfidence: Title['dubConfidence'], keywords: string[]): Title =>
  ({ id, slug: String(id), genres: ['Action'], keywords, dubConfidence, streams: [] }) as unknown as Title

{
  const fueller = Array.from({ length: 60 }, (_, i) => titel(1000 + i, 'high', [`f${i}`]))
  const ich = titel(1, 'high', ['k1', 'k2', 'k3'])
  const unbelegt = titel(2, 'normal', ['k1', 'k2', 'k3'])
  const belegt = titel(3, 'high', ['k1', 'k2', 'k3', 'k4'])
  const v = aehnlicheTitel(ich, [ich, unbelegt, belegt, ...fueller])
  const anteil = (id: number) => v.find((x) => x.title.id === id)?.anteil ?? 0
  pruefe('Ausgangslage: der unbelegte Titel ist rechnerisch ähnlicher', anteil(2) > anteil(3), v.map((x) => [x.title.id, x.anteil]))
  pruefe('Ähnliche Titel: belegte Synchro steht vor unbelegter', v[0]?.title.id === 3 && v[1]?.title.id === 2, v.map((x) => x.title.id))
  const nurUnbelegt = aehnlicheTitel(ich, [ich, unbelegt, ...fueller])
  pruefe('ein unbelegter Titel bleibt ein Vorschlag, wenn es keinen belegten gibt', nurUnbelegt[0]?.title.id === 2)
}

{
  const kopf = readFileSync('web/index.html', 'utf8')
  const inhalt = startseiteInhalt('<li>Termin</li>\n', 1)
  pruefe('Startseite: <title> nennt „Deutscher Anime-Kalender“', /<title>[^<]*Deutscher Anime-Kalender[^<]*<\/title>/.test(kopf))
  pruefe('Startseite: Überschrift ist „Deutscher Anime-Kalender“', inhalt.includes('>Deutscher Anime-Kalender</h1>'))
  pruefe('Startseite: Text nennt Synchro und die Anbieter', /Synchro/.test(inhalt) && ['Crunchyroll', 'Netflix', 'Prime Video'].every((a) => inhalt.includes(a)))
  pruefe('Startseite: die App überschreibt den Titel nicht', !/document\.title\s*=/.test(readFileSync('web/src/lib/i18n.tsx', 'utf8')))
}

if (fehler) process.exit(1)
console.log('check-seiten-seo: ok')
