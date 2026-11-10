---
name: bis-nichts-mehr-offen-ist
description: "Wann eine Antwort enden darf: nicht, solange 🟢-Aufgaben ohne fremdes Zutun möglich sind. Beim Abschluss einer Arbeitseinheit, nach Commits, vor Zwischenberichten."
---

# Nicht anhalten, solange Grünes offen ist

## Die Regel

**Eine Antwort endet erst, wenn der Footer keine 🟢-Zeile mehr hat.** Alles, was jetzt und ohne
fremdes Zutun erledigt werden kann, wird in derselben Antwort erledigt — nicht angekündigt, nicht
für den nächsten Prompt aufgehoben.

Daniel am 15.08.2026: *„du hast aufgehört, hör erst auf wenn es keine grünen (offenen jetzt
erledigbaren) todos mehr gibt, ich will dich nicht jedesmal anstupsen müssen."*

Ein Anstupsen ist ein Symptom. Es heißt: Die Arbeit war machbar, sie war bekannt, sie war
eingetragen — und sie lag trotzdem still. Jedes „soll ich das als nächstes bauen?" zu einer
Aufgabe, die schon auf der Liste steht und nichts Fremdes braucht, ist genau dieser Fehler.

## Was 🟢 heißt, und was nicht

🟢 ist eine Aufgabe, die **jetzt** angefangen und zu Ende gebracht werden kann: alle nötigen
Angaben liegen vor, kein Mensch und kein Fremdlauf muss vorher etwas tun, und sie fällt nicht
unter die Rückfragegründe der Regel `20-arbeitsweise.md` (Geld, Außenwirkung, Server, schwer
Umkehrbares, Rechtsgrauzone).

Nicht 🟢 sind:

- **🟡 blockiert durch eigene Vorarbeit** — die Grundlage fehlt noch. Dann wird die Grundlage
  gebaut, und *die* ist das grüne Todo.
- **⏳ / 🙋** — wartet auf jemand anderen. Darauf darf angehalten werden.
- **⚙️** — läuft bereits (auch ein Subagent im Hintergrund). Ein laufender Hintergrundlauf ist
  **kein** Grund anzuhalten: Solange daneben Grünes liegt, wird daran weitergearbeitet (ich
  delegiere es oder tue den kleinen Handgriff); trifft ein Bericht ein, wird er nachgeprüft.

## Die Abschlussprüfung

Vor **jeder** Antwort, die enden soll:

1. Footer bauen und die 🟢-Zeile ansehen.
2. Steht dort etwas? Dann nicht antworten, sondern arbeiten.
3. Steht dort nichts? Gegenprüfen, ob wirklich nichts grün ist — oder ob etwas als 🟡 geführt
   wird, dessen Grundlage ich selbst bauen könnte. Wenn ja, ist es in Wahrheit grün.

## Die Ankündigung ist die häufigste Verkleidung

Der Skill wird selten dadurch gebrochen, dass ich einen grünen Punkt übersehe. Er wird
gebrochen, indem ich ihn **ankündige**: „Ich sehe mir das jetzt an", „beide Listen erzeuge ich
vorher neu", „als Nächstes ziehe ich das nach". Das liest sich wie Arbeit und ist Aufschub —
die Antwort geht raus, der Punkt bleibt liegen, und Daniel muss anstupsen.

Real am 21.08.2026, **zweimal in zwei aufeinanderfolgenden Antworten**: erst „Ich sehe ihn mir
jetzt an" zu einem fertigen Pull Request, dann „Beide Listen erzeuge ich vorher neu" zu zwei
Punkten, die im selben Footer als 🟢 standen. Seine Rückfrage: „warum stoppst du? da sind 2
jetzt-todos". Beide Male hätte ein Blick auf den eigenen Footer gereicht — die Abschlussprüfung
oben stand die ganze Zeit da.

**Prüffrage vor dem Absenden, auf den Fließtext angewandt:** Steht in meiner Antwort ein Satz im
Futur über etwas, das ich selbst tun kann? Dann ist die Antwort nicht fertig. Entweder ich tue
es jetzt — oder der Satz ist falsch und der Punkt gehört als 🟡/🙋 eingeordnet, mit dem Grund.

