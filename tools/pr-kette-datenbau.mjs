/**
 * Sollfassung des Jobs `PR-Datenbau` der PR-Prüfkette (16.10.2026), Teil von `tools/pr-kette-pruefen.mjs`.
 * Der Job baut den Datensatz (`npm run data:build`, ohne Commit) auf dem Cache von main, damit `pipeline/lib/pruefung.ts` vor dem Merge läuft
 * (PR 1368 setzte ein Feld, das ein späterer Bauschritt anders vererbt; der Widerspruch brach erst den Bestandsbau auf main ab).
 * Bewusst ohne Pfadfilter (die Eingaben des Baus reichen bis web/src/lib; 16.10.2026). Er hat eine eigene Form (Cache lesen), also wird er als Ganzes gegen die Sollfassung verglichen:
 * jede Abweichung (Cache-Schlüssel, fehlender Abbruch bei Cache-Miss, `continue-on-error`, anderer Befehl) ist rot.
 */
import { isDeepStrictEqual } from 'node:util'

export const DATENBAU_NAME = 'PR-Datenbau'
const SOLL_SCHRITTE = [
  // Tiefe 2: die Bestandsprüfungen bauen bei Rot die Basis HEAD^1 (main im Merge-Ref) zum Vergleich.
  { uses: 'actions/checkout@v4', with: { 'fetch-depth': 2 } },
  { uses: './.github/actions/kette-einrichten' },
  // Gleiches Präfix wie bestand-bauen.yml: der Bau liest den Cache nur.
  {
    name: 'AniList-Cache lesen',
    id: 'cache',
    uses: 'actions/cache/restore@v4',
    with: { path: 'data/cache', key: 'anilist-cache-${{ github.run_id }}', 'restore-keys': 'anilist-cache-' },
  },
  // Ohne Cache entstünde ein Datensatz ganz ohne Titel: dann lieber rot als ein leerer Bau, der nichts prüft.
  {
    if: "steps.cache.outputs.cache-matched-key == ''",
    name: 'Kein Cache vorhanden',
    run: 'echo "::error::Kein anilist-cache gefunden"\nexit 1\n',
  },
  // Neue Beleg-Adressen des PR werden abgerufen: 404/410 rot, sonst Nichtauskunft (PR 2628: UCI-Adresse 404, alle Checks grün).
  { name: 'Neue Beleg-Adressen erreichbar', run: 'npx tsx pipeline/neue-quellen-pruefen.ts' },
  { name: 'Datensatz bauen (ohne Commit)', run: 'npm run data:build' },
  // Gemessenes Ja ⇒ mindestens ein Weg, am frisch gebauten Datensatz (18.10.2026: Hazbin Hotel und fünf weitere Cartoons).
  { name: 'Gemessenes Ja hat einen Weg', run: 'npx tsx pipeline/check-ja-hat-weg-bestand.ts' },
  // Direkt nach dem Bau und als letzter Schritt: `check:bestand` liest die Bauausgabe (16.10.2026, vorher erst im Bestandsbau nach dem Merge).
  // Jede Prüfung läuft; rot nur, was auf der Basis grün ist (17.10.2026, tools/pr-bestand-vergleich.mjs).
  { name: 'Bestandsprüfungen auf der Bauausgabe', run: 'node tools/pr-bestand-vergleich.mjs HEAD^1' },
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
  return [`Job "${id}" (${DATENBAU_NAME}) weicht von der Sollfassung in tools/pr-kette-datenbau.mjs ab (Cache, Befehl, if, Frist)`]
}
