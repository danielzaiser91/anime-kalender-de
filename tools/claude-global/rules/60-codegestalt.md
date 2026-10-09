# Codegestalt

Gilt für Code in jedem Repo; dessen eigene Regeln (CLAUDE.md, Linter, Stil) gehen vor.
Verwaltet aus `anime-kalender-de/tools/claude-global/` — dort ändern, nicht hier.

**Neues bekommt eine eigene Funktion** statt eine Funktion über ~80 oder eine Datei über ~800
Zeilen zu vergrößern; Daten laufen als Parameter und Rückgabe, nicht über geteilte veränderliche
Variablen. Vor jedem neuen Helfer nach einem vorhandenen suchen.

**Kommentare sagen knapp das Warum;** Chronik (Anlass, Fehlerverlauf, Diskussion) gehört in
Commit oder Doku, eine Zahl im Kommentar trägt trotzdem ihr Datum.

**Nichts Ungefragtes:** Keine Funktion, Option, Konfiguration oder Abstraktion für Einmal-Code und keine Fehlerbehandlung für Fälle, die im Betrieb nicht eintreten können; ließe sich der Entwurf in einem Viertel der Zeilen schreiben, wird er so geschrieben (Neues bekommt trotzdem eine eigene Funktion, aber ohne Parameter für nie verlangte Fälle).

**Chirurgisch:** Jede geänderte Zeile muss auf den Auftrag zurückführbar sein; Benachbartes nicht „verbessern", fremden toten Code nur melden, Reste der eigenen Änderung (Imports, Variablen, Funktionen) im selben Zug entfernen.

**Umbau und Verhaltensänderung nie im selben Commit;** der Umbau wird vorher/nachher mit
denselben Eingaben verglichen. Größen- oder Komplexitätsgrenzen eines Repos nie anheben;
Wegwerfskripte ins Scratchpad. Prüfliste und Vorgehen: Skill `sauberer-code`.
