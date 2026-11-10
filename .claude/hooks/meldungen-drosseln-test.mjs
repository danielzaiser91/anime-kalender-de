// Test für die gedrosselten Meldungen (posteingang.js, daniel-dateien.mjs, watch.js):
//   node .claude/hooks/meldungen-drosseln-test.mjs
// Läuft komplett in einem Temp-Ordner (USERPROFILE, DANIEL_ORDNER, DANIEL_DATEIEN_STAND umgebogen).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drosseln-'))
process.env.USERPROFILE = tmp
process.env.HOME = tmp
process.env.DANIEL_ORDNER = path.join(tmp, 'daniel')
process.env.DANIEL_DATEIEN_STAND = path.join(tmp, 'dd-stand.json')
const require = createRequire(import.meta.url)
const H = path.dirname(fileURLToPath(import.meta.url))

let fehler = 0
const pruefe = (name, ist, soll) => {
  const ok = soll instanceof RegExp ? soll.test(ist) : ist === soll
  if (!ok) fehler++
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ` (ist: ${JSON.stringify(String(ist).slice(0, 200))})`}`)
}
const schreibe = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t) }

// ---------------------------------------------------------------- 1. Posteingang
{
  const { lauf } = require(path.join(H, 'posteingang.js'))
  const wurzel = path.join(tmp, 'ai')
  const state = path.join(tmp, 'pe-state.json')
  const zeile = (n) => JSON.stringify({ am: `2026-09-2${n}T10:00:00Z`, quelle: 'bau', text: `Meldung ${n}` })
  const haupt = path.join(wurzel, 'proj', 'data', 'meldungen-an-claude.jsonl')
  schreibe(path.join(wurzel, 'proj', '.git', 'HEAD'), 'x')
  schreibe(haupt, [1, 2, 3].map(zeile).join('\n') + '\n')
  const opt = { wurzel, state }
  pruefe('Posteingang: Erstlauf still', lauf(opt), '')
  pruefe('Posteingang: nichts Neues still', lauf(opt), '')
  const kopie = [1, 2, 3].map(zeile).join('\n') + '\n'
  schreibe(path.join(wurzel, '_wtneu', 'data', 'meldungen-an-claude.jsonl'), kopie)
  schreibe(path.join(wurzel, 'projwt', '.git'), 'gitdir: x')
  schreibe(path.join(wurzel, 'projwt', 'data', 'meldungen-an-claude.jsonl'), kopie)
  pruefe('Posteingang: Worktree-Kopien (_wt, .git-Datei) still', lauf(opt), '')
  schreibe(path.join(wurzel, 'ohnegit', 'data', 'meldungen-an-claude.jsonl'), kopie)
  pruefe('Posteingang: Kopie ohne .git, gleicher Inhalt, still', lauf(opt), '')
  fs.appendFileSync(haupt, zeile(4) + '\n')
  const m = lauf(opt)
  pruefe('Posteingang: echte neue Meldung wird gemeldet', m, /1 neue Meldung.*Meldung 4/s)
  pruefe('Posteingang: danach wieder still', lauf(opt), '')
  schreibe(haupt, zeile(4) + '\n') // Datei gekürzt: bekannte Zeile bleibt still
  pruefe('Posteingang: gekürzte Datei still', lauf(opt), '')
}

// ---------------------------------------------------------------- 2. Daniel-Dateien
{
  const D = process.env.DANIEL_ORDNER
  const stand = path.join(D, 'stand.md')
  const jetzt = Date.now()
  const alt = new Date(jetzt - 300 * 60000)
  schreibe(stand, '# Stand\n## Daniel-Todo\n1. x\n')
  fs.utimesSync(stand, alt, alt)
  schreibe(path.join(D, 'berichte', 'b.md'), 'x')
  const index = path.join(D, 'mockups', 'index.html')
  schreibe(index, 'var OFFEN = [\n  ]')
  fs.utimesSync(index, alt, alt)
  const { lauf, sammleFunde } = await import('./daniel-dateien.mjs')
  const funde = sammleFunde()
  pruefe('Daniel-Dateien: alte stand.md ist ein Fund', funde.join('|'), /stand\.md ist \d+ min älter/)
  pruefe('Daniel-Dateien: alte index.html allein ist keiner', funde.some((f) => f.includes('index.html')), false)
  pruefe('Daniel-Dateien: erste Meldung kommt', lauf({ session_id: 'a' }), /Daniel-Dateien veraltet\?.*stand\.md/)
  pruefe('Daniel-Dateien: identische Meldung nicht nochmal', lauf({ session_id: 'a' }), '')
  const später = new Date(jetzt + 5 * 60000) // Minutenzahl wächst
  fs.utimesSync(path.join(D, 'berichte', 'b.md'), später, später)
  pruefe('Daniel-Dateien: nur andere Minutenzahl bleibt still', lauf({ session_id: 'a' }), '')
  pruefe('Daniel-Dateien: andere Sitzung bekommt sie einmal', lauf({ session_id: 'b' }), /stand\.md/)
  schreibe(stand, '# Stand\nAktualisiert: 01.01.2020 10:00\n## Daniel-Todo\n1. x\n')
  fs.utimesSync(stand, alt, alt)
  pruefe('Daniel-Dateien: neuer Fund wird gemeldet', lauf({ session_id: 'a' }), /Stempel/)
  schreibe(stand, '# Stand\n## Daniel-Todo\n1. x\n'); fs.utimesSync(stand, new Date(), new Date())
  pruefe('Daniel-Dateien: behoben ist still', lauf({ session_id: 'a' }), '')
  fs.utimesSync(stand, alt, alt)
  pruefe('Daniel-Dateien: nach Lücke kommt dieselbe Lage wieder', lauf({ session_id: 'a' }), /stand\.md/)
}

// ---------------------------------------------------------------- 3. Regeländerung (watch.js)
{
  const { lauf, zeilenDiff } = require(path.join(H, 'watch.js'))
  const rules = path.join(tmp, '.claude', 'rules')
  const zeilen = Array.from({ length: 30 }, (_, i) => `Regelzeile ${i} mit etwas längerem Text damit der Diff kürzer ist`)
  const a = path.join(rules, 'a.md')
  schreibe(a, zeilen.join('\n') + '\n')
  const eingabe = { session_id: 's1' }
  lauf(eingabe, 'SessionStart')
  pruefe('Watch: ohne Änderung still', lauf(eingabe, 'UserPromptSubmit'), '')
  const geaendert = [...zeilen]
  geaendert[7] = 'NEUE ZEILE sieben'
  schreibe(a, geaendert.join('\n') + '\n')
  const m = lauf(eingabe, 'UserPromptSubmit')
  pruefe('Watch: Änderung als Diff', m, /a\.md \(Änderung\) =+\n- Regelzeile 7[^\n]*\n\+ NEUE ZEILE sieben/)
  pruefe('Watch: Diff enthält keine unveränderten Zeilen', m.includes('Regelzeile 8'), false)
  pruefe('Watch: danach still', lauf(eingabe, 'UserPromptSubmit'), '')
  schreibe(path.join(rules, 'neu.md'), 'Ganz neue Regel\n')
  pruefe('Watch: neue Datei im Volltext', lauf(eingabe, 'UserPromptSubmit'), /neu\.md =+\nGanz neue Regel/)
  schreibe(a, Array.from({ length: 30 }, (_, i) => `komplett anders ${i}`).join('\n') + '\n')
  pruefe('Watch: Umschreibung im Volltext', lauf(eingabe, 'UserPromptSubmit'), /a\.md =+\ nkomplett anders 0|a\.md =+\nkomplett anders 0/)
  fs.rmSync(path.join(tmp, '.claude', 'hooks', 'state', 'regeltexte'), { recursive: true, force: true })
  schreibe(a, geaendert.join('\n') + '\n')
  pruefe('Watch: unbekannter alter Stand im Volltext', lauf(eingabe, 'UserPromptSubmit'), /a\.md =+\nRegelzeile 0/)
  // App-verwaltete Skill-Ordner sind still; ganze Skill-Ordner werden zu einer Zeile
  const skills = path.join(tmp, '.claude', 'skills')
  lauf(eingabe, 'UserPromptSubmit')
  schreibe(path.join(skills, 'synced', 'x', 'SKILL.md'), 'a')
  schreibe(path.join(skills, '.trash', 'y', 'SKILL.md'), 'b')
  pruefe('Watch: synced/.trash neu sind still', lauf(eingabe, 'UserPromptSubmit'), '')
  schreibe(path.join(skills, 'synced', 'x', 'SKILL.md'), 'a2')
  fs.rmSync(path.join(skills, '.trash'), { recursive: true, force: true })
  pruefe('Watch: synced/.trash geändert/entfernt still', lauf(eingabe, 'UserPromptSubmit'), '')
  schreibe(path.join(skills, 'agents-sdk', 'SKILL.md'), 's')
  for (let i = 0; i < 18; i++) schreibe(path.join(skills, 'agents-sdk', 'references', `r${i}.md`), `r${i}`)
  schreibe(path.join(skills, 'einzel', 'SKILL.md'), 'e')
  lauf(eingabe, 'UserPromptSubmit')
  fs.rmSync(path.join(skills, 'agents-sdk'), { recursive: true, force: true })
  fs.rmSync(path.join(skills, 'einzel'), { recursive: true, force: true })
  const e = lauf(eingabe, 'UserPromptSubmit')
  pruefe('Watch: Skill-Ordner entfernt als eine Zeile', e, /Entfernt: Skill agents-sdk \(19 Dateien\)/)
  pruefe('Watch: Ein-Datei-Skill', e, /Entfernt: Skill einzel \(1 Datei\)/)
  pruefe('Watch: keine Einzeldateien gemeldet', e.includes('references'), false)
  pruefe('Watch: zwei Zeilen insgesamt', e.trim().split('\n').length, 2)
  pruefe('zeilenDiff: gleiche Texte ergeben nichts', zeilenDiff('a\nb', 'a\nb'), '')
  pruefe('zeilenDiff: Einfügen', zeilenDiff('a\nc', 'a\nb\nc'), '+ b')
}

fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fehler ? 1 : 0)
