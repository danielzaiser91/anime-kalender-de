/**
 * Automatische Disc-Termine (aus Anime2You-Meldungen, Phase 08) bekommen ihren Kaufweg wie Handeinträge (Handlink > EAN > Name).
 * Läuft den echten Bauschritt `ergaenzeDiscUndZugang` gegen einen Wegwerf-Ordner (`AK_ROOT`); Ausgaben und Artikel sind Kulisse.
 * Ohne den Aufruf in `11-1` bleibt eine Auto-Disc ohne Kaufweg (19 von 195 am 01.11.2026) — dann wird dieser Test rot.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { amazonLinkArt } from '../shared/plattform-suche.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'disc-kaufweg-auto-'))
process.env.AK_ROOT = wurzel

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TAG = '2027-01-28'
const EAN = '4020628530846'
const dp = 'https://www.amazon.de/dp/B0HGB36K4K'
const ausgabe = { datum: TAG, url: 'https://www.anisearch.de/article/777,x', format: 'Blu-ray', kurz: 'Box 1', edition: 'Box 1 Blu-ray' }
// Titel 900501 hat am Tag eine eindeutige Ausgabe mit EAN, 900502 keine Ausgabeliste.
const ausgaben = { '900501': [ausgabe] }
const artikel = { '777': { ean: EAN, medium: 'Blu-ray', publisher: 'Crunchyroll', umfang: 'Cour / Box' } }

const rel = (slug: string, titleId: number, extra: object = {}) => ({
  slug,
  titleId,
  name: slug,
  platform: 'disc',
  releaseType: 'disc',
  automatisch: true,
  schedule: { firstEpisodeDate: TAG },
  year: 2027,
  sources: [],
  ...extra,
})

try {
  mkdirSync(join(wurzel, 'data'))
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), JSON.stringify(ausgaben))
  writeFileSync(join(wurzel, 'data', 'anisearch-artikel.json'), JSON.stringify(artikel))
  const { ergaenzeDiscUndZugang } = await import('./bau/11-1-disc-und-zugang.ts')
  const releases = [
    rel('auto-mit-ean', 900501, { herkunft: 'Box 1 laut Meldung' }),
    rel('auto-ohne-ausgabe', 900502),
    rel('auto-hand', 900501, { buyUrl: dp }),
    rel('auto-weekly', 900501, { releaseType: 'weekly', platform: 'netflix' }),
    rel('auto-ohne-datum', 900501, { schedule: undefined }),
  ]
  ergaenzeDiscUndZugang({ titles: new Map(), anisearch: {}, releases: releases as never, zugangJeAdresse: new Map() })
  const von = (slug: string) => releases.find((r) => r.slug === slug) as { buyUrl?: string; edition?: string; platformUrl?: string }

  console.log('\nBau (ergaenzeDiscUndZugang):')
  pruefe('Auto-Disc mit eindeutiger EAN: EAN-Suche', von('auto-mit-ean').buyUrl === `https://www.amazon.de/s?k=${EAN}`, von('auto-mit-ean').buyUrl)
  pruefe('Auto-Disc ohne Ausgabe: Namenssuche statt nichts', amazonLinkArt(von('auto-ohne-ausgabe').buyUrl) === 'name', von('auto-ohne-ausgabe').buyUrl)
  pruefe('Handlink bleibt', von('auto-hand').buyUrl === dp, von('auto-hand').buyUrl)
  pruefe('Kein Disc-Termin: nichts erfunden', von('auto-weekly').buyUrl === undefined, von('auto-weekly').buyUrl)
  pruefe('Disc ohne Datum: nichts erfunden', von('auto-ohne-datum').buyUrl === undefined, von('auto-ohne-datum').buyUrl)
  // Reihenfolge: Die Verknüpfung mit der aniSearch-Ausgabe (11-1) überspringt Termine mit buyUrl — sie muss davor laufen.
  pruefe('Reihenfolge: Edition aus der Ausgabe bleibt', von('auto-mit-ean').edition === 'Box 1 · Blu-ray', von('auto-mit-ean').edition)
  pruefe('Reihenfolge: aniSearch-Seite der Ausgabe bleibt als platformUrl', von('auto-mit-ean').platformUrl === ausgabe.url, von('auto-mit-ean').platformUrl)
  pruefe('Ohne Ausgabe keine Edition', von('auto-ohne-ausgabe').edition === undefined, von('auto-ohne-ausgabe').edition)
  const ohne = releases.filter((r) => r.releaseType === 'disc' && r.schedule && !(r as { buyUrl?: string }).buyUrl)
  pruefe('keine Auto-Disc mit Datum bleibt ohne Kaufweg', ohne.length === 0, ohne.map((r) => r.slug))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(`\nDisc-Kaufweg-Auto: ${verletzt ? `${verletzt} verletzt` : `${gesamt} Prüfungen bestanden`}`)
if (verletzt) process.exit(1)
