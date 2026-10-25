/**
 * Zusicherungen zu Sortierung, Cover, F-Sperre und Saison-Ausblick am gebauten Bestand (`public/data/*`, `data/anisearch-cover.json`).
 * Läuft in `check:bestand` (nach dem Bau), nicht in `check:logic`: Der Bestand liegt hinter neueren Rohdaten zurück,
 * sobald ein Sammel- oder Cover-Lauf sie erneuert, und würde sonst jeden PR rot machen (12.10.2026).
 * Die reinen Logik-Zusicherungen stehen in `check-bild-und-synchro.ts`.
 */
import { readFileSync } from 'node:fs'
import type { SaisonDatei, SaisonKatalogTitel } from '../web/src/lib/saison.ts'
import { ausblickGruppen } from '../web/src/lib/saison-ausblick.ts'
import { todayIso } from '../shared/time.ts'
import { istSerie, saisonVon, saisonZeitraum, type SaisonTag } from '../shared/saison.ts'
import { sortiereNachTitel } from '../web/src/lib/titel-sortierung.ts'
import { anzeigeName } from '../shared/titles.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const jsonDatei = <T>(name: string): T => JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as T

console.log('Sortierung nach Titel')
const echte = jsonDatei<Title[]>('titles.json').slice(0, 400)
const kollator = new Intl.Collator('de')
const rangfolge = echte.slice().sort((x, y) => kollator.compare(anzeigeName(x), anzeigeName(y)) || x.id - y.id)
const mitRang = echte.map((t) => ({ ...t, tr: rangfolge.findIndex((r) => r.id === t.id) }))
const ohneRang = echte.map((t) => ({ ...t }))
const gruppeMit = mitRang.map((main) => ({ main }))
const gruppeOhne = ohneRang.map((main) => ({ main }))
sortiereNachTitel(gruppeMit)
sortiereNachTitel(gruppeOhne)
pruefe('mit Rang und ohne Rang ergibt dieselbe Reihenfolge', gruppeMit.every((g, i) => g.main.id === gruppeOhne[i]!.main.id))
pruefe('die Reihenfolge ist die der deutschen Sortierung', gruppeOhne.every((g, i) => i === 0 || kollator.compare(anzeigeName(gruppeOhne[i - 1]!.main), anzeigeName(g.main)) <= 0))

console.log('Cover für aniSearch-Titel (AniList über die MAL-Kennung)')
const kern = JSON.parse(readFileSync('public/data/titles-core.json', 'utf8')) as { id: number; coverImage?: string }[]
const ohneCover = kern.filter((t) => !t.coverImage).map((t) => t.id)
pruefe('jeder Kern-Titel trägt ein Cover', ohneCover.length === 0, ohneCover)
/* Alle ausgelieferten aniSearch-Titel: Steht die MAL-Kennung im Cover-Bestand, muss der Titel das Cover tragen (08.10.2026: der Bestand lag im Actions-Cache, der Bau sah ihn nicht). */
const eintraege = JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { mal?: number }>
const coverBestand = JSON.parse(readFileSync('data/anisearch-cover.json', 'utf8')) as Record<string, unknown>
const alleTitel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { anisearchId?: number; coverImage?: string; titleRomaji: string }[]
const mitQuelleOhneCover = alleTitel
  .filter((t) => t.anisearchId && !t.coverImage && coverBestand[String(eintraege[String(t.anisearchId)]?.mal)])
  .map((t) => t.titleRomaji)
pruefe('kein ausgelieferter Titel mit Cover-Quelle (MAL-Kennung im Cover-Bestand) ohne Cover', mitQuelleOhneCover.length === 0, mitQuelleOhneCover)

console.log('F-Sperre (Fanservice-Urteil von Hand, data/fanservice-urteil.yaml)')
const gesperrt = new Set([...readFileSync('data/fanservice-urteil.yaml', 'utf8').matchAll(/^\s*-\s*id:\s*(\d+)/gm)].map((m) => Number(m[1])))
const prominent: [string, number[]][] = [
  ['releases.json', jsonDatei<{ titleId: number }[]>('releases.json').map((r) => r.titleId)],
  ['events.json', jsonDatei<{ titleId: number }[]>('events.json').map((r) => r.titleId)],
  ['news.json', jsonDatei<{ titelId: number }[]>('news.json').map((r) => r.titelId)],
  ['neu-mit-synchro.json', jsonDatei<{ id: number }[]>('neu-mit-synchro.json').map((r) => r.id)],
  ['titles-core.json', jsonDatei<{ id: number }[]>('titles-core.json').map((r) => r.id)],
]
for (const [datei, kennungen] of prominent) pruefe(`kein gesperrter Titel in ${datei} (die F-Sperre greift im Bau nicht, wenn einer auftaucht)`, !kennungen.some((i) => gesperrt.has(i)), kennungen.filter((i) => gesperrt.has(i)))

console.log('Saison-Ausblick: nichts fällt weg')
{
  const heute = todayIso()
  const voll = jsonDatei<Title[]>('titles.json')
  /* Die Seite rechnet auf dem Kern, nicht auf dem vollen Bestand — sonst bliebe eine Serie ohne Release unbemerkt draußen (Devil May Cry: Staffel 2). */
  const titel = jsonDatei<Title[]>('titles-core.json')
  const datei = jsonDatei<SaisonDatei>('saison.json')
  const ausblick = jsonDatei<{ katalog: SaisonKatalogTitel[] }>('saison-ausblick.json').katalog
  const gruppen = ausblickGruppen(titel, new Map(), datei, ausblick, heute)
  const inGruppen = gruppen.flatMap((g) => g.zeilen.map((z) => z.id))
  /* Quellmenge: kommende Serien des Hauptbestands (Saison nach der laufenden, oder ohne Saison im laufenden Jahr oder später) und alle Katalogtitel der Ausblick-Datei. */
  const kommend = (t: Title) => istSerie(t.format) && Boolean(t.jpYear) && (t.jpSeason ? saisonZeitraum({ jahr: t.jpYear!, saison: t.jpSeason as SaisonTag['saison'] })[0] > saisonZeitraum(saisonVon(heute))[1] : t.jpYear! >= saisonVon(heute).jahr)
  const quelle = new Set([...voll.filter(kommend).map((t) => t.id), ...ausblick.map((k) => k.id)])
  pruefe('jede Serie der Quellmenge steht in genau einer Gruppe', inGruppen.length === new Set(inGruppen).size && [...quelle].every((i) => inGruppen.includes(i)), [...quelle].filter((i) => !inGruppen.includes(i)))
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) im Bestand verletzt.`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Bild, F-Sperre und Saison-Ausblick im Bestand: Zusicherungen erfüllt.')
console.log('VERSTÖSSE: 0')
