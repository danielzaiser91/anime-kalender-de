/**
 * Markdown unter `.claude/` (Skills, Agenten, Regeln) entwertet keinen PR (10.11.2026, Anlass PR 3272, 3117, 3241, 3343): kein Kettenschritt
 * liest es, aber jeder Code, der „SKILL.md“ oder „bauer.md“ als Namen nennt, galt als Leser und zog über die Importkette den PR hinein.
 * Die Fälle fahren `datenpfadGrund` mit gh-Attrappe und der echten Leser-Regel (`bewegtesGelesen`, `leserIn`); Gegenproben: eine
 * wirklich gelesene Datei (Hook-Code, Daten) entwertet weiter.
 */
import { bewegtesGelesen, leserIn } from './pr-nachrechnen-leser.mjs'
import { datenpfadGrund } from './pr-nachrechnen.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

/** Fake-Baum auf main und im Kopf (gleich); der Leser-Rückruf verhält sich wie `gitLeser`: Leser per Namenssuche, dann `bewegtesGelesen`. */
function grund(baum, bewegtMain, prDateien, nummer) {
  const gh = (args) => {
    if (args[1].includes('/compare/')) return JSON.stringify({ status: 'ahead', anzahl: bewegtMain.length, dateien: bewegtMain, commitsGesamt: 1, autoren: ['danielzaiser91'] })
    return prDateien.join('\n')
  }
  const lies = (p) => baum[p] ?? null
  const leser = (bewegt, dateien) => {
    return bewegtesGelesen({ bewegt, pr: dateien, leser: leserIn(new Map(Object.entries(baum)), bewegt), lies, paketSkripte: null })
  }
  return datenpfadGrund(gh, { number: nummer, headRefOid: 'k' }, 'basis', 'main', leser, () => ({ fehler: 'unbenutzt' }), () => ({ fehler: 'unbenutzt' }))
}
const aktuell = (r) => r.ausnahme !== undefined
const veraltet = (r) => r.grund !== undefined

// Die vier Anlässe: main bewegt nur eine Markdown-Datei unter .claude/, ein Code-Helfer nennt deren Namen und hängt über Importe am PR-Code.
const BAUM = {
  'tools/pr-stufe.mjs': "import { x } from '../shared/staffel-part'\nconst NAME = 'SKILL.md'\n",
  'shared/staffel-part.ts': 'export const x = 1\n',
  'extension/melder.js': "const A = 'bauer.md'\nconst B = 'prueftisch/SKILL.md'\n",
  'extension/amazon.js': "import './melder.js'\n",
  'pipeline/bau/x.ts': "import '../../shared/staffel-part'\n",
}
const FAELLE = [
  [3272, '.claude/skills/pruef-technik/SKILL.md', ['shared/staffel-part.ts']],
  [3117, '.claude/skills/prueftisch/SKILL.md', ['extension/melder.js']],
  [3241, '.claude/skills/pruef-technik/SKILL.md', ['extension/amazon.js']],
  [3343, '.claude/agents/bauer.md', ['extension/melder.js']],
]
for (const [nr, md, pr] of FAELLE) {
  const r = grund(BAUM, [md], pr, nr)
  pruefe(`${nr}: main bewegt nur ${md}, PR ${pr[0]} -> aktuell`, aktuell(r), r)
}
// Mehrere Markdown-Dateien auf einmal und Unterordner (Skill-Beigaben).
pruefe('mehrere .claude-Markdown-Dateien zugleich -> aktuell', aktuell(grund(BAUM, ['.claude/skills/a/SKILL.md', '.claude/rules/10-x.md', '.claude/agents/bauer.md'], ['extension/melder.js'], 1)))

