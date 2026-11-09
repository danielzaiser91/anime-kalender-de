# Git und Projekte

**Auto-Commit & Push:** Nach Abschluss einer Änderung (Fix oder Feature verifiziert)
automatisch committen und pushen, ohne vorher nachzufragen — es sei denn, Daniel weist im
konkreten Fall etwas anderes an („nicht pushen", „erst review", „noch nicht committen").
Normale Git-Sicherheitsregeln bleiben unangetastet: keine Force-Pushes auf main/master, kein
`--no-verify`, kleine fokussierte Commits, `git status` und Diff-Review vor dem Stagen.

**Neues Repo → Portfolio-TODO:** Sobald in ein neues, eigenständiges GitHub-Repo von Daniel
spürbar Arbeitszeit geflossen ist (Faustregel: mehr als ~1 Stunde reale Arbeit — mehrere echte
Commits/Features, kein leeres Gerüst mehr), im Wurzelverzeichnis dieses Repos ein `TODO.md`
anlegen oder ergänzen: „Projekt ins Portfolio eintragen, sobald sinnvoll (öffentlich, stabil
genug für eine kuratierte Beschreibung) — siehe Projects-Daten des Portfolio-Projekts." Kein automatischer Sofort-Eintrag ins Portfolio,
nur der Reminder; Timing, Kategorie (serious/fun) und Texte bleiben eine bewusste Entscheidung.

**Projekt-Statusdatei:** Jedes Projekt hat ein `status.md` mit einer Aufgaben-Warteschlange
(„In Arbeit" > „Queue" > „Zu besprechen" > „Warten auf Feedback"); Erledigtes wandert sofort
ins Archiv. Läuft die Arbeit ohne Projektordner, wird `status-<session-id>.md` im globalen
Ordner `C:\code\ai` geführt. Der Footer zählt aus diesen Dateien.

**Zeilenenden: LF, festgelegt per `.gitattributes`.** Jedes Repo bekommt eine `.gitattributes`
mit `* text=auto eol=lf` und CRLF-Ausnahmen für `*.bat`, `*.cmd`, `*.ps1` — nicht über
`core.autocrlf`, denn die Datei wird mitgeklont und gilt damit für jeden, eine
Rechner-Einstellung nicht. Fehlt sie in einem Repo, das ohnehin gerade angefasst wird: anlegen,
einmalig `git add --renormalize .`, als **eigener** Commit. Niemals nebenbei die Zeilenenden
einer Datei umstellen — ein Werkzeug, das CRLF zu LF macht, erzeugt einen Diff über die ganze
Datei und macht `git blame` für sie unbrauchbar (real passiert mit `sed -i`, 12.08.2026).

**Neue projektspezifische Regeln** stehen in der jeweiligen `CLAUDE.md` im Projektordner, nicht
hier.
