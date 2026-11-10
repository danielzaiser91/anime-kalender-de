#!/usr/bin/env node
/**
 * InstructionsLoaded-Protokoll: hält fest, welche Anweisungsdatei wann und aus welchem
 * Grund geladen wurde. Reine Buchführung — Ausgabe und Exit-Code werden ignoriert.
 *
 * Zweck: der Nachweis, dass die Regeln wirklich geladen werden, statt es anzunehmen.
 * Nachsehen mit:  tail -n 20 ~/.claude/hooks/state/instructions.log
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const LOG = path.join(HOME, '.claude', 'hooks', 'state', 'instructions.log');
const MAX_BYTES = 256 * 1024;

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { buf += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(buf || '{}');
    const file = input.file_path || '?';
    // file_content wird nicht immer mitgeliefert — dann keine Zeilenzahl erfinden.
    const size = input.file_content ? `${input.file_content.split('\n').length} Zeilen` : '-';
    // agent_type ist nur gesetzt, wenn der Hook in einem Subagenten läuft — genau daran
    // lässt sich ablesen, ob die Regeln auch dort ankommen.
    const wer = input.agent_type ? `agent=${input.agent_type}` : 'agent=main';
    const line =
      `${new Date().toISOString()}\t${input.load_reason || '?'}\t${size}\t${file}\t` +
      `session=${(input.session_id || '?').slice(0, 8)}\t${wer}\n`;
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    try {
      if (fs.statSync(LOG).size > MAX_BYTES) fs.renameSync(LOG, LOG + '.1');
    } catch { /* noch keine Datei */ }
    fs.appendFileSync(LOG, line);
  } catch { /* Protokoll ist Komfort, nie kritisch */ }
  process.exit(0);
});
