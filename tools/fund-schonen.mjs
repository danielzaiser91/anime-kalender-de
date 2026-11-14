#!/usr/bin/env node
/**
 * Schont main beim Nachliefern eines Funds (`fund-nachliefern.yml`): Eine Fund-Datei, die auf main nach dem Start des Fundlaufs geändert wurde, wird verworfen
 * (main-Stand bleibt), jede verworfene Datei steht im Log und im Hinweis für den PR. `data/source-health.json` wird nie verworfen, sondern je Quelle
 * zusammengeführt: Eine Quelle, von der eine Datei verworfen wurde, behält den Eintrag von main.
 *
 * Aufruf (im Checkout von main, Fund schon darübergelegt):
 *   node tools/fund-schonen.mjs <Startzeit des Fundlaufs, ISO> [--aenderungen <json Pfad→ISO|null>] [--hinweis <Datei>]
 * Ohne `--aenderungen` fragt es `gh api repos/$GITHUB_REPOSITORY/commits?path=…&since=…` (Nichtauskunft = Abbruch, Exit 1, nichts wird verworfen oder geschrieben).
 * Exit 0 = fertig, 1 = Abruf gescheitert, 2 = Aufruf falsch.
 *
 * Zuordnung Quelle → Datei: Es gibt keine Tabelle. Belegt ist nur die Namenskonvention der Schlüssel in `source-health.json` (`tmdb-titles` → `data/tmdb-titles.json`,
 * `justwatch-audio` → `data/justwatch-audio.json`): Dateiname ohne Endung ist gleich dem Schlüssel oder beginnt mit `<Schlüssel>-`. Das trifft eher zu viel als zu wenig
 * (`anisearch` fällt mit jeder `anisearch-*`-Datei mit) — im Zweifel bleibt der Eintrag von main.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

export const HEALTH = 'data/source-health.json'

/** Pfade des Funds → übernehmen oder verwerfen; `aenderungen[pfad]` = Zeitpunkt der letzten Änderung auf main (ISO) oder null/fehlend. */
export function entscheide(pfade, aenderungen, fundZeit) {
  const start = Date.parse(fundZeit)
  if (!Number.isFinite(start)) throw new Error(`Startzeit des Fundlaufs unlesbar: ${fundZeit}`)
  const uebernehmen = []
  const verwerfen = []
  for (const pfad of pfade) {
    const spaet = Date.parse(aenderungen[pfad] ?? '')
    if (pfad !== HEALTH && spaet > start) verwerfen.push({ pfad, aenderung: aenderungen[pfad] })
    else uebernehmen.push(pfad)
  }
  return { uebernehmen, verwerfen }
}

/** Gehört eine verworfene Datei zu dieser Quelle? (Namenskonvention, siehe Kopf.) */
export function quelleBetroffen(quelle, verworfenePfade) {
  return verworfenePfade.some((pfad) => {
    const name = basename(pfad).replace(/\.[^.]*$/, '')
    return name === quelle || name.startsWith(`${quelle}-`)
  })
}

const jung = (e) => Date.parse(e?.lastRun ?? '') || 0

/** Gesundheitsdatei: main-Fassung + Einträge des Funds, außer für Quellen mit verworfener Datei; je Quelle gilt der jüngere `lastRun`. Zeilenende am Dateiende wie bei main. */
export function healthZusammenfuehren(mainText, fundText, verworfenePfade) {
  // Unlesbare Fassung: Fehler statt leerer Stand — sonst gingen alle Einträge still verloren.
  const main = JSON.parse(mainText)
  const fund = JSON.parse(fundText)
  const raus = { ...main }
  for (const [quelle, eintrag] of Object.entries(fund)) {
    if (quelleBetroffen(quelle, verworfenePfade)) continue
    if (!raus[quelle] || jung(eintrag) >= jung(raus[quelle])) raus[quelle] = eintrag
  }
  return JSON.stringify(raus, null, 2) + (mainText.endsWith('\n') ? '\n' : '')
}

/** Eine Zeile je verworfener Datei plus Zusammenfassung; leer, wenn nichts verworfen wurde. */
export function hinweisZeilen(verwerfen) {
  if (verwerfen.length === 0) return []
  return [
    ...verwerfen.map((v) => `verworfen (auf main seit Fundlauf geändert, ${v.aenderung}): ${v.pfad}`),
    `${verwerfen.length} Datei(en) des Funds verworfen: ${verwerfen.map((v) => v.pfad).join(', ')}`,
  ]
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 1 << 26 })

