---
name: sitzungswechsel
description: "Schneller, verlustfreier Wechsel in eine neue Sitzung mitten in laufender Subagenten-Arbeit (0–10 Min): Agenten per Übergabeprotokoll pausieren, Hauptsitzung übergibt, neue Sitzung startet die Agenten aus den Protokollen neu. Bei Kontext ab 500k, auf Daniels Wunsch „pausieren mit Protokollen“, und in jedem Auftrag an Bauer/Prüfer/Fable als Pflicht-Checkpoint."
disable-model-invocation: true
---

# Sitzungswechsel mit laufenden Agenten (Daniel, 09.10.2026)

Ziel: sofort wechseln können (0–10 Min), ohne Verlust und ohne Konflikte, mit möglichst wenig Kontext beim Start der neuen Sitzung. Sauber geht vor schnell. Hintergrund: Agenten sind Kinder der Sitzung; endet sie, enden sie, und ihre Berichte kämen nicht mehr an. Deshalb wird nicht gewartet, bis alle fertig sind, sondern pausiert und neu gestartet.

## Ablauf in der alten Sitzung (Pausieren)

1. `ListAgents` → wer läuft. Kurze Prüfer ohne Schreibzugriff **nicht** protokollieren: abbrechen, in der neuen Sitzung neu starten (Auftrag steht im INDEX).
2. An jeden laufenden Bauer/Rechercheur/Fable per `SendMessage` die **Pausen-Nachricht** (Vorlage unten). Jeder schreibt sein Protokoll nach `daniel-zum-abarbeiten/agenten/<name>.md`, committet Ungesichertes als WIP und pusht (Hook-Sperre nicht umgehen: dann „UNGESICHERT im Worktree: <Dateien>"), entfernt den Worktree **nicht**, meldet die Schlusszeile `PROTOKOLL GESCHRIEBEN <Pfad>, WIP-Commit <hash>`.
3. Erst wenn alle Schlusszeilen da sind: `TaskStop` auf jeden Agenten (ein gestoppter Agent schreibt nichts mehr).
3a. **Vor dem Go alles auf null stellen (Daniel, 09.10.2026):** Das Panel „Hintergrundaufgaben" zählt nicht nur Agenten, sondern auch Hintergrund-Befehle (Bash: `gh run watch`, Schleifen, hängende Skripte, Beobachter). Prüfen mit `ListAgents` (alle `completed`/gestoppt, keiner `running`) und mit den Task-IDs der Hintergrund-Befehle (Dateien in `…\scratchpad\..\tasks\<id>.output`, Zähler im Panel): jede noch laufende ID per `TaskStop` beenden; Läufe auf GitHub laufen unabhängig weiter (Lauf-ID in die Übergabe, nicht beobachten). **Erst wenn das Panel „0 laufende Aufgaben" zeigt (Daniel sieht es), das Go geben**; steht dort eine Zahl > 0, nenne ich jede Aufgabe einzeln (Name, Alter, warum noch da) und beende sie. Gestartete Beobachter sind danach verschwunden, nicht still weiter am Arbeiten.
4. Hauptsitzung: `agenten/INDEX.md` anlegen/aktualisieren (eine Zeile je Agent: Name, Zweck, Modell, Protokoll, Zustand, Branch/PR), `project-uebergabe.md` überschreiben (Skill `sitzungsschnitt`, inkl. autonomem Modus, Wecker-Prompt), `daniel-zum-abarbeiten/stand.md` nachführen, Haupt-Ordner `pull --ff-only` und sauber, Memory-Index aktuell. Danach „Schnitt bereit HH:MM" in die Übergabe und Daniel das Go geben.

## Ablauf in der neuen Sitzung (Fortsetzen)

1. Bei „weiter": MEMORY.md (automatisch), `project-uebergabe.md`, `agenten/INDEX.md`. **Nicht** die Protokolle selbst lesen (das tun die Agenten). Wecker stellen (autonomer Modus), erste Antwort nennt Endzeit und Weckzeit.
2. Stand gegen die Wirklichkeit prüfen: `git status` im Haupt-Ordner, `gh pr list`, `gh run list`, Worktree-Liste.
3. Jeden Agenten aus dem INDEX neu starten (parallel, im Hintergrund, gleiches Modell): Prompt-Muster: „Du setzt die Arbeit eines Vorgängers fort. Lies zuerst C:\code\ai\anime-kalender-de\daniel-zum-abarbeiten\agenten\<name>.md (Auftrag, Stand, nächster Schritt) und CLAUDE.md des Repos. Prüfe, ob Branch, Worktree und letzter Commit zum Protokoll passen (git status/log), sage bei Abweichung zuerst, was du siehst, und mache dann beim ‚nächsten Schritt‘ weiter. Berichte wie im Protokoll vorgesehen; halte das Protokoll bei jedem größeren Schritt aktuell.“ Prüfer ohne Protokoll: Auftrag aus dem INDEX bzw. der PR-Nummer neu.
4. Das Protokoll gehört dem Agenten: er führt es weiter; bei Abschluss setzt er `Zustand: fertig` + Ergebnis; die Hauptsitzung streicht die Zeile im INDEX nach dem Merge.

## Pflicht in jedem Auftrag (laufender Checkpoint, damit Pausieren in Sekunden geht)

Jeder Bauer/Fable-Auftrag enthält den Satz: „Führe `daniel-zum-abarbeiten/agenten/<name>.md` fortlaufend: nach jedem größeren Schritt (Commit, Messung, Entscheidung) ergänzen; bei einer Nachricht ‚PAUSE‘ sofort fertig schreiben, WIP pushen und die Schlusszeile melden.“ Die Hauptsitzung legt beim Start des Agenten die Zeile im INDEX an.

## Protokollvorlage (jede Datei unter `agenten/`)

```
# <name> — <Zweck>
Zustand: läuft | pausiert | fertig · Modell: sonnet|fable · Stand: <Datum Uhrzeit>
Auftrag (Wortlaut/Kurzfassung mit allen Entscheidungen von Daniel und allen Prüfer-Funden):
Arbeitsort: Branch · Worktree · Junction node_modules ja/nein · letzter Commit/WIP-Branch · PR
Erledigt (mit Beleg):
Offen (Reihenfolge):
Nächster konkreter Schritt/Befehl:
Messzahlen (mit Datum):
Fallen (zweimal Schiefgegangenes, Hook-Sperren, Befehlsformen):
Abnahme: wer prüft (Prüfer-Auftrag), was zählt als fertig:
```

## Pausen-Nachricht (Vorlage)

„PAUSE (Sitzungswechsel, Daniel hat es angeordnet): Schreibe jetzt dein Übergabeprotokoll nach …\agenten\<name>.md (Vorlage Skill sitzungswechsel), committe Ungesichertes als WIP und pushe (PR-Branch, sonst wip/<name>), entferne den Worktree nicht, melde als letzte Zeile: PROTOKOLL GESCHRIEBEN <Pfad>, WIP-Commit <hash>.“

## Fallen

- Ein Agent, der gestoppt wird, **bevor** er die Schlusszeile meldete, hat kein verlässliches Protokoll: dann Worktree/Branch ansehen und den Agenten mit „rekonstruiere dein Protokoll aus Branch und Diff“ neu starten.
- Hook `tools/quellen-commit-wache.sh` sperrt Commits mit Quellen-Dateien, solange ein Bestandsbau läuft: nicht umgehen (WIP auf `wip/…`-Branch ohne Quellen-Dateien, sonst „UNGESICHERT im Worktree").
- Junctions: vor dem Entfernen eines Worktrees `cmd //c rmdir <wt>\node_modules`; nie `git worktree remove --force` bei bestehender Junction.
- Fable-Läufe schreiben ihren Bericht erst am Ende: Pausen-Nachricht verlangt den Teilbericht in die Zieldatei.
