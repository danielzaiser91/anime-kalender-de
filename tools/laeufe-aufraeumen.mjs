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
 *   LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs --erledigt <lauf_id> --notiz "<Text>" [--trocken]
 *     setzt genau diesen roten Verlaufseintrag auf erledigt (geprüft und behoben, der grüne Nachfolger steht noch aus);
 *     die Notiz ist Pflicht, die Lauf-ID steht in `<Worker>?verlauf=<Art>` (Feld lauf_id).
 */
import { abbruchText, ghStapel, mitLimit } from './kind-mit-limit.mjs'
import { erledigtArgumente, findeRotenLauf, holeLaeufe, holeVerlauf, letzteDatenAenderung, roteArten, stillstand, STILLSTAND_GRENZE_STUNDEN } from './laeufe-abruf.mjs'
import { rotAlarmText } from './bestand-rot-alarm.mjs'
import { git, meldeLiegt } from './liegegut.mjs'
import { meldeRoteSammlerPrs } from './rote-sammler-prs.mjs'
import { eskalationsText } from './wache-eskalation.mjs'
import { wacheZeilen } from './wache-bilanz.mjs'
import { fixZusatz } from './wache-fix-gemergt.mjs'
import { weichWache } from './wache-weicher-schritt.mjs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WORKER = 'https://newsletter.animekalender.workers.dev/lauf'
const REPO = 'danielzaiser91/anime-kalender-de'
const args = process.argv.slice(2)
const TROCKEN = args.includes('--trocken')
const AUCH_GITHUB = args.includes('--auch-github')
const TOKEN = process.env.LAUF_TOKEN

const gh = (...a) => mitLimit('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })

/** Der eine vorhandene Schreibweg zum Worker: Zustand `erledigt` mit Notiz. */
async function setzeErledigt(laufId, notiz) {
  const antwort = await fetch(WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
    body: JSON.stringify({ lauf_id: laufId, zustand: 'erledigt', notiz }),
  })
  if (!antwort.ok) console.error(`  ✗ Worker antwortete mit ${antwort.status}`)
  return antwort.ok
}

function fehlerAbbruch(text) {
  console.error(text)
  process.exitCode = 1
}

/** `--erledigt <lauf_id> --notiz …`: nur ein roter Verlaufseintrag mit genau dieser ID wird angefasst. */
async function erledigen(laufId, notiz, verlauf) {
  for (const { art } of roteArten(verlauf)) {
    const abruf = await holeVerlauf(fetch, WORKER, art)
    const treffer = findeRotenLauf(abruf.laeufe, laufId)
    if (!treffer) continue
    console.log(`erledigt ${laufId}  ${art} — ${treffer.zustand} vom ${treffer.gemeldet_am}: ${notiz}`)
    if (TROCKEN) return console.log('(trocken, nichts gesendet)')
    if (!TOKEN) return fehlerAbbruch('LAUF_TOKEN fehlt — ohne ihn nimmt der Worker nichts an.')
    if (!(await setzeErledigt(laufId, notiz))) process.exitCode = 1
    return
  }
  fehlerAbbruch(`Lauf ${laufId} ist kein roter Verlaufseintrag (fehler/warnung) — nichts geändert.`)
}

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

/** `--gesundheit <datei>` (Test) oder der Stand im Repo. */
function gesundheitsDatei() {
  const i = args.indexOf('--gesundheit')
  return i >= 0 ? args[i + 1] : fileURLToPath(new URL('../data/source-health.json', import.meta.url))
}

/** `--wurzel <ordner>` (Test) oder das Repo dieses Skripts. */
function wurzel() {
  const i = args.indexOf('--wurzel')
  return i >= 0 ? args[i + 1] : fileURLToPath(new URL('..', import.meta.url))
}

/** `--weich-speicher <datei>` (Test) oder eine Datei im Temp-Ordner: nur Zwischenspeicher, kein Repo-Inhalt. */
function weichSpeicher() {
  const i = args.indexOf('--weich-speicher')
  return i >= 0 ? args[i + 1] : join(tmpdir(), 'ak-wache-weicher-schritt.json')
}

async function main() {
  // Ein roter Sammler-Fund lässt den Lauf grün; er bleibt als PR liegen und muss hier auffallen (tools/rote-sammler-prs.mjs).
  const erledigt = erledigtArgumente(args)
  if (erledigt.fehler) return fehlerAbbruch(erledigt.fehler)
  meldeRoteSammlerPrs()
  meldeLiegt((a) => gh(...a), git, console.log, Date.now())
  await stillstandMelden()
  const rotZeilen = rotAlarmText(gh, REPO, Date.now()).split('\n')
  for (const zeile of rotZeilen) if (zeile.startsWith('ALARM')) console.log(zeile)
  const quellenZeilen = eskalationsText(gesundheitsDatei(), Date.now(), fixZusatz(wurzel()))
  for (const zeile of quellenZeilen) console.log(zeile)
  for (const zeile of weichWache(ghStapel, REPO, wurzel(), Date.now(), weichSpeicher())) console.log(zeile)
  try {
    await laeufePruefen(erledigt)
  } finally {
    for (const zeile of wacheZeilen(rotZeilen, quellenZeilen)) console.log(zeile)
  }
}

async function laeufePruefen(erledigt) {
  const { liste, verlauf, meldung } = await holeLaeufe(fetch, WORKER)
  if (meldung) {
    console.error(meldung)
    process.exitCode = TROCKEN ? 0 : 1
    return
  }
  if (erledigt.laufId) return await erledigen(erledigt.laufId, erledigt.notiz, verlauf)
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
    if (!(await setzeErledigt(l.lauf_id, notiz))) continue
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

try {
  await main()
} catch (fehler) {
  // Ein Zeitlimit (tools/kind-mit-limit.mjs) wird zur klaren Zeile statt zum Stacktrace.
  fehlerAbbruch(abbruchText(fehler))
}
