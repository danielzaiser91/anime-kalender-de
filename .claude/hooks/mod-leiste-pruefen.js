#!/usr/bin/env node
/**
 * SessionStart: Kind-Sitzungen (Resume, Kompaktieren) starten mit leerem CLAUDE_CODE_PLUGIN_DIRS,
 * die Mod `arbeitsliste` fehlt dann unbemerkt (10.11., 16.11., 17.11.2026). Der Hook hängt sie über
 * eine Junction in dev-mods/<session_id> ein und stößt die Ordnerüberwachung per touch an.
 * Fehler bleiben still (Exit 0).
 */
const fs = require('fs');
const path = require('path');

const MELDUNG =
  'Mod-Leiste fehlt (Kind-Sitzung): Junction gesetzt — jetzt Skill plugin-authoring laden, dann erscheint die Leiste am Turnende.';

function einhaengen(sessionId, env) {
  const home = env.USERPROFILE || env.HOME || '';
  const basis = env.MOD_LEISTE_DEVMODS || path.join(home, '.claude', 'dev-mods');
  const projekt = env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
  const quelle = path.join(projekt, '.claude', 'mods', 'arbeitsliste');
  const ziel = path.join(basis, sessionId, 'arbeitsliste');
  if (!fs.existsSync(quelle)) return false;
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  let vorhanden = false;
  try {
    fs.lstatSync(ziel);
    vorhanden = true;
  } catch {
    /* fehlt: anlegen */
  }
  if (!vorhanden) fs.symlinkSync(quelle, ziel, 'junction');
  const manifest = path.join(quelle, '.claude-plugin', 'plugin.json');
  const jetzt = new Date();
  fs.utimesSync(manifest, jetzt, jetzt);
  return true;
}

/** Liefert die Meldung oder '' (Variable gesetzt, keine session_id, Fehler). */
function pruefen(eingabe, env) {
  if (env.CLAUDE_CODE_PLUGIN_DIRS) return '';
  try {
    const id = JSON.parse(eingabe || '{}').session_id;
    if (!id || /[\\/]|\.\./.test(String(id))) return '';
    return einhaengen(String(id), env) ? MELDUNG : '';
  } catch {
    return '';
  }
}

module.exports = { pruefen, MELDUNG };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => {
    buf += c;
  });
  process.stdin.on('end', () => {
    const text = pruefen(buf, process.env);
    if (text) process.stdout.write(text + '\n');
    process.exit(0);
  });
}
