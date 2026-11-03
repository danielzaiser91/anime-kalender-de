---
name: offene-todos-footer
description: "VERALTET seit 08.10.2026, nicht anwenden. Früher: Regelwerk für den Footer unter jeder Antwort: Kategorien 🟢⚙️🟡📅⏳🙋💡, Quellen der Zählung, Format, wann er entfällt. Bei Unsicherheit über Format oder Einstufung."
disable-model-invocation: true
---

# Footer: Stand des Kontexts

> **Veraltet seit 08.10.2026 (Daniel: kein Footer).** Offene Punkte stehen in `daniel-zum-abarbeiten/stand.md` bzw. künftig im Ticket-Board (Ruhe-Konzept 12.10.2026). Diesen Skill nicht mehr anwenden.

## Was gemacht wird

Unter **jede** Antwort kommt, durch eine Trennlinie abgesetzt, **jeder offene Punkt mit
eigener Zeile**.

**Der Footer ist die Regel, nicht die Ausnahme** (Daniel, 30.09.2026: „du kannst das footer todo
immer anzeigen, außer ich sag es soll nicht angezeigt werden"). Er wird **jedes Mal** geschrieben —
das Weglassen ist die begründungsbedürftige Entscheidung, nicht das Anzeigen. Er entfällt nur, wenn
Daniel es für diese Phase ausdrücklich sagt oder eine der Ausnahmen unten greift.

**Im autonomen Modus nie** (Daniel, 02.10.2026: „während autonomen modus auch kein footer todo
ausgeben (niemals)") — weder in Wachphasen noch in der Abschlussmeldung. Der Stand steht dann in
`status.md`.

```
-----
🟢 Schrittmeldung in die vier Datenläufe nachziehen
🟢 TMDB-Warteschlange nach Alter statt „noch nie geholt"
⚙️ Crunchyroll-Content-API (Lauf 32515015912) — fertig ~21:40
🟡 56 Arbeitspakete aus data/dub-batches.md — wartet auf den Content-API-Umbau
📅 24.08.: DMARC-Politik auf quarantine heben
⏳ aniSearch: Antwort auf die Anfrage nach einer Titeldaten-Schnittstelle, seit 09.08.
🙋 Daniel: 126 Netflix-Titel mit der Erweiterung durchgehen
🙋 Daniel: Kalender-Abo — Rückblickfenster bestätigen  💡 3
```

**Vollständig, nicht zusammengefasst** (Daniel, 21.08.2026: „alle todos auflisten, und im
footer permanent sichtbar machen, nur ideen sollten abgekürzt werden"). Bis dahin standen
dort Gruppen mit Zahlen — „🟢 Daten (2): Fotos, Lightbox". Das war kürzer und beantwortete
die Frage nicht, die der Footer beantworten soll: **was genau ist offen.** Wer die Punkte
erst erfragen muss, liest eine Zahl, keine Liste.

Ist nichts offen, steht dort nur:

```
-----
keine todos
```

Mehrere Zeilen, die alle „nichts" sagen, sind Rauschen. Die Kurzform gilt streng:
Sobald **ein** Punkt offen ist, kommt die volle Liste zurück.

## Aufbau einer Zeile

```
<Symbol> <die Sache, in eigenen Worten><, Zusatz je nach Kategorie>
```

Eine Zeile je Punkt, keine Sammelzeilen, keine Anzahlen in Klammern. Der Text nennt die
Sache so, dass sie ohne Rückfrage erkennbar ist — nicht als Stichwort, das nur ich
auflösen kann, aber auch nicht als Absatz. **Eine Zeile, eine Zeile lang.**

**Und zwischen den Zeilen steht eine Leerzeile** (Daniel, 28.09.2026: „formatier das footer
todo besser, zeilenumbruch nach jedem punkt"). Markdown wirft einen einfachen Zeilenumbruch
weg: Ohne Leerzeile liefen alle Punkte zu **einem** Absatz zusammen, und aus der Liste wurde
ein Textblock, den niemand mehr Zeile für Zeile liest. Der Umbruch ist also keine Kosmetik,
sondern das, was die Liste überhaupt als Liste erscheinen lässt. Ein `-----` über dem Block
und danach je Punkt eine Leerzeile dazwischen.

Was je Kategorie angehängt wird, steht bei der Kategorie selbst: bei ⚙️ die voraussichtliche
Fertigstellung, bei 🟡 der Grund, bei ⏳ die wartende Partei, bei 📅 das Datum vorn.

**Und die Zeile ist höchstens 120 Zeichen lang** (Daniel, 29.09.2026: „btw 120 zeichen limit gilt
für alle todo einträge, die im footer angezeigt werden, todos dürfen ausgeschriebene versionen
haben, damit du das verständnis behältst in status.md, aber im footer, max 120").

Gezählt wird die ganze Zeile **ohne** Symbol und ohne die zwei Leerzeichen davor — beim Schreiben
nachgezählt, nicht geschätzt. Wird ein Punkt länger, gibt es zwei Wege und keinen dritten:

- **Kürzen, ohne etwas wegzulassen:** „Suche: Hervorhebung, Fundstellen-Symbol, Feld-Auskunft am
  Suchfeld" (66 Zeichen) statt eines Halbsatzes darüber, was Hervorhebung im Einzelnen heißt.
- **Das Ausführliche gehört in die Notiz der Quelldatei** (`status.md`) — dort kostet es nichts und
  niemand liest es im Vorbeigehen. Die Footer-Zeile ist der **Zeiger** auf den Punkt, nicht seine
  Akte; dieselbe Aufteilung wie bei den zusammengefassten „wartet auf Stufe 4"-Punkten.

Der Grund ist derselbe wie bei der Leerzeile darüber: Eine Zeile, die man beim Überfliegen nicht
erfasst, ist keine Zeile mehr. Und wer den Zusammenhang braucht, findet ihn vollständig in der
Datei — nur eben nicht in der Ansicht, die auf einen Blick wirken soll.

**Drei Ausnahmen von der Ein-Zeile-je-Punkt-Regel:**

- **💡 bekommt nur eine Zahl**, angehängt an die letzte Zeile — Begründung unten bei der
  Kategorie. Sie ist ausdrücklich vom Auflisten ausgenommen, das war Teil derselben Ansage.
- **Wiederkehrende Automatik steht gar nicht im Footer** (Daniel, 30.09.2026: „automatik eintrag
  nicht mehr sichtbar im footer todo machen"). Stündliche und tägliche Cron-Läufe hatten eine
  eigene 📅-Zeile; sie stand in jeder Antwort, änderte sich nie und verdrängte die Punkte, an denen
  wirklich etwas zu tun ist. Wer den Takt nachsehen will, sieht in den Workflows nach — im Footer
  erscheint eine Automatik nur noch als ⚙️, solange jemand auf ihr **Ergebnis** wartet (siehe oben).
- **Punkte, die auf dieselbe Sache warten, stehen in einer Zeile** (Daniel, 23.09.2026:
  „alle warte auf stufe 4 todos in 1 zusammenfassen, intern kann es detailliert getrennt
  sein, im todo stört es die übersicht"). Sechs 🟡-Zeilen mit demselben „wartet auf Stufe 4"
  sagen sechsmal dasselbe und verdecken, was wirklich verschieden ist. Die Zeile nennt den
  Blocker und die Zahl dahinter: `🟡 6 Punkte hängen an Stufe 4 (Nachprüfliste, Pill-Achse,
  Kanal-Regel …)`. Die Einzelpunkte stehen vollständig in `status.md` — dort kostet
  Ausführlichkeit nichts.

**Und eine gebaute Automatik ist kein offener Punkt** (Daniel, 23.09.2026, zu „täglich
23:05: TOGGO-Fenster nachholen"): Ein Cron-Lauf, der die Sache von selbst erledigt, ist die
Antwort auf die Aufgabe, nicht die Aufgabe. Er gehört nur in den Footer, solange jemand auf
sein **Ergebnis** wartet — dann als ⚙️ mit Uhrzeit, nicht als Dauerzeile.

**Keine Überschriftenzeilen** (User-Regel 08.08.2026). Die Kategorie steht als Symbol
am Anfang jeder Zeile — das spart drei Zeilen und sagt dasselbe. Eine Kategorie ohne
Punkte hat schlicht keine Zeile; es gibt keine Zeile, die „0" meldet.

## Reihenfolge der Zeilen — 🟢 steht immer ganz oben

```
🟢 → ⚙️ → 🟡 → 📅 → ⏳ → 🙋 → 💡
```

Zeilen derselben Kategorie stehen beieinander. Die Reihenfolge ist **fest** und wird
nicht nach Wichtigkeit des Einzelfalls umgestellt.

**Warum ausgerechnet 🟢 zuerst:** Die Liste ist von oben nach unten nach *Handlungsnähe*
sortiert. Ganz oben steht, was jetzt geschieht oder geschehen kann; darunter, was gerade
von allein läuft; ganz unten, worauf nur gewartet wird. Wer den Footer überfliegt und
nach der ersten Zeile aufhört, soll das Handlungsfähige gesehen haben — nicht eine
Meldung über einen Hintergrundlauf, bei dem ohnehin niemand etwas tun kann.

**Die Reihenfolge gilt auch dann, wenn 🟢 gerade die uninteressanteste Zeile ist.** Der
Reiz, einen laufenden Abruf nach oben zu ziehen, weil er „das Neueste" ist, ist genau der
Fehler — dann steht die Sortierung nicht mehr für Handlungsnähe, sondern für Aktualität,
und die kann man aus dem Gespräch ohnehin ablesen.

Diese Regel stand bis zum 13.08.2026 als Halbsatz mitten in einem Absatz über
Überschriftenzeilen und wurde genau deshalb überlesen: In einem Footer stand ⚙️ vor 🟡
vor 🟢 (Daniels Korrektur: „grün vor laufenden tasks (1. in liste)"). Sie hat jetzt einen
eigenen Abschnitt, weil eine Regel, die man beim Schreiben befolgen soll, auch beim
Nachschlagen auffindbar sein muss.

Eine Ausnahme vom Zeilenaufbau macht 📅: Dort steht statt Gruppe und Anzahl das
**Datum** vorn, weil genau das die Frage ist, die ein Termin beantworten muss.

**Kein Projektname in der Zeile** (User-Regel 08.08.2026). An welchem Projekt gearbeitet
wird, steht im Sitzungskontext und im Chat-Titel — es im Footer zu wiederholen kostet Platz
und sagt nichts. Nur wenn eine Sitzung wirklich mehrere Projekte berührt, gehört er vorn hin.

Die Zeile nennt die Sache, nicht ihr Aktenzeichen: „TMDB-Warteschlange nach Alter statt
‚noch nie geholt'" statt „TMDB-Fix". Was ich in drei Wochen selbst nachschlagen müsste,
ist zu kurz geschrieben.

## Nur das aktuelle Projekt — fremde Projekte gehören nicht in den Footer

Gezählt wird, was im **aktuellen Arbeitszusammenhang** offen ist — das kann ein
Projektordner sein, muss es aber nicht. Alles, was zu einem **anderen** Projekt
gehört, bleibt draußen, auch wenn es real offen ist und in einer globalen Liste
auftaucht.

**Prüffrage je Zeile: Hat dieser Punkt mit dem zu tun, woran hier gerade
gearbeitet wird?** Wenn nein, wird er nicht aufgenommen — unabhängig davon, wie
sicher er belegt ist.

Der Grund ist nicht Ordnungsliebe: Ein Footer soll den Stand *dieses* Gesprächs
zeigen. Punkte aus anderen Projekten machen ihn länger, ohne ihn nützlicher zu
machen, und sie verwischen genau die Frage, die er beantworten soll — wie weit
sind wir hier?

**Real (18.08.2026):** In einer Sitzung, die ausschließlich um Arturs Website
ging, standen im Footer eine DMARC-Umstellung für anime-kalender.de und ein
täglicher TTS-Batch für incremental adventure — beide korrekt gezählt, beide
falsch am Platz. Daniels Korrektur: „die anime kalender und incremental batch
todos haben hier im chat für arturs webseite nichts zu suchen."

Berührt eine Sitzung **wirklich** mehrere Projekte, gehören beide hinein — dann
aber mit Projektnamen in der Gruppe, damit erkennbar bleibt, was wozu gehört.
Maßgeblich ist, woran gearbeitet wurde, nicht was zufällig existiert.

## Die Kategorien

Der Footer sortiert nicht nach Thema, sondern nach **dem Grund, warum etwas gerade
nicht passiert**. Das ist die einzige Frage, die ein Blick darauf beantworten soll.

Die wichtigste Trennlinie verläuft zwischen „Daniel muss etwas tun" und „Daniel muss
gar nichts tun". Sie muss **am Symbol allein** ablesbar sein, ohne den Text zu lesen
(User-Regel 10.08.2026). Nur 🙋 fordert zur Handlung auf; 🟢, ⚙️ und ⏳ tun es
ausdrücklich nicht.

### 🟢 jetzt möglich

Punkte, die *jetzt* Handlung brauchen und ohne auf jemanden oder etwas zu warten
erledigt werden können — Handlung **von mir**, nicht von Daniel.

### ⚙️ läuft gerade — mit voraussichtlichem Ende

Arbeit, die in diesem Moment tatsächlich läuft: Hintergrundskript, Messung, Build,
Testlauf, laufender Subagent. Daniel tut nichts, er wartet nur ab.

**Immer mit Zeitangabe**, angehängt mit ` — fertig ~HH:MM`:

```
⚙️ Lasttest Durchgang B — fertig ~12:20
```

Die Uhrzeit wird gerechnet, nicht geraten: Startzeitpunkt plus geplante Laufzeit.
Ist die Dauer wirklich nicht abschätzbar (offener Fremdprozess, unbekannte
Datenmenge), steht dort ` — Dauer offen` statt einer erfundenen Uhrzeit. Läuft etwas
über die geschätzte Zeit hinaus, wird die Angabe in der nächsten Antwort korrigiert,
nicht stehen gelassen.

Abgrenzung zu ⏳: **⚙️ heißt, ich habe es gestartet und bekomme das Ergebnis mit.**
⏳ hängt an jemand anderem, den ich nicht steuere.

**Läuft es nicht auf diesem Rechner, gehört der Ort dazu** (User-Regel 10.08.2026) —
sonst sucht Daniel in der Oberfläche nach einer Hintergrundaufgabe, die es dort gar nicht
gibt:

```
⚙️ aniSearch-Lauf auf GitHub — fertig ~18:55
```

Und: **⚙️ setzt voraus, dass ich den Lauf wirklich beobachte.** Ein Fremdlauf, den ich
angestoßen habe und danach nur gelegentlich abfrage, ist kein ⚙️ — dann steht die
Zeitangabe für nichts. Entweder eine Hintergrundaufgabe darauf ansetzen oder den Punkt
als 📅 führen.

**Die Wache wird im selben Zug gestartet, in dem die Zeit in den Footer kommt.** Nicht
danach, nicht beim nächsten Prompt — sonst gibt es sie nie.

**Welche Wache, entscheidet eine Frage: Läuft die Sache in Minuten oder über Nacht?**

| Wartezeit | Werkzeug | warum |
|---|---|---|
| Minuten bis wenige Stunden, Rechner bleibt an | `Monitor` mit einer Bedingung | meldet sich, sobald sie eintritt |
| über Nacht, oder der Rechner geht aus | **geplante Aufgabe** (`create_scheduled_task`, `fireAt`) | liegt in `~/.claude/scheduled-tasks/` auf Platte und läuft **beim nächsten Start des Clients nach**, wenn der Zeitpunkt verstrichen ist |

**Ein Hintergrundbefehl ist für beides das falsche Werkzeug**, und zwar aus zwei
unabhängigen Gründen — jeder allein genügt:

- **`sleep` ist in dieser Umgebung blockiert.** Ein `until … sleep 60 … done` bricht
  sofort mit Exit 4 ab, ohne eine Zeile Ausgabe. Es sieht wie eine laufende Wache aus
  und ist keine.
- **Er stirbt mit der Sitzung.** Wer den Rechner ausmacht, hat danach keine Wache mehr —
  und niemand sagt es.

`CronCreate` löst das nicht: „Jobs live only in this Claude session — nothing is written
to disk, and the job is gone when Claude exits."

**Real am 01./02.09.2026, und der Fehlgriff war doppelt.** Im Footer stand
„⚙️ Wache auf den Kontingent-Reset — meldet sich um 02:00". Der Befehl war schon beim
Absenden tot (Exit 4), ich habe die Ausgabe nicht gelesen; und selbst ein laufender hätte
das Herunterfahren nicht überlebt. Am Morgen musste Daniel fragen: „es ist nach 2 uhr, im
todo stehen aufgaben für nach 2 uhr, warum startest du nicht automatisch?"

**Der Griff dagegen ist derselbe wie bei jeder anderen Behauptung: nachsehen.** Eine
gestartete Wache ist erst dann eine, wenn ihre Ausgabe das sagt — bei einem
Hintergrundbefehl also ein Blick in die Ausgabedatei, nicht das Vorhandensein einer
Aufgaben-Kennung.

**Und wo die Arbeit gar nicht an Daniels Rechner hängt, gehört sie überhaupt nicht in
eine Wache.** Ein GitHub-Workflow läuft nachts durch, während der Rechner aus ist; die
Aufgabe ist dann morgens erledigt, ohne dass jemand geweckt werden musste. Prüffrage vor
jeder Wache: **Braucht diese Sache wirklich meinen Rechner?**

**Real am 01.09.2026:** Im Footer stand „⚙️ aniSearch-Folgenlisten — fertig ~19:25". Um
20:00 fragte Daniel: „es ist 20:00, im footer steht 19:25, warum hast du dich nich selbst
geweckt". Der Lauf lief da noch, die Zeit war eine Schätzung ohne Deckung, und niemand
hatte nachgesehen — die Regel darüber stand seit dem 10.08.2026 genau so da.

**Prüffrage beim Schreiben jeder ⚙️-Zeile:** *Läuft dafür gerade eine Wache?* Wenn nein,
gehört entweder eine gestartet oder das Symbol geändert. Eine Uhrzeit ohne Wache ist ein
Versprechen, das niemand einlöst.

### 🟡 blockiert durch eigene Vorarbeit

Punkte, die weder jetzt gehen noch auf jemand anderen warten: Sie hängen an
**einer anderen Aufgabe von mir**, die erst fertig sein muss. Daniel tut nichts,
niemand Fremdes tut etwas — es fehlt schlicht die Grundlage.

Immer mit dem Grund, angehängt mit ` — wartet auf …`:

```
🟡 Diagramme aus der Messung — wartet auf den Lasttest
```

Abgrenzung, und die ist der ganze Punkt (User-Regel 10.08.2026): 🟢 heißt „ich
könnte sofort loslegen". Steht dort etwas, das gar nicht loslegen kann, ist die
Zeile falsch — sie behauptet Handlungsfähigkeit, die es nicht gibt. ⏳ wäre
genauso falsch, denn dort wartet man auf Fremde, und niemand könnte etwas tun,
um es zu beschleunigen. Bei 🟡 gibt es sehr wohl jemanden: mich, an der anderen
Aufgabe.

Fällt die Blockade weg, wandert der Punkt nach 🟢 — nicht von allein, sondern
weil die Vorarbeit fertig ist.

**🟡 gilt der einzelnen Sache, nicht ihrem Stapel.** Der häufigste Fehlgriff ist
nicht, eine Blockade zu erfinden, sondern eine echte auf Nachbarn zu übertragen, die
gar nicht betroffen sind. Prüffrage je Zeile: **Hängt DIESER Punkt an der Vorarbeit —
oder liegt er nur zufällig im selben Arbeitspaket?**

Real am 13.08.2026: Ein Einzeiler-Fix (ein Knopf lag über einem anderen) stand als
🟡 „wartet auf den Abruf" im Footer, zusammen mit zwei Punkten, die wirklich auf
einen zehnminütigen Datenabruf warteten. Der Fix hatte damit nichts zu tun, war
fertig und hätte sofort ausgeliefert werden können. Daniel sah ihn auf der Live-Seite
nicht und fragte nach: „hast du das schon gemacht? ich hab grad geguckt, ist immer
noch über dem Stern." Ein falsches 🟡 kostet also nicht nur Genauigkeit im Footer —
es hält Arbeit zurück, die längst fertig ist.

**Daraus folgt auch etwas fürs Ausliefern, nicht nur fürs Zählen:** Was fertig und
geprüft ist, geht raus, sobald es das ist — es wartet nicht auf den Rest des Pakets.
Steht ein Punkt zu Recht auf 🟡, gehört die Frage dazu, ob nicht ein Teil davon schon
jetzt gehen kann.

**Und das „wartet auf" muss eintreten können.** Am 13.09.2026 standen drei Zeilen
tagelang als 🟡 im Footer: „wartet auf Netflix-Folgentitel", „wartet auf Folgentitel
dieser Seiten", „wartet auf die erste Netflix-Meldung mit diesen Feldern". Daniels
Frage „was ist mit den gelben todos" ergab beim Nachmessen: Keiner der Titel stand auf
einer Prüfliste, also öffnete niemand die Seiten, also kamen nie Folgentitel; und die
Netflix-Felder waren längst gespeichert, nur gab die Abfrage sie nicht heraus. Alle drei
warteten auf etwas, das von selbst nie passiert — in Wahrheit war jeweils ich dran.
Prüffrage vor jedem 🟡: **Welcher Lauf, welche Person oder welcher Schritt bringt das
Erwartete — und ist dieser Weg heute wirklich angelegt?** Kann ich ihn nicht benennen,
ist die Zeile 🟢 (den Weg bauen) oder 🙋 (Daniel muss etwas tun), nie 🟡.

**Ein 🟡 ohne „— wartet auf …“ ist immer falsch** — fehlt der Grund, gibt es keinen. Real am
26.09.2026: „Datenbank und Panel an die neue Optik anpassen“ und „3.690 gegen 2.777 Anime klären“
standen gelb im Footer, ohne Zusatz. Beides hätte sofort beginnen können; gelb waren sie nur, weil
sie nicht zum eben abgeschlossenen Auftrag gehörten. Daniel: „2 todos im footer sind gelb, was
hindert dich daran weiter zu arbeiten?“ **„Gehört nicht zum Auftrag“ ist kein Blocker** — es ist 🟢
(oder 🙋, wenn eine echte Entscheidung fehlt).

### 📅 terminiert — läuft von allein, zu einem festen Zeitpunkt

Arbeit, die weder jetzt ansteht noch auf jemanden wartet, sondern **zu einem festen Zeitpunkt**
weitergeht. Dahinter muss echte Automatik stehen, kein Vorsatz — sonst gehört der Punkt in 🟢 oder 🙋.
Gemeint sind **einmalige** Termine: eine geplante Aufgabe (`scheduled-tasks`).

**Wiederkehrende Läufe (Cron in der CI, Nachtläufe) stehen nicht im Footer** (30.09.2026, siehe
Ausnahmen oben). Sie sind kein offener Punkt, sondern Betrieb.

Format abweichend, weil hier der Zeitpunkt die Hauptinformation ist:

```
📅 24.08.: DMARC-Politik anheben, wenn die Berichte sauber bleiben
📅 täglich 06:17: aniSearch-Bestand, 200 Seiten je Lauf — noch 4 Tage
```

Also `📅 <wann>: <was passiert>`. Keine Gruppe, keine Anzahl — eine Zeile je Sache. Bei
wiederkehrenden Läufen gehört dazu, **wann es fertig ist** („noch 4 Tage", „bis Freitag");
ohne das weiß niemand, ob der Punkt nächste Woche noch dasteht.

**Ein Punkt verschwindet nicht, nur weil er von allein weiterläuft** (User-Regel
10.08.2026). Genau das war passiert: Der aniSearch-Bestand stand als „läuft über die
Nachtläufe" gedanklich auf erledigt und fehlte im Footer — während oben ein anderer Punkt
ausdrücklich darauf wartete. Wer nicht mitliest, sieht dann eine Blockade ohne Ursache.
Solange etwas offen ist, steht es im Footer. Die Kategorie sagt nur, **warum** gerade
niemand daran arbeitet, nicht ob es zählt.

Der Sinn: Ein Punkt mit Datum soll aufhören, jeden Tag mitzuzählen und zur Handlung
zu drängen. Er ist erledigt in dem Sinne, dass entschieden und eingeplant ist — was
noch aussteht, ist nur das Verstreichen der Zeit. Ohne eigene Kategorie stand so
etwas entweder unter 🟢 (und drängte falsch) oder unter 🙋 (und behauptete, Daniel
müsse etwas tun).

Ist der Termin verstrichen und der Lauf hat stattgefunden, verschwindet die Zeile —
was dabei herauskam, ist dann entweder erledigt oder ein neuer Punkt.

### ⏳ wartend auf Externe — die Partei steht vorn

Punkte, die auf jemanden oder etwas **außerhalb** warten: eine Person, eine
Institution, einen Dienst, eine Freigabe. Daniel tut auch hier nichts. Ein Datum nur
anhängen, wenn eines inhaltlich vorhanden und nützlich ist (`seit DD.MM.`), sonst
weglassen.

Die Zeile beginnt mit der Partei und einem Doppelpunkt: `⏳ aniSearch: …`. Wartet
dieselbe Partei auf mehreres, bekommt jedes davon seine eigene Zeile.

### 🙋 Daniel ist dran — das einzige Symbol, das etwas verlangt

Alles, was auf **Daniels** Entscheidung, Antwort, Test oder Handgriff wartet:
eine offene Ja/Nein-Frage, ein manueller Test, etwas, das nur er kann (BIOS,
Hardware, ein Konto, an das ich nicht komme).

Früher stand das mit derselben Sanduhr wie das externe Warten (bis 10.08.2026). Das
war irreführend: Die Sanduhr sagt „zurücklehnen", die Zeile meinte aber „du bist
dran". Genau umgekehrt. Deshalb ein eigenes Symbol.

**Nicht „User"**: Der Footer nennt jede andere Partei beim Namen, eine
Rollenbezeichnung dazwischen liest sich wie eine fremde, dritte Partei.

**„Schreib nur auf" ist kein 🙋.** Daniel am 13.09.2026: „setz nicht um, schreib nur
auf" zu einem Umbau der Anbieter-Pillen. Ich trug ihn als 🙋 „Freigabe, … umzusetzen"
ein, und seine nächste Frage war: „hast du es als grünes todo eingetragen?" Er hatte
nichts zu entscheiden — er wollte den Punkt nur nicht **jetzt** umgesetzt haben. Eine
Aufgabe, die ich ohne ihn erledigen kann, ist 🟢, auch wenn er den Zeitpunkt
aufschiebt; 🙋 heißt, dass **er** etwas tun muss. Prüffrage: *Braucht diese Zeile von
ihm etwas anderes als Zeit?* Wenn nein, ist sie nicht 🙋.

### 💡 später — ohne eigene Zeile

Bewusst zurückgestellte Ideen: nicht abgelehnt, aber auch nicht jetzt.

**Bekommt keine eigene Zeile** (User-Regel 08.08.2026). Zurückgestelltes soll den
Footer nicht verlängern. Nur Symbol und Zahl, angehängt an die **letzte**
vorhandene Zeile, durch zwei Leerzeichen abgesetzt:

```
🙋 Daniel: Glättung kürzen — ja oder nein?  💡 3
```

Keine Stichworte, keine Gruppe — die Kategorie soll gerade nicht zur Handlung
auffordern. Ist 💡 der einzige Inhalt, weil alle anderen Kategorien leer sind,
steht ausnahmsweise `💡 3` allein auf einer Zeile; dann gibt es nichts zum
Anhängen.

**Nichts wandert von allein hierher.** Nur auf ausdrückliche Ansage des Users, und
mit Datum in der Notiz der Quelldatei. Der Anlass für diese Kategorie war ein
Dauerbrenner, der monatelang unter „jetzt möglich" stand und dort jedes Mal
mitgezählt wurde, obwohl er nie drankommen sollte — der Footer log damit nicht,
aber er drängte zu etwas, das niemand wollte.

## Einstufung: zwei Schritte, nicht einer

Das ist der Schritt, an dem der Footer am häufigsten kippt — und zwar lautlos, weil
die **Zahlen** stimmen und nur das Symbol lügt.

**Die Quelle sagt, DASS ein Punkt offen ist. Sie sagt nicht, WARUM er gerade nicht
passiert.** Das Zweite steht in der Notiz des Eintrags, nicht in der Überschrift des
Abschnitts, aus dem er stammt. Eine Queue enthält auch Blockiertes; eine
Aufgabenliste kennt nur „pending", nicht „pending, weil".

Deshalb wird jede Zeile **einzeln** eingestuft, mit einer Frage:

> **Könnte ich diesen Punkt jetzt sofort anfangen — ohne auf irgendetwas oder
> irgendwen zu warten?**

- **Ja** → 🟢
- **Nein, es fehlt eine Vorarbeit von mir** → 🟡, mit ` — wartet auf …`
- **Nein, Daniel muss etwas entscheiden, testen oder liefern** → 🙋
- **Nein, es hängt an einem Fremden** → ⏳
- **Nein, es läuft schon** → ⚙️ bzw. 📅

**Warnwörter — sie stehen meist im eigenen Text der Zeile.** Enthält die Formulierung
„nach …", „sobald …", „wenn … fertig ist", „braucht eine dritte Quelle", „braucht
Daniels Blick", dann hat der Punkt seinen Blocker gerade selbst genannt, und 🟢 ist
ausgeschlossen. Genauso in der Notiz der Quelldatei: Steht dort ein Satz wie „geht
nicht ohne X", zählt der, nicht der Abschnitt, in dem die Zeile steht.

**Drei reale Fehlgriffe, alle am 13.08.2026, alle von Daniel bemerkt:**

- `🟢 Daten (2): nach dem Lauf data:build + data:dub-checks, …` — die Zeile trug ihr
  „nach dem Lauf" selbst im Text und war trotzdem grün. Richtig war 🟡.
- Im selben Footer stand als zweiter grüner Punkt die Klärung widersprüchlicher
  Termine, deren Notiz in `status.md` wörtlich sagt: „Es braucht eine dritte Quelle
  oder einen Blick von Daniel." Sie stammte aus dem Abschnitt „Queue" und wurde
  darum mechanisch grün. Richtig war 🙋.
- Einen Footer später: `🟢 … live prüfen, sobald der Deploy durch ist` — Daniels
  Rückfrage war „ist das für dich oder für mich?". Wieder ein „sobald", und diesmal
  war zusätzlich unklar, **wer** handeln soll.

**Bei 🟢 muss der Handelnde aus der Formulierung hervorgehen.** 🟢 heißt „ich mache
das", 🙋 heißt „du machst das" — wenn Daniel nachfragen muss, welches von beidem
gemeint ist, ist die Zeile falsch geschrieben, auch wenn das Symbol stimmt. Ein
nackter Infinitiv („Ansicht live prüfen") liest sich wie eine Aufforderung. Also
benennen, was ich tue: „prüfe die Ansicht live".

## Woraus gezählt wird

**Der Footer wird aus den Dateien gebaut, nicht aus dem Gesprächsverlauf.** Vor der Antwort
`status.md` tatsächlich lesen — „In Arbeit", „Queue", „Offen", Daueraufträge mit Frist
(`grep -n "^| \*\*" status.md`, Erledigtes überspringen). Real 27.09.2026: Den ganzen Tag
standen im Footer nur die Punkte der Sitzung; Stufe 4 des Meldemodells, JustWatch-Abgleich,
Joyn-Weg und die seit 24 Stunden fällige Wache fehlten. Daniel: „wenn von schritten noch was
offen ist, wieso steht das nicht im todo?"

Alle vorhandenen Quellen zusammen, doppelte Einträge nur einmal. Die Zuordnung unten
sagt, **welche Punkte überhaupt zählen** — das Symbol kommt aus der Einstufung
darüber, nicht aus der Quelle:

1. **`status.md` im Arbeitsverzeichnis** — die Abschnitte „In Arbeit" und „Queue"
   zählen mit, „Zu besprechen" und „Warten auf Feedback" ebenso (die sind immer 🙋),
   „Später (nice to have)" als 💡. Das Archiv zählt nie mit.
   **„Queue" ist keine Zusage von 🟢.** Dort steht, was ansteht — nicht, was gehen
   kann. Zu jeder Zeile die Notiz mitlesen und danach einstufen.
2. **`TODO.md` im Arbeitsverzeichnis** — jede unerledigte Kästchenzeile (`- [ ]`).
   Erledigte (`- [x]`) zählen nicht.
3. **Die Aufgabenliste des Task-Werkzeugs** — Einträge mit Status `in_progress` sind
   ⚙️, weil sie tatsächlich laufen. `pending` heißt nur „noch nicht angefangen" und
   sagt nichts über den Grund; solche Einträge gehen durch die Einstufung oben.
3b. **Geplante Aufgaben** (`list_scheduled_tasks`) — aktivierte Aufgaben mit einem
   `nextRunAt` in der Zukunft zählen als 📅, mit deren Datum. **Achtung, häufigster
   Fehlgriff: Diese Liste ist global, der Footer ist es nicht.** Sie liefert die
   geplanten Aufgaben *aller* Projekte; aufgenommen wird nur, was zum aktuellen
   Arbeitszusammenhang gehört (siehe Abschnitt oben). Dasselbe gilt für 3c. Steht dieselbe
   Sache zusätzlich in `status.md`, zählt sie einmal — und zwar als 📅, nicht als 🟢:
   Sie ist eingeplant, nicht offen.
3c. **Wiederkehrende Läufe im Projekt** — Cron-Einträge in CI-Workflows, Nachtläufe,
   Aufgaben im Windows-Aufgabenplaner. Sie zählen **nicht** in den Footer (30.09.2026): Sie
   arbeiten weiter, sind aber kein offener Punkt. Ausnahme bleibt der ⚙️-Fall, in dem jemand
   auf ihr Ergebnis wartet.
4. **Tatsächlich laufende Hintergrundprozesse** — gestartete Skripte, Messungen,
   Builds, Subagenten. Die zählen als ⚙️, auch wenn sie in keiner Datei stehen.
5. **Projektspezifische Äquivalente** mit gleichem Prinzip, anderem Namen (z. B.
   `webseite-offene-baustellen.md`).

`status.md` und `TODO.md` beschreiben unterschiedliche Dinge — laufende Arbeit
gegenüber langfristigen Vorhaben — und werden deshalb beide gezählt. Steht
derselbe Punkt in beiden, zählt er einmal.

Ohne Projektordner bleibt die Aufgabenliste des Task-Werkzeugs übrig. Auch dann
ist die Angabe aussagekräftig: Sie sagt, was aus diesem Gespräch noch offen ist.

## Zahlen im Footer werden gemessen, nicht erinnert

Steht in einer Footer-Zeile eine Zahl — „46 offen", „240 Verweise", „sieben Titel" —, wird sie
**vor dem Absenden aus den Daten geholt**, nicht aus `status.md` abgeschrieben und schon gar nicht
aus dem Gedächtnis. Der Footer ist selbst ein Wissensbestand und veraltet genauso schnell wie
jeder andere (siehe `wissen-veraltet-nie`).

Daniel am 23.08.2026: „im footer todo steht 46 offen, das solltest du automatisch ermitteln
können, oder bereits haben, sind footer todos veraltet?" — Die Zahl stimmte, aber sie war
abgeschrieben, nicht gemessen. Am selben Abend standen in `status.md` drei Zahlen, die um das
Doppelte danebenlagen; wer sie in den Footer übernimmt, trägt den Fehler weiter.

**Der Griff ist billig:** ein `node -e` über den Datensatz, eine Zeile `grep -c`, ein Blick in die
erzeugte Liste. Wer ihn scheut, sollte die Zahl weglassen und stattdessen schreiben, worum es
geht — „YouTube-Verweise ohne Sprachangabe" ist ohne Zahl richtig, mit falscher Zahl aber
irreführend.

Ausgenommen sind Zahlen, die zur Sache selbst gehören und sich nicht ändern („Batch 3 von 46",
„v0.48.0"). Alles, was einen **Bestand** beziffert, wird gemessen.

**Und es wird das Feld gemessen, das die Anzeige selbst benutzt** (Daniel, 30.09.2026). Im Footer
stand „0 Netflix von 377 · 4 Disney+ von 44" — gelesen aus `offen`/`gesamt` der Antwort
`?stand=1`. Die Statusanzeige zeigte gleichzeitig „Disney+ 2 Titel", denn sie liest `titel`. Beides
steht in **derselben** Antwort: `offen` zählt offene **Prüfungen** (Briefkasten-Zeilen), `titel` die
**Titel** der Arbeitsliste. Dazu kam ein Filterfehler: Amazon heißt dort `primevideo`, nicht
`amazon` — die Zeile ließ den größten Posten einfach weg.

Prüffrage vor jeder Zahl, die es woanders schon gibt: **Wo sieht Daniel diese Zahl, und aus welchem
Feld kommt sie dort?** Von dort wird sie genommen — sonst widerspricht der Footer der Anzeige, die er
gleichzeitig offen hat, und beschädigt das Vertrauen in beide.

## Wann kein Footer erscheint

- Es gibt weder Projektdateien noch eine Aufgabenliste — dann ist die Angabe
  bedeutungslos.
- Die Antwort ist selbst eine reine Aufgabenübersicht; dann steht sie schon im Text.
- **Daniel geht gerade seine eigenen Todos durch, und ich begleite ihn dabei.**
  Daniel am 11.09.2026: „während gemeinsamen daniel todo walkthrough kein todo
  footer, merk dir das." Die Phase beginnt, sobald er nach den nächsten
  Handgriffen fragt („ok daniel todo … was jetzt") oder Rückmeldungen aus dem
  Abarbeiten schickt. Sie endet, wenn er ein anderes Thema anfängt oder sagt,
  dass er fertig ist. In dieser Zeit liest er die Antworten neben der Arbeit;
  eine Liste von vierzehn Zeilen unter jeder Rückmeldung verdeckt genau die
  zwei Sätze, die er gerade braucht. Offenes wird weiterhin in `status.md`
  geführt — nur nicht bei jeder Antwort ausgegeben.

  **Die Phase endet stillschweigend, und das ist der Fehlgriff.** Sie beginnt
  mit einer Ansage und endet ohne eine: Der erste Prompt, der keine Rückmeldung
  aus dem Abarbeiten ist, beendet sie — ein neuer Auftrag, ein Fehlerbericht zu
  etwas anderem, eine Frage. Niemand sagt „wir sind durch", und deshalb läuft
  die Ausnahme weiter, bis jemand sie bemerkt.

  Real am 12.09.2026: Der Durchgang lief am Vormittag, dann kam ein eigener
  Auftrag zu „Lord of Mysteries" — und der Footer fehlte noch sieben Antworten
  später. Daniels Frage: „wir machen gerade kein daniel todo, also wieso keine
  todo footer?"

  **Prüffrage vor jeder Antwort, an der der Footer fehlen soll: Ist genau
  DIESER Prompt eine Rückmeldung aus dem Abarbeiten seiner Liste?** Nicht „lief
  heute ein Durchgang", nicht „vorhin war die Phase noch aktiv" — dieser Prompt.
  Lautet die Antwort nein, kommt der Footer zurück, ohne dass jemand ihn
  anfordern muss.

  **Im Zweifel mit Footer.** Einer zu viel kostet ein paar Zeilen; einer zu
  wenig nimmt ihm die einzige Stelle, an der der Gesamtstand steht.

  **Seit dem 12.09.2026 beginnt die Phase mit `/ai-daniel-todos`** — vorher gab
  es kein Startsignal, sondern nur eine Lage, die man erkennen musste. Die
  vollständige Anleitung (Schrittfolge, Linkformat, Stand merken, Ende) steht in
  `C:\code\ai\ai helper files\daniel-todos-durchgang.md`.

  **Und der Footer kommt nach einer Pause nicht stillschweigend zurück.** Hält
  die Antwort die Phase für beendet oder pausiert, steht **über** dem Footer
  eine Zeile, die das sagt und den Weg zurück nennt:

  ```
  Durchgang pausiert — zuletzt bei Netflix, 2 von 4 erledigt. `/ai-daniel-todos` setzt dort fort.
  ```

  Daniels Begründung (12.09.2026): „falls footer zwischendurch kommt bedeutet
  das du denkst durchgang ist vorbei, also mach ne klare ansage wenn du das
  denkst." Ohne die Zeile sieht ein wiederkehrender Footer aus wie ein Fehler
  statt wie eine Entscheidung.

## Genauigkeit

Die Zahlen werden **gelesen, nicht geschätzt**. Wurde in der Antwort etwas
erledigt, gehört es vorher aus der Liste gestrichen — sonst zählt der Footer eine
Aufgabe mit, die es nicht mehr gibt. Das ist der häufigste Fehler.

Umgekehrt gilt die bestehende Regel weiter: Jeder neue Wunsch des Nutzers landet
sofort in der Liste. Der Footer macht sichtbar, ob das wirklich passiert ist —
er ist eine Kontrolle, kein Schmuck.
