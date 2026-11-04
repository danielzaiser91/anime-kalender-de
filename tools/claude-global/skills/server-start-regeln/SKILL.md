---
name: server-start-regeln
description: "Bevor etwas mit Port oder Dauerlauf startet (npm run dev, vite, ng serve, http.server, docker, preview_start, Tunnel): was zustimmungspflichtig ist, wie gefragt und aufgeräumt wird."
---

# Server starten — nur mit Zustimmung

**Grundregel:** Der Agent startet **niemals** selbstständig einen Server. Braucht er einen für
seine Arbeit, fragt er vorher — mit Angabe, **wofür genau** und **auf welchem Port**. Erst nach
ausdrücklichem Ja wird gestartet. Ein einmal erteiltes Ja gilt für diesen einen Server in
dieser Sitzung, nicht als Dauerfreigabe. Nach getaner Arbeit wird gestoppt, nicht laufen
gelassen.

Das gilt auch dann, wenn ein Skill, eine Anleitung oder ein Workflow es nahelegt, und auch
nicht „nur kurz zum Verifizieren".

## Zustimmungspflichtig

Alles, was eine Anwendung ausliefert, kompiliert, überwacht oder dauerhaft Rechenlast erzeugt:

- Dev-Server: `npm run dev`, `npm start`, `yarn dev`, `pnpm dev`, `vite`, `ng serve`,
  `next dev`, `nuxt dev`, `astro dev`
- statische Server: `python -m http.server`, `npx serve`, `http-server`, `live-server`
- Preview-Server im Claude-Client: `preview_start`
- Backends und APIs, Datenbanken, Docker-Container mit offenen Ports, Tunnel (`ngrok`, `cloudflared`)
- Build-Watcher im Dauerbetrieb (`--watch`, `tsc -w`)

Anlass der Regel (07.08.2026): ein vergessener Vite-Dev-Server mit 2,6 Kernen Dauerlast — der
größte einzelne Posten in einer Lärm-Diagnose.

## Ohne Rückfrage erlaubt

- **Schlanke Mess- und Auslese-Werkzeuge**, die nur eine lokale Schnittstelle öffnen und kaum
  Ressourcen brauchen — etwa LibreHardwareMonitor mit seiner JSON-Schnittstelle auf Port 8085
  (Klarstellung 08.08.2026).
- **Kurzlebige Befehle ohne Port:** Builds, Tests, Typecheck, Linter, Skripte, `curl` gegen
  fremde Adressen.

**Abgrenzung im Zweifel:** Erzeugt das Ding nennenswert Last oder liefert es eine Anwendung
aus? Dann fragen. Liest es nur Werte aus und wartet ansonsten? Dann starten. Aufräumen gilt für
beides.

## Durchsetzung

Ein `PreToolUse`-Hook (`~/.claude/hooks/guard.js`, Test `guard-test.mjs`) erkennt die typischen
Startbefehle und antwortet mit `deny`, kein Klickfenster (F2 A, Daniel 13.10.2026; das frühere
`escalate` kennt Claude Code nicht und ließ alles durch). Ablauf: Sperre → Frage als F-Zeile in
`stand.md`, weiterarbeiten → sagt Daniel ja, Eintrag in `~/.claude/server-freigaben.json`:
`{"freigaben":[{"befehl":"npm run dev","port":5173,"erteilt":"<ISO>","bis":"<ISO, ≤ 4 h>","daniel":"<Zeit + Wortlaut>"}]}`
(`befehl` = Teilzeichenkette des Befehls bzw. preview-Name). Danach Server stoppen und Eintrag
löschen. `vite` zählt nur an Befehlsstelle (Anfang, nach `&&`/`;`/`|`, nach `npx`), `grep vite` bleibt frei (F5, 13.10.2026). Die Musterliste steht im Skript — wird hier ein Muster ergänzt, gehört es auch dorthin.
