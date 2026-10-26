/**
 * Fake-git für die Tests der Leser-Regel (kein Test): Repo als { main: { pfad: text }, kopf: { pfad: text } }; kennt fetch, show <ref>:<pfad> und
 * grep -n -F -e <name> <main> (Status 1 ohne Treffer). `mainSha` unterscheidet die Ref von main und Kopf.
 */
export function attrappe(repo, { mainSha, fetchFehler = false, grepStatus } = {}) {
  const aufrufe = []
  const git = (args) => {
    aufrufe.push(args.join(' '))
    if (args[0] === 'fetch') {
      if (fetchFehler) throw new Error('fatal: kein Netz')
      return ''
    }
    if (args[0] === 'show') {
      const [ref, ...rest] = args[1].split(':')
      const text = repo[ref === mainSha ? 'main' : 'kopf'][rest.join(':')]
      if (text === undefined) throw new Error('fatal: path does not exist')
      return text
    }
    if (args[0] === 'grep') {
      if (grepStatus !== undefined) throw Object.assign(new Error('grep kaputt'), { status: grepStatus })
      const namen = args.filter((a, i) => args[i - 1] === '-e')
      const zeilen = Object.entries(repo.main).flatMap(([p, t]) => t.split('\n').map((z, i) => [p, i + 1, z])).filter(([, , z]) => namen.some((n) => z.includes(n)))
      if (zeilen.length === 0) throw Object.assign(new Error('keine Treffer'), { status: 1 })
      return zeilen.map(([p, i, z]) => `${mainSha}:${p}:${i}:${z}`).join('\n')
    }
    throw new Error(`unbekannt: ${args.join(' ')}`)
  }
  return { git, aufrufe }
}
