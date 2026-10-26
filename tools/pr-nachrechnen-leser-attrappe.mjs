/**
 * Fake-git für die Tests der Leser-Regel (kein Test): Repo als { main: { pfad: text }, kopf: { pfad: text } }; kennt fetch,
 * `ls-tree -r --name-only <ref> -- <ordner>…` und `cat-file --batch` (Eingabe `<ref>:<pfad>` je Zeile, Antwort im Format von git).
 * `mainSha` unterscheidet die Ref von main und Kopf; `aufrufe` hält jeden Aufruf als Zeile fest.
 */
export function attrappe(repo, { mainSha, fetchFehler = false, lsFehler = false } = {}) {
  const aufrufe = []
  const eingaben = []
  const stand = (ref) => repo[ref === mainSha ? 'main' : 'kopf']
  const git = (args, { input } = {}) => {
    aufrufe.push(args.join(' '))
    if (input !== undefined) eingaben.push(input)
    if (args[0] === 'fetch') {
      if (fetchFehler) throw new Error('fatal: kein Netz')
      return ''
    }
    if (args[0] === 'ls-tree') {
      if (lsFehler) throw new Error('fatal: kein Baum')
      const ordner = args.slice(5)
      return Object.keys(stand(args[3])).filter((p) => ordner.some((o) => p.startsWith(`${o}/`))).join('\n')
    }
    if (args[0] === 'cat-file') {
      const teile = input.split('\n').filter(Boolean).map((z) => {
        const i = z.indexOf(':')
        const text = stand(z.slice(0, i))[z.slice(i + 1)]
        if (text === undefined) return Buffer.from(`${z} missing\n`)
        const inhalt = Buffer.from(text, 'utf8')
        return Buffer.concat([Buffer.from(`${'0'.repeat(40)} blob ${inhalt.length}\n`), inhalt, Buffer.from('\n')])
      })
      return Buffer.concat(teile)
    }
    throw new Error(`unbekannt: ${args.join(' ')}`)
  }
  return { git, aufrufe, eingaben }
}
