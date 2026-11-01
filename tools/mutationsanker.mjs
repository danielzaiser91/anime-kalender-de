#!/usr/bin/env node
/**
 * Anker-Wächter für Mutationslisten (tools/mutationen/*.json): findet der Läufer (tools/mutationslaeufer.mjs)
 * jeden `suche`-Anker noch in seiner `datei`? Sonst wäre der Mutant beim Prüfer „nicht gefunden“.
 * Dieselbe Suche wie der Läufer (planeMutant), keine zweite Fassung.
 *
 * Aufruf: node tools/mutationsanker.mjs <liste.json>…   prüft genau diese Listen
 *         node tools/mutationsanker.mjs --alle          misst alle Listen (Messung, Exit 0)
 * Im PR prüft tools/pr-vorpruefung.mjs nur die Listen, die der Diff neu anlegt oder ändert: alte Listen
 * gemergter PRs veralten zwangsläufig und wären sonst rot (Messung siehe PR-Text).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalisiereListe, normalisierePfad, parseListeText, planeMutant } from './mutationslaeufer.mjs'

const LISTEN_ORDNER = 'tools/mutationen/'

export const istMutationsliste = (pfad) => pfad.startsWith(LISTEN_ORDNER) && pfad.endsWith('.json') && !pfad.slice(LISTEN_ORDNER.length).includes('/')

/** Fehlerzeilen einer Liste: kaputtes JSON, fehlende Datei, Anker weg/mehrdeutig/wirkungslos. `lies(pfad)` liefert Text oder null. */
export function ankerFehler(listeName, listeText, lies, cwd = process.cwd()) {
  let liste
  try {
    const roh = parseListeText(listeText)
    // Paare [suche, ersetze] ohne Datei gehören zu mutationsprobe.mjs, nicht zum Läufer: hier nichts zu prüfen.
    if (Array.isArray(roh) && roh.length > 0 && roh.every(Array.isArray)) return []
    liste = normalisiereListe(roh)
  } catch (e) {
    return [`${listeName}: ${e.message}`]
  }
  const fehler = []
  const originale = new Map()
  for (const m of liste) {
    for (const a of m.aenderungen) {
      const pfad = normalisierePfad(a.datei, cwd)
      if (originale.has(pfad)) continue
      const text = lies(a.datei)
      if (text !== null) originale.set(pfad, Buffer.from(text, 'utf8'))
    }
  }
  for (const m of liste) {
    const fehlt = m.aenderungen.find((a) => !originale.has(normalisierePfad(a.datei, cwd)))
    if (fehlt) {
      fehler.push(`${listeName}: „${m.name}“: Datei ${fehlt.datei} fehlt`)
      continue
    }
    const plan = planeMutant(m, originale, cwd)
    if (plan.urteil) fehler.push(`${listeName}: „${m.name}“: ${plan.urteil} (${plan.detail})`)
  }
  return fehler
}

const leseDatei = (pfad) => (existsSync(pfad) ? readFileSync(pfad, 'utf8') : null)

/** Prüft die genannten Listen auf der Platte; Rückgabe { fehler, anzahl } (anzahl = geprüfte Mutanten). */
export function pruefeListen(listen, lies = leseDatei) {
  const fehler = []
  let anzahl = 0
  for (const name of listen) {
    const text = lies(name)
    if (text === null) continue
    fehler.push(...ankerFehler(name, text, lies))
    try {
      anzahl += parseListeText(text).length
    } catch {
      // schon als Fehler gemeldet
    }
  }
  return { fehler, anzahl }
}

/** Die Mutationslisten, die der Diff (Pfade) neu anlegt oder ändert; gelöschte Dateien fehlen auf der Platte und fallen weg. */
export const listenImDiff = (dateien) => dateien.filter(istMutationsliste)

/** Rote Befunde für die Listen des Diffs (für tools/pr-vorpruefung.mjs). */
export const ankerRot = (dateien, lies = leseDatei) => pruefeListen(listenImDiff(dateien), lies).fehler.map((f) => `Mutationsanker: ${f}`)

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--alle')) {
    const alle = readdirSync(LISTEN_ORDNER).filter((n) => n.endsWith('.json')).map((n) => LISTEN_ORDNER + n)
    for (const name of alle) {
      const { fehler, anzahl } = pruefeListen([name])
      console.log(`${name}: ${anzahl} Mutanten, ${fehler.length} ohne Anker`)
    }
    const gesamt = pruefeListen(alle)
    console.log(`Mutationsanker (Messung): ${alle.length} Listen, ${gesamt.anzahl} Mutanten, ${gesamt.fehler.length} Anker nicht auffindbar`)
    return 0
  }
  if (!args.length) {
    const basis = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim()
    const diff = execFileSync('git', ['diff', '--name-only', '--no-renames', '--diff-filter=AM', `${basis}..HEAD`], { encoding: 'utf8' })
    args.push(...listenImDiff(diff.split('\n').filter(Boolean)))
  }
  const { fehler, anzahl } = pruefeListen(args)
  for (const f of fehler) console.error(`  ✖ ${f}`)
  console.log(`Mutationsanker: ${args.length} Listen, ${anzahl} Mutanten, ${fehler.length} Anker nicht auffindbar`)
  return fehler.length ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main())
