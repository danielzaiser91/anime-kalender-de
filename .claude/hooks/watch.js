#!/usr/bin/env node
/**
 * Regel- und Skill-Wächter.
 *
 * Zwei Betriebsarten, beide über dieselbe Dateiliste:
 *
 *   SessionStart      → meldet, was geladen ist und was sich seit der letzten Sitzung
 *                       geändert hat. Bei source="compact" werden die Regeln zusätzlich
 *                       vollständig neu eingespielt (nach dem Kompaktieren ist nur die
 *                       Projekt-CLAUDE.md garantiert wieder da).
 *   UserPromptSubmit  → prüft bei JEDEM Prompt, ob sich seit dem letzten Prompt etwas
 *                       geändert hat, und schiebt geänderte Regeln nach (nur die geänderten
 *                       Zeilen; Volltext bei neuer Datei, unbekanntem Altstand oder Umschreibung).
 *                       Damit wirken Änderungen auch in einer laufenden Sitzung sofort.
 *
 * Die Standardausgabe beider Ereignisse landet laut Doku im Kontext des Modells
 * ("stdout is added as context that Claude can see and act on"). Ohne Änderung wird
 * bewusst NICHTS ausgegeben.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const GLOBAL_DIR = path.join(HOME, '.claude');
// Seit G2 (09.11.2026) liegen Regeln, Skills und Commands im Projekt; Zustandsdateien bleiben unter ~/.claude.
const CLAUDE_DIR = process.env.CLAUDE_PROJECT_DIR ? path.join(process.env.CLAUDE_PROJECT_DIR, '.claude') : GLOBAL_DIR;
const RULES_DIR = path.join(CLAUDE_DIR, 'rules');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands');
const STATE_DIR = path.join(GLOBAL_DIR, 'hooks', 'state');

// ---------------------------------------------------------------- Dateiliste

function listMarkdown(dir, recursive) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) out.push(...listMarkdown(full, true));
    } else if (e.name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** Diese Skill-Ordner verwaltet die Claude-App selbst; ihre Änderungen sind für uns Rauschen. */
const APP_VERWALTET = ['synced', '.trash'];

function appVerwaltet(p) {
  const teile = path.relative(SKILLS_DIR, p).split(path.sep);
  return teile.length > 1 && APP_VERWALTET.includes(teile[0]);
}

/** Alles, was das Verhalten des Agenten steuert — nach Art gruppiert. */
function collect() {
  const files = [];
  const push = (p, kind) => {
    try {
      const content = fs.readFileSync(p, 'utf8');
      files.push({
        path: p,
        kind,
        hash: crypto.createHash('sha1').update(content).digest('hex'),
        lines: content.split('\n').length,
        content,
      });
    } catch { /* Datei verschwunden — taucht als "entfernt" im Vergleich auf */ }
  };

  const globalMd = path.join(CLAUDE_DIR, 'CLAUDE.md');
  if (fs.existsSync(globalMd)) push(globalMd, 'regel');
  for (const p of listMarkdown(RULES_DIR, true)) push(p, 'regel');
  for (const p of listMarkdown(SKILLS_DIR, true)) if (!appVerwaltet(p)) push(p, 'skill');
  for (const p of listMarkdown(COMMANDS_DIR, true)) push(p, 'command');
  return files;
}

/** Kurzer, sprechender Name statt vollem Pfad. */
function label(file) {
  const rel = path.relative(CLAUDE_DIR, file.path).split(path.sep).join('/');
  if (file.kind === 'skill') {
    const parts = rel.split('/');
    return parts.length > 2 ? `${parts[1]} (${parts.slice(2).join('/')})` : parts[1];
  }
  return rel;
}

// ------------------------------------------------------------------- Zustand

function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Textstände der Regeldateien nach Hash: Grundlage für den Zeilen-Diff statt Volltext. */
const TEXT_DIR = path.join(STATE_DIR, 'regeltexte');

function cacheRegeln(files) {
  const heute = Date.now();
  for (const f of files) {
    if (f.kind !== 'regel') continue;
    const p = path.join(TEXT_DIR, `${f.hash}.txt`);
    if (fs.existsSync(p)) {
      /* Hält den Stand am Leben, solange ihn eine Sitzung als Grundlage braucht (sweep löscht nach 7 Tagen). */
      if (heute - fs.statSync(p).mtimeMs > 24 * 3600 * 1000) fs.utimesSync(p, new Date(), new Date());
    } else {
      fs.mkdirSync(TEXT_DIR, { recursive: true });
      fs.writeFileSync(p, f.content);
    }
  }
}

