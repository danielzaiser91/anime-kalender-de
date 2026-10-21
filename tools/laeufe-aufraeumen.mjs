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
import { holeLaeufe, letzteDatenAenderung, roteArten, stillstand, STILLSTAND_GRENZE_STUNDEN } from './laeufe-abruf.mjs'
import { meldeRoteSammlerPrs } from './rote-sammler-prs.mjs'

const WORKER = 'https://newsletter.animekalender.workers.dev/lauf'
const REPO = 'danielzaiser91/anime-kalender-de'
const args = process.argv.slice(2)
const TROCKEN = args.includes('--trocken')
const AUCH_GITHUB = args.includes('--auch-github')
const TOKEN = process.env.LAUF_TOKEN

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })

async function stillstandMelden() {
  const am = await letzteDatenAenderung(fetch, REPO)
  if (!am) return console.log('STILLSTAND? Letzte Änderung von public/data nicht lesbar')
  const s = stillstand(am, Date.now())
  if (s.zuLang) console.log(`STILLSTAND: public/data seit ${s.stunden.toFixed(1)} h unverändert (Grenze ${STILLSTAND_GRENZE_STUNDEN} h, letzter Commit ${am})`)
}

/**
 * Der Untersucher läuft nur nach rotem Bau, spätere Läufe sind `skipped`; sein "grün danach" misst der Bau selbst
 * (20.10.2026: Warnung "PR deckt den Fehler ab" stand nach grünem Bau weiter).
 */
const GRUEN_MISST_AN = { 'Claude — roten Datenlauf untersuchen': 'bestand-bauen.yml' }

/**
 * Jüngster erfolgreicher Lauf je Workflow, einzeln gefragt: Die letzten 60 Läufe aller Workflows reichten am 18.10.2026
 * nur eine Stunde zurück, jeder seltenere Workflow galt so als rot. Ein Name ohne GitHub-Workflow fehlt in der Map.
 */
function letzterGruenJe(namen) {
  const gruen = new Map()
  for (const name of namen) {
    try {
      const [lauf] = JSON.parse(gh('run', 'list', '--repo', REPO, '--workflow', GRUEN_MISST_AN[name] ?? name, '--status', 'success', '--limit', '1', '--json', 'createdAt'))
      if (lauf) gruen.set(name, lauf.createdAt)
    } catch {}
  }
  return gruen
}

async function main() {
  // Ein roter Sammler-Fund lässt den Lauf grün; er bleibt als PR liegen und muss hier auffallen (tools/rote-sammler-prs.mjs).
  meldeRoteSammlerPrs()
  await stillstandMelden()
  const { liste, verlauf, meldung } = await holeLaeufe(fetch, WORKER)
  if (meldung) {
    console.error(meldung)
    process.exitCode = TROCKEN ? 0 : 1
    return
  }
  const rote = liste.filter((l) => l.zustand === 'fehler' || l.zustand === 'warnung')
  console.log(`${liste.length} Läufe in der App, ${rote.length} rot`)
  // Rote Läufe stehen seit 28.09.2026 nur im Verlauf, nicht in `liste` (18.10.2026: elf Stunden Stillstand bei „0 rot“).
  // Je Workflow der jüngste erfolgreiche Lauf — der Prüfstein für „überholt".
  const letzterGruen = letzterGruenJe(new Set([...roteArten(verlauf).map((r) => r.art), ...rote.map((l) => l.workflow)]))
  for (const r of roteArten(verlauf, letzterGruen)) {
    console.log(`ROT im Verlauf: ${r.art} — letzter Lauf ${r.zustand} am ${r.am} (vor ${r.stunden.toFixed(1)} h, kein grüner Lauf danach)`)
  }
  if (!rote.length) return

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
