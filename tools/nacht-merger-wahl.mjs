/**
 * Auswahlregel des Nacht-Mergers (F99, 01.11.2026): reine Funktionen, kein gh, kein git. Der Läufer (`nacht-merger.mjs`)
 * liest den Stand eines offenen PR und fragt hier, ob er überhaupt Kandidat ist. Erst dann rechnet `pr-nachrechnen` nach
 * (Basis der Kette = jetziger main), erst dann wird gemergt. Im Zweifel nichts tun: jede Abweisung nennt ihren Grund.
 *
 * Kandidat nur, wenn ALLES gilt:
 *  1. offen, kein Entwurf, kein Daten-PR (`daten/`: Sache des Sammlers), mindestens eine geänderte Datei
 *  2. Prüfstufe 0 oder 1 (`tools/pr-stufe.mjs`); alles andere, auch unlesbar, gilt als 2
 *  3. kein Pfad unter `.github/workflows/` (auch kein Umbenennungs-Ursprung)
 *  4. die Prüfkette (`PR-Prüfkette`) ist am aktuellen Kopf grün, kein anderer Check rot, wartend oder abgebrochen
 *  5. Freigabe für genau diesen Kopf: jüngstes CI-Urteil „ok“ zu seinem Kurz-Hash, oder der Nachtrag des Inhabers
 *  6. GitHub meldet APPROVED und CLEAN
 */
import { entscheide } from './abnahme-freigabe.mjs'

export const PFLICHT_CHECK = 'PR-Prüfkette'
/** Das CI-Urteil schreibt `github-actions[bot]` (REST-Name, gemessen 01.11.2026 an PR 2639; `gh pr view` zeigt ihn ohne `[bot]`); ein gleich lautender Kommentar anderer Nutzer zählt nie. */
export const PRUEFER_LOGIN = 'github-actions[bot]'
const URTEIL = /^\*\*Prüfer-Review\*\* für ([0-9a-f]{9}) - Urteil: \*\*([^*\r\n]+)\*\*/
/** Zeile in der PR-Beschreibung, die einen PR als Fix für einen roten Bestandsbau ausweist (Vorrang nur, wenn der Bau rot ist). */
export const VORRANG_ZEILE = /^\s*Behebt (den )?roten Bestandsbau\b/im

/** Urteil „ok“ mit oder ohne Hinweis auf noch laufende oder unbekannte Checks; „ok, Checks rot“ und „aendern…“ sind nicht frei. */
export const urteilIstOk = (titel) => /^ok(,|$)/.test(titel) && !/rot/i.test(titel)

/**
 * Freigabe für `kopf` aus den Kommentaren (`{ login, assoc, at, body }`): { frei, weg, grund }.
 * Der Nachtrag des Inhabers (`## Nachtrag (Abnahme Dirigent` mit Kopf-Präfix) gibt frei; sonst entscheidet das jüngste CI-Urteil zu diesem Kopf.
 */
export function freigabe(kommentare, kopf) {
  const nachtrag = kommentare.find((k) => entscheide({ autor: k.login, assoziation: k.assoc, text: k.body, kopf }).art === 'frei')
  if (nachtrag) return { frei: true, weg: 'nachtrag', grund: 'Nachtrag des Dirigenten zum Kopf' }
  const urteile = kommentare
    .filter((k) => k.login === PRUEFER_LOGIN)
    .map((k) => ({ at: k.at, treffer: URTEIL.exec(k.body) }))
    .filter((u) => u.treffer !== null && kopf.startsWith(u.treffer[1]))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const letztes = urteile.at(-1)
  if (letztes === undefined) return { frei: false, weg: null, grund: 'kein Prüfer-Urteil zu diesem Kopf (alter Kopf oder noch nicht geprüft)' }
  const titel = letztes.treffer[2].trim()
  if (!urteilIstOk(titel)) return { frei: false, weg: null, grund: `Prüfer-Urteil „${titel}“` }
  return { frei: true, weg: 'pruefer', grund: 'Prüfer-Urteil ok zum Kopf' }
}

const ERFOLG = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL'])
const checkName = (c) => c.name ?? c.context

/** 'ok' | 'laeuft' | 'rot' eines einzelnen Checks. */
function checkStand(c) {
  if (c.__typename === 'StatusContext') return c.state === 'SUCCESS' ? 'ok' : c.state === 'PENDING' ? 'laeuft' : 'rot'
  if (c.status !== 'COMPLETED') return 'laeuft'
  return ERFOLG.has(c.conclusion) ? 'ok' : 'rot'
}

