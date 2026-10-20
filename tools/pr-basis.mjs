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
    holeBasis(git, basis)
  }
  return basis
}

/** Parallele Wächter laden dieselbe Basis; hält einer `shallow.lock`, wartet der andere und prüft, ob der Commit inzwischen da ist. */
export function holeBasis(git, basis, versuche = 5, warteMs = 1000) {
  for (let versuch = 1; ; versuch++) {
    try {
      git('fetch', '--no-tags', '--depth=1', 'origin', basis)
      return
    } catch (fehler) {
      if (istVorhanden(git, basis)) return
      if (versuch >= versuche) throw fehler
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, warteMs * versuch)
    }
  }
}

function istVorhanden(git, basis) {
  try {
    git('cat-file', '-e', `${basis}^{commit}`)
    return true
  } catch {
    return false
  }
}
