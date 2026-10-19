/**
 * Stößt die PR-Prüfkette neu an, wenn main nach ihrem Start weitergekommen ist (19.10.2026, Befund Prüfer 1576).
 * Grund: Die Kette läuft auf `refs/pull/N/merge`, also gegen main zum Zeitpunkt des Starts. Kommt danach ein anderer PR auf main,
 * bleibt der Check grün, obwohl repoweite Grenzwerte (uhr-in-tests, check:umfang, Design-Klassen) inzwischen überschritten sind.
 * Ein Neustart des Laufs (`gh run rerun`) nutzt denselben Merge-Commit; erst Schließen und Öffnen des PR (`reopened`) baut ihn neu.
 * Aufruf (Workflow `pr-nachrechnen.yml`): node tools/pr-nachrechnen.mjs <push-zeitpunkt-iso>
 * Umgebung: GH_TOKEN (lesen), GH_TOKEN_SCHREIBEN (schließen/öffnen; nur ein App-Token löst die Kette aus, GITHUB_TOKEN nicht).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const KETTE = 'pr-pruefung.yml'

/** Ist der PR ein Fall für die Kette? Gleiche Bedingung wie die Teiljobs: kein Entwurf, kein `daten/`-Zweig. */
export function brauchtKette(pr) {
  return !pr.isDraft && !pr.headRefName.startsWith('daten/')
}

/** Neuester Kettenlauf zum aktuellen Kopf des PR (gleicher Commit), sonst null. */
export function neuesterLauf(laeufe, kopf) {
  const passend = laeufe.filter((l) => l.headSha === kopf)
  return passend.reduce((neu, l) => (neu === null || Date.parse(l.createdAt) > Date.parse(neu.createdAt) ? l : neu), null)
}

/** Nummern der PR, deren neuester Kettenlauf vor `pushZeit` begann. PR ohne Lauf zum Kopf bleiben außen (nichts Veraltetes da). */
export function veraltete(prs, pushZeit, laeufeVon) {
  return prs.filter(brauchtKette).filter((pr) => {
    const lauf = neuesterLauf(laeufeVon(pr), pr.headRefOid)
    return lauf !== null && Date.parse(lauf.createdAt) < Date.parse(pushZeit)
  })
}

const OEFFNEN_VERSUCHE = 3

/** Ein PR, der geschlossen bliebe, wäre aus der Kette verschwunden (der nächste Lauf sieht nur offene): mehrere Versuche, dann ein lauter Fehler. */
function oeffneMitWiederholung(oeffne, nummer) {
  for (let versuch = 1; ; versuch++) {
    try {
      return oeffne(nummer)
    } catch (e) {
      if (versuch >= OEFFNEN_VERSUCHE) throw new Error(`PR ${nummer} BLEIBT GESCHLOSSEN, von Hand öffnen (${e.message})`)
    }
  }
}

/**
 * Ablauf: veraltete PR schließen und öffnen. Jeder PR einzeln, ein Fehler bei einem hält die anderen nicht auf.
 * Ein PR mit Auto-Merge bleibt unberührt: Schließen löscht die Einstellung, und das Wiederherstellen liefe mit dem Token, das am Ruleset vorbei mergt.
 */
export function nachrechnen({ prs, pushZeit, laeufeVon, schliesse, oeffne, melde }) {
  const veraltet = veraltete(prs, pushZeit, laeufeVon)
  const betroffen = veraltet.filter((pr) => !pr.autoMergeRequest)
  for (const pr of veraltet.filter((p) => p.autoMergeRequest)) melde(`PR ${pr.number}: Auto-Merge aktiv, nicht angefasst, Kette bleibt veraltet`)
  let fehler = 0
  for (const pr of betroffen) {
    try {
      schliesse(pr.number)
      oeffneMitWiederholung(oeffne, pr.number)
      melde(`PR ${pr.number}: Kette neu angestoßen`)
    } catch (e) {
      fehler++
      melde(`PR ${pr.number}: FEHLER ${e.message}`)
    }
  }
  melde(`pr-nachrechnen: ${betroffen.length} von ${prs.length} offenen PR neu angestoßen, ${fehler} Fehler`)
  return fehler
}

function gh(args, token) {
  const env = { ...process.env, GH_TOKEN: token }
  return execFileSync('gh', args, { encoding: 'utf8', env, windowsHide: true })
}

/** Verdrahtung: offene PR lesen (Lese-Token), veraltete schließen und öffnen (Schreib-Token). `gh(args, token)` ist eingespeist. */
export function ausfuehren(pushZeit, gh, { lesen, schreiben }, melde) {
  const prs = JSON.parse(gh(['pr', 'list', '--state', 'open', '--base', 'main', '--limit', '100', '--json', 'number,isDraft,headRefName,headRefOid,autoMergeRequest'], lesen))
  const laeufeVon = (pr) =>
    JSON.parse(gh(['run', 'list', '--workflow', KETTE, '--event', 'pull_request', '--branch', pr.headRefName, '--limit', '10', '--json', 'createdAt,headSha'], lesen))
  const fehler = nachrechnen({
    prs,
    pushZeit,
    laeufeVon,
    schliesse: (n) => gh(['pr', 'close', String(n)], schreiben),
    oeffne: (n) => gh(['pr', 'reopen', String(n)], schreiben),
    melde,
  })
  return fehler > 0 ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pushZeit = process.argv[2]
  if (!pushZeit || Number.isNaN(Date.parse(pushZeit))) {
    console.error('Aufruf: node tools/pr-nachrechnen.mjs <push-zeitpunkt-iso>')
    process.exit(2)
  }
  const tokens = { lesen: process.env.GH_TOKEN, schreiben: process.env.GH_TOKEN_SCHREIBEN }
  process.exit(ausfuehren(new Date(pushZeit).toISOString(), gh, tokens, (t) => console.log(t)))
}
