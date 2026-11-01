/**
 * Zusicherung: Die Feldliste am Suchfeld (`SUCHFELD_ARTEN`) nennt genau die Felder, die die Suche tatsächlich durchsucht
 * (29.09.2026, Daniel: „welche felder durchsucht werden nicht ersichtlich ist“). Statt `filters.ts` und `search.ts` als Text
 * zu vergleichen, läuft die echte Suche (`filterEvents`) über einen Termin, dessen Felder je ein eigenes Erfindungswort tragen;
 * die Art der Fundstelle jedes Worts muss die erwartete sein, und die gefundenen Arten sind genau die der Liste.
 * Erfundene Titel, kein Netz (der Synonym-Abruf läuft über eine Attrappe von `fetch`).
 */
import type { Release, Title } from '../shared/types.ts'
import { loadSynonyme, type Dataset } from '../web/src/lib/data.ts'
import { EMPTY_FILTERS, filterEvents } from '../web/src/lib/filters.ts'
import { SUCHFELD_ARTEN, type Fundstelle, type FundstelleArt } from '../web/src/lib/search.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const ID = 7
globalThis.fetch = (async () => new Response(JSON.stringify({ [ID]: ['quirlsynonym'] }), { status: 200 })) as typeof fetch
await loadSynonyme()

/** Erwartete Art je Erfindungswort — jedes Wort steht in genau einem Feld. */
const erwartet: Record<string, FundstelleArt> = {
  alphatitel: 'titel',
  quirlsynonym: 'synonym',
  betastudio: 'studio',
  gammagenre: 'genre',
  deltaschlagwort: 'keyword',
  epsilonausgabe: 'release',
  zetaverlag: 'verlag',
  etabox: 'ausgabe',
}

const titel = {
  id: ID,
  franchiseId: ID,
  slug: 't-7',
  titleEn: 'alphatitel',
  studios: ['betastudio'],
  genres: ['gammagenre'],
  keywords: ['deltaschlagwort'],
  streams: [],
} as unknown as Title
const release = {
  slug: 'r-7',
  titleId: ID,
  name: 'epsilonausgabe',
  publisher: 'zetaverlag',
  edition: 'etabox',
  platform: 'disc',
  releaseType: 'batch',
  schedule: { firstEpisodeDate: '2026-10-01' },
} as unknown as Release
const daten = {
  releases: [release],
  titleById: new Map([[ID, titel]]),
  events: [{ releaseSlug: 'r-7' }],
} as unknown as Dataset

function artenFuer(wort: string): FundstelleArt[] {
  const stellen = new Map<string, Fundstelle[]>()
  filterEvents(daten, { ...EMPTY_FILTERS, search: wort }, '2026-10-11', new Set(), stellen)
  return [...new Set((stellen.get('r-7') ?? []).map((f) => f.art))]
}

/* Namen (Ausgabe, Synonym) laufen zuerst als Titelfeld durch `fundstellenFuer` und erscheinen dann als „titel“ — gefunden werden sie trotzdem. */
const alsTitel = new Set<FundstelleArt>(['release', 'synonym'])
const beschriftet = SUCHFELD_ARTEN.map((a) => a.art).sort()
for (const [wort, art] of Object.entries(erwartet)) {
  const arten = artenFuer(wort)
  const ok = alsTitel.has(art) ? arten.length > 0 && arten.every((a) => a === art || a === 'titel') : arten.includes(art)
  pruefe(`„${wort}“ (${art}) wird gefunden`, ok, arten)
  pruefe(`die gefundene Art von „${wort}“ steht in der Feldliste`, arten.length > 0 && arten.every((a) => beschriftet.includes(a)), arten)
}
pruefe('jede Art der Liste hat ein Erfindungswort in diesem Test', JSON.stringify(Object.values(erwartet).sort()) === JSON.stringify(beschriftet), beschriftet)

console.log(`check-suchfeld-arten: ${faelle} Fälle, ${fehler} Fehler.`)
process.exit(fehler ? 1 : 0)
