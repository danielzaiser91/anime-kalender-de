/**
 * Basis eines PR im PR-Ereignis: der erste Elternteil des geprüften Merge-Commits (`HEAD^1`), nie `pull_request.base.sha`
 * (die bleibt auf dem Stand der PR-Eröffnung, `git diff base.sha HEAD` zählt dann fremde Änderungen von main mit).
 * Ohne Merge-Commit gibt es keine verlässliche Basis, das ist ein Fehler.
 */

/** Erste `parent`-Zeile aus dem Commit-Objekt; liest auch im flachen Klon. Wirft, wenn `HEAD` kein Merge-Commit ist. */
export function ersterElternteil(git) {
  const eltern = git('cat-file', '-p', 'HEAD')
    .split('\n')
    .filter((z) => z.startsWith('parent '))
  if (eltern.length < 2) throw new Error(`PR-Basis: HEAD ist kein Merge-Commit (${eltern.length} Elternteil(e)); das PR-Ereignis prüft den Merge-Commit.`)
  return eltern[0].slice('parent '.length).trim()
}

/** Basis des PR; fehlt der Commit im flachen Klon, wird er nachgeladen. */
export function ladeBasis(git) {
  const basis = ersterElternteil(git)
  try {
    git('cat-file', '-e', `${basis}^{commit}`)
  } catch {
    git('fetch', '--no-tags', '--depth=1', 'origin', basis)
  }
  return basis
}

/**
 * Lädt die Basis einmal, bevor Wächter parallel laufen: gleichzeitige `git fetch --depth=1` streiten sonst um `shallow.lock`.
 * Nur im PR-Ereignis; ohne Merge-Commit oder bei Abruffehler bleibt es beim Abruf im Wächter (der dann selbst meldet).
 */
export function vorladeBasis(git, env) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return null
  try {
    return ladeBasis(git)
  } catch {
    return null
  }
}
