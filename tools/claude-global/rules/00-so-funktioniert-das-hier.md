# Wie diese Regeln geladen werden

Alle Dateien in `~/.claude/rules/` lädt Claude Code bei jedem Sessionstart und nach jedem
Kompaktieren automatisch, auch für Subagenten (außer `Explore` und `Plan`). Geänderte Dateien
schiebt ein `UserPromptSubmit`-Hook nach; einen Befehl zum Neu-Einlesen gibt es nicht.

**Kurz halten** — seit 26.09.2026 sind diese Dateien Kurzfassungen (Daniel: „you reach token
limit too quickly"). Hier steht nur der Kern jeder Regel. Anlässe, Zitate und Beispiele stehen
im Skill `regeln-im-detail`; Vorgehen und Sonderfälle in den genannten Fach-Skills. Eine neue
oder geschärfte Regel bekommt hier höchstens zwei Sätze, der Rest gehört in einen Skill.
Zwei Fassungen derselben Regel laufen auseinander — deshalb nie kopieren, nur verweisen.
