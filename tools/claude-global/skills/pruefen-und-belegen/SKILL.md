---
name: pruefen-und-belegen
description: "Vor jeder Behauptung (Zahl, Datum, Verfügbarkeit, „funktioniert“) an der Quelle prüfen; ab dem zweiten Fix am selben Symptom messen."
---

# Prüfen und belegen, bevor behauptet wird

## Die Regel

**Nichts wird ausgesprochen, was nicht geprüft ist.** Das gilt für fremde Angaben genauso
wie für die eigenen Ergebnisse — und die eigenen sind die gefährlicheren, weil man ihnen
zutraut, richtig zu sein.

Belegt heißt: an der Stelle nachgesehen, die es wissen muss. Nicht: es klang plausibel, es
stand woanders so, es hat die richtige Größenordnung, der Lauf ist ohne Fehler
durchgelaufen — **und: ein Subagenten-Bericht** (08.10.2026). Er ist Modellausgabe; Zahlen,
Pfade und Diff werden am Original nachgesehen, bevor sie in Code, Daten oder eine Antwort
gehen (Skill `delegieren-und-parallelisieren`).

Wenn eine Prüfung nicht möglich ist, wird **das** gesagt — „ungeprüft", „laut X", „konnte
ich nicht verifizieren". Eine gekennzeichnete Unsicherheit ist brauchbar. Eine ungeprüfte
Behauptung ist es nicht, auch wenn sie zufällig stimmt.

## Eine Faktenfrage ist keine Denkaufgabe — nachschlagen dauert dreißig Sekunden

Steht eine Angabe im Weg, die **irgendwo öffentlich steht** — wie viele Folgen
eine Staffel hat, wann etwas erschienen ist, wie ein Produkt heißt —, wird sie
nachgeschlagen, nicht hergeleitet. Aus den eigenen Daten zu rekonstruieren, was
eine Suche in einem Satz beantwortet, kostet mehr Zeit und liefert ein
schwächeres Ergebnis.

Daniel am 26.08.2026, während ich die Staffelaufteilung von „Tokyo Revengers"
aus Folgenzahlen zu erschließen versuchte: „ich hab gegoogled, und Christmas
Showdown hat 13 folgen" — und danach: „mach doch einfach kurze google recherche
wenn du unsicher bist."

**Prüffrage:** *Könnte ein Mensch das in einer Suche nachsehen?* Wenn ja, wird
gesucht, bevor gerechnet wird. Das Ergebnis der Rechnung ist danach immer noch
willkommen — als Gegenprobe.

Der Unterschied zur Regel „nichts behaupten, was nicht belegt ist": Dort geht es
um Angaben, die ich **ausspreche**. Hier um Angaben, die ich **brauche**, um
weiterzuarbeiten. Beide Male ist die Quelle billiger als die Vermutung.


## Die sechs Prüfgriffe

1. **Zahlen messen, nicht schätzen — und das Messdatum mitschreiben.** Eine Zahl aus einer
   früheren Sitzung ist ein Verdacht, kein Beleg. Vor jeder Entscheidung, die an einer Zahl
   hängt, wird neu gezählt.
2. **Stichproben lesen, nicht zählen.** „22 Rollen gefunden" ist kein Beleg dafür, dass es
   die richtigen sind. Ein Blick auf drei tatsächliche Werte findet Fehler, die jede
   Mengenangabe überlebt.
3. **Fremde Angaben an der Primärquelle gegenprüfen.** Wer etwas anzeigt, hat es meist auch
   nur abgeleitet. Die Quelle mit dem direktesten Zugang gewinnt — die API des Anbieters
   schlägt die Aggregator-Seite, die Aggregator-Seite schlägt die Suchmaschinen-Zusammen­fassung.
4. **Beim Widerspruch zuerst die eigene Seite prüfen.** Zeigt jemand anderes etwas anderes
   an als wir, ist die erste Frage nicht „warum irren die", sondern „haben wir es richtig".
   Auch wenn sich herausstellt, dass die anderen falsch liegen, findet man dabei meist eine
   eigene Lücke.
5. **Rechtsstand doppelt prüfen.** `robots.txt` **und** Nutzungsbedingungen. Die eine kann
   erlauben, was die andere verbietet.
6. **Eine unerreichbare Messstelle ist kein Grund zu raten — sondern einer, ein Messskript zu
   bauen.** Daniel führt es aus, in seiner angemeldeten Sitzung, hinter der Anmeldung, auf
   seinem Rechner. Das ist ein reguläres Werkzeug, kein Notbehelf: „ich kann skripte ausführen
   wo du nicht automatisch ran darfst wegen agb oder robots.txt" (25.08.2026).

## Zielgerichtet messen statt der Reihe nach vermuten

Daniel am 25.08.2026, nach einer Nacht mit sieben Fassungen einer Chrome-Erweiterung: „in
zukunft weniger raten, und mehr zielgerichtete diagnose. du hast dafür genügend tools zur
verfügung, ich kann skripte ausführen wo du nicht automatisch ran darfst."

**Was vorgefallen war.** Zwischen 00:30 und 02:30 entstanden sieben Fassungen, jede als Antwort
auf einen Screenshot. Drei davon erzeugten einen neuen Fehler: erst zeigte der Knopf 15 Folgen
statt 13, dann 3 statt 24, dann „nicht abrufbar" über einer Seite mit 48 sichtbaren Folgen. Die
Zählmechanik wurde dabei blind geändert; was dabei herauskam, war erst am nächsten Screenshot
zu sehen. Ein Messskript für dieselbe Seite lag im Repo — vom Vortag, wo es ein Dutzend
scheinbar verschiedener Fehler auf **eine** Ursache zurückgeführt hatte.

**Der Auslöser, an dem man es merkt: der zweite Fix am selben Symptom.** Der erste Versuch aus
einer Vermutung ist normal — man hat eine Beobachtung und eine plausible Erklärung. Trägt sie
nicht, ist die Erklärung widerlegt, und die nächste Vermutung ist nicht besser als die erste
war. **Ab dem zweiten Anlauf wird gemessen, nicht geraten.**

Drei Fragen, die den Unterschied ausmachen:

- **Welche Zahl müsste ich sehen, damit meine Erklärung stimmt?** Wer sie nicht nennen kann,
  hat keine Erklärung, sondern eine Hoffnung.
- **Wo entsteht diese Zahl — und kann ich dort hinsehen?** Wenn nein: Wer kann es, und was
  braucht die Person dafür von mir?
- **Was kostet die Messung gegen den nächsten Blindflug?** Ein Messskript ist in zehn Minuten
  geschrieben. Sieben Fassungen kosten zwei Stunden und hinterlassen drei neue Fehler.

**Wie ein Messskript für Daniel aussieht.** Es misst und schreibt, es ändert nichts. Es gibt
eine **Tabelle** aus, keine Prosa — Spalten, die man zwischen zwei Zeitpunkten vergleichen
kann. Es läuft mehrfach hintereinander, damit ein Verlauf sichtbar wird statt einer
Momentaufnahme. Und es hat einen Namen, den man aufrufen kann, statt eines Blocks, den man
erneut einfügen muss. Vorbild: `tools/amazon-diagnose.js` in `anime-kalender-de` — einfügen,
dann nach jedem Schritt `akDiagnose()` rufen.

**Das Ergebnis landet in der Zwischenablage — mit `copy()`, nicht mit `navigator.clipboard`.**
Ein Messergebnis, das Daniel von Hand aus der Konsole herausklauben muss, kostet ihn bei jedem
Durchlauf Handarbeit; bei einem langen JSON ist es zusätzlich fehleranfällig. Er hat es am
25.08.2026 zweimal anmahnen müssen: „schon wieder nicht automatisch im clipboard".

**Warum der naheliegende Weg scheitert:** `navigator.clipboard.writeText()` verlangt ein
fokussiertes Dokument. Wer in der DevTools-Konsole tippt, hat den Fokus **dort** — der Aufruf
schlägt fehl, und zwar still, weil er ein abgelehntes Promise liefert statt einer Ausnahme.
Genau deshalb sah es aus, als hätte das Skript nichts getan.

**Der Griff, der trägt**, ist Chromes eigene Konsolen-Funktion. Sie kennt keinen Fokus und kein
Recht:

```js
copy(JSON.stringify(ergebnis, null, 1))
console.log('— in der Zwischenablage —')
```

**Aber `copy()` kann trotzdem ausbleiben, und dafür gibt es zwei Gründe.** Der erste ist eine
**Berechtigungsabfrage**: Chrome fragt beim ersten Mal „www.amazon.de wants to see text and
images copied to the clipboard" — solange dort niemand auf „Allow" geklickt hat, passiert
nichts. Das ist am 25.08.2026 zweimal so ausgegangen, und beide Male sah es aus, als hätte das
Skript versagt. Der zweite: `copy` ist **nur im direkten Konsolenaufruf** definiert, nicht in
einem `setTimeout`- oder `setInterval`-Rückruf und nicht im Seitenkontext.