// Gegenproben: was wirklich gelesen wird, entwertet weiter.
const HOOK = { ...BAUM, 'tools/hook.test.mjs': "import '../.claude/hooks/dispatch.js'\n", '.claude/hooks/dispatch.js': 'export {}\n' }
const h = grund(HOOK, ['.claude/hooks/dispatch.js'], ['tools/hook.test.mjs'], 2)
pruefe('Gegenprobe: .claude/hooks/dispatch.js (Code, Test importiert ihn) -> veraltet', veraltet(h), h)
const m = grund({ ...BAUM, 'extension/melder.js': "const A = 'dub-confirmed.yaml'\n" }, ['data/dub-confirmed.yaml'], ['extension/melder.js'], 3)
pruefe('Gegenprobe: data/dub-confirmed.yaml gelesen (PR 3343 nach dem Fix: der echte Rest) -> veraltet', veraltet(m) && /dub-confirmed\.yaml \(extension\/melder\.js\)/.test(m.grund), m)
const g = grund(BAUM, ['.claude/agents/bauer.md', 'data/dub-confirmed.yaml'], ['extension/melder.js'], 4)
pruefe('Gegenprobe: .md plus gelesene Datei nur ohne Leser -> aktuell (Markdown zählt nicht mit)', aktuell(g), g)
const k = grund(BAUM, ['.claude/agents/bauer.md'], ['.claude/agents/bauer.md'], 5)
pruefe('Gegenprobe: der PR berührt dieselbe .claude-Markdown-Datei -> veraltet', veraltet(k) && /berührt \.claude\/agents\/bauer\.md/.test(k.grund), k)
const j = grund(BAUM, ['.claude/skills/a/helfer.mjs'], ['extension/melder.js'], 6)
pruefe('Gegenprobe: Skript unter .claude/skills (kein Markdown), ohne Bezug -> aktuell, aber nicht wegen Markdown-Regel', aktuell(j), j)
const n = grund({ ...BAUM, 'tools/x.mjs': "const A = 'helfer.mjs'\n" }, ['.claude/skills/a/helfer.mjs'], ['tools/x.mjs'], 7)
pruefe('Gegenprobe: Skript unter .claude/skills von PR-Code genannt -> veraltet', veraltet(n), n)

const a = grund({ ...BAUM, 'extension/melder.js': "const A = 'NOTIZ.md'\n" }, ['tools/.claude/NOTIZ.md'], ['extension/melder.js'], 8)
pruefe('Gegenprobe: Namensvetter tools/.claude/NOTIZ.md (kein .claude im Wurzelordner), vom PR-Code genannt -> veraltet', veraltet(a), a)

// Echter Leser (Prüfer 3413, A1): ein Test liest `.claude/agents/pruefer.md` mit vollem Pfad und importiert den PR-Code.
const LESER = {
  ...BAUM,
  'tools/pr-kettenlog-budget.mjs': 'export const budgetHinweise = () => []\n',
  'tools/pr-kettenlog-budget.test.mjs': "import { budgetHinweise } from './pr-kettenlog-budget.mjs'\nconst p = new URL('../.claude/agents/pruefer.md', import.meta.url)\n",
}
const lz = grund(LESER, ['.claude/agents/pruefer.md'], ['tools/pr-kettenlog-budget.mjs'], 9)
pruefe('Leser: Test liest .claude/agents/pruefer.md (voller Pfad), PR berührt seinen Import -> veraltet', veraltet(lz) && /pr-kettenlog-budget/.test(lz.grund), lz)
const ln = grund(LESER, ['.claude/agents/pruefer.md'], ['extension/melder.js'], 10)
pruefe('Leser: derselbe Fall, PR ohne Bezug zum Leser -> aktuell', aktuell(ln), ln)
const nur = { ...LESER, 'tools/pr-kettenlog-budget.test.mjs': "import { budgetHinweise } from './pr-kettenlog-budget.mjs'\nconst n = 'pruefer.md'\n" }
const lb = grund(nur, ['.claude/agents/pruefer.md'], ['tools/pr-kettenlog-budget.mjs'], 11)
pruefe('Leser: Test nennt nur den Dateinamen pruefer.md -> aktuell (bloßer Name zählt nicht)', aktuell(lb), lb)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-claude-md.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log(`pr-nachrechnen-claude-md.test: grün (${FAELLE.length} Anlassfälle, 7 Gegenproben, 3 Leser-Fälle)`)
