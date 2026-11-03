---
name: werkzeugkasten-zuerst
description: "Bevor ich ein Werkzeug suche, „das kann ich nicht“ sage oder Daniel bitte, etwas nachzusehen: erst ai_agent_tools.md lesen und das Werkzeug starten."
---

# Werkzeugkasten zuerst — die Anlässe

Die Regel steht in `~/.claude/rules/40-wissen-und-werkzeuge.md`. Hier stehen die realen Fälle; sie wurden am 18.09.2026 aus der Regel hierher verschoben, damit die immer geladene Menge klein bleibt.

**Subagenten (08.10.2026):** Sie kennen den Werkzeugkasten nicht. Der Auftrag nennt relevante Werkzeuge und Fallstricke aus `ai_agent_tools.md` (Vorlage im Skill `delegieren-und-parallelisieren`); in Bash fehlen git/gh/node im PATH, dort stehen die absoluten Aufrufe.

## Anlässe, aus der Regel verschoben (18.09.2026)

Wortgleich aus `~/.claude/rules/`, damit die immer geladene Regel kurz bleibt.

<!-- aus 40-wissen-und-werkzeuge.md -->
**Und „wo liegt eigentlich X?" ist eine Werkzeugfrage, keine Suchfrage.** Am
28.08.2026 habe ich die Laufstatus-Anzeige im Dateisystem gesucht — mit `find`,
`grep` über mehrere Repos, einem Hintergrundlauf, der in einen Timeout lief — und
sie dann bei Daniel erfragt. Sie stand die ganze Zeit im Werkzeugkasten, mit
vollem Pfad, Startskript und Zweck. Ein `grep lauf-status` hätte drei Sekunden
gedauert. Sein Urteil: „das musst du wissen … du hast sie entwickelt … das du es
nicht weißt ist ein sehr schlechtes zeichen."

<!-- aus 40-wissen-und-werkzeuge.md -->
Der Fehler war nicht die fehlende Kenntnis, sondern die falsche Schublade: Sobald
die Frage „wo liegt das" lautet, wird **zuerst** `ai_agent_tools.md` gelesen und
erst danach das Dateisystem durchsucht — auch und gerade bei Dingen, die ich
selbst gebaut habe. Was einmal gebaut wurde, steht dort; was dort nicht steht,
gehört eingetragen, bevor weitergearbeitet wird.

<!-- aus 40-wissen-und-werkzeuge.md -->
**Und „das kann ich nicht" ist dieselbe Frage, nur gefährlicher.** Am 07.09.2026
schrieb ich „ich kann die Search Console nicht selbst abfragen" und stellte
Daniel stattdessen einen Auswahldialog. Sie steht im Werkzeugkasten, mit Browser,
Startbefehl und Fallstricken; ich hatte sie mehrfach benutzt. Seine Antwort:
„doch du kannst die google search console selber abfragen hast du schon mehrfach
getan." Kurz darauf derselbe Fehlgriff eine Ebene tiefer — „der Browser läuft
nicht" statt ihn zu starten, obwohl der Startbefehl zwei Zeilen unter der
Fallstrickliste steht: „omg der browser läuft nicht dann starte ihn."

<!-- aus 40-wissen-und-werkzeuge.md -->
Der Unterschied zur Ortsfrage ist der Schaden: Eine Suche im Dateisystem kostet
Minuten, eine falsche Absage kostet die Aufgabe. Sie klingt außerdem nach einer
Feststellung und wird deshalb nicht hinterfragt — auch von mir nicht.

<!-- 05.10.2026 -->
**Die Absage als Aufgabe an Daniel.** Am 05.10.2026 fragte Daniel, ob man lima-city-Langsamkeit nicht in der Search Console sehe. Ich bestätigte es und schrieb unter „Deine Aufgabe", er solle die Crawling-Statistik selbst ansehen — „die Console ist mir nicht zugänglich, sie braucht einen Google-Login". Falsch: dieselbe Search Console, derselbe Fall wie am 07.09.2026, Edge-Erweiterung mit Login, Startskript `edge-unsichtbar-starten.py`. Ich hatte weder `ai_agent_tools.md` noch den Fall oben gelesen, weil der Satz nicht „kann ich nicht" lautete, sondern „du könntest nachsehen". Sein Urteil: „guck selbst, müsstest du doch wissen." Das Ergebnis lag nach vier Aufrufen vor (319 ms mittlere Antwortzeit über 90 Tage, „Keine Probleme").
**Prüffrage vor jedem Satz „Daniel, schau in …":** Hat der Dienst einen Login, den Daniels Edge schon hat? Dann steht er im Werkzeugkasten, und ich schaue selbst (Skill `edge-browser`, seit 01.11.2026 ohne jedes Zutun von Daniel). Daniel bleibt nur, was wirklich nur er kann (Passwort, CAPTCHA, Zahlung).
