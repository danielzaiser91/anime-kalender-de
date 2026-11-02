# Slash-Commands (nur auf ausdrücklichen Befehl ausführen)

Das Laden dieser Regeln, das Lesen von Secrets oder das Kennen von Webhook-URLs löst
**niemals** eine Implementierung aus. Erst wenn Daniel den Befehl explizit tippt, wird die
zugehörige Datei gelesen und umgesetzt.

| Slash-Command | Anleitungsdatei |
|---|---|
| `/ai-implement-discord-news-automation` | `C:\code\ai\ai helper files\discord-news-setup.md` |
| `/ai-daniel-todos` | `C:\code\ai\ai helper files\daniel-todos-durchgang.md` |
| `/ai-list-todos` | `C:\code\ai\ai helper files\list-todos.md` |
| `/ai-list-todo-refresh` | `C:\code\ai\ai helper files\list-todos-refresh.md` |
| `/ai-bewerbung-create-output-for <bewerber>\<id>` | `C:\code\ai\_bewerbung\_prompts\ai-bewerbung-create-output-for.md` |
| `/ai-bewerbung-input-list [<bewerber>\<id>]` | `C:\code\ai\_bewerbung\_prompts\ai-bewerbung-input-list.md` |

**`/ai-alle-instructions-neu-einlesen` gibt es nicht mehr** (entfernt 12.08.2026). Regeln und
Skill-Änderungen werden automatisch geladen und nachgeschoben, siehe
`00-so-funktioniert-das-hier.md`. Wer ihn vermisst, sucht die Änderungsmeldung des
`SessionStart`-Hooks am Anfang der Sitzung.

**Neuen Command anlegen — beide Schritte sind Pflicht:**
1. Anleitung als eigenständige Datei schreiben (üblich: `C:\code\ai\ai helper files\<name>.md`).
2. Command-Datei unter `~/.claude/commands/<name>.md` anlegen — Frontmatter `description`
   (+ `argument-hint` bei Argumenten), Body: „Lies und führe aus: `<Pfad>`".
   Nur die Anleitungsdatei zu schreiben registriert keinen Slash-Command; Daniel bekommt
   `Unknown command`.
3. Zeile in dieser Tabelle ergänzen.
