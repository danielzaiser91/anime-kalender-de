---
name: neue-prompts-einordnen
description: "Wenn während laufender Arbeit eine neue Nachricht kommt: sofort merken, nach Dringlichkeit einordnen, Einordnung ansagen, dann weiter, anpassen oder wechseln."
---

# Ein neuer Prompt ist eine Einordnung, kein Themenwechsel

## Der Fehler, gegen den dieser Skill gebaut ist

Am 07.09.2026 kamen drei Nachrichten in drei Minuten (11:43, 11:44, 11:46), während
das Panel-Layout eines Titels halbfertig dastand:

| Zeit | Nachricht | was passierte |
|---|---|---|
| 11:43 | Hover-Markierung in der Erweiterung reparieren, Label ändern | **Vollwechsel**, Panel-Arbeit liegen gelassen |
| 11:44 | „warum roter lauf, warum pinker lauf. prüf und handle" | **Vollwechsel**, Erweiterung liegen gelassen |
| 11:46 | Daniels Korrektur | drei angefangene Sachen, keine fertig |

Sein Urteil: „du sollst nicht immer wechseln, du hast vorher an anderer aufgabe
gearbeitet."

Der Reflex ist verständlich und trotzdem falsch: Eine neue Nachricht **fühlt sich
dringend an, weil sie neu ist**. Neuheit ist aber keine Dringlichkeit. Und wer bei
jeder Nachricht wechselt, hinterlässt nach fünf Nachrichten fünf halbe Sachen —
also nichts, was ausgeliefert werden kann.

## Die vier Schritte, ausnahmslos in dieser Reihenfolge

### 1. Merken — bevor irgendetwas anderes passiert

**Jeder Einzelpunkt** der Nachricht wandert sofort in die Aufgabenliste
(`status.md` des Projekts, ersatzweise die Task-Liste). Eine Nachricht mit drei
Wünschen ergibt drei Zeilen, keine Sammelzeile. Auch das nebenbei Erwähnte, auch
die Frage in Klammern, auch das, was im Screenshot steht.

Das ist der einzige Schritt, der **keine** Abwägung kennt: Er passiert immer,
sofort, auch wenn die Sache klein ist und auch wenn sie sofort erledigt wird.
Grund: Der Gesprächsverlauf ist kein Speicher. Was nur im Kopf steht, ist beim
nächsten Wechsel weg — genau das ist am 07.09. passiert.

### 2. Einordnen — in genau eine von vier Schubladen

Prüffrage: **Was ändert diese Nachricht an dem, was ich gerade tue?**

- **A — sie ändert den Ansatz.** Daniel gibt eine Information zur *laufenden*
  Arbeit: eine Messung, eine Beobachtung, einen besseren Weg. → **Ansatz
  anpassen und weiterarbeiten.** Nicht wechseln, nicht danken, nicht neu
  planen — die neue Information einbauen und fortfahren. Das ist der wertvollste
  Fall und der am leichtesten übersehene: Er sieht aus wie eine neue Aufgabe, ist
  aber eine Abkürzung für die alte.
- **B — sie ist kritisch.** Etwas ist kaputt, falsch, verloren oder gefährlich:
  falsche Daten stehen live, ein Bau ist rot, ein Lauf schreibt Unsinn, Geld oder
  Daten stehen auf dem Spiel. → **Laufende Arbeit auf einen sicheren Stand
  bringen** (siehe Schritt 3), dann wechseln.
- **C — sie ist eine eigenständige Aufgabe.** Neu, unabhängig, nicht dringend. →
  **Notieren, laufende Arbeit zu Ende bringen, dann dran.** Das ist der
  Normalfall.
- **D — sie ist eine Korrektur meiner Arbeitsweise.** → Die Regel wird geschärft
  (siehe `korrektur-schaerft-die-regel`), **in derselben Antwort**, vor der
  Weiterarbeit. Sonst kommt derselbe Fehler wieder, und zwar sicher.

**Im Zweifel gilt C, nicht B.** Kritisch ist, was Schaden anrichtet, während ich
etwas anderes tue — nicht, was mich am meisten interessiert.

### 3. Wechseln nur von einem sicheren Stand aus

Auch ein kritischer Fall rechtfertigt kein Fallenlassen mitten im Satz. Vor dem
Wechsel wird die laufende Arbeit in einen Zustand gebracht, aus dem sie sich ohne
Gedächtnis fortsetzen lässt:

- die halbe Änderung committen (auch als `wip`), **oder**
- den Stand in zwei Zeilen in `status.md` notieren: was fertig ist, was der
  nächste Griff wäre, welche Datei offen liegt.

