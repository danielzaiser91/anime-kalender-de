/**
 * Würde dieser Deploy einen neueren überschreiben? (18.11.2026)
 *
 * Seit die Gruppe `pages` nur noch an den Deploy-Jobs hängt (nicht am ganzen Lauf), können Läufe überholen: Ein Lauf mit Treffer des geprüften Baus ist
 * in 2 min fertig, ein älterer ohne Treffer in 14. Ohne diese Prüfung deployte der ältere danach seinen alten Stand über den neuen. Hier gilt: Hat ein Lauf mit
 * höherer Nummer seinen Deploy-Job schon grün beendet und liegt sein Stand vor unserem (`compare` → `ahead`), entfällt unser Deploy; der neuere gewinnt.
 * Die Gruppe serialisiert die Deploy-Jobs, ein neuerer läuft also nie gleichzeitig mit uns: „grün beendet“ ist vollständig.
 * Ein übersprungener Deploy-Job (selbst veraltet) steht als grün da; er hieß, dass ein noch neuerer deployt hat, die Kette trägt.
 * Jeder Fehler heißt „nicht veraltet“ (deployen): eine Panne hier darf keinen Deploy verhindern; sie kostet im schlimmsten Fall einen überholten Stand bis zum nächsten Lauf.
 *
 * Aufruf im Workflow `deploy.yml` (`deploy_hart`, `deploy_schlank`): `node tools/deploy-veraltet.mjs` schreibt `veraltet=1` nach $GITHUB_OUTPUT.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const DEPLOY_JOBS = ['deploy_hart', 'deploy_schlank']
/** So viele jüngere Läufe werden höchstens nach ihren Jobs gefragt. */
export const LAEUFE_HOECHSTENS = 6

/** Neuester jüngerer Lauf mit grünem Deploy-Job und einem Stand vor dem unseren, sonst null. */
export function ueberholer({ eigener, laeufe, jobsVon, vorausVon }) {
  const juenger = laeufe
    .filter((l) => l.run_number > eigener.run_number && ['in_progress', 'completed'].includes(l.status))
    .sort((a, b) => b.run_number - a.run_number)
    .slice(0, LAEUFE_HOECHSTENS)
  for (const lauf of juenger) {
    if (!jobsVon(lauf.id).some((j) => DEPLOY_JOBS.includes(j.name) && j.conclusion === 'success')) continue
    if (vorausVon(eigener.head_sha, lauf.head_sha)) return lauf
  }
  return null
}

export const ECHT = {
  api: (pfad) => JSON.parse(execFileSync('gh', ['api', pfad], { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })),
}

export function pruefe(env, w = ECHT) {
  try {
    const repo = env.GITHUB_REPOSITORY
    const eigener = w.api(`repos/${repo}/actions/runs/${env.GITHUB_RUN_ID}`)
    const laeufe = w.api(`repos/${repo}/actions/workflows/deploy.yml/runs?branch=main&per_page=30`).workflow_runs
    const lauf = ueberholer({
      eigener,
      laeufe,
      jobsVon: (id) => w.api(`repos/${repo}/actions/runs/${id}/jobs?per_page=100`).jobs,
      vorausVon: (meiner, ihrer) => w.api(`repos/${repo}/compare/${meiner}...${ihrer}`).status === 'ahead',
    })
    if (!lauf) return { veraltet: false, grund: 'kein neuerer Deploy' }
    return { veraltet: true, grund: `Lauf ${lauf.id} (Nr. ${lauf.run_number}, Stand ${lauf.head_sha.slice(0, 9)}) hat einen neueren Stand schon ausgeliefert` }
  } catch (fehler) {
    return { veraltet: false, grund: `nicht prüfbar (${String(fehler.message).split('\n')[0]}), deployt wird` }
  }
}

export function main(env = process.env, ausgabe = console.log, w = ECHT, schreibe = appendFileSync) {
  const { veraltet, grund } = pruefe(env, w)
  ausgabe(veraltet ? `Deploy entfällt: ${grund}` : `Deploy läuft: ${grund}`)
  if (veraltet && env.GITHUB_OUTPUT) schreibe(env.GITHUB_OUTPUT, 'veraltet=1\n')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