/** Pfade, die der Fund gegenüber HEAD (main) geändert, gelöscht oder neu angelegt hat. */
export function fundPfade() {
  return git(['status', '--porcelain', '--untracked-files=all', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((z) => z.slice(3))
}

function frageMain(pfad, fundZeit) {
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) throw new Error('GITHUB_REPOSITORY fehlt')
  const url = `repos/${repo}/commits?sha=main&path=${encodeURIComponent(pfad)}&since=${encodeURIComponent(fundZeit)}&per_page=1`
  let letzter
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      // Für den Test steht FUND_SCHONEN_GH auf ein Node-Skript, das `gh` ersetzt (läuft so unter Windows und Linux gleich).
      const [befehl, ...vorn] = process.env.FUND_SCHONEN_GH ? [process.execPath, process.env.FUND_SCHONEN_GH] : ['gh']
      const antwort = JSON.parse(execFileSync(befehl, [...vorn, 'api', url], { encoding: 'utf8', timeout: 60000, windowsHide: true }))
      if (!Array.isArray(antwort)) throw new Error(`Antwort ist keine Commit-Liste: ${JSON.stringify(antwort).slice(0, 200)}`)
      if (antwort.length === 0) return null
      const datum = antwort[0]?.commit?.committer?.date
      if (!Date.parse(datum)) throw new Error(`Commit ohne lesbares Datum: ${JSON.stringify(antwort[0]).slice(0, 200)}`)
      return datum
    } catch (e) {
      letzter = e
      console.error(`gh api für ${pfad} fehlgeschlagen (Versuch ${versuch} von 3): ${String(e.stderr ?? e.message).slice(0, 300)}`)
    }
  }
  throw letzter
}

/** Verwirft die Dateien (main-Stand zurück bzw. neue Datei entfernen) und führt die Gesundheitsdatei zusammen. Gibt die Entscheidung zurück. */
export function schone(fundZeit, aenderungen) {
  const pfade = fundPfade()
  const karte = aenderungen ?? Object.fromEntries(pfade.filter((p) => p !== HEALTH).map((p) => [p, frageMain(p, fundZeit)]))
  const entscheidung = entscheide(pfade, karte, fundZeit)
  const verworfen = entscheidung.verwerfen.map((v) => v.pfad)
  const fundHealth = existsSync(HEALTH) ? readFileSync(HEALTH, 'utf8') : '{}'
  for (const pfad of verworfen) {
    let verfolgt = true
    try {
      git(['cat-file', '-e', `HEAD:${pfad}`])
    } catch {
      verfolgt = false
    }
    if (verfolgt) git(['checkout', 'HEAD', '--', pfad])
    else rmSync(pfad, { force: true })
  }
  if (pfade.includes(HEALTH)) {
    writeFileSync(HEALTH, healthZusammenfuehren(git(['show', `HEAD:${HEALTH}`]), fundHealth, verworfen))
  }
  return entscheidung
}

function main(argv) {
  const [fundZeit, ...rest] = argv
  const wert = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined)
  if (!fundZeit) {
    console.error('Aufruf: node tools/fund-schonen.mjs <Startzeit ISO> [--aenderungen <json>] [--hinweis <Datei>]')
    return 2
  }
  let ergebnis
  try {
    const datei = wert('--aenderungen')
    ergebnis = schone(fundZeit, datei ? JSON.parse(readFileSync(datei, 'utf8')) : undefined)
  } catch (e) {
    console.error(`Fund schonen gescheitert: ${e.message}`)
    return 1
  }
  const zeilen = hinweisZeilen(ergebnis.verwerfen)
  for (const z of zeilen) console.log(z)
  console.log(`Fund schonen: ${ergebnis.uebernehmen.length} Datei(en) übernommen, ${ergebnis.verwerfen.length} verworfen.`)
  const hinweis = wert('--hinweis')
  if (hinweis) writeFileSync(hinweis, ergebnis.verwerfen.length ? `${ergebnis.verwerfen.length} Datei(en) verworfen, auf main neuer: ${ergebnis.verwerfen.map((v) => v.pfad.replace(/^data\//, '')).join(', ')}` : '')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
