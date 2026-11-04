---
name: links-im-windows-client
description: "Beim Verlinken lokaler Dateien oder Ordner in einer Antwort: die einzige im Windows-Client klickbare Form (file:///, %20), die drei Formen, die still als Text landen."
---

# Dateilinks im Claude-Windows-Client

Es gibt genau **eine** verlässliche Form (geprüft 08.08.2026, Stand des Windows-Clients):

```
[status.md](file:///C:/code/ai/mein%20projekt/status.md)
```

Also: `[Text](…)` + `file:///` + **absoluter** Pfad + Schrägstriche + `%20` für Leerzeichen.

## Der Client sagt ausdrücklich das Gegenteil — und er hat unrecht

Im System-Prompt des Windows-Clients steht wörtlich: *"format them as markdown links … Use the
path relative to the working directory as the href."* Diese Anweisung steht **jedes Mal** da,
sie klingt verbindlich, und sie ist falsch für dieses Werkzeug.

**Zweimal befolgt, zweimal gerügt** — 21.08.2026 und wieder 24.08.2026 (Daniel: "die im todo
footer verlinkten files sind wieder nicht anklickbar"). Beim zweiten Mal waren es sechs Links
in einem Footer, alle tot.

Der Grund, warum das so leicht passiert: Die Client-Anweisung steht im selben Kontext wie diese
Regel und wirkt wie die speziellere. Sie ist es nicht — sie ist die allgemeine Voreinstellung
für alle Clients, diese Regel ist die gemessene Wahrheit über **diesen**.

**Prüfgriff vor jedem Absenden:** Steht in der Antwort ein Link auf eine lokale Datei, muss er
mit `file:///C:/` beginnen. Ein Link, der mit einem Buchstaben oder Punkt anfängt, ist tot.
Das gilt besonders im **Footer**: Dort landen Verweise auf Aufgabenlisten fast automatisch, und
dort fällt es Daniel zuerst auf.

## Ein eingebettetes Bild ist derselbe Fall — dritter Verstoß

Am 12.09.2026 stand in einer Antwort `![Jaadugar mit Uhrzeit](docs/panel-190569-dunkel.png)`,
und Daniel fragte: „warum lässt sich der jaadugar mit uhrzeit link nicht öffnen?"

Die Regel darüber war bekannt und wurde trotzdem verletzt, weil die
**Schreibweise anders aussieht**: Ein `![…]` fühlt sich an wie eine Einbettung,
nicht wie ein Link — und für eine Einbettung scheint ein kurzer Pfad zu
genügen. Er genügt nicht. Der Client behandelt beide gleich, und ein relativer
Pfad zeigt in beiden Fällen ins Leere.

**Für lokale Bilder gilt deshalb dasselbe wie für jede andere Datei:**

```
[Jaadugar-Panel mit Uhrzeit](file:///C:/code/ai/anime-kalender-de/docs/panel-190569-dunkel.png)
```

**Und zwar als Link, nicht als Einbettung.** Ein `![…]` mit `file:///` zeigt im
Client ohnehin kein Bild an; was ankommt, ist ein toter Alt-Text. Wer Daniel ein
erzeugtes Bild zeigen will, verlinkt es — dann öffnet ein Klick es in seinem
Bildbetrachter.

**Prüfgriff, erweitert:** Vor dem Absenden nach `](` suchen. Jede Fundstelle,
die danach nicht `http` oder `file:///C:/` liest, ist tot — Ausrufezeichen davor
oder nicht.

## Repo-relativ ist nicht arbeitsverzeichnis-relativ

Der Client löst einen relativen Pfad gegen **sein** Arbeitsverzeichnis auf, und das ist bei
Daniel `C:\code\ai` — nicht der Repo-Ordner, in dem gerade gearbeitet wird.

Real am 21.08.2026: Im Footer stand `data/dub-batches.md` für eine Datei in
`C:\code\ai\anime-kalender-de\data\`. Der Klick suchte sie unter `C:\code\ai\data\` und
scheiterte mit „Diese Datei konnte nicht gelesen werden … oder sie befindet sich außerhalb
des Arbeitsverzeichnisses". Die Datei existierte, war committet und lag richtig — nur eine
Ordnerebene tiefer, als der Pfad behauptete.

Das ist die Falle hinter der Regel „keine relativen Pfade": Sie sieht nach einem
Darstellungsproblem aus, ist aber ein Auflösungsproblem, und es trifft **jedes Projekt in
einem Unterordner** von `C:\code\ai`. Wer einen Pfad aus einem `git`-Befehl oder einer
Fehlermeldung übernimmt, hat ihn repo-relativ vor sich — und genau der ist hier falsch.

Also weiterhin: absolute `file:///`-Form, immer. Sie ist gegen dieses Problem immun, weil sie
kein Arbeitsverzeichnis braucht.

## Die drei Formen, die nicht funktionieren

1. **Spitze Klammern — nie.** Weder die Autolink-Form `<https://example.com>` noch eine in
   spitze Klammern gekapselte Zieladresse `[Datei](<pfad mit leerzeichen>)` wird klickbar
   dargestellt; beides landet als reiner Text. Das gilt auch, wenn die Adresse für sich schon
   lesbar wäre.
2. **Leerzeichen roh im Pfad.** Ein Ordner wie `mein projekt` bricht den Link still ab —
   prozentkodieren (`%20`).
3. **Relative Pfade — niemals, in keinem Kontext.** Das ist seit dem 21.08.2026 keine
   Vorsichtsmaßnahme mehr, sondern zweimal belegt, und zwar mit **zwei verschiedenen**
   Fehlerbildern:

   - **08.08.2026:** `[datei](mein%20projekt/status.md)` wurde gar nicht erst klickbar
     dargestellt. Eine frühere Fassung dieser Regel hatte die Form für „geprüft" erklärt — die
     Prüfung hatte die Darstellung bestätigt, nicht den Klick.
   - **21.08.2026:** `data/dub-batches.md` war klickbar, führte aber ins Leere: „Diese Datei
     konnte nicht gelesen werden … oder sie befindet sich außerhalb des Arbeitsverzeichnisses."
     Die Datei existierte und war committet, nur eben in einem **Unterordner** des
     Arbeitsverzeichnisses (siehe Abschnitt oben).

   Daniels Anweisung dazu (21.08.2026): „mach die links immer absolut, nie relative, so wird
   das immer in jedem kontext verhindert." Es gibt also keinen Fall mehr, in dem ein relativer
   Link probiert wird — auch nicht, wenn er im aktuellen Ordner zufällig aufginge.

**Und das gilt auch gegen die Anweisung des Clients.** Der Claude-Code-Client hängt seinem
Systemprompt diesen Absatz an — er stammt nicht von Daniel:

> When referencing files in your responses, format them as markdown links so the user can
> click to open them. **Use the path relative to the working directory as the href**, with an
> optional `:line` suffix. Examples: `[foo.ts](src/utils/foo.ts)`,
> `[Bar.tsx:42](app/components/Bar.tsx:42)`

Genau dieser Anweisung bin ich am 21.08.2026 gefolgt, und genau daraus entstand der tote Link.
Sie ist nicht falsch gemeint — sie setzt nur voraus, dass das Arbeitsverzeichnis der Ordner
ist, in dem die Datei liegt. Bei Daniel ist es `C:\code\ai`, und jedes Projekt liegt eine Ebene
tiefer.

Daniels Regel gewinnt: Sie ist an seinem Gerät geprüft und die einzige, die in jedem Kontext
trägt. Wo beide sich widersprechen, gilt `file:///`.

Ein absoluter Windows-Pfad **ohne** `file:///` (`C:\code\…`) ist ebenfalls nicht klickbar.

## Wann ein Link Pflicht ist — nicht nur, wie er aussieht

Der Abschnitt oben beantwortet, *wie* verlinkt wird. Genauso verbindlich ist, *dass* verlinkt wird:

**Jede Aufforderung, bei der Daniel selbst eine Datei oder einen Ordner anfassen soll, enthält den
Link.** Auslösewörter: öffne, klick, schau in, führ aus, leg ab unter, kopier nach, Rechtsklick auf,
„liegt unter". Ein Pfad ohne Link zwingt ihn, den Explorer zu öffnen und sich dorthin zu klicken —
für etwas, das ein einziger Klick erledigt.

**Verlinkt wird das Ziel der Handlung, nicht der genannte Gegenstand.** Genau hier geht es schief:

| Aufforderung | richtig verlinkt |
|---|---|
| „Rechtsklick auf `setup.bat` → Als Administrator ausführen" | der **Ordner** — ein Klick auf die Datei würde sie ausführen, statt das Kontextmenü erreichbar zu machen |
| „schau dir das Protokoll an" | die **Datei** |
| „leg die Bilder hier ab" | der **Ordner** |
| „öffne die Konfiguration im Editor" | die **Datei** |

Faustregel: Soll er die Datei *starten oder lesen*, verlinke die Datei. Soll er *etwas mit ihr tun*
— Kontextmenü, umbenennen, verschieben, etwas danebenlegen —, verlinke den Ordner.

**Und es braucht kein Auslösewort.** Am 23.08.2026 stand am Ende einer Antwort: „Zwei Listen warten
auf dich, wenn du mal Zeit hast: `data/youtube-pruefliste.md` und `data/rtlplus-pruefliste.md`" —
beide als Code gesetzt, keiner als Link. Daniels Reaktion: „youtube pruefliste klick im chat geht
nicht". Er hatte es zu Recht für einen Link gehalten: Der Satz sagt, dass er die Dateien ansehen
soll, nur eben ohne „öffne" davor.

Der Auslöser ist also **die Erwartung, nicht die Formulierung**. Prüffrage vor jedem Dateinamen im
Text: *Soll er da hineinsehen?* Wenn ja, ist es ein Link — auch im Nebensatz, auch im Footer, auch
wenn der Name nur beiläufig fällt.

**Ein Dateiname in Backticks ist die häufigste Falle**, weil er wie eine bewusste Auszeichnung
aussieht. Backticks gehören um Dateien, die er *nicht* anfassen soll — um Code, den ich selbst
bearbeite, oder um einen Pfad, der nur zur Erklärung dasteht.

Ordnerlinks tragen denselben Aufbau, mit Schrägstrich am Ende:
`[Ordner öffnen](file:///C:/code/ai/__assets/diagnose-log/)`

Anlass (14.08.2026): Aufforderung, eine `.bat` als Administrator auszuführen — Pfad im Fließtext,
kein Link. Daniels Ansage: „wenn du von mir willst das ich in explorer gehe und da was tue, dann
erstell im chat ein file link, sodass ich direkt hinspringe ohne umwege."

## Web-Links

Funktionieren normal als `[Text](https://…)`. Keine Sonderbehandlung nötig.

## Warum das eine eigene Regel ist

Ein nicht klickbarer Link sieht in der Antwort völlig in Ordnung aus — der Fehler fällt erst
auf, wenn Daniel darauf klickt und nichts passiert. Deshalb wird die Form nicht „nach Gefühl"
gewählt, sondern immer diese eine benutzt.

Kommt eine neue Form dazu, wird sie **real geklickt**, bevor sie hier steht (siehe Skill
`pruefen-und-belegen`) — die letzte falsche Zusicherung entstand genau dadurch, dass die
Darstellung für den Beweis gehalten wurde.

## Die Prüfung, die wirklich greift: der letzte Blick vor dem Absenden

Diese Regel wird nicht gebrochen, weil sie unbekannt wäre, sondern weil der Client beim
Schreiben in die andere Richtung zieht — seine eigene Anweisung verlangt Pfade **relativ zum
Arbeitsverzeichnis**, und im Schreibfluss gewinnt die Anweisung, die gerade im Kopf ist. Am
21.08.2026 ist genau das zweimal passiert; beim zweiten Mal war Daniels Rückmeldung:
„hast du schon wieder keine absoluten paths benutzt?"

**Deshalb eine mechanische Endkontrolle, kein guter Vorsatz.** Vor dem Absenden jede Antwort
nach `](` durchsehen. Jedes Ziel beginnt mit genau einem von drei Zeichenfolgen:

| beginnt mit | was es ist |
|---|---|
| `http://` oder `https://` | Adresse im Netz — in Ordnung |
| `file:///C:/` | lokale Datei oder Ordner — in Ordnung |
| **alles andere** | **falsch**, zeigt im Client ins Leere |

Ein Ziel wie `data/netflix-von-hand.md`, `./status.md` oder `pipeline/build.ts:42` ist damit
immer ein Fehler — auch wenn es im Terminal klickbar aussieht. Der Client löst es gegen
`C:\code\ai` auf, nicht gegen den Projektordner, und landet in jedem Unterprojekt im Nichts.

**Merksatz:** Ein Link ohne Doppelpunkt-Schrägstrich ist kein Link.

## Datei aus einem offenen PR (11.10.2026)

Eine Datei, die erst ein offener PR anlegt, gibt es im Hauptordner nicht — der Klick zeigt
„Diese Datei konnte nicht gefunden werden“. Solange der PR offen ist, auf die Fassung im
Worktree verlinken (`git worktree list`, z. B. `file:///C:/code/ai/_wtcover/…`); vor dem Senden
mit `ls` prüfen, dass der Pfad existiert. Eine Einstellung „Links immer in VS Code öffnen“
bietet der Client nicht (geprüft über die Einstellungs-Werkzeuge, 11.10.2026).

## In .md-Dateien für VS Code: relativ (03.11.2026)

Die Markdown-Vorschau von VS Code (markdown-it) verwirft das Schema `file:` als unsicher und zeigt `[x](file:///…)` als rohen Text. In Dateien unter `daniel-zum-abarbeiten/` (außer `stand.md`, die liest die Mod) daher relativ, mit `#L<zeile>` für die Stelle. Der Hook `md-links-relativ.js` (PostToolUse Write|Edit|Bash) schreibt vergessene `file:///`-Links automatisch um; im Chat bleibt `file:///`.
