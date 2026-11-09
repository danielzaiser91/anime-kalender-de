/**
 * Eine einzelne `vde`-Folge in einer Staffel, deren übrige Folgen alle nur `vostde` tragen, ist ein Fehler in ADNs Katalogdaten
 * und belegt keine Synchro (Demon Slave S1F6, Video 24139, 09.11.2026: Player bietet nur Japanisch). Der Bau setzte aus ihr
 * einen ADN-Termin mit `dub: true` — bei `07-adn.ts`.
 *
 * Klasse, gezählt über `data/adn-raw` (274 Serien, 09.11.2026): genau drei Staffeln haben genau eine `vde`-Folge unter
 * mindestens drei ohne — GTO (1 von 43), Demon Slave (1 von 12), One Piece Wano (1 von 208). Die übrigen Mischstaffeln
 * liegen bei 3 von 4 und 12 von 13, sie sind echte, laufende Vertonungen. Beginnt eine Staffel mit Folge 1 deutsch, wird sie
 * nicht berührt (eine Vertonung fängt vorn an). Gegenstück in der Erweiterung: `korrigiereAusreisser` in `extension/adn-leser.js`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'

export interface AusreisserVideo {
  id?: number
  languages?: string[]
  number?: string | null
  season?: string | null
  shortNumber?: string | null
  type?: string
}

const MIN_OHNE_VDE = 3
/** Ab dieser Länge ist es keine gewöhnliche Staffel mehr (One Piece „Wano“: 208 Folgen, deutsch nur die erste der Liste, Daniel: ab 780 keine Synchro). */
const LANGE_STAFFEL = 50

const ganzzahl = (text: unknown) => /^\d+$/.test(String(text ?? '').trim())

/** Gruppe wie in der Erweiterung (`staffelText|kennung`): Folgen einer Staffel zählen getrennt von OVAs, Filmen und Specials derselben Staffel. */
function gruppe(v: AusreisserVideo): string {
  const folge = v.type === 'EPS' && ganzzahl(v.shortNumber)
  const kennung = !folge ? (v.type === 'EPS' ? 'special' : v.type) : !ganzzahl(v.season) && v.season ? String(v.season).slice(0, 40) : null
  return `${v.season ? String(v.season) : null}|${kennung}`
}

/** Trailer, Vorschauen und „(NC)“-Fassungen sind keine Folgen (wie `zeile` in der Erweiterung). */
const keineFolge = (v: AusreisserVideo) => v.type === 'PV' || /trailer|bande-annonce|\(NC\)/i.test(`${v.number ?? ''} ${v.shortNumber ?? ''}`)

/** Die Kennungen der Videos, die als Ausreißer gelten: je Staffel höchstens eines. */
export function vdeAusreisser(videos: readonly AusreisserVideo[]): Set<number> {
  const jeStaffel = new Map<string, AusreisserVideo[]>()
  for (const v of videos) {
    if (keineFolge(v) || v.id === undefined) continue
    const schluessel = gruppe(v)
    jeStaffel.set(schluessel, [...(jeStaffel.get(schluessel) ?? []), v])
  }
  const ausreisser = new Set<number>()
  for (const liste of jeStaffel.values()) {
    const ja = liste.filter((v) => v.languages?.includes('vde'))
    const nein = liste.filter((v) => !v.languages?.includes('vde') && v.languages?.includes('vostde'))
    if (ja.length !== 1 || nein.length < MIN_OHNE_VDE || nein.length + 1 !== liste.length) continue
    const nummer = (v: AusreisserVideo) => Number(v.shortNumber)
    const beginntDeutsch = !(nummer(ja[0]) > Math.min(...nein.map(nummer)))
    if (beginntDeutsch && liste.length <= LANGE_STAFFEL) continue
    ausreisser.add(ja[0].id!)
  }
  return ausreisser
}

/** Die Videokennung aus der Folgenadresse (`…/video/1125-demon-slave/24139-folge-6`). */
export function videoIdAusAdresse(url: string): number | undefined {
  const treffer = /\/(\d+)-[^/]*$/.exec(url)
  return treffer ? Number(treffer[1]) : undefined
}

/** Alle Ausreißer-Videos des Archivs `data/adn-raw` unter `wurzel` (ohne Abruf; fehlt der Ordner, gibt es keine). */
export function ausreisserAusArchiv(wurzel: string): Set<number> {
  const ordner = resolve(wurzel, 'data/adn-raw')
  const alle = new Set<number>()
  if (!existsSync(ordner)) return alle
  for (const datei of readdirSync(ordner)) {
    if (!datei.endsWith('.json.gz')) continue
    try {
      const roh = JSON.parse(gunzipSync(readFileSync(resolve(ordner, datei))).toString()) as { videos?: AusreisserVideo[] }
      for (const id of vdeAusreisser(roh.videos ?? [])) alle.add(id)
    } catch {
      continue // eine kaputte Datei bricht den Bau nicht ab (wie `ladeAdnArchiv`)
    }
  }
  return alle
}

/** Die Serien ohne ihre Ausreißer-Folgen; eine Serie, die damit leer wird, fällt heraus (kein Termin, kein Weg). */
export function ohneAusreisser<S extends { episodes: { url: string }[] }>(shows: readonly S[], ausreisser: ReadonlySet<number>): S[] {
  if (!ausreisser.size) return [...shows]
  const bereinigt = shows.map((s) => ({ ...s, episodes: s.episodes.filter((e) => !ausreisser.has(videoIdAusAdresse(e.url) ?? -1)) }))
  return bereinigt.filter((s, i) => s.episodes.length || !shows[i].episodes.length)
}
