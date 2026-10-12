import type { StreamLink, Title } from '../../shared/types.ts'
import { readJson, log } from '../lib/util.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { kanalAdressenOhneBeleg, kanalSchluessel, kanalTitelNurKanal } from '../lib/kanal-titel.ts'

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
  const jaJeWeg = jaJeTitelUndPlattform()
  /* Auch das Urteil beruht auf Amazons Sprachangabe; auf einem Kanal-Titel ist sie kein Beleg (`lib/kanal-titel.ts`). */
  const checks = loadDubChecks()
  const kanal = kanalAdressenOhneBeleg(checks)
  const nurKanal = kanalTitelNurKanal(checks)
  let ausUrteil = 0
  for (const title of titles.values()) {
    for (const stream of title.streams ?? []) {
      if (stream.dub !== undefined) continue
      if (!jaJeWeg.has(`${title.id}|${stream.platform}`)) continue
      if (kanalGesperrt(title, stream, kanal, nurKanal)) continue
      stream.dub = true
      ausUrteil++
    }
  }
  if (ausUrteil) log(`${ausUrteil} Weg(e) über das Urteil aus Stufe 3 belegt`)
}

/** Schlüssel „Titel|Plattform“, für die `data/urteile.json` irgendeine Folge „deutsch“ führt. */
function jaJeTitelUndPlattform(): Set<string> {
  const urteile = readJson<Record<string, { urteil?: string }>>('data/urteile.json', {})
  const ja = new Set<string>()
  for (const [schluessel, u] of Object.entries(urteile)) {
    if (u?.urteil !== 'deutsch') continue
    const [id, plattform] = schluessel.split('|')
    if (id && plattform) ja.add(`${id}|${plattform}`)
  }
  return ja
}

/**
 * Trägt Amazons Sprachangabe auf diesem Prime-Weg kein Ja? Auf der Adresse eines Kanal-Belegs nie; bei einem Titel, der auf Prime nur Kanal-Belege
 * hat (`nurKanal`), auf keiner seiner Prime-Adressen. Andere Plattformen bleiben unberührt, ein Nein setzt der Schritt nie.
 */
export function kanalGesperrt(title: Title, stream: StreamLink, kanal: ReadonlySet<string>, nurKanal: ReadonlySet<number>): boolean {
  if (stream.platform !== 'primevideo') return false
  return nurKanal.has(title.id) || kanal.has(kanalSchluessel(title.id, stream.url))
}
