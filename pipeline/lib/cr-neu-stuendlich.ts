/**
 * Der Stundenlauf muss neue deutsche Crunchyroll-Folgen selbst finden, nicht erst der Tageslauf (Psyren, 27.10.2026):
 * `data:cr-neu` → Zählung `--offen-pruefen` → Zugangspaket der Weiche → `data:cr-dub -- --nur-neu`, vor „Verpasste Termine prüfen“
 * und vor dem Einreichen. Paket und Urteil laufen nur, wenn die Zählung nicht 0 meldet (spart die Weiche und den Browserstart).
 * Dazu das Zeitbudget: Die Zeitgrenzen der Schritte passen zusammen in `timeout-minutes` des Jobs.
 * Prüft das geparste Dokument, nicht den Text.
 */
interface Schritt {
  name?: string
  id?: string
  run?: string
  if?: unknown
  env?: Record<string, string>
  uses?: string
}
export interface Workflow {
  on?: { workflow_run?: { workflows?: string[] } }
  jobs?: Record<string, { 'timeout-minutes'?: number; steps?: Schritt[] }>
}

const MAX_MINUTEN = 10
const WOCHEN_NAME = 'Stündlich — Sendezeiten'
/** Einrichten (gemessen 30–55 s) und Einreichen (gemessen 3–5 min) laufen ohne Zeitgrenze des Schritts; so viel bleibt dafür frei. */
export const RESERVE_MINUTEN = 10
/** Die Zählung gibt `cr_offen` aus; Paket und Urteil laufen nur bei einem Wert ungleich 0 (leer = Zählung gescheitert = lesen). */
export const OFFEN_BEDINGUNG = "steps.cr_offen.outputs.cr_offen != '0'"
const ZAEHLEN_ID = 'cr_offen'

function finde(schritte: Schritt[], muster: string, ohne = ''): number[] {
  return schritte.flatMap((s, i) => (s.run?.includes(muster) && !(ohne && s.run.includes(ohne)) ? [i] : []))
}

/** Ein Schritt der Kette: genau einmal, über `schritt.sh` mit Zeitgrenze, mit der erwarteten (oder ohne) Bedingung. */
function einzeln(schritte: Schritt[], muster: string, was: string, befunde: string[], ohne = '', bedingung?: string): number {
  const treffer = finde(schritte, muster, ohne)
  if (treffer.length !== 1) {
    befunde.push(`${was}: ${treffer.length} Schritte statt 1 (${muster})`)
    return -1
  }
  const s = schritte[treffer[0]]
  const zeit = /^bash tools\/schritt\.sh --zeit (\d+)m /.exec((s.run ?? '').trim())
  if (!zeit) befunde.push(`${was}: läuft nicht über tools/schritt.sh --zeit (ein Scheitern risse den Lauf mit)`)
  else if (Number(zeit[1]) > MAX_MINUTEN) befunde.push(`${was}: Zeitgrenze ${zeit[1]} min über ${MAX_MINUTEN}`)
  if (s.if !== bedingung) befunde.push(`${was}: trägt ${bedingung === undefined ? 'eine Bedingung (if)' : `nicht die Bedingung ${bedingung}`}`)
  return treffer[0]
}

/** Minuten einer Zeitgrenze `--zeit 8m` / `--zeit 1h`; `undefined`, wenn der Schritt keine trägt. */
function zeitgrenze(run: string): number | undefined {
  const m = /^bash tools\/schritt\.sh --zeit (\d+)([mh]) /.exec(run.trim())
  return m ? Number(m[1]) * (m[2] === 'h' ? 60 : 1) : undefined
}

/** Summe der Schrittgrenzen eines Jobs samt Reserve gegen `timeout-minutes`; ein Schritt über `schritt.sh` ohne Grenze zählt als Befund. */
export function zeitbudgetBefunde(wf: Workflow): string[] {
  const befunde: string[] = []
  for (const [name, job] of Object.entries(wf.jobs ?? {})) {
    const grenze = job['timeout-minutes']
    let summe = 0
    for (const s of job.steps ?? []) {
      if (!s.run?.includes('tools/schritt.sh')) continue
      const minuten = zeitgrenze(s.run)
      if (minuten === undefined) befunde.push(`Zeitbudget ${name}: Schritt ohne --zeit (${s.name ?? s.run.slice(0, 40)})`)
      else summe += minuten
    }
    if (grenze === undefined) befunde.push(`Zeitbudget ${name}: kein timeout-minutes`)
    else if (summe + RESERVE_MINUTEN > grenze) {
      befunde.push(`Zeitbudget ${name}: Zeitgrenzen ${summe} min + ${RESERVE_MINUTEN} min Reserve über timeout-minutes ${grenze}`)
    }
  }
  return befunde
}


