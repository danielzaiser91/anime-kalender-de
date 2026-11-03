/**
 * Zusicherung: Fast-Doppel in den Handbelegen (gleich bis auf `checkedAt`) werden zusammengeführt, ohne Notiz,
 * Herkunft oder Kommentar zu verlieren (`pipeline/lib/handbeleg-fast-doppel.ts`, Werkzeug `tools/handbelege-fast-doppel.ts`).
 * Am Bestand: die Zahl der noch zusammenführbaren Belege darf nur sinken (Ratsche), nicht auflösbare Gruppen gibt es nicht.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-handbeleg-fast-doppel.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { entferneFastDoppel } from './lib/handbeleg-fast-doppel.ts'
import { ROOT } from './lib/util.ts'

/** Stand vom 03.11.2026 (Zweigbasis bee2c8ca1): 48 Belege in 40 Gruppen; der Datencommit setzt die Grenze auf 0. */
const NOCH_ZUSAMMENFUEHRBAR_HOECHSTENS = 48

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const beleg = (id: number, datum: string, note = 'Tonspuren Deutsch', plattform = 'netflix') =>
  `- anilistId: ${id}\n  platform: ${plattform}\n  dub: true\n  checkedAt: '${datum}'\n  note: ${note}`
const datei = (...teile: string[]) => teile.join('\n\n') + '\n'
const ids = (text: string) => [...text.matchAll(/anilistId: (\d+)[\s\S]*?checkedAt: '([\d-]+)'/g)].map((m) => `${m[1]}@${m[2]}`)

/* Gleich bis auf das Datum: der jüngere bleibt, egal in welcher Reihenfolge sie stehen. */
const alt = datei(beleg(1, '2026-08-01'), beleg(1, '2026-09-01'))
pruefe('der jüngere bleibt (älterer zuerst)', ids(entferneFastDoppel(alt).text).join() === '1@2026-09-01')
const neuZuerst = datei(beleg(1, '2026-09-01'), beleg(1, '2026-08-01'))
pruefe('der jüngere bleibt (jüngerer zuerst)', ids(entferneFastDoppel(neuZuerst).text).join() === '1@2026-09-01')
pruefe('drei Belege: zwei fallen', entferneFastDoppel(datei(beleg(1, '2026-08-01'), beleg(1, '2026-10-01'), beleg(1, '2026-09-01'))).entfernt === 2)
const mitEinzelnem = entferneFastDoppel(datei(beleg(1, '2026-08-01'), beleg(1, '2026-09-01'), beleg(2, '2026-09-01')))
pruefe('ein Einzelbeleg ist keine Gruppe', mitEinzelnem.gruppen === 1 && mitEinzelnem.entfernt === 1)
/* Was sich außer dem Datum unterscheidet, bleibt stehen. */
pruefe('andere Notiz: beide bleiben', entferneFastDoppel(datei(beleg(1, '2026-08-01', 'A'), beleg(1, '2026-09-01', 'B'))).entfernt === 0)
pruefe('andere Kennung: beide bleiben', entferneFastDoppel(datei(beleg(1, '2026-08-01'), beleg(2, '2026-09-01'))).entfernt === 0)
pruefe('andere Plattform: beide bleiben', entferneFastDoppel(datei(beleg(1, '2026-08-01'), beleg(1, '2026-09-01', 'Tonspuren Deutsch', 'primevideo'))).entfernt === 0)
const mitBereich = `${beleg(1, '2026-09-01')}\n  dubRanges:\n    - from: 1\n      to: 2\n      dub: true`
pruefe('andere Bereiche: beide bleiben', entferneFastDoppel(datei(beleg(1, '2026-08-01'), mitBereich)).entfernt === 0)
pruefe('Schlüsselreihenfolge im Block zählt nicht', entferneFastDoppel(datei(beleg(1, '2026-08-01'), "- platform: netflix\n  anilistId: 1\n  checkedAt: '2026-09-01'\n  note: Tonspuren Deutsch\n  dub: true")).entfernt === 1)
/* Text bleibt: Kommentare, Abstände, der Rest. */
const mitKopf = `# Kopf\n\n${beleg(1, '2026-08-01')}\n\n# --- Aus dem Browser gemeldet, abgeholt am 2026-09-02 ---\n\n${beleg(1, '2026-09-01')}\n\n${beleg(2, '2026-09-01')}\n`
const r = entferneFastDoppel(mitKopf)
pruefe('Gruppe aus Hand und Browser bleibt unberührt, gemischt gezählt', r.entfernt === 0 && r.gemischt === 1 && r.text === mitKopf)
const nurHand = `# Kopf\n\n${beleg(1, '2026-08-01')}\n\n${beleg(2, '2026-08-01')}\n\n${beleg(1, '2026-09-01')}\n`
pruefe('Der erste bleibt an seinem Platz und bekommt das jüngste Datum', entferneFastDoppel(nurHand).text === `# Kopf\n\n${beleg(1, '2026-09-01')}\n\n${beleg(2, '2026-08-01')}\n`, entferneFastDoppel(nurHand).text)
const kommentarAmErsten = `# Nur zur Info zu diesem Beleg\n${beleg(1, '2026-08-01')}\n\n${beleg(1, '2026-09-01')}\n`
pruefe('Kommentar am bleibenden Beleg stört nicht', entferneFastDoppel(kommentarAmErsten).text === `# Nur zur Info zu diesem Beleg\n${beleg(1, '2026-09-01')}\n`, entferneFastDoppel(kommentarAmErsten).text)
const ohneAnfuehrung = datei(beleg(1, '2026-08-01'), beleg(1, '2026-09-01').replace("'2026-09-01'", '2026-09-01'))
const roh = entferneFastDoppel(ohneAnfuehrung)
pruefe('Datum als YAML-Datum (ohne Anführungszeichen): nicht angefasst, gezählt', roh.entfernt === 0 && roh.mitKommentar === 1 && roh.text === ohneAnfuehrung, roh)
const gleichesDatum = datei(beleg(1, '2026-09-01'), beleg(1, '2026-08-01'))
pruefe('der Erste hat schon das jüngste Datum: Zeile bleibt', entferneFastDoppel(gleichesDatum).text === beleg(1, '2026-09-01') + '\n')
const ersterOhneDatum = datei(beleg(1, '2026-08-01').replace("  checkedAt: '2026-08-01'\n", ''), beleg(1, '2026-09-01'))
const ohneDatum = entferneFastDoppel(ersterOhneDatum)
pruefe('der Erste ohne checkedAt-Zeile: nicht angefasst, gezählt', ohneDatum.entfernt === 0 && ohneDatum.mitKommentar === 1 && ohneDatum.text === ersterOhneDatum, ohneDatum)
const nurBrowser = `# --- Aus dem Browser gemeldet, abgeholt am 2026-09-02 ---\n\n${beleg(1, '2026-08-01')}\n\n${beleg(1, '2026-09-01')}\n`
pruefe('zwei Browser-Belege: einer bleibt, Abschnittskopf bleibt', entferneFastDoppel(nurBrowser).text === `# --- Aus dem Browser gemeldet, abgeholt am 2026-09-02 ---\n\n${beleg(1, '2026-09-01')}\n`, entferneFastDoppel(nurBrowser).text)
const kommentiert = `${beleg(1, '2026-09-01')}\n\n# Nur zur Info zu diesem Beleg\n${beleg(1, '2026-08-01')}\n`
const k = entferneFastDoppel(kommentiert)
pruefe('eigener Kommentar am überzähligen Beleg: nichts entfernt, gezählt', k.entfernt === 0 && k.mitKommentar === 1 && k.text === kommentiert)
pruefe('zweiter Lauf entfernt nichts mehr', entferneFastDoppel(entferneFastDoppel(nurHand).text).entfernt === 0)
pruefe('leere Datei bleibt leer', entferneFastDoppel('').text === '' && entferneFastDoppel('# nur Kommentar\n').entfernt === 0)

