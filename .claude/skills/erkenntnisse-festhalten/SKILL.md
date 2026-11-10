---
name: erkenntnisse-festhalten
description: "Sobald eine Schwierigkeit überwunden ist (unerwartetes Verhalten, stiller Fehlschlag, falsche Annahme): wie und wo die Erkenntnis dauerhaft verankert wird."
---

# Erkenntnisse festhalten

Eine überwundene Schwierigkeit ist zweimal wertvoll: einmal, weil das Problem weg ist, und einmal,
weil jetzt etwas bekannt ist, das vorher niemand wusste. Der zweite Teil verfällt, wenn er nicht
aufgeschrieben wird — und zwar dort, wo er beim nächsten Mal **gefunden** wird, nicht dort, wo er
gerade zufällig entstanden ist.

**Diese Arbeit gehört zum Fix — aber sie kommt nach seinem Beleg, nicht vor ihm.** Der genaue
Zeitpunkt steht in § 0. Wer den Fix committet und die Erkenntnis nicht, hat die Hälfte
weggeworfen; wer sie verankert, bevor der Fix belegt ist, schreibt womöglich Aberglauben fest.

**Auch nicht „sammelt `/ai-improve-learnings` schon ein".** Dieser Befehl ist ein periodischer
Aufräum-Durchgang (Duplikate zusammenlegen, Veraltetes korrigieren) — kein Ersatz dafür, Erkenntnisse
sofort zu verankern. Was hier befolgt wird, muss dort nichts mehr nachtragen.

---

## Selbst lernen aus allem (Daniel, 09.10.2026)

