/**
 * Sollfassung des Jobs `PR-Datenbau` der PR-Prüfkette (16.10.2026), Teil von `tools/pr-kette-pruefen.mjs`.
 * Der Job baut den Datensatz (`npm run data:build`, ohne Commit) auf dem Cache von main, damit `pipeline/lib/pruefung.ts` vor dem Merge läuft
 * (PR 1368 setzte ein Feld, das ein späterer Bauschritt anders vererbt; der Widerspruch brach erst den Bestandsbau auf main ab).
 * Er hat eine eigene Form (Pfadfilter über Schritt-`if`, Cache lesen), also wird er als Ganzes gegen die Sollfassung verglichen:
 * jede Abweichung (Pfadfilter, Cache-Schlüssel, fehlender Abbruch bei Cache-Miss, `continue-on-error`, anderer Befehl) ist rot.
 */
import { isDeepStrictEqual } from 'node:util'

export const DATENBAU_NAME = 'PR-Datenbau'
const BETROFFEN = "steps.pfad.outputs.betroffen == '1'"
/** Pfade, bei denen der Datensatz anders ausfallen kann; dazu dieser Workflow, damit eine Änderung am Job sich selbst prüft. */
export const PFAD_MUSTER = '^(pipeline/|shared/|data/|package-lock\\.json$|\\.github/workflows/pr-pruefung\\.yml$)'

const PFAD_SKRIPT = [
  `PFADE='${PFAD_MUSTER}'`,
  'if git diff --name-only "origin/${{ github.base_ref }}...HEAD" | grep -qE "$PFADE"; then',
  '  echo "betroffen=1" >> "$GITHUB_OUTPUT"',
  'fi',
  '',
].join('\n')

const SOLL_SCHRITTE = [
  { uses: 'actions/checkout@v4', with: { 'fetch-depth': 0 } },
  { name: 'Betrifft der PR den Datenbau?', id: 'pfad', run: PFAD_SKRIPT },
  { if: BETROFFEN, uses: './.github/actions/kette-einrichten' },
  // Gleiches Präfix wie bestand-bauen.yml: der Bau liest den Cache nur.
  {
    if: BETROFFEN,
    name: 'AniList-Cache lesen',
    id: 'cache',
    uses: 'actions/cache/restore@v4',
    with: { path: 'data/cache', key: 'anilist-cache-${{ github.run_id }}', 'restore-keys': 'anilist-cache-' },
  },
  // Ohne Cache entstünde ein Datensatz ganz ohne Titel: dann lieber rot als ein leerer Bau, der nichts prüft.
  {
    if: `${BETROFFEN} && steps.cache.outputs.cache-matched-key == ''`,
    name: 'Kein Cache vorhanden',
    run: 'echo "::error::Kein anilist-cache gefunden"\nexit 1\n',
  },
  { if: BETROFFEN, name: 'Datensatz bauen (ohne Commit)', run: 'npm run data:build' },
]

export const SOLL_DATENBAU = {
  name: DATENBAU_NAME,
  if: "${{ !startsWith(github.head_ref, 'daten/') && !github.event.pull_request.draft }}",
  'runs-on': 'ubuntu-latest',
  'timeout-minutes': 20,
  steps: SOLL_SCHRITTE,
}

/** Verstöße des Datenbau-Jobs: gesucht wird er am Namen, verglichen wird er als Ganzes. */
export function pruefeDatenbau(jobs) {
  const treffer = Object.entries(jobs).filter(([, j]) => j.name === DATENBAU_NAME)
  if (treffer.length !== 1) return [`Kein (oder mehr als ein) Job mit dem Namen "${DATENBAU_NAME}" (Auslieferungsprüfung vor dem Merge)`]
  const [id, job] = treffer[0]
  if (isDeepStrictEqual(job, SOLL_DATENBAU)) return []
  return [`Job "${id}" (${DATENBAU_NAME}) weicht von der Sollfassung in tools/pr-kette-datenbau.mjs ab (Pfadfilter, Cache, Befehl, if, Frist)`]
}