function writeState(file, files) {
  const map = {};
  for (const f of files) map[f.path] = f.hash;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    cacheRegeln(files);
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), files: map }, null, 0));
  } catch { /* Zustand ist Komfort, kein Muss — niemals den Prompt daran scheitern lassen */ }
}

/** Geänderte Zeilen zweier Fassungen (LCS): `- alt` / `+ neu`, in Dateireihenfolge. */
function zeilenDiff(alt, neu) {
  const a = alt.split('\n').map((z) => z.trimEnd());
  const b = neu.split('\n').map((z) => z.trimEnd());
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (j < b.length && (i === a.length || lcs[i][j + 1] > lcs[i + 1][j])) out.push(`+ ${b[j++]}`);
    else out.push(`- ${a[i++]}`);
  }
  return out.filter((z) => z.length > 2).join('\n');
}

/** Geänderte Regeldatei: nur die Diff-Zeilen, wenn der alte Stand bekannt und der Diff kürzer ist; sonst Volltext. */
function regelText(f, alterHash) {
  const voll = f.content.trim();
  let alt = null;
  try { alt = fs.readFileSync(path.join(TEXT_DIR, `${alterHash}.txt`), 'utf8'); } catch { /* unbekannter Stand */ }
  if (alt === null) return { voll: true, text: voll };
  const d = zeilenDiff(alt.trim(), voll);
  if (!d) return { voll: false, text: '(nur Leerraum geändert)' };
  return d.length < voll.length * 0.8 ? { voll: false, text: d } : { voll: true, text: voll };
}

function diff(previousMap, files) {
  const changed = [];
  const added = [];
  const seen = new Set();
  for (const f of files) {
    seen.add(f.path);
    if (!(f.path in previousMap)) added.push(f);
    else if (previousMap[f.path] !== f.hash) changed.push(f);
  }
  const removed = Object.keys(previousMap).filter((p) => !seen.has(p) && !appVerwaltet(p));
  return { changed, added, removed };
}

/** Entfernte Dateien als Zeilen; ein ganzer Skill-Ordner zählt als eine Zeile. */
function entferntZeilen(removed) {
  const proSkill = new Map();
  const einzeln = [];
  for (const p of removed) {
    const teile = path.relative(CLAUDE_DIR, p).split(path.sep);
    if (teile[0] === 'skills' && teile.length > 2) proSkill.set(teile[1], (proSkill.get(teile[1]) || 0) + 1);
    else einzeln.push(teile.join('/'));
  }
  const zeilen = [...proSkill].map(([n, z]) => `Skill ${n} (${z} ${z === 1 ? 'Datei' : 'Dateien'})`);
  return [...zeilen, ...einzeln];
}

/** Zustandsdateien alter Sitzungen aufräumen (älter als 7 Tage). */
function sweep() {
  try {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const name of fs.readdirSync(STATE_DIR)) {
      if (!name.startsWith('session-')) continue;
      const p = path.join(STATE_DIR, name);
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    }
    for (const name of fs.readdirSync(TEXT_DIR)) {
      const p = path.join(TEXT_DIR, name);
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    }
  } catch { /* egal */ }
}

// -------------------------------------------------------------- Betriebsarten