Prüffrage: **Könnte jemand anders — oder ich nach einem Neustart — hier
weitermachen?** Wenn nein, ist der Stand nicht sicher.

### 4. Ansagen — als Allererstes in der Antwort, nicht am Ende

**Die Einordnung steht in der ersten Zeile der nächsten Antwort, vor jedem
Werkzeugaufruf.** Nicht am Ende, nicht im Footer, nicht implizit dadurch, dass
etwas passiert. Daniel am 07.09.2026: „wann immer neue prompts reinkommen musst
du direkt darauf antworten und sagen wie du es einordnest … es muss direkt
sofort ersichtlich sein für mich, das du verstanden hast was ich gesagt habe,
und es entsprechende wirkung haben wird."

Sie beantwortet **vier** Dinge, in ein bis zwei Sätzen:

1. **Wie ich es einordne** — welche der vier Schubladen (A/B/C/D).
2. **Was ich jetzt genau tue** — weiterarbeiten, Ansatz ändern, wechseln.
3. **Wann der neue Punkt drankommt** — „gleich danach", „nach dem Commit",
   „als Nächstes nach X".
4. **Welche Wirkung er auf die laufende Arbeit hat** — auch wenn die Antwort
   „keine" lautet; dann steht genau das da.

> „Eigenständige Aufgabe — notiert, kommt direkt nach dem Panel-Fix, der gerade
> in der Prüfkette steht. Ändert daran nichts."
> „Das ändert den Ansatz: Ich werfe die halbe Zuordnung über die Folgenzahl weg
> und baue sie über die Kennung, wie du sagst."
> „Kritisch — ich committe den halben Stand und sehe mir den roten Lauf sofort an."

**Kein Zurückspiegeln seiner Nachricht**, keine Begründung, kein Dank. Die
Ansage sagt, was passiert, nicht was er geschrieben hat.

**Die häufigste Verfehlung ist nicht das Schweigen, sondern das Handeln
statt Sagen:** Sofort den ersten Werkzeugaufruf machen, weil man es ja
verstanden hat. Für Daniel sieht das identisch aus zu „hat es überlesen" — er
sieht Werkzeuge laufen und weiß nicht, wozu.

**Mit Subagenten:** Laufen Agenten (Skill `delegieren-und-parallelisieren`), ist Schublade A zugleich die Frage, ob ein laufender Auftrag noch stimmt. Ich ändere oder stoppe ihn (`SendMessage`/`TaskStop`), statt den Bericht abzuwarten. Ein Wechsel (B) lässt laufende Bauer weiterarbeiten, solange sie die neue Sache nicht anfasst; das Einsammeln ihrer Berichte steht im Stand (Schritt 3).

## Was fertig ist, wird sofort gemeldet — nicht am Ende der Liste

**Sobald ein Punkt einen Stand erreicht, den Daniel ansehen oder testen kann,
kommt die Meldung dazu in dieselbe Antwort** — nicht, wenn die übrigen neun
Punkte auch fertig sind. Er kann dann prüfen, während ich weiterarbeite, und
sein Feedback erreicht mich früh statt nach einer Stunde.

Daniel am 07.09.2026: „du hast extension angepasst, ich könnte bereits hingehen
und gucken, und während du noch mit 2-10 beschäftigt bist bereits parallel zu
deiner arbeit schon feedback zu 1 geben … du musst es nur ordentlich
kommunizieren und nicht erst ganz am ende der 10 aufgaben."

**Die Prüffrage nach jedem abgeschlossenen Punkt: Könnte er das jetzt ansehen?**
Auslöser sind unter anderem: eine neue Version der Erweiterung, ein Deploy, eine
Datei zum Gegenlesen, eine Liste, eine Messung, ein Screenshot.

Die Meldung besteht aus **drei** Angaben und steht **oben** in der Antwort, nicht
im Footer:

