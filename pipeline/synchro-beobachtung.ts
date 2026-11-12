/**
 * Schreibt die Beobachtungsliste „Start angekündigt, Synchro-Beleg fehlt“ nach `data/proposals/synchro-beobachtung.json`.
 * Liest nur den Bestand (`public/data/titles.json`, `releases.json`, `ohne-synchro.json` (zweite Quelle), `data/synchro-historie.json` (Latenz), aniSearch-Marken, Handbelege), ruft nichts ab.
 * Regel und Frist: `lib/synchro-beobachtung.ts`. Ein Fehler hier darf den Rohdaten-Schritt nicht rot färben: Meldung auf stderr, Exit 0.
 *
 * Aufruf: npx tsx pipeline/synchro-beobachtung.ts [--heute=YYYY-MM-DD]
 */
import type { Release, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { readJson, writeJson } from './lib/util.ts'
import { dubIdsNachAnisearch, dubsNachTitel } from './lib/anisearch-marke.ts'
import { handJaSchluessel, ladeHandbelege } from './lib/dub-confirmed.ts'
import { beobachtungsListe, ohneSynchroStarts, type BeobachtungsEintrag } from './lib/synchro-beobachtung.ts'
import { alterswarnungen } from './lib/synchro-beobachtung-alter.ts'
import { latenzStand, type LatenzStand } from './lib/synchro-latenz.ts'

const ZIEL = 'data/proposals/synchro-beobachtung.json'

function lauf(heute: string): void {
  const ohne = readJson<Title[]>('public/data/ohne-synchro.json', [])
  const titel = [...readJson<Title[]>('public/data/titles.json', []), ...ohne]
  const releases = [...readJson<Release[]>('public/data/releases.json', []), ...ohneSynchroStarts(ohne)]
  const vorher = readJson<Partial<LatenzStand> & { eintraege?: BeobachtungsEintrag[] }>(ZIEL, {})
  const alt = vorher.eintraege ?? []
  const handJa = new Set([...handJaSchluessel(ladeHandbelege())].map((s) => Number(s.split('|')[0])))
  const liste = beobachtungsListe(titel, releases, alt, heute, { nachAnisearch: dubIdsNachAnisearch(), nachTitel: dubsNachTitel(), handJa })
  const historie = readJson<{ seit?: Record<string, string> }>('data/synchro-historie.json', {}).seit ?? {}
  const latenz = latenzStand(alt, liste, vorher, historie, heute)
  writeJson(ZIEL, { stand: heute, eintraege: liste, ...latenz }, true)
  const tage = latenz.belegt.map((b) => b.tage).join(',') || '-'
  console.log(`Synchro-Beobachtung: ${liste.length} Einträge (${alt.length} vorher), Stand ${heute}, ${latenz.belegt.length} belegt (Tage bis Beleg: ${tage})`)
  for (const z of alterswarnungen(liste, heute)) console.log(`::warning::Synchro-Beobachtung ${z}`)
}

try {
  lauf(process.argv.find((a) => a.startsWith('--heute='))?.slice(8) ?? todayIso())
} catch (err) {
  console.error(`WARNUNG Synchro-Beobachtung nicht geschrieben: ${err instanceof Error ? err.message : String(err)}`)
}
