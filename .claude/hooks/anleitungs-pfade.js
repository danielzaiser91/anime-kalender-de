// Prüft Pfade in Anleitungen (`.claude/**/*.md`, `CLAUDE.md`) und in Hook-Meldetexten auf Existenz (Anlass 11.11.2026:
// Hook-Meldung und Skill zeigten auf das seit G4 leere `~/.claude/rules/`, eine Regel nannte einen Hook, den es nicht gibt).
// Nicht im Repo liegt `daniel-zum-abarbeiten/` (lokal ausgeschlossen): nicht geprüft.
// Geprüft werden nur Repo-Pfade mit bekannter Wurzel. Ausdrücklich frei: Platzhalter (`<…>`, `*`, `{…}`, `$`, `…`),
// Pfade außerhalb des Repos (`~/`, `C:/`), erzeugte/ignorierte Ordner (`data/cache/`, `node_modules/`, `dist/`).
// Verboten bleibt `~/.claude/rules/` — dort liegt seit G4 nichts mehr, die Regeln stehen im Projekt.
const fs = require('node:fs')
const path = require('node:path')

const WURZELN = ['.claude', 'tools', 'pipeline', 'shared', 'docs', 'web', 'worker', 'data', 'extension', 'public', 'ARCHITEKTUR.md', 'CLAUDE.md']
const FREI = /^(\.claude\/settings\.local\.json|data\/cache\/|node_modules\/|dist\/|public\/data\/)/
// Bekannte Funde in Dateien, die dieser PR nicht anfasst (Bauer/Prüfer/Delegieren: PRs 3248/3413/3414) oder die absichtlich
// ein Gegenbeispiel zeigen; die Liste darf nur sinken: ein Eintrag, der nicht mehr zutrifft, macht die Prüfung rot.
const BEKANNT = [
  '.claude/agents/bauer.md: extension/pruefstand.json existiert nicht',
  '.claude/agents/bauer.md: pipeline/bau/ausgabe-kennung.ts existiert nicht',
  '.claude/agents/pruefer.md: tools/sammler-lesezugriffe.json existiert nicht',
  // Gegenbeispiele und erzeugte Listen (nur lokal vorhanden), absichtlich genannt:
  '.claude/skills/links-im-windows-client/SKILL.md: data/dub-batches.md existiert nicht',
  '.claude/skills/links-im-windows-client/SKILL.md: data/youtube-pruefliste.md existiert nicht',
  '.claude/skills/links-im-windows-client/SKILL.md: data/rtlplus-pruefliste.md existiert nicht',
  '.claude/skills/links-im-windows-client/SKILL.md: data/netflix-von-hand.md existiert nicht',
  '.claude/skills/wissen-veraltet-nie/SKILL.md: data/meldungen-ohne-zuordnung.md existiert nicht',
]
const ENDUNG = /\.(md|js|mjs|cjs|ts|tsx|json|jsonl|yaml|yml|sh|txt|css|html)$/
const PFAD = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+\/?|CLAUDE\.md|ARCHITEKTUR\.md)(?=$|[\s`'"):,;.])/g
const GLOBAL_REGELN = /~\/\.claude\/rules\//

/** Repo-Pfade aus einem Text (ohne Zeilen-Suffix `:54`, ohne Platzhalter und Fremdpfade). */
function findePfade(text) {
  const fund = new Set()
  for (const m of text.matchAll(PFAD)) {
    const p = m[1].replace(/\.$/, '')
    if (!WURZELN.includes(p.split('/')[0])) continue
    if (/[<>*{}$…]|(^|\/)NN[-.]/.test(p) || FREI.test(p)) continue
    if (!p.endsWith('/') && !ENDUNG.test(p)) continue
    fund.add(p)
  }
  return [...fund]
}

/** Je Datei: fehlende Repo-Pfade und verbotene `~/.claude/rules/`-Verweise. */
function pruefeDatei(wurzel, datei) {
  const text = fs.readFileSync(path.join(wurzel, datei), 'utf8')
  const fehler = []
  if (GLOBAL_REGELN.test(text)) fehler.push(`${datei}: verweist auf ~/.claude/rules/ (leer seit G4, Regeln liegen in .claude/rules/)`)
  for (const p of findePfade(text.replace(/~\/[^\s`'")]*/g, ''))) {
    if (!fs.existsSync(path.join(wurzel, p))) fehler.push(`${datei}: ${p} existiert nicht`)
  }
  return fehler
}

function sammle(wurzel, ordner, endungen, aus = []) {
  for (const e of fs.readdirSync(path.join(wurzel, ordner), { withFileTypes: true })) {
    const rel = `${ordner}/${e.name}`
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') sammle(wurzel, rel, endungen, aus)
    } else if (endungen.some((x) => e.name.endsWith(x))) aus.push(rel)
  }
  return aus
}

/** Alle geprüften Dateien: Markdown unter `.claude/` (ohne Mod-Fremdordner), `CLAUDE.md`, Hook-Skripte. */
function anleitungsDateien(wurzel) {
  const md = sammle(wurzel, '.claude', ['.md']).filter((f) => !f.startsWith('.claude/mods/') && !(f.startsWith('.claude/skills/regeln-im-detail/') && !f.endsWith('/SKILL.md')))
  const hooks = sammle(wurzel, '.claude/hooks', ['.js']).filter((f) => !f.endsWith('-test.js') && f !== '.claude/hooks/anleitungs-pfade.js')
  return ['CLAUDE.md', ...md, ...hooks]
}

/** Neue Funde (nicht in BEKANNT) plus BEKANNT-Einträge, die nicht mehr zutreffen (Ratsche: nur sinken). */
function bewerte(funde, bekannt) {
  const neu = funde.filter((f) => !bekannt.includes(f))
  const erledigt = bekannt.filter((b) => !funde.includes(b)).map((b) => `BEKANNT veraltet, bitte streichen: ${b}`)
  return [...neu, ...erledigt]
}

function pruefeAlle(wurzel) {
  return bewerte(anleitungsDateien(wurzel).flatMap((d) => pruefeDatei(wurzel, d)), BEKANNT)
}

module.exports = { findePfade, pruefeDatei, pruefeAlle, anleitungsDateien, bewerte }
