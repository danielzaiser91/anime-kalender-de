/**
 * gh-Anschluss von `cloud-auftraege.mjs`. PR-Listen über REST (`gh api`), nicht `gh pr list`: GraphQL ist in Cloud-Sitzungen gesperrt.
 * Der Prüfstand (Kette, Merge-Reife) nutzt die Welt und `kandidat()` des Nacht-Mergers, nichts nachgebaut.
 */
import { ghEcht, echteWelt as mergerWelt } from './nacht-merger-welt.mjs'
import { kandidat, ketteStand } from './nacht-merger-wahl.mjs'

const REPO_STANDARD = 'danielzaiser91/anime-kalender-de'
const SEITE = 100
/** Mehr Seiten als das sind kein Fenster mehr, sondern ein Fehler (nie stilles Abschneiden): 1000 PRs. */
const SEITEN_MAX = 10

/** REST-PR (`gh api repos/…/pulls`) in die Form des Werkzeugs. */
export const prVonRest = (p) => ({
  nummer: p.number,
  titel: p.title,
  autor: p.user?.login ?? '',
  beschreibung: p.body ?? '',
  entwurf: p.draft === true,
  offen: p.state === 'open',
  gemergtAm: p.merged_at,
  geschlossenAm: p.closed_at,
  erstellt: p.created_at,
  zweig: p.head?.ref ?? '',
})

/** Alle offenen PRs und die geschlossenen, die seit `seitMs` zuletzt geändert wurden (neu → alt, Abbruch an der ersten Seite darunter). */
export function listePrs(gh, repo, seitMs) {
  const alle = []
  const seite = (zustand, nr) => JSON.parse(gh(['api', `repos/${repo}/pulls?state=${zustand}&sort=updated&direction=desc&per_page=${SEITE}&page=${nr}`]))
  for (const zustand of ['open', 'closed']) {
    for (let nr = 1; ; nr++) {
      if (nr > SEITEN_MAX) throw new Error(`mehr als ${SEITEN_MAX * SEITE} ${zustand === 'open' ? 'offene' : 'geschlossene'} PRs im Fenster`)
      const s = seite(zustand, nr)
      alle.push(...s.map(prVonRest))
      const aelter = s.length > 0 && Date.parse(s.at(-1).updated_at) < seitMs
      if (s.length < SEITE || (zustand === 'closed' && aelter)) break
    }
  }
  return alle
}

export function echteWelt({ gh = ghEcht, repo = process.env.GITHUB_REPOSITORY || REPO_STANDARD, jetzt = () => Date.now(), zeile = (t) => console.log(t), merger } = {}) {
  let offene
  const pruefWelt = merger ?? mergerWelt({ trocken: true, gh, repo })
  return {
    jetzt,
    zeile,
    prs: (seitMs) => listePrs(gh, repo, seitMs),
    letzterCommit: (nummer) => gh(['api', `repos/${repo}/pulls/${nummer}/commits`, '--paginate', '--jq', '.[].commit.committer.date']).trim().split('\n').at(-1) || null,
    pruefstand: (nummer) => {
      offene ??= pruefWelt.offene()
      const pr = offene.find((p) => p.nummer === nummer)
      if (pr === undefined) throw new Error(`PR #${nummer} nicht in der Liste der offenen`)
      const d = pruefWelt.details(pr)
      const k = kandidat(d)
      return { kette: ketteStand(d.checks).grund, kandidat: k.kandidat, grund: k.grund }
    },
  }
}
