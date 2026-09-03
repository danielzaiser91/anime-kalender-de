#!/usr/bin/env node
/**
 * **Der Befund der Wache gehört ins Repo, nicht in einen Chat.**
 *
 * Daniel am 03.09.2026: „im chat soll nix stehen, das ergebnis soll als file ins
 * repo." Das ist mehr als eine Ablageentscheidung: Eine Meldung im Gespräch ist
 * beim nächsten Start weg, eine Datei im Repo steht auch in drei Monaten noch da
 * — mit Datum, mit Vorgeschichte, und für jeden lesbar, der das Projekt öffnet.
 *
 * Geschrieben wird `daniel-zum-abarbeiten/00-wache.md`: oben der jüngste Lauf im
 * Klartext, darunter ein Tagebuch mit einer Zeile je Tag. Die `00` sorgt dafür,
 * dass die Datei in der Ordneransicht ganz oben steht — sie ist die Übersicht
 * über alles Übrige darin.
 *
 * **Das Tagebuch wird nicht länger als nötig.** Es hält die letzten sechzig
 * Zeilen; was älter ist, hat seinen Zweck erfüllt. Eine Datei, die jeden Tag um
 * eine Zeile wächst, liest nach einem Jahr niemand mehr.
 *
 * Aufruf (im Workflow):
 *
 *     node tools/wache-schreiben.mjs <delta-ausgabe> <briefkasten-ausgabe> <befund|ok>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [deltaDatei, kastenDatei, lage] = process.argv.slice(2)
const ZIEL = 'daniel-zum-abarbeiten/00-wache.md'
const HOECHSTENS = 60

const lies = (p) => (p && existsSync(p) ? readFileSync(p, 'utf8').trimEnd() : '(keine Ausgabe)')
const delta = lies(deltaDatei)
const kasten = lies(kastenDatei)
const befund = lage === 'befund'

const jetzt = new Date()
const tag = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(jetzt)
const uhr = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(jetzt)

/*
  Die Kennzahlen aus der Delta-Ausgabe, damit die Tagebuchzeile für sich steht.
  Findet sich die Zeile nicht, bleibt der Strich — besser als eine erfundene
  Zahl.
*/
const stand = /Stand jetzt: (\d+) Titel, (\d+) Urteile, (\d+) offen/.exec(delta)
const zahlen = stand ? `${stand[1]} / ${stand[2]} / ${stand[3]}` : '—'
const spanne = /Über den Zeitraum: (.+)/.exec(delta)?.[1] ?? ''

/* Die Warnzeilen im Klartext — sie sind der Grund, warum jemand hier nachsieht. */
const warnungen = [...delta.matchAll(/⚠\s+(.+)/g), ...kasten.matchAll(/⚠\s+(.+)/g)]
  .map((m) => m[1].trim())
  .filter((t) => !/Lauf\/Läufe mit Auffälligkeiten/.test(t))

const zeile = `| ${tag} ${uhr} | ${zahlen} | ${spanne || '—'} | ${
  befund ? warnungen.slice(0, 2).join('; ') || 'Auffälligkeit' : 'unauffällig'
} |`

/* Bestehende Tagebuchzeilen retten, bevor die Datei neu geschrieben wird. */
let alt = []
if (existsSync(ZIEL)) {
  alt = readFileSync(ZIEL, 'utf8')
    .split('\n')
    .filter((z) => /^\| \d{2}\.\d{2}\.\d{4} /.test(z))
}

const inhalt = `# Wache — Bestand und Briefkasten

**${befund ? '⚠ Auffälligkeit' : 'Unauffällig'}** · zuletzt ${tag} um ${uhr} Uhr

Diese Datei schreibt der Workflow [\`delta-wache.yml\`](../.github/workflows/delta-wache.yml),
täglich um 09:20 Uhr. Sie lief bis zum 03.09.2026 als Routine auf Daniels
Rechner; seitdem läuft sie auf GitHub und legt ihr Ergebnis hier ab statt es zu
melden.

**Wozu sie da ist:** Am 26.08.2026 gingen an einem Abend zweimal Meldungen aus
der Browser-Erweiterung verloren, ohne dass ein Lauf rot wurde — 508
Disney-Meldungen wurden zu einem einzigen Eintrag abgehakt, 216
One-Piece-Meldungen verschwanden ganz. Gefunden hat es Daniel, weil ihm eine Zahl
komisch vorkam. Das soll ihm keiner mehr abverlangen.
${
  warnungen.length
    ? `\n## Was aufgefallen ist\n\n${warnungen.map((w) => `- ${w}`).join('\n')}\n`
    : ''
}
## Bestand — die letzten 24 Stunden

\`\`\`
${delta}
\`\`\`

## Briefkasten

\`\`\`
${kasten}
\`\`\`

## Tagebuch

Die letzten ${HOECHSTENS} Läufe. Älteres hat seinen Zweck erfüllt.

| Zeitpunkt | Titel / Urteile / offen | Veränderung | Befund |
|---|---|---|---|
${[zeile, ...alt].slice(0, HOECHSTENS).join('\n')}
`

mkdirSync(dirname(ZIEL), { recursive: true })
writeFileSync(ZIEL, inhalt)
console.log(`${ZIEL} geschrieben — ${befund ? 'mit Befund' : 'unauffällig'}`)
