/**
 * Wächter gegen Zeitbomben (20.10.2026, check-woche-beleg verlangte eine Zeile, die `fortschreiben` nach 21 Tagen entfernt):
 * Jede Prüfung, die eine Sammler-Datei unter `data/` aus dem Repo liest, steht mit Grund in `tools/sammler-lesezugriffe.json`
 * („stabil, weil …“). Neue Lesezugriffe ohne Eintrag, Einträge ohne Zugriff und Gründe unter 20 Zeichen sind rot;
 * Dateien mit Zeitfenster (VERBOTEN) darf keine Prüfung lesen — sie bringt ihre Eingabe als Kulisse mit.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-sammler-lesezugriffe.ts`
 */
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { findeLesezugriffe } from './lib/sammler-lesezugriffe.ts'

export interface Zulassung {
  datei: string
  liest: string
  grund: string
}

/** Fortschreiben oder Fenster entfernt Zeilen (`BEHALTEN_TAGE`, Wochenfenster): ein fester Schlüssel darin läuft ab. */
export const VERBOTEN = new Set(['data/crunchyroll-woche-belege.json', 'data/crunchyroll-woche.json', 'data/crunchyroll.json'])

/** Handdateien: `-von-hand.json` und jede YAML unter data/ (20.10.2026 gemessen: kein Code in pipeline/, tools/, .github/ schreibt eine echte data/*.yaml, nur Kulissen). */
const HAND = /(?:-von-hand\.json|\.ya?ml)$/
const MIN_GRUND = 20
/** Dieser Wächter und seine Fälle tragen die Dateinamen nur als Fixture-Text. */
const SELBST = /check-sammler-lesezugriffe/

export function pruefeZugriffe(funde: Map<string, Set<string>>, liste: Zulassung[]): string[] {
  const fehler: string[] = []
  const gelistet = new Set(liste.map((z) => `${z.datei} ${z.liest}`))
  for (const z of liste) {
    if (VERBOTEN.has(z.liest)) fehler.push(`${z.datei}: ${z.liest} hat ein Zeitfenster und darf nicht gelesen werden`)
    if (z.grund.trim().length < MIN_GRUND) fehler.push(`${z.datei} → ${z.liest}: Grund fehlt oder ist zu kurz`)
    if (!funde.get(z.datei)?.has(z.liest)) fehler.push(`${z.datei} → ${z.liest}: Eintrag ohne Lesezugriff (veraltet)`)
  }
  for (const [datei, ziele] of funde) {
    for (const ziel of ziele) {
      if (VERBOTEN.has(ziel)) fehler.push(`${datei}: liest ${ziel} (Zeitfenster) — Kulisse statt Repo-Datei nehmen`)
      else if (!HAND.test(ziel) && !gelistet.has(`${datei} ${ziel}`)) fehler.push(`${datei}: liest ${ziel} ohne Eintrag in tools/sammler-lesezugriffe.json`)
    }
  }
  return fehler
}

/** Prüfungen von `check:logic` (Liste) plus alle Tests unter tools/. In tools/ zählt nur ein echtes Lesen: Fixture-Texte und Kulissen-Helfer tragen dort oft `data/…`-Literale. */
export function sammleFunde(wurzel: string): Map<string, Set<string>> {
  const liste = readFileSync(`${wurzel}/tools/check-logic-liste.txt`, 'utf8').split('\n').map((z) => z.trim().split(/\s+/)[0]!).filter((z) => z && !z.startsWith('#'))
  const tests = readdirSync(`${wurzel}/tools`).filter((f) => /\.test\.(mjs|ts)$/.test(f)).map((f) => `tools/${f}`)
  const funde = new Map<string, Set<string>>()
  for (const d of new Set([...liste, ...tests])) {
    if (SELBST.test(d)) continue
    const alle = findeLesezugriffe(d, readFileSync(`${wurzel}/${d}`, 'utf8'))
    const ziele = new Set(alle.filter((f) => f.art === 'lesen' || d.startsWith('pipeline/')).map((f) => f.ziel))
    if (ziele.size) funde.set(d, ziele)
  }
  return funde
}

/** Quelle und Zieldatei kommen aus `wurzel` (Repo oder Kulisse). */
export function lauf(wurzel: string): { fehler: string[]; zeile: string } {
  const liste = JSON.parse(readFileSync(`${wurzel}/tools/sammler-lesezugriffe.json`, 'utf8')) as Zulassung[]
  const funde = sammleFunde(wurzel)
  const zeile = `check-sammler-lesezugriffe: ${liste.length} Lesezugriffe begründet in ${funde.size} Prüfungen, keine Datei mit Zeitfenster`
  return { fehler: pruefeZugriffe(funde, liste), zeile }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { fehler, zeile } = lauf(process.argv[2] ?? '.')
  for (const f of fehler) console.error(`  ✖ ${f}`)
  if (fehler.length) process.exit(1)
  console.log(zeile)
}
