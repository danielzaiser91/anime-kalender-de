## Code, den Claude schreibt (global)

Gilt in jedem Repo; die Regeln des Repos (CLAUDE.md, Linter, Stil der Umgebung) gehen vor.

### Codegestalt
- **Neues bekommt eine eigene Funktion.** Nicht in eine Funktion über ~80 Zeilen oder eine Datei
  über ~800 Zeilen anbauen; Neues herauslösen (eigene Funktion, eigenes Modul). Eine Funktion,
  eine Aufgabe; ihr Name sagt sie.
- **Daten sichtbar übergeben:** Eingaben als Parameter, Ergebnisse als Rückgabe. Kein
  Zustandsaustausch über geteilte veränderliche Variablen einer großen Funktion oder Modulebene.
  Wo die Reihenfolge von Schritten zählt, muss sie in den Aufrufen stehen, nicht im Kommentar.
- **Erst suchen, dann schreiben:** vor jedem neuen Helfer nach einem vorhandenen suchen
  (Grep nach Verb/Nomen). Zwei fast gleiche Funktionen sind ein Fehler, keine Variante.
- **Kommentare sagen warum, knapp** (1–3 Zeilen). Kein Tagebuch im Code: Datum, Anlass,
  Fehlerverlauf und Diskussion gehören in Commit-Nachricht oder Doku, im Code höchstens ein
  Verweis. Keine Kommentare, die nur wiederholen, was der Code sagt.
- **Umbau und Verhaltensänderung nie im selben Commit.** Ein Umbau wird mit denselben Eingaben
  vorher/nachher verglichen (Tests, Golden-Output, Snapshot), bevor er als fertig gilt.
- **Wegwerfskripte ins Scratchpad**, nicht ins Repo und nie ins Wurzelverzeichnis.

### Wenn eine Datei schon zu groß ist
- Nicht weiter vergrößern. Den Teil, den man ohnehin ändert, zuerst herauslösen (eigener Commit,
  verhaltensgleich), dann ändern. Kein großer Komplettumbau auf Verdacht.
- Gibt es im Repo eine Größen- oder Komplexitätsprüfung, deren Grenzen nie anheben.

### Qualitätsprüfung vor dem Abschluss
- Den eigenen Diff lesen, als wäre er fremd: Wurde etwas angebaut statt herausgelöst? Gibt es das
  schon? Ist jeder neue Kommentar nötig und kurz? Wächst eine Funktion über die Grenze?
- Die Prüfkette des Repos laufen lassen; Ergebnis ehrlich berichten.
