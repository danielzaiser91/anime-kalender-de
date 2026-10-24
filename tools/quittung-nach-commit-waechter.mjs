/**
 * Wächter (17.10.2026): Der Briefkasten im Worker (D1) vergisst eine Meldung, Rohfolge oder einen Vorfall erst,
 * wenn das Ergebnis im Repo steht.
 *
 * Anlass: Am 16.10.2026 (Lauf 38959396065) hakte der Schritt „Rohfolgen zuordnen" 13.350 Rohfolgen ab. Danach
 * scheiterte „Datensatz bauen", „Änderungen committen" lief nicht, und 1.029 zugeordnete Adressen gingen verloren.
 *
 * Die Sperre selbst sitzt seit Runde 2 von PR 1426 in den Skripten: Sie quittieren nur, was `tools/commit-data.sh` nach
 * einem grünen Commit freigegeben hat (`pipeline/lib/spaeter-quittieren.ts`), und brechen bei falschen Schaltern ab
 * (`pipeline/lib/schalter.ts`); belegt in `check-quittung-sperre.ts` und `commit-data-test.sh`. Wie ein Schritt
 * geschrieben ist, spielt dafür keine Rolle. Dieser Wächter warnt nur vor, dass ein Schritt an der falschen Stelle
 * steht (dort quittierte er nichts) oder auf einen merkenden Schritt keine Quittung folgt.
 *
 * Regel je Job jedes Workflows (geparstes YAML, nicht der Text):
 * 1. Ein Schritt, der quittiert (`QUITTUNGEN[].quittiert`), steht nach dem ersten Schritt mit `tools/commit-data.sh`.
 * 2. Ein Schritt, der merkt (`QUITTUNGEN[].merkt`), steht vor diesem Commit, und nach ihm folgt sein Quittungsschritt.
 * 3. Ein Merker-Dateiname steht in einem Schritt nur als `data/cache/quittung-offen/<name>` (`pruefeMerkerPfade`).
 * Aufrufe erkennt `quittung-aufrufe.mjs` am Kommando (npm-Skript auch indirekt, Pfad, verkettet, mit Zusatzargumenten).
 * Für `bestand-bauen.yml` sind Commit- und Quittungsschritte zusätzlich Schlüssel für Schlüssel festgelegt.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { parse } from 'yaml'
import { aufrufe, SKRIPTE } from './quittung-aufrufe.mjs'

const TOKEN_ENV = { LAUF_TOKEN: '${{ secrets.LAUF_TOKEN }}' }

const PRUEFUNGEN = 'pipeline/fetch-pruefungen.ts'
const VORFAELLE = 'pipeline/fetch-vorfaelle.ts'
const hat = (schalter) => (befehl) => new RegExp(`--(${schalter})(?!\\S)`).test(befehl)

/** `merkt`/`quittiert` sind die Sollzeilen (für FEST); erkannt wird über Datei und Schalter. */
export const QUITTUNGEN = [
  {
    name: 'Meldungen abhaken',
    merkt: 'npm run data:pruefungen -- --abhaken-spaeter',
    quittiert: 'npm run data:pruefungen -- --nur-abhaken',
    merktDatei: PRUEFUNGEN,
    merktPasst: (b) => !hat('nur-abhaken|trocken')(b),
    quittDatei: PRUEFUNGEN,
    quittPasst: hat('nur-abhaken'),
  },
  {
    name: 'Rohfolgen abhaken',
    merkt: 'npm run data:rohfolgen',
    quittiert: 'npm run data:rohfolgen-abhaken',
    merktDatei: 'pipeline/fetch-rohfolgen.ts',
    merktPasst: () => true,
    quittDatei: 'pipeline/rohfolgen-abhaken.ts',
    quittPasst: () => true,
  },
  {
    name: 'Vorfälle löschen',
    merkt: 'npm run data:vorfaelle',
    quittiert: 'npm run data:vorfaelle -- --nur-loeschen',
    merktDatei: VORFAELLE,
    merktPasst: (b) => !hat('nur-loeschen|trocken')(b),
    quittDatei: VORFAELLE,
    quittPasst: hat('nur-loeschen'),
  },
]

/** Die festgelegten Schritte in `bestand-bauen.yml`, in dieser Reihenfolge direkt hintereinander. */
export const FEST = [
  { name: 'Änderungen committen', env: { BAU_LAUF: '1' }, run: 'bash tools/commit-data.sh "chore(data): Bestand neu gebaut"\n' },
  ...QUITTUNGEN.map((q) => ({ name: q.name, env: TOKEN_ENV, run: q.quittiert })),
]

const lauf = (schritt) => String(schritt?.run ?? '').trim()

const ruft = (schritt, datei, passt, skripte) => aufrufe(lauf(schritt), skripte).some((a) => a.datei === datei && passt(a.befehl))

