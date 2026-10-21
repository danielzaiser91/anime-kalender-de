/**
 * Zusicherung: **Die Bestandsprüfung `check-kalender-plausibilitaet-bestand.ts` liest das Kanal-Wissen samt Merkliste** (19.10.2026, PR 1613 R3).
 * Sie läuft als eigener Prozess gegen eine Kulisse (`AK_ROOT` im Temp-Ordner, nie der echte Bestand): zwei Titel mit einem Prime-Weg ohne Häkchen,
 * für beide hat die Erweiterung Deutsch gemessen. Titel 9401 steht nur in `data/kanal-seiten.json` (kein Handbeleg), 9402 nirgends.
 * Erwartet: Regel `spracheOffenTrotzMeldung` trifft nur 9402 (auf dem Kanal-Weg ist die Messung kein Beleg). Ohne Merkliste träfe sie beide.
 * Läuft in `check:logic`, weil die Kulisse im Temp-Ordner liegt (`bestand-sperre.cjs`).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(repo, 'package.json')).resolve('tsx/cli')
const kulisse = mkdtempSync(join(tmpdir(), 'kanal-plausi-'))
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
const titel = (id: number, asin: string) => ({ id, slug: `plausi-${id}`, titleRomaji: `Plausi ${id}`, streams: [{ platform: 'primevideo', url: dp(asin) }] })
const gemessen = { urteil: 'deutsch', art: 'gemessen' }

const fehler: string[] = []
try {
  schreibe('public/data/titles.json', [titel(9401, 'B0PLAUSI01'), titel(9402, 'B0PLAUSI02')])
  for (const datei of ['releases', 'events', 'news']) schreibe(`public/data/${datei}.json`, [])
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '')
  schreibe('data/urteile.json', { '9401|primevideo': gemessen, '9402|primevideo': gemessen })
  schreibe('data/kanal-seiten.json', [{ anilistId: 9401, platform: 'primevideo', url: dp('B0PLAUSI01'), checkedAt: '', note: 'Amazon-Seite B0PLAUSI01 — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true }])
  const r = spawnSync(process.execPath, [tsx, join(repo, 'pipeline/check-kalender-plausibilitaet-bestand.ts'), '--liste'], {
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse },
  })
  if (r.status !== 0) fehler.push(`Lauf endete mit ${r.status}: ${r.stderr.slice(-300)}`)
  const zeile = /^spracheOffenTrotzMeldung: (\d+)$/m.exec(r.stdout)
  if (zeile?.[1] !== '1') fehler.push(`spracheOffenTrotzMeldung: ${zeile?.[1] ?? 'keine Zeile'} Treffer, erwartet 1 (nur 9402)`)
  if (!r.stdout.includes('Plausi 9402') || r.stdout.includes('Plausi 9401')) fehler.push(`Treffer nennen nicht genau 9402: ${r.stdout.slice(-300)}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-kalender-plausibilitaet-kanal:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log('check-kalender-plausibilitaet-kanal: Merkliste wirkt in der Bestandsprüfung (2 Titel, 1 Treffer) ok.')
