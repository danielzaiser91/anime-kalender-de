---
name: wissen-veraltet-nie
description: "Sobald etwas geändert wird, das irgendwo beschrieben steht (status.md, Skills, CLAUDE.md, Memory): im selben Zug nachführen."
---

# Wissen veraltet nie

Daniel am 23.08.2026: „infos, knowledgebase, status dürfen nie in keinem projekt jemals und in
irgendeinem zustand veralten, nie. das soll oberste priorität haben" — und auf Nachfrage: „nicht
nur die 3 von mir eben gelisteten, sondern alle daten die wir speichern und auf denen die projekte
basieren."

## Warum das keine Ordnungsliebe ist

Ein veralteter Eintrag ist schlimmer als gar keiner. Er sieht aus wie Wissen, wird geglaubt, und
schickt jemanden los.

Fünf Fälle an einem einzigen Tag (22./23.08.2026, anime-kalender-de):

| Was dastand | Was galt | Was es gekostet hat |
|---|---|---|
| „Negativ-Befund ungeprüft, sechs Serien liegen dir vor" | Der Code entschied längst richtig | Daniel hätte eine Stunde geprüft, was erledigt war |
| „126 Netflix-Titel offen" | 74 | Falsche Größenordnung bei der Planung |
| „46 Arbeitspakete" | 38 | dito |
| „Angabe je Folgenbereich" stand als Idee | war gebaut und ausgeliefert | fast doppelt gebaut |
| Anleitung: „dann den Knopf drücken" | Die Erweiterung meldet von selbst | Anleitung führte ins Leere |

Der erste Fall ist der teuerste, und er ist typisch: **Die Aufgabe war erledigt, aber niemand hat
sie gestrichen.** Aufgefallen ist es nur, weil Daniel nachfragte.

## Die Regel

**Wer etwas ändert, führt im selben Zug nach, was es beschreibt.** Nicht später, nicht in einer
Aufräumrunde — im selben Zug. Eine Aufräumrunde findet nie statt, und bis dahin steht die falsche
Auskunft da.

Das gilt für **jeden** Bestand, auf dem Arbeit aufbaut:

- `status.md` des Projekts — Aufgaben, Zahlen, Stände
- `ai_agent_learnings.md`, `ai_agent_tools.md`, `ai_agent_projects.md`
- Skills unter `~/.claude/skills/`, Regeln unter `~/.claude/rules/`
- `CLAUDE.md` und `ARCHITEKTUR.md` der Projekte
- Das Memory unter `~/.claude/projects/*/memory/`
- Erzeugte Arbeitslisten und Prüflisten in `data/`
- Kommentare im Code, die einen Zustand beschreiben

## Die drei Prüfgriffe

**1. Vor dem Vorlegen: Gilt das noch?**

Bevor eine Aufgabe genannt, ein Batch vorgelegt oder eine Zahl ausgesprochen wird: an der Stelle
nachsehen, die es wissen muss. Eine Aufgabe aus der Liste zu zitieren ist keine Prüfung — die
Liste ist genau das, was veraltet sein könnte.

**2. Nach dem Ändern: Wer beschreibt das?**

Nach jeder Änderung die Gegenfrage: *Welches Dokument behauptet etwas über das, was ich gerade
geändert habe?* Bei Code sind das die Aufgabenliste und die Projektregeln; bei einem Ablauf die
Anleitung, die ihn beschreibt; bei einer Messung jede Stelle, die die alte Zahl nennt.

Mechanisch: `grep -rn "<alte Zahl>\|<altes Wort>" status.md CLAUDE.md data/*.md`

**3. Jede Zahl trägt ihr Datum.**

„74 Titel offen" ist in drei Tagen falsch. „74 offen (Stand 23.08.2026)" bleibt richtig — es wird
zu einer Messung statt zu einer Behauptung. Wer eine Zahl ohne Datum schreibt, schreibt eine
Zeitbombe.

Dasselbe gilt für Aufzählungen: „drei Quellen geprüft, alle negativ" braucht das Datum, sonst
prüft sie jemand in einem halben Jahr erneut.

## Wenn etwas erledigt ist

**Streichen, nicht abhaken lassen.** Eine erledigte Zeile, die stehen bleibt, wird beim nächsten
Lesen wieder als Arbeit gezählt. Was aufbewahrt werden soll, wandert ins Archiv des `status.md` —
mit dem, was gelernt wurde, nicht mit dem, was zu tun war.

Erzeugte Listen (`data/*-pruefliste.md`, `data/meldungen-ohne-zuordnung.md`) **löschen sich
selbst**, wenn nichts mehr drinsteht. Eine Datei mit dem letzten Stand behauptet Arbeit, die es
nicht mehr gibt; das ist am 23.08.2026 real passiert und hat drei Zeilen Scheinarbeit erzeugt.

## Wenn etwas widerlegt wird

Nicht löschen, sondern **umschreiben und begründen**. „`availability_ends` trennt die Fälle nicht —
widerlegt am 22.08.2026, Dragon Ball und JoJo tragen beide den 31.12.2025" ist wertvoller als
Schweigen: Es verhindert, dass jemand denselben Weg noch einmal geht.

Dasselbe bei Quellen: Eine verworfene Quelle bleibt in der Liste, mit dem Grund. Ohne ihn prüft
sie jemand in drei Monaten erneut und kommt zum selben Nein.

## Die Prüffrage am Ende jeder Antwort

*Habe ich etwas geändert, das irgendwo beschrieben steht — und steht es dort jetzt richtig?*

Wenn die Antwort „weiß nicht" lautet, ist sie „nein".

## Anlässe, aus der Regel verschoben (18.09.2026)

Wortgleich aus `~/.claude/rules/`, damit die immer geladene Regel kurz bleibt.

<!-- aus 20-arbeitsweise.md -->
Anlass (23.08.2026): Fünf veraltete Einträge an einem Tag, darunter eine Aufgabe, die Daniel eine
Stunde Prüfarbeit gekostet hätte — der Code hatte sie längst erledigt, nur hatte niemand die Zeile
gestrichen. Sein Wort: „infos, knowledgebase, status dürfen nie in keinem projekt jemals und in
irgendeinem zustand veralten, nie." Vollständig im Skill `wissen-veraltet-nie`.
