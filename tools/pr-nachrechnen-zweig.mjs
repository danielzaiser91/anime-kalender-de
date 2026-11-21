/**
 * Holt main per `update-branch` in den PR-Zweig (Lehre 129, 17.11.2026): Schließen und Wiederöffnen ließ die Kette mehrfach gegen die alte Basis
 * laufen (PR 4069: sieben Schließen/Öffnen-Paare, Kette weiter gegen 6cc945fe4 statt 5f7c1343e), `update-branch` mit `expected_head_sha` brachte
 * main jedes Mal in den Zweig (PR 4069 Kopf 6ccbb47a9, PR 4097 Kopf eca1e9a71). Der Kopf ändert sich: der Aufrufer meldet den neuen Kopf und endet mit Exit 1.
 * Nach dem PUT zählt nur der Kopf: kam der PUT durch (auch bei 5xx oder Zeitlimit danach), ist angestoßen; ein zweiter PUT oder Schließen/Öffnen folgt nie.
 */
export const KOPF_PRUEFUNGEN = 15
export const KOPF_ABSTAND_MS = 2000

const kurz = (sha) => sha.slice(0, 9)

/** GitHub hat den Aufruf abgewiesen (4xx): nichts angestoßen. */
const NICHT_ANGESTOSSEN = /HTTP 4\d\d/

const kopfLesen = (gh, nummer) => gh(['api', `repos/{owner}/{repo}/pulls/${nummer}`, '--jq', '.head.sha']).trim()

/** Nach einem PUT mit unklarem Ausgang (5xx, Zeitlimit): einmal den Kopf lesen; neu = angekommen, sonst ungewiss (Exit 2, nie wiederholen). */
function nachUnklaremPut(gh, nummer, kopf, text) {
  const ungewiss = `PR ${nummer}: update-branch mit unklarem Ausgang (${text.split('\n')[0]}), Kopf noch ${kurz(kopf)}: SCHON ANGESTOSSEN möglich, Kopf später prüfen, nicht blind wiederholen`
  let neu
  try {
    neu = kopfLesen(gh, nummer)
  } catch (e) {
    throw new Error(`${ungewiss}; Kopf nicht lesbar (${String(e.message).split('\n')[0]})`)
  }
  if (neu === '' || neu === kopf) throw new Error(ungewiss)
  return neu
}

/** Die eine Zeile im Rückfall: Status und gekürzter Text der 4xx-Abweisung (403/422 laufen denselben Weg; „workflow“ im Text = fehlendes Token-Recht). */
function abgewiesenZeile(nummer, text) {
  const status = /HTTP (4\d\d)/.exec(text)
  const zeile = `PR ${nummer}: update-branch abgewiesen (HTTP ${status[1]}: ${text.split('\n')[0].slice(0, 120)}) – Rückfall Schließen/Öffnen`
  return /workflow/i.test(text) ? `${zeile}; Token ohne Workflows-Recht?` : zeile
}

/**
 * Rückgabe: neuer Kopf (40 Zeichen) oder null, wenn der PUT sicher nichts bewirkt hat (4xx wie 422 und 403, Sperre) und der Rückfall
 * (Schließen/Öffnen) gelten darf. Wirft, sobald der PUT durch sein kann und kein neuer Kopf sichtbar ist.
 */
export function aktualisiereZweig(gh, nummer, kopf, warte, melde = () => {}) {
  try {
    gh(['api', '-X', 'PUT', `repos/{owner}/{repo}/pulls/${nummer}/update-branch`, '-f', `expected_head_sha=${kopf}`])
  } catch (e) {
    const text = String(e.message)
    if (NICHT_ANGESTOSSEN.test(text)) {
      melde(abgewiesenZeile(nummer, text))
      return null
    }
    return nachUnklaremPut(gh, nummer, kopf, text)
  }
  for (let i = 0; ; i++) {
    let neu
    try {
      neu = kopfLesen(gh, nummer)
    } catch (e) {
      throw new Error(`PR ${nummer}: update-branch angenommen, Kopf nicht lesbar (${String(e.message).split('\n')[0]}): SCHON ANGESTOSSEN, Kopf später prüfen, nicht blind wiederholen`)
    }
    if (neu !== '' && neu !== kopf) return neu
    if (i >= KOPF_PRUEFUNGEN) throw new Error(`PR ${nummer}: update-branch angenommen, Kopf noch ${kurz(kopf)} (SCHON ANGESTOSSEN: später Kopf prüfen, nicht blind wiederholen)`)
    warte(KOPF_ABSTAND_MS)
  }
}
