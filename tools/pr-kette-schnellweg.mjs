/**
 * Sollfassung der Jobs `scope` und `modschnell` der PR-Prüfkette (Mod-Schnellweg, 20.11.2026), Teil von `tools/pr-kette-pruefen.mjs`.
 * `scope` entscheidet mit tools/pr-nur-mod.mjs, ob der PR nur die Mod `arbeitsliste` (und Skill-Markdown) ändert; dann überspringen alle anderen Jobs sich
 * (`needs.scope.outputs.nur_mod`), und `modschnell` fährt genau die Prüfungen, die eine Mod-Änderung berühren. Der Sammeljob zählt übersprungen nur dann
 * als bestanden (tools/kette-urteil.mjs). Beide Jobs werden als Ganzes gegen die Sollfassung verglichen (wie `PR-Datenbau`).
 */
import { isDeepStrictEqual } from 'node:util'

export const SCOPE_NAME = 'Kette – Umfang'
export const SCHNELLWEG_NAME = 'Kette – Mod-Schnellweg'
const NICHT_DATEN = "!startsWith(github.head_ref, 'daten/') && !github.event.pull_request.draft"
/** Bedingung, die jeder andere Job zusätzlich trägt: bei Nur-Mod entfällt er. */
export const KEIN_NUR_MOD = "needs.scope.outputs.nur_mod != '1'"
/** `if` jedes Jobs, der bei Nur-Mod entfällt (Teiljobs, Datenbau, Aussehen). */
export const IF_VOLLE_KETTE = `\${{ ${KEIN_NUR_MOD} && ${NICHT_DATEN} }}`
export const NEEDS_SCOPE = ['scope']

/** Die Claude-Code-Version der Mod-Tests (tools/mod-tests.test.mjs, `CLI`); ein Test hält beide gleich. */
export const CLI_VERSION = '@anthropic-ai/claude-code@2.1.321'

export const SOLL_SCOPE = {
  name: SCOPE_NAME,
  if: `\${{ ${NICHT_DATEN} }}`,
  'runs-on': 'ubuntu-latest',
  'timeout-minutes': 5,
  outputs: { nur_mod: '${{ steps.pfad.outputs.nur_mod }}' },
  steps: [
    // Tiefe 2: HEAD^1 ist die Basis (main im Merge-Ref), HEAD der Merge-Commit.
    { uses: 'actions/checkout@v4', with: { 'fetch-depth': 2 } },
    { name: 'Nur Mod-Dateien?', id: 'pfad', run: 'node tools/pr-nur-mod.mjs HEAD^1 HEAD >> "$GITHUB_OUTPUT"' },
  ],
}

export const SOLL_SCHNELLWEG = {
  name: SCHNELLWEG_NAME,
  needs: NEEDS_SCOPE,
  if: `\${{ needs.scope.outputs.nur_mod == '1' && ${NICHT_DATEN} }}`,
  'runs-on': 'ubuntu-latest',
  'timeout-minutes': 15,
  steps: [
    { uses: 'actions/checkout@v4' },
    { uses: './.github/actions/kette-einrichten' },
    // Läuft unter dem Workflow-Namen „PR-Prüfkette“: ohne Claude-CLI scheitert der Test hier, statt zu überspringen (tools/browser-weiche.mjs).
    { name: 'Mod-Tests (claude plugin test)', run: 'node tools/mod-tests.test.mjs' },
    { name: 'Mod-Prüfung (claude plugin validate)', run: `npx --yes ${CLI_VERSION} plugin validate .claude/mods/arbeitsliste` },
    // Leser der Mod außerhalb von ihr: Rangfolge-Test (importiert stand-kennzeichen), Autorfeld der plugin.json, Mutationsanker auf Mod-Dateien,
    // Skill-Markdown, Umfangsgrenzen.
    {
      name: 'Prüfungen, die Mod und Skill-Texte lesen',
      run: 'node tools/naechster.test.mjs && npx tsx pipeline/check-privatkennungen.ts && node tools/mutationsanker-alle.test.mjs && node tools/claude-global-privat.test.mjs && node tools/umfang-pruefen.mjs',
    },
  ],
}

/** Verstöße der Jobs `scope` und `modschnell` (gesucht am Namen, verglichen als Ganzes) und der Anbindung der Aussehen-Jobs. */
export function pruefeSchnellweg(jobs) {
  const fehler = []
  for (const [name, soll] of [[SCOPE_NAME, SOLL_SCOPE], [SCHNELLWEG_NAME, SOLL_SCHNELLWEG]]) {
    const treffer = Object.entries(jobs).filter(([, j]) => j.name === name)
    if (treffer.length !== 1) fehler.push(`Kein (oder mehr als ein) Job mit dem Namen "${name}" (Mod-Schnellweg)`)
    else if (!isDeepStrictEqual(treffer[0][1], soll)) fehler.push(`Job "${treffer[0][0]}" (${name}) weicht von der Sollfassung in tools/pr-kette-schnellweg.mjs ab`)
  }
  if (jobs.scope?.name !== SCOPE_NAME) fehler.push(`Der Job mit dem Schlüssel "scope" fehlt oder heißt nicht "${SCOPE_NAME}" (needs.scope in kette-urteil.mjs)`)
  if (jobs.modschnell?.name !== SCHNELLWEG_NAME) fehler.push(`Der Job mit dem Schlüssel "modschnell" fehlt oder heißt nicht "${SCHNELLWEG_NAME}"`)
  for (const [id, job] of Object.entries(jobs)) {
    if (!String(job.name ?? '').startsWith('PR-Aussehen')) continue
    if (!isDeepStrictEqual(job.needs, NEEDS_SCOPE)) fehler.push(`Aussehen-Job "${id}": needs ist nicht exakt ["scope"]`)
    if (job.if !== IF_VOLLE_KETTE) fehler.push(`Aussehen-Job "${id}": if ist nicht textgleich "${IF_VOLLE_KETTE}"`)
  }
  return fehler
}