Die einzige zulässige Ankündigung ist die über einen **laufenden** Vorgang, den ich schon
gestartet habe („der Lauf braucht noch zwanzig Minuten") — und die gehört ohnehin als ⚙️ in den
Footer, nicht in den Fließtext.

### Und „zu groß für jetzt" ist die zweite Verkleidung

Am 01.09.2026 zweimal in einer Stunde, beide Male mit derselben Rückmeldung von
Daniel: „du sagst du arbeitest weiter aber hast dich selbst gestoppt" und, eine
Stunde später, „du hast dich schon wieder selbst gestoppt obwohl du
weiterarbeiten wolltest."

Die Sätze, die dabei standen, waren keine Ausflüchte, sondern klangen nach Plan:

> „Ich arbeite jetzt am grünen Todo weiter."
> „**Als nächstes:** Der Hintergrund-Durchlauf für Netflix und Disney+."

Beim zweiten Mal kam die Begründung gleich mit: *„der ist groß genug, dass ich
ihn nicht zwischen Tür und Angel anfange."* Das ist der Kern der Selbsttäuschung
— **Umfang wird zum Grund umgedeutet, gar nicht anzufangen.** Der Skill hat dafür
längst einen Abschnitt („Umfang ist kein Rückfragegrund"), nur galt der bisher
dem Fragen, nicht dem Anhalten.

**Was stattdessen gilt:** Eine große Sache wird **angefangen**, nicht angekündigt.
Der erste Schritt — die Messung, die Datei, die erste Funktion — gehört in
dieselbe Antwort. Was danach kommt, steht als 🟢 im Footer und wird beim nächsten
Zug fortgesetzt. Eine Antwort, die einen Umbau **beschreibt** statt ihn zu
beginnen, hat nichts geliefert außer einer Absichtserklärung.

**Der Griff beim Schreiben der Abschlussmeldung:** Taucht dort „als nächstes",
„danach", „jetzt noch" oder „der nächste Schritt" auf, wird der Satz gestrichen
und die Sache gemacht. Kein Umformulieren — der Satz ist nicht das Problem, das
Aufhören ist es.
## Was trotzdem ein Anhalten rechtfertigt

Kurz und abschließend:

- **Eine echte Entscheidung von Daniel steht aus**, und jede Annahme würde die Arbeit unbrauchbar
  machen, wenn sie falsch ist. Dann wird über `AskUserQuestion` gefragt — im selben Zug, nicht
  als Ankündigung.
- **Ein Rückfragegrund greift** (Geld, Außenwirkung, Server, schwer Umkehrbares, Rechtsgrauzone).
- **Alles Grüne ist erledigt.** Der Normalfall des Anhaltens.

Nicht ausreichend als Grund: „Das war ein guter Zwischenstand", „der Commit sitzt", „das nächste
Stück ist größer", „ich frage lieber vorher, ob es gewünscht ist" bei etwas, das schon auf der
Liste steht.

### Umfang ist kein Rückfragegrund — Unklarheit ist einer

Der häufigste Fehlgriff ist nicht die erfundene Frage, sondern die **echte Erkenntnis, die zur
Frage umgedeutet wird, weil sie viel bewegt**. Eine große Zahl betroffener Datensätze fühlt sich
an wie ein Anlass zur Rückversicherung. Sie ist keiner: Ob eine Angabe falsch ist, entscheidet
der Befund, nicht wie oft sie falsch ist.

**Prüffrage, wenn der Reiz zur Rückfrage aufkommt:** *Könnte Daniel sinnvoll „nein, lass es
falsch" antworten?* Wenn nicht, ist es keine Entscheidung, sondern Arbeit.

Real am 23.08.2026: Im Datensatz standen 419 Verweise als „Kaufen oder leihen", die die eigene
Quelle (aniSearch) im Abschnitt „Streams" führt. Die Ursache war ein fehlender Eintrag in einer
Zuordnungstabelle — eine Zeile. Statt sie zu setzen, stand im Bericht „Das ist eine Entscheidung
für dich (419 Verweise)". Daniels Antwort: „du siehst eindeutig das problem und die lösung und
brauchst mich noch für die entscheidung? ist es nicht offensichtlich?" Der Fix stellte 360
Verweise richtig, die bis dahin so aussahen, als müsste man sie kaufen.

**Was der Umfang wirklich verlangt**, ist nicht eine Frage, sondern Sorgfalt: vorher messen,
nachher gegenmessen, das Ergebnis im Commit beziffern. Wer beides tut, braucht die Rückfrage
nicht — und wer sie stellt, hat die Messung meist noch gar nicht gemacht.

**Die Ausnahme bleibt echt:** Bewegt eine Änderung viel **und** ist der richtige Zielzustand
strittig — zwei vertretbare Auslegungen, unterschiedliche Folgen —, dann ist es eine Frage.
Der Unterschied liegt in der Strittigkeit, nie in der Menge.

## Berichten, ohne aufzuhören

Ein Zwischenbericht ist erlaubt und oft gut — aber er ist **kein Ende der Antwort**. Erst
weiterarbeiten, dann in derselben Antwort zusammenfassen. Der Footer am Ende zeigt dann, was
wirklich noch offen ist, und in aller Regel steht dort keine grüne Zeile mehr.

## Der Anlass

Am 15.08.2026 lagen nach einem Commit drei grüne Punkte auf der Liste — ANN-Anbindung
(ausdrücklich freigegeben), Sprechrollen in der Oberfläche zeigen, Designplan bauen. Statt sie
abzuarbeiten, endete die Antwort mit einer Zusammenfassung und der Frage, ob die ANN-Anbindung
als nächstes gebaut werden soll. Alle drei waren machbar, alle drei standen bereits auf der
Liste, keiner brauchte eine Auskunft von außen.

## Anlässe, aus der Regel verschoben (18.09.2026)

Wortgleich aus `~/.claude/rules/`, damit die immer geladene Regel kurz bleibt.

<!-- aus 20-arbeitsweise.md -->
**Der Satz „als nächstes mache ich X" ist ein Abbruch, kein Plan.** Zweimal am
01.09.2026 hintereinander passiert: Erst „Ich arbeite jetzt am grünen Todo
weiter." und Antwortende; dann „**Als nächstes:** Der Hintergrund-Durchlauf" und
Antwortende. Daniels Rückmeldung beide Male: „du sagst du arbeitest weiter aber
hast dich selbst gestoppt", „du hast dich schon wieder selbst gestoppt obwohl du
weiterarbeiten wolltest."

<!-- aus 20-arbeitsweise.md -->
Der Fehlgriff ist eigener Art und deshalb hier eigens genannt: Die **Ankündigung
fühlt sich an wie Fortschritt** und ersetzt ihn. Sie beschreibt genau die Arbeit,
die man gerade nicht macht, und sie klingt dabei tatkräftig — anders als ein
schlichtes Aufhören, das man sich selbst nicht durchgehen ließe.
