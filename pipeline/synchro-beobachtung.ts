/**
 * Schreibt die Beobachtungsliste „Start angekündigt, Synchro-Beleg fehlt“ nach `data/proposals/synchro-beobachtung.json`.
 * Liest nur den Bestand (`public/data/titles.json`, `releases.json`, aniSearch-Marken, Handbelege), ruft nichts ab.
 * Regel und Frist: `lib/synchro-beobachtung.ts`. Ein Fehler hier darf den Rohdaten-Schritt nicht rot färben: Meldung auf stderr, Exit 0.
 *
 * Aufruf: npx tsx pipeline/synchro-beobachtung.ts [--heute=YYYY-MM-DD]
 */
import type { Release, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { readJson, writeJson } from './lib/util.ts'
import { dubIdsNachAnisearch, dubsNachTitel } from './lib/anisearch-marke.ts'
import { handJaSchluessel, ladeHandbelege } from './lib/dub-confirmed.ts'
import { beobachtungsListe, type BeobachtungsEintrag } from './lib/synchro-beobachtung.ts'

const ZIEL = 'data/proposals/synchro-beobachtung.json'

function lauf(heute: string): void {
  const titel = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const alt = readJson<{ eintraege?: BeobachtungsEintrag[] }>(ZIEL, {}).eintraege ?? []
  const handJa = new Set([...handJaSchluessel(ladeHandbelege())].map((s) => Number(s.split('|')[0])))
  const liste = beobachtungsListe(titel, releases, alt, heute, { nachAnisearch: dubIdsNachAnisearch(), nachTitel: dubsNachTitel(), handJa })
  writeJson(ZIEL, { stand: heute, eintraege: liste }, true)
  console.log(`Synchro-Beobachtung: ${liste.length} Einträge (${alt.length} vorher), Stand ${heute}`)
}

try {
  lauf(process.argv.find((a) => a.startsWith('--heute='))?.slice(8) ?? todayIso())
} catch (err) {
  console.error(`WARNUNG Synchro-Beobachtung nicht geschrieben: ${err instanceof Error ? err.message : String(err)}`)
}