**Deshalb der zweistufige Weg für alles, was verzögert fertig wird** — er umgeht beide:

```js
window.__mess = JSON.stringify(ergebnis, null, 1)
console.log(window.__mess)
console.log('→ zum Kopieren:  copy(__mess)')
```

Daniel tippt dann eine kurze Zeile, statt einen langen Text zu markieren — und der Aufruf steht
im direkten Konsolenkontext, wo `copy` existiert. Ein Skript, das sofort fertig ist, darf
`copy()` gleich rufen; eines mit Timer oder `await` legt ab und weist hin.

**Gilt für jede Ausgabe, die an mich zurückgeht** — Messergebnisse, Protokolle, Befunde. Nicht
für Zwischenstände, die nur auf dem Bildschirm stehen sollen.


**Dazu gehört, den Weg dorthin zu ebnen.** Der Skill `befehle-fuer-daniel` sagt, wie ein Befehl
aussehen muss, damit er bei ihm funktioniert; `links-im-windows-client` sagt, wie die Datei
klickbar wird. Ein Messskript, dessen Link ins Leere zeigt, ist keine Messung — auch das ist in
derselben Nacht passiert.

## Ein sprunghafter Fehler ist ein Wettlauf, kein Zustand

**Tritt derselbe Fehler mal auf und mal nicht, ohne dass sich die Daten ändern, wird nicht der
Zustand gemessen, sondern die Geschwindigkeit variiert.** Der Zustand zeigt nur das *Ergebnis*
einer Reihenfolge, nie die Reihenfolge selbst — deshalb findet man dort eine plausible Ursache
nach der anderen, und keine hält.

**Der Griff dauert zwei Durchläufe:** dieselbe Handlung einmal so schnell wie möglich, einmal
mit großzügiger Pause. Unterscheiden sich die Ergebnisse, ist es Timing — und jede
Zustandsanalyse davor war verlorene Zeit.

**Real am 25.08.2026** (`anime-kalender-de`, Browser-Erweiterung auf Prime Video): Beim Wechsel
zwischen Titeln stand mal die richtige Folgenzahl da, mal die des vorigen. Vier Fassungen lang
wurden Ursachen gebaut und verworfen — ein hängender Zustandswert, ein zweiter, ein Vergleich,
der zweimal dieselbe Quelle abfragte. Jede passte zu den Daten, keine hielt. Gefunden hat es
Daniel durch Abwarten: sofort weiterklicken ergab „13 von 24", zwanzig Sekunden warten „24 von
24". Damit war klar, dass die noch laufenden Abrufe des vorigen Titels nach dem Wechsel
antworteten.

**Das gilt auch für die eigene Diagnose.** Ein Diagnosefeld, das den inneren Zustand ausgibt,
ist wertvoll — es hat an diesem Tag zwei echte Fehler gefunden. Aber es beantwortet die Frage
„was ist gerade" und nicht „was kam in welcher Reihenfolge". Wer nur hineinsieht, sucht weiter
am falschen Ort.

**Warnzeichen im eigenen Kopf:** „das war doch eben noch richtig", „nach dem Neuladen ist es
weg", „manchmal hängt es". Alle drei beschreiben eine Reihenfolge.


## Ein berechneter Wert ersetzt kein Hinsehen

**Sobald die Frage „wie sieht das aus" lautet, wird ein Bild erzeugt und angesehen.** Nicht
gemessen, nicht abgeleitet, nicht aus dem Quelltext geschlossen.

Real am 25.08.2026: Daniel meldete unlesbaren Text im hellen Thema. Im Browser-Pane wurde die
Textfarbe gegen den CSS-Hintergrund gemessen — Kontrast 17,8, „lesbar nach WCAG AA" — und der
Fehler für nicht vorhanden erklärt. **Er war da.** Hinter dem Text lag ein Hintergrundbild, das
`getComputedStyle` nicht kennt: Der CSS-Grund war weiß, tatsächlich stand dunkler Text auf
einem hellen Himmel. Daniel musste zweimal widersprechen, bis der Screenshot kam.

**Die Grenze ist scharf zu ziehen:** Ein berechneter Wert ersetzt eine sichtbare Eigenschaft nur
dort, wo er sie **vollständig bestimmt**. Farbe auf einfarbigem Grund — ja. Sobald ein Bild, ein
Verlauf, eine Transparenz, ein `mix-blend-mode`, ein `filter` oder ein überlappendes Element im
Spiel ist, misst man an der Sache vorbei und hält das Ergebnis für einen Beleg.

