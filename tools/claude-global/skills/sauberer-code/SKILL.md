---
name: sauberer-code
description: Prüfliste für Struktur und Umfang beim Schreiben oder Ändern von Code in einem beliebigen Repo — vor größeren Ergänzungen, beim Anfassen sehr großer Dateien/Funktionen und vor dem Commit. Auch nutzen, wenn der Nutzer nach Clean Code, Refactoring oder "zu großer/komplexer Code" fragt.
---

# Sauberer Code — Prüfliste

## Vor dem Schreiben
1. Wo gehört das hin? Existiert ein passendes Modul/Helfer? (Grep nach Begriff, Verb, Datentyp.)
2. Wie groß ist die Zielfunktion/-datei? Über ~80 / ~800 Zeilen: Neues als eigene Funktion bzw.
   eigenes Modul anlegen und von dort aufrufen — nicht anbauen.
3. Welche Daten braucht das Neue, welche liefert es? Das wird die Signatur.

## Beim Schreiben
- Eine Aufgabe je Funktion, sprechender Name, früh zurückkehren statt tief verschachteln.
- Keine versteckten Abhängigkeiten über geteilte `let`/globale Variablen.
- Kommentare nur für das Warum, 1–3 Zeilen; Historie in den Commit.
- Stil der Umgebung übernehmen (Formatierung, Sprache, Benennung); keine Umformatierung
  unbeteiligter Zeilen.

## Umbau (Refactoring)
1. Nahtstelle wählen (vorhandene Abschnittsmarken, Blöcke mit eigener Aufgabe).
2. Ein-/Ausgaben des Abschnitts bestimmen (gelesene äußere Namen → Parameter; neu zugewiesene →
   Rückgabe; danach genutzte eigene Namen → Rückgabe).
3. Wörtlich verschieben, nicht nebenbei umschreiben.
4. Gleichheit beweisen: Tests, Golden-Output-Vergleich oder Snapshot mit denselben Eingaben.
5. Eigener Commit; Verhaltensänderungen danach separat.

## Vor dem Commit
- Diff lesen: Angebaut statt herausgelöst? Duplikat? Unnötige oder lange Kommentare?
- Prüfkette des Repos (Typen, Lint, Tests, Größenprüfung) grün.