/** Der Befehl hinter dem Trenner `-- npm run …` eines `schritt.sh`-Aufrufs. */
const befehlVon = (run: string | undefined): string => (run ?? '').slice((run ?? '').indexOf('-- npm run'))

/** Die Zählung ist dieselbe Auswahl wie das Urteil, nur mit `--offen-pruefen` — sonst zählte sie etwas anderes, als gelesen wird. */
function zaehlungBefunde(schritte: Schritt[], zaehlen: number, urteil: number): string[] {
  if (zaehlen < 0 || urteil < 0) return []
  const befunde: string[] = []
  if (befehlVon(schritte[zaehlen].run).replace(' --offen-pruefen', '') !== befehlVon(schritte[urteil].run)) {
    befunde.push('Zählung: andere Auswahl als das Urteil (gleiche Argumente bis auf --offen-pruefen)')
  }
  if (schritte[zaehlen].id !== ZAEHLEN_ID) befunde.push(`Zählung: Schritt-Kennung nicht ${ZAEHLEN_ID}`)
  return befunde
}

/** Widersprüche zwischen dem Stundenlauf und der Kette (leer = stimmig). */
export function stundenlaufBefunde(stunde: Workflow, bau: Workflow): string[] {
  const befunde: string[] = []
  const schritte = stunde.jobs?.sendezeiten?.steps ?? []
  const neu = einzeln(schritte, 'npm run data:cr-neu', 'Katalogfund', befunde)
  const zaehlen = einzeln(schritte, 'data:cr-dub -- --nur-neu --limit 60 --offen-pruefen', 'Zählung', befunde)
  const weiche = einzeln(schritte, 'node tools/cr-zugang-holen.mjs --github-env', 'Zugangspaket', befunde, '', OFFEN_BEDINGUNG)
  const urteil = einzeln(schritte, 'npm run data:cr-dub -- --nur-neu', 'Urteil', befunde, '--offen-pruefen', OFFEN_BEDINGUNG)
  befunde.push(...zaehlungBefunde(schritte, zaehlen, urteil))
  const pruefen = finde(schritte, 'pipeline/termine-pruefen.ts')[0] ?? -1
  const einreichen = schritte.findIndex((s) => s.uses?.includes('actions/einreichen'))
  if (pruefen < 0 || einreichen < 0) befunde.push('Verpasste Termine oder Einreichen fehlen als Anker')
  const reihe = [neu, zaehlen, weiche, urteil, pruefen, einreichen]
  if (reihe.every((i) => i >= 0) && reihe.some((i, k) => k > 0 && i <= reihe[k - 1])) {
    befunde.push('Reihenfolge: Katalogfund, Zählung, Zugangspaket, Urteil, Verpasste Termine, Einreichen')
  }
  if (weiche >= 0 && schritte[weiche].env?.CR_WEICHE_TOKEN !== '${{ secrets.CR_WEICHE_TOKEN }}') {
    befunde.push('Zugangspaket: CR_WEICHE_TOKEN kommt nicht aus dem Secret')
  }
  if (urteil >= 0 && /MELDER"? +fehler/.test(schritte[urteil].run ?? '')) {
    befunde.push('Urteil: eigener fehler-Melder (Weichen-Ausfall wären 24 rote Einträge am Tag)')
  }
  if (urteil >= 0 && schritte[urteil].env?.CR_ZUGANG !== '${{ env.CR_ZUGANG_FRISCH }}') {
    befunde.push('Urteil: CR_ZUGANG nicht aus dem frischen Paket der Weiche')
  }
  if (!bau.on?.workflow_run?.workflows?.includes(WOCHEN_NAME)) befunde.push(`Bestandsbau startet nicht nach „${WOCHEN_NAME}“`)
  befunde.push(...zeitbudgetBefunde(stunde))
  return befunde
}
