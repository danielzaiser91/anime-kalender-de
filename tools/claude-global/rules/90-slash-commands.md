# Slash-Commands (nur auf ausdrücklichen Befehl)

Nur wenn Daniel den Befehl tippt, wird die Anleitungsdatei gelesen und ausgeführt.

| Slash-Command | Anleitungsdatei |
|---|---|
| `/ai-implement-discord-news-automation` | `C:\code\ai\ai helper files\discord-news-setup.md` |
| `/ai-daniel-todos` | `C:\code\ai\ai helper files\daniel-todos-durchgang.md` |
| `/ai-list-todos` | `C:\code\ai\ai helper files\list-todos.md` |
| `/ai-list-todo-refresh` | `C:\code\ai\ai helper files\list-todos-refresh.md` |
| `/ai-bewerbung-create-output-for <bewerber>\<id>` | `C:\code\ai\_bewerbung\_prompts\ai-bewerbung-create-output-for.md` |
| `/ai-bewerbung-input-list [<bewerber>\<id>]` | `C:\code\ai\_bewerbung\_prompts\ai-bewerbung-input-list.md` |

**Neuer Command:** Anleitung als Datei (meist `C:\code\ai\ai helper files\<name>.md`), dazu
`~/.claude/commands/<name>.md` mit Frontmatter `description` (+ `argument-hint`) und Body „Lies und
führe aus: `<Pfad>`" — ohne diese Datei gibt es `Unknown command` — und eine Zeile hier.
