/**
 * Schreibt den Kuratierungs-Bericht als Markdown.
 *
 * Landet in der Zusammenfassung des Wochenlaufs. Er beantwortet genau eine
 * Frage: Was wurde gemeldet, steht aber noch nicht im Datensatz? Ohne diese
 * Liste müsste man die Nachrichtenlage jede Woche selbst durchsehen — und
 * genau das passiert dann erfahrungsgemäß nicht.
 *
 * Aufruf: npx tsx pipeline/report-proposals.ts
 */
import { readJson } from './lib/util.ts'
import { readSourceHealth } from './lib/health.ts'
import { todayIso } from '../shared/time.ts'
import type { Proposal } from './scrape-anime2you.ts'

const { proposals } = readJson<{ proposals: Proposal[] }>('data/proposals/anime2you.json', { proposals: [] })
const health = readSourceHealth()
const today = todayIso()

const out: string[] = ['## Kuratierung: was noch fehlt', '']

const open = proposals
  .filter((p) => !p.alreadyCurated)
  .filter((p) => p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= today))
  .sort((a, b) => {
    const first = (p: Proposal) => p.dates.map((d) => d.iso ?? d.month).sort()[0] ?? '9999'
    return first(a).localeCompare(first(b))
  })

if (!open.length) {
  out.push('Nichts offen — jede gemeldete Ankündigung mit künftigem Termin steht im Datensatz.')
} else {
  out.push(`${open.length} Meldungen mit künftigem Termin sind noch nicht eingearbeitet.`, '')
  out.push('| Termin | Plattform | Synchro | Meldung |', '|---|---|---|---|')
  for (const p of open.slice(0, 40)) {
    const when = p.dates.map((d) => d.iso ?? `${d.month} (Monat)`).join(', ')
    const dub = { ja: '✅ zugesagt', offen: '⚠️ offen', unklar: '– unklar' }[p.dub]
    out.push(`| ${when} | ${p.platforms.join(', ') || '?'} | ${dub} | [${p.articleTitle}](${p.articleUrl}) |`)
  }
  if (open.length > 40) out.push('', `… und ${open.length - 40} weitere.`)
}

out.push('', '## Quellen', '', '| Quelle | zuletzt erfolgreich | Treffer |', '|---|---|---|')
for (const [name, state] of Object.entries(health).sort()) {
  const age = state.lastOk
    ? `${((Date.now() - new Date(state.lastOk).getTime()) / 86_400_000).toFixed(1)} Tage her`
    : '**noch nie**'
  out.push(`| ${name} | ${age} | ${state.lastCount} |`)
}

console.log(out.join('\n'))
