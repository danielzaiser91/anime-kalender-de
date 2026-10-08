/**
 * Schreibt die Funde als Markdown (für Daniel) und JSON (für die Wache, zum Vergleich zweier Läufe).
 */
import { EINSTUFUNG, hebel } from './einstufung.ts'
import type { Regel } from './regel.ts'

const SEITE = 'https://anime-kalender.de'

function ortLink(ort?: string): string {
  if (!ort) return ''
  const url = ort.startsWith('/') ? `${SEITE}${ort}` : ort
  return ` [↗](${url})`
}

export function sortiertNachHebel(regeln: Regel[]): Regel[] {
  return [...regeln].sort((a, b) => hebel(b.id) - hebel(a.id) || b.treffer.length - a.treffer.length)
}

export function markdown(regeln: Regel[], stand: string, heute: string, proRegel = 8): string {
  const z: string[] = [`# Daten-Detektiv — Funde vom ${heute}`, '', `Datensatz-Stand: ${stand}. Sortiert nach Hebel (Nutzerwirkung × Sicherheit), dann Trefferzahl. Jede Regel: wie viele Einheiten geprüft, wie viele Treffer.`, '']
  z.push('| Regel | Hebel | Empf. | Treffer | geprüft | Was ein Besucher Falsches sähe |', '|---|---|---|---|---|---|')
  for (const r of sortiertNachHebel(regeln)) {
    const e = EINSTUFUNG[r.id]
    z.push(`| ${r.id} ${r.name} | ${hebel(r.id).toFixed(1)} | ${e?.empfehlung ?? '?'} | **${r.treffer.length}** | ${r.geprueft} | ${r.folge} |`)
  }
  z.push('')
  for (const r of sortiertNachHebel(regeln)) {
    if (!r.treffer.length) continue
    z.push(`## ${r.id} ${r.name} — ${r.treffer.length} Treffer`, '')
    if (EINSTUFUNG[r.id]?.stichprobe) z.push(`Stichprobe: ${EINSTUFUNG[r.id].stichprobe}`, '')
    for (const t of r.treffer.slice(0, proRegel)) z.push(`- ${t.text}${ortLink(t.ort)}`)
    if (r.treffer.length > proRegel) z.push(`- … und ${r.treffer.length - proRegel} weitere (vollständig im JSON)`)
    z.push('')
  }
  return z.join('\n')
}

export function json(regeln: Regel[], stand: string, heute: string): string {
  return JSON.stringify({ heute, stand, regeln: sortiertNachHebel(regeln).map((r) => ({ ...r, hebel: hebel(r.id), einstufung: EINSTUFUNG[r.id] })) }, null, 1)
}

/** Vergleich mit dem vorigen Lauf: neue und verschwundene Schlüssel je Regel. */
export function delta(alt: { regeln: Regel[] } | undefined, neu: Regel[]): string[] {
  if (!alt) return []
  const zeilen: string[] = []
  for (const r of neu) {
    const vorher = new Set((alt.regeln.find((x) => x.id === r.id)?.treffer ?? []).map((t) => t.schluessel))
    const jetzt = new Set(r.treffer.map((t) => t.schluessel))
    const dazu = [...jetzt].filter((k) => !vorher.has(k)), weg = [...vorher].filter((k) => !jetzt.has(k))
    if (dazu.length || weg.length) zeilen.push(`${r.id}: +${dazu.length} −${weg.length}${dazu.length ? ` neu: ${dazu.slice(0, 3).join(', ')}` : ''}`)
  }
  return zeilen
}
