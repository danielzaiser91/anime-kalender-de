# Wie diese Regeln geladen werden

Alle Dateien in `~/.claude/rules/` werden von Claude Code **automatisch bei jedem Sessionstart
vollständig geladen** — ohne dass jemand darum bitten muss, und ohne dass ich mich dafür
entscheiden müsste. Sie erreichen auch **Subagenten** (jeden außer `Explore` und `Plan`, die
die CLAUDE.md-Hierarchie bauartbedingt überspringen).

Daraus folgt für alle, die hier etwas ändern:

- **Es gibt keinen Befehl mehr zum Neu-Einlesen und es braucht keinen.** Wird eine Datei hier
  während einer laufenden Sitzung geändert, schiebt ein Hook (`UserPromptSubmit`) die neue
  Fassung beim nächsten Prompt automatisch nach. Änderungen wirken also sofort, auch mitten
  in der Arbeit.
- **Beim Sessionstart meldet ein Hook, was sich seit der letzten Sitzung geändert hat.** Diese
  Meldung ist keine Zierde: Steht dort eine geänderte Datei, gilt ab sofort deren neue Fassung.
- **Hier steht nur, was ausnahmslos immer gilt.** Alles mit Beispielen, Tabellen oder
  Sonderfällen bekommt hier einen Auslöser von ein bis zwei Sätzen und lebt vollständig in
  einem Skill. Zwei Kopien derselben Regel laufen garantiert auseinander (real passiert mit
  der Footer-Regel, 08.08.2026).
- **Kurz halten.** Je kürzer die immer geladene Menge, desto zuverlässiger wird sie befolgt.

Der Hintergrund, welcher Baustein wann geladen wird und warum diese Aufteilung so gewählt ist,
steht in `C:\code\ai\__assets\notes\claude-oekosystem-architektur.md`.
