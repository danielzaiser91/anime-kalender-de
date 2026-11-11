#!/usr/bin/env node
/**
 * PreToolUse-Wächter: die Regeln, die nicht auf Mitwirkung des Modells angewiesen
 * sein dürfen.
 *
 *   1. Kein PowerShell            → deny   (Regel 30-system-und-sicherheit.md)
 *   2. Keine Server ohne Zustimmung → deny, außer eine gültige Freigabe in
 *      ~/.claude/server-freigaben.json passt (Daniel, F2 A, 13.10.2026: kein Klickfenster,
 *      das den autonomen Modus anhält; „escalate“ kennt Claude Code nicht und ließ alles durch)
 *   3. Inline-Code mit Backslash an python/node (Heredoc, -c, -e) → deny (Rückfall-Register;
 *      Test: node .claude/hooks/guard-test.mjs)
 *
 * Laut Doku ist ein PreToolUse-Hook die einzige Ebene mit echter Durchsetzung:
 * "To block an action regardless of what Claude decides, use a PreToolUse hook instead."
 *
 * Ausgabeformat:
 *   {"hookSpecificOutput":{"hookEventName":"PreToolUse",
 *     "permissionDecision":"allow|deny","permissionDecisionReason":"..."}}
 * Ohne Ausgabe passiert nichts — der normale Erlaubnisweg läuft weiter.
 */

