/**
 * AniList-Kennung → unsere Kennung `ak` (`data/kennungen.json`) für Prüfwerkzeuge, die die ausgelieferte Seite öffnen:
 * Die Seite kennt seit der Stufe 1 nur noch `ak`, die Fälle in den Werkzeugen sind aber mit AniList-Kennungen notiert.
 */
import { readFileSync } from 'node:fs'

const roh = JSON.parse(readFileSync(new URL('../data/kennungen.json', import.meta.url), 'utf8'))
const karte = new Map(roh.titel.map((z) => [z[1], z[0]]))

export function akVon(anilist) {
  const ak = karte.get(Number(anilist))
  if (ak === undefined && Number(anilist) > 0) throw new Error(`Keine Kennung für AniList ${anilist}`)
  return ak ?? Number(anilist)
}