Nicht nur nach einer Korrektur lernen: **nach jeder Panne, jedem Umweg, jedem Hänger, jedem Wiederholungsversuch** die Frage stellen *Was hätte das verhindert?* und die Antwort in derselben Antwort verankern (Memory, Projekt-`CLAUDE.md`, Skill oder Prüfung im Code — wo es beim nächsten Mal gefunden wird). Am Ende eines größeren Arbeitsblocks (Sitzungsende, Wechsel, „Schluss für heute") eine kurze Rückschau: Was ist schiefgegangen, was war Zufall, welche Regel fehlte? Erst dann abschließen. Beispiele von 08./09.10.2026 stehen in `project-hintergrundjobs-lehren` (Memory).

---

## 0 · Der Auslöser: der belegte Abschluss, nicht der Einfall

Zwei Zeitpunkte kommen in Frage, und nur einer taugt.

**Falsch: mitten im Fix.** In dem Moment ist die Ursache eine Vermutung. Was dann in eine Regel
gegossen wird, ist bestenfalls richtig und schlimmstenfalls eine Regel, die künftig in die falsche
Richtung zeigt — und die niemand mehr hinterfragt, weil sie ja aufgeschrieben ist. Dazu kommt der
praktische Schaden: Das Verankern unterbricht die Arbeit an einer Stelle, an der noch nichts steht,
und der halbe Fix bleibt liegen. Daniel am 21.08.2026: „nicht mitten in einem fix, wo evtl der fix
selbst ungetestet ist und mehr probleme verursacht als das er löst."

**Richtig: sobald der Beleg da ist.** Der Auslöser ist nicht „ich habe etwas geändert", sondern
**„ich kann zeigen, dass es jetzt stimmt"** — der grüne Gegentest, die Messung, der Lauf, der
durchgekommen ist, Daniels Bestätigung. Dann, in derselben Antwort, in der dieser Beleg steht.

**Die Prüffrage am Ende jeder Antwort, die einen Beleg enthält:** *Was wusste ich vor dieser
Sitzung nicht, das gerade bewiesen wurde?* Steht die Antwort nirgends dauerhaft, gehört sie
verankert, bevor die Antwort abgeschickt wird.

> **Der Gegenpol zu diesem Skill:** Hier geht es ums **Hinzufügen** von Wissen. Dass das
> Festgehaltene auch aktuell **bleibt** — dass eine erledigte Aufgabe verschwindet, eine Zahl ihr
> Datum trägt und eine widerlegte Annahme umgeschrieben statt gelöscht wird —, regelt
> `wissen-veraltet-nie`. Beide greifen fast immer zusammen: Wer eine Erkenntnis einträgt, macht
> damit meistens eine ältere Aussage falsch.

## Was in der Zwischenzeit passiert

Zwischen Einfall und Beleg liegen manchmal Stunden — ein Lauf über neunhundert Serien belegt erst
am Ende, ob die Änderung trägt. Damit die Erkenntnis diese Lücke überlebt, ohne verfrüht zementiert
zu werden:

- **Eine Zeile in die Aufgabenliste** (`status.md`, Abschnitt „Erkenntnisse offen"): was vermutet
  wird und **woran es sich entscheidet**. Zwei Sätze, keine Regel.
- **Der Zettel wird eingelöst, wenn der Beleg kommt** — bestätigt sich die Vermutung, wird sie
  verankert; widerlegt sie sich, verschwindet der Zettel. Beides ist ein Ergebnis.
- Ein Zettel, der eine Woche liegt, ist ein Zeichen, dass der Beleg nie kam. Dann gilt § 1: Ohne
  Messung wird daraus keine Regel, höchstens eine als `[Vermutung]` markierte Notiz.

### Warum das gerade schiefging

Am 21.08.2026 lagen fünf werkzeugübergreifende Erkenntnisse einen ganzen Tag lang unverankert —
Escaping-Fallen, ein Secret, das gesetzt, aber nicht durchgereicht war, ein Wächter, der bei
Zeitablauf „fertig" meldete. Alle waren belegt, alle waren repariert, keine war aufgeschrieben.
Daniel musste danach fragen: „ich habe nicht gesehen wie du selbstständig deine skills verbessert
hast."

Der Grund war nicht Unkenntnis dieser Regel, sondern der Arbeitsfluss: Nach dem belegten Fix stand
sofort die nächste Aufgabe an, und die Antwort ging ohne den Eintrag raus. Genau deshalb hängt der
Auslöser oben an der **Antwort**, nicht an der Aufgabe — eine Antwort schreibe ich immer, eine
Pause zwischen Aufgaben womöglich nie.

---

## 1 · Wann das hier greift

Immer, wenn eines davon zutrifft:

- Etwas hat **anders funktioniert als dokumentiert oder erwartet**.
- Etwas ist **still fehlgeschlagen** — kein Fehler, kein Warnhinweis, trotzdem falsches Ergebnis.
- Eine **Annahme hat sich als falsch erwiesen**, und zwar eine, die man wieder haben würde.
- Der Fehler hat **Geld, Zeit oder Daten gekostet**.
- Die Lösung ist **nicht offensichtlich** — jemand mit demselben Wissensstand würde sie nicht raten.
- Ein **Filter, ein Limit oder eine Quote** hat zugeschlagen, deren Auslöser man nicht kannte.
- Ein Werkzeug hat einen Parameter **kommentarlos verschluckt**.

**Nicht** festhalten:

- Tippfehler, Syntaxfehler, vergessene Imports — der Compiler findet die beim nächsten Mal auch.
- Was schon in der Dokumentation des Werkzeugs steht und dort auch gefunden worden wäre.
- Einmalige Zustände einer Sitzung („der Port war belegt").
- Vermutungen. Was nicht gemessen oder mindestens zweimal beobachtet wurde, kommt allenfalls als
  `[Vermutung]` markiert hinein — nie als Regel.

**Prüffrage:** *Würde ich in drei Monaten, mit demselben Wissensstand, denselben Fehler noch einmal
machen?* Wenn ja: aufschreiben.

---

## 2 · Wohin die Erkenntnis gehört

Der häufigste Fehler ist, alles in dieselbe Datei zu kippen. Die Erkenntnis gehört dorthin, wo
jemand sie **beim nächsten Mal ohnehin liest** — sonst ist sie archiviert, nicht verankert.

| Art der Erkenntnis | Ziel |
|---|---|
| Betrifft **ein bestimmtes Werkzeug, eine API, einen Dienst** | Der **Skill dieses Werkzeugs**. Gibt es keinen, **lege einen an**. |
| Betrifft **eine Technik oder ein Muster über Projekte hinweg** (Build, Deploy, DOM, State, Escaping …) | `C:\code\ai\ai helper files\ai_agent_learnings.md`, in die passende Kategorie |
| Gilt **nur für dieses eine Projekt** | Dessen `CLAUDE.md` |
| Betrifft **den Nutzer, seine Arbeitsweise, seine Vorlieben** | Memory (`user` oder `feedback`) |
| Gilt **nur an genau dieser Codestelle** | Kommentar **direkt daneben**, nicht in eine Datei weit weg |
| Ist eine **Regel, die maschinell prüfbar ist** | **Zusätzlich ein Test.** Siehe § 4 — das ist die stärkste Form. |

Mehrfachablage ist erlaubt und oft richtig: die Regel in den Skill, die Begründung als Kommentar
neben den Code, die Absicherung als Test. Was nicht passieren darf: derselbe Text an drei Stellen,
der dreimal gepflegt werden muss. **Eine Stelle führt, die anderen verweisen.**

---

## 3 · Wie sie formuliert wird

Immer in dieser Reihenfolge, immer vollständig:

1. **Die Regel zuerst**, als Handlungsanweisung. Nicht „es gab ein Problem mit X", sondern
   „X immer so, nie so."
2. **Das Warum in einem Satz.** Ohne Begründung wird eine Regel beim nächsten Widerspruch
   weggewischt — oder blind befolgt, wo sie nicht passt.
3. **Der Beleg**: was real passiert ist, mit **Datum** und wenn möglich mit **Zahl**. „Vier von
   sechs Bildern trugen erfundene Beschriftungen" trägt weiter als „manchmal kommt Text ins Bild".
4. **Die Gegenprobe**, falls es eine gab: was stattdessen funktioniert hat und woran man es
   gemerkt hat.

Zwei Formulierungsregeln, die den Unterschied machen:

- **Die Ursache benennen, nicht das Symptom.** „Der Anker forderte einen leeren Bildrand an und
  hat damit die Signatur erzeugt, gegen die er schützen sollte" ist brauchbar. „Manchmal sind
  Signaturen drin" ist es nicht.
- **Sagen, woran man es erkennt, bevor es weh tut.** Das ist der eigentliche Wert: nicht wie man
  repariert, sondern wie man es das nächste Mal *sieht*, solange es noch billig ist.

---

## 4 · Die stärkste Form: die Erkenntnis unumgehbar machen

Eine Notiz kann überlesen werden. Besser ist, wenn die Erkenntnis **im Weg steht**. Nach jedem
Fix prüfen, ob eine dieser Formen möglich ist — in dieser Rangfolge:

1. **Ein Test**, der bei Rückfall rot wird. („Der Anker darf nie wieder einen leeren Rand
   anfordern.")
2. **Eine Zusicherung im Code**, die hart abbricht. („Wirf, wenn ein Parameter mitgeschickt wird,
   den es nicht gibt.")
3. **Ein Standardwert oder eine Signatur**, die den Fehler unmöglich macht. (Pflichtfeld statt
   optional.)
4. **Ein Kommentar** an der Stelle, die man anfassen müsste, um es kaputtzumachen.
5. **Ein Eintrag im Skill oder in den Learnings** — das Minimum, nie das Maximum.

Ein Test kostet Minuten und hält Jahre. Eine Notiz kostet Sekunden und hält bis zur nächsten
Person, die sie nicht liest.

---

## 4b · Vorher: ist das Problem so gross, wie es aussieht?

Bevor eine Erkenntnis in ein Werkzeug gegossen wird, gehoert eine Frage dazwischen: **Wie gross
ist der Schaden dort, wo er tatsaechlich auftritt?**

Ein Fehler, den man beim Pruefen findet, sieht fast immer groesser aus als er ist — weil man beim
Pruefen genauer hinsieht als jeder Nutzer. Deshalb:

- **In der Zielgroesse und im Zielkontext beurteilen**, nicht in der Lupe. Ein Bildartefakt bei
  200 % Zoom ist etwas anderes als dasselbe Artefakt in der ausgelieferten Groesse. Ein
  Log-Rauschen im Terminal ist etwas anderes als dasselbe im Produktivbetrieb.
- **Haeufigkeit schaetzen, nicht raten.** Tritt es bei 2 % oder bei 60 % auf?
- **Die Kosten der Loesung gegen den Schaden halten** — und zwar ehrlich, inklusive dem Risiko,
  dass die Loesung selbst etwas kaputt macht.

Real (31.07.2026): Gegen ein Bildartefakt wurde ein Detektor gebaut, der es automatisch entfernen
sollte. Er erzeugte Fehlalarme auf echtem Bildinhalt — das Werkzeug haette mehr beschaedigt als
das Problem. Die Nachmessung in Auslieferungsgroesse zeigte ausserdem, dass das Artefakt dort kaum
sichtbar war. **Auffaellig war es nur bei doppelter Vergroesserung waehrend der Pruefung.** Richtig
war, an der Ursache zu arbeiten (Prompt) und den Rest stehen zu lassen.

Auch das ist eine Erkenntnis und gehoert aufgeschrieben: **welcher Weg sich als Sackgasse
herausgestellt hat und warum.** Das spart der naechsten Person den ganzen Umweg — oft mehr wert
als die Loesung selbst.

---

## 5 · Ablauf

1. **Fix fertig und belegt** — Gegentest grün, Messung da, Lauf durch. Vorher nicht: siehe § 0.
2. **Einordnen:** Ist das eine Erkenntnis nach § 1? Bei Nein: fertig, weiter.
3. **Ziel wählen** nach § 2. Existiert kein passender Skill, **anlegen** —
   `~\.claude\skills\<name>\SKILL.md` mit `name` und einer `description`, die beschreibt,
   *wann* der Skill gebraucht wird, nicht was er enthält.
4. **Schreiben** nach § 3. Bestehenden Eintrag zum selben Thema **ergänzen oder korrigieren**
   statt einen zweiten danebenzusetzen. Was sich als falsch herausgestellt hat, wird **berichtigt,
   nicht gelöscht** — die alte Annahme mit dem Vermerk, warum sie nicht stimmte, ist selbst eine
   Erkenntnis.
5. **Absichern** nach § 4, soweit möglich.
6. **Im selben Commit** wie der Fix. Die Commit-Nachricht nennt Ursache und Erkenntnis, nicht nur
   „fix".
7. **Dem Nutzer sagen**, was gelernt und wo es abgelegt wurde — in einem Satz.

---

## 6 · Wenn eine frühere Erkenntnis falsch war

Passiert und ist normal. Dann:

- Den alten Eintrag **korrigieren, nicht stillschweigend überschreiben.** Ein Satz dazu, was
  daran nicht stimmte und woran man es gemerkt hat.
- Prüfen, ob die falsche Annahme **anderswo Folgen hatte** — Code, der sich darauf stützt, Tests,
  die sie einzementieren, andere Notizen, die sie zitieren.
- Eine Erkenntnis mit Datum ist leichter zu korrigieren als eine ohne. Deshalb steht das Datum
  immer dabei.

---

## 7 · Beispiele aus der Praxis

Alle drei sind echt und zeigen, wie unterschiedlich das Ziel sein kann.

> **In den Werkzeug-Skill** (`flux-bildgenerierung`)
> `aspect_ratio` existiert bei FLUX.2 nicht und wird **kommentarlos verschluckt** — kein Fehler,
> kein Warnhinweis, das Bild kommt als 1024×1024 und kostet trotzdem. Auflösung ausschließlich
> über `width`/`height`. Verifiziert am 31.07.2026 gegen das OpenAPI-Schema.
> *Zusätzlich abgesichert:* `submit()` wirft, wenn der Parameter im Request steht.

> **In die Learnings** (Kategorie 17, Escaping)
> Skripte, die Quelltext schreiben, gehören in eine Datei — nicht in ein Shell-Heredoc. Ein
> Heredoc schiebt eine zusätzliche Escaping-Ebene zwischen Absicht und Interpreter. Real am
> 25.07.2026: `'\\n'` wurde unterwegs zu einem echten Zeilenumbruch mitten in einem
> String-Literal. Das Skript meldete Erfolg, `tsc` fand es in Sekunden.

> **Als Kommentar neben den Code**
> ```ts
> // "scarred" und "burn scar" haben die Content-Moderation ausgeloest (Violence,
> // 31.07.2026). Dieselbe Figur ohne die Reizwoerter kam durch. Der Filter sieht
> // das Wort, nicht die Absicht.
> ```
> *Zusätzlich abgesichert:* ein Test, der jedes Charakterblatt gegen die bekannten Reizwörter
> prüft.

---

## 8 · Die eine Regel, falls alles andere vergessen wird

**Jede Hürde, die Geld, Zeit oder Nerven gekostet hat, darf genau einmal kosten.**
Beim zweiten Mal ist es kein Pech mehr, sondern eine nicht aufgeschriebene Erkenntnis.
