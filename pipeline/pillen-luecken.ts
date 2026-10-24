/**
 * Welche Anbieter-Pillen (Netflix, Prime, Disney+) keine Folgenzahl zeigen, obwohl der Haken da ist.
 *
 * Gerechnet mit derselben Funktion wie die Pille im Detail-Panel (`folgenAuskunft`), nicht mit einer
 * Nachbildung — zwei Fassungen derselben Regel laufen auseinander. Wege ohne Haken (`dub` fehlt)
 * brauchen keine Rechnung; die Prüflisten führen sie ohnehin (`tools/extension-offene-*.mjs`).
 * Ein Werk mit einer Folge zeigt bewusst keine Zahl und zählt hier nicht als Lücke.
 *
 * Schreibt `data/pillen-luecken.json`; `tools/verdacht.mjs` liest sie (nur bei `erweitert` in
 * `data/pruefliste-regeln.json`). Aufruf: `npx tsx pipeline/pillen-luecken.ts`
 */
import { log, readJson, writeJson } from './lib/util.ts'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'
import type { Release, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'

const ANBIETER = ['netflix', 'primevideo', 'disneyplus']
const heute = todayIso()

/** Ein Weg mit Haken, aber ohne Folgenzahl auf der Pille. */
export interface PillenLuecke {
  titleId: number
  plattform: string
  url: string
}

function releasesJeTitel(): Map<number, Release[]> {
  const je = new Map<number, Release[]>()
  for (const r of readJson<Release[]>('public/data/releases.json', [])) {
    const titelId = (r as Release & { titleId: number }).titleId
    je.set(titelId, [...(je.get(titelId) ?? []), r])
  }
  return je
}

/** Die Pillen eines Titels, die Haken, aber keine Folgenzahl zeigen. */
function luecken(title: Title, releases: Release[]): PillenLuecke[] {
  if (title.format === 'MOVIE' || title.episodes === 1) return []
  const jeAnbieter = new Map<string, Release>()
  for (const r of releases) if (!jeAnbieter.has(r.platform)) jeAnbieter.set(r.platform, r)
  const angabe = folgenAuskunft({ releases, title, t: (k: string) => k, releaseJePlattform: jeAnbieter, today: heute })
  return (title.streams ?? [])
    .filter((s) => ANBIETER.includes(s.platform) && s.dub === true && !angabe(s))
    .map((s) => ({ titleId: title.id, plattform: s.platform, url: s.url }))
}

const titel = readJson<Title[]>('public/data/titles.json', [])
const je = releasesJeTitel()
const alle = titel.flatMap((t) => luecken(t, je.get(t.id) ?? []))
writeJson('data/pillen-luecken.json', alle)
log(`${alle.length} Pillen mit Haken ohne Folgenzahl: ${ANBIETER.map((a) => `${a} ${alle.filter((l) => l.plattform === a).length}`).join(', ')}`)
