/**
 * Bei rotem Bestandsbau stehen die offenen Fix-PRs des Fixers (dieselbe Menge wie in der Sperre, `fix-pr-sperre.mjs`) unter der ALARM-Zeile, ohne Alarm unter einer Kopfzeile.
 * Anlass 02.11.2026: PR 2662 (Zweig `fix/…`, Autor `app/claude`, 05:38 UTC) lag 11 h ungesehen, die Wache zeigte nur die Alarmzeile.
 */
import { BESTAND_WORKFLOW, holeLaeufeJson, roteSeitGruen } from './bestand-rot-alarm.mjs'
import { SPERR_STUNDEN, sperrendeFixPrs } from './fix-pr-sperre.mjs'

export const KEIN_FIX_PR = `  Kein sperrender Fix-PR (offen, jünger als ${SPERR_STUNDEN} h).`

/** „3 grün, 1 rot, 2 offen“ aus `statusCheckRollup` (CheckRun: status/conclusion, StatusContext: state). */
export function pruefZustand(rollup) {
  if (!rollup || rollup.length === 0) return 'keine Prüfung gestartet'
  let gruen = 0
  let rot = 0
  let offen = 0
  for (const c of rollup) {
    const ergebnis = c.conclusion || c.state || ''
    if (c.status && c.status !== 'COMPLETED' && !c.state) offen++
    else if (['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(ergebnis)) gruen++
    else if (['PENDING', 'EXPECTED', ''].includes(ergebnis)) offen++
    else rot++
  }
  return `${gruen} grün, ${rot} rot, ${offen} offen`
}

export function fixPrZeile(pr, jetztMs) {
  const stunden = (jetztMs - Date.parse(pr.createdAt)) / 3_600_000
  const entwurf = pr.isDraft ? ', Entwurf' : ''
  return `  Fix-PR #${pr.number} (${pr.headRefName}) offen seit ${stunden.toFixed(1)} h${entwurf}, Prüfung: ${pruefZustand(pr.statusCheckRollup)}`
}

/** Zeilen unter der Alarmzeile; ein Lesefehler ist selbst eine Zeile. */
export function fixPrZeilen(gh, repo, jetztMs) {
  try {
    const rote = roteSeitGruen(holeLaeufeJson(gh, repo, BESTAND_WORKFLOW))
    if (rote.length === 0) return []
    const prs = JSON.parse(gh('pr', 'list', '--repo', repo, '--state', 'open', '--limit', '50', '--json', 'number,headRefName,createdAt,author,isDraft,statusCheckRollup'))
    const treffer = sperrendeFixPrs(prs, jetztMs)
    if (treffer.length === 0) return [KEIN_FIX_PR]
    return treffer.map((p) => fixPrZeile(p, jetztMs))
  } catch (fehler) {
    return [`  ALARM? Fix-PRs nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}

/**
 * Die ALARM-Zeilen; direkt unter der Bestandsbau-Alarmzeile die Fix-PRs (einmal, auch bei zwei Bestandsbau-Zeilen).
 * Ohne Alarm, aber bei rotem Bestandsbau, stehen sie unter einer Kopfzeile (nur wenn es welche gibt).
 */
export function alarmZeilenMitFixPrs(rotZeilen, gh, repo, jetztMs) {
  const ausgabe = []
  let geholt = false
  for (const zeile of rotZeilen) {
    if (!zeile.startsWith('ALARM')) continue
    ausgabe.push(zeile)
    if (zeile.startsWith('ALARM Bestandsbau') && !geholt) {
      geholt = true
      ausgabe.push(...fixPrZeilen(gh, repo, jetztMs))
    }
  }
  if (!geholt) {
    const zeilen = fixPrZeilen(gh, repo, jetztMs).filter((z) => z !== KEIN_FIX_PR)
    if (zeilen.length > 0) ausgabe.push('Bestandsbau rot, noch unter der Alarmschwelle:', ...zeilen)
  }
  return ausgabe
}
