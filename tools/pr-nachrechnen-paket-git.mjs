/**
 * Git-Anschluss für `paketGrund` (`pr-nachrechnen-paket.mjs`): liest package.json auf Kettenbasis und main, die Kettendateien
 * (Workflow, Actions) und den Code von main in wenigen Abrufen. Jeder Fehler wird zum Grund „nicht ermittelbar“, der PR gilt dann als veraltet.
 */
import { codeDateien, gitAufruf, inhalte } from './pr-nachrechnen-leser-git.mjs'
import { paketGrund } from './pr-nachrechnen-paket.mjs'

const KETTE = (p) => p === '.github/workflows/pr-pruefung.yml' || p.startsWith('.github/actions/')

/** `refs` { nummer, kopf, main, basis }; `git` wie in `gitLeser`. */
export const standardPaket = (refs, prDateien, git = gitAufruf) => {
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main, refs.basis])
    const paket = (ref) => inhalte(git, ref, ['package.json']).get('package.json') ?? null
    const mainTexte = inhalte(git, refs.main, codeDateien(git, refs.main))
    const kettenTexte = [...mainTexte].filter(([p]) => KETTE(p)).map(([, t]) => t)
    return paketGrund({ alt: paket(refs.basis), neu: paket(refs.main), prDateien, kettenTexte, lies: (p) => mainTexte.get(p) ?? null })
  } catch (e) {
    return `main bewegte package.json (nicht ermittelbar: ${String(e.message).split('\n')[0].slice(0, 120)})`
  }
}
