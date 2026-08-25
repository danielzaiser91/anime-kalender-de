/**
 * Räumt rote Läufe aus der Laufstatus-App **und** auf Wunsch aus GitHub.
 *
 * Daniel am 25.08.2026, zum zweiten Mal an einem Tag: „räum die status app auf,
 * furchtbar diese ganzen roten läufe die ich da sehe" — und danach: „räum immer
 * auf, wenn du bereits drüber geschaut hast."
 *
 * Dass ein geklärter roter Lauf verschwindet, steht seit dem 24.08.2026 in
 * `CLAUDE.md`. Getragen hat die Regel trotzdem nicht: Ein Vorsatz, der bei jedem
 * einzelnen Fix erneut eingehalten werden muss, wird irgendwann übersehen — und
 * die Anzeige sagt dann etwas anderes als der Zustand. Deshalb gibt es dieses
 * Werkzeug: **ein Aufruf statt zehn Handgriffe.**
 *
 * **Was als geklärt gilt, wird gemessen, nicht angenommen:** Ein roter Lauf ist
 * überholt, wenn derselbe Workflow danach erfolgreich durchgelaufen ist. Alles
 * andere bleibt stehen — ein roter Lauf ohne grünen Nachfolger ist ein offenes
 * Problem, und das soll sichtbar bleiben.
 *
 * Aufruf (LAUF_TOKEN steht in `my_secrets.md`):
 *   LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs [--auch-github] [--trocken]
 */
import { execFileSync } from 'node:child_process'

const WORKER = 'https://newsletter.animekalender.workers.dev/lauf'
const REPO = 'danielzaiser91/anime-kalender-de'
const args = process.argv.slice(2)
const TROCKEN = args.includes('--trocken')
const AUCH_GITHUB = args.includes('--auch-github')
const TOKEN = process.env.LAUF_TOKEN

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })

async function main() {
  const laeufe = await (await fetch(WORKER)).json()
  const liste = Array.isArray(laeufe) ? laeufe : (laeufe.laeufe ?? [])
  const rote = liste.filter((l) => l.zustand === 'fehler')
  console.log(`${liste.length} Läufe in der App, ${rote.length} rot`)
  if (!rote.length) return

  // Je Workflow der jüngste erfolgreiche Lauf — der Prüfstein für „überholt".
  const roh = JSON.parse(
    gh('run', 'list', '--repo', REPO, '--limit', '60', '--json', 'workflowName,conclusion,createdAt'),
  )
  const letzterGruen = new Map()
  for (const r of roh) {
    if (r.conclusion !== 'success') continue
    const bisher = letzterGruen.get(r.workflowName)
    if (!bisher || r.createdAt > bisher) letzterGruen.set(r.workflowName, r.createdAt)
  }

  let abgenommen = 0
  let gelassen = 0
  for (const l of rote) {
    const gruen = letzterGruen.get(l.workflow)
    if (!gruen || gruen <= l.gemeldet_am) {
      console.log(`  bleibt   ${l.lauf_id}  ${l.workflow} — kein erfolgreicher Lauf danach`)
      gelassen++
      continue
    }
    const notiz = `überholt: ${l.workflow} lief am ${gruen.slice(0, 16).replace('T', ' ')} erfolgreich durch`
    console.log(`  nimmt ab ${l.lauf_id}  ${l.workflow}`)
    if (TROCKEN) {
      abgenommen++
      continue
    }
    if (!TOKEN) {
      console.error('LAUF_TOKEN fehlt — ohne ihn nimmt der Worker nichts an.')
      return
    }
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
      body: JSON.stringify({ lauf_id: l.lauf_id, zustand: 'erledigt', notiz }),
    })
    if (!antwort.ok) {
      console.error(`  ✗ Worker antwortete mit ${antwort.status}`)
      continue
    }
    abgenommen++
    /*
      GitHub nur auf Ansage. Das Löschen ist endgültig, und was im Lauf stand,
      ist danach weg — die Erkenntnis daraus muss vorher woanders stehen.
    */
    if (AUCH_GITHUB) {
      try {
        gh('run', 'delete', String(l.lauf_id), '--repo', REPO)
      } catch {
        /* Schon gelöscht oder nie in diesem Repo — kein Grund anzuhalten. */
      }
    }
  }
  console.log(`\n${abgenommen} abgenommen${TROCKEN ? ' (trocken)' : ''}, ${gelassen} bleiben sichtbar`)
}

await main()
