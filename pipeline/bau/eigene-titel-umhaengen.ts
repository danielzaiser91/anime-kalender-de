import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Release, Title } from '../../shared/types.ts'
import type { KennungsZeile } from '../lib/ausgabe-kennung.ts'
import { ROOT, log } from '../lib/util.ts'
import { type EigenerEintrag, eigeneId, ladeEigeneTitel } from './eigene-titel.ts'

/**
 * **Ein Katalog führt den Titel jetzt: `zuId` in `data/eigene-titel.yaml`.** Der eigene Titel bleibt bis nach Phase 08 im Bau, damit die Meldung
 * ihn unter seinem Namen findet; danach ziehen seine Termine auf den Katalogtitel um, und er entfällt. Hat der Katalogtitel beim selben Anbieter
 * schon einen Termin am selben Tag, entfällt der des eigenen Titels. Ein `zuId`, das nicht im Bestand steht, bricht den Bau ab.
 */
export function haengeEigeneUm(titles: Map<number, Title>, releases: Release[], eintraege: EigenerEintrag[] = ladeEigeneTitel()): number {
  let umgezogen = 0
  for (const e of eintraege) {
    if (!e.zuId || e.widerrufen) continue
    const eigene = eigeneId(e.nr)
    if (!titles.has(e.zuId)) throw new Error(`data/eigene-titel.yaml, nr ${e.nr} (${e.name}): zuId ${e.zuId} steht nicht im Bestand`)
    for (let i = releases.length - 1; i >= 0; i--) {
      const r = releases[i]!
      if (r.titleId !== eigene) continue
      const doppelt = releases.some((x) => x.titleId === e.zuId && x.platform === r.platform && x.schedule.firstEpisodeDate === r.schedule.firstEpisodeDate)
      if (doppelt) releases.splice(i, 1)
      else r.titleId = e.zuId
    }
    titles.delete(eigene)
    umgezogen++
  }
  if (umgezogen) log(`${umgezogen} eigene Titel in Katalogtitel aufgegangen (zuId): Termine umgehängt`)
  return umgezogen
}

/**
 * Trägt `zuAk` an der alten Zeile ein: die öffentliche Adresse `/t/<alt>/` leitet dann auf den Katalogtitel. Eine gesetzte `zuAk` bleibt;
 * fehlt die Zeile des Katalogtitels, bricht es ab. Gibt die geänderten Zeilen zurück (kein Eintrag, wenn der eigene Titel nie ausgeliefert wurde).
 */
export function setzeEigeneZuAk(zeilen: KennungsZeile[], eintraege: EigenerEintrag[]): KennungsZeile[] {
  const geaendert: KennungsZeile[] = []
  for (const e of eintraege) {
    if (!e.zuId || e.widerrufen) continue
    const alt = zeilen.find((z) => z[1] === eigeneId(e.nr))
    if (!alt || alt[3] !== undefined) continue
    const ziel = zeilen.find((z) => z[1] === e.zuId)
    if (!ziel) throw new Error(`data/kennungen.json: keine Zeile für zuId ${e.zuId} (data/eigene-titel.yaml, nr ${e.nr})`)
    alt[3] = ziel[3] ?? ziel[0]
    geaendert.push(alt)
  }
  return geaendert
}

/** Nach `tools/kennungen-erzeugen.mjs`: schreibt `zuAk` in `kennungen.json` (Format wie dort). */
export function schreibeEigeneZuAk(wurzel: string = ROOT, eintraege: EigenerEintrag[] = ladeEigeneTitel(wurzel)): number {
  const datei = resolve(wurzel, 'data/kennungen.json')
  if (!existsSync(datei)) return 0
  const roh = JSON.parse(readFileSync(datei, 'utf8')) as { naechste: number; titel: KennungsZeile[] }
  const geaendert = setzeEigeneZuAk(roh.titel, eintraege)
  if (!geaendert.length) return 0
  writeFileSync(datei, `{"naechste":${roh.naechste},"titel":[\n${roh.titel.map((z) => `[${z.join(',')}]`).join(',\n')}\n]}\n`)
  log(`${geaendert.length} eigene Kennungen leiten auf den Katalogtitel um (zuAk)`)
  return geaendert.length
}
