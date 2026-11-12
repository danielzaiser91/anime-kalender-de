/**
 * Zusicherung: Trägt eine aniSearch-Seite `p` (Deutsch geplant) und liegt ihr Träger-AniList-Titel nur im Katalog, kommt der AniList-Titel in den Bestand
 * und die Seite bekommt keine zweite Kennung (PR 3528: aniSearch 20905 / AniList 199112, MAL-Dublette im Bestandsbau). Marke `-` ändert nichts.
 * Der Bau läuft wirklich (`baueTitel`) gegen eine Kulisse unter `AK_ROOT` mit erfundenen Kennungen ab 900000.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'ak-traeger-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
  writeFileSync(join(wurzel, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
const eintrag = (dub: string, mal: number) => ({ t: 'Probe', ty: 'Film', y: 2025, f: 1, von: '2025-11-21', mal, dub })
const katalogEintrag = (id: number, mal: number) => ({ id, mal, t: ['Probe', null, null], format: 'TV', jahr: 2026, folgen: 5, start: '2026-01-10' })
/* 900001/900101: Seite mit p; 900002/900102: Seite mit - (Gegenprobe); 900003/900103: p, aber Handurteil „keine Synchro“; 900104: p, Träger steht schon im Bestand. */
schreibe('data/anisearch.json', {
  900001: { anisearchId: 900101 },
  900002: { anisearchId: 900102 },
  900003: { anisearchId: 900103 },
  900004: { anisearchId: 900104 },
})
schreibe('data/anisearch-eintraege.json', { 900101: eintrag('p', 800001), 900102: eintrag('-', 800002), 900103: eintrag('p', 800003), 900104: eintrag('p', 800004) })
schreibe('data/anisearch-dub-ids.json', { 900101: 'p', 900103: 'p', 900104: 'p' })
schreibe('data/cache/anilist-katalog.json', { eintraege: [900001, 900002, 900003, 900004].map((id, i) => katalogEintrag(id, 800001 + i)) })
/* Ohne „data/“-Literal: `check-workflows` hielte sie für Schreibziele der Pipeline. */
const schreibeData = (name: string, inhalt: string) => schreibe(join('data', name), inhalt)
schreibeData('ohne-synchro-von-hand.yaml', '- anilistId: 900003\n  sources:\n    - https://example.org/probe\n')
schreibeData('ankuendigungen.yaml', 'eintraege: []\n')
mkdirSync(join(wurzel, 'data/curated'), { recursive: true })
for (const leer of ['kino-ankuendigungen.yaml', 'anisearch-ids-hand.yaml']) schreibe(`data/${leer}`, '[]\n')
process.env.AK_ROOT = wurzel

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { baueTitel } = await import('./bau/02-titel.ts')
  const medium = { id: 900004, idMal: 800004, episodes: 1, title: {} }
  const { titles, jpStart } = baueTitel({ byMal: {}, confidenceRaw: {}, byAniId: { 900004: medium as never } })
  const BASIS = 10_000_000
  const ids = [...titles.keys()].filter((i) => i >= 900000)

  console.log('\nGeplante Synchro, Träger nur im Katalog (Fall 20905 / 199112):')
  pruefe('der AniList-Träger 900001 steht im Bestand', titles.has(900001), ids)
  pruefe('seine Seite 900101 bekommt keine zweite Kennung', !titles.has(BASIS + 900101), ids)
  pruefe('der Titel trägt die MAL-Kennung, Vertrauen normal und den Starttag', titles.get(900001)?.malId === 800001 && titles.get(900001)?.dubConfidence === 'normal' && jpStart.get(900001) === '2026-01-10')

  console.log('\nGegenproben:')
  pruefe('Marke „-“: der Träger bleibt im Katalog', !titles.has(900002))
  pruefe('Marke „-“: die Seite behält ihr Verhalten (keine Zeile, weil ohne Deutsch von einem Träger getragen)', !titles.has(BASIS + 900102))
  pruefe('Handurteil „keine Synchro“: der Träger 900003 kommt nicht herein', !titles.has(900003))
  pruefe('Handurteil „keine Synchro“: die Seite bleibt wie bisher eine Zeile', titles.has(BASIS + 900103))
  pruefe('Träger steht schon im Bestand: kein zweiter Titel, keine Seitenzeile', titles.has(900004) && !titles.has(BASIS + 900104))
  pruefe('Marke „-“ und Handurteil: genau ein Titel kommt dazu (900001), nur 900004 aus dem Medium', ids.filter((i) => i < BASIS).sort().join(',') === '900001,900004', ids)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(verletzt ? `\nVERSTÖSSE: ${verletzt}` : '\nVERSTÖSSE: 0')
process.exit(verletzt ? 1 : 0)
