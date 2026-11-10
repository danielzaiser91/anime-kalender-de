#!/usr/bin/env node
/**
 * **Posteingang: was passiert ist, während niemand zugesehen hat.**
 *
 * Daniel am 20.09.2026: „das könnte eine generische lösung für alles werden was asynchron
 * passiert, und du normalerweise nicht mitbekommst, eine zentrale stelle an die eine datei mit
 * meldungen steht, die du liest wenn ein flag true gesetzt wird."
 *
 * Anlass war ein Riegel in der Terminableitung, der 264 Serien verwarf, ohne dass es irgendwo
 * auffiel — gemerkt hat es ein Nutzer. Eine Datei allein löst das nicht: Sie muss jemandem
 * unter die Augen kommen. Dieser Hook ist dieser Jemand.
 *
 * **Wie es funktioniert.** Jedes Projekt (und jedes lokale Skript) hängt Zeilen an eine
 * JSONL-Datei:
 *
 *     C:/code/ai/<projekt>/data/meldungen-an-claude.jsonl     (von Läufen mitcommittet)
 *     C:/code/ai/__assets/meldungen/posteingang.jsonl         (lokale Skripte, Hooks)
 *
 * Eine Zeile ist ein JSON-Objekt: `{ "am": "2026-09-20T11:12:00Z", "quelle": "bestand-bauen",
 * "schwere": "hinweis|warnung", "text": "…", "datei": "data/…json" }`. Der Hook merkt sich den Inhalt
 * jeder gemeldeten Zeile (nicht Datei und Zeilenzahl) und nennt beim nächsten Prompt nur unbekannte.
 *
 * Gemeldet wird knapp: Zahl, Quelle, Text. Wer mehr braucht, liest die Datei — der Pfad steht
 * dabei. Nichts hier blockiert je einen Prompt; ein Fehler bleibt still.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const STATE = path.join(HOME, '.claude', 'hooks', 'state', 'posteingang.json');
const WURZEL = 'C:/code/ai';
const HOECHSTENS = 12;

/** Alle Posteingänge: der gemeinsame plus je Projekt einer. Worktrees (`_wt…`, `_agent…`, oder
 *  Ordner, deren `.git` eine Datei ist) sind Kopien von main und keine eigene Quelle. */
function quellen(wurzel) {
  const raus = [path.join(wurzel, '__assets', 'meldungen', 'posteingang.jsonl')];
  let eintraege = [];
  try {
    eintraege = fs.readdirSync(wurzel, { withFileTypes: true });
  } catch {
    return raus;
  }
  for (const e of eintraege) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    try {
      if (fs.statSync(path.join(wurzel, e.name, '.git')).isFile()) continue;
    } catch {
      /* ohne .git: trotzdem eine mögliche Quelle */
    }
    raus.push(path.join(wurzel, e.name, 'data', 'meldungen-an-claude.jsonl'));
  }
  return raus;
}

/** Eine Meldung gilt über ihren Inhalt als gesehen, nicht über Datei und Zeilennummer. */
const kennung = (zeile) => crypto.createHash('sha1').update(zeile).digest('hex').slice(0, 12);

function lies(datei) {
  try {
    return fs
      .readFileSync(datei, 'utf8')
      .split('\n')
      .map((z) => z.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function standLesen(datei) {
  try {
    return JSON.parse(fs.readFileSync(datei, 'utf8'));
  } catch {
    return {};
  }
}

function standSchreiben(datei, stand) {
  try {
    fs.mkdirSync(path.dirname(datei), { recursive: true });
    fs.writeFileSync(datei, JSON.stringify(stand) + '\n');
  } catch {
    /* Ohne Merker meldet der nächste Lauf dieselben Zeilen — lästig, nicht schlimm. */
  }
}

/** `opt.wurzel` / `opt.state` nur für den Test. Der Merker hält die Kennungen der aktuell
 *  vorhandenen Zeilen; Verschwundenes fällt heraus. Ohne Merker (Erstlauf) wird still angelegt. */
function main(opt = {}) {
  const stateDatei = opt.state ?? STATE;
  const stand = standLesen(stateDatei);
  const erstlauf = !Array.isArray(stand.gesehen);
  const gesehen = new Set(erstlauf ? [] : stand.gesehen);
  const vorhanden = new Set();
  const neue = [];
  for (const datei of quellen(opt.wurzel ?? WURZEL)) {
    for (const z of lies(datei) ?? []) {
      const id = kennung(z);
      if (vorhanden.has(id)) continue;
      vorhanden.add(id);
      if (gesehen.has(id)) continue;
      try {
        neue.push({ datei, ...JSON.parse(z) });
      } catch {
        neue.push({ datei, text: z });
      }
    }
  }
  standSchreiben(stateDatei, { gesehen: [...vorhanden] });
  if (erstlauf || !neue.length) return '';

  const zeilen = neue.slice(0, HOECHSTENS).map((m) => {
    const wann = String(m.am ?? '').slice(0, 16).replace('T', ' ');
    const marke = m.schwere === 'warnung' ? '⚠' : '·';
    return `  ${marke} ${wann} ${m.quelle ? `[${m.quelle}] ` : ''}${m.text}${m.datei2 ? ` → ${m.datei2}` : ''}`;
  });
  const rest = neue.length > HOECHSTENS ? `\n  … und ${neue.length - HOECHSTENS} weitere` : '';
  const dateien = [...new Set(neue.map((m) => m.datei))].join(', ');
  return (
    `[Posteingang] ${neue.length} neue Meldung(en) aus Läufen, die ohne mich passiert sind:\n` +
    zeilen.join('\n') +
    rest +
    `\nQuelle: ${dateien} — bei Bedarf dort nachlesen, sonst nichts weiter tun.`
  );
}

module.exports = { lauf: main };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => {
    buf += c;
  });
  process.stdin.on('end', () => {
    try {
      const text = main();
      if (text) process.stdout.write(text + '\n');
    } catch (err) {
      process.stderr.write('posteingang.js: ' + err.message + '\n');
    }
    process.exit(0);
  });
}
