import type { Title } from '../../shared/types.ts'
import { readJson, log } from '../lib/util.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { kanalAdressenOhneBeleg, kanalSchluessel } from '../lib/kanal-titel.ts'

/**
 * **Stufe 4, Schritt 1: das Urteil schließt Lücken**.
 *
 * `data/urteile.json` entsteht in Stufe 3 aus allen Beobachtungen je Folge und Anbieter
 * (`lib/urteil-je-folge.ts`): die jüngste gewinnt, am selben Tag schlägt gemessen die
 * abgeleitete, ein Kanal-Nein bleibt `unbekannt`.
 *
 * Dieser Schritt ersetzt **keine** der 26 Stellen, an denen der Bau heute `dub` setzt — er
 * steht dahinter und füllt nur, was niemand gesetzt hat (gemessen am 23.09.2026: 177 von 222
 * decken sich, null widersprechen, einer offen). Jede neue Meldung kommt so ohne neue Setzstelle an.
 *
 * Ein Urteil „kein deutsch" setzt hier nichts: Ein Nein entfernt Wege, und das gehört zu
 * Schritt 2, wenn die Gegenproben dafür stehen.
 */
export function urteilSchliesstLuecken(titles: Map<number, Title>): void {
  const jaJeWeg = urteilJaJeWeg()
  /* Auch das Urteil beruht auf Amazons Sprachangabe; auf einem Kanal-Titel ist sie kein Beleg (`lib/kanal-titel.ts`). */
  const kanal = kanalAdressenOhneBeleg(loadDubChecks())
  let ausUrteil = 0
  for (const title of titles.values()) {
    for (const stream of title.streams ?? []) {
      if (stream.dub !== undefined) continue
      if (!jaJeWeg.has(`${title.id}|${stream.platform}`)) continue
      if (stream.platform === 'primevideo' && kanal.has(kanalSchluessel(title.id, stream.url))) continue
      stream.dub = true
      ausUrteil++
    }
  }
  if (ausUrteil) log(`${ausUrteil} Weg(e) über das Urteil aus Stufe 3 belegt`)
}

/** `titleId|plattform` mit mindestens einer Folge, deren Urteil aus Stufe 3 „deutsch“ lautet (`data/urteile.json`). */
export function urteilJaJeWeg(): Set<string> {
  const urteile = readJson<Record<string, { urteil?: string }>>('data/urteile.json', {})
  const jaJeWeg = new Set<string>()
  for (const [schluessel, u] of Object.entries(urteile)) {
    if (u?.urteil !== 'deutsch') continue
    const [id, plattform] = schluessel.split('|')
    if (id && plattform) jaJeWeg.add(`${id}|${plattform}`)
  }
  return jaJeWeg
}