1. **Was fertig ist** — mit Versionsnummer oder Ort, damit er es findet.
2. **Was er tun muss, um es zu sehen** („Erweiterung neu laden", der Link).
3. **Ob es sich noch ändert** — das ist die entscheidende Angabe. Nur wenn die
   übrigen Punkte diesen Stand *nicht* mehr anfassen, lohnt sich sein Blick
   jetzt; sonst prüft er etwas, das ich gleich überschreibe.

> „**Jetzt testbar — Erweiterung 4.15.1:** Der Knopf heißt jetzt ‚Suchtreffer
> anklicken: `<Titel>` (`<ASIN>`)' und markiert die Kachel. Neu laden. Ändert
> sich durch die übrigen Punkte nicht mehr."

**Und die Ausnahme ist genauso wichtig:** Wird derselbe Gegenstand von einem
späteren Punkt noch einmal angefasst, wird **nicht** zwischendurch gemeldet —
sonst testet er zweimal dasselbe und findet beim ersten Mal Fehler, die zehn
Minuten später ohnehin weg sind. Dann steht die Meldung, wenn der Gegenstand
seinen letzten Stand hat.

## Reihenfolge, wenn mehrere Sachen offen sind

Abgearbeitet wird **nicht** nach Eingang und **nicht** nach Neuheit, sondern:

1. **Kaputtes vor Neuem.** Was falsche Auskunft gibt oder einen Bau blockiert.
2. **Angefangenes vor Angefragtem.** Eine halbe Sache ist wertlos; sie fertig zu
   machen kostet meist weniger als sie wieder aufzunehmen.
3. **Blockierendes vor Blockiertem.** Was andere Punkte freischaltet.
4. **Der Rest nach Nähe zum Projektziel.**

Die Ausnahme von Punkt 2: Wenn die neue Nachricht (Fall A) zeigt, dass die
angefangene Arbeit **am falschen Problem** arbeitet. Dann wird sie nicht
fertiggemacht, sondern verworfen oder umgebaut — und das wird gesagt.

## Als Dirigent: wohin geht der Auftrag? (Daniel, 10.10.2026)

Die vier Schubladen oben stammen aus der Zeit, als ich selbst gebaut habe. Seit die Hauptsitzung delegiert, heißt „laufende Arbeit zu Ende bringen“ fast nie „ich mache es später“. Gemeint ist: Der Auftrag landet an der richtigen Stelle der Agenten-Warteschlange. Daniel erwartet, dass jeder neue Auftrag sofort eingeschätzt und im selben Zug platziert wird. Dazu gehen diese Fragen vor jeder anderen Handlung der Reihe nach durch, und die Antwort steht in der ersten Zeile:

1. **Prio und Dringlichkeit:** Ist etwas kaputt, live oder steht Daniel davor? Oder ist es neu und eigenständig? Wie hoch steht der Auftrag im Vergleich zu den Punkten in „In Arbeit“ und in der Warteschlange (`stand.md`)?
2. **Größe und Risiko:** S/M/L und 0/1/2. Eine Frage beantworte ich sofort selbst, ebenso einen Handgriff (höchstens drei Aufrufe). Alles andere geht an einen Agenten. **Eine Frage, deren Antwort Datenanalyse oder Code-Lesen braucht oder nach einem Fehler aussieht, ist ein Task:** `stand.md`-Zeile, delegieren (Daniel 11.10.2026: „warum steigt die 🇩🇪-Zahl mit dem Toggle“ habe ich selbst über mehrere Dateien ausgemessen; es war ein Zählfehler).
3. **Gibt es einen passenden laufenden Agenten?** Berührt der Auftrag dasselbe Gebiet oder dieselben Dateien wie ein laufender Bauer, bekommt dieser ihn per `SendMessage` als eigenen Commit. Das ist billiger als ein Neustart, belegt keinen Platz und vermeidet Merge-Konflikte. Beispiel 10.10.: Der Sammel-Favoriten-Knopf ging an den Bauer, der in `web/src` gerade den AniList-Import entfernte.
4. **Braucht ein laufender Agent ein Update?** Ändert der Auftrag dessen Ziel, Annahmen oder Dateien, informiere ich ihn sofort per `SendMessage`.
5. **Ist ein Platz frei?** Laufende Agenten zählen (höchstens 5, davon höchstens 2 schwere). Ist ein Platz frei, starte ich sofort einen neuen Agenten. Ist keiner frei, kommt der Auftrag mit Prio als Zeile unter „In Arbeit (Warteschlange)“ in `stand.md` und startet, sobald ein Agent fertig ist. Bei Prio „kritisch“ wird ein weniger wichtiger Agent pausiert.
6. **Eintragen:** `stand.md`-Zeile und Savvy-Plan im selben Zug.

## Was das nicht heißt

- **Kein Ignorieren.** Der Prompt wird sofort gelesen und sofort notiert; nur die
  *Bearbeitung* wartet.
- **Kein Sammeln bis zum Schluss.** Wer drei Aufgaben zusammen bearbeitet,
  liefert wieder nichts. Eine nach der anderen, jede bis zum Commit.
- **Kein Fragen, was zuerst drankommt.** Die Reihenfolge steht oben; sie ist
  meine Entscheidung, nicht seine. Gefragt wird nur, wenn zwei Punkte einander
  widersprechen.