const POWERSHELL = /(^|[\s;&|(`"'])(powershell(\.exe)?|pwsh(\.exe)?)\b/i;

/** Befehle, die einen Server oder Dauerprozess starten. Bewusst konservativ. */
const SERVER_PATTERNS = [
  /\bnpm\s+(run\s+)?(dev|start|serve|preview)\b/i,
  /\b(yarn|pnpm|bun)\s+(run\s+)?(dev|start|serve|preview)\b/i,
  /\bnpx\s+(serve|http-server|live-server|nodemon)\b/i,
  // "vite" nur an Befehlsstelle (nicht in grep/cat-Argumenten) und ohne Unterbefehl, der gar keinen Server startet
  /(^|[;&|(]\s*|\bnpx\s+)vite\b(?!\s+(build|optimize|--version|-v\b))/m,
  /\bng\s+serve\b/i,
  /\bnext\s+(dev|start)\b/i,
  /\b(nuxt|astro|remix|svelte-kit)\s+dev\b/i,
  /\bpython3?\s+-m\s+(http\.server|SimpleHTTPServer)\b/i,
  /\bphp\s+-S\b/i,
  /\b(flask\s+run|uvicorn|gunicorn|daphne)\b/i,
  /\brails\s+s(erver)?\b/i,
  /\b(jekyll|hugo)\s+serve(r)?\b/i,
  /\bdocker(\s+compose)?\s+(up|run|start)\b/i,
  /\b(ngrok|cloudflared|localtunnel|lt)\s+(http|tunnel)\b/i,
  /\bnodemon\b/i,
  /\btsc\b[^\n]*\s(-w|--watch)\b/i,
];

function decide(input) {
  const tool = input.tool_name || '';
  const args = input.tool_input || {};

  // --- 1. PowerShell -------------------------------------------------------
  if (tool === 'PowerShell') {
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Regel „Kein PowerShell" (.claude/rules/30-system-und-sicherheit.md): ' +
        'PowerShell wird nicht aufgerufen. Für Shell-Operationen das Bash-Werkzeug, ' +
        'für Dateizugriffe Read/Write/Edit/Grep/Glob.',
    };
  }
  const command = typeof args.command === 'string' ? args.command : '';
  if (command && POWERSHELL.test(command)) {
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Regel „Kein PowerShell" (.claude/rules/30-system-und-sicherheit.md): ' +
        'Der Befehl ruft powershell.exe/pwsh auf. Stattdessen in Bash lösen.',
    };
  }

  // --- 2. Server -----------------------------------------------------------
  // preview_start mit "url" öffnet nur einen Browser-Tab; nur "name" startet einen Server.
  if (tool.endsWith('preview_start') && args.name) {
    if (freigabe(args.name)) return null;
    return serverSperre(`preview_start würde den Dev-Server „${args.name}" starten.`);
  }
  if (command && SERVER_PATTERNS.some((re) => re.test(command))) {
    if (freigabe(command)) return null;
    return serverSperre('Der Befehl startet einen Server oder Dauerprozess.');
  }

  // --- 2b. TZ=<Region>/<Stadt> in Git Bash ---------------------------------
  // Git Bash hat keine zoneinfo: `TZ=Europe/Berlin date` rechnet still in UTC (12.10. und
  // 24.10.2026 je eine falsche Uhrzeit in stand.md; die Learnings-Zeile allein trug nicht).
  if (command && tool === 'Bash' && /(^|[\s;&|(])TZ=["']?[A-Za-z]+\/[A-Za-z_]+/.test(command)) {
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'TZ=<Region>/<Stadt> wirkt in Git Bash nicht (keine zoneinfo, Ergebnis still UTC). ' +
        "Ortszeit mit Node umrechnen: new Date(x).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' }) in einem Skript.",
    };
  }

  // --- 3. Inline-Code mit Backslash an python/node --------------------------
  // Rückfall-Register: viermal (23.08., 18.09.) hat die Shell Backslashes in einem Heredoc
  // oder `python -c` verändert — `\n` fand die Stelle nicht, `\\n` wurde zum echten
  // Zeilenumbruch in einer Quelldatei. Die schriftliche Regel („Patch-Skripte nie per
  // Heredoc“) hat nicht getragen, deshalb steht sie hier. Freigabe: Daniel, 18.09.2026 15:32.
  // Ohne Backslash bleibt Inline-Code erlaubt.
  if (command && tool === 'Bash') {
    const befund = inlineCodeMitBackslash(command);
    if (befund) {
      return {
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Regel „Patch-Skripte nie per Heredoc“ (Rückfall-Register): ${befund} enthält einen ` +
          'Backslash, den die Shell verändern kann. Den Code mit dem Write-Werkzeug in eine ' +
          'Datei (Scratchpad) schreiben und die Datei ausführen.',
      };
    }
  }

  return null;
}

const FREIGABEN = process.env.GUARD_FREIGABEN || require('path').join(require('os').homedir(), '.claude', 'server-freigaben.json');
const VIER_STUNDEN = 4 * 3600 * 1000;

/**
 * Gültige Freigabe: `befehl` steht im Befehl (bzw. ist der preview-Name), `bis` liegt in der
 * Zukunft und höchstens 4 h nach `erteilt` — eine Freigabe läuft immer von selbst ab.
 */
function freigabe(ziel) {
  let liste;
  try {
    liste = JSON.parse(require('fs').readFileSync(FREIGABEN, 'utf8')).freigaben || [];
  } catch {
    return false;
  }
  const jetzt = Date.now();
  return liste.some((f) => {
    const bis = Date.parse(f.bis);
    return typeof f.befehl === 'string' && f.befehl && ziel.includes(f.befehl) &&
      jetzt < bis && bis - Date.parse(f.erteilt) <= VIER_STUNDEN;
  });
}

function serverSperre(was) {
  return {
    permissionDecision: 'deny',
    permissionDecisionReason:
      'Regel „Keine Server ohne Zustimmung" (Skill server-start-regeln): ' + was + ' Nicht ' +
      'starten, sondern die Frage (wofür, welcher Port) als F-Zeile in stand.md eintragen und ' +
      'an anderem weiterarbeiten. Sagt Daniel ja, einen Eintrag {befehl, port, erteilt, bis ' +
      '(≤ 4 h), daniel} in ~/.claude/server-freigaben.json schreiben.',
  };
}

// Nur als Befehl, nicht als Teil eines Dateinamens: „p_reg.py <<'EOF'“ ist ein cat-Heredoc
// (erster Fehlalarm, 18.09.2026 15:36).
const INTERPRETER = String.raw`(?:^|[\s;&|(])(?:python3?|py|node)(?:\.exe)?(?=\s)`;

/** Liefert eine Beschreibung, wenn Code per Heredoc oder -c/-e mit Backslash übergeben wird. */
function inlineCodeMitBackslash(command) {
  // Heredoc: python - <<'EOF' … EOF  (auch <<-, ohne Anführungszeichen)
  const heredoc = new RegExp(String.raw`${INTERPRETER}[^\n]*?<<-?\s*(['"]?)(\w+)\1[^\n]*\n`, 'g');
  let m;
  while ((m = heredoc.exec(command))) {
    const start = m.index + m[0].length;
    const ende = command.slice(start).search(new RegExp(String.raw`^\s*${m[2]}\s*$`, 'm'));
    const koerper = ende === -1 ? command.slice(start) : command.slice(start, start + ende);
    if (koerper.includes('\\')) return 'Ein Heredoc an python/node';
  }
  // `cat > skript.mjs <<'EOF'` mit Backslash (22.09.2026, dreimal an einem Nachmittag): Die Shell
  // lässt ihn im gequoteten Heredoc zwar stehen, aber ein Patch-Skript trägt ihn fast immer in
  // einem Template-Literal weiter, und dort wird `\s` zu `s`. Die schriftliche Regel („kein
  // cat > … <<'EOF', auch nicht für Node“) stand seit dem 12.09.2026 da und hat nicht getragen.
  const skriptHeredoc = /\bcat\s*>\s*\S+\.(?:m?js|cjs|ts|py)\s*<<-?\s*(['"]?)(\w+)\1[^\n]*\n/g;
  while ((m = skriptHeredoc.exec(command))) {
    const start = m.index + m[0].length;
    const ende = command.slice(start).search(new RegExp(String.raw`^\s*${m[2]}\s*$`, 'm'));
    const koerper = ende === -1 ? command.slice(start) : command.slice(start, start + ende);
    if (koerper.includes('\\')) return 'Ein Heredoc, der ein Skript schreibt,';
  }
  // -c "…" / -e '…' / --eval "…"
  const inline = new RegExp(String.raw`${INTERPRETER}[^\n|;&]*?\s(?:-c|-e|--eval|-p)\s+(["'])([\s\S]*?)\1`, 'g');
  while ((m = inline.exec(command))) {
    if (m[2].includes('\\')) return 'Der Code nach -c/-e';
  }
  return null;
}

module.exports = { decide };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(buf || '{}');
      const decision = decide(input);
      if (decision) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: Object.assign({ hookEventName: 'PreToolUse' }, decision),
          }) + '\n'
        );
      }
    } catch (err) {
      // Ein kaputter Wächter darf keine Arbeit blockieren: still durchlassen.
      process.stderr.write('guard.js: ' + err.message + '\n');
    }
    process.exit(0);
  });
}
