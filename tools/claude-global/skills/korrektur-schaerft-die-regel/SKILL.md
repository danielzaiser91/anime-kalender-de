---
name: korrektur-schaerft-die-regel
description: "Wenn Daniel eine Arbeitsweise korrigiert, nachfragt oder einen Widerspruch zeigt: die lückenhafte Regel, den Skill oder die Projektvorgabe ungefragt schärfen, nicht nur den Fall."
---

# Eine Korrektur gilt der Regel, nicht dem Einzelfall

Wenn Daniel eine Arbeitsweise korrigiert, ist der Einzelfall die kleinere Hälfte.
Die größere: **Irgendein Dokument hat diesen Fehler zugelassen** — eine Regel in
`~/.claude/rules/`, ein Skill, eine `CLAUDE.md`, ein Memory. Solange dieses Dokument
unverändert bleibt, kommt derselbe Fehler wieder, und Daniel muss ihn ein zweites Mal
melden.

Seine Korrekturen sind die teuerste Eingabe im ganzen System: Sie setzen voraus, dass
er meine Arbeit liest, den Fehler bemerkt **und** ihn formuliert. Jede davon darf genau
einmal anfallen (Daniel, 13.08.2026: „das sind Hinweise, dass etwas im Skill falsch
läuft, und du solltest entsprechend selbstständig die Skills schärfen").

**Ungefragt.** Es ist kein eigener Auftrag nötig, und es wird nicht nachgefragt, ob die
Schärfung erwünscht ist. Sie gehört in **dieselbe Antwort** wie die Richtigstellung.

---

## 1 · Wann das hier greift

Bei jeder Rückmeldung, die **dem Vorgehen** gilt und nicht dem Inhalt:

- Eine ausdrückliche Korrektur („das stimmt so nicht", „nicht X, sondern Y").
- Eine Rückfrage nach dem Sinn — „wofür wird das benutzt?", „was soll ich damit?",
  „ist das für dich oder für mich?". Wer fragen muss, hat etwas Unklares vor sich;
  die Frage ist der Fehlerbericht.
- Ein Hinweis auf einen Widerspruch zwischen zwei Dingen, die ich selbst geschrieben
  habe.
- Dieselbe Anmerkung **zum zweiten Mal**. Ab hier ist es sicher kein Ausrutscher.
- Eine Nachfrage, die eine Angabe von mir anzweifelt und recht behält.

**Nicht** hier: eine reine Inhaltsfrage („welche zwei Todos genau?"), eine
Meinungsänderung („mach es doch anders"), ein Wunsch nach etwas Neuem. Das sind
Aufträge, keine Korrekturen.

**Prüffrage:** *Hätte ich es besser wissen können, wenn irgendwo etwas Genaueres
gestanden hätte?* Wenn ja, greift dieser Skill.

### Und ohne Korrektur von außen: der selbst bemerkte Fehler

Daniel am 23.08.2026: „wenn du sowas merkst, das du was falsch gemacht hast und hättest
anders müssen, dann verschärfe entsprechend den skill sofort, sodass das nicht nochmal
passiert."

Der Auslöser ist also **nicht** seine Rückmeldung, sondern die Einsicht — egal woher sie
kommt. Es zählt genauso:

- Ein Fehlschlag, den ich selbst im Testlauf sehe.
- Ein Griff, bei dem mir mitten im Tun auffällt, dass es einen besseren gibt.
- **Ein Fehler, den ich zum zweiten Mal mache, obwohl die Lehre schon geschrieben steht.**
  Dann ist nicht der Fehler das Problem, sondern der Text: Er hat nicht getragen.

Der dritte Fall ist der wichtigste und der unangenehmste. Am 23.08.2026 sind Backticks
zweimal in einem Bash-Heredoc gestorben — zwei Stunden nachdem das Werkzeug dagegen
entstanden war und die Lehre dazu in `ai_agent_learnings.md` stand. Sie sagte, dass es das
Werkzeug gibt; sie sagte nicht, dass es **ausnahmslos** zu benutzen ist. Genau diese Lücke
hat der Fehler benutzt.

**Sofort heißt sofort:** in derselben Antwort, nicht am Ende der Sitzung. Wer es aufschiebt,
schärft es nie — und beim dritten Mal fällt es niemandem mehr auf.

---

## 2 · Das steuernde Dokument finden

Zuerst: **Welches Dokument hätte den Fehler verhindern müssen?**

| Fehler betrifft … | Ziel |
|---|---|
| eine Ausgabeform, die in jeder Antwort auftaucht (Footer, Sprache, Links, Blöcke) | der zuständige **Skill**, und nur dort — die Regel verweist bloß |
| eine ausnahmslos geltende Arbeitsweise | die passende Datei in `~/.claude/rules/` |
| etwas, das nur für dieses Projekt gilt | dessen `CLAUDE.md` |
| eine Vorliebe oder Arbeitsweise von Daniel | Memory (`feedback`) |
| ein Werkzeug, das anders arbeitet als angenommen | der Skill dieses Werkzeugs |

**Gibt es kein zuständiges Dokument, ist genau das der Befund** — dann wird eines
angelegt. Ein Fehler ohne zuständiges Dokument ist kein Zufall, sondern eine Lücke im
Regelwerk.

---

## 3 · Warum der Text den Fehler zuließ

Der lehrreichste Schritt, und der, den man am liebsten überspringt. Fast nie fehlte
die Regel ganz. Häufiger ist einer dieser drei Fälle:

- **Sie war zu abstrakt.** Die Kategorien waren sauber definiert, aber niemand musste
  beim Schreiben eine Entscheidung treffen. Definitionen allein steuern nichts.
- **Sie ordnete mechanisch zu, wo ein Urteil nötig war.** Der Footer-Skill bildete
  „Abschnitt der Quelldatei → Symbol" ab. Die Quelle weiß aber nur, **dass** etwas
  offen ist, nicht **warum** es gerade nicht passiert — und so wurde ein Punkt grün,
  dessen eigene Notiz „braucht eine dritte Quelle oder einen Blick von Daniel" sagte
  (13.08.2026).
- **Sie stand an der falschen Stelle** — in einem Dokument, das in dem Moment gar
  nicht gelesen wird.

Wer diesen Schritt überspringt, hängt einen weiteren Merksatz an eine Regel, die schon
beim letzten Mal nicht getragen hat.

---

## 4 · So wird geschärft, damit es trägt

Der neue Text muss **im Weg stehen**, nicht danebenliegen. Vier Formen, in dieser
Reihenfolge der Wirksamkeit:

1. **Eine Prüffrage, die vor der Handlung beantwortet werden muss** — eine, auf die
   „nein" eine echte Möglichkeit ist. („Könnte ich diesen Punkt jetzt sofort anfangen,
   ohne auf etwas zu warten?")
2. **Warnwörter.** Konkrete Formulierungen, bei denen die Regel sicher greift („nach
   …", „sobald …", „braucht Daniels Blick"). Ein Wort erkennt man beim Schreiben,
   ein Prinzip nicht.
3. **Der reale Fall im Wortlaut, mit Datum.** Ein Beispiel, das wirklich passiert ist,
   schlägt jede abstrakte Formulierung — und belegt zugleich, dass die Regel nicht
   erfunden ist.
4. **Eine maschinelle Prüfung**, wo möglich: ein Test, eine Zusicherung, ein Hook. Die
   stärkste Form, weil sie nicht überlesen werden kann.

**Und immer benennen, wer handelt bzw. was genau falsch war.** „Sorgfältiger sein" ist
keine Regel, sondern ein Vorsatz.

---

## 4a · Erst den Fehler vorführen, dann schärfen

Übernommen am 18.09.2026 aus dem RED/GREEN-Vorgehen von `obra/superpowers`
(„writing-skills"), nach Daniels Auftrag, aus Fehlschlag und Erfolg selbstständig zu
lernen. Die Abschlussprüfung in Abschnitt 7 fragt, ob der neue Text den Fehler
verhindert hätte — ohne Vorführung ist die Antwort darauf eine Meinung.

1. **Rot:** Den Fehler an der Stelle nachstellen, an der er entstand. Bei Code heißt das
   eine Zusicherung, die **vor** dem Fix fehlschlägt (Gegenprobe). Bei einer
   Arbeitsweise heißt es: den alten Text lesen und die Stelle zeigen, an der er die
   falsche Handlung erlaubt hat — wörtlich zitiert.
2. **Grün:** Die Schärfung schreiben und dieselbe Probe noch einmal — die Zusicherung
   hält, bzw. der zitierte Satz verbietet die Handlung jetzt ausdrücklich.
3. **Ausreden notieren.** Fiel mir beim Fehler ein Grund ein, warum es „diesmal"
   anders sei („nur kurz", „der Wert ist doch sicher da", „das ist ja nur ein
   Datencommit"), gehört genau dieser Satz als Warnwort in die Regel. Die Ausrede ist
   die Stelle, an der die nächste Regel wieder bricht.

**Die Probe wird nie an die Regel angepasst, damit sie besteht.** Eine Zusicherung,
die nach dem Umbau grün ist, weil sie etwas anderes prüft, ist der Fehler selbst.

---

## 4b · Rückfälle zählen — ab dem zweiten wird es eine Maschine

Übernommen aus ExpeL (arXiv 2308.10144) und den „Instincts" von Everything Claude
Code: Eine Erkenntnis trägt einen Zähler, und der Zähler entscheidet, wie viel Text
noch hilft.

Das Register steht in `C:\code\ai\ai helper files\rueckfall-register.md`. Bei
**jedem** Fehler, zu dem schon eine Lehre existiert, wird dort die Zeile gesucht und
ein Datum ergänzt — oder eine neue Zeile angelegt.

| Rückfälle | was jetzt gilt |
|---|---|
| 0 | Text reicht (Abschnitt 4, Formen 1–3). |
| 1 | Der Text hat nicht getragen: Abschnitt 3 noch einmal, und die Stelle prüfen, an der er steht. |
| **ab 2** | **Kein weiterer Satz.** Es braucht eine maschinelle Prüfung (Zusicherung, Hook, Test), oder die Zeile sagt, warum es keine geben kann. |

**Prüffrage vor jeder Schärfung:** *Steht dieses Fehlerbild schon im Register?* Wenn
ja, ist es ein Rückfall, und die Tabelle sagt, was zu tun ist — nicht das Gefühl.

## 4c · Daniels Fehlermeldung ist ein Befund über eine Lücke, nicht ein Symptom

Daniel, 16.10.2026: Gemeldete Fehler und Feedback müssen richtig erkannt und analysiert werden.
Es reicht nicht, das Symptom zu beheben. Die echte Ursache wird gefunden, die Lücke dauerhaft
geschlossen und dieselbe Fehlerart künftig verhindert. Anlass waren an einem Vormittag:
pünktliche Folgen auf der Verpasst-Liste, ein Panel, das „Sprache offen“ zeigt, während die
Erweiterung „beantwortet“ meldet, ein Link-Pfeil ohne Link und ähnliche Titel ohne Bezug.

Jede Meldung durchläuft fünf Stufen. Jede steht im Auftrag an den Bauer und im Bericht:

1. **Ursache:** Was ist kaputt, und warum konnte es entstehen? Die Antwort nennt die Stelle und
   die fehlende Regel, Prüfung oder Annahme. „Feld X fehlt“ ist das Symptom. Die Ursache ist
   „zwei Stellen entscheiden dieselbe Frage nach verschiedenen Regeln“.
2. **Klasse:** Wie viele andere Fälle hat dieselbe Ursache? Gemessen wird am ganzen Datensatz
   bzw. an allen Komponenten, nicht nur an Daniels Beispiel. Die Zahl steht im Bericht.
3. **Dauerhaft schließen:** Die Ursache wird behoben, nicht der Einzelfall. Eine Regel bekommt
   genau eine Quelle. Eine Handkorrektur ist nur zusätzlich erlaubt, nie an Stelle des Fixes.
4. **Wächter und Lehre:** Ein Test oder Check macht die ganze Fehlerart rot (mit Mutationsprobe
   belegt). Dazu gehört eine Zeile in `berichte/lehren.md` und in dem Dokument, das die Lücke
   zugelassen hat, also Agentenvorlage, Skill oder Projektregel.
5. **Warum ist es durchgerutscht?** Daniel, 16.10.2026: Es hätte dem Prüfer auffallen müssen.
   Für den PR, der den Fehler eingeführt hat (`git log -S`/`git blame`), wird geklärt: Hat der
   Prüfer-Agent oder der CI-Prüfer die Stelle gesehen? Hätte eine vorhandene Prüfung anschlagen
   müssen? Die Antwort schärft `~/.claude/agents/pruefer.md`, die CI-Prüfervorgabe oder die
   Prüfkette, damit dieselbe Fehlerart beim nächsten PR auffällt.

Erst wenn alle fünf Stufen erfüllt sind, gilt die Meldung als erledigt. Der Prüfer prüft alle
fünf. Fehlt Stufe 4 oder 5, lautet sein Urteil „ändern“.

## 4d · Wohin eine neue Lehre kommt (18.10.2026)

Erste zutreffende Stufe gilt: (1) Erzwingt schon ein Hook/Check/Test die Handlung? Nicht aufnehmen, im Commit den Erzwinger nennen; ab dem zweiten Verstoß wird er gebaut, nicht der Satz geschärft. (2) Nur eine Datei, ein PR, eine Werkzeug-Eigenheit oder ein Plattformfeld? Nicht in `bauer.md`/`pruefer.md`: Werkzeug nach `ai_agent_tools.md`, Datenregel nach `docs/wissen/<thema>.md`. (3) Passt sie in Klasse K1–K12? Klassenzeile umformulieren (Halbsatz, keine PR-Nummer, keine Datumsklammer; Anlass nur ins Archiv), erst zusammenlegen, dann ergänzen. (4) Nur Dirigent/Auftrag/Prozess? Eine Zeile in `lehren.md` mit konkretem Ort in „Verankert“, sonst nicht. (5) Keine Klasse, aber zweiter unabhängiger Fall? Neue Klasse (max. 14). (6) Erster Fall ohne Klasse: nur „Kandidaten“ in `lehren.md`, nach 14 Tagen ohne zweiten Fall streichen. Obergrenzen: `lehren.md` ≤ 8 KB, Lehren-Block in `bauer.md` ≤ 9,5 KB, in `pruefer.md` ≤ 8,5 KB (Ist-Stand 18.10.2026, dürfen nur sinken; wer eine Zeile ergänzt, legt vorher zusammen). Begründung: `daniel-zum-abarbeiten/berichte/lehren-qualitaet-2026-10-18.md`, Abschnitt 5.

## 5 · Fallstricke

- **Nur den Einzelfall beheben.** Der häufigste Fehler. Die Antwort stimmt dann, das
  Dokument nicht — und beim nächsten Mal steht derselbe Fehler wieder da.
- **Die Regel an zwei Stellen schreiben.** Zwei Fassungen derselben Regel laufen
  garantiert auseinander (real passiert mit der Footer-Regel, 08.08.2026). Die Regel
  in `~/.claude/rules/` bekommt einen Auslöser von ein, zwei Sätzen; der ganze Inhalt
  lebt im Skill.
- **Vorher fragen, ob geschärft werden soll.** Wird nicht gefragt — siehe oben.
- **Aufschieben.** Dieselbe Antwort, nicht „beim nächsten Aufräumen".
- **Die Schärfung verschweigen.** In der Antwort gehört ein Satz dazu, was geändert
  wurde. Sonst weiß Daniel nicht, ob seine Korrektur angekommen ist, und meldet sie
  vorsichtshalber noch einmal.

---

## 6 · Abgrenzung

- **`erkenntnisse-festhalten`** greift bei einer **technischen** Hürde, die ich selbst
  überwunden habe. Auslöser ist der Fix. Hier ist der Auslöser **Daniels Rückmeldung**,
  und das Ziel ist ein steuerndes Dokument, kein Wissensspeicher. Trifft beides zu,
  greift beides.
- **`pruefen-und-belegen`** sagt, dass nichts ohne Beleg behauptet wird. Dieser Skill
  greift danach: Wenn eine unbelegte Behauptung durchgerutscht ist, ist die Frage,
  welches Dokument das zugelassen hat.

---

## 7 · Abschlussprüfung

> **Hätte der Text, so wie er jetzt dasteht, genau diesen Fehler verhindert?**

Wenn die ehrliche Antwort „vielleicht" lautet, ist die Schärfung Zierde. Dann fehlt
die Prüffrage, das Warnwort oder der reale Fall.