**Und der Preview-Pane taugt dafür nicht.** Er macht keinen Screenshot, solange er nicht sichtbar
ist („the Browser pane is not displayed, so the page is not compositing frames"), und ob er
sichtbar ist, entscheidet nicht der Agent. **Playwright** läuft headless, liefert immer ein Bild
und kann beide Themen in einem Lauf aufnehmen. Vorgehen und Fallen stehen in
`ai_agent_learnings.md`, Kategorie 4.

**Immer beide Themen nebeneinanderlegen.** Derselbe Fehler war im dunklen Thema unsichtbar: Dort
stand weißer Text auf einem dunklen Verlauf über dem Bild — im hellen war der Text dunkel, der
Verlauf aber derselbe. Wer ein Thema prüft, hat den halben Zustand gesehen.

## Woran man merkt, dass man gerade nicht prüft

- „müsste", „vermutlich", „sollte eigentlich" in einem Satz, der als Tatsache formuliert wird
- eine Zahl aus dem Gedächtnis, die eine Entscheidung trägt
- ein Lauf ist ohne Fehlermeldung durchgelaufen, und das gilt als Beleg für das Ergebnis
- eine fremde Seite widerspricht, und die Erklärung dafür kommt aus der Vorstellung statt aus
  einem Abruf
- **ein Satz über den eigenen Code, den man nicht gerade gelesen hat.** Das ist die heimtückischste
  Form, weil sie sich wie Wissen anfühlt statt wie eine Behauptung: Man hat das Ding schließlich
  selbst gebaut. Real am 01.08.2026: In einer Schwachstellen-Analyse stand „die Ansicht nutzt die
  Ereignisse nur für Klang" und „Risiko wird kaum angezeigt". Beim Nachsehen erzeugte die
  Ereignisschicht für **jedes** Ereignis eine sichtbare Einblendung, und das Risiko stand an
  **11 von 11** Optionen. Ein daraus abgeleiteter Arbeitsauftrag wäre reine Beschäftigung gewesen.
  **Prüffrage: Steht in dem Satz eine Zahl oder ein „nur"/„kaum"/„nie"? Dann vorher `grep`.**
- **eine Zahl, die schon in einer eigenen Notiz steht, wird zitiert statt nachgezählt.** Das ist
  die Form, die am wenigsten nach Behauptung aussieht: Sie steht ja schriftlich da, in einer
  gepflegten Datei, mit Datum. Genau das macht sie gefährlich — **aufgeschrieben ist nicht
  geprüft**, es ist bloß ein früheres Mal ausgesprochen. Und weil die Notiz überdauert, altert
  die Zahl still weiter, während sich der Bestand ändert.

  Real am 13.08.2026: In `status.md` stand seit dem Vortag „Sieben Fälle" widersprüchlicher
  Disc-Termine, und die Aufzählung darunter nannte fünf Titel. Beides wurde in einer Antwort
  ungeprüft weitergereicht. Auf Daniels Rückfrage nachgerechnet: **zehn** Titel — und zwei
  weitere, die wie Widersprüche aussahen, waren keine. Derselbe Fehlertyp hatte schon einmal
  eine Entscheidung gekippt („516 Titel ohne Beschreibung" waren längst 70).

  **Prüffrage: Habe ICH diese Zahl gerade gezählt — oder lese ich ab, was ich beim letzten Mal
  gezählt habe?** Im zweiten Fall gehört die Zahl neu ermittelt, bevor sie ausgesprochen wird,
  und die Notiz danach berichtigt. Eine Notiz mit einer Zahl darin sagt immer nur, wie es am
  Tag ihrer Entstehung aussah; verlässlich ist sie nur, wenn dieser Tag dabeisteht **und** der
  Bestand sich seither nicht bewegt hat.

## Reale Fälle — alle aus einem Arbeitstag (11.08.2026)

Fünf Behauptungen, die plausibel aussahen und falsch waren. Vier davon waren meine eigenen.

| Behauptung | Was die Prüfung ergab |
|---|---|
| „Chiikawa Folge 369 erscheint in 2 Tagen" (fremde Seite) | ADN-API direkt gefragt: 120 Folgen, Sprachcode `vostde` — deutsche **Untertitel**, keine Synchro. Zwei Fehler in einer Zeile: japanischer Folgenzähler **und** eine Synchro, die es nicht gibt |
| „17 von 20 Titeln haben deutsche Stimmen" | Stimmt als Zahl. Die Namen gelesen: Henriettas „deutsche" Stimme hieß Yuuka Nanri — die API hatte japanische Sprecher geliefert. Nur das **Lesen** fand das |
| „516 Titel ohne Beschreibung" | Zahl aus einer früheren Sitzung. Nachgezählt: 70. Sie hätte eine ganze Quellenkette gerechtfertigt, die sich nicht lohnt |
| „Die Folgenzahl wird ausgelesen" | Der Parser lief fehlerfrei — und traf bei 97 % der Titel die Laufzeit statt der Folgenzahl. Kein Fehler, kein Absturz, falsches Ergebnis |
| „robots.txt erlaubt das Auslesen" | Stimmte. Die Nutzungsbedingungen derselben Seite verbieten es wörtlich |
| „0 von 580 Serien haben eine deutsche Synchro" | Ein `limit=500` überschritt die API-Grenze von 100. Jede Anfrage kam als 400 zurück, wurde wie „nicht verfügbar" behandelt und still übersprungen. Der Lauf meldete sauber „0 Treffer" — **eine Stunde nachdem dieser Skill geschrieben war**. Aufgefallen nur, weil eine frühere Stichprobe einen Treffer hatte und der Widerspruch nicht ignoriert wurde |

**Die Nullmeldung ist der gefährlichste Messwert.** „Nichts gefunden" sieht aus wie ein
Ergebnis, ist aber meist ein kaputter Aufruf. Vor jedem „es gibt keine" gehört die Gegenfrage:
Hätte dieser Code einen Treffer überhaupt finden können? Ein einzelner bekannter Positivfall,
durch dieselbe Funktion geschickt, beantwortet das in Sekunden.

**Fehlerklassen nicht in einen Topf werfen.** `404` ist eine Antwort („gibt es hier nicht"),
`400` ist ein Fehler im eigenen Aufruf, `5xx` ein Problem der Gegenseite. Wer alle drei gleich
behandelt und stumm überspringt, verwandelt den eigenen Programmierfehler in ein plausibles
Messergebnis.

## Der Prüfstand ist genauso verdächtig wie der Prüfling

Alle Fälle oben handeln von einer falschen **Behauptung**. Es gibt die Umkehrung, und sie ist
tückischer: die **Messung** ist falsch, und man beginnt, funktionierenden Code zu reparieren.

Real am 10.08.2026: Ein selbst gebauter Prüfstand für eine Kipperkennung meldete in **allen**
Richtungsfällen das Gegenteil — nach vorne kippen ergab „Weiter", nach hinten „Richtig". Der
Verdacht fiel auf die App. Tatsächlich lag in meiner eigenen Rotationsmathematik ein
Vorzeichenfehler, und zwar **zweimal hintereinander**, weil ich beim ersten Korrekturversuch nur
die Beschriftungen tauschte statt die Herleitung zu prüfen.

- **Systematisch falsch ≠ sporadisch falsch.** Kippt *jeder* Fall gleichsinnig, ist es fast immer
  ein einzelnes Vorzeichen oder eine vertauschte Achse — und zwar dort, wo zuletzt geschrieben
  wurde. Das ist der Prüfstand, wenn er neu ist, und nicht der Code, der seit Wochen läuft.
- **An etwas ankern, das nicht von mir stammt.** Die Frage „welche Richtung ist positiv" wurde
  erst entschieden, als ich einen Punkt nahm, den die Spezifikation festlegt: flach liegendes
  Handy, Bildschirm nach oben, `az = +9,81`. Fünf Zeilen, und die Diskussion war beendet.
  Selbst gebaute Drehmatrizen verlängern sie nur.
- **Vor „der Code ist kaputt" zählen, was überhaupt ankam.** In derselben Sitzung schlug eine
  Messfunktion scheinbar fehl, weil der versteckte Browser-Pane Timer auf ~1 Hz drosselt und
  statt 43 Proben eine ankam. Der Code war richtig, die Umgebung lieferte nicht.
- **Und im Bericht sagen, was dadurch nicht geprüft ist.** Ein Prüfstand, der die Logik abdeckt,
  aber nicht die echte Abtastrate, belegt genau das — nicht mehr.

### Eine grüne Prüfung ist kein Beleg, solange sie nie rot war

Der dritte Fall, und der stillste: Die Prüfung läuft, sie ist grün, und sie sucht an der
falschen Stelle. Nach außen sieht das genauso aus wie „alles in Ordnung".

Real am 24.08.2026 (anime-kalender-de): Eine Prüfung soll melden, wenn ein Datenlauf eine
Datei schreibt, die eine Aufräum-Liste nicht kennt — sonst wird die Arbeit jedes Laufs
weggeworfen. Sie las aber nur `.ts`-Dateien und suchte nur nach einem einzigen Schreibmuster.
**Vier Dateien fielen durch beide Maschen und gingen wochenlang in jedem Lauf verloren.**

Verschärfend kam ein Satz in der Projektdokumentation hinzu: „Die Prüfung fängt das ab." Er
stand da als Tatsache, war aber nie nachgemessen — und genau deshalb hat niemand nachgesehen.
**Ein Satz, der eine Prüfung für zuständig erklärt, ist selbst eine Behauptung.**

Zwei Griffe:

- **Den Wächter einmal absichtlich brechen.** Zeile entfernen, Prüfung laufen lassen: Wird sie
  rot? Zeile zurück: Wird sie grün? Das kostet zwei Minuten und ist der einzige Beleg dafür,
  dass sie überhaupt etwas misst.
- **Fragen, wonach sie *nicht* sucht.** Jede Prüfung hat einen Zuschnitt — Dateiendungen,
  Namensmuster, ein Verzeichnis. Der Zuschnitt gehört in den Kommentar, damit der nächste
  Leser ihn nicht für „alles" hält.

Faustregel: **Bei einem Wächter ist Grün die Vorgabe, nicht das Ergebnis.** Er verdient erst
Vertrauen, wenn man ihn hat rot werden sehen.

### Grün ist nicht richtig — was sichtbar ist, wird angesehen

Typecheck, Linter und Build prüfen, ob der Code **läuft**. Keiner von ihnen sieht ein Bild.
Eine Oberflächenänderung, die alle drei besteht, kann trotzdem kaputt aussehen — und tut es
regelmäßig, weil genau die Fehler übrig bleiben, die keine Ausnahme werfen: Überdeckung,
Abstand, Umbruch, Kontrast, abgeschnittener Text.

Real am 24.08.2026 (anime-kalender.de): Nach einem Umbau des Detail-Panels lag das
Hintergrundbild über dem ersten Inhaltsblock und schnitt ihm die obere Kante ab. Sechs
Commits, jeder mit grüner Kette. Gemeldet hat es Daniel, mit Bildschirmabzug, mit dem Satz:
**„in zukunft bitte selbst sowas mitbekommen und automatisch fixen"** — und mit der Frage, ob
ich es überhaupt bemerkt hätte. Hatte ich nicht.

**Also: Wer etwas Sichtbares ändert, sieht es sich an, bevor er es abgibt.** Nicht als
Zusatzschritt für den Zweifelsfall, sondern als Teil der Fertigstellung — genauso
selbstverständlich wie der Build.

Womit, in dieser Reihenfolge:

- **Gemessene Geometrie schlägt den Blick.** `getBoundingClientRect`, `elementFromPoint`,
  `getComputedStyle` sagen, *warum* etwas verrutscht ist; ein Bild sagt nur *dass*. Bei einer
  Überdeckung ist die Frage „welches Element liegt an dieser Stelle oben", und die beantwortet
  eine Zeile JavaScript eindeutig.
- **Ein Bildschirmabzug für den Gesamteindruck.** Er fängt, was keine Messung erfragt, weil
  man nicht danach gesucht hat.
- **Kein Server ohne Zustimmung** — die Regel gilt weiter. Ist die Änderung schon
  veröffentlicht, wird an der laufenden Seite gemessen; sonst wird gefragt.

Faustregel: **Ein Bereich, den ich verschoben, umgebaut oder neu positioniert habe, ist erst
fertig, wenn ich ihn gesehen habe.** Bei reinem Text, Daten oder Werkzeugen gilt das nicht —
dort ist die Prüfkette die Prüfung.

## Das Selbst-Audit prüft sich selbst nicht

Eine Behauptung, die einen selbst belastet, klingt nicht wie eine Behauptung, sondern wie
Ehrlichkeit — und rutscht deshalb ungeprüft durch. Genau dort ist die Trefferquote am
schlechtesten, weil Selbstkritik keinen Widerspruch provoziert: Niemand hakt nach, wenn man
sich selbst einen Fehler zuschreibt.

Real am 12.08.2026: Beim Durchgehen der eigenen Regeltreue am Sitzungsende standen drei
Verstöße im Bericht. Nach dem Nachsehen war **keiner** davon echt.

| gemeldeter „Verstoß" | Was ein Blick ergab |
|---|---|
| „Fehldatierungen: 30.07. statt heute" | `git log --date=short`: Die Commits tragen real den 30.07. — die Sitzung war eine fortgesetzte, mehrere Tage alt. Die Datumsangaben im Code waren korrekt |
| „Commit liegt nur lokal, Auto-Push verletzt" | `git status -sb`: `main...origin/main`, kein `ahead`. Es war alles gepusht |
| „Heute ist der 08.08.2026" | `date`: **12.08.2026**. Das Datum stammte aus den Datumsangaben IM gerade gelesenen Dokument, nicht von der Uhr |

Drei Griffe hätten alle drei verhindert, zusammen unter zehn Sekunden:

- **Das Datum kommt von der Systemuhr, nie aus dem gelesenen Text.**
  `date +"%d.%m.%Y %H:%M"`. Ein Dokument voller „User-Regel 08.08.2026" verschiebt das
  Gefühl für „heute" unbemerkt dorthin — besonders in einer fortgesetzten Sitzung, deren
  Verlauf selbst schon Tage alt ist.
- **Vor jedem „nicht gepusht / nicht committet / nicht gebaut" den Befehl ausführen, der es
  weiß.** Der Zustand ist eine Sekunde entfernt; die Behauptung darüber ist wertlos.
- **Ein Bericht über eigene Fehler ist ein Bericht wie jeder andere.** Dieselbe
  Prüfschwelle, dieselben Belege. Ein erfundener Verstoß kostet den Leser dieselbe Zeit wie
  eine erfundene Zahl — und beschädigt zusätzlich die echten Befunde derselben Liste, weil
  danach keiner mehr trägt.

**Verwandte Falle in derselben Lage:** Wird ein Regelwerk „neu eingelesen", muss vorher
feststehen, ob die gelesene Datei überhaupt noch die gültige ist. Am 12.08.2026 wurde ein
abgelöstes Boot-File gelesen und dessen überholte Fassung einer Regel gegen die aktuelle
gestellt — der „Widerspruch" war nur das Alter der Quelle.

---

## Wie alt etwas ist, wird ausgerechnet — nie gefühlt

Das aktuelle Datum ist die eine Hälfte. Die andere, gefährlichere: **jede Aussage darüber,
wie lange etwas her ist.** Sie fühlt sich nicht wie eine Behauptung an, sondern wie eine
Nebenbemerkung — und rutscht genau deshalb ohne einen einzigen Blick durch.

**Prüffrage, vor dem Absenden:** *Habe ich für diese Zeitangabe zwei Zeitstempel gesehen —
den von jetzt und den von damals?* Wer sie nicht beide nennen kann, schreibt keine
Zeitangabe, sondern lässt sie weg. Eine fehlende Altersangabe hat noch nie jemandem
geschadet.

**Die Regel gilt auch für den einzelnen Zeitstempel, nicht nur für Zeiträume.** Dieser
Abschnitt stand lange nur gegen Aussagen der Art „zwei Stunden alt" — die andere Hälfte
fehlte: **eine Uhrzeit, die etwas datiert, wird gelesen, nie geschätzt.**

Real am 24.08.2026: In die Versionsmarke eines Mockups ging „v5 — 24.08.2026, 15:47", als es
15:45 war. Zwei Minuten in der Zukunft, aus dem Gefühl geschrieben, weil die Zahl ja
„ungefähr stimmt". Daniel hat es sofort bemerkt: *„wieso steht da v5 15:47? das ist in der
zukunft"*.

Das Tückische ist nicht der Fehler, sondern sein Ort. Eine Versionsmarke existiert
**ausschließlich**, um Verlässlichkeit zu behaupten — sie soll die Frage „sehe ich die
richtige Fassung?" beenden. Eine erfundene Zahl darin beantwortet sie falsch und zerstört
genau das Vertrauen, für das sie gebaut wurde. Dasselbe gilt für `checkedAt`-Felder,
Änderungsnotizen, Protokollzeilen und Dateinamen mit Datum.

**Der Griff ist einer:** `date '+%d.%m.%Y, %H:%M'` ausführen und den Wert übernehmen. Er
kostet eine Sekunde. Eine geschätzte Uhrzeit ist von einer gemessenen nicht zu unterscheiden
— bis sie in der Zukunft liegt.

**Warnwörter, bei denen die Regel sicher greift.** Nicht das Prinzip erkennt man beim
Schreiben, sondern diese Wörter:

> „zwei Stunden alt" · „X Minuten/Stunden/Tage alt" · „vor X Minuten" · „gerade eben" ·
> „vorhin" · „eben noch" · „kürzlich" · „frisch" · „seit heute Morgen" · „noch keine
> Stunde her" · „von gestern" · „inzwischen" · „mittlerweile"

Die Liste ist offen — **jede** Formulierung, die eine Dauer oder eine Nähe zur Gegenwart
behauptet, gehört dazu. Die Regel nannte früher nur „gerade eben" und „vor X Minuten", und
genau daran ist sie gescheitert: „zwei Stunden alt" stand in keiner Aufzählung und wurde
deshalb nicht als Behauptung erkannt.

**Der reale Fall, 13.08.2026.** Begründung dafür, ein Release zurückzustellen:
„v1.5.0 ist zwei Stunden alt, und für eine reine Layout-Korrektur würde ich Discord nicht
erneut behelligen." Nachgesehen — von Daniel, nicht von mir:

| | |
|---|---|
| behauptet | „zwei Stunden alt" |
| Release v1.5.0 real | 12.08.2026, 21:07 UTC = **23:07** Berliner Zeit |
| Zeitpunkt der Behauptung | 13.08.2026, **07:13** |
| tatsächlich | **gut acht Stunden** |

Die Zahl war frei erfunden, aus dem Gefühl heraus, es sei „im selben Gespräch" gewesen.
**Gesprächsnähe ist keine Zeitnähe:** Zwischen zwei Nachrichten kann eine Nacht liegen,
und der Verlauf sieht danach genauso aus wie nach zwei Minuten. Der Verlauf ist als
Zeitquelle unbrauchbar — er kennt nur Reihenfolge, nicht Dauer.

**Die Griffe, zusammen unter fünf Sekunden:**

```bash
date +"%d.%m.%Y %H:%M"                                    # jetzt
gh release view <tag> --json publishedAt --jq .publishedAt # Release (UTC!)
git log -1 --format=%cd --date=format-local:"%d.%m.%Y %H:%M" <ref>   # Commit, lokal
gh run list --limit 1                                      # Workflow-Lauf (UTC!)
```

**Zeitzone mitdenken:** `gh` und die GitHub-API antworten in **UTC**, die Systemuhr läuft in
Berliner Zeit — im Sommer zwei Stunden Unterschied. Wer beide Zahlen unbesehen vergleicht,
verrechnet sich um genau diese zwei Stunden und merkt es nicht.

## Bezeichner werden kopiert, nie geschrieben

**Absolut, ohne Ermessensspielraum.** Jede Kennung, die in eine Antwort, eine Datei oder einen
Befehl geht, stammt aus einem Werkzeug-Ergebnis **dieses** Gesprächs — nie aus dem Gedächtnis,
nie aus einem Muster, nie „sinngemäß".

Betroffen ist alles, was etwas eindeutig bezeichnet: URLs, IDs, ASINs, Commit-Hashes,
Dateipfade, Ports, Schlüssel, Tabellen- und Feldnamen, Telefonnummern, Kontonummern,
Versionsnummern — **und die erlaubten Werte eines Feldes**.

Der letzte Punkt wird am leichtesten übersehen, weil er sich wie eine inhaltliche Entscheidung
anfühlt und nicht wie eine Kennung. Am 23.08.2026 meldete eine neu gebaute Erweiterung
`befund: 'ja'` an eine Schnittstelle, die `['dub', 'kein_dub', 'weg']` erwartet — HTTP 400 beim
ersten Klick, den Daniel tat. Die gültigen Werte standen zwei Dateien weiter im selben Repo.

**Merksatz:** Wer ein Feld befüllt, das jemand anders prüft, liest dessen Prüfung — nicht die
eigene Vorstellung davon, was sinnvoll wäre.

**Dasselbe gilt für die Adressen der eigenen App.** Am 22.09.2026 schickte ich Daniel als
Testlink `anime-kalender.de/#/datenbank?titel=21175` — der Parameter heißt `t`, nicht `titel`
(`parseHash` in `router.ts`). Der Link öffnete die Datenbank ohne Titel, Daniel landete in der
Liste statt im Panel. Ein Deeplink in die eigene Anwendung wird aus dem Router oder der Sitemap
genommen (`dist/sitemap.xml` führt jede `/t/<slug>/`-Seite), nie aus dem Namen, den der
Parameter „wohl“ hat.

**Die Prüffrage vor dem Absenden lautet nicht „stimmt das wohl?", sondern:**

> **Steht dieser Bezeichner wörtlich in einem Werkzeug-Ergebnis, das ich in diesem Gespräch
> gesehen habe?**

Nein → nicht ausgeben. Stattdessen abfragen. Der Griff kostet eine Zeile `node -e` oder ein
`grep`; ihn zu sparen kostet fremde Zeit und Vertrauen.

### Warum gerade hier die Selbsttäuschung greift

**Ein bekanntes Format fühlt sich an wie ein bekannter Wert.** Wer `amazon.de/dp/B0XXXXXXXX`
schon dreimal gesehen hat, kann die Hülle mühelos füllen — und das Ergebnis ist von einer
echten Adresse **nicht zu unterscheiden**. Es gibt keinen Syntaxfehler, keine Warnung, keinen
Verdacht. Der Fehler fällt erst auf, wenn jemand klickt.

Das unterscheidet Bezeichner von Zahlen: Eine erfundene Zahl wirkt oft unplausibel. Eine
erfundene ID wirkt nie unplausibel.

**Warnsignale im eigenen Schreibfluss:**

- Ich formuliere „hier ist der Link zu X", ohne dass X gerade aus einer Abfrage kam.
- Ich habe kurz zuvor echte Bezeichner desselben Typs gesehen — das Muster liegt griffbereit.
- Der Bezeichner gehört zu einem Beispiel, das ich selbst ausgewählt habe (ein Titel, den ich
  „passend" fand), statt zu einem Ergebnis, das mir eine Abfrage geliefert hat.
- Es geht schnell und fühlt sich wie eine Formalie an. Genau dann wird nicht abgefragt.

### Der reale Fall (23.08.2026)

Zur Prüfung von 101 geänderten Zugangsarten sollte Daniel drei Titel ansehen. Die drei
Amazon-Adressen in der Antwort waren **erfunden** — Format nachgebildet, ASIN ausgedacht:

| Was ausgegeben wurde | Was Daniel vorfand |
|---|---|
| `amazon.de/dp/…` für DEATH NOTE | 404 |
| `amazon.de/dp/…` für Made in Abyss | 404 |
| `amazon.de/dp/…` für Dr. STONE | **Bremsscheiben fürs Auto** |

Die echten Adressen standen die ganze Zeit im eigenen Datensatz, eine `node -e`-Zeile entfernt.
Sein Urteil: „wie kann sowas passieren? … so was dummes darfst du nie wieder tun."

**Erschwerend:** Es geschah in derselben Antwort, in der der Abschnitt über Abgleich und
Validierung entstand — also während über das Prüfen geschrieben wurde. Eine Einsicht, die
gerade formuliert wird, schützt nicht automatisch die nächste Zeile. Nur der Griff schützt.

### Zwei Datenpunkte sind kein Muster — besonders nicht, wenn einer falsch gelesen ist

Am 23.08.2026, direkt nach den Fällen oben: Aus zwei Beobachtungen zur Folgenzahl derselben
Quelle — KONOSUBA „33 statt 35" und Pokémon Concierge „8 statt 10" — wurde der Satz „die
Sprachaussage stimmt durchweg, **die Folgenzahlen sind systematisch zu niedrig**".

Beides war falsch, und zwar aus zwei verschiedenen Gründen:

- **Pokémon Concierge:** Lesefehler auf meiner Seite. Daniel: „8, es sind 8 folgen" — die
  Quelle hatte recht.
- **KONOSUBA:** Die Differenz 33 zu 35 war real, aber kein Fehler. Daniel: „konosuba extra
  folgen sind ova". Die Quelle zählt OVAs nicht als reguläre Folgen, wir schon. Zwei
  Definitionen, keine falsche Zahl.

Es blieb also **kein einziger** valider Datenpunkt übrig — behauptet worden war ein
„systematisches" Verhalten. Der zweite Fall zeigt dabei die feinere Falle: **Eine Abweichung
ist noch kein Fehler.** Bevor aus „andere Zahl" ein „falsche Zahl" wird, gehört die Frage
dazwischen, ob beide Seiten dasselbe zählen — Staffeln, Specials, OVAs, Doppelfolgen,
Regionalfassungen.

**Warnwörter im eigenen Text:** „systematisch", „durchweg", „immer", „grundsätzlich", „neigt
dazu", „tendenziell". Steht eines davon in einem Satz über eine Quelle, gehört die Frage
daneben: *Auf wie vielen geprüften Fällen steht das — und habe ich jeden davon richtig
gelesen?* Unter drei unabhängigen Fällen wird formuliert, was beobachtet wurde: „bei KONOSUBA
zählt die Quelle 33, real sind es 35."

Das ist keine Formulierungsfrage. Ein behauptetes Muster wandert in eine Notiz, aus der Notiz
in eine Entscheidung — und korrigiert wird es nur, wenn zufällig jemand denselben Fall noch
einmal ansieht.

### Der zweite Weg hinein: einen echten Bezeichner „verbessern" wollen

Nicht nur die leere Hülle wird gefüllt — **auch ein vorhandener Bezeichner wird ergänzt,
normalisiert oder zurechtgerückt, wenn er ungewohnt aussieht.** Das fühlt sich nicht nach
Erfinden an, sondern nach Sorgfalt. Es ist trotzdem Erfinden.

Am 23.08.2026, wenige Minuten nach dem Fall oben und mit der frisch geschriebenen Regel im
Kontext: Im Datensatz stand `http://netflix.com/pokemonconcierge`. Die Form wirkte unfertig —
alle anderen Netflix-Adressen lauten `netflix.com/title/<Zahl>`. Also wurde sie „vereinheitlicht"
und eine Titel-Nummer dazugeschrieben, die es nicht gab. Daniel: „Link 404 (führt auf homepage)".

**Regel ohne Ausnahme: Ein Bezeichner wird unverändert weitergereicht, so wie er in den Daten
steht.** Sieht er falsch aus, ist das eine Beobachtung, die man mitteilt — kein Auftrag, ihn zu
reparieren:

> „Im Datensatz steht `http://netflix.com/pokemonconcierge` — eine ungewöhnliche Form, die
> übrigen Netflix-Verweise nutzen `/title/<Zahl>`. Ob sie noch funktioniert, ist ungeprüft."

Das ist die brauchbare Auskunft. Eine geglättete Adresse ist keine.

**Warum gerade dieser Fall so leicht durchrutscht:** Beim Füllen einer leeren Hülle gibt es
wenigstens den Moment, in dem nichts da ist. Beim Verbessern ist etwas da — die Handlung fühlt
sich wie Pflege an, und die Prüffrage „steht das wörtlich in einer Ausgabe?" wird gar nicht
erst gestellt, weil man ja *etwas* gesehen hat. **Sie gilt für den ausgegebenen Wert, nicht für
den, von dem er abgeleitet wurde.**

### Und wenn ein Beispiel gebraucht wird

Wer einen Beispiel-Datensatz vorlegen will, **holt ihn aus den Daten**, statt sich einen
auszudenken, der gut passen würde. Der Unterschied ist nicht Bequemlichkeit, sondern
Wahrheitsgehalt: Ein selbst gewählter Titel ohne Abfrage hat keine Adresse — er hat nur eine,
die ich mir dazu vorstelle.

Ist ein Bezeichner nicht auffindbar, wird **das** gesagt: „für diesen Titel liegt keine Adresse
im Datensatz". Das ist eine brauchbare Auskunft. Eine erfundene ist keine.

### Ein Link aus einem Muster ist auch ein Bezeichner

Der dritte Weg hinein, real am 21.09.2026: Ein Testlink an Daniel, `anime-kalender.de/r/<slug>/`,
den Slug aus dem Titelnamen „so, wie er aussehen wird" zusammengesetzt. HTTP 404 — der echte
Slug schreibt `jojo-s-…`, nicht `jojos-…`. Die Adresse eines anderen Titels im selben Atemzug war
eine Datenbank-Route mit bloßer Kennung und hätte gestimmt. **Vor jedem Link an Daniel:** entweder
eine Route mit nackter Kennung, deren Format ein Werkzeug im Repo benutzt, oder die Adresse aus
dem Datensatz kopieren und mit einem Abruf auf 200 prüfen.

## Abgleich ist keine Validierung — und der Unterschied kostet Daten

Der teuerste Fehlgriff dieses Skills ist nicht die fehlende Prüfung, sondern die **Prüfung, die
etwas anderes misst als sie zu messen vorgibt**. Sie fühlt sich vollständig an, sie hat Zahlen,
sie hat sogar eine Gegenprobe — und trägt trotzdem nichts.

**Die beiden Fragen, die verwechselt werden:**

| | Frage | Was es beweist |
|---|---|---|
| **Abgleich** | Stimmt die Quelle mit **unserem Bestand** überein? | Wo beide auseinandergehen — nicht, wer recht hat |
| **Validierung** | Stimmt die Quelle mit der **Wirklichkeit** überein? | Ob man ihr folgen darf |

Ein Abgleich findet Kandidaten. Er begründet **keine** Änderung. Wer aus „vier Titel, bei denen
die Quelle etwas anderes sagt als wir" ein „vier Fehler in unserem Bestand" macht, hat die
Beweislast stillschweigend umgedreht.

### Das Verfahren, bevor eine fremde Aussage etwas auslöst

1. **Was löst die Aussage aus?** Anzeige, Ergänzung, Änderung, **Löschung**. Je weiter unten,
   desto höher die Schwelle.
2. **Welcher Irrtum schadet — und fällt er auf?** Meist ist der Schaden asymmetrisch. Bei
   „nicht mehr verfügbar" ist der gefährliche Fall der **falsche Positivbefund**: Wir löschen
   einen funktionierenden Verweis, und **niemand bemerkt es je** — ein toter Link fällt auf,
   ein fehlender nicht.
3. **Genau diese Richtung prüfen**, an Fällen mit **offenem Ausgang**, mindestens drei. Nicht
   an Fällen, deren Antwort man schon kennt: Eine Gegenprobe, deren Ausgang feststeht, prüft
   nichts.
4. **Auch die Auflösung prüfen.** Gilt die Angabe der Serie, der Staffel oder der Folge? Eine
   Quelle kann auf einer Ebene recht haben und auf der anderen nicht — und beide Ebenen
   können sich widersprechen.
5. **Erst im eigenen Haus nachsehen.** Existierende Kontrollmessungen, Health-Dateien,
   frühere Notizen sagen oft längst, wie belastbar eine Quelle ist.
6. **Ist die Prüfung nicht möglich, wird gesammelt statt angewandt** — als Vorschlag, mit
   Datum und Quelle, nie als stille Änderung.

### Der reale Fall (23.08.2026)

Die Streaming Availability API meldete vier Anime als „bei Prime Video entfernt". Der Abgleich
ergab: Alle vier stehen bei uns noch als verfügbar. Daraus wurde „vier tote Verweise gefunden"
— und beinahe eine automatische Löschung.

Daniels Blick in sein eigenes Prime-Konto: **vier von vier Meldungen falsch.** Alle vier lagen
weiterhin im Abo, „Digimon Tamers" mit 51 deutschen Folgen. Sein Urteil: „du hast falsche
annahmen basierend auf falschen grundlagen gehabt, du hättest verweise gelöscht."

Was die vermeintliche Absicherung wert war:

- **„Dragonball Z ist bei der Quelle ohne Anbieter"** — ein Titel, von dem vorher bekannt war,
  dass er weg ist. Bestätigt nur, dass die Quelle einen bekannten Fall trifft. Schritt 3
  verletzt.
- **„Lycoris Recoil zeigt crunchyroll: deu"** — geprüft wurde, ob die Quelle *etwas* sagt,
  nicht ob es *stimmt*. Mit Folgenauflösung meldete dieselbe Quelle bei allen 13 Folgen `jpn`,
  richtig war keines von beidem. Schritt 4 verletzt.
- **`data/motn-messung.md` im eigenen Repo** zählte für Crunchyroll längst **96 von 99
  Vergleichen als „Quelle schweigt"**. Schritt 5 verletzt.

**Die Quelle war nicht das Problem** — für Prime-Video-Folgendaten liefert sie sauber. Falsch
war, eine Aussage über **Abwesenheit** genauso zu behandeln wie eine über Anwesenheit. Eine
Quelle belegt, was sie sieht. Dass sie etwas *nicht* sieht, ist erst dann ein Befund, wenn
geprüft ist, dass sie es sehen würde.

## Was daraus folgt

Der Aufwand einer Prüfung ist fast immer kleiner als der Schaden einer falschen Behauptung —
und **um Größenordnungen** kleiner als der einer falschen Behauptung, auf der weitergebaut
wurde. Vier der fünf Fälle oben wären ohne Prüfung in ein Produkt gewandert, das Nutzern
Termine verspricht.

Das Prüfergebnis wird anschließend dauerhaft festgehalten, nicht nur berichtet — siehe die
Boot-Regel „Recherche-Ergebnisse gehören ins Projekt, nicht in den Chat" und den Skill
`erkenntnisse-festhalten`.

## Eine Schwelle wird an der ganzen Quelle gemessen

Am 13.10.2026 maß ein Bauer die Verteilung der „Im Angebot seit“-Tage nur an den 109
Titeln, die sein Code schon ausgewählt hatte. Den Erfassungstag mit 234 Titeln fand erst
die zweite Runde über das ganze Archiv. Eine Schwelle oder ein Sonderfall wird an der
Gesamtheit der Quelle gemessen, nie an der vorgefilterten Teilmenge.

## Ein Test mit anderer Eingabe als die Wirklichkeit prüft nichts

Am 25.08.2026 waren 209 Zusicherungen grün, während Daniels erster echter Klick
falsch meldete. Der Grund steckte in der Eingabe: Die Tests fütterten die
Erweiterung über den **Seiten-Quelltext**, die Wirklichkeit liefert die Daten
über eine **JSON-Antwort**. Beide Wege existierten im Code, nur einer wurde
geprüft — und es war der falsche.

Daniels Urteil: „genau deshalb hab ich vorhin gesagt an einem beispiel
durchtesten, auf herz und niere, aber nein du hast nur das skript drüber laufen
lassen, ein dry run gemacht und abgestempelt, statt es ordentlich in prüfliste
aufzunehmen und den echten weg durchzugehen."

**Die Prüffrage vor jeder Zusicherung mit Attrappe:** *Kommt die Eingabe auf
demselben Weg herein wie im Betrieb — oder auf einem, den ich für gleichwertig
halte?* „Gleichwertig" ist die Falle: Zwei Wege, die dasselbe Ergebnis liefern
**sollten**, sind genau dann verschieden, wenn einer kaputt ist.

Konkret heißt das:

- **Die Attrappe bildet den Transportweg nach, nicht nur die Nutzlast.** Kommen
  die Daten als Ereignis, wird das Ereignis ausgelöst — nicht ein Feld gesetzt,
  aus dem der Code sie auch lesen könnte.
- **Ein Weg, der abgeschafft wird, wird auch im Test abgeschafft.** Bleibt er in
  den Zusicherungen stehen, prüfen sie Verhalten, das es nicht mehr geben soll,
  und werden grün, während der echte Weg schweigt.
- **Nach dem Umbau geht ein echter Durchlauf durch die ganze Kette** — der Titel
  auf die Prüfliste, der Klick von Hand, der Blick in das, was wirklich
  angekommen ist. Ein grüner Testlauf ersetzt ihn nicht; er sagt nur, dass die
  geprüfte Annahme hält.

### Ein Werkzeug für später wird beim Anlegen gefahren (17.10.2026)

`mit-lauf-token.mjs` wurde geschrieben, im Werkzeugkasten eingetragen und als fertig gemeldet —
gefahren wurde es nie, weil der echte Lauf erst nach einer Freigabe kommen sollte. Es fand das
Token nicht; erst ein Prüfer stieß zufällig darauf. **Ein Werkzeug, dessen echter Lauf später
oder gesperrt ist, bekommt beim Anlegen einen harmlosen Selbsttest-Befehl (findet es seine
Eingaben, ohne zu wirken) und wird damit sofort gefahren; „eingetragen“ erst nach grünem
Selbsttest.**

## Ein Patch-Skript, das abbricht, hat nichts geschrieben — der Commit läuft trotzdem

Am 26.08.2026 habe ich eine Erweiterungsversion 3.11.0 veröffentlicht, die **die Änderung
nicht enthielt**. Das Patch-Skript prüfte drei Anker, der dritte fehlte, es brach ab — und
`writeFileSync` stand am Ende, wurde also nie erreicht. Der Befehl danach war mit `;` und `&&`
gemischt: Prüfung, Versionsnummer, Commit und Push liefen weiter, als wäre nichts gewesen.

Daniel hätte eine Version geladen, die exakt so aussah wie die vorige. Aufgefallen ist es nur,
weil ich hinterher zufällig nachgesehen habe.

**Drei Griffe, und alle drei sind billig:**

1. **Ein Patch-Skript schreibt zuerst, was es schon hat — oder gar nichts.** Entweder alle
   Anker vorab prüfen und erst dann schreiben, oder nach jeder Ersetzung schreiben. Ein
   Abbruch in der Mitte darf keinen halben Zustand hinterlassen, und ein Abbruch vor dem
   Schreiben darf nicht wie Erfolg aussehen.
2. **Die Kette bricht ab.** `patch && pruefen && commit && push` — mit `&&`, nie mit `;`.
   Ein Semikolon macht aus einer Kette eine Liste, und eine Liste läuft weiter.
3. **Vor jedem Commit wird das Ergebnis geprüft, nicht der Vorgang.** Nicht „das Skript sagte
   ok", sondern: *Steht die Änderung in der Datei?* Ein `grep` auf das neue Muster kostet eine
   Sekunde und ist der einzige Beleg, der zählt.

**Prüffrage vor jedem Commit nach einem Patch-Skript:** *Habe ich die geänderte Stelle
gesehen — oder nur die Erfolgsmeldung des Skripts?*

Dasselbe gilt für die Versionsnummer: Sie hochzuzählen ist ein Versprechen an den, der lädt.
Eine neue Nummer ohne neuen Inhalt ist schlimmer als keine, weil sie das Nachsehen beendet.

## Schnellweg vor dem langen Weg (Daniel, 25.10.2026)

**Anlass:** Crunchyroll-Synchros fehlten im Kalender. Der erste Fix (curated-Einträge) ging durch PR, Bestandsbau (~8 min) und Deploy, mit der Ansage „live gegen 18:20“. Erst die Live-Messung danach zeigte: Eine zweite Sperre (Widerlegung durch das Wochenprogramm) unterdrückte die Termine weiter. Daniel: „es geht nicht, dass du vor 20 min sagst, es wird gefixt, und dann sowas … eine mini-version, die instant zeigt, was rauskommt“.

**Die Regel:** Jeder Fix, dessen Wirkung erst nach einem langen Weg sichtbar wird (Bau, CI, Deploy, Datenlauf, App-Store), wird vorher über einen **Schnellweg** belegt: in Sekunden, am Endergebnis, nicht an der Zwischenstelle, die ich geändert habe.

- **Wie:** Die Funktionen, die zwischen Eingabe und Ausgabe liegen, direkt aufrufen (Import, kein Regex), mit den echten Eingaben (letzter Bau, echte Datendateien) — und die Ausgabe gegen die Erwartung halten, die Daniel sieht (Termin im Kalender, Zeile auf der Seite).
- **Vorher rot, nachher grün:** Der Schnellweg muss den Fehler erst nachstellen (`--wie-gebaut` zeigt genau die live fehlenden Fälle), dann mit dem Fix verschwinden lassen. Stellt er den Fehler nicht nach, belegt er nichts.
- **Bau-Reihenfolge nachstellen:** Rechnet der Schnellweg auf dem fertigen Datensatz (`public/data`), entfernt er vorher alles, was im Bau erst **nach** der geänderten Stelle entsteht (dort: Wege mit `herkunft: termin` aus Phase 11-7 für eine Rechnung in Phase 10). Sonst sieht er Felder, die der Bau an dieser Stelle noch nicht hat — #2056 war im Schnellweg grün und live wirkungslos (25.10.2026, nachgebessert in #2064). Testfälle, die eine vorberechnete Map hereinreichen, belegen die Verdrahtung ebenso wenig.
- **Cache-Stand gehört in den Beleg:** Ein Befund am fertigen Datensatz kann am Stand von `data/cache/` hängen statt an einer Phase — 2302 baute auf „`episodes` fehlt in 09-4“, gemessen mit Cache vom 03.09.; mit frischem Cache (`node tools/cache-holen.mjs`) stand `episodes` ab Phase 02 und die wahre Ursache war ein anderer Riegel (28.10.2026). Bau-Zwischenstände misst `AK_PHASE_ZUSTAND=<phase> AK_PHASE_TITEL=<id> npx tsx pipeline/build.ts` (PR 2306).
- **Fehlt ein Schnellweg, wird er zuerst gebaut** — als Werkzeug im Repo, nicht als Wegwerfskript, damit der nächste Fix ihn hat. Vorbild: `tools/cr-termine-vorschau.ts` (anime-kalender-de) rechnet die Widerlegung auf `public/data` neu und vergleicht den Katalog mit den Terminen, ~1,4 s statt ~15 min bis live.
- **Grenze ehrlich nennen:** Was der Schnellweg nicht abdeckt (dort: Änderungen an `data/curated/` brauchen den Bau), steht im Werkzeug und im PR. Für diesen Teil gilt weiter: den langen Weg nehmen und live nachmessen.
- **Erst danach eine Zeitansage.** „Bald live“ sagt nur, wer das Endergebnis schon im Schnellweg gesehen hat.

## Messen kommt vor dem ersten Versuch, nicht erst nach dem zweiten

Weiter oben steht: **beim zweiten Fix am selben Symptom** wird gemessen. Daniel hat die Regel
am 26.08.2026 verschärft: „bevorzuge immer diagnose /wissens basierte entwicklung, weniger
raten, mehr leicht erfahrbare infos einholen, bevor man mühselig hin und her experimentiert."

**Die Prüffrage steht damit vor der ersten Zeile Code:** *Ist die Information leicht zu
bekommen — und wie lange dauert es, sie zu holen?* Wo die Antwort „ein Aufruf", „ein Blick in
die Antwort", „ein Skript für Daniel" lautet, wird nicht gebaut, sondern gemessen.

**Was das an einem Tag gekostet hat** (26.08.2026, Netflix-Durchlauf in der Erweiterung):

| Vermutung | Ergebnis |
|---|---|
| Folgen am festen Pfad `data.videos.episodes.edges` | griff nicht — 32 Antworten liefen durch |
| dann: jeder Knoten mit Nummer und großer Kennung | zu viel — fremde Serien im Player, 42 falsche Meldungen |
| dann: an die Adresse binden | half nicht — die Startseite lädt im Hintergrund weiter |
| **eine Diagnose, die zeigt, was ankommt** | **in einem Durchgang geklärt: nur `data.videos` zählt** |

Dreimal gebaut, dreimal zurückgebaut, dazu 42 Meldungen aufräumen. Die Diagnose, die es löste,
war in fünf Minuten geschrieben.

**Und es geht nicht um Vorsicht, sondern um Reihenfolge.** Eine Messung ist kein Umweg vor der
Arbeit — sie ist der erste Arbeitsschritt. Wer sie überspringt, baut auf einer Annahme, und
jede spätere Änderung baut auf derselben.

**Zwei Griffe, die fast immer reichen:**

- **Die eigene Software fragen, statt über sie nachzudenken.** Ein Zähler auf `window`, eine
  Zeile `console.table`, ein Feld mehr in der Antwort — alles davon kostet Minuten und
  beantwortet Fragen, die sonst durch Ausprobieren beantwortet werden.
- **Die Wirklichkeit einmal ansehen, statt sie zu rekonstruieren.** Beim Netflix-Nachladen
  fehlte genau ein Stück: wie der zweite Block angefordert wird. Statt `after`, `offset` und
  `count` durchzuprobieren, schneidet die Erweiterung die Anfrage mit — ein Aufklappen von
  Hand, und die Antwort steht da.

## Bilanz statt Bestätigung: eine Freigabe braucht die ganze Rechnung (15.10.2026)

**Fehlermuster:** Ich messe, was ich erwarte, und finde es bestätigt. Was ich nicht erwartet
habe, fällt dabei durch, oder ich sehe es und lege es als „Grundlast“, „Nebenbefund“ oder
„Analyst klärt“ ab. Dann gebe ich trotzdem frei. Am 15.10.2026 ist das zweimal an einem Tag
passiert, beide Male mit dem D1-Tageslimit als Folge:
- **11:50:** Das Messwerkzeug kannte den neuen Codeweg nicht. Es bestätigte den alten Weg als
  billig, und live las der neue 2,5 Mio. Zeilen.
- **12:33:** Der Prime-Test zählte nur die `prime_folge`-Abfragen. Die teuerste Abfrage im selben
  Fenster (`offenePruefungen`, 25.600 Zeilen je Aufruf) legte ich als Grundlast mit unbekanntem
  Aufrufer ab, gab sie einem Analysten und gab frei. Sie kam aus genau diesem Test: Bei jedem
  Prime-Seitenaufruf waren das 2,7 Mio. in einer Stunde.

**Regel, für jede Freigabe nach Messung** (Probelauf, Deploy, Merge, Massenabruf, „funktioniert“):
1. **Gesamtwirkung messen, nicht Bestandteile.** Das ist die Summe im Fenster, verglichen mit
   einem Vorher gleicher Länge und mit dem Budget, etwa alle Abfragen nach Kosten sortiert. Eine
   Messung, die nur die erwarteten Tabellen, Routen oder Fälle filtert, ist keine Messung.
2. **Jeder Posten bekommt einen Besitzer.** Jeder große Posten wird einer Ursache zugeordnet. Die
   Freigabe gilt erst, wenn erwartete Posten plus Grundlast vom Vorher die Summe erklären.
3. **Ein unerklärter Rest gehört dem Prüfling,** bis das Gegenteil belegt ist. Er hält die
   Freigabe auf. Delegieren ist erlaubt, aber nur als Warten auf das Ergebnis, nicht als Freigabe
   mit offener Frage.
4. **Der Probelauf muss die Hochrechnung tragen.** Wiederholt sich ein Posten je Einheit (je Titel,
   Seite, Anfrage), wird er mit der vollen Menge hochgerechnet. Das gilt auch für Posten, die bei
   zwei Einheiten klein aussehen.
5. **Bau-Vergleich: `titleStatus` vorher/nachher ist fester Posten** (`tools/bau-vergleich.mjs`) —
   ein Fix, der Zuordnungen verschiebt, verschiebt oft auch Status (Vorschlags-Ledger, 01.11.2026).

**Woran man es merkt:** Im eigenen Text stehen „vermutlich Grundlast“, „unabhängig davon“, „klärt
parallel“, „nicht vom Test“ ohne Beleg, und kurz darauf steht ein „Go“.

**Bilanz einer Phase mit festgehaltenem Zustand (31.10.2026, Prüfer PR 2547):** Liest eine Phase
einen gespeicherten Vorzustand (`bisher`, z. B. `data/folgen-zuordnung.json`), wird die Bilanz mit
und ohne ihn gefahren und beide Zahlen genannt (dort 130 ohne, 221 mit; Fairy Tail 24 → 2). Der
CI-Prüfer rechnet eine Bilanz im PR-Text nach, statt sie zu übernehmen.

## Ansatzvergleich: erst den besten Weg finden, dann bauen (14.10.2026)

Daniel: „unabhängig von kontingent, das muss allgemein formuliert werden und gilt für jede
architektur, code planung". Anlass: Das Einspielen der Titelzeile lief als SQL in der Datenbank
und las 9,1 Mio. Zeilen (Limit 5 Mio./Tag). Der richtige Weg — einmal exportieren, lokal bauen,
nur Ergebnisse einfügen — kam von Daniel, nicht aus meiner Planung. Ich hatte den ersten Ansatz
gebaut, der funktionierte, und seine Kosten geschätzt statt gemessen.

**Gilt für jede nicht-triviale Planung** (Architektur, Datenfluss, Umbau, Migration, Lauf,
Algorithmus), nicht nur bei Kontingenten. Pflichtabschnitt „Ansätze“ in Plan, Bericht und PR:

1. **Untergrenze:** der einfachste denkbare Weg zum Ziel, ohne Rücksicht auf den Bestand — für
   Daten etwa „Bestand einmal lesen, Ergebnis einmal schreiben“, für Code „wie wenige Zeilen,
   welche vorhandene Funktion“. Prüffrage: Was würde jemand bauen, der den bisherigen Code nie
   gesehen hat?
2. **Mindestens zwei Ansätze**, jeder erprobt und gemessen (Laufzeit, gelesene/geschriebene
   Zeilen, Abrufe, Zeilen Code, Fehlerfälle) in Produktionsgröße, nicht geschätzt. Der
   naheliegende Ansatz ist einer davon, nie beide.
3. **Abstand zur Untergrenze:** Liegt der gewählte Ansatz deutlich darüber (Faustregel: mehr als
   das Dreifache an Kosten oder Umfang), steht die Begründung daneben.
4. **Gegenentwurf bei tragenden Aufgaben** (Tier careful, Datenmodell, Schnittstellen, alles
   schwer Umkehrbare): Vor dem Bauauftrag entwirft ein unabhängiger Agent einen Weg, dem nur das
   Ziel und die Randbedingungen gesagt werden, nicht mein Plan. Weicht er ab, wird beides
   gemessen.
5. **Probelauf:** Vor jedem vollen Lauf an echten Daten oder Diensten eine Stichprobe, deren
   Kosten hochgerechnet werden; erst wenn die Hochrechnung passt, der volle Lauf.
   **Ein Probelauf mit Kontingent (D1, API-Limit) ist dreifach gesichert** (15.10.2026: Netflix-
   Probelauf las in 10 Minuten 2,5 Mio. D1-Zeilen, eine Altzeilen-Prüfung ohne Index, ~50.000 je
   Anfrage; der Messlauf vorher kannte den neuen Codeweg nicht):
   a) **Jeder Codeweg, den der Probelauf berührt, ist vorher lokal in Produktionsgröße gemessen**
      — mit genau dem Schalter, der live gilt (`TITELZEILE_PLATTFORMEN` …), und mit jedem Fall:
      neu, unverändert, geändert, ohne Altbestand. Ein Messwerkzeug, das den Schalter nicht setzt,
      misst den alten Weg.
   b) **Harter Riegel im Dienst, nicht im Kopf:** eine Grenze je Anfrage, die bei Überschreitung
      sofort sperrt (Worker antwortet 429, Erweiterung hält an) — der Tagesdeckel allein greift
      erst nach dem Schaden.
   c) **Erster Messpunkt nach einem Titel, nicht nach zehn Minuten:** Daniel startet, ich messe
      nach dem ersten Titel (`d1 insights`, Top-Abfrage nach Lesezeilen), erst dann läuft er weiter.
   d) **Freigabe erst, wenn jede Top-Abfrage im Messfenster erklärt ist.** Teure Abfragen, die neu
      oder ungeklärt im Fenster auftauchen, rechne ich dem Probelauf zu, bis das Gegenteil belegt
      ist, und nicht der „Grundlast“. Am 15.10.2026 zeigte der Prime-Test `offenePruefungen` mit
      25.600 Zeilen je Aufruf. Ich ordnete das als Grundlast mit unbekanntem Aufrufer ein und gab
      frei. In Wahrheit rief die Prime-Erweiterung es bei jedem Seitenaufruf auf: 2,7 Mio. in einer Stunde.
