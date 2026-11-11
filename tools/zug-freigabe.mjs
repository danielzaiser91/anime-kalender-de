/**
 * Tor der Zug-Reihe (Sammelzug P3, 09.11.2026): darf `merge-reihe-zug.sh` den PR auf `zug` mergen?
 * Aufruf: node tools/zug-freigabe.mjs <PR>   Exit 0 = ja, 1 = nein (Gründe auf stdout), 2 = Fehler/Schalter aus.
 * Die Regeln kommen aus `zug.mjs` (`sperrGruende`: kein Entwurf, kein Konflikt, Kette grün, Prüfer-Ok auf dem Kopf); neu ist nur,
 * dass die Basis `zug` sein muss und der Schalter `tools/zug-aktiv.json` an. Ein Nachrechnen gegen main gibt es hier nicht.
 */
import { pathToFileURL } from 'node:url'
import { kopfZeitVon } from './liegegut.mjs'
import { mitLimit } from './kind-mit-limit.mjs'
import { ZUG, leseZugAktiv } from './zug-aktiv.mjs'
import { sperrGruende } from './zug.mjs'

const FELDER = 'number,state,isDraft,mergeable,headRefOid,baseRefName,statusCheckRollup,comments'

/** Rückgabe { frei, gruende }; Abruffehler schlagen durch. */
export function zugFreigabe(nummer, ghFn) {
  const pr = JSON.parse(ghFn(['pr', 'view', String(nummer), '--json', FELDER]))
  if (pr.state !== 'OPEN') return { frei: false, gruende: [`nicht offen (${pr.state})`] }
  if (pr.baseRefName !== ZUG) return { frei: false, gruende: [`Basis ist ${pr.baseRefName}, nicht ${ZUG}`] }
  const gruende = sperrGruende({ ...pr, kopfZeit: kopfZeitVon(ghFn, pr, new Map()) })
  return { frei: gruende.length === 0, gruende }
}

export function main(argv, ghFn, melde, zugAktiv = leseZugAktiv()) {
  if (argv.length !== 1 || !/^\d+$/.test(argv[0])) {
    melde('Aufruf: node tools/zug-freigabe.mjs <PR-Nummer>')
    return 2
  }
  if (!zugAktiv) {
    melde('zug-freigabe: Schalter tools/zug-aktiv.json steht auf aus')
    return 2
  }
  try {
    const r = zugFreigabe(Number(argv[0]), ghFn)
    melde(r.frei ? `PR ${argv[0]}: frei für ${ZUG}` : `PR ${argv[0]}: nicht frei – ${r.gruende.join('; ')}`)
    return r.frei ? 0 : 1
  } catch (e) {
    melde(`zug-freigabe: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gh = (args) => mitLimit('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  process.exit(main(process.argv.slice(2), gh, (t) => console.log(t)))
}