/** Fehler eines Jobs: Reihenfolge von Merken, Commit und Quittieren. `skripte` = `scripts` der package.json. */
export function pruefeJob(ort, schritte, skripte = SKRIPTE) {
  const fehler = []
  const commit = schritte.findIndex((s) => lauf(s).includes('tools/commit-data.sh'))
  schritte.forEach((s, i) => {
    for (const q of QUITTUNGEN) {
      if (ruft(s, q.quittDatei, q.quittPasst, skripte) && (commit < 0 || i < commit)) fehler.push(`${ort}, Schritt ${i} „${s.name}": quittiert vor dem Commit`)
      if (!ruft(s, q.merktDatei, q.merktPasst, skripte)) continue
      if (i > commit) fehler.push(`${ort}, Schritt ${i} „${s.name}": merkt nach dem Commit oder ohne Commit`)
      if (!schritte.some((t, j) => j > commit && ruft(t, q.quittDatei, q.quittPasst, skripte))) {
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

/**
 * Ein Schritt, der einen Merker anfasst (z. B. löscht, wenn neue Handbelege zurückgestellt werden), nennt ihn unter
 * `data/cache/quittung-offen/`; ein anderer Pfad ginge ins Leere, und die Quittung käme trotzdem.
 */
export function pruefeMerkerPfade(ort, schritte) {
  return schritte.flatMap((s, i) =>
    [...lauf(s).replaceAll(/["']/g, '').matchAll(/(\S*?)(rohfolgen-abhaken|vorfaelle-loeschen|pruefungen-abhaken)\.json/g)]
      .filter((m) => m[1] !== 'data/cache/quittung-offen/')
      .map((m) => `${ort}, Schritt ${i} „${s.name}": Merker ${m[0]} liegt unter data/cache/quittung-offen/`),
  )
}

/** Der Cache bringt keine Merker mit: Direkt nach seiner Wiederherstellung räumt dieser Schritt beide Ordner (sonst gäbe `commit-data.sh` sie nach dem Commit frei). */
export const CACHE_AUFRAEUMEN = { name: 'Quittungs-Merker aus dem Cache verwerfen', run: 'rm -rf data/cache/quittung-offen data/cache/quittung-frei' }

export function pruefeCacheAufraeumen(schritte) {
  const restore = schritte.findIndex((s) => s?.name === 'AniList-Cache wiederverwenden')
  if (restore < 0) return ['bestand-bauen.yml: Schritt „AniList-Cache wiederverwenden" fehlt']
  if (isDeepStrictEqual(schritte[restore + 1], CACHE_AUFRAEUMEN)) return []
  return [`bestand-bauen.yml: direkt nach dem Cache-Restore fehlt ${JSON.stringify(CACHE_AUFRAEUMEN)}`]
}

/**
 * Werden neue Handbelege ganz zurückgerollt, löscht der Schritt „Neue Handbelege prüfen" als Ende seines Skripts den
 * Meldungsmerker (Zeile unverschachtelt, unmittelbar nach dem Zurücksetzen der Übernahme); sonst gäbe `commit-data.sh`
 * Meldungen frei, deren Belege nicht im Repo stehen.
 */
export const ZURUECKROLLEN_ENDE = ['git checkout -- data/meldungen-uebernahme.json', 'rm -f data/cache/quittung-offen/pruefungen-abhaken.json']

export function pruefeZurueckrollen(schritte) {
  const schritt = schritte.find((s) => s?.name === 'Neue Handbelege prüfen')
  if (!schritt) return ['bestand-bauen.yml: Schritt „Neue Handbelege prüfen" fehlt']
  const ende = String(schritt.run ?? '').split('\n').filter((z) => z.trim() !== '').slice(-3)
  const ok = ende[0] === ZURUECKROLLEN_ENDE[0] && ende[1] === ZURUECKROLLEN_ENDE[1] && ende[2]?.startsWith('echo "DATEN_WARNUNG=')
  return ok ? [] : [`bestand-bauen.yml: „Neue Handbelege prüfen" endet nicht mit ${ZURUECKROLLEN_ENDE.join(' / ')} (unverschachtelt)`]
}

export function pruefeWorkflow(datei, doc) {
  const fehler = []
  for (const [job, inhalt] of Object.entries(doc?.jobs ?? {})) {
    const schritte = inhalt?.steps ?? []
    fehler.push(...pruefeJob(`${datei} → ${job}`, schritte))
    fehler.push(...pruefeMerkerPfade(`${datei} → ${job}`, schritte))
    if (datei === 'bestand-bauen.yml' && job === 'bauen') fehler.push(...pruefeFest(schritte), ...pruefeCacheAufraeumen(schritte), ...pruefeZurueckrollen(schritte))
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
