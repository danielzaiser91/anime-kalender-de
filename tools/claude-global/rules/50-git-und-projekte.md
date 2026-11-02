# Git und Projekte

**Auto-Commit & Push** nach verifizierter Änderung, ungefragt — außer Daniel sagt im Einzelfall
anders. Kein Force-Push auf main, kein `--no-verify`, kleine Commits, vorher `git status` und
Diff ansehen.

**Neues Repo mit mehr als ~1 h echter Arbeit** → `TODO.md` mit dem Hinweis, es ins Portfolio
einzutragen (`C:\code\ai\my website\src\app\data\projects.ts`); kein Sofort-Eintrag.

**`status.md` je Projekt** mit Warteschlange („In Arbeit" > „Queue" > „Zu besprechen" > „Warten
auf Feedback"), Erledigtes sofort ins Archiv; ohne Projekt `C:\code\ai\status-<session-id>.md`.

**Zeilenenden LF** per `.gitattributes` (`* text=auto eol=lf`, CRLF für `*.bat`, `*.cmd`,
`*.ps1`); fehlt sie, als eigener Commit mit `git add --renormalize .`. Nie nebenbei Zeilenenden
einer Datei umstellen.

Projektspezifische Regeln stehen in der jeweiligen `CLAUDE.md`.
