/**
 * Zusicherung zur Kachelzahl (Daniel, 11.10.2026): Ein Titel + Weg + Tag ergibt höchstens eine Kachel, wenn dort ein
 * Staffelstart liegt — die Start-Kachel trägt die weiteren Folgen des Tages als „+N Folgen". Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { istStaffelfinale, istStaffelstart } from '../web/src/lib/staffelstart.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Daten = { releaseBySlug: Map<string, Release> }

const rel = (slug: string): Release =>
  ({ slug, titleId: 1, name: slug, platform: 'paramountplus', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-09' } }) as unknown as Release
const ev = (episode: number, extra: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `e${episode}`, releaseSlug: 'w', titleId: 1, date: '2026-10-09', releaseType: 'weekly', platform: 'paramountplus', name: 'X', episode, episodeCount: 13, ...extra }) as unknown as ReleaseEvent

/** Dieselbe Bündelung wie die Woche (`PosterRaster`) und der Monat (`MonatsZelle`). */
function kacheln(stream: ReleaseEvent[], data: Daten): ReleaseEvent[][] {
  return buendeleKacheln(stream, (e) => (istStaffelstart(e, data) ? 'start' : istStaffelfinale(e, data) ? 'finale' : undefined), (e) => !!e.premiere)
}

function einheitenpruefung(): void {
  console.log('\nStaffelstart nimmt die Folgen desselben Tages auf:')
  const klein = { releaseBySlug: new Map([['w', rel('w')]]) }
  const drei = kacheln([ev(1), ev(2), ev(3)], klein)
  pruefe('Folge 1–3 am Starttag sind eine Kachel, Folge 1 vorn', drei.length === 1 && drei[0]!.map((e) => e.episode).join() === '1,2,3', drei)
  const umgekehrt = kacheln([ev(2), ev(3), ev(1)], klein)
  pruefe('… auch wenn Folge 1 nach den anderen in der Liste steht', umgekehrt.length === 1 && umgekehrt[0]![0]!.episode === 1, umgekehrt)
  const andererWeg = kacheln([ev(1), ev(2, { platform: 'netflix' })], klein)
  pruefe('anderer Weg bleibt eine eigene Kachel', andererWeg.length === 2, andererWeg)
  const amStueck = kacheln([ev(1), ev(2), ev(13)], klein)
  pruefe('Staffel am Stück: auch das Finale steht in der Start-Kachel', amStueck.length === 1 && amStueck[0]!.length === 3, amStueck)
  const finale = kacheln([ev(11), ev(12), ev(13)], klein)
  pruefe('Staffelfinale ohne Start am selben Tag bleibt eigenständig', finale.length === 2 && finale[1]![0]!.episode === 13, finale)
  const ausgeblieben = kacheln([ev(1, { verpasst: { erwartetAm: '2026-10-09' } }), ev(2)], klein)
  pruefe('ausgebliebener Start nimmt nichts auf', ausgeblieben.length === 2, ausgeblieben)
  const ohneStart = kacheln([ev(5), ev(6)], klein)
  pruefe('ohne Staffelstart bündelt wie bisher', ohneStart.length === 1 && ohneStart[0]!.length === 2, ohneStart)
}

function bestandspruefung(): void {
  console.log('\nEchter Bestand: je Titel + Weg + Tag mit Staffelstart höchstens eine Kachel:')
  const lies = <T>(pfad: string): T => JSON.parse(readFileSync(new URL(`../public/data/${pfad}`, import.meta.url), 'utf8')) as T
  const daten: Daten = { releaseBySlug: new Map(lies<Release[]>('releases.json').map((r) => [r.slug, r])) }
  const nachTag = new Map<string, ReleaseEvent[]>()
  for (const e of lies<ReleaseEvent[]>('events.json')) {
    if (e.platform === 'tv' || e.releaseType === 'disc' || e.zweitanbieter) continue
    nachTag.set(e.date, [...(nachTag.get(e.date) ?? []), e])
  }
  const schluessel = (e: ReleaseEvent) => `${e.titleId}|${e.platform}|${e.sender ?? ''}`
  const doppelt: string[] = []
  let mitZusatz = 0
  for (const [tag, stream] of nachTag) {
    const gruppen = kacheln(stream, daten)
    for (const g of gruppen) {
      if (!istStaffelstart(g[0]!, daten)) continue
      if (g.length > 1) mitZusatz++
      const uebrige = gruppen.filter((h) => h !== g && schluessel(h[0]!) === schluessel(g[0]!))
      if (uebrige.some((h) => !h[0]!.verpasst && !h[0]!.premiere)) doppelt.push(`${tag} ${g[0]!.name}`)
    }
  }
  pruefe('keine zweite Kachel neben einem Staffelstart', doppelt.length === 0, doppelt.slice(0, 10))
  console.log(`  Info: ${mitZusatz} Staffelstart-Kacheln tragen Zusatzfolgen (Stand ${new Date().toISOString().slice(0, 10)}).`)
}

einheitenpruefung()
bestandspruefung()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