/* Werkzeug als Prozess gegen eine Wegwerf-Datei: schreibt, ändert sonst nichts, --trocken schreibt nicht. */
const wurzel = mkdtempSync(join(tmpdir(), 'fast-doppel-'))
try {
  const pfad = join(wurzel, 'belege.yaml')
  const werkzeug = resolve(ROOT, 'tools', 'handbelege-fast-doppel.ts')
  const lauf = (...optionen: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', werkzeug, ...optionen, pfad], { encoding: 'utf8', timeout: 120_000 })
  writeFileSync(pfad, nurHand)
  const trocken = lauf('--trocken')
  pruefe('Werkzeug --trocken: Exit 0, Datei unverändert', trocken.status === 0 && readFileSync(pfad, 'utf8') === nurHand && /entfernt 1/.test(trocken.stdout), trocken.stderr)
  const echt = lauf()
  pruefe('Werkzeug: Exit 0, Datei ohne Fast-Doppel', echt.status === 0 && ids(readFileSync(pfad, 'utf8')).join() === '1@2026-09-01,2@2026-08-01', echt.stderr)
  writeFileSync(pfad, 'kein: [yaml')
  const kaputt = lauf()
  pruefe('Werkzeug: kaputte Datei gibt Exit ≠ 0 und bleibt, wie sie ist', kaputt.status !== 0 && /YAMLException/.test(kaputt.stderr) && readFileSync(pfad, 'utf8') === 'kein: [yaml')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

/* Bestand */
const bilanz = entferneFastDoppel(readFileSync(resolve(ROOT, 'data', 'dub-confirmed.yaml'), 'utf8'))
pruefe(`Handbelege: höchstens ${NOCH_ZUSAMMENFUEHRBAR_HOECHSTENS} Fast-Doppel zusammenführbar (jetzt ${bilanz.entfernt})`, bilanz.entfernt <= NOCH_ZUSAMMENFUEHRBAR_HOECHSTENS)
pruefe('Handbelege: keine Fast-Doppel-Gruppe mit gemischter Herkunft oder eigenem Kommentar', bilanz.gemischt + bilanz.mitKommentar === 0, bilanz)

if (verletzt) process.exit(1)
console.log(`✓ Handbelege: ${bilanz.entfernt} zusammenführbare Fast-Doppel in ${bilanz.gruppen} Gruppen, ${bilanz.gemischt + bilanz.mitKommentar} nicht auflösbar.`)
