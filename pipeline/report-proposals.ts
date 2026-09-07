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

const text = out.join('\n')
console.log(text)

/**
 * **Der Bericht landet auch als Datei — sonst liest ihn niemand.**
 *
 * Bis zum 07.09.2026 schrieb dieser Lauf allein nach stdout, gedacht für die
 * Zusammenfassung des Wochenlaufs. Er stand aber **in keinem Workflow**: kein
 * Aufruf in `refresh-data.yml`, keiner in `refresh-weekly.yml`. Damit lief er
 * nie, und die 51 gemeldeten Ankündigungen mit künftigem Termin sah niemand.
 *
 * Das ist teuer geworden. Daniel am 07.09.2026 zu „Kill Blue": „wir müssen im
 * voraus sowas vorhersehen, entsprechend news etc. quellen abonieren und infos
 * wann es auf crunchy kommt auf webseite bringen." Die Quelle **gab es**:
 * Anime2You meldete am 20.08. „Neue »Kill Blue«-Synchronfassung erscheint auch
 * auf ADN … Ab 24. August 2026", mit `dub: 'ja'`. Der Vorschlag lag im Repo,
 * vier Tage vor dem Termin.
 *
 * Es fehlte also keine Quelle, sondern der Weg vom Abruf zum Blick — dieselbe
 * Klasse wie „Eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen"
 * in `CLAUDE.md`, nur eine Stufe später: Hier wurde die Datei sogar gelesen,
 * nur lief der Leser nie.
 *
 * Als Datei im Repo hat der Bericht zwei Eigenschaften, die stdout nicht hat:
 * Er überlebt den Lauf, und er steht beim nächsten Sitzungsstart da.
 */
const { writeFileSync, mkdirSync } = await import('node:fs')
mkdirSync('daniel-zum-abarbeiten', { recursive: true })
writeFileSync(
  'daniel-zum-abarbeiten/15-news-vorschau.md',
  `# Angekündigt, aber noch nicht im Datensatz\n\nStand: ${today}. Erzeugt von \`npm run data:report\` aus den Anime2You-Vorschlägen.\n\n${text}\n`,
)
