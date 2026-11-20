/**
 * Nur-Mod-Erkennung (Daniel, 20.11.2026, F147): Ein PR, der ausschließlich die Mod `arbeitsliste` (und Skill-Markdown) ändert,
 * berührt weder Seite noch Daten noch Pipeline. Die PR-Prüfkette fährt dafür nur die Prüfungen, die die Mod wirklich betreffen
 * (Job `modschnell` in .github/workflows/pr-pruefung.yml), und der CI-Prüfer gibt mechanisch frei (pr-pruefer.yml).
 *
 *   node tools/pr-nur-mod.mjs <ref-a> <ref-b>     gibt `nur_mod=1` oder `nur_mod=0` aus (für $GITHUB_OUTPUT), Exit 0
 *
 * Gilt nur, wenn JEDE Datei (auch Umbenennungsquelle) unter `.claude/mods/arbeitsliste/` liegt oder `.claude/skills/**\/*.md` ist
 * und mindestens eine zur Mod gehört. Symlink, Moduswechsel, nicht lesbarer Pfad, leerer Diff: nie Nur-Mod (im Zweifel volle Kette).
 * Nur Node-Bordmittel: das Skript läuft im Scope-Job vor jedem `npm ci`.
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const MOD = /^\.claude\/mods\/arbeitsliste\/[^"\\]+$/
const SKILL_TEXT = /^\.claude\/skills\/[^"\\]+\.md$/
const OHNE_SPRUNG = (pfad) => !pfad.split('/').includes('..')

/** @param {{pfad: string, quelle?: string|null, symlink?: boolean, modus?: boolean, unlesbar?: boolean}[]} dateien */
export function istNurMod(dateien) {
  if (dateien.length === 0) return false
  let mod = false
  for (const d of dateien) {
    if (d.symlink || d.modus || d.unlesbar) return false
    for (const pfad of [d.pfad, d.quelle].filter((p) => p != null)) {
      if (!OHNE_SPRUNG(pfad)) return false
      if (MOD.test(pfad)) mod = true
      else if (!SKILL_TEXT.test(pfad)) return false
    }
  }
  return mod
}

/** Zeilen von `git diff --raw --no-renames -z` -> Dateien (Moduswechsel und Symlinks sichtbar). */
export function leseRaw(ausgabe) {
  const felder = ausgabe.split('\0')
  const dateien = []
  for (let i = 0; i + 1 < felder.length; i += 2) {
    const kopf = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/.exec(felder[i])
    const pfad = felder[i + 1]
    if (!kopf) {
      dateien.push({ pfad: felder[i + 1] ?? '', unlesbar: true })
      continue
    }
    const [, alt, neu, art] = kopf
    const gleichModus = art !== 'A' && art !== 'D' ? alt === neu : true
    const symlink = alt === '120000' || neu === '120000'
    dateien.push({ pfad, symlink, modus: !gleichModus })
  }
  return dateien
}

function main(a, b) {
  const r = spawnSync('git', ['diff', '--raw', '--no-renames', '-z', `${a}`, `${b}`], { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })
  const nur = r.status === 0 && istNurMod(leseRaw(r.stdout))
  if (r.status !== 0) console.error(`pr-nur-mod: git diff fehlgeschlagen (${r.stderr}), volle Kette`)
  console.log(`nur_mod=${nur ? 1 : 0}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) {
    console.error('Aufruf: node tools/pr-nur-mod.mjs <ref-a> <ref-b>')
    process.exit(2)
  }
  main(process.argv[2], process.argv[3])
}
