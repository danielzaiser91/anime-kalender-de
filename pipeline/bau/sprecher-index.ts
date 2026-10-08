import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { todayIso } from '../../shared/time.ts'
import { sprecherGruppe, sprecherName, type SprecherGruppe, type SprecherIndex, type SprecherTitel } from '../../shared/sprecher.ts'
import { clearDir, log, writeJson } from '../lib/util.ts'
import { OUT, VOICES_DIR } from './grundlagen.ts'

/**
 * Index Sprecher → Titel für die Sprecher-Suche (Idee 2 in `docs/wissen/ideen-2026-10-08.md`).
 *
 * Zwei Stufen, damit die Suche wenig kostet: `sprecher.json` trägt nur Namen und Titelzahl (für den
 * Namensabgleich), die Rollen je Titel liegen in `sprecher/<gruppe>.json` und kommen erst beim Klick auf
 * einen Namen. Der volle Index wäre gepackt 268 KB gewesen, die Namensliste allein ist ein Bruchteil
 * (gemessen 08.10.2026 am Bestand: 2.612 Sprecher, 27.468 Sprecher-Titel-Paare).
 *
 * Nur ausgelieferte Titel: Rollen zu Titeln, die nicht in `titles.json` stehen, werden gezählt und
 * gemeldet, nicht still verworfen.
 */
/* Gemessen 08.10.2026: Index 20 KB, größte Gruppe („m") 36 KB gepackt — die Grenzen lassen Luft, melden aber ein Verdoppeln. */
const INDEX_MAX_GZIP = 40_000
const GRUPPE_MAX_GZIP = 60_000

interface VoiceDatei {
  titleId: number
  roles?: { character: string; actor: string; von?: 'ann' }[]
}

export function schreibeSprecherIndex({ ausgeliefert }: { ausgeliefert: Set<number> }): void {
  const gruppen = new Map<string, SprecherGruppe>()
  const titelJeName = new Map<string, Map<number, SprecherTitel>>()
  let dateienOhneTitel = 0
  if (existsSync(VOICES_DIR)) {
    for (const datei of readdirSync(VOICES_DIR)) {
      if (!datei.endsWith('.json')) continue
      let inhalt: VoiceDatei
      try {
        inhalt = JSON.parse(readFileSync(`${VOICES_DIR}/${datei}`, 'utf8')) as VoiceDatei
      } catch {
        continue
      }
      if (!inhalt.roles?.length) continue
      if (!ausgeliefert.has(inhalt.titleId)) {
        dateienOhneTitel++
        continue
      }
      for (const rolle of inhalt.roles) {
        const name = sprecherName(rolle.actor)
        if (!name || !rolle.character) continue
        const titel = titelJeName.get(name) ?? titelJeName.set(name, new Map()).get(name)!
        const eintrag = titel.get(inhalt.titleId) ?? titel.set(inhalt.titleId, { id: inhalt.titleId, rollen: [] }).get(inhalt.titleId)!
        if (!eintrag.rollen.includes(rolle.character)) eintrag.rollen.push(rolle.character)
        if (rolle.von === 'ann') eintrag.ann = true
      }
    }
  }

  const index: SprecherIndex = { stand: todayIso(), sprecher: [] }
  for (const [name, titel] of [...titelJeName].sort(([a], [b]) => a.localeCompare(b, 'de'))) {
    const gruppe = sprecherGruppe(name)
    const liste = [...titel.values()]
    pruefeSprecher(name, liste, ausgeliefert)
    index.sprecher.push([name, liste.length, gruppe])
    const g = gruppen.get(gruppe) ?? gruppen.set(gruppe, {}).get(gruppe)!
    g[name] = liste
  }

  clearDir(`${OUT}/sprecher`)
  let groessteGruppe = 0
  for (const [gruppe, inhalt] of gruppen) {
    const bytes = gzipSync(JSON.stringify(inhalt)).length
    groessteGruppe = Math.max(groessteGruppe, bytes)
    if (bytes > GRUPPE_MAX_GZIP) throw new Error(`Sprecher-Gruppe „${gruppe}" ist gepackt ${bytes} Bytes — Grenze ${GRUPPE_MAX_GZIP}`)
    writeJson(`${OUT}/sprecher/${gruppe}.json`, inhalt)
  }
  const indexBytes = gzipSync(JSON.stringify(index)).length
  if (indexBytes > INDEX_MAX_GZIP) throw new Error(`Sprecher-Index ist gepackt ${indexBytes} Bytes — Grenze ${INDEX_MAX_GZIP}`)
  writeJson(`${OUT}/sprecher.json`, index)
  log(
    `Sprecher-Index: ${index.sprecher.length} Sprecher in ${gruppen.size} Gruppen (Index ${Math.round(indexBytes / 1024)} KB, größte Gruppe ${Math.round(groessteGruppe / 1024)} KB gepackt)` +
      (dateienOhneTitel ? `; ${dateienOhneTitel} Sprecherdateien zu nicht ausgelieferten Titeln übergangen` : ''),
  )
}

/** Zusicherung: kein Sprecher ohne Titel, jede Rolle an einem ausgelieferten Titel mit mindestens einer Figur. */
function pruefeSprecher(name: string, titel: SprecherTitel[], ausgeliefert: Set<number>): void {
  if (!titel.length) throw new Error(`Sprecher „${name}" ohne Titel im Index`)
  for (const t of titel) {
    if (!ausgeliefert.has(t.id)) throw new Error(`Sprecher „${name}": Titel ${t.id} wird nicht ausgeliefert`)
    if (!t.rollen.length) throw new Error(`Sprecher „${name}": Titel ${t.id} ohne Rolle`)
  }
}