6. **Prüfer:** Fehlt der Abschnitt, fehlt die Untergrenze oder ist eine Zahl geschätzt statt
   gemessen, lautet das Urteil „ändern“.

Trivial (kein Ansatzvergleich) ist nur, wofür es offensichtlich genau einen sinnvollen Weg gibt:
ein Tippfehler, eine Beschriftung, ein Datenpunkt.

## Anlässe, aus der Regel verschoben (18.09.2026)

Wortgleich aus `~/.claude/rules/`, damit die immer geladene Regel kurz bleibt.

<!-- aus 20-arbeitsweise.md -->
**Ein Bezeichner aus dem Gespräch ist noch nicht der richtige — er gehört zu einer Sache.**
Die Regel oben verhindert *erfundene* Kennungen. Sie verhindert nicht den zweiten Fehlgriff:
eine **echte** Kennung aus dem Verlauf zu nehmen, die zu etwas anderem gehört. Am 24.08.2026
zweimal an einem Abend passiert — `B09B5JH5FM` als „Captain Tsubasa" ausgegeben (es ist
Bakugan Staffel 1, und Daniel hatte das drei Nachrichten zuvor selbst geschrieben), und
`B0B8MTPWRN` als „Wickie" (es ist GOSICK). Beide Male stand die Kennung wörtlich im Verlauf,
beide Male gehörte sie zu einem anderen Titel.

