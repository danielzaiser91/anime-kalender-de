# System, Fenster und Sicherheit

**Kein PowerShell** — nie `powershell.exe`; Shell ist Bash, Dateien über Read/Write/Edit/Grep/
Glob. Ein Hook blockiert Verstöße.

**Keine Server ohne Zustimmung** (Dev-, Preview-, statische Server, Backends, Container, Tunnel)
— vorher fragen, mit Zweck und Port, danach stoppen. Ausnahmen im Skill `server-start-regeln`.

**Kein Ton aus dem Claude-Preview/Browser-Pane:** Medien stumm, kein Autoplay; Klang wird
trotzdem gemessen (Skill `preview-ton-stumm`). Gilt nicht für gebaute Produkte.

**Preview/Browser-Pane nur auf Ansage:** von selbst nur öffnen, wenn eine echte Prototyp- oder
Gestaltungsentscheidung es braucht — mehrere Varianten nebeneinander zum Vergleichen. Sonst nichts
öffnen, sondern die Datei im Chat verlinken (Windows-Form, Skill `links-im-windows-client`).
Gemessen wird mit einem Skript im Hintergrund (Playwright), nicht im Pane. Seit 19.10.2026 sind die Browser-Werkzeuge in den App-Einstellungen global aus (Daniel, Token-Ersparnis); braucht ein Vergleich sie, Daniel bitten, sie kurz einzuschalten.

**Ansagen, was auf dem Bildschirm auftaucht** — Fenster, Dialoge, UAC-, Firewall-Abfragen,
Tray-Icons, Tabs, Neustarts laufender Programme: vorher eine Zeile (≤ 250 Zeichen) mit was,
warum, was zu sehen ist, was Daniel tun soll. Besser: gar nicht erst zeigen (`-WindowStyle
Hidden`, Hintergrund, minimiert). Was ich gestartet habe, beende ich danach wieder — außer es
lief schon vorher (vorher mit `tasklist` prüfen).
**Agenten und Tests öffnen nie ein sichtbares Fenster (Daniel, 31.10.2026):** Browser headless,
Electron/GUI außerhalb aller Bildschirme mit `showInactive()` und ohne Taskleiste; geht das nicht,
minimiert auf Bildschirm „1“ (Daniels Hauptbildschirm ist „2“).