function onSessionStart(input, files) {
  const counts = { regel: 0, skill: 0, command: 0 };
  const skillNames = new Set();
  let ruleLines = 0;
  for (const f of files) {
    counts[f.kind]++;
    if (f.kind === 'skill') skillNames.add(label(f).split(' ')[0]);
    if (f.kind === 'regel') ruleLines += f.lines;
  }

  const out = [];
  out.push(
    `[Regelstand] ${counts.regel} Regeldateien (${ruleLines} Zeilen) automatisch geladen, ` +
    `${skillNames.size} Skills und ${counts.command} Slash-Commands verfügbar. ` +
    `Die Regeldateien in .claude/rules/ gelten ausnahmslos — sie sind bereits im Kontext, ` +
    `sie müssen nicht gelesen werden.`
  );

  const globalStateFile = path.join(STATE_DIR, 'global.json');
  const prev = readState(globalStateFile);
  if (prev && prev.files) {
    const { changed, added, removed } = diff(prev.files, files);
    const parts = [];
    for (const f of changed) parts.push(`${label(f)} (geändert)`);
    for (const f of added) parts.push(`${label(f)} (neu)`);
    for (const z of entferntZeilen(removed)) parts.push(`${z} (entfernt)`);
    if (parts.length) {
      out.push(
        `[Regelstand] Seit der letzten Sitzung geändert: ${parts.join(', ')}. ` +
        `Bei geänderten Skills gilt: vor der nächsten Nutzung neu lesen, nicht aus dem ` +
        `Gedächtnis arbeiten.`
      );
    }
  }

  /*
    **Kein Volltext mehr nach dem Kompaktieren (26.09.2026).** Hier wurden bis dahin alle Regeln
    ein zweites Mal eingespielt (56,6 KB, ~15.000 Token), mit der Begründung, nach dem Kompaktieren
    sei nur die Projekt-CLAUDE.md garantiert wieder da. Widerlegt in der Sitzung vom 25./26.09.2026:
    Claude Code spielt `.claude/rules/` nach dem Kompaktieren selbst vollständig wieder ein — die
    Regeln standen danach doppelt im Kontext. Geänderte Regeln meldet der Zweig oben weiterhin.
  */

  writeState(globalStateFile, files);
  if (input.session_id) writeState(path.join(STATE_DIR, `session-${input.session_id}.json`), files);
  sweep();
  return out.join('\n');
}

function onUserPrompt(input, files) {
  const sessionFile = path.join(
    STATE_DIR,
    `session-${input.session_id || 'unbekannt'}.json`
  );
  const prev = readState(sessionFile);
  writeState(sessionFile, files);

  // Erster Prompt einer Sitzung, deren Start der Hook nicht gesehen hat: nur merken.
  if (!prev || !prev.files) return '';

  const { changed, added, removed } = diff(prev.files, files);
  if (!changed.length && !added.length && !removed.length) return '';

  const out = [];
  const rules = [...changed, ...added].filter((f) => f.kind === 'regel');
  const others = [...changed, ...added].filter((f) => f.kind !== 'regel');

  if (rules.length) {
    out.push(
      `[Regeländerung] ${rules.length} Regeldatei(en) wurden seit dem letzten Prompt geändert. ` +
      `Ab sofort gilt die neue Fassung. Bei „(Änderung)“ stehen nur die geänderten Zeilen da ` +
      `(- vorher, + jetzt), alles andere bleibt wie im Kontext; ein Volltext ersetzt die alte Fassung:`
    );
    for (const f of rules) {
      const r = prev.files[f.path] ? regelText(f, prev.files[f.path]) : { voll: true, text: f.content.trim() };
      out.push(`\n===== ${label(f)}${r.voll ? '' : ' (Änderung)'} =====\n${r.text}`);
    }
  }

  for (const f of others) {
    out.push(
      `[Regeländerung] ${f.kind === 'skill' ? 'Skill' : 'Slash-Command'} "${label(f)}" wurde ` +
      `geändert (${f.path}). Vor der nächsten Nutzung neu lesen statt aus dem Gedächtnis ` +
      `zu arbeiten.`
    );
  }

  for (const z of entferntZeilen(removed)) out.push(`[Regeländerung] Entfernt: ${z} — gilt nicht mehr.`);

  return out.join('\n');
}

// ---------------------------------------------------------------------- Lauf

/** Liefert den Meldetext (leer, wenn nichts zu melden ist); der Bündel-Dispatcher ruft das im selben Prozess auf. */
function lauf(input, mode) {
  const files = collect();
  return mode === 'SessionStart' ? onSessionStart(input, files) : onUserPrompt(input, files);
}

module.exports = { lauf, zeilenDiff, regelText };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', () => {
    try {
      let input = {};
      try {
        input = JSON.parse(buf || '{}');
      } catch { /* ohne Eingabe trotzdem arbeiten */ }
      const text = lauf(input, process.argv[2] || input.hook_event_name || 'UserPromptSubmit');
      if (text) process.stdout.write(text + '\n');
    } catch (err) {
      // Ein kaputter Wächter darf niemals einen Prompt blockieren.
      process.stderr.write('watch.js: ' + err.message + '\n');
    }
    process.exit(0);
  });
}
