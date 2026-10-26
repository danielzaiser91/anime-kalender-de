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

/** `unklar`: Zugriffe unter tools/ in unbekannter Form; sie machen nichts rot, erklären aber einen vermeintlich „veralteten“ Eintrag. */
export function pruefeZugriffe(funde: Map<string, Set<string>>, liste: Zulassung[], unklar: Map<string, Set<string>> = new Map()): string[] {
  const fehler: string[] = []
  const gelistet = new Set(liste.map((z) => `${z.datei} ${z.liest}`))
  for (const z of liste) {
    if (VERBOTEN.has(z.liest)) fehler.push(`${z.datei}: ${z.liest} hat ein Zeitfenster und darf nicht gelesen werden`)
    if (z.grund.trim().length < MIN_GRUND) fehler.push(`${z.datei} → ${z.liest}: Grund fehlt oder ist zu kurz`)
    if (!funde.get(z.datei)?.has(z.liest)) {
      const hinweis = unklar.get(z.datei)?.has(z.liest) ? ' — die Datei hat dort einen Zugriff in unbekannter Form (?), vermutlich nur nicht erkannt' : ''
      fehler.push(`${z.datei} → ${z.liest}: Eintrag ohne Lesezugriff (veraltet)${hinweis}`)
    }
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
  return scanne(wurzel).funde
}

/** Wie `sammleFunde`, dazu die „?“-Ziele unter tools/ (ohne Handdateien und ohne Ziele, die dieselbe Datei sicher liest): nur Hinweis, nie rot. */
export function scanne(wurzel: string): { funde: Map<string, Set<string>>; unklar: Map<string, Set<string>> } {
  const liste = readFileSync(`${wurzel}/tools/check-logic-liste.txt`, 'utf8').split('\n').map((z) => z.trim().split(/\s+/)[0]!).filter((z) => z && !z.startsWith('#'))
  const tests = readdirSync(`${wurzel}/tools`).filter((f) => /\.test\.(mjs|ts)$/.test(f)).map((f) => `tools/${f}`)
  const funde = new Map<string, Set<string>>()
  const unklar = new Map<string, Set<string>>()
  for (const d of new Set([...liste, ...tests])) {
    if (SELBST.test(d)) continue
    const alle = findeLesezugriffe(d, readFileSync(`${wurzel}/${d}`, 'utf8'))
    const ziele = new Set(alle.filter((f) => f.art === 'lesen' || d.startsWith('pipeline/')).map((f) => f.ziel))
    if (ziele.size) funde.set(d, ziele)
    const offen = new Set(alle.filter((f) => f.art === '?' && !ziele.has(f.ziel) && !HAND.test(f.ziel)).map((f) => f.ziel))
    if (offen.size) unklar.set(d, offen)
  }
  return { funde, unklar }
}

const HINWEIS_ZIELE = 3

/** Eine Zeile je Prüfung mit unklaren Zugriffen, höchstens drei Ziele genannt (Fixture-Tests tragen oft dutzende). */
export function hinweisZeilen(unklar: Map<string, Set<string>>): string[] {
  return [...unklar].map(([datei, ziele]) => {
    const sortiert = [...ziele].sort()
    const rest = sortiert.length - HINWEIS_ZIELE
    return `  ? ${datei}: ${sortiert.slice(0, HINWEIS_ZIELE).join(', ')}${rest > 0 ? ` (+${rest})` : ''}`
  })
}

/** Quelle und Zieldatei kommen aus `wurzel` (Repo oder Kulisse). */
export function lauf(wurzel: string): { fehler: string[]; zeile: string; hinweise: string[] } {
  const liste = JSON.parse(readFileSync(`${wurzel}/tools/sammler-lesezugriffe.json`, 'utf8')) as Zulassung[]
  const { funde, unklar } = scanne(wurzel)
  const zeile = `check-sammler-lesezugriffe: ${liste.length} Lesezugriffe begründet in ${funde.size} Prüfungen, keine Datei mit Zeitfenster`
  return { fehler: pruefeZugriffe(funde, liste, unklar), zeile, hinweise: hinweisZeilen(unklar) }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { fehler, zeile, hinweise } = lauf(process.argv[2] ?? '.')
  for (const f of fehler) console.error(`  ✖ ${f}`)
  if (fehler.length) process.exit(1)
  console.log(zeile)
  if (hinweise.length) console.log(`Hinweis (kein Fehler): ${hinweise.length} Tests unter tools/ lesen data/ in unbekannter Form (?), der Scanner ordnet sie nicht ein:\n${hinweise.join('\n')}`)
}
