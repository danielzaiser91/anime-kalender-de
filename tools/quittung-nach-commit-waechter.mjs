/**
 * Wächter (17.10.2026): Der Briefkasten im Worker (D1) vergisst eine Meldung, Rohfolge oder einen Vorfall erst,
 * wenn das Ergebnis im Repo steht.
 *
 * Anlass: Am 16.10.2026 (Lauf 38959396065) hakte der Schritt „Rohfolgen zuordnen" 13.350 Rohfolgen ab. Danach
 * scheiterte „Datensatz bauen", „Änderungen committen" lief nicht, und 1.029 zugeordnete Adressen gingen verloren.
 *
 * Regel je Job jedes Workflows (geparstes YAML, nicht der Text):
 * 1. Ein Schritt, der quittiert (`QUITTUNGEN[].quittiert`), steht nach dem ersten Schritt mit `tools/commit-data.sh`.
 * 2. Ein Schritt, der merkt (`QUITTUNGEN[].merkt`), steht vor diesem Commit, und nach ihm folgt sein Quittungsschritt.
 * 3. `data:pruefungen` läuft nur mit `--abhaken-spaeter`, `--nur-abhaken` oder `--trocken`: ohne Schalter hakt er sofort ab.
 * Für `bestand-bauen.yml` sind Commit- und Quittungsschritte zusätzlich Schlüssel für Schlüssel festgelegt.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { parse } from 'yaml'

const TOKEN_ENV = { LAUF_TOKEN: '${{ secrets.LAUF_TOKEN }}' }

export const QUITTUNGEN = [
  { merkt: 'npm run data:pruefungen -- --abhaken-spaeter', quittiert: 'npm run data:pruefungen -- --nur-abhaken', name: 'Meldungen abhaken' },
  { merkt: 'npm run data:rohfolgen', quittiert: 'npm run data:rohfolgen-abhaken', name: 'Rohfolgen abhaken' },
  { merkt: 'npm run data:vorfaelle', quittiert: 'npm run data:vorfaelle -- --nur-loeschen', name: 'Vorfälle löschen' },
]

/** Die festgelegten Schritte in `bestand-bauen.yml`, in dieser Reihenfolge direkt hintereinander. */
export const FEST = [
  { name: 'Änderungen committen', env: { BAU_LAUF: '1' }, run: 'bash tools/commit-data.sh "chore(data): Bestand neu gebaut"\n' },
  ...QUITTUNGEN.map((q) => ({ name: q.name, env: TOKEN_ENV, run: q.quittiert })),
]

const lauf = (schritt) => String(schritt?.run ?? '').trim()

/** Fehler eines Jobs: Reihenfolge von Merken, Commit und Quittieren. */
export function pruefeJob(ort, schritte) {
  const fehler = []
  const commit = schritte.findIndex((s) => lauf(s).includes('tools/commit-data.sh'))
  schritte.forEach((s, i) => {
    const r = lauf(s)
    if (/data:pruefungen(?!\S)/.test(r) && !/--(abhaken-spaeter|nur-abhaken|trocken)\b/.test(r)) {
      fehler.push(`${ort}, Schritt ${i} „${s.name}": data:pruefungen ohne --abhaken-spaeter hakt vor dem Commit ab`)
    }
    for (const q of QUITTUNGEN) {
      if (r === q.quittiert && (commit < 0 || i < commit)) fehler.push(`${ort}, Schritt ${i} „${s.name}": quittiert vor dem Commit`)
      if (r !== q.merkt) continue
      if (i > commit) fehler.push(`${ort}, Schritt ${i} „${s.name}": merkt nach dem Commit oder ohne Commit`)
      if (!schritte.some((t, j) => j > commit && lauf(t) === q.quittiert)) {
        fehler.push(`${ort}, Schritt ${i} „${s.name}": kein Schritt „${q.quittiert}" nach dem Commit`)
      }
    }
  })
  return fehler
}

/** Die festgelegten Schritte in bestand-bauen.yml: genau diese Schlüssel, direkt hintereinander. */
export function pruefeFest(schritte) {
  const start = schritte.findIndex((s) => s?.name === FEST[0].name)
  if (start < 0) return [`bestand-bauen.yml: Schritt „${FEST[0].name}" fehlt`]
  return FEST.flatMap((soll, k) =>
    isDeepStrictEqual(schritte[start + k], soll) ? [] : [`bestand-bauen.yml: Schritt ${start + k} ist nicht ${JSON.stringify(soll)}`],
  )
}

export function pruefeWorkflow(datei, doc) {
  const fehler = []
  for (const [job, inhalt] of Object.entries(doc?.jobs ?? {})) {
    const schritte = inhalt?.steps ?? []
    fehler.push(...pruefeJob(`${datei} → ${job}`, schritte))
    if (datei === 'bestand-bauen.yml' && job === 'bauen') fehler.push(...pruefeFest(schritte))
  }
  if (datei === 'bestand-bauen.yml' && !doc?.jobs?.bauen) fehler.push('bestand-bauen.yml: Job „bauen" fehlt')
  return fehler
}

export function pruefeAlle(verzeichnis) {
  const fehler = []
  for (const datei of readdirSync(verzeichnis).filter((f) => /\.ya?ml$/.test(f))) {
    fehler.push(...pruefeWorkflow(datei, parse(readFileSync(join(verzeichnis, datei), 'utf8'))))
  }
  return fehler
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const fehler = pruefeAlle(join(process.cwd(), '.github/workflows'))
  for (const f of fehler) console.error(`FEHL ${f}`)
  if (fehler.length) process.exit(1)
  console.log('quittung-nach-commit-waechter: ok')
}