<!-- aus 20-arbeitsweise.md -->
Der Schaden ist derselbe wie bei einer erfundenen Kennung — Daniel klickt und landet woanders —
mit einem Zusatz: Weil die Kennung echt ist, führt sie zu einer funktionierenden Seite, und
der Irrtum fällt erst auf, wenn dort der falsche Titel steht.

<!-- aus 20-arbeitsweise.md -->
Die drei Fehler, gegen die das gerichtet ist — alle drei am selben Tag passiert:

<!-- aus 20-arbeitsweise.md -->
- **Aus einer Feldliste geschlossen statt gemessen.** JustWatch wurde als aussichtsreichste
  Terminquelle bezeichnet, weil die Dokumentation ein `upcoming`-Feld nennt. Die Messung danach
  ergab 104 künftige Titel für ganz Deutschland, davon fast kein Anime — und den einen Termin,
  den wir belegt hatten, kannte JustWatch nicht.
- **Eine bequeme Annahme zur Regel gemacht.** „Fehlt Deutsch in der Audio-Zeile, gibt es keine
  Synchro" — 975 Falschangaben, weil ein Gast bei Crunchyroll etwas anderes sieht als ein
  Angemeldeter. Eine halbe Stunde Nachdenken über die Bezugsquelle hätte es verhindert.
- **In der Ferne gesucht, was im Haus lag.** Nach einer maschinenlesbaren Synchro-Quelle
  gefahndet, während die deutschen Sprechrollen von AniList seit vier Tagen im eigenen Repo
  lagen und 1.746 Titel belegten.

**Verlust erst nach Ersatzprüfung melden (18.10.2026):** Ein Vorher/Nachher-Vergleich, der ein weggefallenes Feld findet, sucht im selben Zug, was an seine Stelle trat (neuer Beleg, andere Quelle, Handbeleg) — erst wenn nichts es ersetzt, ist es ein Verlust. Anlass: „JustWatch-Hinweise verloren“ waren 356 gemessene Browser-Belege.
