# Browser-Erweiterung (Amazon, Netflix, Disney+)

Ausgelagert aus `CLAUDE.md` am 18.09.2026, wortgleich. **Wann lesen:** Vor jeder Änderung an `extension/` und vor jedem Fix an einem Melde-Knopf, Leser, Kasten oder Durchlauf.

### Amazon: die Folgenliste kommt seitenweise, und die Seite verrät ihre eigenen Zugänge

Prime Video zeigt lange Staffeln in Abschnitten („Folgen 1–24", „25–48", „49–51"). **Im
Quelltext steht immer nur der gewählte Abschnitt** — wer ihn als Staffel liest, hält 24 von 51
Folgen für das Ganze. Genau das tat die erste Fassung der Erweiterung (Daniel, 23.08.2026, mit
Bild: „aber warum steht beim button 27? auf der seite gibt es ein dropdown für folge 1-24").

Nachgeladen wird über `/gp/video/api/getDetailWidgets?titleID=<ASIN>&widgets=[…]`. Die Antwort
ist gültiges JSON und trägt neben dem Abschnitt **die Zugänge zu allen übrigen**:

```
widgets.episodeList.episodeCount                     → 51
widgets.episodeList.episodes[].detail.audioTracks    → ["Deutsch"]
widgets.episodeList.episodes[].detail.episodeNumber  → 25 … 48
widgets.episodeList.actions.episodePages[].token     → alle drei Abschnitte
```

Drei Dinge, die man beim Weiterbauen braucht:

- **Geparst, nicht abgetastet.** Die erste Fassung suchte per Muster ein `episodeNumber`
  innerhalb von 240 Zeichen hinter `audioTracks`. Gemessen sind es 217 — es ging gut, mit 23
  Zeichen Luft, und nur weil `contributors.cast` bei dieser Serie leer ist. Ein Abstand, der
  vom Inhalt eines Nachbarfelds abhängt, ist keine Regel, sondern ein Zufall mit Frist.
- **`episodeCount` schlägt die Zahl im Seitengerüst.** Die dort steht für die gerade gewählte
  Staffel; die Nachlade-Antwort meint die Folgenliste, um die es geht.
- **Aus einem Ausschnitt entsteht nie ein Nein.** „Deutsch gefunden" bleibt wahr, auch bei 24
  von 51 Folgen. „Kein Deutsch" wäre eine Aussage über die ganze Staffel, gestützt auf die
  Hälfte — dieselbe Asymmetrie, die dieses Projekt an fremden Quellen bemängelt.

**Die erste Fundstelle eines Feldnamens ist fast nie die richtige.** `titleID` steht im
Quelltext der Digimon-Seite **220-mal** — 1,6 MB, Empfehlungsleisten, Verfolgungsmarken, leere
Vorlagen. Eine Fassung, die `indexOf` nimmt und beim Misserfolg aufgibt, scheitert an der
falschen Stelle und sieht die richtige nie; genau daran blieb der Knopf zweimal bei „24 von
51" stehen. Gesucht wird über **alle** Fundstellen, bis eine einen brauchbaren Wert trägt.

**Und was direkt daneben steht, gehört nicht dazu.** Hinter `episodePages` führt Amazon
dieselben Abschnitte ein zweites Mal als `pagination` („Vorherige Seite", „Nächste Seite") —
unter **eigenen Tokens**. Ein Ausschnitt fester Länge fängt beide, und der Leser holte einen
Abschnitt doppelt: 267 KB umsonst je Seitenaufruf. Geschnitten wird deshalb über die Klammern
des Arrays, nicht über eine Zeichenzahl und nicht über das Stichwort dahinter.

**Die Erweiterung holt die übrigen Abschnitte selbst**, mit den mitgelieferten Tokens, in
Daniels angemeldeter Sitzung, 400 ms auseinander, höchstens 25 Stück. Das ist Zeichen für
Zeichen der Abruf, den ein Klick aufs Auswahlfeld auslöst — keine Suche, kein Durchlauf, keine
zweite Serie. Wo die Grenze greift oder ein Abruf fehlschlägt, bleibt die Zahl unvollständig,
und der Knopf sagt es.

**Und eine Prime-Kennung hat nicht immer zehn Zeichen.** Sieben Muster in der Erweiterung
suchten sie als `[A-Z0-9]{10}` — die Länge einer ASIN. Prime Video führt daneben **GTIs mit 26
Zeichen**, und das Muster schnitt sie ab: Aus `0J16B1NAB82TO0O5A5Q8TLG1VP` wurde
`0J16B1NAB8`. Der Abgleich zwischen Adresse und Quelltext scheiterte damit zwangsläufig, die
Tonspuren wurden gar nicht erst gelesen, und der Knopf blieb auf „Tonspuren noch nicht geladen"
stehen — bei „Babylon" wie bei „Akame ga Kill" (25.08.2026).

**Aufgefallen ist es nur durch eine Messung in Daniels Sitzung**, und das ist die eigentliche
Lehre: Von außen sah es aus, als fehlten die Daten. Tatsächlich lagen 15 Tonspurangaben mit
Deutsch auf der Seite, und die Paarung fand 12 Folgen — gelesen wurden sie nie, weil ein
Wächter davor die Seite für die falsche hielt. Ein Befund „nichts gefunden" beantwortet die
Frage nicht, **ob überhaupt gesucht wurde**.

Der Feldabstand aus derselben Messung gehört dazu: Zwischen `audioTracks` und der zugehörigen
`episodeNumber` lagen **33.651 Zeichen**. Jede feste Abstandsgrenze im Muster wäre daran
gescheitert; gepaart wird deshalb über die Reihenfolge — zur Tonspurangabe gehört die nächste
Folgennummer dahinter, solange vorher keine weitere Tonspurangabe kommt.


**Was die Erweiterung je Takt kostet, steht gemessen in
[`extension/PERFORMANCE.md`](extension/PERFORMANCE.md)** — mit den Stellen, die man
zwischenspeichern darf, und denen, die aussehen wie Sparpotenzial und keins sind. Wer an
`amazon.js` oder `amazon-leser.js` etwas an der Leistung ändern will, liest das zuerst:
Mehrere der teuer aussehenden Muster sind Reparaturen echter Fehlschläge.

### Der Quelltext veraltet beim Staffelwechsel — und das ist die Wurzel

**Amazon tauscht beim Wechsel über das Auswahlfeld den Quelltext nicht aus.** Adresse und ASIN
wandern mit, die JSON-Fracht im Skriptblock bleibt die der geladenen Seite. Gemessen am
24.08.2026 mit `tools/amazon-diagnose.js`, an zwei Titeln unabhängig:

```
GOSICK, Staffel 1 → 2
ms     adrAsin       adrStaffel   qtAsin        qtStaffel
262    B0B8MTPWRN    —            B0B8MTPWRN    1
7261   B0B8XVGL62    2            B0B8MTPWRN    1
8519   B0B8XVGL62    2            B0B8MTPWRN    1

Captain Tsubasa, Staffel 1 → 2 → 3
263    B07C1D8JXX    —            B07C1D8JXX    1
12018  B07CZRCQ6V    2            B07C1D8JXX    1
19766  B07DNKH81W    3            B07C1D8JXX    1
```

Nach zwanzig Sekunden und zwei Wechseln steht der Quelltext unverändert auf Staffel 1.
Folgenzahl, Staffelnummer, Kennung und Abschnitts-Tokens gehören danach alle zur **alten**
Staffel.

**Daraus folgt für jede Auswertung dieser Seite:** Nach einem Dropdown-Wechsel ist der
Quelltext wertlos. Verlässlich bleibt allein die Adresse — sie trägt `?ref_=…_sN` und die ASIN
der gewählten Staffel.

Die Erweiterung verlangt deshalb seit dem 24.08.2026 ein Neuladen, sobald Adresse und
Quelltext verschiedene Staffelnummern nennen. Das ist keine Notlösung: Sie kann nicht wissen,
was Staffel 3 enthält, wenn Amazon es nirgends hinschreibt.

**Überholt am 15.09.2026: Sie holt es sich selbst.** Der Mitleser lud die Folgen einer neuen
Staffel längst über `getDetailWidgets` nach — Zugang, Kanal, Jahr und Staffelnummer kamen aber
weiter aus dem alten Block, und kein Wächter schlug an. Daniel an Bungo Stray Dogs (Staffel 3 →
Auswahlfeld Staffel 1): ohne Neuladen „🇩🇪 Deutsch · 12 Folgen · Staffel 1 · Abo + Kauf · ⚠
Kanal", nach dem Neuladen „✕ kein Deutsch" auf einer Seite, die in der Region nicht verfügbar
ist. „fix das es direkt ohne neuladen klappt." Seit 4.20.9 ruft der Leser nach jedem
Adresswechsel innerhalb der Seite die neue Adresse einmal im Hintergrund ab
(`ausNachgeholterSeite()` in `amazon-leser.js`) und schickt den Quelltext mit; `seitenHtml()`
liefert diesen Stand (`ersatzQuelltext`), solange er zur Adresse gehört. Das bildet das Neuladen nach, statt Amazons
interne Anfragen zu erraten. Im Tagebuch des Berichts steht `quelltext-nachgeholt` oder der
Grund, warum es nicht geklappt hat.

**Und der erste Anlauf dazu hat nur die halbe Quelle erwischt.** 4.20.8 holte den Quelltext
für `amazon.js` nach; Zugang und Kanal stimmten danach, „🇩🇪 Deutsch" blieb. Daniels Bericht
zeigte es auf die Zehntelsekunde: 19,896 s nach dem Wechsel „✕ kein Deutsch", 0,18 s später
wieder „Deutsch" mit zwölf Folgen „Deutsch Dialogue Boost" — die Tonspuren von Staffel 3. Der
**Mitleser** (`amazon-leser.js`) las den Hydration-Block aus dem DOM und stempelte ihn mit der
neuen Adresse; `hydrationFinger()` enthält den Pfad, also las er bei jedem Wechsel denselben
alten Block „neu". Seit 4.20.9 liest er den DOM-Block nur auf der geladenen Seite
(`startPfad`); nach einem Wechsel holt `seiteNachholen()` die neue Seite, liest den Block aus
der Antwort und reicht den Quelltext an `amazon.js` weiter — ein Abruf statt zwei.
**Wer eine veraltete Quelle ersetzt, sucht jeden Leser dieser Quelle** — hier waren es zwei
Welten (Content-Skript und Seitenskript), die denselben Block unabhängig lasen.

**Eine leere Tonspurliste ist Schweigen — auch zwischen zwei eigenen Quellen.** Minuten
später, Staffel 3 frisch geladen: „✕ kein Deutsch", obwohl dieselbe Seite eben noch „Deutsch"
zeigte. Der zweite Bericht: Die Seitendaten meldeten zwölf Folgen mit Deutsch, 0,54 s danach
lieferte `getDetailWidgets` dieselben Folgen mit **leeren** `audioTracks` (Aniverse-Kanal ohne
Abo) und überschrieb die Liste. Beim Laden davor kamen beide Antworten andersherum an. Seit
4.20.10 überschreibt eine leere Liste keine gefüllte. Die Regel „aus Schweigen folgt kein Nein"
galt bisher für fremde Quellen; sie gilt genauso, wenn zwei Abrufe desselben Anbieters
nacheinander eintreffen. **Ein Befund, der von der Ankunftsreihenfolge abhängt, ist ein
Wettlauf — Prüfgriff: denselben Bericht zweimal ziehen und die Reihenfolge im Tagebuch
vergleichen.**

**Und die Frage dahinter stellt Daniel, nicht der dritte Fix.** Daniel am 15.09.2026 nach drei
Anläufen an einem Vormittag: „warum ist das so kompliziert … es ist ein simples scraping …
mitbekommen wann ein wechsel passiert, bisherige scraping data entsprechend zurücksetzen und
scraping erneut starten … ich versteh nicht wo die schwierigkeit oder komplexität sein soll."
Die Schwierigkeit lag nicht bei Amazon, sondern im Aufbau: Mehrere Quellen (DOM-Block,
Quelltext-Muster, `getDetailWidgets`, nachgeholte Seite) schreiben in **einen** Zählstand, und
jede Fehlerrunde seit dem 24.08. hat einen Wächter dazugebaut statt eine Quelle wegzunehmen.
**Prüffrage vor jedem weiteren Fix an der Amazon-Erweiterung: Entsteht der Fehler, weil zwei
Quellen dasselbe beantworten?** Dann ist der Fix, eine davon zu streichen — nicht, eine
Vorrangregel zwischen ihnen zu erfinden.

**Umgebaut am 15.09.2026 (4.20.11, Phase 1): der Leser ist die eine Quelle.**
`amazon-leser.js` hält je Seite **einen** Zustand, geschlüsselt über Pfad und Staffel aus der
Adresse. Beim Laden liest er den Hydration-Block aus dem DOM, nach einem Wechsel aus der
nachgeholten Seite; die übrigen Abschnitte holt er über die Tokens aus demselben Quelltext.
Gesendet wird an **einer** Stelle, immer der ganze Zustand (`schnappschuss: true`), und
`amazon.js` ersetzt seinen Zählstand damit. Gestrichen sind das Mitlesen von Amazons eigenen
`fetch`/XHR-Anfragen, der gezielte Staffel-Abruf (`holeStaffel`), der Muster-Rückfall und die
Wechselerkennung über das erste Token. `amazon-nachladen.test.cjs` prüft das Modell an der
echten Digimon-Antwort, `amazon.test.cjs` hält fest: eine Sendestelle, ein neuer Zustand je
Wechsel, keine Hooks auf `fetch`/XHR. Phase 2 räumt die Stellen in `amazon.js` auf, die Angaben
weiterhin selbst aus dem Quelltext ziehen (Liste in `status.md`).

**Phase 2 ist am 15.09.2026 abgeschlossen (4.20.15–4.20.19).** Aus dem Schnappschuss kommen
jetzt Tonspuren, Film, Kennung, Staffel, Abos (`seite.zugaenge`) sowie Kauf und Leihe
(`seite.kaufbar`/`leihbar` aus `actionType: TRANSACT` im Aktionsblock). Gestrichen sind
`spuren()`, `sprachnamen()`, `teilBereich` und das zweite Parsen in `filmAusSeite()`. Die
Quelltext-Wächter bleiben bewusst: Sie bewachen nur noch, was wirklich aus dem Seitentext
kommt (Titel-Rückfälle, Zahl über der Liste).

**Und das alte Kaufmuster war eine Fehlanzeige — gemessen am selben Abend.** Golden Kamuy
(`0QG5UD99TZDIAQSBIEJD3EXG2Y`) meldete am 27.08. `zugang=abo_und_kauf`, mit 4.20.19 `abo`.
Anonym nachgemessen: Der Aktionsblock nennt nur `SUBSCRIBE`, kein `TRANSACT`; die sieben
Treffer für „Als Kauftitel verfügbar" im Quelltext stehen alle in `focusMessage`/`glanceMessage`
— den Hinweisen auf Kacheln **fremder** Titel in den Empfehlungsleisten. Dieselbe Falle wie bei
`benefitId`: Ein Muster über den ganzen Quelltext liest die Nachbarn mit. **Die Seite war davon
nicht betroffen:** Der Bau rechnet die Zugangsart selbst (`shared/zugangsart.ts`) und liest
`zugang=` aus der Notiz nicht; Golden Kamuy stand im Datensatz schon auf `abo`. Die
465 `zugang=abo_und_kauf` und 226 `zugang=kauf_oder_leihe` in `data/dub-confirmed.yaml`
(gezählt am 15.09.2026) sind deshalb nur Notiztext und kein Beleg für einen Kaufweg.

**Ein Rückfall verdeckt die Fehler der Quelle, die er ersetzt.** Phase 2 (15.09.2026) nahm
`staffelAusSeite()` den Muster-Rückfall — und zwei Zusicherungen wurden rot, weil
`beiStaffelwechsel()` die Staffelnummer aus dem Schnappschuss sofort wieder leerte:
`staffelKennung()` liest sie, also galt jeder neue Schnappschuss selbst als Wechsel. Seit
Wochen lief das so, und der Rückfall fand die Nummer jedes Mal im Quelltext wieder. Gefunden
hat es erst eine Messung in einer Testkopie (Diagnose des Knopfs nach dem ersten Takt), nicht
der zweite Fix-Versuch. **Wer einen Rückfall streicht, rechnet damit, dass darunter ein
Fehler zum Vorschein kommt — und misst, statt die Kulisse umzubauen, bis der Test grün ist.**

**Was das an einem Abend gekostet hat**, gehört dazu: ein Dutzend Fehler, die alle wie
verschiedene Fehler aussahen — falsche Folgenzahl, verschluckte Meldungen, „nicht abrufbar"
bei vorhandenen Titeln, hängende Knöpfe. Dagegen wurden nacheinander sechs Wächter gebaut
(Beruhigungsfristen, Signaturvergleiche, Zustandsprüfungen), von denen drei zurückgenommen
werden mussten, weil sie neue Fehler erzeugten — und einer brachte den Tab mit „Out of Memory"
zum Absturz, weil jede neue Prüfung den 1,6 MB großen Quelltext ein weiteres Mal las.

**Die Lehre ist nicht die Regel, sondern der Weg dorthin:** Drei Minuten Messung an der echten
Seite hätten das an jedem Punkt des Abends beendet. Der Grund, warum es sie nicht gab, war,
dass die Seite in Daniels angemeldeter Sitzung läuft — also wurde geraten statt gefragt. Wo
eine Messung nur ein Mensch machen kann, wird sie **erbeten**, nicht ersetzt.


**Und ein sprunghafter Fehler ist ein Wettlauf, kein Zustand.** Am 25.08.2026 kostete diese
Verwechslung vier Fassungen: Die Erweiterung zeigte beim Wechsel zwischen Titeln mal die
richtige Folgenzahl, mal die des vorigen. Gesucht wurde jedes Mal im Zustand — ein hängender
Wert, ein zweiter, ein Vergleich, der zweimal dieselbe Quelle abfragte. Jede Erklärung passte zu
den Daten, keine hielt.

Gefunden hat es Daniel durch **Abwarten**: sofort weiterklicken ergab „13 von 24", zwanzig
Sekunden warten „24 von 24". Die noch laufenden Nachlade-Abrufe des vorigen Titels antworteten
nach dem Wechsel, und ihre Daten landeten im frisch geleerten Zählstand des neuen.

**Der Prüfgriff dauert zwei Durchläufe** — dieselbe Handlung einmal so schnell wie möglich,
einmal mit Pause. Unterscheiden sich die Ergebnisse, ist es Timing, und jede Zustandsanalyse
davor war verlorene Zeit.

**Der Fix ist immer derselbe:** Jede asynchrone Antwort trägt mit, wozu sie gehört, und der
Empfänger verwirft Fremdes. Hier ist es `fuerAdresse` an jeder Mitleser-Meldung. Eine überholte
Antwort ist schlimmer als keine — sie sieht aus wie ein Ergebnis.


### Ein `let` weiter unten ist kein `undefined`, sondern ein Absturz

Am 25.08.2026 meldete Daniel: „dialog öffnet sich nicht auf amazon.de". Das Fehlerbild aus
`chrome://extensions`:

```
Uncaught ReferenceError: Cannot access 'listenId' before initialization
amazon.js:1286 (anonymous function)
```

`listenSignatur()` liest `listenId` rund 300 Zeilen **vor** dessen `let`. Beides steht im
selben Scope, und ein `let` hebt den Namen zwar hoch, aber nicht den Wert: Jeder Zugriff
davor wirft, statt `undefined` zu liefern.

**Aufgefallen ist es erst nach Monaten, und der Grund dafür ist die eigentliche Lehre.** Der
Fehler tritt nur auf Seiten auf, deren Adresse **keine Kennung** trägt. Gemessen am Stand
vor dem Fix, mit demselben Klick auf drei Adressen:

| Adresse | Klick auf den Übersichts-Knopf |
|---|---|
| `/` | **Fehler** — Cannot access 'listenId' |
| `/gp/video/storefront` | **Fehler** — dito |
| `/dp/B0DJYJBNWF` | ok |

Auf einer Titelseite setzt der Ablauf den Wert, bevor jemand die Liste öffnet. **Und alle
43 Zusicherungen starteten mit genau dieser dritten Adresse** — die Prüfung deckte den
Normalfall vollständig ab und den Fehlerfall gar nicht.

Zwei Folgen für jede künftige Prüfung:

1. **Wo eine Erweiterung überall läuft, gehört in die Zusicherungen.** Das Manifest sagt
   `https://www.amazon.de/*` — das ist die Startseite, der Shop und jede Videoseite. Wer nur
   die interessanteste davon prüft, prüft die Seite, auf der ohnehin niemand klickt.
2. **Ein sichtbarer Knopf beweist nicht, dass das Skript durchgelaufen ist.** Er entsteht vor
   der Absturzstelle. Was danach kommt — Zahl aktualisieren, Liste öffnen — läuft nicht mehr,
   und die Zahl auf dem Knopf bleibt stehen, wie sie beim Aufbau gerade war. Das sieht aus
   wie ein veralteter Wert und ist ein toter Ablauf.

Nachprüfbar mit `node tools/amazon-startseite-pruefen.cjs` — es lädt `amazon.js` in einem
Sandkasten, einmal je Adresse, und klickt.

### Ein Titelwechsel sieht aus wie ein richtiger Befund — die Kennung entlarvt ihn

Am 25.08.2026 meldete die Erweiterung für **„My Isekai Life"** neun Tonspuren
einschließlich Deutsch, und der Knopf war grün. Daniel: „button war grün, aber titel
hat keine deutsche sprachausgabe."

Die Meldung trug zwei Kennungen, und darin steckt der ganze Fall:

```
url:      .../gp/video/detail/0RNU3R7XQ7HDN1EOCZRAFD5R5R
notiz:    „Amazon-Seite B0FMNQMXXG"
sprachen: Deutsch, English, Español ×2, Français, Italiano, Português, ไทย, 日本語
```

Beide nachgemessen, ohne Anmeldung:

| Kennung | Titel | Zugang | `audioTracks` je Folge |
|---|---|---|---|
| `0RNU3R7XQ7HDN1EOCZRAFD5R5R` | My Isekai Life | `animedigitalde` (ADN-Kanal) | `["日本語"]`, 12×12 |
| `B0FMNQMXXG` | Ein Stern, heller als die Sonne | `Prime`, `FVOD` | die neun Sprachen, 13× |

Der zweite Titel war Daniels **vorige** Meldung — abgeschickt vier Sekunden früher.
Die Adresse war schon gewandert, der Quelltext noch nicht.

**Keiner der drei vorhandenen Prüfsteine konnte greifen**, und das ist der Kern:
Die Staffelnummer war in beiden Fällen dieselbe, die Folgenzahl **beide Male 12**,
und ohne gezielt geholten Block (`frischeStaffel === null`) fiel der Kennungsvergleich
ganz aus — bewusst, damit Sammelseiten funktionieren. Drei Wächter, drei blinde Flecken
am selben Punkt.

**Was trägt, ist eine andere Frage als die bisherige.** Bisher wurde gefragt: *Nennt der
Quelltext dieselbe Kennung wie die Adresse?* Darauf antwortet eine echte Seite regelmäßig
mit Nein, ohne dass etwas kaputt ist — Digimon Tamers liegt unter der Adresse
`B0CQ4VL364` und trägt im Quelltext die `titleID` `B0CKPCSHMC`. Die tragfähige Frage
lautet stattdessen: **Kennt der Quelltext die Kennung aus der Adresse überhaupt?**

An sechs Seitenabrufen gemessen:

| | Treffer |
|---|---|
| eigene Kennung im eigenen Quelltext | 11× bis 119× |
| fremde Kennung im Quelltext | **0×** |
| Digimon: Adress-Kennung neben fremder `titleID` | 11× (die `titleID` 79×) |
| GOSICK Staffel 1: Kennung der **zweiten** Staffel | 3× |

Die letzten beiden Zeilen sind die eigentliche Gegenprobe: Ein *Staffel*wechsel und eine
Seite mit zwei Ausgaben laufen nicht hinein, ein *Titel*wechsel schon. Null Treffer heißt
deshalb eindeutig: Der Quelltext gehört zu einem anderen Titel.

**Und die allgemeine Lehre steht über dem Einzelfall:** Ein Wächter, der zwei Dinge auf
Gleichheit prüft, scheitert an jedem Fall, in dem Ungleichheit erlaubt ist — und die
Ausnahme, die man dafür einbaut, ist genau das Loch. Die Frage nach **Zugehörigkeit**
(kommt es vor?) trägt, wo die Frage nach **Gleichheit** (ist es dasselbe?) eine Ausnahme
braucht.

### Prime teilt eine Staffel in Bände — die Folgenzahl gilt dann für beide

Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 3 (`B0FHGJ7KS1`), mit Bild: „extension
erwartet 96, ausklappbar sind nur 48, weil prime es in 2 volumes gesplittet hat."

Die Staffelliste im Hydration-Block sagt es selbst — und mischt dabei zwei Schreibweisen in
**einer** Liste:

```
B0CB8SGJCZ  Staffel 1, Band 2      sequenceNumber 1
B0GTJV4S7L  Season 1, Volume 2     sequenceNumber 1
B0GV8N71SL  Season 2, Volume 2     sequenceNumber 2   ← gewählt
B0FHGJ7KS1  Season 3, Volume 2     sequenceNumber 3
```

`metadata.episodeCount` nennt dazu „96 Folgen" — die Zahl der **ganzen Staffel 3**. Von dieser
Seite aus erreichbar sind vier Abschnitte (1–8, 9–16, 17–25, 25–48), zusammen 49 Einträge. Der
Knopf wartete auf 96 und stand für immer auf „lädt nach".

**Vollständig ist deshalb, wenn kein Abschnitt mehr aussteht — nicht, wenn eine Zahl erreicht
ist.** Der Mitleser kennt jedes Token, das die Seite genannt hat, und weiß, welche er geholt
hat; er meldet beides als `abschnitte: { gesamt, offen }`. `istVollstaendig()` in `amazon.js`
entscheidet daran und fällt nur dann auf den Zahlenvergleich zurück, wenn die Seite gar keine
Abschnitte nennt (Film, kurze Staffel).

**Ein Textmuster auf „Volume" wäre der falsche Weg gewesen**, und die Liste oben zeigt warum:
Dieselbe Serie führt „Band" und „Volume" nebeneinander, und `sequenceNumber` ist bei beiden
Bänden derselbe. Die Frage „steht noch etwas aus?" beantwortet die Sache direkt, ohne über die
Beschriftung zu raten.

**Und `sequenceNumber` ist dort ein Sortierschlüssel, keine Staffelnummer.** Dieselbe Liste,
vollständig:

```
B0CB8SGJCZ  seq 1    Staffel 1, Band 2
B0GTJV4S7L  seq 1    Season 1, Volume 2
B0GV8N71SL  seq 2    Season 2, Volume 2   ← gewählt
B0FHGJ7KS1  seq 3    Season 3, Volume 2
B01EKI0P2U  seq 101  Season 1, Volume 1
B01EKI0SQ8  seq 201  Season 2, Volume 1
```

Daniel dazu: „yu gi oh zexal has weird seasons." Sechs Einträge für drei Staffeln, zwei
Schreibweisen nebeneinander, Band 2 vor Band 1 — und die beiden Bände 1 tragen 101 und 201.

**Die Adresse trägt genau diese Zahl** (`?ref_=atv_dp_season_select_s101`). Solange
`staffelAusAdresse()` vorn stand, hätte ein Klick auf „Season 1, Volume 1" also **Staffel 101**
gemeldet. `headerDetail.seasonNumber` sagt dagegen sauber 1 — geprüft am gewählten Band, wo es
2 sagt und die Adresse `s2` trägt.

Seit 2.8 gilt deshalb: **`seasonNumber` aus dem Hydration-Block schlägt die Adresse**, und eine
Adresszahl über 50 wird verworfen statt gemeldet. Dazu geht der **Bandname** als eigenes Feld
mit (`band: "Season 2, Volume 2"`) — ohne ihn sähen zwei Meldungen zu „Staffel 2" wie ein
Widerspruch aus, obwohl sie verschiedene Folgen meinen.

### Prime schneidet Reihen anders zu — die Folgenzahl ist deshalb kein Urteil

Am 28.08.2026 hat Daniel dieselbe Sperre dreimal gemeldet, und die ersten beiden
Fälle widerlegen einander:

| Titel | Seite | erwartet | was wirklich vorliegt |
|---|---|---|---|
| Captain Tsubasa (2018) | 91 | 52 | Prime **bündelt** beide Staffeln unter einer Seite |
| Chibi Maruko-chan | 52 | 142 | Prime **teilt**, wo unser Bestand eine Reihe führt |
| Blood-C: The Last Dark | Film | 1 | ein Film, den die Erkennung nicht als solchen sah |

Der Knopf sagte zweimal „andere Staffel wählen" — und beide Male gab es keine
Staffel zu wählen, die die erwartete Zahl zeigt. Ein Vergleich mit der erwarteten
Folgenzahl beantwortet also **keine** Frage, die auf dieser Seite entscheidbar
wäre: Prime schneidet die Welt anders zu als AniList, mal zusammen, mal
auseinander, und beides ist der Normalfall.

**Der Riegel hielt genau die Daten zurück, die den Fall auflösen.** Seit 3.77
trägt jede Meldung ihre Folgen einzeln mit Nummer, Titel, Datum und Laufzeit;
`pipeline/fetch-rohfolgen.ts` legt sie über TMDBs Folgentitel und
Erstausstrahlungsdaten auf unsere Zählung. Die Zuordnung passiert dort, wo die
Anker liegen — nicht im Browser, wo keiner liegt.

Seit 3.78 gilt deshalb: **Die Zahl erzeugt einen Hinweis, keine Sperre.** Bei
Bündelung stehen **beide** Fenster als Knopf bereit (vorderes und hinteres), denn
welcher Teil gemeint ist, weiß nur der Auftrag: Bei „Captain Tsubasa (2018)" sind
es die ersten 52, beim „Junior Youth Arc" die letzten 39 — dieselbe Seite, zwei
richtige Antworten. Die echten Riegel bleiben: `falscheStaffel` vergleicht die
Staffel im Titel mit der offenen, `quelltextPasst()` fängt den Titelwechsel.
Beides prüft die Sache, nicht ein Zahlenverhältnis.

**Und „1 Folge laut Seite" schließt einen Film nicht aus — es beschreibt ihn.**
`istFilmSeite()` verlangte `!lage.folgenLautSeite`, also gar keine Zahl.
„Blood-C: The Last Dark" nennt eine, galt damit als Serie, und der Knopf wartete
42 Sekunden auf eine Folgenliste, die es nicht gibt. Entscheidend sind die beiden
anderen Merkmale: **kein Folgen-Reiter** und **eine Laufzeit im Kopf**.

**Warum es durch 236 grüne Zusicherungen kam:** keine einzige prüfte die
Folgenzahl gegen die Erwartung. `extension/amazon-folgenzahl.test.cjs` tut es
jetzt und führt `istFilmSeite()` dabei wirklich aus, mit den Werten wörtlich aus
Daniels Bericht.

### Ein Film braucht den Mitleser nicht — die Tonspuren stehen im DOM

Am 28.08.2026 blieben zwei Filme dauerhaft hängen: „Blood-C: The Last Dark" auf
„Tonspuren nicht gefunden — Seite neu laden", „Have A Nice Day" auf „Folgen
werden geladen …". Neu laden half nicht, und das war der Hinweis: Der Quelltext
war nie das Problem.

**Zwei Ursachen, beide gemessen.** Die erste steht im Ablauf: Der Film-Zweig in
`zeichnen()` verlangte `quelltextVeraltet()`, die beiden folgenden Zweige waren
durch `!istFilmSeite()` gesperrt. Für einen Film mit **frischem** Quelltext gab
es damit gar keinen Zweig — der Ablauf fiel bis zum Warte-Zweig durch und blieb
dort stehen.

Die zweite steht in den Daten. Anonym von amazon.de geholt (die Seiten sind ohne
Anmeldung lesbar):

| Titel | Adresse | pageTitleId | audioTracks |
|---|---|---|---|
| Blood-C: The Last Dark | B0GQJFL1XG | **B0GQJ8WYJD** | Deutsch, 日本語 |
| Have A Nice Day | B0FYSH898T | **B0FWK8XMDJ** | Deutsch |
| Avatar Aang (geht) | B0H6QYBZFS | B0H6QYBZFS | Deutsch, English |

Der Block ist vollständig, `entityType` sagt „Movie", die Tonspuren stehen im
Klartext — und trotzdem kam am Knopf nichts an. Der Zählstand im Bericht zeigt
warum: **`gesamt: 1` bei `fuerAdresse: null`**. Diese Eins stammt aus dem
Seitengerüst (die Stelle, die sie setzt, solange keine Antwort da ist), nicht vom
Mitleser. Der hat für diese Seiten nie geliefert.

**Statt die Nachrichtenkette zu reparieren, entfällt sie für Filme.** Mitleser
und Erweiterung teilen sich das DOM; das `<script>` mit dem Block ist für beide
dasselbe Element. Bei einem Film ist ohnehin nichts nachzuladen — keine
Abschnitte, keine Folgenliste, ein einziger Satz Tonspuren. Der Umweg über eine
Nachricht hat dort nie etwas hinzugefügt, nur eine Fehlerquelle. `filmAusSeite()`
liest den Block direkt, einmal je Adresse zwischengespeichert (er ist 145 bis
204 KB groß — ihn je Takt zu parsen wäre genau die Arbeit, die am selben Tag
schon einmal die Seite lahmgelegt hat).

**Überholt am 15.09.2026 (Umbau Phase 2):** Seit dem Leser-Umbau schickt `amazon-leser.js`
einen Film zuverlässig als eine Folge samt `seite` im Schnappschuss; der Handschlag
`ak-amazon-anfrage` behebt das Problem, an dem die Nachricht damals scheiterte.
`filmAusSeite()` parst den Block deshalb nicht mehr selbst, sondern liest `gesehen.seite`. Den
Rückfall für ein leeres `headerDetail` hat der Leser übernommen (Zusicherung in
`amazon-film.test.cjs`, ohne ihn rot).

**Die abweichende `pageTitleId` ist dabei kein Titelwechsel.** Prime führt einen
Film regelmäßig unter einer anderen Kennung als die Adresse — dasselbe Bild wie
bei Digimon Tamers weiter oben. Die Adress-Kennung kommt im Quelltext trotzdem
vor (11×), der Zugehörigkeits-Wächter greift also zu Recht nicht.

### Ein geschluckter Fehler sieht aus wie ein langsamer Rechner

Am 28.08.2026 meldete Daniel: „die extension friert den pc ein … download von
diagnose dauert jetzt schon 3min … warum zerstört die extension meine
performance". In der Fehlerliste der Erweiterung stand:

    Uncaught (in promise) ReferenceError:
    Cannot access 'knopf' before initialization    amazon.js (zeigeAuftragshinweis)

`const knopf = document.createElement('button')` steht rund 950 Zeilen **unter**
dem Zugriff. `const` hebt den Namen hoch, aber nicht den Wert — **derselbe
Fehler wie bei `listenId` am 25.08.2026**, nur an anderer Stelle.

**Warum daraus ein eingefrorener Rechner wird, und keine Fehlermeldung:** Der
Wurf passiert in einem `await`-Zweig. Er wird zur abgelehnten Zusage, niemand
fängt sie, der Ablauf bricht still ab — und der Takt versucht es 500 Millisekunden
später wieder. Chrome hält zu jeder abgelehnten Zusage einen Stapelauszug fest.
Sichtbar ist davon nichts außer der Trägheit.

**Zwei Prüfungen fangen es künftig, und beide fehlten aus verschiedenen Gründen:**

1. `tools/amazon-startseite-pruefen.cjs` gibt es seit dem 25.08.2026 genau für
   diese Fehlerklasse — sie **lief nur in keiner Kette**. Jetzt hängt sie in
   `check:extension`. Und ihr Sandkasten war unvollständig: Er brach mit
   „URLSearchParams is not defined" ab, also an seiner eigenen Umgebung, und
   verdeckte damit den Fehler, den er finden sollte.
2. Eine statische Zusicherung sucht Zugriffe vor der Deklaration
   (`amazon-folgenzahl.test.cjs`). Sie kennt Funktionsparameter gleichen Namens
   und lässt Zugriffe in einem `try` durch. Die Gegenprobe hält: Vor dem Fix
   meldete sie genau die Zeile.

**Die Lehre über dem Einzelfall:** Ein Vorsatz hat diesen Fehler zweimal nicht
verhindert. Beim zweiten Mal ist nicht der Fehler das Problem, sondern dass die
Prüfung, die es gekonnt hätte, nirgends aufgerufen wurde.

### Beim Styling der Erweiterung wird hingesehen, nicht gerechnet

Am 02.09.2026 sind drei Fassungen der Fußzeile hintereinander falsch
ausgeliefert worden — jede aus einer Vermutung über das CSS, jede von Daniel
mit einem Bild widerlegt. Beim dritten Mal seine Vorgabe: „prüf das styling
selbst mit playwright und screenshots.“

Der Fehler war am Ende eine **Doppelung, die ich selbst hinterlassen hatte**:
`.ak-such-fuss-links { display: none }` stand über einer älteren Regel
`.ak-such-fuss-links { display: flex }`. Bei gleicher Spezifität gewinnt die
spätere — der leere Platz belegte damit die erste Grid-Spalte, der
Prüflisten-Knopf rutschte nach rechts und aniSearch in die zweite Zeile. Aus
dem Quelltext gelesen sah beides richtig aus; ein einziger Screenshot hätte es
in der ersten Runde gezeigt.

```
npm run check:kasten
```

`tools/melder-kasten-bild.mjs` stellt den Kasten mit dem **echten**
`melder.css` in Chromium nach, misst die Lage der Elemente und schreibt
`docs/melder-kasten.png`. Es braucht weder Amazon noch Daniels Sitzung: Ob zwei
Knöpfe nebeneinander stehen, entscheidet allein das Stylesheet.

**Die Struktur darin stammt aus dem Code und veraltet ohne Pflege.** Deshalb
hält das Werkzeug die Klassennamen gegen `amazon.js` und bricht ab, wenn eine
fehlt — ein Bild von einer Struktur, die es nicht mehr gibt, ist schlimmer als
keines: Es sieht richtig aus und misst etwas anderes.

**Die Kulisse trägt Amazons Regeln mit — sonst misst sie den eigenen Stil, nicht
das Ergebnis.** Der erste Lauf meldete einen sauber zentrierten aniSearch-Knopf,
während sein Text auf der echten Seite linksbündig klebte (Daniel, mit Bild):
Amazon setzt für `a` unter anderem `display: inline` und `text-align: left`, mit
höherer Spezifität als eine Klassenregel — und wo unser `display: flex`
verliert, wirkt `justify-content` gar nicht mehr. Seitdem stellt das Werkzeug
diese Regeln nach, und die Zusicherung misst den **Textknoten** statt des
Rahmens: Ohne Fix meldet sie „links 11, rechts 89“, mit Fix 50/50.

Daraus die allgemeine Form: **Ein Stil, der in einer fremden Seite leben muss,
wird gegen deren Regeln geprüft, nicht im luftleeren Raum.** Was nur in der
eigenen Kulisse funktioniert, ist nicht geprüft, sondern nur vorgeführt.

Was es **nicht** ersetzt: alles, was an echten Seitendaten hängt —
Folgenzählung, Tonspuren, Briefkasten. Dafür bleibt Daniels Sitzung die
einzige Messstelle.

### Ein Zwischenspeicher, dessen Schlüssel sich ständig ändert, ist keiner

Im selben Zug gefunden, bevor es jemandem auffiel: `filmAusSeite()` (3.82) nahm
`location.pathname + location.search` als Schlüssel. **Prime schreibt den
`ref_`-Parameter laufend um** — die Adresse ist bei jedem Takt eine andere, der
Zwischenspeicher greift nie, und 145 bis 440 KB JSON werden alle 500 ms geparst.

Drei Riegel stehen jetzt davor, und jeder einzelne wäre allein zu wenig:

- Der **Pfad** ist der Schlüssel, nicht die Adresse — der Verweis-Parameter sagt
  nichts über den Inhalt.
- **Seiten mit Folgen-Reiter fassen den Block gar nicht an.** Sie sind keine
  Filmseiten, und sie sind die teuersten (Pokémon mit 57 Staffeln).
- **Höchstens einmal je fünf Sekunden**, komme was wolle. Ein Riegel, der von
  einer Annahme über fremde Adressen abhängt, braucht einen zweiten ohne
  Annahmen.

**Und derselbe Fehlgriff ist am 02.09.2026 ein zweites Mal passiert, mit dieser
Lehre im Repo.** `kastenSkelett()` (4.11.0) nahm `location.pathname +
location.search` als Kennzeichen dafür, zu welcher Seite der Hinweiskasten
gehört — wortwörtlich der Ausdruck aus dem Absatz darüber. Der Vergleich
schlug bei jedem Takt fehl, der Kasten wurde zweimal je Sekunde verworfen und
neu gebaut, und mit ihm verschwanden die Knöpfe darin. Daniel sah eine
Erweiterung, die fast nichts mehr anzeigte.

**Warum die geschriebene Lehre nicht getragen hat:** Der Ausdruck stand schon
vorher im Code, und dort war er harmlos — die alte Fassung baute den Kasten
ohnehin bei jedem Takt neu und brauchte den Schlüssel gar nicht. Beim Umbau
wurde er übernommen, nicht neu gewählt. **Ein Ausdruck wechselt seine
Bedeutung, wenn der Code um ihn herum eine andere Frage stellt**, und beim
Kopieren prüft man ihn deshalb wie eine neue Zeile.

Der Griff dagegen ist billig: **Vor jedem Vergleich zweier Adressen die Frage,
welche Teile davon der Betreiber verändert, während niemand navigiert.** Bei
Prime sind das `ref_`, `qid`, `sr` und `pageTypeId`. Gebraucht wird fast nie
mehr als der Pfad; hier kam der Suchbegriff `k` dazu, weil jede Prime-Suche
unter `/s` liegt.

**Offen und ungemessen:** Der Mitleser stempelt seine Antworten weiterhin mit
`location.pathname + location.search` (`gesehen.fuerAdresse`, fünf Stellen in
`amazon.js`). Nach demselben Befund müsste das ebenso brechen — es tut es
sichtbar nicht, und warum, ist nicht gemessen. Wer dort etwas ändert, misst es
zuerst.

### Der Briefkasten ist die einzige Quelle für „schon gemeldet"

Bis 3.81 führte die Erweiterung zwei eigene Speicher: `amazonErledigt` für
Titelseiten, `amazonSuche` für Suchadressen. Am 28.08.2026 hat das zweimal
gekostet:

- Ein Werkzeug zum gezielten Zurücksetzen räumte nur den ersten, meldete Erfolg —
  und in der Liste änderte sich nichts, weil die über den zweiten filtert
  (Daniel: „der command sagt in console die sind wieder offen aber sind sie
  nicht").
- Was auf einem Rechner abgehakt war, war es auf keinem anderen.

Daniels Vorgabe: „gemeldet/nicht gemeldet sollte ebenfalls synchron remote
abgeglichen werden, kein lokales zurücksetzen only, kein localstorage dafür …
single source of truth."

Der Briefkasten weiß es ohnehin — jede Meldung landet dort, und
`?zaehlen=1` gibt die Adressen zurück, die noch nicht übernommen sind. Genau
diesen Weg geht `disney.js` seit dem 26.08.2026; `amazon.js` hatte ihn nur nie
übernommen.

**Der lokale Speicher bleibt, aber nur als Überbrückung.** Zwischen dem Klick auf
„melden" und der nächsten Antwort liegen Sekunden; ohne ihn stünde der Titel
solange wieder als offen da. Gelesen wird er nur, **solange der Briefkasten
schweigt** — sobald dessen Liste da ist, entscheidet sie, und zwar in beide
Richtungen: Was dort nicht mehr steht, ist offen, auch wenn es lokal abgehakt
ist. Ein Netzfehler blendet nichts aus; lieber ein Titel zu viel in der Liste
als einer, den niemand mehr sieht.

### In die Prüfliste kommen Werke, keine Staffeln

Daniel am 28.08.2026: „mach das die prüfliste generell nur hauptserien, filme und
specials prüft, weil sowas wie bungo stray dogs 2, staffel 2 ist … zuordnung
kannst du getrennt von prüfliste machen, ist viel einfacher und unkomplizierter."

Der Anlass war ein Auftrag „Bungo Stray Dogs 2". Die Suche führt zur
**Serienseite**, und die zeigt Staffel 1 — Staffel 2 ließ sich von dort nicht
melden, und beim Wechsel stand am Knopf weiter „Staffel 1 melden", obwohl die
längst gemeldet war. Kein Fehler der Erweiterung: ein Auftrag, der eine
Unterscheidung verlangt, die auf dieser Seite nicht zu treffen ist.

**Aussortiert wird über zwei Signale zusammen**, und beide werden gebraucht:

| Signal | allein zu grob |
|---|---|
| gleiche `franchiseId` | „Digimon Frontier" fiel heraus — eigene Reihe, eigene Prime-Seite |
| Staffelnummer im Namen | „Digimon Adventure 02" und „Mob Psycho 100" tragen auch Ziffern |

Zusammen sind sie eindeutig: dasselbe Werk laut Datensatz **und** ein Name, der
sich selbst als Fortsetzung ausweist. Filme, Specials, OVAs und ONAs sind
ausgenommen — sie haben eigene Seiten und eigene Tonspuren. Gemessen fallen
damit sechs Fortsetzungen heraus; „Bungo Stray Dogs" bleibt, „Bungo Stray Dogs 2"
und „3" gehen, die OVA „Der Einzelgänger" bleibt.

Welche Folge zu welcher Staffel gehört, entscheidet danach der Bau über TMDBs
Folgentitel (`pipeline/fetch-rohfolgen.ts`) — sammeln und zuordnen sind zwei
Arbeiten, und nur die erste passiert im Browser.

### Ein Datenfeld schlägt ein Textmuster — auch beim eigenen Fix

„5 Centimeters per Second" zeigte am 28.08.2026 erst „1 Film melden" und eine
Sekunde später „1 von 3 — Abschnitte selbst öffnen", dann hing es. Der Knopf war
also zuerst richtig.

Anonym nachgemessen nennt der Hydration-Block `entityType: Movie`, vier
Tonspuren, eine Laufzeit — und **kein** `episodeCount`, keine Staffeln. Im
Quelltext steht nirgends „3 Folgen". Die Zahl entsteht erst im **gerenderten**
Text: Der Beschreibungstext spricht von „drei miteinander verbundenen
Kurzfilmen", daneben laufen Empfehlungsleisten. `seitenLage()` liest
`body.innerText` — und was dort nachträglich erscheint, kippte die Erkennung.

Seit 3.82 fragt `istFilmSeite()` deshalb zuerst den Block. Sagt der „Movie" und
nennt Tonspuren, ist es ein Film; der Textweg bleibt Rückfall für Seiten ohne
brauchbaren Block. Dieselbe Messung entlastet auch „Code Geass: Akito the Exiled 5
— OVA": Trotz „OVA" im Namen steht dort `entityType: Movie` mit deutscher
Tonspur — die Vermutung, das Format sei schuld, ist widerlegt.

### Eine Abweichung ist kein Ereignis — daran hing der Staffelwechsel fest

Fünfter Anlauf an demselben Symptom, und diesmal aus einer Messung statt aus
einer Vermutung. Daniels Bericht vom 28.08.2026 (Digimon Adventure, Staffel 2)
trug ein Tagebuch mit siebzehn Einträgen:

    13:57:01  staffelwechsel      ?|1|B0CHHNJJW3  ->  2|1|B0CGXX7FNC
    13:57:05  stand-gekappt       gesamt 50, gelesen 72, weg: 55…78
    13:57:13  wartet-auf-staffel  wartetSeitMs 8010, gesamt 50, gelesen 48
    13:57:25  Bericht             wartetSeitMs 20262, Knopf „Staffel wechselt“

**Was nicht schuld war:** Die Kappungsregel hat sauber gearbeitet — die
durchlaufenden Nummern 55 bis 78 sind weg, 48 von 50 bleiben stehen. Der
naheliegende Verdacht (sie leere den Stand bei jedem Takt) ist damit widerlegt.

**Zwei Regeln hoben einander auf.** `gesamtGeaendertAm` wurde bei jedem Takt
erneuert, weil der Quelltext 54 Folgen nennt und der Zählstand 50. Nach einem
Staffelwechsel ist der Quelltext der der **alten** Staffel (siehe oben) — die
Abweichung ist damit ein Dauerzustand, kein Ereignis. `zahlenStehen` konnte nie
wahr werden; und weil es in der Signatur von `zeichnen()` steht, stieg die
Funktion bei jedem Takt vorzeitig aus. Die Freigabe nach zwölf Sekunden stand
hinter diesem Ausstieg und wurde nie erreicht.

Der Fix ist zweiteilig, und der zweite Teil ist die eigentliche Lehre:

1. Ein Merker (`letzteQuelltextGesamt`) unterscheidet **Abweichung** von
   **Änderung**. Erst wenn der Quelltext eine andere Zahl nennt als beim letzten
   Mal, ist etwas passiert.
2. Die Freigabe steht jetzt selbst in der Signatur (`freigabeReif`).

**Punkt 2 stand als Lehre schon im Code — für die andere Regel.** Der Kommentar
über `zahlenStehen` sagt seit dem 24.08.2026: „Eine Anzeige, die von der Zeit
abhängt, braucht die Zeit in ihrer Signatur." Genau daneben wurde vier Tage
später eine zweite zeitabhängige Regel eingebaut — ohne sie. Eine Regel, die nur
greift, während sich etwas bewegt, greift nie bei Stillstand; und für den ist sie
gedacht.

### Ein Reihenname mitten im Titel trennt, was zusammengehört

„Arpeggio of Blue Steel - Cadenza" ergibt bei Prime genau eine Karte, und die
heißt „Arpeggio of Blue Steel — **Ars Nova** — Cadenza" (Daniel, 28.08.2026).
Derselbe Film mit dem Reihennamen dazwischen; unser japanischer Titel führt ihn
sogar mit, nur der deutsche lässt ihn weg.

**Ein Zusatz am Rand war längst abgedeckt, einer in der Mitte nicht.**
`ohneBeiwerk` schneidet Klammern und Fassungsangaben ab, der Rückfall über
`includes` fängt Präfixe — beide arbeiten auf der Zeichenkette, und die ist an
dieser Stelle aufgetrennt. `wortFolgePasst()` vergleicht deshalb wortweise: Alle
Wörter des Auftrags müssen in der Karte vorkommen, in derselben Reihenfolge,
dazwischen darf stehen, was will.

**Drei Riegel halten das eng**, und jeder hat seinen belegten Fall:

| Riegel | sonst passierte |
|---|---|
| höchstens zwei fremde Wörter | „Sword Art Online" träfe „Alicization War of Underworld" |
| kein Fortsetzungswort (`final`, `movie`, `chapter`, …) | „Attack on Titan" träfe „Attack on Titan: Final Season" |
| **keine reine Zahl** | „Captain Tsubasa" träfe „Captain Tsubasa (1983)" |

Der letzte Riegel ist nicht ausgedacht: Die Zusicherung dazu stand schon seit
dem 27.08.2026 und wurde beim Bau dieser Regel sofort rot. 1983 hat 128 Folgen,
2018 hat 52 — eine Jahreszahl ist nie Beiwerk. `staffelImTitel()` hätte keinen
der drei Fälle gefangen, weil keiner eine nummerierte Staffel nennt.

### Abgehaktes muss einzeln zurückzuholen sein

Am 28.08.2026 brauchte Daniel zwei erledigte Einträge zurück, um eine Messung
nachliefern zu können. Der einzige vorhandene Weg war „Abhaken zurücksetzen" in
der Übersicht — der leert den **ganzen** Speicher, an dem Tag sechzig Einträge.
Zwei zurückholen hätte achtundfünfzig Wiederholungen gekostet.

    document.dispatchEvent(new CustomEvent('ak-oeffnen', { detail: 'digimon' }))

Verglichen wird gegen Titel und Serienname. Der Weg über ein Ereignis am
`document` ist derselbe wie beim Diagnosebericht, und aus demselben Grund: Der
Speicher liegt in `chrome.storage`, an das die Seiten-Konsole nicht herankommt.

**Die allgemeine Lehre:** Eine Sammelaktion ersetzt keine einzelne. Wo etwas
abgehakt, ausgeblendet oder erledigt werden kann, muss dasselbe einzeln
rückgängig zu machen sein — sonst steht am Ende die Wahl zwischen „gar nicht"
und „alles noch einmal".

### Prime zählt Teile, wo unser Bestand keinen Teil kennt

„Code Geass: Akito the Exiled — The Wyvern Arrives": Die Karte auf Platz 1 der
Trefferliste war der richtige Titel, der Kasten sagte „2 Treffer gelesen, keiner
passt" (Daniel, 28.08.2026).

    Auftrag  codegeassakitotheexiled thewyvernarrives
    Karte    codegeassakitotheexiled1thewyvernarrivesova

Zwei Abweichungen, beide von Prime hinzugefügt: die **Teilnummer** mitten im
Titel und das **Typ-Kürzel** am Ende. `titelKern()` streicht „Teil 1" und „Part
1", eine nackte Ziffer war nie vorgesehen — und weil sie in der Mitte steht,
greift auch der Rückfall über `includes` nicht.

`titelKernLocker()` ist deshalb eine **zusätzliche** Schreibweise, kein Ersatz:
Verglichen wird weiterhin zuerst streng, Typ- und Staffelprüfung gelten
unverändert. Beide Regeln sind eng gefasst, und das muss so bleiben — die Ziffer
fällt nur **einstellig** und nur als eigenes Wort („Mob Psycho 100" behält seine
Zahl, „Golden Kamuy 2" auch, wo sie die Staffel ist), das Kürzel nur **am Ende**
(mittendrin trennt es Ausgaben, siehe „Wolf's Rain OVA" gegen die Serie). Alle
drei Gegenproben stehen als Zusicherung.

### Ein Durchlauf braucht einen sichtbaren Notausgang — und zwei Riegel, nicht einen

Der erste Durchlauf über One Piece hat am 26.08.2026 fremde Serien geöffnet: Heroes, Lucifer,
Ozark. **42 falsche Meldungen** gingen an den Worker, alle unter der Adresse von One Piece.
Daniel: „es öffnen sich andere serien als one piece (keine anime, ganz andere serien)."

Die Ursache war eine zu breite Suche. Nachdem der feste Pfad `data.videos.episodes.edges`
nicht griff, nahm die neue Fassung **jeden** Knoten mit einer Nummer und einer Kennung über
einer Million — und die hat jeder Netflix-Titel. Damit fielen die Empfehlungsleisten und
„Weiter ansehen" mit hinein.

**Der eigentliche Fehler war aber der fehlende Notausgang.** Daniels nächste Nachricht:
„welchen knopf soll ich sofort anklicken? ich schließe mal den tab." Der Abbrechen-Knopf saß
nur auf der Titelseite — und ein Durchlauf ist die meiste Zeit im Player. Es gab keinen Weg,
ihn anzuhalten.

Daraus drei Regeln für alles, was in Serie läuft:

1. **Der Abbruch ist sichtbar, wo die Arbeit stattfindet.** Der Knopf bleibt jetzt während des
   Durchlaufs stehen, auch im Player, und die Escape-Taste bricht ebenfalls ab — ein Knopf kann
   von fremder Oberfläche verdeckt werden, eine Taste nicht.
2. **Ein Riegel genügt nicht.** Die Typ-Prüfung im Leser (`__typename` muss „Episode" nennen)
   ist der erste. Der zweite sitzt vor jeder Meldung: Der Player nennt die Reihe der laufenden
   Folge; weicht sie von der Seite ab, wird übersprungen und nichts gemeldet.
3. **Und was falsch ankam, wird sofort verworfen**, bevor der nächste Lauf es übernimmt:

   ```
   curl -s "https://newsletter.animekalender.workers.dev/pruefung?token=<LAUF_TOKEN>"
   curl -X POST …/pruefung -H "X-Lauf-Token: <TOKEN>" -d '{"uebernommen":[<ids>]}'
   ```

   Abhaken ohne Übernahme ist der richtige Griff: Die Meldung verschwindet aus dem Briefkasten,
   ohne den Datensatz zu berühren.

**Was das über die Reihenfolge sagt:** Ein Durchlauf über tausend Folgen wird nicht an tausend
Folgen erprobt, sondern an fünf. Der Knopf hätte eine Obergrenze gebraucht, bevor er das erste
Mal lief — dieselbe Lehre wie bei der Amazon-Erweiterung, nur teurer, weil hier Meldungen
entstanden statt nur falscher Zahlen.

**Und eine Sekunde ESLint fängt, was 236 Zusicherungen nicht sehen.** Beim Umbau des Dialogs
auf Bereiche fiel die Variable `empfohlen` weg; eine spätere Zeile nutzte sie weiter. Der
Dialog ließ sich danach nicht mehr öffnen (Daniel, 26.08.2026: „anime kalender click not
working and i see an error"), und **keine einzige Prüfung hat es bemerkt** — sie prüfen die
Daten, nicht das DOM.

Ein Sandkasten für den ganzen Dialog wäre der gründliche Weg und kostet einen Tag.
`extension/eslint.config.mjs` prüft stattdessen nur `no-undef` — kein Stil, keine Meinung — und
hängt seit dem 26.08.2026 in `check:extension`. Was dort rot wird, ist ein Absturz im Browser.

**Und seit dem 07.09.2026 wird jedes Content-Skript einmal geladen**
(`tools/extension-laden-pruefen.cjs`, erster Schritt von `check:extension`). Das
fängt die andere teure Klasse: ein Zugriff auf ein `let` oder `const` **vor**
seiner Deklaration. Dreimal in vier Wochen passiert — `listenId` (25.08.),
`knopf` (28.08.), `wiedervorlageBeantwortet` (01.09.) —, jedes Mal still, und
einmal sah es aus wie ein Leistungsproblem („die extension friert den pc ein").

Geladen werden alle sieben Skripte, die das Manifest in eine Seite legt,
einschließlich `ruhig.js` und der drei Leser. Ein Skript, das nicht lädt, macht
jede spätere Prüfung sinnlos — deshalb steht es vorn.

Dieselbe Klasse Fehler ist mir an diesem Tag **dreimal** unterlaufen: `empfohlen` im Dialog,
`location` im Test-Sandkasten, `MARKE_FOLGEN` im ausgeschnittenen Block. Alle drei hätte diese
Prüfung genannt.

## Ein Test über den Quelltext fängt keinen doppelt vergebenen Namen

Am 31.08.2026 fragte Daniel: „wie melde ich die bis 155? es gibt kein bestätigen
oder so button?" Der Knopf wurde gebaut, drei Zusicherungen hielten ihn fest
(„er legt den Melde-Knopf an", „beide werden sichtbar geschaltet", „der Knopf
hängt am Feld"), und alle drei waren grün.

Er ist trotzdem nie erschienen. Beide Knöpfe hießen `DURCHLAUF.grenzKnopf`:

```js
DURCHLAUF.grenzKnopf = document.createElement('button')   // der Umschalter, in der Leiste
…
if (!DURCHLAUF.grenzKnopf?.isConnected) {                  // der „✓ melden" am Grenzfeld
  DURCHLAUF.grenzKnopf = document.createElement('button')
```

Der Umschalter entsteht beim Aufbau der Leiste und ist danach **verbunden** —
die Bedingung traf nie zu. Aufgefallen ist es erst am 10.09.2026 beim Einbau
eines dritten Knopfs daneben.

**Warum die Zusicherungen es nicht fangen konnten:** Sie prüfen den Quelltext,
und dort stand alles richtig. Ein doppelt vergebener Name ist im Quelltext
**korrekt** — falsch wird er erst zur Laufzeit, wenn die zweite Zuweisung die
erste überschreibt oder gar nicht erst läuft.

**Die Prüfung, die es fängt, fragt nach der Menge:**

```js
const namen = [...quelle.matchAll(/DURCHLAUF\.(\w+) = document\.createElement\(/g)].map((m) => m[1])
pruefe('kein Feld trägt zwei verschiedene Elemente', namen.length === new Set(namen).size)
```

**Die allgemeine Form:** Wo ein Objekt als Ablage für Elemente dient, ist jeder
Feldname eine Kennung — und Kennungen werden auf Eindeutigkeit geprüft, nicht
auf Vorhandensein. Dasselbe gilt für CSS-Klassen, die an zwei Stellen vergeben
werden, und für Speicherschlüssel.

## Eine Diagnose, die in der Konsole endet, ist keine

Die Erweiterung schrieb seit Monaten Befunde in die Browserkonsole: „keine
Tonspur gelesen", „Folge gehört zu fremder Reihe", „N Meldungen kamen nicht an",
„Durchlauf abgebrochen bei M7111". Am 10.09.2026 schickte Daniel ein
Bildschirmfoto aus Chromes Fehler-Panel — so ist einer davon zum ersten Mal
angekommen, nach Wochen.

Sein Urteil traf die ganze Klasse: „info bringt nix, du liest nix aus der
console aus, ich lese auch nix aus. denk darüber nach auch bezüglich **allen
anderen derartigen logs**, du musst informiert werden über issues."

**Mein erster Griff war der falsche.** Ich hatte `console.warn` zu
`console.info` gemacht, damit es nicht mehr im Fehler-Panel landet — also die
Anzeige repariert und die Auskunft dabei noch leiser gemacht. Eine Sackgasse
bleibt eine, auch wenn sie ordentlich beschildert ist.

**Die Prüffrage vor jeder Diagnosezeile:**

> **Wer liest das, und wann?** Gibt es darauf keine Antwort mit einem Namen und
> einem Zeitpunkt, ist die Zeile Selbstgespräch. Dann gehört die Information
> dorthin, wo sie ohnehin gelesen wird — oder sie wird nicht erhoben.

In diesem Projekt heißt das: **an den Worker melden.** Der Weg lag seit Monaten
vor (Meldungen, Netzfunde, Laufstatus gehen ihn alle), er wurde für Diagnosen
nur nie benutzt. Seit 4.17.11 melden alle drei Melder ihre Vorfälle an
`/vorfall`, und `pipeline/fetch-vorfaelle.ts` legt sie unter
`daniel-zum-abarbeiten/17-vorfaelle.md` ab — dort, wo der nächste Durchgang sie
ohnehin liest.

**Drei Riegel halten den Melder harmlos**, und sie gehören zu jedem solchen
Kanal: dieselbe Art je Seite einmal pro Sitzung, eine Obergrenze, und jeder
Fehler beim Melden bleibt stumm. Ein Fahrtenschreiber, der die Fahrt stört, ist
keiner.

**Und ein Vorfall ist nicht automatisch ein Fehler.** „Keine Tonspur gelesen"
ist ein vorgesehener Fall — interessant wird er durch seine **Häufigkeit**, und
genau die war unsichtbar, solange jede Zeile einzeln in der Konsole verhallte.

## Eine Überbrückung gehört nicht in den Speicher, den sie überbrückt

Der Briefkasten antwortet mit Verzögerung, deshalb trägt die Erweiterung ihre
eigene Meldung sofort nach. Dreimal gebaut, dreimal derselbe Griff:

```js
briefkastenAdressen.add(eintrag.url)      // 30.08.2026 — hält
briefkastenSeiten.add(String(hier))       // 09.09.2026 — hält nicht
```

Der Unterschied liegt nicht im Code, sondern im Abruf danach:
`briefkastenHolen()` **ersetzt** diese Mengen (`= new Set(daten.…)`). Ein
Nachtrag lebt also nur bis zum nächsten Abruf — und der kommt hier sofort, denn
der Melde-Handler stößt ihn selbst an (`void briefkastenHolen(true)`). Zu diesem
Zeitpunkt führt der Worker die Meldung noch nicht.

Daniel am 10.09.2026: „nach meldung muss checklisten eintrag den haken bekommen
statt dem kreis", und einen Prompt später die Beobachtung, die es entscheidet:
„der haken kommt nach navigation zum 2. eintrag, also wird es ein ui update sein
was fehlt." Genau so war es — der Nachtrag war weg, bevor ihn jemand sehen
konnte.

**Der Griff, der trägt:** Ein **eigener** Merker neben der ersetzten Menge.

> Prüffrage vor jeder Überbrückung: **Wer schreibt diese Datenstruktur sonst
> noch — und ersetzt er sie oder ergänzt er sie?** Wer ersetzt, löscht die
> Überbrückung mit.

**Und die Überbrückung bleibt bei der Anzeige.** Ob ein Verweis wirklich
abgehakt ist, entscheidet weiterhin der Briefkasten allein: Eine Meldung, die
nicht ankommt, darf nicht als erledigt gelten. Der lokale Merker sagt „das habe
ich gerade abgeschickt", nicht „das ist erledigt" — eine Zusicherung in
`amazon-erwartung-reist.test.cjs` hält fest, dass `seiteOffen()` ihn nicht liest.

## Ein Rückfall, den niemand befüllt, ist kein Rückfall

Am 09.09.2026 fehlte die Checkliste auf einer frisch geladenen Titelseite, weil
`briefkastenErwartungen` beim ersten Zeichnen noch leer ist. Der Fix las
zusätzlich den Auftrag aus dem `sessionStorage`:

```js
const erwartet = erwartungZu(suchUrlHier) ?? (Array.isArray(a?.erwartet) ? a.erwartet : [])
```

Am 10.09.2026 fehlte sie wieder — „auf suchseite auswahl bestätigt, auf #1 und
#3 fehlen die checklisten" (Plus-Sized Elf, zwei Ausgaben). Der Rückfall war
gebaut und griff nie: **Keine der vier Stellen, die den Auftrag schreiben, legte
`erwartet` hinein.** Der Auftrag stammt aus `AK_OFFENE_AMAZON`, und die
Prüfliste kennt keine Erwartung — das steht am Auswahlkasten sogar wörtlich, drei
Zeilen über der Klickstelle, deren Kommentar behauptete, die Erwartung reise mit.

**Die Prüffrage nach jedem neuen Rückfall — und sie ist eine andere als die
nach einer neuen Quelle:**

> **Wer schreibt das, was ich hier lese, und tut er es heute schon?** Ein
> `?? ausDemSpeicher` sieht fertig aus, auch wenn der Speicher an dieser Stelle
> immer leer ist. Ein Rückfall, der nie greift, fällt nicht auf: Er sieht aus
> wie eine Vorsichtsmaßnahme, die bisher nicht gebraucht wurde.

**Und ergänzt wird an der Stelle, durch die jeder Weg geht**, nicht an den vier
Klickstellen. `suchauftragMerken()` hebt zwei Zeilen darüber schon das
Weglegen auf, mit genau dieser Begründung: „Ein Vorsatz an den Klickstellen wäre
bei der dritten vergessen." Er war bei allen vieren vergessen.

## Wer einen Fehlalarm abstellt, muss sagen, was der Wächter noch fangen soll

Am 09.09.2026 stand auf frisch geladenen Seiten mit **einer** Staffel die
Warnung „Staffel gewechselt". Ursache: `quelltextVeraltet()` verglich Titel und
Kennung, und bei Sammelseiten (Digimon Tamers, Death Note Relight) weicht die
`titleID` legitim von der Adress-Kennung ab. Der Fix war eine Zeile:

```js
if (kennungImQuelltextBekannt()) return false   // steht die Adress-Kennung im Quelltext?
```

Am 10.09.2026 meldete Daniel eine Bildschirmaufnahme: Nach dem Wechsel auf
Staffel 2 stand der Melde-Knopf **vier Sekunden** scharf, während die Kopfzeile
noch die alte Kennung nannte. Dieselbe Zeile war die Ursache — **beim
Staffelwechsel steht die neue Kennung immer im alten Quelltext**, nämlich im
Staffelwähler. Der Freibrief gegen den Fehlalarm deckte genau den Alarm zu, für
den es den Wächter gibt.

**Die allgemeine Form:** Ein Wächter schlägt in zwei Lagen an, einer echten und
einer falschen. Wer die falsche abstellt, formuliert dabei eine Bedingung — und
die trifft fast immer auch einen Teil der echten. Prüffrage vor jedem
`return false`, das einen Alarm unterdrückt:

> **Nenne die Lage, in der der Wächter weiterhin anschlagen soll — und rechne
> die neue Bedingung an ihr durch.** Kommt „schlägt nicht mehr an" heraus, ist
> der Wächter tot, nicht geheilt.

Hier hätte die Rechnung dreißig Sekunden gedauert: Der Wächter soll den
Seitenwechsel fangen. Beim Seitenwechsel steht die neue Kennung im
Staffelwähler. Also schlägt er nicht mehr an.

**Die Unterscheidung, die trägt, lag außerhalb des Quelltexts.** Eine
Sammelseite trägt eine `titleID`, die **nie** in der Adresse stand; nach einem
Staffelwechsel trägt der Quelltext die Kennung, die dort **gerade noch** stand.
Wer sich die früheren Adress-Kennungen merkt, trennt beide Fälle sauber —
gemessen an denselben Seiten, an denen zuvor beide Fassungen falsch lagen.

### Netflix leitet auf die Reihe um — und das ist meistens richtig

„Pokémon: Blauer Himmel in der Ferne!" liegt bei uns unter `81670593`; ein Klick
dort landet auf `81706101`, „Pokémon: Ultimative Reisen: Die Serie". Das sah nach
einem falschen Titel aus und war keiner: Der Titel ist **Folge 46a** und wird
international als Abschluss der 25. Staffel geführt; genau diese Teilstaffel
nennt Netflix im deutschsprachigen Raum so (nachgeschlagen 30.08.2026 bei
fernsehserien.de und PokéWiki, japanische Erstausstrahlung 23.12.2022, deutsche
Fassung 09.10.2023).

**Ein Namensvergleich kann das nicht entscheiden.** Die Namen sind verschieden,
und bei einer Folge innerhalb einer Reihe ist das der Normalfall. Dieselbe Lücke
war bei Disney+ schon aufgefallen (siehe oben, 26.08.2026), dort mit demselben
Griff gelöst: Wer aus der Prüfliste öffnet, hinterlegt, welcher Titel gemeint
war, und die Zielseite erbt ihn.

Zwei Riegel halten das eng:

- **Eine Minute, nicht fünf**, und nur bei einer *anderen* Kennung. Eine
  Weiterleitung passiert im selben Atemzug wie der Klick; was danach selbst
  angesteuert wird, ist keine.
- **Kein Durchlauf auf einer geerbten Seite.** Der Auftrag meint eine Folge, die
  Reihe hat 54 — ein Durchlauf wäre dreiundfünfzigmal Arbeit und
  dreiundfünfzig Meldungen unter einer Adresse, die eine einzige meint. Dort
  bleibt es bei der Handmeldung.

### Untertitel sind keine Tonspur — und ein Sammel-Set weiß nicht, welche es waren

Am 30.08.2026 meldete der Knopf für „Hell Mode" **„Deutsch · 12 Folgen"**. Auf
derselben Seite stand: **Wiedergabesprachen 日本語, Untertitel Deutsch.** Daniels
Gegenprobe bei ADN: den Titel gibt es dort nur mit Untertiteln.

Der Diagnosebericht zeigt den Widerspruch im Zählstand selbst:

| | |
|---|---|
| `jeFolge` (12 Folgen) | jede einzelne `["日本語"]` |
| `gesehen.sprachen` | `["日本語", "Deutsch"]` |

**Die Quelle ist ein Fund ohne Folgennummer.** Der Empfänger in `amazon.js`
trägt solche Funde nicht in `jeFolge` ein — ihre Sprachen aber ins Sammel-Set,
und der Kommentar dort sagt es ausdrücklich: „seine Sprache zählt, als Folge
zählt er nicht". Die Regel stammt aus der Zeit, als die Rückfallebene des
Mitlesers die einzige Quelle war. Heute liefert er Folgendaten, und ein
nummernloser Fund ist ein Kopf- oder Kanalwert — genau die Angabe, die bei einem
Kanal-Titel nichts belegt.

**Seit 4.0.14 entscheiden die Folgen**, wo es welche gibt; das Set bleibt nur für
Filme, die keine Folgenliste haben. Das ist dieselbe Regel, die dieses Projekt
bei Crunchyroll längst zieht — „der lauf muss jede folge individuell prüfen".

Zwei Meldungen zu Hell Mode (Staffel 1 und 2, beide `dub`) wurden aus dem
Briefkasten verworfen, ohne den Datensatz zu berühren.

**Und die allgemeine Form:** Ein Sammel-Set beantwortet die Frage „kam das
irgendwann vor?" — nicht „steht es an dieser Sache?". Wo es eine Liste je Einheit
gibt, ist sie die Antwort; das Set ist der Rückfall für den Fall, dass es keine
gibt.

### Die Adresse nennt die Staffel — die Meldung kann alt sein

Am 31.08.2026 meldeten drei Seiten hintereinander Staffel 1, obwohl Staffel 2
gewählt war: Shangri-La Frontier, Space Dandy und Sekirei (Berichte in
`docs/diagnose/`). Überall dasselbe Bild — Adresse `?ref_=atv_dp_season_select_s2`,
Auswahlfeld mit dem Staffel-2-Namen, `lage.staffelZahl: 2`, und am Knopf stand 1.

**Zwei Ursachen, und beide sind Umkehrungen einer Regel, die einmal richtig war.**

1. Seit 2.8 stand `gemeldeteStaffelNummer` **vor** der Adresse, weil Yu-Gi-Oh!
   ZEXAL zeigte, dass die Adresse Sortierschlüssel trägt (101 und 201 für die
   beiden Bände derselben Staffel). Dagegen gibt es aber schon die Grenze von
   fünfzig. Die Meldung hat dafür einen Nachteil, den die Adresse nicht hat: Sie
   entsteht beim Lesen des Seitenblocks, und **den tauscht Amazon beim Wechsel
   über das Auswahlfeld nicht aus**. Jetzt gilt: Adresse zuerst, solange ihre
   Zahl ≤ 50 ist.

2. Der Mitleser stempelte jede Antwort mit `location` **beim Senden**. Der
   Kommentar dort begründete das damit, dass `startAdresse` für den Skriptstart
   steht und nicht für den Abruf — richtig, nur ist der Sendezeitpunkt genauso
   falsch. Zwischen Abruf und Auswertung liegen Sekunden. Bei Space Dandy trug
   der Zählstand deshalb 26 Folgen aus Staffel 1 **unter der Adresse von Staffel
   2**, und der Empfänger sah keinen Grund zu leeren. Gestempelt wird jetzt beim
   **Abrufbeginn**.

**Die allgemeine Form:** Ein Zeitstempel oder eine Kennung sagt nur dann etwas
aus, wenn sie zu dem Zeitpunkt genommen wird, den sie beschreiben soll. „Jetzt"
ist beim Senden ein anderes Jetzt als beim Abrufen.

### Eine Kulisse, die ein Feld von Hand setzt, prüft an der Stelle vorbei, die es löscht

Am 10.09.2026 sollte der Netflix-Knopf bei Haikyu!! „▶ Episode 26 prüfen"
zeigen. Der Fix las die Staffel aus der Folgenliste (`f.staffel`), die
Zusicherung baute diese Liste mit `staffel: 1` und war grün. Am 11.09.2026 stand
auf Daniels Bildschirm trotzdem „nur E2 + E25".

Zwischen Leser und Knopf liegt `staffelnBereinigen()`, und die löscht die
Staffel, sobald die Liste nur **eine** Staffel enthält. Auf der Titelseite ist
das der Normalfall. Die Kulisse hat das Feld also genau dort gesetzt, wo der
echte Ablauf es entfernt. Die Zusicherung prüfte damit einen Zustand, den es auf
der Seite nie gab.

**Prüffrage vor jeder Kulisse:** *Durch welche Funktionen läuft der Wert auf dem
echten Weg, bevor er hier ankommt?* Die Kulisse schickt ihn durch dieselben
Funktionen, statt das Ergebnis vorwegzunehmen. `netflix-auftrag.test.cjs` baut
die Liste deshalb roh und lässt `staffelnBereinigen()` laufen; die erste
Zusicherung hält fest, dass danach wirklich keine Staffel mehr dasteht.

Zwei Befunde am selben Fall gehören dazu:

- **Die Staffelnummer des Lesers ist eine Ladereihenfolge**
  (`staffelNummerFuer()`), keine Anbieterzählung. Sie taugt nur, solange jemand
  bei Staffel 1 anfängt. Tragfähig ist die **Folgenkennung**: Der Player nennt
  je Staffel seine Folgen (`ids` in `anbieterStaffeln`), die Titelseite dieselben
  Kennungen als `videoId`. Eine Meldung aus dem Player trägt Kennung **und**
  Staffel und verrät sie damit ebenfalls. Erst danach gilt der Abgleich über
  Folgenzahl, erste und letzte Nummer; er ist bei Haikyu!! mehrdeutig (S1 und
  S2 je 26 Folgen), und dann gilt der strengere Zustand der beiden.
- **Die Kennungen bleiben in der Erweiterung.** Der Worker kappt `staffeln` bei
  4000 Zeichen; mit den Kennungen von One Piece käme abgeschnittenes JSON in den
  Briefkasten. `ohneKennungen()` nimmt sie vor jeder Meldung heraus.

**Und eine Stichprobe sagt, was sie annimmt.** Stimmen erste und letzte Folge
überein, meldet `randMelden()` alle dazwischen mit, als Annahme in der Notiz.
Auf dem Knopf stand bis 4.19.0 nur „nur E2 + E25". Daniel am 11.09.2026:
„wenn es dazu führt das e2-e25 als dub true gekennzeichnet werden muss es besser
kommuniziert werden." Seit 4.19.1 heißt es vorher „▶ E2 + E25 prüfen → gilt für
E2-25" und danach „✓ E2 + E25 deutsch · E3-24 angenommen". Das Plus bleibt: Es
sagt, dass zwei Folgen gemessen werden und nicht der ganze Bereich (Daniel,
10.09.2026: „erst stand auf button 1-26, ich hab geklickt … jetzt steht 2-25").

### Drei Zustände je Folge, zwei Quellen, eine Funktion

Derselbe Vormittag hat gezeigt, warum die Zusicherungen allein nicht reichten:
Knopf und Dialog rechneten „schon gemeldet" **je für sich**. Der Dialog las den
lokalen Speicher `erledigt` und hielt alles Ungemeldete für offen (bei Haikyu!!
S1 „E2–25", obwohl der Bestand sie über die Streaming Availability API belegt).
Der Knopf las den Briefkasten, glich aber über die Nummer allein ab: Die Meldung
von **S2** E26 vom 22.08. machte S1 E26 zu „✓ geprüft". Nachgesehen im
Briefkasten war S1 E26 nie gemeldet. Daniel hatte es gleich gesagt („laut auftrag
müsste e26 erneut gemeldet werden"), und seine Vorgabe danach war: „zustände
sind schließlich nur: gemeldet (+datum wann zuletzt), zu melden, erneut melden …
pro episode … single source of truth".

Seit 4.19.2 gilt:

| Quelle | sagt | wo |
|---|---|---|
| Briefkasten | gemeldet, je Folge mit Datum und Kennung | `?gemeldet=` → `paare[].am`, `.folge` |
| Prüfliste | zu melden · erneut · belegt (+ Datum eines Handbelegs) | `zustand`, `am`, `seit` je Eintrag |

`folgeZustand()` in `melder.js` führt beides zu **einem** Zustand je Folge
zusammen, und Dialog, Knopf und Durchlauf lesen nur diese Funktion. Eine
Stichprobe meldet jede abgeleitete Folge einzeln (`randMelden()`), sie ist im
Briefkasten also eine Meldung wie jede andere und braucht keinen Sonderfall.

**Die Prüffrage, die den Fehler verhindert hätte:** *Woher nimmt diese Anzeige
ihren Stand — und nimmt die Anzeige daneben ihn von derselben Stelle?* Zwei
Anzeigen desselben Sachverhalts mit zwei Leitungen laufen auseinander, sobald
eine der Leitungen einen Sonderfall anders behandelt.

Bild dazu: `npm run check:netflix-dialog` rechnet die Zustände mit den echten
Funktionen gegen die ausgelieferte Liste und zeichnet den Dialog.

### Die Ladereihenfolge ist keine Staffelnummer — auch nicht in der Meldung

Am Abend desselben Tages, mit Diagnosebericht: Daniel klickte bei Haikyu!! S1,
dann S3, dann S2 an. Der Leser sammelt alle und nummeriert nach Eintreffen — die
11-Folgen-Staffel (Netflix' S3) hieß bei ihm „2". Zwei Folgen:

- **Der Knopf rechnete über alle geladenen Staffeln** und zeigte bei S3 „✓
  E1-26 erledigt". Seit 4.19.5 arbeiten Knopf und Durchlauf nur mit der
  **angezeigten** Staffel (`angezeigteFolgenSetzen()`): Welche das ist, sagen
  die Folgentitel auf der Seite; sonst gilt die zuletzt geladene.
- **Die Meldung zu „Haikyu! Season 3 OVA" ging als S2 E11 raus.** Der Code
  sagte ausdrücklich „Die Staffel der Folge schlägt die des Players" — und die
  Staffel der Folge war die Ladereihenfolge. Jetzt bestimmt `staffelFuerFolge()`
  sie aus der Zuordnung der ganzen geladenen Staffel (Kennungen, Folgenzahl),
  dann aus dem Player, wenn er genau diese Folge zeigt, sonst gar nicht. Die
  falsche Meldung (Id 4396) ist im Briefkasten berichtigt, bevor ein Lauf sie
  einarbeitete.

Und ein Riegel gegen Folgeschäden: Eine Meldung verrät die Staffel ihrer Gruppe
nur, wenn deren Folgenzahl passt. Sonst hätte die eine falsche Meldung die
Gruppe auf Dauer zu Staffel 2 gemacht.

**Die allgemeine Form steht schon weiter oben** („Eine geratene Staffelnummer
ist schlechter als keine", 31.08.2026) — sie galt dem Leser, nicht der Stelle,
die seinen Wert in die Meldung schreibt. Ein Wert, der als unzuverlässig erkannt
ist, wird an **jeder** Stelle entwertet, die ihn liest; `grep` nach dem Feldnamen
findet sie alle.

### Eine Auflösefunktion ist kein Test — sie sagt nie nein

Am 10.09.2026 stand über „Heroes", Staffel 3, Folge 17 der Kasten „Folge 17:
kein Deutsch gefunden". Kein Anime, nicht auf der Prüfliste; Daniel wollte
fernsehen: „wieso ist die extension hier??? fail."

Der Riegel war gebaut und griff nie. `playerAuftragOffen()` fragte
`Boolean(gemeinteReihe())` — und `gemeinteReihe()` **löst auf**, welche Reihe
gemeint ist. Sie hat einen Rückfall (`return stand.reihe`), und ein Rückfall
liefert immer etwas, sonst wäre er keiner. Auf jeder Player-Seite war der Test
damit wahr. Zwanzig Zeilen darüber stand `istGesucht()` und stellte genau die
richtige Frage: Steht die Reihe in `offeneTitel`?

**Die allgemeine Form:** `Boolean(x())` über einer Funktion mit Rückfall ist
fast immer `true`. Prüffrage vor jedem solchen Test: **Unter welcher Bedingung
gibt diese Funktion etwas Falsches zurück?** Fällt keine ein, ist es kein Test,
sondern eine Zeile, die aussieht wie einer.

Und die zweite Lehre ist eine Wiederholung: Es war **derselbe Titel** wie am
30.08.2026 („i am just watching something, there should be no elements from the
extension on screen") — dieselbe Regel, eine zweite Anzeigestelle, die es damals
noch nicht gab. Wer eine Regel aufschreibt, prüft im selben Zug, wo dasselbe
Problem noch existiert; wer eine **neue Anzeige** baut, sucht die Regeln, die für
die alten gelten. `extension/player-nur-mit-auftrag.test.cjs` führt den Fall
jetzt aus, statt ihn zu lesen — eine Textprüfung hätte `Boolean(gemeinteReihe())`
für richtig gehalten, so wie sie am selben Tag einen doppelt vergebenen Feldnamen
für richtig hielt. Die Gegenprobe fällt: mit dem alten Ausdruck reißen drei der
acht Zusicherungen.

### Ein Gerüst für drei Anbieter — und was beim Teilen wirklich bricht

Daniel am 10.09.2026 auf Netflix: „mach so eine schicke extension box ähnlich
wie bei prime … am besten selbe extension design auf allen seiten fürs
reporten, aber jede seite hat eigenheiten, also eigene melde elemente."

Gebaut ist die Trennung als `extension/box.js`: `akBox()` liefert das Gerüst
(Titel, Inhalt, Melden, Fuß, Debug), `akDebugLeiste()` die Schalterzeile, und
was darin steht, entscheidet der Melder. Die Datei steht im Manifest **vor**
den drei Meldern — Content-Skripte kennen keine Module, teilen sich aber den
Scope einer `content_scripts`-Gruppe.

**Der Umbau hat nicht am Code gehakt, sondern an fünf Kulissen.** Jede
Sandkasten-Prüfung lädt ihre Datei selbst, und keine wusste von der neuen:

| was fehlte | Symptom |
|---|---|
| `box.js` im Vorlauf | „akBox is not defined" — für Code, der im Browser läuft |
| `dataset` am Kulissen-Element | Absturz beim Stempeln des Kastens |
| `isConnected` | der Kasten entstand bei **jedem** Aufruf neu |
| ein `querySelector`, der wirklich sucht | die Zeilen blieben leer, die Knöpfe unerreichbar |
| `WeakMap` im Kontext | `box.js` warf beim Laden, und dann fehlte alles daraus |

**Disney+ zog als letzter nach — am 12.09.2026, zwei Tage später.** Die Datei
stand dort seit dem ersten Tag im Manifest und wurde nie gerufen; die beiden
Knöpfe schwebten weiter einzeln am Bildschirmrand, jeder mit seiner Lage im
Inline-Stil. **Ein geladenes Modul, das niemand aufruft, sieht in jeder Prüfung
aus wie ein benutztes** — dieselbe Klasse wie „Eine Datei zu schreiben ist nicht
dasselbe wie sie zu benutzen", nur im Browser.

Geprüft wird es wie die beiden anderen mit einem Bild (`npm run
check:disney-kasten`), und das Werkzeug misst dabei drei Dinge, die ein Bild
verschweigt: ob der Prüf-Knopf mit einem langen Befund über den Kasten
hinausläuft, ob beide Knöpfe wirklich `position: static` tragen, und ob ein
leerer Kasten verschwindet.

**Die Lehre ist der erste Punkt, nicht die Liste.** `tools/extension-laden-pruefen.cjs`
lädt jetzt die **Gruppe** aus dem Manifest statt der Einzeldatei — die Liste
steht dort, wo Chrome sie liest, nicht in einer zweiten Aufzählung im Werkzeug.
Wer eine gemeinsame Datei einführt, zieht die Kulissen im selben Zug nach; sonst
prüfen sie einen Zustand, den es nirgends gibt.

**Und dieselben Klassen sind kein Detail, sondern die halbe Arbeit.** Die
Netflix-Elemente trugen zunächst `ak-quelle` und `ak-uebersicht` — im Bild nahm
aniSearch die volle Breite ein, und der Prüflisten-Knopf war unsichtbar, weil
der linke Fußplatz seit 4.11.0 ausgeblendet ist. Richtig sind `ak-such-quelle`,
`ak-uebersicht-innen` und der **mittlere** Platz. Gefunden hat es keine
Zusicherung, sondern `npm run check:netflix-kasten` — ein Bild.

**Ein leerer Kasten ist ein sichtbarer Kasten.** Die fünf Zeilen verschwinden
einzeln (`:empty`), Rahmen und Hintergrund nicht. Auf einer Seite ohne Auftrag
stünde damit ein leeres Rechteck — genau der Fehler, den derselbe Tag im Player
schon gekostet hat. `.ak-box:not(:has(> :not(:empty)))` blendet ihn aus, und die
Gegenprobe dazu steht im Bild-Werkzeug.

### Beim Fernsehen ist die Erweiterung unsichtbar

Am 30.08.2026 stand über einer laufenden Folge „Heroes" unten rechts ein Knopf:
„Steht nicht auf der Prüfliste". Daniel: „i am just watching something, there
should be no elements from the extension on screen."

Der Hinweis war zwei Stunden vorher **bewusst** eingebaut worden, und für seinen
Fall zu Recht: Leitet Netflix einen Klick aus der Prüfliste woandershin, soll der
Knopf sagen, was passiert ist, statt stumm zu verschwinden. Nur galt er für
**jede** Titel- und Player-Seite statt für die eine, auf der gerade ein Auftrag
verfolgt wird.

Die Unterscheidung stand schon im Code — `kamAusListe` — und entschied bisher
nur über den **Text** des Knopfes statt über sein Dasein. Ohne Auftrag wird jetzt
gar nichts gezeichnet.

**Die allgemeine Form:** Ein Hinweis, der einen Sonderfall erklärt, gehört an den
Sonderfall. Wer ihn an die Seite hängt, auf der der Sonderfall vorkommen *kann*,
trifft alle übrigen Besuche derselben Seite mit — und das sind fast alle.
Prüffrage vor jedem eingeblendeten Element: **Wer sieht das, der es nicht
gesucht hat?**

**Und dieselbe Regel galt sechs Tage lang nur für Netflix.** Am 05.09.2026 stand
Daniel auf der Amazon-Seite eines AOC-Bildschirms, und unten rechts sagte der
Knopf „✕ nicht abrufbar — melden", darüber „Prime-Liste veraltet — neu laden":
„dont show extension on pages that are irrelevant, like this one."

Das Manifest lässt `amazon.js` auf `amazon.de/*` laufen — also auf jedem
Monitor, jeder Kaffeemaschine und jeder Bestellübersicht. Warum die Seite so
weit kam, ist der lehrreiche Teil: Die Filmerkennung fällt auf `hatLaufzeit`
zurück, und deren Muster (`\d+ Std. \d+ Min.`) trifft auch Amazons
Lieferzähler — „Bestellung innerhalb 3 Std. 38 Min." stand auf dem Bild. Eine
Heuristik für Filme, angewandt auf eine Seite, die gar kein Video ist.

`seiteGehtUnsAn()` entscheidet seit 4.12.6 vor allem anderen, und zwar an vier
Merkmalen, die jedes für sich genügen und zusammen nichts kosten: der Pfad
`/gp/video/…`, der Hydration-Block `dv-web-page-hydration-data`, der
Folgen-Reiter, oder ein Auftrag für diese Adresse. **`hatLaufzeit` gehört
bewusst nicht dazu** — siehe Lieferzähler.

**Die Lehre über dem Einzelfall:** Eine Regel, die für einen Anbieter
aufgeschrieben wurde, gilt nicht von selbst für den nächsten. Wer sie notiert,
prüft im selben Zug, wo dasselbe Problem noch existiert — hier lag zwischen
„Beim Fernsehen ist die Erweiterung unsichtbar" und derselben Frage bei Amazon
genau eine Woche.

**Und dieselbe Regel gilt in der teureren Richtung: zu viel statt zu wenig.**
Am 06.09.2026 war der Prüflisten-Knopf auf Netflix vier Tage lang unsichtbar —
im Dokument, an der richtigen Stelle, mit oberstem z-index, und
`visibility: hidden`. Die Ursache war eine Zeile in `melder.css`, geschrieben
für Amazons Hinweiskasten: Sie hält einen Knopf verborgen, solange er nicht in
den Kasten eingezogen ist. `melder.css` gilt laut Manifest aber für **alle
drei** Anbieter, und weder Netflix noch Disney+ haben diesen Kasten.

**Drei Runden Fehlersuche gingen daran vorbei, weil sie die falsche Frage
stellten.** „Ist der Knopf da?" beantworteten sie mit ja — er war es. Beantwortet
hat es erst der berechnete Stil. Der Diagnosebericht der Erweiterung trägt
seitdem `uebersicht.stil` (`getComputedStyle`) und `uebersicht.obenLiegt`
(`elementFromPoint`), denn ohne beides misst er Anwesenheit statt Sichtbarkeit
— dieselbe Unterscheidung, die die Regel „bei allem Optischen wird hingesehen,
nicht gerechnet" für die Seite längst zieht.

**Der Riegel steht in `check:logic`:** Kein Block in `melder.css` darf einen
Knopf unsichtbar schalten, ohne einen Anbieter-Anker (`.ak-amazon`) im Selektor
zu tragen. `amazon.js` setzt die Marke am `<html>`. Gegenprobe gefahren: ohne
den Anker wird die Zusicherung rot.

**Und seit es einen gemeinsamen Kasten gibt, braucht der Kasten selbst eine
Regel.** Am 11.09.2026 stand im Player von „Heroes" wieder etwas: der leere
Rahmen mit der Debug-Zeile. Melde-Knopf, Leiste und Prüflisten-Knopf hatten je
ihre eigene Regel und waren alle verschwunden — der Kasten, der sie trägt, hatte
keine. Seit 4.19.4 entscheidet `seiteGehtUnsAn()` im Sekundentakt über den
ganzen Kasten: Stöberseite ja, Player nach `playerAuftragOffen()`, Titelseite
nach der Kennung der Seite (nicht nach `gemeinteReihe()`, die auf die vorige
Reihe zurückfällt). Dazu `.ak-box[hidden] { display: none }` — ohne diese Zeile
gewann das `display: flex` der Box gegen das Attribut, gemessen in
`check:netflix-kasten`. **Wer ein neues Gerüst um bestehende Elemente legt,
gibt dem Gerüst dieselben Sichtbarkeitsregeln wie seinen Inhalten.**

### Netflix leitet im Browser um, nicht per HTTP

Am 30.08.2026 versucht, die Weiterleitung von `81670593` („Pokémon: Blauer
Himmel in der Ferne!") auf `81706101` („Ultimative Reisen") selbst zu finden —
ein `fetch` auf `/title/<id>` mit `redirect: 'follow'`. Gemessen:

    Status: 200
    Ziel:   https://www.netflix.com/de-en/unsupportedbrowser
    Redirects: 2

**Netflix leitet nicht auf den Zieltitel um.** Die Zuordnung entsteht erst im
Browser, im JavaScript der Anwendung — derselbe Befund wie beim Player-Manifest
und bei der Folgenliste: Was Netflix im Client entscheidet, ist von außen nicht
zu lesen.

Damit bleibt der **Klick aus der Prüfliste** der einzige Weg, eine Weiterleitung
zu erkennen. Er wird seit 4.0.3 dauerhaft gemerkt (`netflixWeiterleitungen`),
also genügt er einmal je Titel; ein Reload danach ändert nichts mehr.

### Ein Wert, der weiterreicht, muss überall dieselbe Quelle haben

Am 31.08.2026 zeigte die Prüfliste für Death Note weiter „E31" als offen,
obwohl die Meldung um 22:35 angekommen war. Zwei Zeilen auseinander stand in
`durchlaufMelden`:

```
staffel: stand.staffel ?? DURCHLAUF.staffel ?? null,   ← in die Meldung
await merkeErledigt(gemeinteReihe(), null, folge.nummer)   ← in den Vermerk
```

Die Meldung bekam die Staffel, der lokale Vermerk nicht. `merkeErledigt`
leitet sie dann aus „genau eine offene Staffel" ab und **steigt bei jedem
Titel mit mehreren aus** — bei Death Note (drei) ohne ein Wort.

Dieselbe Verwechslung eine Funktion weiter, mit teurerer Folge: `randMelden`
stempelte **alle** Folgen einer Randprobe mit der Staffel der einen
gemessenen. `befund` ist die Messung *einer* Folge; ihre Staffel gilt nicht
für die übrigen. Bei Dorohedoro landeten 1, 12 und 13 in Staffel 1 und der
Rest in Staffel 2 — die Reihenfolge, in der der Player sie meldete, nicht die
des Anbieters.

**Der Schaden war im Bestand angekommen**, und zwar so, dass er richtig
aussah: `dub: true` stimmte überall, nur die Bereiche waren falsch. Gemessen
über alle Netflix-Meldungen (Kriterium: lückenlose Folgenspanne über die ganze
Reihe, mindestens acht Punkte, Staffelnummer nicht monoton) waren es fünf
Reihen — Death Note stand mit „2–36" im Datensatz, obwohl 1 bis 37 gemeldet
waren, Carole & Tuesday mit „2–11" bei 24 Folgen.

**Repariert wird so etwas, indem man die falsche Angabe wegnimmt, nicht indem
man sie berichtigt:** Die 132 Meldungen haben ihre Staffelnummer verloren und
stehen wieder als offen. Ohne sie ordnet `ordneMeldungZu` über die
Folgennummer zu, und das ist bei durchlaufender Zählung genau richtig. Eine
Staffelnummer, die aus einer Verwechslung stammt, von Hand zu korrigieren
hieße, dieselbe Vermutung noch einmal anzustellen.

**Die allgemeine Form:** Wo ein Wert an zwei Empfänger geht, gehört er in
**eine** Variable über beiden. Zwei Ausdrücke, die dasselbe meinen sollen,
laufen auseinander — hier reichte dafür, dass der eine drei Zeilen später
geschrieben wurde als der andere.

### Der Sandkasten fängt, was die Textprüfung nicht sehen kann

Am 01.09.2026 lief zum vierten Mal in einer Woche derselbe Absturz: Ein `let`
im Modulscope wurde vor seiner Deklaration gelesen, diesmal
`wiedervorlageBeantwortet`. Die statische Zusicherung dafür
(`amazon-folgenzahl.test.cjs`) meldete grün.

**Der Grund ist eine Lücke, die sich nicht schließen lässt.** Sie sucht
`name.` — die Nutzung als Objekt. Hier stand aber eine reine **Zuweisung**:

```
wiedervorlageBeantwortet = x?.amazonWiedervorlage ?? {}
```

Der Versuch, auch Zuweisungen zu zählen, erzeugte sofort vier Fehlalarme
(`id`, `listenId`, `eintrag`, `letzterStand`) — alle stehen in Funktionskörpern
und laufen erst später, sind also harmlos. Textlich ist das nicht zu trennen:
Dieselbe Zeile ist ein Absturz oder harmlos, je nachdem, **wann** ihr Block
läuft. Die Schärfung wurde deshalb zurückgenommen; eine Prüfung, die
zuverlässig zu Unrecht rot wird, ist schlimmer als keine.

**Gefangen hat es `tools/amazon-startseite-pruefen.cjs`** — der Sandkasten, der
`amazon.js` wirklich lädt. Sechs Zusicherungen der Übersicht wurden rot, mit der
Meldung im Klartext.

**Die Lehre über dem Einzelfall:** Für Fehler, die von der Ausführungsreihenfolge
abhängen, ist das Ausführen die Prüfung — nicht das Lesen. Die statische
Zusicherung bleibt trotzdem: Sie fängt die Fälle, die der Sandkasten nur auf
einer Seite sieht, die er gerade nicht nachstellt.

### Die Prüfliste kennt genau eine Wahrheit — den Briefkasten

Daniel am 09.09.2026: „mach das die prüfliste synchron ist … sodass du einträge
beliebig zur prüfung geben kannst, ich will keine console commands bei mir lokal
ausführen."

Die Regel dazu steht seit dem 28.08.2026 („single source of truth"), und eine
Zeile widersprach ihr:

    if (briefkastenSuchen) return briefkastenSuchen.has(url) || Boolean(suchErledigtFrisch(url))

Der lokale Vermerk war damit keine Überbrückung mehr, sondern zweite Wahrheit:
Wer eine Meldung serverseitig verwarf, um einen Titel erneut prüfen zu lassen,
sah den Eintrag in Daniels Browser trotzdem nicht wieder.

Seit 4.16.6 entscheidet der Briefkasten allein, sobald er geantwortet hat — und
der widerlegte Vermerk wird **weggeworfen**, nicht nur übergangen. Zurückgestellt
wird mit:

    LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --offen
    LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --zurueck <ids>

**Was das Werkzeug nicht tut:** einen bereits eingearbeiteten Handbeleg aus
`data/dub-confirmed.yaml` entfernen. Der wird von Hand zurückgenommen, mit
Begründung im Commit — es ist die teuerste Quelle des Projekts, und sie soll
nicht von einem Skript geräumt werden. Das Werkzeug zeigt an, wenn es einen
findet.

### Ein Auftrag gehört zu einer Suche — nicht zu „einer Suchseite"

Daniel am 09.09.2026: „polar bären als ‚nicht bei prime' gemeldet -> nächsten
eintrag in prüfliste gewählt -> extension wechselt inhalt der melde box zurück
zu polar bären nach <2sek". Über den Trefferkarten von „Ein Brief an Momo" stand
der Auftrag des vorigen Titels — samt Melde-Knopf, der unter dessen Suchadresse
gemeldet hätte.

Der gemerkte Auftrag im `sessionStorage` gilt zehn Minuten und ist für eine
**Weitersuche** da („Kürzer suchen", „Deutsch suchen"), deren Adresse in keiner
Liste steht. Er war an **keinen Suchbegriff** gebunden, und die Regel dafür
lautete wörtlich: „Auf einer Suchseite ist er die richtige Auskunft — dort gibt
es nichts anderes, worauf er sich beziehen könnte." Genau das ist falsch, sobald
die nächste Suche selbst ein Auftrag ist.

**Der Weg hinein ist eine Sekunde Verzug.** `suchliste` kommt aus
`chrome.storage`, also asynchron; beim ersten Takt ist sie leer, `offeneSuche()`
findet nichts — und in dieses Loch sprang der Merker. Er schrieb sich dabei mit
neuer Zeit zurück und hielt sich selbst am Leben.

Seit 4.16.5 trägt er die Begriffe, für die er gilt (`begriffeDesAuftrags()`),
und die Weitersuch-Knöpfe hängen ihren Zielbegriff an (`weitersuchen()`).

**Die allgemeine Form:** Ein Rückfallwert braucht eine Bedingung, unter der er
gilt — sonst füllt er jede Lücke, auch die, die eine Sekunde später von selbst
zugeht. Und ein Rückfall, der sich beim Benutzen erneuert, verfällt nie.

### Ein Auftrag mit zwei Ausgaben ist nach der ersten Meldung nicht fertig

Am selben Tag, an „Death Note: Relight" (ein Eintrag, zwei Kauftitel): Nach der
Meldung von `B0FVDZ286F` führte der Klick auf die zweite Zeile der Checkliste
auf eine Seite **ohne Kasten** — keine Checkliste, kein aniSearch-Verweis, und
statt des Auftragstitels stand dort „Chatverlauf", ein Textfund aus Amazons
eigener Seite.

`istGemeldet()` kennt die Erwartung seit dem 02.09.2026 und wartet auf **alle**
Ausgaben. Die **Aufräumarbeiten** nach der Meldung kannten sie nicht: Sie hakten
die Suchadresse ab (`suchAbhaken`) und vergaßen den Auftrag
(`suchauftragVergessen`). Ohne Auftrag findet die Zielseite nichts mehr, woran
sie hängen könnte.

Beides hängt seit 4.16.5 an `erwartungNochOffen()`. Dazu zählt die eigene Seite
sofort als gemeldet (`briefkastenSeiten`), damit die Checkliste ihren Haken
zeigt, bevor der Briefkasten antwortet — dieselbe Überbrückung wie bei
`briefkastenAdressen`.

**Die Prüffrage bei jedem „erledigt":** Erledigt *was* — diese Seite oder den
Auftrag? Wo ein Mensch angekreuzt hat, dass zwei Dinge zusammengehören, ist das
zwei verschiedene Fragen.

### „Staffel gewechselt" stand auf Seiten mit genau einer Staffel

Dritter Befund vom 09.09.2026, aus einem Bild: Auf einer frisch geladenen Seite
(„2.5 Dimensional Seduction", eine Staffel) sagte der Kasten „Staffel gewechselt
— für Jahr und Staffelnummer die Seite neu laden". Neuladen half nicht; es
konnte nicht helfen.

`quelltextVeraltet()` fragt zuerst, ob Adresse und Quelltext **dieselbe** Kennung
nennen. Tun sie das nicht — der Normalfall bei Filmen und Sammelseiten, siehe
Digimon Tamers —, entscheidet ein Titelvergleich, und der schlägt an, sobald
sich `seitenTitel()` ändert. Beim Rendern ändert er sich immer. Der Rettungsanker
von 1.3 deckte also genau die Seiten ab, auf denen es nie ein Problem gab.

Seit 4.16.5 steht davor die Frage, die dieses Projekt an anderer Stelle längst
für die tragfähige hält: **Kommt die Adress-Kennung im Quelltext überhaupt vor?**
(`kennungImQuelltextBekannt()`, gemessen am 25.08.2026 — eigene Kennung 11 bis
119 Treffer, fremde 0.)

**Dem Staffelwechsel wird dadurch nichts genommen**, und das ist der zweite
Befund: Er leert über `beiStaffelwechsel()` das Titel-Kennung-Paar, und der
Serientitel bleibt derselbe — der Vergleich schlug dort **nie** an. Die Zeile hat
also nie einen Staffelwechsel gemeldet, nur Fehlalarme; sie heißt jetzt „Titel
gewechselt".

**Offen und ungemessen:** Damit zeigt der Kasten nach einem echten
Dropdown-Wechsel Jahr und Staffelnummer aus dem alten Quelltext, ohne zu warnen.
Wer das anfasst, misst zuerst, welcher Wächter dort wirklich anschlägt.

### Die Gegenprobe fällt — fünf Mängel einer Kulisse, keiner zu erraten

Am 09.09.2026 stand hier: „Bis die Gegenprobe fällt, ist es keine Prüfung — nur
eine bessere Kulisse." Sie fällt jetzt. `tools/amazon-startseite-pruefen.cjs`
meldet den `istKanalKarte`-Absturz wörtlich so, wie Daniel ihn gesehen hat:
„Cannot access 'istKanalKarte' before initialization".

Dazwischen lagen **fünf** Mängel der Kulisse, jeder einzeln gemessen — und jeder
verdeckte den nächsten:

| fehlte | Wirkung |
|---|---|
| `querySelector`, das wirklich sucht | der Kasten bekam nie sein `.ak-z-inhalt`, keine Zeile wurde eingehängt |
| `AK_PRIME_SUCHE` | `offeneSuche()` liest **diese** Liste, nicht `AK_OFFENE_AMAZON` — ohne sie kein Auftrag |
| `sessionStorage` | schon `seiteGehtUnsAn()` lief in seinen Fangzweig, die Seite galt als fremd |
| `closest` an den Trefferkarten | `suchTreffer()` warf auf oberster Ebene — das Skript endete stumm |
| `createTextNode` und `append` | dieselbe Stelle, ein Schritt weiter, in den Ankreuz-Zeilen |

**Das Vorgehen ist die eigentliche Lehre.** Vier Anläufe aus Vermutungen hatten
nichts gebracht; gefunden wurde jeder Mangel durch dieselbe Frage, gestellt an
den Ablauf statt an den Code: *Wie weit kommt er?* Gemessen wurde daran, **was
am `body` hängt** — der Übersichts-Knopf entsteht früh, der Kasten spät. „Nichts
angehängt" auf der Suchseite, während drei andere Adressen ihren Knopf haben,
zeigt die Stelle genauer als jeder Stapelauszug.

**Und ein stiller Ausstieg sieht aus wie eine bestandene Prüfung.** Alle fünf
Fälle endeten ohne rote Zeile: Der Wurf stand auf oberster Ebene des Skripts,
die Prüfung sah einen Knopf, den es vor der Absturzstelle gab, und meldete grün.
Deshalb zählt sie jetzt die Zeilen im Kasten — und wird rot, wenn er leer bleibt.

### Der fünfte `let`-Zugriff vor der Deklaration — gefangen vom Sandkasten

Der Fix darüber rief `kennungImQuelltextBekannt()` neu aus `zeigeAuftragshinweis()`
— also rund 4.000 Zeilen **vor** dem `let` seines Zwischenspeichers. Ergebnis:
`ReferenceError` beim Seitenaufbau, der Kasten war weg. Fünfter Fall dieser
Klasse nach `listenId`, `knopf`, `wiedervorlageBeantwortet` und `istKanalKarte`.

Diesmal hat ihn eine Prüfung gefangen, bevor etwas ausgeliefert war:
`amazon-suchseite.test.cjs` wurde rot, und `amazon-folgenzahl.test.cjs` nannte
die zweite Fundstelle im selben Lauf. Das ist der Beleg dafür, dass die beiden
Prüfungen vom 09.09.2026 tragen — und dazu die Bauregel:

> **Wer eine Funktion an eine frühere Stelle des Ablaufs hängt, nimmt ihren
> Zustand mit nach oben.** Der Zwischenspeicher gehört dann zu den Variablen am
> Kopf des Moduls, nicht neben seine Funktion.

### Ein Helfer im Modulscope ist eine `function`, keine `const`-Pfeilfunktion

Am 09.09.2026 war die Erweiterung auf jeder Amazon-Suchseite komplett weg.
Daniels Bild aus der Fehlerliste:

    Uncaught (in promise) ReferenceError:
    Cannot access 'istKanalKarte' before initialization    amazon.js:4943

**Vierter Fall dieser Klasse in vier Wochen** — `listenId` (25.08.), `knopf`
(28.08.), `wiedervorlageBeantwortet` (01.09.) —, und der erste, den ich selbst
eingebaut habe, während die Lehre dazu im Repo stand. Beim Herausziehen eines
Blocks in eine Funktion wurde der Helfer daneben als `const` mit Pfeilfunktion
angelegt. Der Name wird gehoben, der Wert nicht.

**Und die drei vorhandenen Prüfungen fangen ihn alle nicht — jede aus einem
eigenen Grund:**

| Prüfung | warum sie schweigt |
|---|---|
| `extension-laden-pruefen.cjs` | lädt die Datei; der Zweig läuft erst auf einer Suchseite mit Trefferkarten |
| `amazon-startseite-pruefen.cjs` | kannte `/s?k=…` nicht — jetzt schon, erreicht den Zweig aber ohne echte Karten trotzdem nicht |
| statische Zusicherung in `amazon-folgenzahl.test.cjs` | sucht `name.` (Zugriff als Objekt), nicht `name(` (Aufruf) |

Die naheliegende Schärfung — auch den Aufruf zählen — ist **gemessen und
verworfen**: Sie fängt genau diesen Fall nicht, denn der Aufruf steht im Text
*unter* der Deklaration und wird nur zur Laufzeit früher erreicht. Dafür meldet
sie `suchOffen()` (Zeile 820, deklariert bei 5303) — dieselbe Bauform, dort
harmlos, weil der Diagnosebericht erst auf Knopfdruck läuft. Textlich sind die
beiden nicht zu trennen; dasselbe Ergebnis wie am 01.09.2026, und dieselbe
Entscheidung: zurückgenommen, weil eine Prüfung, die zuverlässig zu Unrecht rot
wird, schlimmer ist als keine.

**Was bleibt, ist die Bauregel — und sie kostet nichts:**

> Ein Helfer im Modulscope, der von mehr als einer Stelle gerufen wird, ist eine
> `function`-Deklaration. Sie wird vollständig gehoben und kann nicht zu früh
> gelesen werden.

`const` bleibt richtig für Werte und für Funktionen, die nachweislich erst nach
ihrer Zeile laufen. Die Frage vor jedem neuen Helfer lautet deshalb nicht „was
ist schöner", sondern: **Kann irgendetwas ihn rufen, bevor diese Zeile
gelaufen ist?** Bei einem Modul mit Takt, Beobachtern und Klick-Behandlern
lautet die Antwort fast immer ja.

**Der Sandkasten ist am 09.09.2026 nachgezogen worden — und reicht noch nicht.**
Er kennt jetzt die Suchseite (`/s?k=…`), zwei echte Trefferkarten
(`article[data-testid="card"]` mit `data-card-title` und Verweis), einen
Suchauftrag als Kulisse und löst den Takt einmal aus, statt ihn nur zu sammeln.
Jeder dieser vier Schritte war nötig; keiner allein genügte.

**Die Gegenprobe bleibt trotzdem grün** — den Fehler wieder einzubauen meldet
nichts. Der Zweig mit den Ankreuz-Feldern wird also weiterhin nicht erreicht,
und woran es jetzt noch hängt, ist ungemessen (Verdacht: Der Kasten wartet auf
die Briefkasten-Antwort, und der `fetch`-Mock liefert ein leeres Objekt).

**Bis die Gegenprobe fällt, ist es keine Prüfung** — nur eine bessere Kulisse.
Wer hier weitermacht, misst zuerst, wo der Ablauf aussteigt: eine Ausgabe je
Zweig im Takt, nicht ein weiterer Anlauf aus einer Vermutung.


## Eine Fehlerseite ist keine Staffel ohne Folgen (19.09.2026)

Auf Amazons 404 („keine funktionsfähige Seite“) stand zuerst richtig „✕ nicht abrufbar — melden“; nach acht Sekunden ohne Folgenreiter griff der Zweig „Diese Staffel führt bei Amazon keine Folgen“ und sperrte den Knopf. Die tote Adresse (Peace Maker Kurogane `B0D59HJGBZ`, laut Linkprüfung 200) ließ sich nicht mehr melden — und gerade dafür gibt es den Knopf: Amazon antwortet der Linkprüfung mit 200, auch wenn Daniel eine 404 sieht. **Jeder Zweig, der den Knopf sperrt, schließt Fehler-, Region- und Nicht-verfügbar-Seiten aus.** Zusicherung in `amazon.test.cjs`, Gegenprobe rot. Behoben in 4.20.28.

## Der Stand muss vollständig sein — die Erweiterung zählt, was fehlt, als erledigt (19.09.2026)

`?stand=1` schickte nur `ziele.slice(0, 25)`, die Erweiterung hält in `fertig()` alles für erledigt, was dort nicht steht. Bei 37 offenen Titeln zeigte sie „25 offen“, die Statusanzeige 36, und ein eben gemeldeter Titel stand unter „erledigt“, während ein anderer nachrückte (Zähler 25 → 24 → 25). Der Worker schickt jetzt alle Ziele; Zusicherung in `check:logic`. Und: Auf einer gemeldeten toten Seite gibt es keine Staffel-Checkliste, die „alles gemeldet“ zeigen könnte — dort steht die Marke „gemeldet ✓“ (4.20.29).

### Eine neue Schlüsselform wird gegen eine Liste geprüft, die sie schon enthält

Am 19.09.2026 bekam die Prime-Prüfliste JustWatchs Form `watch.amazon.de/detail?gti=…`
(Liste und Erweiterung nachgezogen). `check:extension` lief lokal grün — die lokale
`offene-amazon.js` trug noch keinen solchen Schlüssel. Erst der Bau schrieb sie hinein, und
`amazon-liste.test.cjs` mit einer eigenen, dritten Kopie des Ausdrucks machte jeden Deploy
rot; live blieb der alte Stand, die Erweiterung meldete „Prime-Liste veraltet“. Wer die Form
eines Schlüssels ändert, sucht **alle** Kopien des Ausdrucks
(`grep -rn "amzn1\\.dv\\.gti" extension tools`) und fährt die Prüfung nach dem ersten Bau.

### Ein Ereignis am `document` erreicht nur den Melder, der auf dieser Seite läuft

„Bericht laden" schickt `ak-report` an das `document`. Den Empfänger dafür gab es in `amazon.js`
und in `melder.js` (Netflix) — auf einer Disney+-Seite läuft keins von beiden, und der Knopf tat
nichts (Daniel, 20.09.2026: „bericht laden klick macht nix"). Seit 4.20.43 hat `disney.js` seinen
eigenen Empfänger und seinen eigenen Bericht. **Prüffrage bei jedem gemeinsamen Bedienelement aus
`box.js`: Wer hört auf der Seite zu, auf der es steht?**

## Eine Kachel auf der Seite ist noch keine Folge in Amazons Daten

Lupin III. Part 6 im Crunchyroll-Kanal, Staffel 1 (21.09.2026): Die Seite zeigt „12 Folgen" und
zwölf Kacheln, der Knopf „10 Folgen". Daniels Bericht: Amazons eigene Daten nennen `episodeCount`
10 und liefern zehn Folgen (Nummern 2–5 und 7–12); zu den Kacheln „Das Abenteuer der
Transkontinentalen Eisenbahn" und „Untold Stories" kommt nichts — keine Kennung, keine Tonspuren.
Der Knopf zeigt, worüber er etwas weiß, und das ist richtig so.

Ein erster Fix hatte auf doppelte Nummern in den Daten getippt und über Folgenkennungen gezählt
(4.20.44). Der Bericht widerlegte das beim ersten Blick: Auch die Kennungen waren zehn. Die Zeilen
sind wieder heraus (4.20.45). **Bei einer abweichenden Zahl zuerst den Bericht lesen**
(`zaehlstand.gesamt`, `zaehlstand.nummern` gegen `seite.folgenImDom`), nicht aus dem Bild raten.

### Die Automatik hing nach dem Sprung zum nächsten Titel — `stand` setzt nur der Player (21.09.2026)

Selbsttätiger Durchgang: Beastars geprüft, dann `gehe('/title/80090673')` zu Haikyu!! — und
Stillstand, kein Knopf. Der Bericht (Konsole: `document.dispatchEvent(new CustomEvent('ak-report'))`,
der Kasten ging nicht auf) zeigte `adresse: /title/80090673`, aber `stand.reihe: 81054847` und
eine Folgenliste von Beastars. `stand` kommt nur aus dem Player (`ak-spuren`); auf einer Titelseite
blieb die Reihe der vorigen Seite stehen, und die neue Folgenliste wurde gegen `gemeinteReihe()`
(= Beastars) verglichen und als fremd verworfen. Seitdem vergleicht der Empfänger mit der Kennung
der **Adresse** (`titelDerAdresse()`), und `pfadPruefen` verwirft den alten Stand beim
Titelwechsel — die Folgenliste nur, wenn sie nicht schon zur neuen Seite gehört (`listeFuer`).

Im selben Bericht der zweite Fehler: Die Automatik prüfte bei Beastars die von Netflix
vorausgewählte **Staffel 2**, während Staffel 1 offen war. Drei unserer Staffeln haben je
12 Folgen, der Knopf zeigte „S?". Die Automatik startet seitdem nur bei eindeutiger Staffel und
überspringt den Titel sonst mit Hinweis in der Konsole (`selbstUebersprungen`).

**Zweiter Bericht am selben Abend (4.20.48):** Das Zurücksetzen in `pfadPruefen` hielt nicht — der
Leser schickt auf der Titelseite weiter die Spuren des zuletzt gespielten Players, und Made in Abyss
stand wieder unter Haikyu!!. Seitdem gilt in `gemeinteReihe()` auf einer Titelseite die Adresse vor
`stand.reihe`. Im selben Zug: Der Knopf „abbrechen" verwarf jeden Klick im Lauf („läuft schon") — er
setzt jetzt `DURCHLAUF.abbruch`. Und liegen zwei unserer Titel in einer Netflix-Staffel (Haikyu!!
TO THE TOP: E1–13 und E14–25), gilt die Stichprobe zuerst für den vorderen, der andere folgt im
nächsten Lauf auf derselben Seite — statt 25 Einzelprüfungen (Daniel: „alles durchgehen sollte den
schnellen weg gehen").

**Und ein Lauf gehört einem Tab (4.20.51).** `chrome.storage.local` teilen alle Tabs: Mit dem
Merker „Lauf aktiv" dort sprang ein zweiter Netflix-Tab, in dem Daniel „Heroes" sah, zu Pluto
und meldete (die Meldung selbst war richtig, E1–8 deutsch). Zustand, der zu **einem** Tab gehört,
steht in `sessionStorage` — er übersteht Neuladen und Seitenwechsel, erreicht aber keinen anderen Tab.

### Die Automatik wählt die Staffel im Netflix-Auswahlfeld (22.09.2026, 4.20.53)

Gemessen auf Dr. STONE mit zwei Konsolen-Skripten, die Daniel ausgeführt hat (das erste klickte
blind und schloss mit Escape die Übersicht — Messskripte klicken nur, was vorher gemessen ist):
Auslöser `[data-uia="episode-selector"] button[data-uia="dropdown-toggle"]` mit Text „Staffel 3",
nach dem Klick `ul[data-uia="dropdown-menu"][role=menu]` mit `li[data-uia="dropdown-menu-item"]`,
Text „Staffel 1  (24 Folgen)" … und „Alle Folgen anzeigen". Die Automatik wechselt nur bei Listen
in Netflix-Zählung (`laut: 'anbieter-gerechnet'`), wartet, bis das Feld die Zielstaffel zeigt,
und merkt sich je Titel, welche Staffeln sie schon hatte.

## Zurück auf die Prüfliste: ein Aufruf, `tools/erneut-melden.mjs`

Daniel am 22.09.2026: „vereinfach das, sodass du nur an einer stelle sagen musst welche einträge
wieder auf die prüfliste sollen, und lass den mechanismus alle abhängigkeiten automatisch machen".
Anlass: Drei Testtitel standen in `data/erneut-melden.yaml` und in den Erweiterungslisten, aber
nicht in der Status-App — `tools/pruefstand.mjs` war nicht gefahren.

Die Kette hat vier Glieder: YAML → `extension/offene-*.js` samt Standdateien → `public/data/pruefstand.json`
→ Commit, Push, Deploy. **Eingabe ist nur noch die Kennung:**
`node tools/erneut-melden.mjs 99088 20966:primevideo --grund "…"` (ohne Anbieter: bei jedem mit
Verweis). Das Skript fährt die Kette, prüft, dass jeder Eintrag in Liste **und** Prüfstand steht,
nimmt bei einem Fehlschlag alles zurück und pusht. `check:wiedervorlage` (in `check:vor-commit`)
fängt eine YAML-Zeile, die ohne das Skript hineinkam.

Grenze, gemessen an Dr. Stone: Stone Wars: Ein Titel mit Beleg **von heute** ist erst morgen
erneut vorlegbar — Belege tragen nur das Datum, und `checkedAt >= seit` gilt dann schon. Das
Skript sagt das ausdrücklich.

## Der Durchgang entscheidet mit der Liste der eigenen Seite (24.09.2026)

Nach einem sauber gemeldeten Titel sprang die Automatik durch vier weitere, ohne eine Folge zu
öffnen. Die Spur im Bericht (seit 4.21.4) zeigte den Grund in einer Zeile je Titel: „Staffel nicht
eindeutig", keine Kandidaten, drei Sekunden für vier Titel. Zwei Lehren:

- **Eine leere Liste setzt die angezeigte nicht zurück.** `angezeigteFolgenSetzen()` kehrt bei
  leerer `alleFolgen` sofort zurück, `DURCHLAUF.folgen` bleibt stehen. Wer beim Titelwechsel nur
  `alleFolgen` leert, lässt die Folgen des vorigen Titels in der Anzeige. `pfadPruefen` leert
  deshalb beide, und `vielleichtSelbstStarten()` entscheidet erst, wenn `listeFuer` die Adresse
  trägt (höchstens 20 s, dann Spur „keine Folgenliste").
- **Eine einzige eigene Staffel ist eindeutig, auch wenn Netflix anders teilt.** Naruto (220),
  Shippuden (500), Boruto (293) und Beelzebub (60, bei Netflix 48) scheiterten am Abgleich über
  die Folgenzahl. Passen die Nummern der Netflix-Gruppe in unsere Staffel, gehört sie dazu. Die
  Ausnahme ist eine spätere Netflix-Staffel, die wieder bei der ersten Nummer beginnt.

Dazu: Die Randprobe meldet sechs Folgen gleichzeitig. Nacheinander brauchten 52 Meldungen acht
Sekunden. Der Worker löscht und schreibt je Folge (`folge_nr`, `gti`), die Anfragen stören sich
nicht; das Abhaken im lokalen Speicher bleibt der Reihe nach, weil es liest und schreibt.
Zusicherungen: `extension/durchgang-fremde-liste.test.cjs`.

## Der Durchgang besucht jede Staffel — die Zuordnung macht der Zuordner (24.09.2026)

Bis 4.21.7 suchte die Automatik je Titel die eine richtige Netflix-Staffel (über die Prüfliste,
dann die Folgenzahl im Menü, dann Netflix-Staffel 1) und übersprang den Titel, wenn die angezeigte
keiner unserer Staffeln eindeutig zuzuordnen war. Naruto, Baki Hanma und JoJo fielen so durch.
Daniel: „man kann die extension einfach alle staffeln durchgehen und melden lassen wenn möglich
(wenn nicht bereits getan), das geht schneller und ist sowieso das ziel alles zu melden".

Seit 4.21.8 prüft sie die angezeigte Staffel, wenn dort etwas offen ist, und geht danach jede
noch nicht besuchte Staffel im Menü durch (`selbstStaffelnBesucht`, Schlüssel über
`menueSchluessel()`, weil Menüeintrag „Staffel 2 (27 Folgen)" und Knopf „Staffel 2" sich
unterscheiden). Ein Lauf ohne neue Meldung macht die Staffel fertig (`selbstStaffelnGeprueft`),
sonst drehte eine uneinheitliche Randprobe endlos.

**Warum das ohne Zuordnung in der Erweiterung trägt:** `fetch-pruefungen.ts` ordnet
Netflix-Meldungen über den Folgentitel zu (`lib/folgentitel-anker.ts`, PoC 18.09.2026: 466
Treffer, alle eindeutig). Das gilt aber nur unter den Titeln, die die Meldung zulässt: Eine
mitgeschickte `titelId` legt sie fest. **Die Staffelzahl des Players ist Netflix' Zählung.** Bei
JoJo ist „Golden Wind" Netflix-Staffel 4 und bei uns Staffel 5; `staffelFuerFolge()` machte daraus
unsere 4, „Diamond Is Unbreakable", und die `titelId` hätte dem Zuordner den richtigen Titel
entzogen. Die Player-Zahl gilt deshalb nur noch, wo unsere Zählung Netflix' ist
(`rechnetInNetflixStaffeln()`: gespeicherte Anbieter-Staffeln oder `laut: anbieter-gerechnet`).
Sonst geht eine unklare Meldung ohne Staffel und ohne `titelId` hinaus.

Das Ende des Durchgangs steht im Kasten („Durchgang fertig · übersprungen: …"), nicht nur in der
Konsole — Daniel hielt das stille Ende für ein Hängen.

**Nachtrag 4.21.9 (24.09.2026), drei Lehren aus dem JoJo-Durchgang:**

- **Ein umbenannter Parameter trifft eine gleichnamige Konstante.** `netflixStaffelWaehlen(nr)`
  wurde zu `(ziel)`, im Rumpf stand schon `const ziel = eintraege.find(…)`. Der Vergleich im
  Rückruf griff auf die Konstante vor ihrer Belegung zu, jeder Wechsel warf `Cannot access 'ziel'
  before initialization`. Der Takt schluckte den Fehler (`.catch(() => {})`), `selbstVersucht`
  blieb gesetzt, und die Automatik stand still, das Menü offen. Seitdem endet ein Fehler im
  Durchgang sichtbar (`vielleichtSelbstStarten` als Hülle um `selbstStartenSchritt`, Spur
  „Fehler", Kasten „Durchgang abgebrochen"), und `durchgang-fremde-liste.test.cjs` führt die Wahl
  mit Daniels echten Menüeinträgen aus.
- **Der Zuordner liest `staffel` in Netflix' Zählung, sobald die Meldung Netflix' Staffelliste
  trägt** (`ordneMeldungZu`: `anbieter.seq === meldung.staffel`). Bei Titeln, deren Folgen nur
  Nummern als Titel haben, ist das der einzige Weg (Daniel). Bei unklarer eigener Staffel geht
  deshalb Netflix' Zahl mit — nur zusammen mit der Liste (`netflixStaffelFuerZuordner`), ohne
  `titelId`.
- **Der Staffelname aus dem Menü geht mit jeder Meldung hinaus** — in der Notiz („— Netflix:
  Golden Wind") und als `staffelText`. Dabei gemessen: Die Notiz der Einzelmeldung lautete
  „Folge 3 — Titel", und `folgentitelAusNotiz()` liest nur „Folge 3: Titel" — der Anker hat
  Einzelmeldungen nie erkannt, nur Randproben. Das Format ist jetzt dasselbe.
- Lokales Abhaken ohne Staffel rät nur noch bei durchgezählten Reihen (`merkeErledigt`); bei JoJo
  hakte es sonst Folgen in Staffel 1 und „Diamond Is Unbreakable" ab.

## „Alle Folgen anzeigen" lädt jede Staffel einzeln nach — das Menü bleibt vorerst (24.09.2026)

Gemessen mit dem Abrufverlauf aus 4.21.10 an JoJo: Die Ansicht „Alle Folgen anzeigen" lädt jede
Netflix-Staffel über dieselbe `data.videos`-Abfrage wie das Menü, nur alle auf einmal, je
Staffel mit eigener Kennung. Nachgeladen wird beim Scrollen: Beim ersten Versuch kamen
Diamond Is Unbreakable und Stone Ocean mit 30 Folgen an, beim zweiten mit langsamem Scrollen alle
fünf vollständig (26, 48, 39, 39, 38). **Die 30er-Schnitte lagen am Scrollen, nicht an Netflix**
— meine erste Deutung „bricht bei 30 ab" war falsch und stand kurz so in dieser Datei. Andere
Antworten mit Folgen waren nur Empfehlungsleisten (`unifiedEntities`, `playbackEntities`).

Folge für den Durchgang: Die Ansicht liefert alles auf einer Seite, braucht aber vollständiges
Nachladen je Staffel und einen Durchgang über Gruppen statt über die angezeigte Staffel
(`angezeigteFolgenSetzen` wählt heute die sichtbarste Gruppe). Der Menüweg läuft seit 4.21.9;
die Ansicht wird erst gebaut, wenn der Menüweg wieder Probleme macht.

**Und die Staffelzahl hat zwei Zählungen.** Sobald ein Titel einmal gemeldet wurde, liegt
Netflix' Staffelliste in `anbieterStaffeln`, und `staffelnDerGruppe` rechnet in Netflix-Staffeln.
Die Prüfliste rechnet in unseren, solange sie nicht `anbieter-gerechnet` ist. `titelIdFuer()`
übersetzte die Netflix-Zahl über unsere Liste: Stardust Crusaders (Netflix-Staffel 2, 48 Folgen)
bekam die `titelId` unserer Staffel 2, die Folgen 40–48 gehören zu „Battle in Egypt". In diesem
Fall gibt es jetzt keine `titelId` mehr, der Zuordner entscheidet über den Folgentitel.

## Erst alles laden, dann Staffel für Staffel — ohne Menüwechsel (4.22.0, 24.09.2026)

Der Abschlusstest mit 4.21.12 (zehn Titel) lief, war aber langsam und zeigte drei Fehler, die
alle am Staffelwechsel im Menü hingen: JJK wählte „Staffel 2" zweimal und blieb stehen, Kuroko
prüfte die angezeigte Netflix-Staffel 3 statt der offenen Staffel 1, Shaman King startete mit 30
von 52 Folgen und prüfte deshalb Folge für Folge statt erste und letzte.

**Die Ursache der 30er-Schnitte lag im Leser, nicht bei Netflix:** `folgenNachladen()` nahm als
Position `folgenliste.size` — alle geladenen Folgen der Seite, nicht die der Staffel — und ein
Riegel `laedtNach` übersprang jede zweite Staffel, solange die erste noch nachlud. Jetzt: eine
Warteschlange je Staffel, gezählt über `folgenDerStaffel(seasonId)`.

**Der Durchgang (Daniels Vorschlag):** Hat eine Reihe mehrere Staffeln, wählt `selbstSammeln()`
einmal „Alle Folgen anzeigen" und scrollt je Takt ans Seitenende, bis so viele Staffeln geladen
sind wie im Menü, der Leser nichts mehr nachlädt (`leserLaedtNach`, aus dem Abrufverlauf) und die
Liste drei Sekunden ruht; nach 40 Sekunden geht es mit dem weiter, was da ist (Spur
„gesammelt"). Danach prüft `selbstStartenSchritt()` jede Staffel mit offenen Folgen über
`DURCHLAUF.folgen = gruppe` — die Leser-Liste bleibt über die Player-Besuche hinweg erhalten, das
Menü wird nicht mehr angefasst. Die Menü-Logik (`menueSchluessel`, `naechsteOffeneNetflixStaffel`,
Wechsel-Warten) ist entfernt.

**Nachtrag 4.22.2 (24.09.2026): „Offen" entscheiden die Folgenkennungen, nicht die Zuordnung.**
Im Test mit 4.22.1 blieben zwei offene Staffeln ungeprüft. Meine ganz besondere Hochzeit: Netflix'
Staffel 1 hat 13 Folgen (mit Sonderfolge), unsere 12 — die Folgenzahl ordnete sie unserer belegten
Staffel 2 (13) zu. Kuroko: drei Staffeln zu je 25. `gruppeOffen()` fragt deshalb nur noch, ob jede
Folge der Netflix-Staffel eine Meldung hat (bei einer Wiedervorlage: seit deren `seit`); der
Durchlauf prüft eine so gewählte Gruppe erzwungen (erste + letzte). Kehrseite, bewusst: Hat ein
Titel eine Wiedervorlage, werden auch seine belegten Netflix-Staffeln neu gemeldet — das ist
Daniels Ziel („sowieso das ziel alles zu melden"), und pro Staffel kostet es rund fünf Sekunden.
Der Staffelname in der Meldung kommt aus dem Menüeintrag mit passender Folgenzahl
(`gruppenLabel()`), nicht aus der Anzeige.


## Randprobe in Stapeln zu zehn (25.09.2026, 4.22.4)

`POST /pruefung` nimmt `{ stapel: [...] }` mit höchstens 10 Meldungen an. Jede läuft durch denselben Handler wie eine Einzelmeldung, die Antwort ist `{ ok, ergebnisse: [{ ok, befund }] }` in derselben Reihenfolge. Die Grenze ist eine Größengrenze. Das in der Cloudflare-Doku genannte Limit von 50 D1-Abfragen je Aufruf (kostenloser Plan, jede `batch`-Anweisung einzeln) greift hier nachweislich nicht: Eine Prime-Meldung vom 19.09.2026 schrieb 90 Rohfolgen in einem Aufruf, also rund 93 Anweisungen. Zuerst hatte ich die Grenze aus der Doku abgeleitet und nicht gemessen; der Blick in `prime_folge` hat das widerlegt. Ein `INSERT … ON CONFLICT` (2 statt 4 Anweisungen) lohnt deshalb nicht: Größere Stapel bringen kaum etwas, und es bräuchte einen Ausdrucksindex samt Bereinigung der vorhandenen Dubletten. Eine Netflix-Meldung mit Rohfolge braucht 4: `DELETE` und `INSERT` in `pruefung`, dazu `DELETE` und `INSERT` in `prime_folge`. Gemessen am 25.09.2026 an einer Testadresse, die danach gelöscht wurde: 10 Meldungen einzeln nacheinander 1.740 ms, als Stapel 371 ms, ein 11er-Stapel ergibt 400. `randMelden` schickt seine Stapel gleichzeitig ab. `durchlaufMelden` meldet weiter einzeln, weil dort je Folge gemessen wird.
