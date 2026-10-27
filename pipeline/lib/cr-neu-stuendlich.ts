/**
 * Der Stundenlauf muss neue deutsche Crunchyroll-Folgen selbst finden, nicht erst der Tageslauf (Psyren, 27.10.2026):
 * `data:cr-neu` → Zugangspaket der Weiche → `data:cr-dub -- --nur-neu`, vor „Verpasste Termine prüfen“ und vor dem Einreichen.
 * Prüft das geparste Dokument, nicht den Text.
 */
interface Schritt {
  name?: string
  run?: string
  if?: unknown
  env?: Record<string, string>
  uses?: string
}
export interface Workflow {
  on?: { workflow_run?: { workflows?: string[] } }
  jobs?: Record<string, { steps?: Schritt[] }>
}

const MAX_MINUTEN = 10
const WOCHEN_NAME = 'Stündlich — Sendezeiten'

function finde(schritte: Schritt[], muster: string): number[] {
  return schritte.flatMap((s, i) => (s.run?.includes(muster) ? [i] : []))
}

/** Ein Schritt der Kette: genau einmal, über `schritt.sh` mit Zeitgrenze, ohne Bedingung. */
function einzeln(schritte: Schritt[], muster: string, was: string, befunde: string[]): number {
  const treffer = finde(schritte, muster)
  if (treffer.length !== 1) {
    befunde.push(`${was}: ${treffer.length} Schritte statt 1 (${muster})`)
    return -1
  }
  const s = schritte[treffer[0]]
  const zeit = /^bash tools\/schritt\.sh --zeit (\d+)m /.exec((s.run ?? '').trim())
  if (!zeit) befunde.push(`${was}: läuft nicht über tools/schritt.sh --zeit (ein Scheitern risse den Lauf mit)`)
  else if (Number(zeit[1]) > MAX_MINUTEN) befunde.push(`${was}: Zeitgrenze ${zeit[1]} min über ${MAX_MINUTEN}`)
  if (s.if !== undefined) befunde.push(`${was}: trägt eine Bedingung (if)`)
  return treffer[0]
}

/** Widersprüche zwischen dem Stundenlauf und der Kette (leer = stimmig). */
export function stundenlaufBefunde(stunde: Workflow, bau: Workflow): string[] {
  const befunde: string[] = []
  const schritte = stunde.jobs?.sendezeiten?.steps ?? []
  const neu = einzeln(schritte, 'npm run data:cr-neu', 'Katalogfund', befunde)
  const weiche = einzeln(schritte, 'node tools/cr-zugang-holen.mjs --github-env', 'Zugangspaket', befunde)
  const urteil = einzeln(schritte, 'npm run data:cr-dub -- --nur-neu', 'Urteil', befunde)
  const pruefen = finde(schritte, 'pipeline/termine-pruefen.ts')[0] ?? -1
  const einreichen = schritte.findIndex((s) => s.uses?.includes('actions/einreichen'))
  if (pruefen < 0 || einreichen < 0) befunde.push('Verpasste Termine oder Einreichen fehlen als Anker')
  const reihe = [neu, weiche, urteil, pruefen, einreichen]
  if (reihe.every((i) => i >= 0) && reihe.some((i, k) => k > 0 && i <= reihe[k - 1])) {
    befunde.push('Reihenfolge: Katalogfund, Zugangspaket, Urteil, Verpasste Termine, Einreichen')
  }
  if (weiche >= 0 && schritte[weiche].env?.CR_WEICHE_TOKEN !== '${{ secrets.CR_WEICHE_TOKEN }}') {
    befunde.push('Zugangspaket: CR_WEICHE_TOKEN kommt nicht aus dem Secret')
  }
  if (urteil >= 0 && schritte[urteil].env?.CR_ZUGANG !== '${{ env.CR_ZUGANG_FRISCH }}') {
    befunde.push('Urteil: CR_ZUGANG nicht aus dem frischen Paket der Weiche')
  }
  if (!bau.on?.workflow_run?.workflows?.includes(WOCHEN_NAME)) befunde.push(`Bestandsbau startet nicht nach „${WOCHEN_NAME}“`)
  return befunde
}
