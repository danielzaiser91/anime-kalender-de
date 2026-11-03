/**
 * Schwarzliste für `tools/claude-global/` (Repo ist öffentlich): Namen und Pfade privater Projekte, der Windows-Kontoname in
 * Skill-Pfaden und der Nachname dürfen nicht in den eingesammelten Dateien stehen. Die Suche ist ein reiner Textvergleich
 * (`findePrivates`), mit Fällen je Muster; danach läuft sie über alle Dateien des Ordners.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const MUSTER = [
  { name: 'Website-Projekt', treffer: /my(?: |%20)website/ },
  { name: 'Bewerbungs-Projekt', treffer: /_bewerbung|ai-bewerbung/ },
  { name: 'Spielprojekt', treffer: /GeoGuessr/ },
  { name: 'Portfolio-Repo', treffer: /Portfolio-daniel/ },
  { name: 'Nachname', treffer: /Zaiser/, ausser: ['mods/arbeitsliste/.claude-plugin/plugin.json'] },
  { name: 'Kontoname im Skill-Pfad', treffer: /C:[\\/]+Users[\\/]/, nur: 'skills/' },
]

/** Liefert die Namen der Muster, die `text` der Datei `pfad` (relativ, mit `/`) verletzen. */
export function findePrivates(pfad, text) {
  return MUSTER.filter((m) => m.treffer.test(text) && !m.ausser?.includes(pfad) && (!m.nur || pfad.startsWith(m.nur))).map((m) => m.name)
}

const alleDateien = (ordner) => readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alleDateien(join(ordner, e.name)) : [join(ordner, e.name)]))

// Fälle: je Muster einer rot, dazu die Ausnahmen grün.
const fall = (pfad, text) => findePrivates(pfad, text).join(',')
assert.equal(fall('skills/a/SKILL.md', 'Pfad C:\\code\\ai\\my website\\x'), 'Website-Projekt')
assert.equal(fall('skills/a/SKILL.md', 'link my%20website/status.md'), 'Website-Projekt')
assert.equal(fall('rules/x.md', 'C:\\code\\ai\\_bewerbung\\y'), 'Bewerbungs-Projekt')
assert.equal(fall('rules/x.md', '/ai-bewerbung-input-list'), 'Bewerbungs-Projekt')
assert.equal(fall('skills/a/SKILL.md', 'bei GeoGuessr'), 'Spielprojekt')
assert.equal(fall('skills/a/SKILL.md', 'danielzaiser91/Portfolio-daniel-zaiser.de'), 'Portfolio-Repo')
assert.equal(fall('agents/x.md', 'Daniel Zaiser'), 'Nachname')
assert.equal(fall('mods/arbeitsliste/.claude-plugin/plugin.json', 'Daniel Zaiser'), '', 'Autorfeld der Mod ist erlaubt')
assert.equal(fall('agents/x.md', 'danielzaiser91/anime-kalender-de'), '', 'GitHub-Kontoname ist öffentlich')
assert.equal(fall('skills/a/SKILL.md', 'C:/Users/ih/.claude'), 'Kontoname im Skill-Pfad')
assert.equal(fall('skills/a/SKILL.md', 'C:\\Users\\ih\\.claude'), 'Kontoname im Skill-Pfad')
assert.equal(fall('hooks/h.js', 'C:/Users/ih/.claude/hooks'), '', 'Hooks und Mods brauchen den festen Pfad')
assert.equal(fall('skills/a/SKILL.md', '~/.claude/skills und mein projekt'), '')

const wurzel = join(import.meta.dirname, 'claude-global')
const verletzt = alleDateien(wurzel).flatMap((datei) => {
  const rel = relative(wurzel, datei).replace(/\\/g, '/')
  return findePrivates(rel, readFileSync(datei, 'utf8')).map((name) => `${rel}: ${name}`)
})
assert.deepEqual(verletzt, [], `Privates in tools/claude-global/:\n${verletzt.join('\n')}`)
console.log(`claude-global-privat.test: ok (${MUSTER.length} Muster, ${alleDateien(wurzel).length} Dateien ohne Treffer)`)