/**
 * Das `statusCheckRollup` trägt alle Läufe des Kopfs, auch abgebrochene und frühere (gemessen 01.11.2026 an PR 2625: 221 Einträge, 17 davon `Kette – Logik`).
 * Es zählt je Workflow und Name der neueste Eintrag; ein laufender ist immer der neueste (sein `completedAt` ist „0001-01-01“, `startedAt` kann leer sein).
 */
export function neuesteJeCheck(checks) {
  const je = new Map()
  const laeuft = (c) => checkStand(c) === 'laeuft'
  const juenger = (a, b) => (laeuft(a) !== laeuft(b) ? laeuft(a) : Date.parse(a.startedAt ?? '') > Date.parse(b.startedAt ?? ''))
  for (const c of checks) {
    const schluessel = `${c.workflowName ?? ''}|${checkName(c)}`
    const alt = je.get(schluessel)
    if (alt === undefined || juenger(c, alt)) je.set(schluessel, c)
  }
  return [...je.values()]
}

/** Zustand der Checks (`statusCheckRollup` von gh) am Kopf: { gruen, grund }. Fehlt der Pflicht-Check, ist es nicht grün. */
export function ketteStand(rollup) {
  const checks = neuesteJeCheck(rollup)
  const pflicht = checks.find((c) => checkName(c) === PFLICHT_CHECK)
  if (pflicht === undefined) return { gruen: false, grund: `Check „${PFLICHT_CHECK}“ fehlt am Kopf` }
  const rot = checks.filter((c) => checkStand(c) === 'rot').map(checkName)
  if (rot.length > 0) return { gruen: false, grund: `Check rot: ${rot.join(', ')}` }
  const laeuft = checks.filter((c) => checkStand(c) === 'laeuft').map(checkName)
  if (laeuft.length > 0) return { gruen: false, grund: `Check läuft noch: ${laeuft.join(', ')}` }
  return { gruen: true, grund: 'Kette grün' }
}

/** Abweisungen, die schon die Liste der offenen PRs zeigt (ohne weitere Abrufe); null = weiterlesen. */
export function vorabGrund(pr) {
  if (!pr.offen) return 'nicht offen'
  if (pr.entwurf) return 'Entwurf'
  if (pr.zweig.startsWith('daten/')) return 'Daten-PR (Sache des Sammlers)'
  if (!(pr.geaenderteDateien > 0)) return 'leer (Inhalt schon auf main?)'
  if (pr.reviewDecision !== 'APPROVED') return `Review-Stand ${pr.reviewDecision || 'leer'}, nicht APPROVED`
  if (pr.mergeStateStatus !== 'CLEAN') return `Mergestatus ${pr.mergeStateStatus}, nicht CLEAN`
  return null
}

/**
 * Ist der PR Kandidat? `pr`: { nummer, offen, entwurf, zweig, geaenderteDateien, kopf, stufe, pfade, checks, kommentare, reviewDecision, mergeStateStatus }.
 * Rückgabe { kandidat, grund, weg }; die erste Abweisung zählt.
 */
export function kandidat(pr) {
  const nein = (grund) => ({ kandidat: false, grund })
  const vorab = vorabGrund(pr)
  if (vorab !== null) return nein(vorab)
  if (pr.stufe !== 0 && pr.stufe !== 1) return nein(`Prüfstufe ${pr.stufe}: nur von Hand`)
  const workflow = pr.pfade.find((p) => p.startsWith('.github/workflows/'))
  if (workflow !== undefined) return nein(`berührt ${workflow}: Workflow-PR nur von Hand`)
  const kette = ketteStand(pr.checks)
  if (!kette.gruen) return nein(kette.grund)
  const frei = freigabe(pr.kommentare, pr.kopf)
  if (!frei.frei) return nein(frei.grund)
  return { kandidat: true, grund: `Stufe ${pr.stufe}, ${kette.grund}, ${frei.grund}`, weg: frei.weg }
}

/** Reihenfolge der Kandidaten: bei rotem Bestandsbau zuerst die, die ihn beheben wollen; sonst der älteste PR zuerst. */
export function reihenfolge(prs, bestandRot) {
  const vorrang = (p) => (bestandRot && VORRANG_ZEILE.test(p.beschreibung ?? '') ? 0 : 1)
  return [...prs].sort((a, b) => vorrang(a) - vorrang(b) || Date.parse(a.erstellt) - Date.parse(b.erstellt) || a.nummer - b.nummer)
}
