import type { Release, Title } from '../../shared/types.ts'
import { readJson, log } from '../lib/util.ts'
import { ladeKanalWissen } from '../lib/kanal-wissen.ts'
import { kanalAdressenOhneBeleg, kanalSchluessel } from '../lib/kanal-titel.ts'
import { alleTermineGekennzeichnet } from '../lib/pruefung.ts'
import { urteilDarfBelegen } from '../lib/urteil-weg.ts'

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
  const kanal = kanalAdressenOhneBeleg(ladeKanalWissen())
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

/**
 * **Das Urteil auch an Wegen, die erst nach Phase 10 entstehen** (17.10.2026): JustWatch-Wege (11-2) und Termin-Wege (11-7)
 * kamen nach `urteilSchliesstLuecken` und blieben „Sprache offen“, obwohl die Erweiterung Deutsch gemessen hatte (Bestandsbau
 * rot, `spracheOffenTrotzMeldung` 19 statt 7). Läuft in Schritt 13 nach der Anreicherung, die `kanal` setzt; ein Termin-Weg
 * mit Urteil verliert `herkunft: 'termin'`, denn sein Ton beruht dann auf der Messung. Gibt die Zahl der Wege zurück.
 */
export function urteilSchliesstSpaeteLuecken(
  titles: Iterable<Title>,
  releases: Release[],
  jaJeWeg: ReadonlySet<string>,
  kanal: ReadonlySet<string>,
): number {
  const gekennzeichnet = alleTermineGekennzeichnet(releases)
  let ausUrteil = 0
  for (const title of titles) {
    for (const stream of title.streams ?? []) {
      if (stream.dub !== undefined) continue
      if (!jaJeWeg.has(`${title.id}|${stream.platform}`)) continue
      if (!urteilDarfBelegen(title.id, stream, kanal, gekennzeichnet)) continue
      stream.dub = true
      if (stream.herkunft === 'termin') delete stream.herkunft
      /* Das gemessene Urteil schlägt den JustWatch-Hinweis; beides zugleich verbietet check-jw-vertrauen-bestand. */
      delete stream.dubQuelle
      delete stream.dubStand
      delete stream.dubHintOnly
      ausUrteil++
    }
  }
  return ausUrteil
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

/** Schritt 13: das Urteil an den spät entstandenen Wegen, mit dem Kanal-Wissen des Baus (Handbelege samt Merkliste). */
export function schliesseSpaeteLuecken(titles: Iterable<Title>, releases: Release[]): number {
  return urteilSchliesstSpaeteLuecken(titles, releases, urteilJaJeWeg(), kanalAdressenOhneBeleg(ladeKanalWissen()))
}
