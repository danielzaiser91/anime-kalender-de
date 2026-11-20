// Nachrechnen-Schleife: Zählung der Grund-Kommentare von tools/pr-nachrechnen.mjs je PR (Signal 10 von liegegut).
// Seit 21.11.2026 schreibt pr-nachrechnen keine solchen Kommentare mehr (kein Nachzug bei bewegtem main); gezählt werden nur noch ältere.

/** Feste Kennung am Anfang des Kommentars („… Kette gegen <basis>, main ist <main>; <Grund>“); die Zählung erkennt Durchgänge genau daran. */
export const KENNUNG = '**Nachrechnen** NICHT AKTUELL:'

/** Ab so vielen Durchgängen meldet liegegut den PR (Messung 10.11.2026: ≈ 83 Durchgänge in 1,8 Tagen, Spitzen 5–11). */
export const SCHLEIFE_AB = 3

/** Konten, unter denen pr-nachrechnen kommentiert: Daniels gh (lokal) und der Nacht-Merger (github-actions); fremde Konten zählen nicht (öffentliches Repo). */
const KONTEN = ['derNamenloseDaniel', 'github-actions']

/** Zählt nur Kommentare dieser Konten und nur seit dem Kopf-Commit: nach einer Nachbesserung beginnt die Zählung neu. */
const istDurchgang = (c, kopfZeit) => KONTEN.includes(c.author?.login) && typeof c.body === 'string' && c.body.startsWith(KENNUNG) && Date.parse(c.createdAt) >= kopfZeit

/**
 * Zählbeginn für Signal 10: update-branch (tools/pr-nachrechnen-zweig.mjs) setzt je Durchgang einen neuen Kopf („Merge branch 'main' into …“),
 * der die Zählung sonst auf 0 stellte (Prüfer 4104, A4). Beginn = Zeit des jüngsten Commits, der kein solcher Merge ist; `commits` = [{ nachricht, zeit (ms) }].
 */
export function zaehlbeginn(commits, kopfZeit) {
  const eigene = commits.filter((c) => !/^Merge branch 'main' into /.test(c.nachricht)).map((c) => c.zeit)
  return eigene.length === 0 ? kopfZeit : Math.max(...eigene)
}

/** Zählbeginn eines PR: ohne 3 Durchgänge der eigenen Konten (egal wann) keine Abfrage, sonst die Commit-Liste des PR. */
export function schleifenBeginn(ghFn, pr, kopfZeit) {
  if (pr.comments.filter((c) => istDurchgang(c, 0)).length < SCHLEIFE_AB) return kopfZeit
  const roh = ghFn(['api', `repos/{owner}/{repo}/pulls/${pr.number}/commits?per_page=100`, '--paginate', '--jq', '.[] | [.commit.committer.date, (.commit.message | split("\\n")[0])] | @tsv'])
  const commits = roh.split('\n').filter((z) => z.includes('\t')).map((z) => ({ zeit: Date.parse(z.split('\t')[0]), nachricht: z.slice(z.indexOf('\t') + 1) }))
  return zaehlbeginn(commits, kopfZeit)
}

/** Signal 10 für `pr.comments`: höchstens ein Eintrag, `seit` = Zeit des jüngsten Durchgangs; kopfZeit = Zählbeginn in ms (siehe `schleifenBeginn`). */
export function schleifeSignal(pr, kopfZeit) {
  const durchgaenge = pr.comments.filter((c) => istDurchgang(c, kopfZeit))
  if (durchgaenge.length < SCHLEIFE_AB) return []
  const seit = Math.max(...durchgaenge.map((c) => Date.parse(c.createdAt)))
  return [{ nr: 10, text: `Nachrechnen ${durchgaenge.length}× NICHT AKTUELL (Grund in den Kommentaren)`, seit }]
}
