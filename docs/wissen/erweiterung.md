# Browser-Erweiterung (Amazon, Netflix, Disney+, ADN)

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
`daniel-zum-abarbeiten/listen/17-vorfaelle.md` ab — dort, wo der nächste Durchgang sie
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

Seit 20.10.2026 arbeitet das Skript beim Einreichen in einem eigenen Arbeitsbaum `C:/code/_worktrees/<repo>/erneut-melden-<Stempel>` auf `origin/main` (`tools/erneut-melden-worktree.mjs`): Zweig, Commit, Push und PR entstehen dort, der Hauptordner (Hook `hauptordner-sperre.js`) bleibt unberührt, der Arbeitsbaum wird beim Beenden (auch bei Abbruch) abgeräumt. `--ohne-push` und `--pruefen` arbeiten wie bisher im aktuellen Ordner.

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

## Prime-Durchgang: Staffelseiten statt Player (25.09.2026, 4.22.7)

„▶ alle durchgehen" gibt es seit 4.22.7 auch in der Prime-Prüfliste. Prime braucht dafür keinen Player: Die Tonspuren stehen auf der Staffelseite, und der Meldeknopf liest sie selbst. Der Durchgang (`primeSchritt()` in `amazon.js`) klickt den Meldeknopf, sobald er „… melden" anbietet und die Beschriftung 2,5 s stillsteht. Danach lädt er die nächste Staffel als eigene Seite.

Die Staffeln stammen aus `seasons` im Quelltext. Gemessen am 25.09.2026 an Naruto (B07VP6VPVR, öffentliche Seite, ein Abruf): neun Einträge, `seasonId` ist die ASIN der Staffelseite, `seasonLink` ist `/gp/video/detail/<ASIN>?ref_=atv_dp_season_select_sN`. Der Leser gibt sie als `gesehen.seite.staffeln[].kennung` weiter. Auf Staffelseiten, die nicht selbst auf der Liste stehen, erscheint der Knopf über `serieBekannt()`.

Suchaufträge überspringt der Durchgang (seit 31.10.2026 nicht mehr, siehe „Durchgang durch Suchaufträge“); welcher Treffer gemeint ist, entscheidet Daniel. Hängt eine Seite eine Minute, wird sie übersprungen. Das Ende steht im Dialog, der Verlauf im Bericht unter `durchgang`. Zwei Fallen, beide im Sandkasten gefunden (`amazon-durchgang.test.cjs`):

- Nach `location.href = …` läuft der Takt auf der alten Seite weiter, bis der Browser sie verlässt. Ohne Sperre (`primeVerlassen`) sprang der Durchgang zweimal und ließ eine Staffel aus.
- Die Amazon-Sandkästen stellen die Uhr je `setInterval` um 500 ms vor. Ein zusätzliches Intervall ließ in `amazon-uebersicht.test.cjs` die Zeit doppelt so schnell laufen. Der Durchgang taktet deshalb über eine `setTimeout`-Kette.


**Gemessen am ersten echten Lauf (25.09.2026, 4.22.8):** rund 10 s je Staffel, abgelesen an `gemeldet_am` im Briefkasten (Naruto S1–S8 von 15:18:17 bis 15:19:53, danach 45 Bände eines Titels zu je etwa 10 s). Etwa die Hälfte davon waren Wartezeiten des Durchgangs selbst: 2,5 s Ruhe vor dem Klick, 1,2 s bis zum Neuzeichnen, 2,5 s Ruhe danach. Seit 4.22.9 meldet der Meldehandler sein Ergebnis in `letzteMeldung` (Pfad, ok, Zeit), und der Durchgang geht weiter, sobald es da ist. Die Ruhe vor dem Klick beträgt 1 s, der Takt 500 ms. Aufgefallen im selben Lauf: Bände tragen `staffel` 201, 1001 usw. (Amazons `sequenceNumber` als Sortierschlüssel, siehe `staffelAusSeite()`); ob der Zuordner sie über die Rohfolgen richtig legt, zeigt der nächste Bestandslauf.

**Nächster Hebel, gemessen, nicht gebaut (25.09.2026):** Der Rest der 5 s je Staffel ist das Laden der Seite. Die Staffelseite trägt die Tonspuren je Folge schon im Quelltext, auch ohne Anmeldung (Naruto S1, B0CWDYLZ1S, ein Abruf: 19 von 20 Folgen mit `audioTracks`, die zwanzigste kommt über das Nachladen der Folgenabschnitte). Ein Durchgang könnte die Staffelseiten also im Hintergrund abrufen und mit dem Parser aus `amazon-leser.js` lesen, ohne zu navigieren. Offen ist ein PoC: Stimmen die im Hintergrund gelesenen Befunde mit den Meldungen des Knopfs überein, auch bei Bänden (seq 201) und Staffeln über einen Abschnitt hinaus?

**Aufschlüsselung aus der Spur desselben Laufs (Bericht 15:37, letzte 12 Seiten):** Seitenaufruf bis Klick 5,6–10,3 s, bei 40–52 Folgen stets rund 10 s (Amazon lädt die Folgen abschnittsweise nach); Klick bis Weitergehen jedes Mal 4,0 s, davon 3,7 s eigene Wartezeit, die 4.22.9 streicht. Der Knopf selbst zeigte dabei „Staffel 1204", „Staffel 101": Die Nummer kommt bei Bänden aus dem Sortierschlüssel.

**PoC „Staffel im Hintergrund lesen" (25.09.2026, `tools/prime-hintergrund-poc.mjs`):** 31 der 102 Staffelseiten aus Daniels Lauf, ausgewählt nach Grenzfällen (gesperrte Naruto-Staffel 4, Bände mit `seasonNumber` 201/1001 als Sortierschlüssel, Yu-Gi-Oh! mit 40–52 Folgen, Staffeln am Abschnittsrand). Abgerufen ohne Anmeldung, nur `/gp/video/detail` (robots.txt erlaubt; `/gp/video/api` für weitere Abschnitte ist im `*`-Block gesperrt), gelesen mit `ausHydration` aus `amazon-leser.js`, verglichen mit `prime_folge` des Laufs. Zweimal gefahren, keine Sperre.

- **Ton je Folge: 31 von 31 Seiten gleich**, keine einzige abweichende Folge.
- **Folgen: Der Quelltext trägt höchstens 24.** 20 Seiten vollständig, 11 Staffeln mit mehr als 24 Folgen nicht (Rest liegt im zweiten Abschnitt).
- **Signal für „unvollständig": `episodePages` mit mehr als einem Abschnitt (`tokensAus`) trennt 31 von 31 richtig.** `episodeCount` taugt nicht: Naruto S1 nennt 20, hat 19 (der Knopf meldete ebenfalls 19).
- Folgerung: Staffeln mit einem Abschnitt im Hintergrund lesen, größere wie bisher öffnen. Im Lauf vom 25.09. wären das rund 88 von 102 Seiten ohne Navigation gewesen.

## Disney+: abgebrochenes Nachladen hieß „vollständig" (25.09.2026, 4.22.10)

Daniel sah in `chrome://extensions` viermal „Nachladen abgebrochen: TypeError: Failed to fetch" (`disney-leser.js`, `allesHolen`). Im Briefkasten standen danach Naruto Shippuden mit 112 von rund 500 und Yu-Gi-Oh! mit 144 von rund 224 Folgen, One Piece mit 405. `allesHolen()` rief im `finally` immer `melde(true)`, und ein HTTP-Fehler stieg in `staffelHolen()` still mit `return` aus; der Knopf meldete den Ausschnitt dann wie die ganze Staffel. Seit 4.22.10 wiederholt `mitWiederholung()` jeden Abruf dreimal (1, 3, 8 s); scheitert er endgültig, meldet der Leser ein Hindernis mit der Zahl der gesammelten Folgen statt „vollständig". Die Ursache der Abbrüche selbst ist nicht gemessen; der Test `disney-nachladen.test.cjs` spielt beide Fälle nach (vorübergehend, endgültig, HTTP 429).

## Prime-Durchgang in Frames statt per Navigation (25.09.2026, 4.23.0)

Nach dem PoC oben stand der Plan, den Aufbau der Meldung aus dem Klick-Handler zu lösen und Staffeln per Abruf zu lesen. Beim Lesen des Handlers zeigte sich der Preis: Die Meldung entsteht aus zehn Hilfsfunktionen, die alle aus der geöffneten Seite lesen (`gesehen`, `seitenHtml()`, `document.body.innerText`); ein Abrufweg hätte davon eine zweite Fassung gebraucht. Gemessen am selben Tag: Die Staffelseite sendet `x-frame-options: SAMEORIGIN`, lässt sich also in einem Frame von `www.amazon.de` laden. Darin läuft dieselbe Erweiterung mit demselben Knopf.

Seit 4.23.0 steuert die sichtbare Seite nur noch (`primeKoordinieren()`): Der erste Frame eines Titels liefert die Staffelliste, danach laufen bis zu drei Frames gleichzeitig. Im Frame wartet `frameSchritt()` auf den Knopf, klickt und schickt das Ergebnis per `postMessage` zurück. Das Manifest lädt Leser und Melder mit `all_frames`; beide steigen in fremden Frames sofort aus (`window.name !== 'ak-durchgang'`), weil Amazon auch Werbung in Frames einbettet. Staffeln über 24 Folgen lädt der Leser im Frame nach wie auf einer geöffneten Seite. Der Navigationscode (`primeSeiteFertig`, `primeGehe`) ist entfernt.

Zwei Fallen beim Einbau, beide in `npm run check:extension` gefunden:

- Die älteren Amazon-Sandkästen kennen kein `window.top`; `window !== window.top` galt dort als Frame. Deshalb prüft die Sperre zuerst, ob `window.top` existiert.
- Dieselben Sandkästen merken sich genau einen `message`-Hörer. Ein zweiter für die Frame-Antworten verdrängte den des Lesers (`amazon-kill-blue.test.cjs`). Die Frame-Antwort läuft jetzt über den bestehenden Hörer.

Offen bis zum ersten echten Lauf: wie schnell drei Frames wirklich sind, und ob Chrome die Frames drosselt, wenn der Tab länger als fünf Minuten im Hintergrund liegt (intensive Timer-Drosselung).

**Erster echter Lauf, 26.09.2026 (Diagnosebericht 07:57):** vier Titel (Monster, Fullmetal Alchemist: Brotherhood, Hunter × Hunter, Shaman King), 21 Seiten, alle „gemeldet“, 07:46:39–07:48:20 UTC — **101 s, knapp 5 s je Seite**, bei drei Frames gleichzeitig. Daniel hatte den Tab dabei im Hintergrund; gedrosselt hat Chrome in diesen zwei Minuten nicht spürbar. Alle vier Adressen standen danach im Briefkasten (`?zaehlen=1`, Feld `gemeldet`).

Trotzdem hielt Daniel den Lauf für hängend, aus zwei Gründen, die beide an der sichtbaren Seite lagen: Der Knopf zeigte die ganze Zeit „⏹ Durchgang läuft · 4 offen“ (die Frames melden in eigenen Dokumenten, die Zahl bewegte sich nie), und nach dem Ende stand an jedem Titel „nur auf diesem Rechner“, weil die Seite den Briefkasten vom Start behielt. Seit 4.23.1 steht am Knopf „⏹ Titel n/m · k Seiten gemeldet“, neu gezeichnet nach jeder Seite, und das Ende holt den Briefkasten erzwungen neu. **Merksatz:** Wer Arbeit in unsichtbare Frames verlegt, muss ihren Fortschritt auf der sichtbaren Seite zeigen — sonst sieht ein laufender Automat aus wie ein stehender.


## Eine laufende Synchro kommt wöchentlich zurück auf die Prüfliste (26.09.2026, 4.23.2)

Ein Handbeleg „Folge 1–2 deutsch, 3–13 nicht" hat ein Urteil, also fiel der Titel aus der
Prüfliste — und eine Synchro, die wöchentlich erscheint, blieb auf dem Stand dieses einen Tages
stehen. Snowball Earth stand bei Disney+ vom 20.09. an auf 1–2; Daniel sah am 26.09. von selbst
nach: deutsch bis Folge 6. Gemessen am selben Tag steckten vier weitere so fest, am längsten
Kill Blue bei Prime (seit 25.08. „bis Folge 4").

Seitdem legt `laufendeSynchro()` in `tools/verdacht.mjs` jeden jüngsten Beleg erneut vor, der
**vorne deutsch und hinten nicht** ist, sieben Tage nach seinem `checkedAt`. Jede neue Meldung
schiebt die Frist, eine komplette Synchro (letzter Bereich deutsch) beendet sie. Ausgenommen:
japanisches Ende über ein Jahr her — dort ist eine halbe Synchro ein Endzustand. Test:
`tools/verdacht-laufend.test.mjs` in `check:workflows` (über `tools/tests-alle.mjs`).

**Disney+ kannte Wiedervorlagen gar nicht.** `disney.js` zählte jede Meldung aller Zeiten: Eine
wieder vorgelegte Seite zeigte „✓ gemeldet", die Liste „alles gemeldet". Jetzt trägt der
Listeneintrag `seit`, und nur Meldungen ab diesem Tag zählen (`gemeldeteHolen(url, seit)`,
`istErledigt`). Netflix (`zustand: 'erneut'`) und Prime (`?stand=1` des Workers) konnten das
schon.

**Nachtrag 26.09.2026 (4.23.3): Frame-Meldungen brauchen die Überbrückung der sichtbaren Seite.**
Seit dem 24.09.2026 verwirft der Worker `?stand=1` bei einer Meldung nicht mehr, er läuft nach
60 s ab (Lesekontingent). Die Seite überbrückt das mit `frischGemeldet` — aber nur für Meldungen,
die sie selbst abschickt. Die Frames des Prime-Durchgangs melden in eigenen Dokumenten; ihr Titel
blieb deshalb bis zu einer Minute offen, und der Durchgang endete mit „Durchgang fertig“ neben
„1 Prime-Titel zu prüfen“ (Trapped in a Dating Sim S2, Bericht 11:29). Jetzt trägt
`primeFrameErgebnis()` jede erfolgreiche Seite in `frischGemeldet` ein. **Merksatz:** Wer eine
Invalidierung durch eine Frist ersetzt, muss jeden Schreiber an die Überbrückung hängen, nicht nur
den, der gerade vor Augen ist.

## Prime-Seiten ohne Titel bekommen ihren Kasten in der Warteschleife (26.09.2026, 4.23.4)

Auf der Prime-Startseite (`/gp/video/storefront`) war keine Erweiterung zu sehen. Der
Diagnosebericht (über die Konsole, `document.dispatchEvent(new CustomEvent('ak-report'))`) zeigte
`imPlayer: false`, `seiteGehtUnsAn: true` — und „Cannot access 'knopf' before initialization":
Das Skript wartet auf Seiten ohne Kennung in `if (!id) { … await … }` auf einen Titel, und der
Takt, der den Kasten baut, läuft erst danach. Die Warteschleife hängte den Prüflisten-Knopf nur in
einen **vorhandenen** Kasten — den es nur auf Suchseiten gab. Jetzt baut sie ihn selbst
(`ak-nur-huelle`), sobald `seiteGehtUnsAn()` gilt und kein Player läuft.

`tools/amazon-startseite-pruefen.cjs` fuhr die Startseite seit Wochen mit und schrieb
„Kasten: FEHLT", ohne rot zu werden — eine Ausgabe ohne Riegel. Der Riegel steht jetzt für jede
`/gp/video/`-Adresse. Der Bericht trägt seitdem auch `sichtbarkeit` (Player-Container, Videos mit
Stummschaltung und Höhe), damit die nächste unsichtbare Erweiterung nicht geraten werden muss.

## „▶ alle durchgehen" für Disney+ (4.24.0, 27.09.2026)

`extension/disney-durchgang.js`, eigene Datei (disney.js lag schon über 800 Zeilen). Disney+ prüft
auf der Titelseite ohnehin alle Folgen ohne Player; der Durchgang navigiert die **sichtbare** Seite
von Titel zu Titel (keine Frames wie bei Prime — Einzelseiten-App mit Anmeldung), wartet auf
`ak-disney-geprueft` ({ url, zuMelden, fehler }), meldet über dieselbe Funktion wie der Klick und geht
nach `ak-disney-gemeldet` ({ ok }) weiter. Lauf im `sessionStorage`, zwei Stunden höchstens; ein Titel
ohne Ergebnis nach drei Minuten (Umleitung, Fehlerseite) wird übersprungen und am Ende genannt —
„nicht da" bleibt Handarbeit. Knopf im Listen-Dialog neben der Überschrift. `disney.js` stellt dafür
`globalThis.AK_DISNEY` bereit (offene Titel, melden, Ziel merken, Ende anzeigen). Sandkasten-Test:
`extension/disney-durchgang.test.cjs`. Am echten Disney+ noch nicht gelaufen (braucht Daniels Anmeldung).

### Drei Melder-Fehler (4.24.12, 08.10.2026)

- **Beantwortete Seiten haben einen Melder.** `offene-disney.js` führt alle Disney+-Adressen, beantwortete mit
  lauter `offen: false` (vorher fehlten sie, auf Naruto Shippuden entstand gar kein Melder). Prüfliste und
  Durchgang zählen nur Einträge mit offener Staffel (`offeneEintraege`), ebenso `pruefstand.mjs` und
  `report-start.ts`. Die Liste wuchs von 1,3 auf 10,9 KB.
- **Gemeldet bleibt erledigt:** `briefkastenHolen` liest zusätzlich das Worker-Feld `gemeldet`
  (auch Übernommenes seit dem Prüfstand); `istErledigt` prüft beides.
- **Die Endanzeige des Durchgangs nennt den Grund** je übersprungenem Titel (`akDisneyEndeText`).
- Tests: `disney.test.cjs` (Liste, Naruto 53/59/54, `gemeldet`, Endtext).

### Der Weg ohne Klick trägt über die Adresse (28.09.2026)

Die offene Frage aus dem 19.09. lautete: Erkennt die Erweiterung eine Amazon-Seite, die
**nicht** über die Prüfliste geöffnet wurde? Der Verdacht: JustWatch verlinkt über
`watch.amazon.de/detail?gti=…`, und dort steht eine **andere** gti als in der Kopfzeile der
Zielseite — also greift der Auftragsmerker nicht.

Daniel hat es an Air Gear gemessen (JustWatch-Seite, Prime-Angebot, „Bericht laden" im
Amazon-Kasten). Der Bericht
(`anime-kalender-diagnose-2026-09-28T12-08-13-957Z.json`, Version 4.24.2) sagt:

- Adresse: `amazon.de/gp/video/detail/0L8OEXAMVVVVJF4LJA0B8D1BIP?ref_=atv_dl_rdr` — das ist
  **unsere** Adresse für den Titel.
- `zustand.eintrag.titel: null` — der Auftrag fehlt, wie erwartet.
- `seiteGehtUnsAn: true`, `letzteKennung: "…0L8OEXAM…|Air Gear"`, `zaehlstand` mit allen
  **26 Folgen** (je „Deutsch, 日本語").

**Die Erkennung läuft also über die Adresse, nicht über die gti.** Und JustWatchs gti steht
im Quelltext der Seite — `amzn1.dv.gti.4825705e-aa8e-4aee-95d3-82f94649bb23`, Position **25 von
37**; die Kopf-gti ist `66c97aeb…` (Position 0). Die Idee „alle gtis des Hydration-Blocks gegen
die Prüfliste halten" ist damit machbar, aber für diesen Weg nicht nötig.

**Was daraus folgt:** Der „Weg ohne Klick" braucht keinen Umbau. Bleibt die Frage offen, wenn
eine Seite über eine **fremde** Adresse erreicht wird (anderer Anbieter-Link, andere Ausgabe) —
dann ist die gti-Liste der nächste Griff, und die Messung ist dafür die Grundlage.

### Nachtrag 4.24.3 (28.09.2026): Der Durchgangs-Zustand steht oben

Auf der Prime-Startseite meldete Chrome `Uncaught ReferenceError: Cannot access 'primeFrames'
before initialization` (`amazon.js`, `primeKoordinieren`). Ursache war kein Logikfehler, sondern
die **Reihenfolge**: Die Werte des Durchgangs (`PRIME_*`, `IM_FRAME`, `primeFrames`) standen als
`const` erst kurz vor ihren Funktionen — und der `message`-Hörer (Zeile 6783), der die Antworten
der unsichtbaren Frames entgegennimmt, liest `IM_FRAME` und `primeFrames`. Trifft so eine
Nachricht ein, bevor die `const`-Zeile an der Reihe war, liegt der Wert in der „temporal dead
zone": Der Aufbau bricht ab, der Kasten zeichnet halb, und **„▶ alle durchgehen" tut nichts** —
genau das, was Daniel sah („nichts passiert"); auf einer Titelseite ging es, weil dort der
Zustand längst angelegt war.

Die Werte stehen jetzt oben bei den übrigen Zustandswerten des Moduls. Der Sandkasten der
Erweiterung stellt den Block vorne an, und `amazon-durchgang.test.cjs` hält die Reihenfolge mit
einer Zusicherung fest („der Zustand steht vor dem message-Hörer") — sonst wandert er beim
nächsten Umbau zurück und der Fehler kommt wieder.

### Nachtrag 4.24.2 (28.09.2026): Die Staffelnummer der Seite ist nicht unsere

Disney+ führt „Mission: Yozakura Family" als Staffel 1 (27 Folgen, kein Deutsch) und Staffel 2
(12 Folgen, deutsch); unser Bestand kennt an dieser Adresse nur die zweite, und die Prüfliste
zählt ihre Staffeln als Positionsindex über `titles.json` — also als `nr: 1`. `titelIdFuer()`
buchte deshalb die 27 Folgen der ersten Staffel auf 182578 (Kennungen 8405–8431, verworfen),
während die richtigen zwölf mit `titel_id: null` ankamen. Jetzt zählt die Folgenzahl der Seite
mit (`folgenDerSeite()` aus der Staffelliste des Lesers, Platz 1 = Staffel 1): Sie widerlegt
eine Nummer, die nicht passt, und belegt eine fehlende — aber nur, wenn sie auf beiden Seiten
genau einmal vorkommt; sonst bleibt die Kennung leer, und `fetch-rohfolgen.ts` entscheidet über
Folgentitel und Erstausstrahlung. Ohne Staffelliste der Seite gilt die Nummer allein wie bisher.
`extension/disney-staffeln.test.cjs`.

Zugleich die Adresse: Der Verweis unseres Bestands (`…/entity-ac689bea-…`) leitet auf die
Startseite, die Serie steht unter `…/entity-0113d236-…`. Ein Handbeleg in
`data/dub-confirmed.yaml` nennt sie und belegt dort den deutschen Ton von Staffel 2 —
`09-2-linkpruefung.ts` schreibt die Adresse eines Belegs in den Verweis, die tote fällt damit weg.

### Nachtrag 4.24.1 (28.09.2026): Der Zielmerker galt jeder Seite

Im ersten echten Durchgang leitete Disney+ „Mission: Yozakura Family Season 2" auf die Startseite um
(Dialog „Je nach Standort …"); Daniel öffnete daraufhin von Hand einen anderen Titel, und dessen 25
Folgen wurden unter Yozakura gemeldet (Kennungen 8299–8323, verworfen). Ursache: `letztesZiel()`
galt zehn Minuten für **jede** Seite — ein Fehler, den es schon vor dem Durchgang gab, nur ohne
automatisches Melden. Jetzt `zielFuer()`: eigene Adresse, dazu die erste andere Adresse in 20 s
(Umleitung); nach einer Seite ohne Kennung oder später verbraucht (`disney-ziel.test.cjs`). Der
Durchgang überspringt die Startseite nach 10 s und endet „von Hand übernommen", sobald eine andere
Titelseite offen ist, statt nach drei Minuten weiterzuspringen.

### Nachtrag 4.24.5 (29.09.2026): Der Serientitel kam von der vorigen Seite

Die 25 Netflix-Meldungen auf `netflix.com/title/81788312` („The Dangers in My Heart", F1–F25) trugen
alle den Serientitel **„Shangri-La Frontier"** — von der zuletzt **gespielten** Seite derselben
Sitzung. Auf einer Titelseite entscheidet die Adresse, welche Reihe gemeint ist (`gemeinteReihe()`),
der Leser schickt dort aber weiter die Spuren der vorigen Seite: `stand.serientitel` und
`stand.staffeln` gehörten zu einer anderen Reihe. Die Zuordnung lief ohnehin über die Adresse,
falsch war nur das gespeicherte `titel`-Feld (Anzeige, Diagnose) — und mit ihm die Staffelstruktur.

Neu prüfen beide Meldestellen (Durchgang und Randprobe) inline, ob `stand.reihe` die gemeinte Reihe
ist: Nur dann werden `serientitel`, `staffeln` und `roh.reihe` übernommen — sonst leer statt falsch.
Der Riegel steht inline statt in einem Helfer, weil `melder.js` sonst über die Codegestalt-Grenze
wächst; `netflix-titel-fremde-seite.test.cjs` prüft seinen Wortlaut.

### Nachtrag 4.24.6 (29.09.2026): Ein Film fiel durch den Durchgang

Daniel ließ auf Netflix „▶ alle durchgehen" laufen und lud den Bericht. Die Spur zeigte für
„Chihiros Reise ins Zauberland" (Netflix 60023642): `gesammelt staffeln: []`, dann „Titel fertig,
gemeldet: 0" — der Durchgang tat auf der Filmseite **gar nichts** und hakte den Titel trotzdem ab.
Der Knopf daneben („▶ 1 Folge prüfen") konnte ihn die ganze Zeit.

Ursache: Der Durchgang gruppiert über `DURCHLAUF.alleFolgen` — die vom Leser gesammelten
**Serienfolgen**. Ein Film hat keine Staffelliste; der Leser legt ihn nur in `DURCHLAUF.folgen`.
Jetzt fällt der Durchgang auf `DURCHLAUF.folgen` zurück, wenn `alleFolgen` leer ist und dort genau
ein Film steht. `netflix-film-durchgang.test.cjs`.

**Noch offen (derselbe Bericht):** Die übrigen Titel wurden nur **teilweise** gemeldet (My Hero
Academia 25, The Dangers in My Heart 12), und der Durchgang hakte sie trotzdem als „fertig" ab —
weil eine Staffel ohne neue Meldung als geprüft gilt und die lokale Abhakliste dem Bestand
vorausläuft. Das ist der nächste Schritt.

### Nachtrag 4.24.7 (29.09.2026): Fertig heißt „nicht mehr auf der Prüfliste"

Daniels zweiter Netflix-Bericht: Der Durchgang lief über Chihiro, My Hero Academia und The Dangers
in My Heart, meldete MHA „25" und Dangers „12" — den **lokalen Abhakstand**, nicht das Ergebnis —
und hakte alle drei ab. Danach stand `durchgang.laeuft: false`, obwohl zwei Titel offen blieben.

Zwei Riegel:
- **Eine Wiedervorlage wird abgearbeitet.** `gruppeOffen()` verglich je Folge mit
  `MELDUNGEN`/`DURCHLAUF.gemeldet` und hielt MHA/Dangers damit für erledigt; jetzt gilt eine
  Wiedervorlage (`zustand: 'erneut'`) als offen und läuft.
- **Fertig kommt aus der Prüfliste.** Vor dem Abhaken holt der Durchgang `?stand` (`standHolen()`)
  und prüft `fertig()`. Bleibt der Titel offen, bekommt er einen zweiten Anlauf; danach wird er
  übersprungen und der Versuch mitgezählt (`selbstVersuche`, `SELBST_VERSUCHE`). So gibt es weder
  ein vorzeitiges „fertig" noch eine Schleife. `netflix-durchgang-fertig.test.cjs`.

**Weiter offen:** Chihiros Film-Lauf startet (4.24.6) und meldet trotzdem **0** —
`durchlaufStarten` kommt auf der Filmseite zu keiner Meldung. Dafür braucht es einen Bericht, der
**auf der Chihiro-Seite** gezogen wird (die `leser`-Felder des vorliegenden Berichts gehören zur
Dangers-Seite).

### Nachtrag 4.24.9 (30.09.2026): Eine Staffel läuft nicht zweimal

Daniels Durchgangsbericht zeigte jede Staffel **zweimal**: erst meldend, dann leer. Ursache war der
Riegel „Ein Lauf ohne neue Meldung macht die Staffel fertig" — eine Staffel, die etwas meldete, galt
damit **nicht** als geprüft und lief im nächsten Takt noch einmal. Das kostete eine doppelte
Wiedergabe und ließ den Zähler überlaufen („18/14": 14 Prüfungen geplant, die Wiederholungen kamen
dazu). Jetzt ist jede Staffel nach einem Lauf durch; bleibt der **Titel** laut Prüfliste offen,
greift der zweite Anlauf über `selbstVersuche` (4.24.7). `netflix-durchgang-fertig.test.cjs`.

### Nachtrag 4.24.8 (29.09.2026): Bericht und Ruhemodus stehen immer im Kasten

Daniel: „wo ist bericht laden button?" — Auf einem Titel, den die Erweiterung als „✓ fertig" führt,
fehlte die Debug-Leiste. `netflixDebugZeile()` hing an der Melde-Leiste des Durchlaufs, und die
entsteht nur, wenn es etwas zu melden gibt. Beim Film-Lauf (Chihiro) brauchte er den Bericht aber
gerade auf dieser Seite. Die Zeile wird jetzt mit dem Übersichtsknopf gezeichnet (`netflixKasten()`)
und ist damit immer da.

## Disney+: frisch Gemeldetes sofort erledigt, Senden mit Wiederholung (4.24.13, 08.10.2026)

**Anzeige „offen" trotz gemeldet.** Shield Hero war um 08:47 gemeldet, die Prüfliste führte ihn um 09:05 weiter als offen. Ursache: `istErledigt` las nur `?zaehlen=1` (Briefkasten + Feld `gemeldet`), und diese Antwort hält der Worker 30 Minuten im Cache (`pruefung.ts`, `ausCache`); 4.24.12 war richtig, nur eine frische Meldung kommt darin noch nicht vor. `?gemeldet=<url>` ist dagegen nicht zwischengespeichert (liest je Aufruf die Zeilen der einen Adresse). `briefkastenHolen` fragt deshalb für jede offene Adresse ohne Wiedervorlage `?gemeldet=` (`AK_DISNEY_NETZ.frischGemeldet` in `disney-netz.js`): höchstens drei gleichzeitig, Gemeldetes bleibt gemerkt, „nichts" wird erst nach zwei Minuten neu erfragt, nach eigener Meldung sofort vermerkt. Maßstab ist wie überall der Prüfstand (`akGemeldetSeit`). Ergebnis: `wartetAufUebernahme` zählt in `istErledigt`; der Zähler „N offen" lässt sie weg, die Zeile heißt „gemeldet, wartet auf Übernahme". Der Durchgang öffnet sie nicht mehr; trifft er einen schon beantworteten Titel doch an, steht er am Ende unter „N schon gemeldet", nicht unter „übersprungen". Ohne Auskunft (Netzfehler) bleibt der Zustand unverändert.

**„Failed to fetch" beim Senden** (Konsole: "4 Meldungen kamen nicht an"). Belegt ist nur die Seite der Erweiterung: fünf gleichzeitige POSTs je Titel, kein zweiter Versuch, keine Rücksicht auf einen Seitenwechsel. Jetzt drei Bahnen, bis zu drei Versuche mit wachsender Pause (Netzfehler, 429, 5xx; andere 4xx sofort endgültig) und `keepalive` (überlebt einen Seitenwechsel). Nach einem Fehler fragt die Erweiterung zuerst `?gemeldet=`: Naruto Shippuden hatte 166 von 166 Folgen im Worker, obwohl 14 als „Failed to fetch“ rot standen — Anfrage angekommen, Antwort nicht. Nur was dort fehlt, gilt als nicht angekommen und bleibt als roter Knopf stehen, ein Klick sendet nur die fehlenden erneut. Offen/ungeklärt: Der Worker setzt `Access-Control-Allow-Origin` in `handlePruefung` auf allen Antworten, aber eine **unbehandelte Ausnahme** (z. B. D1-Kontingent erschöpft, Fehler 1101) antwortet ohne CORS-Kopf und erscheint im Browser genau als „Failed to fetch". Nicht belegt, nicht geändert; wiederholt sich der Fehler trotz Wiederholung, im Worker-Log (`wrangler tail`) nach Ausnahmen zur Sendezeit suchen. Tests: `disney.test.cjs`.

## Disney+: Der Prüfstand entscheidet, ob ein Titel „offen" ist (4.24.14, 08.10.2026)

Auf Naruto Shippuden und Shield Hero stand „▸ … melden", obwohl der Worker beide Meldungen kannte und der Prüfstand sie nicht mehr führt. Ursache: `gemeldeteHolen` zählt nur Meldungen ab `pruefstandAm` (Bleach-Regel, 01.10.2026); die Meldungen lagen vor dem neuen Prüfstand, also galt nichts als gemeldet. Jetzt ist `anbieter[].ziele` der Plattform `disneyplus` aus `?stand=1` die maßgebliche Liste der offenen Adressen (`pruefstand-zeit.js` holt sie einmal je Seite, `akPruefstand`). Fehlt die Kennung der Seite dort, zeigt der Kasten „✓ im Datensatz beantwortet" mit einem kleinen „trotzdem erneut melden"; im passiven Zustand wird weder gesammelt noch je Folge abgefragt (`disney-beantwortet.js`, `klaere`). Der Klick startet den bisherigen Weg. Steht die Kennung in `ziele` (Bleach), bei Netzfehler, ohne Disney+-Liste oder ohne `ziele`-Feld bleibt es beim bisherigen Verhalten. Der Durchgang bekommt das Signal „schon gemeldet" und fasst den Titel nicht an. Grenze: Ein Titel, der neu in der Liste der Erweiterung steht, aber noch nicht im Prüfstand, gälte bis zum nächsten Prüfstand als beantwortet; „trotzdem erneut melden" deckt das ab. Tests: `disney.test.cjs`.

## Disney+: Gesamtnummer bei mehreren Staffeln unter einem Eintrag (4.24.15, 08.10.2026)

Disney+ zählt je Staffel neu (Naruto Shippuden 53/59/54); führt unser Bestand die Serie als **einen** Eintrag (AniList 500 Folgen), legte `ordneMeldungZu()` die Zählungen übereinander (Fg. 1–59). Seit 4.24.15 schickt der Melder je Staffel `gesamt` (Folgen laut Seite) und `davor` (Summe der Vorstaffeln laut Seite, nur wenn jede Vorstaffel „Staffel N" mit passender Nummer heißt und eine Zahl trägt). `pipeline/lib/disney-gesamtnummer.ts` rechnet damit Gesamtnummer = Folge + `davor`, ausschließlich bei Disney+, genau einem Eintrag an der Adresse und Staffel 2 oder später. Unzugeordnet bleibt, was nicht aufgeht: Versatz unbekannt, Summe größer als der Eintrag (+3), Folge hinter dem Ende der Staffel, Eintrag ohne Folgenzahl. Unverändert bleiben Staffel 1, Meldungen ohne `gesamt` (vor 4.24.15), Einträge mit der Länge der Staffel selbst (Yozakura: Staffel 2 = 12) und mehrere Einträge an einer Adresse. Der Versatz kommt aus der Seite, nie aus den gemeldeten Folgen (Teilmeldungen, siehe 4.22.10). Zusicherungen: `npm run check:logic` (`pipeline/check-disney-gesamtnummer.ts`), `disney-staffeln.test.cjs`. Gegenprobe: `data/folgen-zuordnung.json` ordnet die Disney-Folgen von Shippuden (166, 161 über den Folgentitel), Naruto (20: 215 von 220), Dragon Ball Super (118 von 131) und One Piece (366 von 405) ohne Doppelung auf **Gesamtnummern** des Bestands — die Annahme „Disney-Folgen liegen im Bestand hintereinander" ist damit belegt, die Staffelgrenzen der anderen Serien noch nicht (Staffelgrößen stehen nur im Briefkasten).

## ADN: Sprache je Video aus der Schnittstelle, gemeldet auf Klick (4.31.0, 14.10.2026)

**Auftrag (Daniel, 13.10.2026):** ADN unterstützen wie die übrigen Anbieter, mit den Beispielseiten, die er eingeloggt gespeichert hat (7 Seiten, 6 Fälle: Film mit Synchro, Film ohne Video, drei Filme mit Untertitel, Serie mit Synchro über 2 Staffeln, Serie mit Untertitel, wöchentliche Serie mit 2 Folgen).

**Das Muster, dem ADN folgt (gemessen an `disney.js`, `melder.js`, `worker/src/pruefung-speichern.ts`):** je Folge eine Meldung `plattform`, `url`, `vorhanden`/`ton_de`/`art: gemessen` (Stufe 1), `folge_nr`, `staffel`, `sprachen`, genau eine Rohfolge in `rohfolgen`; Senden mit Token auf Klick; schon Gemeldetes über `?gemeldet=<url>`; „nicht im Angebot" (`vorhanden: nein`) **nur auf Klick von Hand**, nie vom Durchgang oder beim Laden. ADN hat dasselbe, ohne Sonderweg: `adn-leser.js` (rein), `adn.js` (Kasten, Klick), Anzeige im gemeinsamen Kasten (`box.js`), Senden mit Wiederholung (`disney-netz.js`, `AK_DISNEY_NETZ.sende`).

**Wo ADN die Sprache sagt (gemessen an den Beispielseiten und am Archiv `data/adn-raw/`):**

| Was | Wo | Taugt zum Melden |
|---|---|---|
| Sprache je **Video** | `gw.api.animationdigitalnetwork.com/video/show/<id>?limit=100&offset=…`, Feld `languages` (`vde` = Synchro, `vostde` = japanischer Ton mit deutschen Untertiteln, `[]` = keine Angabe, 34 von 7.332 Videos) | **ja** |
| Staffel, Folgennummer, Typ | dieselbe Antwort: `season` (`"1"`, aber auch `"Saga 14 : Wano Kuni"`), `number`/`shortNumber` (`Folge 13`, `Film`, `OVA 1`, `Épisode spécial 1`, `Folge 3 (NC)`), `type` (`EPS`, `MOV`, `OAV`, `PV`), `reference` (je Staffel gezählt: `dorohedoro_tv2_0001`) | ja |
| Abzeichen „SYNCHRO"/„UNTERTITEL" | Seite, `[data-testid="text-SYNCHRO"]` im Kopf (vor dem ersten `show-tab`); dahinter stehen die Abzeichen der Empfehlungen | **nein**, nur Anzeige: Es gilt für die **Serie**. Dorohedoro trägt es auf beiden Staffelseiten, aber nur Staffel 2 hat `vde` (Staffel 1: 12 Folgen + OVA nur `vostde`) |
| Folgenliste der Seite | `[data-testid="show-video-item"]`, ohne Sprache; die Seite lädt `/video/show/<id>/seasons` (ohne `languages`) | nein |
| „Kein Video verfügbar" | Text im `<main>`, `text-count` = „0 Videos", kein Abzeichen im Kopf (Hei II, Madoka 3) | nur als Gegenprobe zu „liefert nichts" |
| `__NEXT_DATA__` | gehört zur zuerst geladenen Seite (die Datei „Steins;Gate" trägt die Daten von „B King") | **nie lesen** |

**Entscheidungen**

- **Sprache nur aus der Schnittstelle, nie aus dem Abzeichen.** Die Erweiterung ruft `/video/show/<id>` selbst ab (mit den Kopfzeilen der Seite: `x-target-distribution: de`, `Accept-Language: de`, `x-source: Web`, `x-i18n-platform: 1`; ohne Anmeldedaten, die Pipeline liest dieselbe Adresse seit 11.08.2026 ohne Konto). Das ist ein Abruf, den die Seite so nicht macht (sie liest `/seasons`), aber derselbe Weg, den `pipeline/fetch-adn.ts` geht; je Seitenaufruf höchstens eine Abfolge zu 100 Videos mit 300 ms Pause. **Nicht live geprüft:** Skripte bekommen von CloudFront 403 (13.10.2026), die Seiten waren nur gespeichert. Dass die Antwort im Browser durchkommt, folgt daraus, dass die Seite ihre Schnittstelle mit denselben Kopfzeilen von derselben Herkunft aufruft; ob `/video/show/<id>` ohne Anmeldekopf aus dem Browser antwortet, zeigt erst der erste Aufruf (Kasten: „ADN nicht lesbar (HTTP …)", Bericht `fehler`).
- **Eine Meldung je Video, Stapel zu zehn.** `ton_de = ja`, wenn `vde` dabei ist, `nein` bei nur `vostde`; ohne Angabe (`[]`) wird nichts gemeldet, sondern gezählt (`ohneAngabe`). Trailer, Vorschauen (`PV`) und „(NC)" sind keine Folgen. Gemeldet wird `rohfolgen: [eine]` mit `gti` = Videokennung, `roh.referenz` = ADNs Staffelzählung (ADN zählt Folgen über Staffeln durch: Dorohedoro Staffel 2 beginnt bei Folge 13).
- **Schlüssel der Meldung** (Worker `folgeVon`): Adresse (Serienseite ohne Folge und `?s=`), `folge_nr`, `staffel`, `seiten_kennung`. Filme, OVAs und Specials tragen ihre Art als `seiten_kennung` (`MOV`, `OAV`, `special`), Staffeln mit Namen ihren Namen; sonst überschrieben sich „Film 1" und „Folge 1" derselben Adresse. `?gemeldet=` liefert den Videotitel als `folge`; damit erkennt die Erweiterung Gemeldetes, ohne Nummern zu raten.
- **Worker:** nimmt `plattform: adn` seit jeher an (kein Wertebereich). Neu ist nur `adn` in `MIT_ROHFOLGE_IN_MELDUNG` (`pruefung-rohfolge-spalte.ts`): die eine Rohfolge liegt in der Meldungszeile statt in `prime_folge`. **D1-Zeilen** (lokal in workerd, `tools/worker-schreibzeilen-messen.ts` mit ADN-Meldungen, 14.10.2026): erste ADN-Folge 7 geschriebene Zeilen, wie Netflix und Disney+ (je 7); dieselbe Folge noch einmal 1; ein Stapel zu 3 mit einer unveränderten 13 (2 × 6 + 1 Tageszähler). Ohne die Änderung kämen 5 Zeilen in `prime_folge` je Folge dazu (6 + 5 = 11). Keine Migration.
- **„Nicht im Angebot" nur von Hand.** Antwortet die Schnittstelle mit 404 oder leerer Liste, bietet der Kasten „▸ nicht im Angebot melden" an und nennt, ob die Seite „Kein Video verfügbar" zeigt; gesendet wird erst beim Klick. Ein Fehler (500, kein Netz) ist nie „keine Videos".

**Nicht gebaut (offen):** keine Prüfliste/Wiedervorlage für ADN (`offene-adn.js`, kein Durchgang „alle durchgehen"), also auch keine `titelId` in der Meldung; die Pipeline ordnet über die Adresse zu. ADN-Verweise sind klein (117 Releases, 262 Archive), und die Pipeline kennt die Sprache aus demselben Archiv (`pipeline/lib/adn-sprachen.ts`); die Erweiterung ist hier die Gegenprobe aus Daniels Sitzung, kein Ersatz. Wer die Prüfliste nachrüstet, nimmt `tools/extension-offene-disney.mjs` als Vorbild und trägt die Datei in `erneut-melden.mjs`, `pruefstand.mjs` und `tools/quellen-liste.sh` ein.

**Tests:** `extension/adn.test.cjs` (52 Zusicherungen, je Fall eine Zusicherung plus Gegenprobe) mit `extension/adn-ausschnitte.fixture.json`; erzeugt von `tools/adn-ausschnitte-erzeugen.mjs` aus dem Archiv und den gespeicherten Seiten, bei jedem Lauf gegen das Archiv nachgerechnet (Id, Titel, Sprachen) und auf Kontodaten geprüft (`@`, `token`, `email`, `account`, `user`, `konto`, `profil` kommen nicht vor; aus den Seiten stehen nur `data-testid` einer festen Positivliste, die Überschrift und der Hinweis „Kein Video verfügbar" drin). Worker: `tools/worker-rohfolge-spalte.test.ts` (Stapel zu zehn ADN-Meldungen, nichts in `prime_folge`; ohne den Eintrag in `MIT_ROHFOLGE_IN_MELDUNG` rot). Ladeprobe: `tools/extension-laden-pruefen.cjs` lädt `adn.js` auf `animationdigitalnetwork.com/de/video/1375-dorohedoro`.

## Kasten auf Wiedergabeseiten ausgeblendet (4.24.16, 08.10.2026)

Disney+ `/de-de/play/<uuid>` und Netflix `/watch/<id>`: `box.js` setzt `html.ak-im-player`, `melder.css` blendet `.ak-box` aus (nur visuell, Logik läuft weiter). Wechsel ohne Neuladen über `navigation` (`currententrychange`), kein Takt. Ausnahme: Netflix-Durchgang (`html.ak-durchgang`), dort ist der Kasten der Notausgang. Prime erkennt den Player selbst (`amazon.js`, `imPlayer()`). Zusicherung: `box-player.test.cjs`.

## Kasten einklappbar mit Zähler-Icon (4.24.17, 09.10.2026)

Ein Icon (44 px, „AK" bzw. „▾") unten rechts klappt den Kasten aus und ein, auf Netflix, Disney+ und Prime gleich; Code nur in `box.js` (`akIconStarten`), Stil am Ende von `melder.css`. Standard eingeklappt; der Zustand liegt unter **einem** Schlüssel `akKastenZu` in `chrome.storage.local` (seitenübergreifend, Berechtigung `storage` bestand schon; `onChanged` gleicht offene Tabs ab). Eingeklappt ist rein visuell (`html.ak-eingeklappt`, Transition auf `opacity`/`transform`, aus bei `prefers-reduced-motion`); erfasst sind `.ak-box` sowie bei Prime `.ak-amazon-knopf`, `.ak-durchlauf`, die freistehende Übersicht. Ein Netflix-Durchgang (`html.ak-durchgang`) und ein laufender Disney+-/Prime-Durchgang halten den Kasten offen (Notausgang). Auf Wiedergabeseiten (4.24.16) ist auch das Icon weg.

## Netflix-Player ohne Anzeige und Knopf (4.24.18, 09.10.2026)

Die Anzeige oben links im Netflix-Player („Folge 4: deutsche Tonspur gefunden · Als deutsch melden", `ak-player-anzeige`) ist **gestrichen**, nicht nur versteckt: `playerAnzeige()`, `playerZeigen()`, `playerFeldWeg()`, ihr Stil in `melder.css` und der Hand-Knopf sind aus dem Code. Daniel meldet nie aus dem Player, sondern von der Übersicht; der Durchlauf liest die Tonspuren im Player weiter und meldet über `durchlaufMelden()` (eigener `fetch`, nie an die Anzeige gebunden). Im Player sichtbar bleibt nur der Notausgang-Kasten während eines Durchgangs (4.24.16). Disney+ `/play/` hat außer `.ak-box` keine eigene Anzeige. `melden()` hat damit keinen lebenden Aufrufer mehr (`vielleichtSenden()` ist seit 26.08.2026 auskommentiert) — toter Code, nicht angefasst. Zusicherungen: `melder-uebersicht.test.cjs` (Player ohne `ak-player*`-Elemente, Meldung des Durchlaufs wird weiter erzeugt), `npm run check:netflix-player`.

**Die Badge-Zahl ist keine zweite Zählung:** jeder Melder reicht über `akZaehler(n, pflicht)` die Zahl durch, die schon seinen Knopf beschriftet — Netflix `offeneAdressen` (`melder.js`, = `offeneTitelZahl()`), Disney+ `nochOffen` (`disney.js`, Prüfstand-bereinigt, 4.24.14), Prime `offen + suchen` (`amazon.js`). 0 zeigt ein gedämpft grünes „✓", ab 100 steht „99+" (der Wert steht im `aria-label`). Zusicherungen: `box-einklappen.test.cjs`; Bildmessung mit Playwright gegen eine Testseite mit `chrome.storage`-Mock (Skript im Scratchpad der Sitzung).

## Prime-Seitenregeln für `button` verschoben Icon und Melde-Knopf (4.24.19, 10.10.2026)

Auf Prime reichen Amazons Regeln für `button` (`min-height`, `margin`, `text-align: left`, `content-box`) in unsere Knöpfe: Das „▾" im Icon saß links der Mitte, der grüne Melde-Knopf wurde ~60 px hoch und lief über den Kasten hinaus (Lücke zur Übersichts-Pille). Fix nur in `melder.css`: `.ak-icon` mit `display: grid; place-items: center`, `box-sizing`/`min-height`/`margin` mit `!important`, Zeichen 20 px; `.ak-amazon-knopf-innen` ebenso, Text zentriert. Gemessen mit Playwright-Kulisse mit Prime-ähnlichen Resets: Knopf 60 → 32 px, Breite 368 → 340 px. Der „DE"-Chip ist das Flaggen-Emoji 🇩🇪, das Windows nicht zeichnet; ein SVG-Ersatz braucht DOM statt `textContent` an ~10 Stellen samt Tests und ist noch offen.

## Lücke in der Netflix-Melde-Zeile (4.24.20, 10.10.2026)

Nicht 4.24.19, sondern 4.24.17: `html.ak-icon-da .ak-durchlauf { margin-bottom: 52px }` (Freiraum über dem Icon) galt auch für die Knöpfe „↻ alle" und „▶ … prüfen" **im** Kasten und blähte die Melde-Zeile um 52 px auf (77 statt 29 px; Lücke zur „Anime-Kalender"-Pille). Fix: `html .ak-box .ak-durchlauf { margin-bottom: 0 }`; die Prime-Regeln aus 4.24.19 bleiben unberührt. Gemessen mit `check:netflix-kasten`-Kulisse.

## Netflix: „✓ gemeldet“ nach dem Lauf; „Neue Folgen“ bei Netflix und Disney+ (4.24.21, 10.10.2026)

**Rücksprung auf den Ausgangsknopf.** Das Band der Unterwelt (Netflix 82719204): nach „2/2" stand wieder „S? · ▶ E1 + E15 prüfen → gilt für E1–15", obwohl der Briefkasten alle 15 Folgen führte (`?gemeldet=` am 10.10.2026, 16:39:29Z, 15 Zeilen mit Folgenkennung 82719209–82719223). Die Ursache im Ablauf nach `randMelden()` ist **nicht belegt**: `check`-Sandkasten (`netflix-gemeldet.test.cjs`, das echte `melder.js` samt `durchlaufStarten()` gegen einen Worker-Ersatz) zeigt dort sofort „✓ E1 + E15 geprüft …"; „S?" kommt von der veralteten Staffelzahl in `anbieterStaffeln` (8 Folgen, Meldung vom 26.08.), nicht vom Rücksprung. Statt weiter zu raten, hängt der Abschluss jetzt an einem eigenen Merker (`netflix-gemeldet.js`): `melder.js` ruft in `durchlaufKnopfZeigen()` einmal `AK_GEMELDET.zeigen()`; das Modul erkennt am Wechsel von `DURCHLAUF.laeuft`, wann ein sauberer Lauf endet (nichts abgebrochen/gestört/uneinheitlich, jede Folge gemeldet, eine Staffel geladen), und speichert Zeit und höchste Folgennummer in `chrome.storage.local` (`netflixGemeldet`, je Reihe, `{ am, bis }`). Das Modul lädt sich beim ersten `zeigen()` selbst und zeichnet den Knopf danach neu. Der Knopf zeigt „✓ gemeldet", ist aus und bleibt es über ein Neuladen, bis `pruefstandAm` (aus `?stand=1`) jünger ist als die Meldung (der Datensatz trägt die Antwort) oder 36 Stunden vergangen sind. „↻ alle" und ein neuer Lauf löschen den Merker. Wird der Rücksprung doch noch einmal beobachtet, den Bericht („Bericht laden") mit Zeitpunkt nehmen: fehlt dort der Merker, liegt es am Speicher, sonst am Aufruf.

**Mehr Folgen auf der Plattform als im Datensatz.** `tools/pruefstand.mjs` schreibt je Anbieter `bekannt: { Kennung: höchste Folge }` (obere Grenze der `dubRanges` des einen Eintrags an der Adresse, `tools/pruefstand-bekannt.mjs`; sie **fehlt** bei mehreren Einträgen an einer Adresse und bei jeder Spanne ohne deutschen Ton — dort ist die Synchro bewusst kürzer als das Angebot, Bleach: Thousand-Year Blood War – The Calamity auf Disney+ hat deutsch 1–6, 7–8 ohne, 10 im Angebot, und soll kein „Neue Folgen 9–10“ zeigen; `tools/pruefstand-bekannt-pruefen.mjs`), der Worker reicht sie in `?stand=1` durch (`bekanntDazu`), `pruefstand-zeit.js` bietet `akBekannt()`/`akNeueFolgen()`. **Netflix:** liegen nicht gemeldete Folgen hinter `bekannt` und hinter dem, was der Merker schon deckt (nur bei einer geladenen Staffel), heißt der Knopf „Neue Folgen 12–15 · prüfen und melden" (eine einzelne: „Neue Folge 16 · …"; `akNeueText`) und gewinnt gegen „✓ gemeldet“, auch innerhalb der 36 Stunden, und der Klick läuft wie `erzwungen`: Randprobe über **alle** Folgen (E1 + E15 → gilt für E1–15), nicht nur über die neuen. **Disney+:** meldet die Seite mehr Folgen (`erwartet`) als `bekannt` und liegen noch nicht alle im Briefkasten (`gemeldeteNummern`), gilt der Titel nicht als beantwortet; der Kasten zeigt „Neue Folgen 12–15 · prüfen und melden", sammelt und meldet wie bisher (`disney-beantwortet.js`, `folgenZahl`). Grenzen: **Amazon ist nicht umgesetzt** (Seiten je Staffel mit eigener Kennung, Folgenzahl dort nicht eindeutig); der Disney+-Durchgang überspringt einen so erkannten Titel weiter als „schon gemeldet"; `bekannt` erscheint erst nach dem nächsten Datenbau in `pruefstand.json` und nach dem Worker-Deploy — bis dahin gilt das bisherige Verhalten. Zusicherungen: `netflix-gemeldet.test.cjs`, `disney.test.cjs`.

## Netflix: Rücksprung des Kastens — Stapel nicht bestätigt; Zustandsprotokoll (4.24.22, 10.10.2026)

**Codepfad und Testfall.** Der Merker aus 4.24.21 (`netflix-gemeldet.js`) hat den Rücksprung bei „Das Band der Unterwelt" (82719204) nicht beseitigt: Daniel sah um 21:05 nach dem Melden den klickbaren Knopf, jetzt „S1 · ▶ E1 + E10 prüfen → gilt für E1–10" (vorher E1 + E15). Im Briefkasten lagen alle 15 Folgen (`?gemeldet=`, gemessen 10.10.2026: `nummern` 1–15, `paare` mit Kennung 82719209–82719223, alle am 19:02:32Z). Der Titel steht nicht in `offene-netflix.js`, der Knopf rechnet also nur `DURCHLAUF.folgen` minus `DURCHLAUF.gemeldet`. Die Randprobe schickt 15 Meldungen als Stapel 10 + 5 (`randMelden`, `MELDE_STAPEL`) und merkt lokal nur Folgen vor, die der Worker im Stapel ausdrücklich bestätigt; die gemessenen E1 und E15 gehen nur über diesen Weg raus. Bestätigt der Worker den ersten Stapel nicht (Stapel gespeichert, Antwort nicht `ok`), bleibt `gemeldet` = E11–15 und der Knopf zeigt exakt „▶ E1 + E10 prüfen → gilt für E1-10"; `lauf()` setzt keinen Merker, weil E1–10 lokal offen sind. Der Sandkasten erzeugt genau diesen Text (`netflix-gemeldet.test.cjs`, `stapelFaelle`). **Unbelegt bleibt, warum der Stapel live unbestätigt blieb** (HTTP-Status, Zeitüberschreitung, Fehler im Worker?) — dafür das Protokoll unten (`worker-post`).

**Fix.** `akGemeldetAbschliessen` (`netflix-gemeldet.js`): Gilt am Lauf-Ende eine Folge lokal als offen, fragt es einmal den Briefkasten (`meldungenLaden`) und übernimmt, was dort steht; erst dann entscheidet es über den Merker. Nicht `durchlaufStandLaden`: Das fällt bei jedem Fehler nach dem Abruf auf den lokalen Speicher zurück und überschreibt `gemeldet` mit dem alten Stand (im Sandkasten belegt, dort wirft `staffelnVon` mit der Testbelegung von `anbieterStaffeln`; live ungeprüft).

**Zustandsprotokoll.** `protokoll.js` (Ringpuffer, 200 Ereignisse, `chrome.storage.local`-Schlüssel `akZustandsprotokoll`, überlebt das Neuladen) und `netflix-protokoll.js` (umhüllt von außen `durchlaufKnopfZeigen`, `durchlaufStarten`, `durchlaufMelden`, `randMelden`, `durchlaufStandLaden`, `durchlaufStandVergessen`, `nfBericht`, `fetch` für Meldungen, dazu die `ak-folgenliste`-Nachrichten). `netflix-gemeldet.js` meldet Merker gelesen/gesetzt/gelöscht, das Urteil am Lauf-Ende (`lauf-urteil`: fertig, Abbruch, ungemeldete Folgen, Zahl der Staffeln), `abgleich` und jeden geänderten Befund von `zeigen`. „Bericht laden" enthält das Ganze als `zustandsprotokoll`. Ereignisse: `start`, `knopf` (Text, gezählte und gemeldete Folgen als Bereiche, erste/letzte Kennung, Knopf-/Kasten-Nummer), `kasten`, `liste`, `stand-laden`/`stand-geladen` (Worker-Nummern), `worker-post` (Stapelgröße, Status, bestätigt), `rand-start`/`rand-ende`, `melden`, `lauf-start`/`lauf-ende`. Keine personenbezogenen Daten. Test: `netflix-protokoll.test.cjs`.

**Auswerten:** Im Bericht `worker-post` lesen: `bestaetigt` kleiner als `anzahl` oder ein `fehler` nennt die Ursache; danach `abgleich` und `merker-gesetzt`. Anleitung für Daniel: `daniel-zum-abarbeiten/listen/todo-netflix-melder-messen.md`.

## Prüfliste für alle Pillen-Lücken, hinter einem Schalter (11.10.2026)

Anlass (Daniel, 11.10.2026): Alle Anbieter-Pillen ohne Haken oder ohne belegte Folgenzahl sollen auf die Prüfliste.
**Messung** (echte Pillen-Funktion `folgenAuskunft`, `pipeline/pillen-luecken.ts`; Netflix / Prime / Disney+):

| Bestand | Wege mit Lücke | davon auf der Liste (heute) | mit Schalter `erweitert` |
|---|---|---|---|
| Hauptbestand | Netflix 10, Prime 4, Disney+ 0 | Netflix 8, Prime 1 | alle bis auf Golden Wind (Kanal-Titel, Prime zeigt dort ohne Abo keinen deutschen Ton) |
| Cartoons (TMDB) | Netflix 254, Prime 120, Disney+ 183 | 0 | Netflix 238, Prime 108, Disney+ 168 |
| ohne Adresse (nicht öffnbar) | Cartoons: Netflix 16, Prime 12, Disney+ 15 | | bleiben außen |

Der Hauptbestand fehlt fast nur bei Haken-losen Wegen; die Masse sind die 557 Cartoon-Wege, deren Pillen weder Haken noch Folgenzahl tragen
(`dub` fehlt, TMDB nennt nur den Anbieter). Hauptbestandswege mit Haken, aber ohne Folgenzahl (laufende Serien ohne Bereiche: Detektiv Conan,
Shin-chan, Cyberpunk: Edgerunners 2, Fool Night) kommen als Verdachtsquelle `folgenzahlFehlt` (`tools/verdacht.mjs`) auf die Liste.

- **Schalter:** `data/pruefliste-regeln.json`. `erweitert: false` (Vorgabe) lässt die Listen unverändert; `true` schaltet Cartoons, Folgenzahl-Lücken und
  Rangordnung zu (`tools/pruef-bestand.mjs`, Zuordner `pipeline/lib/pruef-titel.ts`). Die Listen in `extension/offene-*.js` erzeugt der tägliche Bestandsbau;
  der Schalter allein genügt, der Browser sieht sie nach Neuladen der Erweiterung. `PRUEFLISTE_ERWEITERT=1` schaltet nur für einen Lauf zu.
- **Reihenfolge:** Hauptbestand vor Cartoons, darin laufende/aktuelle zuerst, dann neuere vor älteren; gilt für die Listen und für `ziele` in `pruefstand.json`
  (die erweiterungsinterne Netflix-Liste sortiert selbst nach Titel).
- **Quelle und Vertrauen:** Jeder Eintrag trägt `quelle` (`justwatch` = JustWatch nennt den Anbieter mit deutschem Ton, `tmdb` = TMDB führt ihn nur auf,
  `datensatz` = Urteil im Bestand, `keine` = kein Urteil) und `vertrauen` (Vorgabe überall `ungeprueft`). Setzt die JustWatch-Quellenprüfung eine Quelle auf
  `hoch` und steht `hoch` in `ausblenden`, kommen deren Wege nicht mehr auf die Liste — ohne Code. Wege ohne Urteil (`keine`) werden nie ausgeblendet.
  **Seit 11.10.2026 `justwatch-regel`:** ein Prime-Weg mit `dubQuelle: 'justwatch'` („Deutsch laut JustWatch", Vertrauensregel `pipeline/lib/jw-vertrauen.ts`,
  99,4 % richtig bei n = 468) trägt diese Quelle mit Stufe `hoch`. Vorgabe weiter: nichts ausblenden (`ausblenden: []`) — `["hoch"]` blendet genau diese Wege aus
  (nur mit `erweitert`). Cartoons bleiben bei `justwatch` / `ungeprueft`, bis Daniels Stichprobe (50 + 50) vorliegt. Gibt es einen JustWatch-Irrtum über der Grenze
  (Bericht: Fruits Basket bei Crunchyroll), setzt man `justwatch-regel` auf `ungeprueft` zurück.
  **Seit 16.10.2026** gilt die Prime-Vertrauensregel nicht mehr: `dubQuelle: 'justwatch'` steht an jedem Anbieter, an dem JustWatch an genau
  der Seite des Wegs „de“ nennt (`pipeline/lib/jw-seite.ts`, quellen.md „JustWatch-Ton je Seite“). Mit `dubHintOnly` ist es nur ein Hinweis
  (Mehrteiler, mehrere Staffeln, Wächter); `quelleVon` in `tools/pruef-bestand.mjs` zählt beide noch gleich als `justwatch-regel`.
- **Staffel-Unschärfe:** Cartoon-Serien tragen `staffelUnscharf: true` und `hinweis` (TMDB zählt Gesamtfolgen; der Anbieter kann anders schneiden, z. B.
  Avatar Buch 1–3). Die Erweiterung zeigt das Feld noch nicht (nur `pruefstand.json` `ziele[].hinweis`); der Zuordner ordnet nur zu, wenn die Folgenzahl
  stimmt (`ordneNachStaffelliste`), eine unpassende Meldung bleibt unzugeordnet statt falsch belegt zu werden.
- **Zuordner:** `titelId` negativ verwirft der Worker (`zahlOrNull`); der Zuordner findet den Cartoon dann über die Adresse. Kein Worker-Deploy nötig.
- Bugfix nebenbei: `geprueftePrime` las `- anilistId: -…` (Cartoon-Handbelege) nicht und warf deren Adressen mit dem Vorgänger zusammen.

## Stichprobe 50 + 50: Stimmt JustWatch bei Cartoons? (11.10.2026, Schalter bleibt aus)

Für Anime gilt „Deutsch laut JustWatch“ (Prime, 99,4 % bei n = 468); für Cartoons fehlt die Messung, weil nur 4 von 901 einen Beleg tragen. Daniel prüft zwei
Gruppen von Cartoon-Wegen (Titel × Anbieter) mit der Erweiterung, ohne vorher zu sehen, was JustWatch sagt:

- **`jw-deutsch` (50):** JustWatch nennt für den Anbieter ein Flatrate-Angebot mit `de` unter `audio` — Disney+ 25, Prime 25 (Netflix fehlt: JustWatch nennt dort nie einen Ton).
- **`jw-ohne-deutsch` (50):** kein Deutsch laut JustWatch (Ton ohne Deutsch, Ton leer oder kein Angebot) — Stand der Ziehung Netflix 31 (Ton leer: Schweigen, kein Nein),
  Disney+ 10, Prime 9; mehr Wege dieser Art gibt es bei Disney+ und Prime nicht, der Rest füllt mit Netflix auf.
- **Auswahl:** `tools/cartoon-jw-stichprobe.mjs`, Seed `cartoon-jw-stichprobe-2026-10-11`, je Weg `sha256(Seed|Kennung|Anbieter)`, die niedrigsten Schlüssel je Gruppe und
  Anbieter (Quoten im Kopf der Datei); ausgeschlossen sind Wege mit Urteil, ohne Adresse oder ohne listenfähige Adresse, eine Adresse zählt einmal. Das Ergebnis liegt
  eingefroren in `data/cartoon-jw-stichprobe.json` (Titel, Anbieter, Adresse, JustWatch-Aussage je Weg) — neu schreiben nur bewusst: `node tools/cartoon-jw-stichprobe.mjs --schreiben`.
- **Auf der Liste:** Quelle `cartoon-jw-stichprobe` (Stufe `ungeprueft`) und Rang vor allem anderen — nur mit `erweitert`; ohne ihn sind die Listen unverändert
  (Listen vor und nach dem Umbau gebaut, `extension/offene-*.js` ohne Diff). Die JustWatch-Aussage steht bewusst nicht im Listeneintrag. **Netflix:** die Liste ist ein Objekt mit
  Zahlenschlüsseln, deren Reihenfolge JavaScript selbst festlegt — der Rang wirkt dort nicht; die Erweiterung müsste nach `quelle` sortieren (offen).
- **Auswertung:** `node tools/cartoon-jw-auswerten.mjs --meldungen=<datei.json>` (oder `--holen` mit `LAUF_TOKEN`) rechnet je Anbieter und Gruppe n, richtig, Quote und
  Wilson-Untergrenze; Schwelle der Anime-Regel: ≥ 98 % bei n ≥ 50 und Untergrenze ≥ 95 % je Anbieter. Mit 25 Wegen je Anbieter in `jw-deutsch` ist n ≥ 50 nur für Disney+ und Prime
  zusammen erreichbar (0 Fehler bei n = 50: Untergrenze 92,9 %, für 95 % braucht es etwa 73 Wege ohne Fehler).
- **Meldungen zu Cartoons** ordnet der Zuordner erst zu, wenn `erweitert` an ist (`pipeline/lib/pruef-titel.ts`); die Auswertung gleicht zusätzlich über die Adresskennung ab.

## Prime-Durchgang: 116 von 124 Titeln lagen unter JustWatchs Adresse und blieben liegen (4.26.0, 11.10.2026)

Daniel startete „▶ alle durchgehen“ in 4.25.0, der Lauf endete mit „nichts mehr offen · 1 Suchaufträge von Hand“ — und 116 Prime-Titel blieben offen. Die Annahme war „nur eine Suchadresse, die Kennung fehlt“. Gemessen an `extension/offene-amazon.js`: **alle 124 Einträge tragen eine Titelseite, 116 davon als `watch.amazon.de/detail?gti=<gti>`** (JustWatchs Form, Schlüssel = gti) und keiner eine Suche (`AK_PRIME_SUCHE` hatte 0 Einträge im Bau, 1 bei Daniel). Ursache war die Prüfung `/\/detail\//` in `primeNaechsterTitel()`, `primeLaufStarten()` (zweimal): `detail?gti=` hat nach „detail“ kein „/“. Die Pipeline-Variante (Kennung vorab finden) war also schon erfüllt; der Rest „Suchen im Durchgang auflösen“ wurde **nicht gebaut** — bei 0–1 Suchaufträgen wäre es Automatik ohne Nutzen, und ein falscher „bester Treffer“ schriebe die Meldung unter die falsche Kennung. Bleibt eine Suche, steht sie weiter im Schluss als „Suchaufträge von Hand“.

- **Frame-Adresse:** eine gti öffnet der Durchgang über `watch.amazon.de/detail?gti=…`, nicht über `www.amazon.de/gp/video/detail/<gti>`. Gemessen mit zwei Kopfzeilen-Abrufen (Antiks, 11.10.2026): `watch.amazon.de` antwortet **302** auf `www.amazon.de/gp/video/detail/<ASIN>?ref_=atv_dl_rdr`, ohne `X-Frame-Options`; die direkte gti-Adresse antwortet 200 mit `SAMEORIGIN`. Der Frame landet also auf `www.amazon.de` wie jede andere Staffelseite.
- **Zuordnung:** die gti im Kopf der Zielseite ist nicht JustWatchs (siehe „Der Weg ohne Klick“, 28.09.2026). Der Durchgang merkt den Auftrag deshalb vor dem **ersten** Frame eines Titels mit `gtiSprungMerken()` — derselbe Weg wie der Klick in der Prüfliste (`?ref_=atv_dl_rdr` + zwei Minuten). Weitere Staffeln laufen wie bisher über ihre ASIN aus der Staffelliste der Seite.
- **Wo der Code steht:** `extension/prime-titelseite.js` (lädt vor `amazon.js`; `amazon.js` liegt über der Zeilengrenze). Test: `amazon-durchgang.test.cjs` — gti-Titel zählt, erster Frame über watch.amazon.de, Auftrag einmal gemerkt, Staffeln über ASIN, Suche bleibt zu; dazu „jeder Eintrag der echten Prüfliste hat eine Titelseite oder eine Suchadresse“ (eine dritte Adressform fiele sonst wieder lautlos heraus).
- **Nicht gemessen:** der Lauf selbst im Browser (116 Titel, jeder mit mindestens einer Seite, drei Frames gleichzeitig). Landet ein Frame auf einer Seite ohne Meldeknopf, steht der Titel im Schluss unter „übersprungen“ — nie als „nicht da“ gemeldet.

## Prime-Zahl folgt dem Worker, nicht dem Paket (29.10.2026)

Anlass (26.10.2026, dritte Wiederholung nach 14./15.09.): Statusanzeige „Amazon 62 offen“, Knopf „32 Prime-Titel“ — `AK_OFFENE_AMAZON` kannte 39 von 62 Adressen. `extension/prime-stand-ziele.js` legt aus `?stand=1` (derselbe Abruf wie vorher in `briefkastenHolen`) für jedes Titel-Ziel (nichtleerer Titel) ohne Paket-Eintrag einen Eintrag mit `ausStand` an; Zählung, Liste und Durchgang rechnen unverändert. Der Knopf zeigt „· Liste veraltet“, sobald ein solcher Eintrag existiert. Wächter: `tools/worker-amazon-zahl-gleich.test.ts` (in `check:worker`). **Disney+ (29.10.2026):** `extension/disney-stand-ziele.js` (`akDisneyStandEinarbeiten`, aufgerufen in `briefkastenHolen` von `disney.js`, Stand aus `akPruefstand()`) legt für jedes Worker-Ziel ohne Paket-Eintrag einen Eintrag mit einer offenen Staffel ohne Folgenzahl und Kennung an (zählt mit, meldet ohne `titelId`); Paket-Einträge, deren Offen-Zustand vom Worker abweicht, folgen dem Worker. Wächter: `tools/worker-disney-zahl-gleich.test.ts` (in `check:worker`). Netflix: `tools/worker-netflix-zahl-gleich.test.ts` (0 von 7 fehlten am 29.10.2026).

## Netflix-Durchgang: keine Titelzahl als Grenze mehr (4.27.0, 11.10.2026)

Daniel startete „▶ alle durchgehen" mit 245 offenen Titeln; nach genau 20 stand im Kasten „Durchgang fertig". Ursache: `SELBST_HOECHSTENS = 20` (Lehre vom 26.08.2026, erster One-Piece-Lauf mit 42 falschen Meldungen), und `durchgangEndeZeigen` wertete „… Titel geschafft" als regulär. Die Titelzahl traf den damaligen Fehler nie; ihn fängt je Titel der Reihen-Riegel im Durchlauf (`stand.reihe` muss zur Seite passen, „Zweiter Riegel").

- **Schutz je Titel, schon vorhanden:** Reihen-Riegel; Störung (`M7…`, `E…`) bricht ab; höchstens zwei Anläufe je Titel (`SELBST_VERSUCHE`); höchstens sechs Runden je Seite; 20 s auf die Folgenliste, 40 s Sammeln; Vorfall-Meldung höchstens 20 je Sitzung (meldet nur, hält nichts an); ein fertiger Titel steht in `selbstUebersprungen` und wird nie wieder angesprungen — der Lauf ist über die Liste endlich.
- **Neu (`netflix-durchgang-schutz.js`):** mehr Sprünge als bei Laufbeginn offene Titel brechen ab („Schutz: mehr Sprünge als offene Titel (N)"), ebenso sechs Stunden seit Laufbeginn (vorher zwei; gemessen 11.10.2026: 20 Titel in 12 Minuten, 245 also rund zweieinhalb Stunden). Der Kasten sagt dann „Durchgang abgebrochen · <Grund>"; „fertig" steht nur bei „kein offener Auftrag mehr".
- **Nicht gemessen:** ein ganzer Lauf über alle offenen Titel im Browser; die Dauer je Titel stammt aus dem alten Kommentar.

- **Gemeldet, aber im Stand noch offen (4.27.0, Zusatz am selben Tag):** Nach dem Neuladen öffnete der Durchgang die 20 Titel vom Vormittag erneut (Gumball 70243420: Briefkasten 38 Meldungen, 11.10. 16:13 Z; `?stand=1` führt ihn mit `pruefstandAm` 16:37:52 Z weiter in `ziele`). Ursache: `fertig()` kannte nur `frischGemeldetNetflix` (Meldungen dieser Seite). **Der Prüfstand taugt hier nicht als Maßstab** — Gumballs Meldungen liegen vor ihm, der Bau führt den Titel trotzdem offen; nach „Meldungen seit dem Prüfstand" bliebe er offen. Jetzt fragt `netflix-uebernahme.js` je Ziel `?gemeldet=<Adresse>` (gebündelt über `AK_DISNEY_NETZ.frischGemeldet` aus `disney-netz.js`, jetzt auch im Netflix-Block des Manifests; Frist 10 min für „keine Meldung"): Meldungen vorhanden → `akNetflixWartet`, `fertig()` gilt. Wiedervorlage: Meldungen vor dem `seit` einer offenen Staffel zählen nicht. Vorbehalt (ersetzt in 4.31.11, 23.10.2026: erledigt ist ein Titel erst, wenn **jede offene Staffel** eine Meldung hat, `akNetflixStaffelnGedeckt`; vorher blieben rund 115 offene Staffeln von 61 Titeln liegen, weil irgendeine alte Meldung genügte; das Durchgangs-Ende zeigt jetzt „besucht / gemessen / wartet auf Übernahme" und schreibt `durchgang-zaehlung` ins Protokoll, `akNetflixEnde`; seit 4.31.12 geht die Zählung zusätzlich als Vorfall `durchgang-zaehlung` über `/vorfall` an den Worker, Text = JSON der Zahlen; eine D1-Schreibzeile je Durchgang, Worker und Tabelle unverändert, am selben Tag und Tab nur der erste Durchgang): ein nur zum Teil gemeldeter Titel galt bis zur Übernahme auch als erledigt (wie in der Sitzung, die ihn meldete); die Knopfzahl der Liste liegt dadurch unter der Zahl der Statusanzeige, bis der Bau die Meldungen übernimmt (wie bei Disney+). Test: `netflix-uebernahme.test.cjs`.

- **Luna Petunia (80057171) und 80049903: der Durchgang meldete 0, weil der Worker nichts bestätigte (4.27.0, Bericht 16:52 Z).** Keine Frage der Staffelzuordnung: `kandidaten []` heißt nur „Staffelfeld offen" (TMDB-Sammelstaffel mit 36 Folgen gegen Netflix' 6/5/11; Meldungen gehen dann ohne Staffel raus und die Pipeline ordnet zu), die Randprobe lief durch (`rand-start gemessen [1,6]`) und schickte 6/5/11 Meldungen — `worker-post status 200`, aber `bestaetigt 0` bei jedem Stapel; im Briefkasten steht zu beiden Titeln nichts (`?gemeldet=`, 11.10. 16:59 Z), während die 20 Titel davor (bis 16:19:10 Z) vollständig dort liegen. Der Worker hat jede Meldung abgelehnt (400/500/503 je Eintrag). Die Ursache im Worker ist nicht gemessen; Verdacht: das Tageskontingent geschriebener D1-Zeilen (`wrangler d1 insights --time-period 1d`, 11.10.: prime_folge 89.272 + pruefung 60.214 geschriebene Zeilen, dazu 11.876 lauf_status — über dem Freiplan-Limit von 100.000 je Tag, aber ein gleitendes 24-Stunden-Fenster, nicht der UTC-Tag; um 16:39:53 Z kam noch eine Disney-Meldung an). Neu in 4.27.0: bestätigt eine Randprobe im Durchgang keine einzige Meldung, endet der Durchgang mit „abgebrochen · Worker bestätigt keine Meldung", statt Titel um Titel leer zu laufen; das Protokoll (`worker-post`) nennt jetzt die Status der abgelehnten Einträge (`fehlstatus`), der nächste Bericht sagt also 400, 500 oder 503.

## Statusanzeige und Erweiterung zählen „offen" gleich (11.10.2026)

Die Laufstatus-App zeigte für Disney+ „151 Titel", die Erweiterung nach dem Durchgang „1 offen". Ursache: `?stand=1` (`worker/src/pruefung-stand-anbieter.ts`) zog nur Meldungen **seit dem Prüfstand** ab; Meldungen im Briefkasten (`uebernommen = 0`) von davor galten als offen, die Erweiterung zählt sie als erledigt (`wartetAufUebernahme`). Jetzt gilt dieselbe Regel: erledigt ist eine Adresse mit Meldung seit dem Prüfstand **oder** im Briefkasten wartend; eine Wiedervorlage (Ziel mit `seit`, vom Bau in `pruefstand.json` mitgegeben, `tools/pruefstand.mjs`) braucht eine Meldung seit dem Prüfstand — wie `akGemeldetSeit` (`pruefstandAm`). Die Staffelprüfung (`ziel.staffeln`) zählt Briefkasten-Staffeln mit. Test: `tools/worker-pruefstand.test.ts` (in `check:worker`). Mit den Live-Zeilen vom 11.10.2026 (17.390 Meldungen, Prüfstand 16:37Z) nachgerechnet: Disney+ 151 → 0 Titel, Netflix 244 → 223, Prime 122 → 116. Solange `pruefstand.json` das Feld `seit` noch nicht trägt (bis zum nächsten Bestandsbau), gilt die Wiedervorlage als gewöhnliches Ziel.

## Prime-Durchgang hing auf der Startseite: Hörer und Takt standen hinter dem Warten auf eine Kennung (4.26.1, 11.10.2026)

Daniel startete „▶ alle durchgehen“ auf `amazon.de/gp/video/storefront` (4.26.0): acht Minuten „Titel 1/116 · 0 Seiten gemeldet“, die Spur endete bei `frame`. Der Diagnosebericht nannte die Ursache selbst: `takte: 0` und „Cannot access 'eintrag'/'knopf'/'gesehen' … before initialization“ — das Skript stand noch im `if (!id)`-Warten (fünf Minuten auf eine Titel-Kennung, dann `return`), und `window.addEventListener('message', …)` sowie `setTimeout(primeTakt, 500)` stehen erst dahinter. Auf der Startseite gibt es nie eine Kennung: Der Frame öffnete (die Funktionen sind hochgezogen, der Knopf im Dialog ruft sie), seine Antwort hörte niemand, und der 90-s-Ablauf in `primeKoordinieren()` lief nie, weil der Takt nie startete.

- **Fix:** `primeHoerer()` (Antwort des Frames) und der Takt werden vor dem Warten angemeldet; der Hauptlistener übergeht die Frame-Antwort. Ein hängender Frame fliegt nach 90 s raus, die Spur nennt `seite · ok:false · Frame antwortet nicht`, der Titel steht unter „übersprungen“ und der Lauf geht weiter.
- **Bericht:** die „Cannot access … before initialization“-Zeilen im Diagnosebericht waren kein eigener Fehler, sondern genau dieser Zustand; `bericht()` schreibt dafür jetzt „noch nicht angelegt: die Seite wartet auf eine Titel-Kennung“.
- **Test:** `amazon-durchgang.test.cjs` — Reihenfolge im Quelltext (Hörer vor dem Warten, Takt auf der Seite vor dem Warten und im Frame am Skriptende), `primeHoerer()` im Sandkasten (fremder Ursprung und fremdes Fenster zählen nicht, eigener Frame führt den Plan weiter).
- **Nachbesserung (Prüfer, 11.10.2026):** Der Takt vor dem Warten lief auch im Durchgangs-Frame, und `frameSchritt()` wirft dort (`frameZustand`, `knopf`, `gesehen` noch nicht angelegt, nach ~1,5 s „Takt wirft“). Jetzt `if (!IM_FRAME)` vorn, im Frame wie bisher am Skriptende. `amazon-durchgang-takt.test.cjs` lässt das ganze Skript im Sandkasten laufen (Startseite wartet: Takt läuft und liest den Lauf; Frame wartet: kein Wurf; Frame mit Kennung: Takt läuft) — gegen den Stand `e7108b803` rot.
- **Nicht gemessen:** der Lauf selbst im Browser auf der Startseite.

## Offen ist erst, was erschienen und unbelegt ist (11.10.2026)

Die Listen (`tools/extension-offene-liste.mjs`, `-amazon.mjs`, `-disney.mjs`) fragten nur nach `dub === undefined`. „Tokyo Revengers: War of the Three Titans" lief seit dem 02.10. wöchentlich (2 von 13 erschienen, beide als Handbeleg auf Deutsch) und hielt den Zähler bis Ende Dezember auf „1 offen". Jetzt gilt (`tools/offen-erschienen.mjs`, Test `offen-erschienen.test.mjs`): ein Weg ohne Urteil ist offen, wenn mehr Folgen erschienen sind (Termine des Anbieters in `releases.json`, `istErschienen` aus `shared/logic.ts`, Europe/Berlin) als belegt (Bereiche am Weg plus Bereiche der Handbelege). Ohne Termine zum Anbieter bleibt es offen. Ein Handbeleg ohne Bereiche („nicht in deinem Gebiet", Spy × Family) belegt keine Folge. Messung am Stand nach #812: Disney+ 174 → 173 offen, Netflix und Prime unverändert.

## Tageslimit des Workers: Durchgänge pausieren (4.28.0, 11.10.2026)

Der Worker antwortet ab 50.000 geschriebenen Zeilen am UTC-Tag mit 429 und `{ tageslimit: true, retryAfter }` (siehe `docs/wissen/betrieb.md`). `tageslimit.js` (als erstes Skript der Netflix-, Amazon- und Disney+-Gruppe) umhüllt `fetch`, liest nur 429-Antworten des Workers und merkt sich das Ende in `chrome.storage.local` (`akTageslimitBis`). Disney+: `sende` wiederholt nicht und sendet nichts mehr, der Durchgang endet mit „Tageslimit erreicht, weiter ab 02:00" in der Endanzeige. Netflix: `durchlaufMelden`/`randMelden` setzen `DURCHLAUF.abbruch`, das Ende steht im Kasten. Prime: `primeKoordinieren` öffnet keine Frames, solange das Limit gilt; der Lauf bleibt gespeichert und setzt nach Ablauf fort; eine Staffel, deren Frame am Limit scheiterte, geht zurück in den Plan (`zurueckstellen`) und landet nicht im Endvermerk unter „offen (Fehler beim Melden)" (bis 4.29.0: „übersprungen"). Test: `extension/tageslimit.test.cjs`.

## `?gemeldet=` je Durchgang statt je Seite (4.29.0, 11.10.2026)

Anlass: größter D1-Leser des 11.10. war `?gemeldet=<url>` mit 34.761 Aufrufen in einer Stunde (1,60 Mio. Zeilen, Bericht `daniel-zum-abarbeiten/berichte/d1-leselimit-2026-10-11.md`). Ursache (nachgestellter Durchgang mit dem echten Code, jede Seite ein frischer Kontext): Der Durchgang lädt je Titel eine neue Seite, der Modulzustand von `frischGemeldet` (`bekannt`, `keine`) ist dann leer, und `briefkastenHolen()` (Disney+, beim Seitenaufbau und nach dem Melden) bzw. `standHolen()` → `akNetflixUebernahme` (Netflix) fragt jede offene Adresse neu. Gemessen: Disney+ 172 Titel = 30.272 Abrufe (176 je Titel, bei 20 Wiedervorlagen 214 je Titel), Netflix 100 von 244 offenen Titeln = 24.400 (244 je Titel). Dazu fragte der Netflix-Dialog bei jedem Öffnen alle offenen Reihen (`meldungenLaden`, 244).

Jetzt (`disney-netz.js`): `frischGemeldet` legt jedes Ergebnis in `localStorage` der Seite ab (`ak-gemeldet:<Adresse>` = `b<Zeit>` gemeldet, eine Stunde gültig, oder `k<Zeit>` nichts, 30 Minuten = Alter der Liste), geteilt zwischen Seiten und Tabs. Eigene Meldungen gehen über `gemerktesSet().add(...)` (Disney+ `wartetAufUebernahme`, Netflix `frischGemeldetNetflix` über `akNetflixFrischSet`) ebenfalls in die Ablage, damit die nächste Seite sie kennt. Die Wiedervorlagen von Disney+ laufen durch dieselbe Ablage. Der Netflix-Dialog lädt eine Reihe höchstens alle zwei Minuten (`akMeldungenNeuLaden`). Die `keine`-Frist von Disney+ stieg von 2 auf 30 Minuten, die von Netflix von 10 auf 30. Messung nachher (gleiches Skript): Disney+ 674 (3,9 je Titel), Netflix 416; Test `extension/gemeldet-ablage.test.cjs`.

Nachbesserung (Prüfer): Nichtauskunft (HTTP 429/500/1101, Netzfehler) wird nicht abgelegt — `gemeldeteHolen(url, seit, wirf)` (Disney+) und `holen` (Netflix) werfen bei `!ok`, `frischGemeldet` fängt und legt nichts ab (sonst stünde bei gesperrter D1 30 Minuten lang „nichts" und der Durchgang meldete doppelt). Die Ablage kennt `seit`: „gemeldet" gilt nur für Fragen mit gleichem oder früherem `seit`, „nichts" nur für gleiches oder späteres; eine eigene Meldung gilt ab jetzt und überschreibt ein abgelegtes „nichts" sofort. Messung im Repo: `node extension/gemeldet-ablage.test.cjs` gibt für 172 Titel aus (25 s je Titel, 1 Wiedervorlage, 2 `gemeldeteHolen` je Titelseite): ohne Ablage 30.100, mit Ablage 674.

Grenzen: Gebündelter Worker-Weg (`?gemeldet=a,b,c`) würde die Rundgänge weiter senken, braucht aber `INDEXED BY pruefung_url_zeit` (Bericht, PR 839: mehrere Adressen lesen sonst alle offenen Meldungen) und einen Worker-Deploy.

## Serverfehler pausieren wie das Tageslimit; Prime zeigt den Grund (4.29.1, 12.10.2026)

Anlass (Bericht `daniel-zum-abarbeiten/berichte/durchgaenge-nach-tageslimit-2026-10-12.md`): Das D1-Leselimit riss, der Worker antwortete 500 statt 429 mit `tageslimit`. Netflix lief weiter, Prime pausierte stumm, und seine Pille zeigte nur „Titel 86/126 · 344 Seiten gemeldet" – Daniel hielt es für einen Hänger. Jetzt: (A) `tageslimit.js` zählt 5xx auf Meldungen (POST an den Worker, Lesen nicht); die dritte in Folge setzt eine Pause von 30 Minuten mit dem Grund „Server antwortet nicht, nächster Versuch HH:MM", ein Erfolg setzt den Zähler zurück. Die Reihe liegt in `chrome.storage.local` (`akWorkerFehlerReihe`, Art der Pause `akTageslimitArt`), weil jeder Prime-Frame nur wenige Meldungen sendet. Netflix, Prime und Disney+ nutzen die Pause wie das Tageslimit. (B) Prime: der Grund stand bis 4.30.7 als `AK_TAGESLIMIT.vorspann()` im Pillentext („⏸ … · Titel 86/126 · 344 Seiten gemeldet"), seit 4.30.8 steht er im Tooltip (siehe „Prime-Pille bleibt kurz"), `hinweisAnhaengen()` als Zeile im Listenkopf (`dialogFuellen`; der Grund gehört auch in `listenSignatur`, sonst wird der Kopf nicht neu gebaut). (C) Der Endvermerk der Prime-Liste sagt „offen (Fehler beim Melden)" statt „übersprungen": Die Staffeln bleiben offen. Netflix' „übersprungen" (Automatik hat Titel ausgelassen) und Disney+ sind andere Fälle und unverändert. Tests: `tageslimit-serverfehler.test.cjs`, `amazon-tageslimit.test.cjs`. Der Serverfehler-Text unterscheidet sich: Prime macht von allein weiter („nächster Versuch HH:MM"), Netflix und Disney+ enden („Durchgang ab HH:MM neu starten"; Unterscheidung über `location.hostname` in `tageslimit.js`).

## Netflix-Sammeldurchgang: gemischte Randprobe wird voll gemessen (4.30.0, 12.10.2026)

Anlass (Daniel, 12.10.2026, Netflix 80174608): Folge 1 deutsch, Folge 9/10 nicht. `durchlaufStarten` setzte `DURCHLAUF.randOffen` und wartete auf die Grenze im Feld; im Sammeldurchgang („▶ alle durchgehen") bleibt der Titel damit ohne Meldung. Jetzt (`netflix-randvoll.js`, `akNetflixRandUneinheitlich`): Im Sammeldurchgang (`DURCHLAUF.selbst && selbstAn`) setzt die gemischte Randprobe `DURCHLAUF.vollLauf = <Reihe>` statt `randOffen`; `selbstStartenSchritt` hakt die Staffel dann nicht ab (`selbstStaffelnGeprueft`), der nächste Anlauf (1,5 s später) findet sie wieder und `durchlaufStarten` liest den Merker einmal (kein zweiter Anlauf in Schleife, die Randprobe entfällt). Jede Folge wird einzeln gemessen und (ab 4.30.1) gesammelt über `randMelden` gesendet; eine Folge ohne Deutsch wird als „kein Deutsch" gemeldet, nichts wird angenommen. Von Hand gestartet (Knopf, „Alle Staffeln") bleiben Hinweis und Grenzfeld. Last: `randMelden` ruft bei Fehlschlag `AK_TAGESLIMIT.fehlgeschlagen`, Tageslimit und 5xx-Pause (4.29.1) setzen `abbruch`, der Lauf endet. Mehr Anfragen je gemischtem Titel mit N Folgen: N Player-Besuche statt 2 (dieselbe 1-s-Pause und Wartezeit je Folge wie jeder Lauf), POSTs siehe 4.30.1. Prime und Disney+ haben keine Randprobe (`randOffen` steht nur in `melder.js`); dort ist nichts zu ändern. Test: `netflix-gemeldet.test.cjs` (`randvollFaelle`).

## Voller Lauf sendet in Stapeln (4.30.1, 12.10.2026)

Der volle Lauf von 4.30.0 schickte N Einzel-POSTs; jeder las im Worker alle Zeilen der Adresse (`ladeOffeneHashes` in `pruefung-unveraendert.ts`), das Lesen wuchs also quadratisch, und D1-Lesen ist der Engpass. Jetzt sammelt `durchlaufStarten` die gemessenen Folgen (`randErgebnis`, wie bei der Randprobe) und `akNetflixVollMelden` (`netflix-randvoll.js`) sendet sie nach (Deutsch, Tonspuren) gruppiert über `randMelden`, zehn je Stapel. Bei 15 Folgen (1–8 deutsch, 9–15 nicht): 2 POSTs statt 15. Die Notiz lautet „Gemessen im vollen Lauf …" (`akNetflixRandNotiz`), nicht „ANGENOMMEN aus Randprobe": Worker (`pruefung-speichern.ts`) und `fetch-urteile.ts` machen aus jeder Notiz mit „ANGENOMMEN" eine Annahme, auch bei gemessenen Folgen. Nach einem Abbruch (Limit, Worker bestätigt nichts) entfallen die weiteren Gruppen; ein Stopp von Hand löscht den Merker `vollLauf` (`laufBeenden`), und er gilt nur im Sammeldurchgang. Aufgeräumt: `durchlaufStarten` hatte einen ungenutzten Parameter `grenze` (und `RAND`, Umschalt+Klick); einen vollen Lauf von Hand gibt es nicht, der Hinweis nennt nur das Grenzfeld. Test: `netflix-gemeldet.test.cjs` (`randvollFaelle`, mit dem echten `tageslimit.js` für den Limit-Pfad).

## Randprobe: Randfolgen gemessen, Stapel nacheinander (4.30.2, 12.10.2026)

Bis 4.30.1 trug jede Folge einer Randprobe die Notiz „ANGENOMMEN aus Randprobe …“; `pipeline/fetch-urteile.ts` machte daraus auch für E1 und die letzte Folge eine Annahme, obwohl die Meldung (`art`, seit 4.21.0) sie als `gemessen` führte. Jetzt gilt die `art` der Meldung (`artDerMeldung` in `lib/urteil-je-folge.ts`); der Freitext der Notiz zählt nur noch ohne `art` (Erweiterung vor 4.21.0). Die Notiz der zwei Randfolgen beginnt mit „Gemessen in der Randprobe — gemessen: Folge 1 und N …“ (`akNetflixRandNotiz`, Parameter `gemessen`), die der Folgen dazwischen bleibt „ANGENOMMEN aus Randprobe …“.

**Der abgeleitete Weg:** Die Rohfolge derselben Folge (`prime_folge`, `?rohfolgen=1&alle=1`) zählte in `fetch-urteile.ts` immer als gemessen und schlug am selben Tag die Annahme der Meldung. Der Worker liefert jetzt `angenommen` (aus `roh.angenommen`, nur Netflix, sonst `null`); `artDerRohfolge` macht daraus die Art. Ein älterer Worker ohne das Feld ändert nichts. **Worker deployen**, sonst bleibt die Rohfolge-Seite beim Alten.

**Leser der Art:** Worker `pruefung-speichern.ts` (nimmt `art` der Meldung; nur der alte `befund`-Weg ohne `vorhanden` leitet sie noch aus der Notiz ab, das schicken nur Erweiterungen vor 4.21.0), `fetch-urteile.ts` (oben), `tools/poc-urteil/urteil-folge.ts` (nimmt `art` zuerst), `tools/poc-urteil/beobachtungen.mjs` (liest die Notiz aus alten Roh-Dumps; PoC, nicht geändert). Von `data/urteile.json` lesen `tools/daten-detektiv/laden.ts` (nur `art = gemessen` zählt) und `tools/datenqualitaet-messen.mjs`; `urteil-schliesst-luecken.ts` und `11-6-jw-vertrauen.ts` lesen `art` nicht.

**Stapel gehen nacheinander raus** (`randMelden`, vorher `Promise.all`): Bei einer 429 des ersten Stapels (`AK_TAGESLIMIT.fehlgeschlagen`) kommt kein weiterer mehr an den Worker. Ein Netzfehler hält die übrigen weiterhin nicht auf.

**Gemessen, keine Änderung nötig (Rohfolge im Stapel ohne `sprachen`, `roh.player`, `roh.reihe`):** `prime_folge.sprachen` liest nur `fetch-rohfolgen.ts` (Schlüssel der Dublettenprüfung, `folgen[].sprachen` in `prime-zugeordnet.json`) und von dort `rohDeutsch` (`09-3-prime.ts`) sowie `haken-beleg.ts`/`prime-teilseiten.ts` (nur Prime). `rohDeutsch` sucht `includes('Deutsch')`; Netflix schreibt `de|Deutsch`, trifft also nie. `roh.player` und `roh.reihe` liest nichts in Worker, Pipeline oder `shared/` (`roh` selbst geht nur über `?probe=` heraus). Meldungen ohne Staffel nachreichen (`DURCHLAUF.ohneStaffel`) gilt nur für den Einzelweg `durchlaufMelden`, der während der Schleife sendet; `randMelden` sendet erst danach, mit der Staffel aus `meldeZiel`, und dieselbe Staffel stünde bei einem zweiten Versuch wieder da.

**Entfernt (4.30.5, 13.10.2026):** `probeGrenze` und `PROBE_SCHLUESSEL` (`ak-durchlauf-probe`) samt Lesen aus `chrome.storage.local` in `melder.js`; nichts las den Wert. Der Block zeigt nur noch den Knopf nach dem Skriptende. Ein bei Nutzern noch liegender Wert bleibt ungelesen im Speicher. Test: `netflix-gemeldet.test.cjs` (`annahmeFaelle`), `pipeline/check-urteil-art.ts`, `tools/worker-lesezeilen.test.ts`.

## Prime-Sendeweg liest die Folgen, nicht das Sammel-Set (4.30.3, 12.10.2026)

Hell Mode (B0FTW7GP47) ging am 30.08.2026 als „Deutsch“ raus, obwohl alle 12 Folgen nur 日本語 trugen (Bericht `daniel-zum-abarbeiten/berichte/hell-mode-herkunft-2026-10-12.md`). Der Fix vom 30.08. (b81a33288) galt nur der Knopfanzeige; der Sendeweg (`sprachen`, `ton_de` der Meldung) las weiter `gesehen.sprachen`, in das ein Fund ohne Folgennummer schrieb. Die Rückfallebene des Mitlesers, die solche Funde lieferte, ist seit 15.09. weg (141e692d8), der Fehler schlummerte nur.

Jetzt kommen Sprachen und `ton_de` einer Meldung ausschließlich aus `gesehen.jeFolge` (`deutschInFolgen()`, `sprachenAusFolgen()`, beide neben `leererStand()` in `amazon.js`), wie die Knopfanzeige. Das Set `gesehen.sprachen` ist entfernt: Leser waren nur Knopf (Rückfall ohne Folgen), Sendeweg (3 Stellen) und zwei Diagnosefelder (`dataset.diag.sprachen`, Bericht `zaehlstand.sprachen`); beide Felder gibt es nicht mehr bzw. `diag.sprachen` wird aus den Folgen gebildet. Ein Film trägt seine Tonspuren als Einheit 1 in `jeFolge`, braucht das Set also nicht. Ein Fund ohne Nummer zählt weder als Folge noch mit seinen Sprachen. Test: `amazon-kill-blue.test.cjs` („nummernloser Fund“, rot vor dem Fix). Umbau (`deutschInFolgen()` nach oben) und Verhaltensänderung sind getrennte Commits.

## Disney+-Meldung je Folge liest im Worker nur ihre Folge (12.10.2026, ohne Erweiterungs-Release)

Die Erweiterung meldet Disney+ weiter eine Folge je Anfrage und schickt nichts Neues mit. Der Worker suchte dafür bei jeder Meldung alle Zeilen der Adresse (ein Durchgang über n Folgen las rund n² Zeilen, 40.400 bei 200); seit Migration 053 liest er über den Schlüssel (Adresse, Folge, Staffel, Seitenkennung) nur die Zeilen dieser Folge (800 bei 200). Der Weg, offene Hashes in der Erweiterung zu holen und mitzuschicken, wurde verworfen. Die Migration vor dem Worker-Deploy ist empfohlen, nicht zwingend: ohne sie läuft der Worker wie vorher (alle Zeilen der Adresse), ohne Meldungen zu verlieren. Messung, Gegenprobe und Deploy-Reihenfolge: `docs/wissen/betrieb.md`, Abschnitt „Eine Meldung liest nur ihre Folge“.

## Prime-Durchgang: Einträge mit `vorrang` zuerst (4.30.4, 12.10.2026)

Der Durchgang nahm die offenen Titel nach Titelname (`primeNaechsterTitel`). Für die Kanal-Nachmessung (`quellen.md`, Nachtrag 12.10.2026) trägt ein Listeneintrag jetzt `vorrang`
(1 vor 2, ohne Feld zuletzt); `tools/verdacht.mjs` reicht es aus `data/erneut-melden.yaml` durch (`verdachtsFelder()`), `akPrimeVergleich()` in `prime-titelseite.js` sortiert.
Test: `prime-vorrang.test.cjs`. Ohne `vorrang` bleibt die Folge alphabetisch, wie vorher.

## Durchgang: „Erinnern" ohne Folgenliste und „nicht in deinem Gebiet" gehen sofort weiter (4.30.6, 13.10.2026)

**Netflix** (Daniel, 4.30.4, Yu-Gi-Oh! `/title/70177034`): Das Modal zeigt statt „Abspielen" nur „Erinnern", keine Folgenliste, nur „Ähnliche Titel". Die Wartestelle ist die Folgenliste im Durchgang (`selbstStartenSchritt`, `SELBST_LISTE_WARTEN` = 20 s plus Takt, gut 30 s): Die Liste kommt auf so einer Seite nie. Jetzt entscheidet `akNetflixListeWarten()` (`netflix-erinnern.js`, vor `melder.js` geladen) bei jedem Takt: Steht „Erinnern"/„Remind me" (`keineFolgeVorhanden()`, dasselbe Merkmal wie der Knopf „Keine Folge da") und ist die Schonzeit von 3 s um, geht der Durchgang zum nächsten Titel und **meldet nichts** (der Titel steht in der Endliste als übersprungen und bleibt offen). Wie bei Disney+ gilt: Ein Nein hat mehrere Gründe, und das Merkmal (Text im ganzen Seitentext) ist unbelegt; ein Nein meldet weiter nur der Klick auf „Keine Folge da" (`melden()`, die Automatik wurde am 26.08.2026 bewusst entfernt; Prüferbefund zu PR 1133, Entscheidung 13.10.2026). Folge: Eine Serie, deren Folgenliste erst nach der Schonzeit lädt, würde übersprungen statt geprüft, aber nie fälschlich gemeldet. Ohne „Erinnern" gilt die Frist wie vorher. Ein sprachfreies Merkmal (Selektor, Netzwerk, Falcor) ist **nicht belegt**: Es liegt kein Mitschnitt einer solchen Seite vor, und Netflix-Seiten werden nicht abgerufen. Nächster Schritt: bei der nächsten „Erinnern"-Seite den Bericht laden und nach einem Merkmal suchen.

**Disney+** (Daniel, 13.10.2026, 4.30.4): Der Durchgang landete auf `/de-de/home` mit dem Dialog „Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar." (Knopf „OK"). Die Startseite wurde schon seit 4.24.1 übersprungen, aber erst nach 10 s Schonzeit plus Takt (5 s), der Titel stand als „nicht verfügbar (Startseite)". Jetzt erkennt `akDisneyGebietGesperrt()` (`disney-durchgang.js`) den Dialogtext und `takt()` geht ab 1 s auf der Seite weiter, Grund „nicht in deinem Gebiet verfügbar" in der Endliste. Ein Fehlercode aus der Netzwerkantwort liegt nicht vor (kein Mitschnitt), der deutsche Wortlaut ist der einzige belegte Weg. Gemeldet wird wie bisher im Durchgang nichts an den Worker (nur die Endliste); das „nichts da?" in der Übersicht bleibt Handarbeit, weil Disney+ drei Gründe für ein Nein kennt (`quellen.md`, „Disney+ sagt auf drei Arten Nein"). Seit 4.30.9 merkt sich der Durchgang solche Titel zusätzlich 7 Tage lokal, damit nicht jeder Durchgang sie erneut öffnet (Abschnitt unten); auch das meldet nichts. **Überholt seit 4.31.11 (21.10.2026): der Gebiets-Dialog wird gemeldet, siehe Abschnitt „Disney+-Durchgang meldet den Gebiets-Dialog“ unten.**

Die beiden Fälle teilen keine Zeitlimit-Stelle (Netflix: Frist auf die Liste in `melder.js`, Disney+: Seitenzeit in `disney-durchgang.js`), der Fix steht je in der eigenen. Offen: Disney+ `/error?src=bap` (Fehlerseite) wartet im Durchgang weiter die vollen drei Minuten. Tests: `netflix-erinnern.test.cjs`, `disney-durchgang.test.cjs` (jeweils mit Gegenprobe).

## Netflix-Durchgang spielt stumm (4.30.7, 13.10.2026)

Daniel: Der Durchgang öffnet `/watch/<videoId>` (SPA-Sprung per `gehe()`), um die Tonspuren zu lesen, und der Player gab kurz Ton. `netflix-stumm.js` (eigenes Content-Skript, `run_at: document_start`, Isolated World, nur Netflix ohne `/tudum/`) setzt jedes `<video>` auf `/watch/` sofort auf `muted = true`, solange im Tab ein Durchgang läuft (`sessionStorage`-Schlüssel `ak-netflix-lauf`, Frist 6 Stunden, dieselbe Regel wie `selbstAn` in `melder.js`; der Test vergleicht beides). `melder.js` selbst läuft erst bei `document_idle`, da wäre der Player schon da. Gefangen wird über MutationObserver (eingefügte Videos, auch in Containern), `play` und `volumechange` (Capture am Fenster; schaltet Netflix den Ton an, ist er sofort wieder aus). Normales Schauen ohne Durchgang bleibt unberührt.

- **Tonspuren:** kommen aus der Player-Schnittstelle der Seite (`getAudioTrackList()`, `leser.js` in der Seitenwelt), nicht aus dem Ton. Muten des Elements ändert daran nichts; es wird keine Player-Funktion aufgerufen.
- **Zurücksetzen:** nur `muted` am Element, nie `volume`. Die `volumechange`-Ereignisse sieht Netflix im Durchgang nicht (kein Speichern der Stummschaltung als Nutzerwunsch). Ein Takt (`akNetflixStummPruefTaktMs`, 1 s) läuft nur, solange ein Element stumm gestellt ist; endet der Durchgang, bekommt jedes Element, das vorher laut war, spätestens nach 1 s seinen Ton zurück (Test: Schlüssel weg, nächster Takt). Das Element wird beim Verlassen des Players ohnehin ersetzt. **Nicht belegt:** ob Netflix die Lautstärke außerhalb des Elements speichert (kein Mitschnitt; Netflix-Seiten werden nicht abgerufen). Bleibt der Ton nach einem Durchgang weg, im Player einmal die Lautstärke bedienen und melden.
- **Kein Pausieren:** Nach dem Lesen der Tonspuren wird nicht pausiert. Ob `getAudioTrackList()` laufendes Abspielen braucht, ist ohne Mitschnitt nicht belegt, und der Durchlauf liest die Titelzeile („Flg."), die bei laufender Wiedergabe steht. Stumm genügt dem Auftrag (kein Ton).
- **Stumm von Anfang an (4.31.14, 24.10.2026).** Daniel: „beim melden kam ein ton, die extension hat den video player nicht von anfang an gemutet." Ursache aus dem Code, im Browser nicht gemessen: `netflix-stumm.js` (Isolated World) reagiert nur auf Einfügen, `play` und `volumechange`; das Setzen von `muted = false` durch den Player und `play()` auf einem schon laut stehenden Element erzeugen Ton, bevor ein Hörer läuft (Ereignisse kommen asynchron). Neu `netflix-stumm-seite.js` (`world: MAIN`, `document_start`, wie `leser.js`): überschreibt `HTMLMediaElement.prototype.play` und den `muted`-Setter; im Durchgang auf `/watch/` wird vor `play()` stumm gestellt und `muted = false` der Seite zu `true`. Vorher laute Elemente tragen `data-ak-war-laut`; `netflix-stumm.js` gibt ihnen nach dem Durchgang den Ton zurück. Test `netflix-stumm-seite.test.cjs`. **Offen (Messung nötig):** ob der Ton genau so entstand, zeigt nur ein Durchgang mit offener Konsole; Messvorschlag: `HTMLMediaElement.prototype.play` per Konsole mitschreiben (`muted` beim Aufruf) in einem Durchgang ohne diese Datei. **Klasse:** Prime und Disney+ haben keinen Stummschalter (nur Netflix hat einen Durchgang mit Player); Prime-Durchgang öffnet Detailseiten, Disney+ Titelseiten, beide ohne Player-Seite, Vorschauvideos dort sind nicht gemessen.
- Grenze: Nur `/watch/` ist stumm; Vorschauvideos auf Titelseiten im Durchgang sind es nicht.
- Test: `netflix-stumm.test.cjs` (Durchgang stumm, Gegenproben ohne Durchgang / Titelseite / abgelaufen, Zurücksetzen spätestens nach 1 s).
- Offen (Auftrag 31, Nachtrag): `keineFolgeVorhanden()` sucht „Erinnern" weiter im ganzen `body.innerText`. Auf das Titel-Modal einzuengen ist nicht sauber machbar: Im Repo steht kein Mitschnitt und kein Selektor des Modals (nur der Folgenwähler `[data-uia="episode-selector"]`), und bei einem geratenen Selektor würde die Erkennung bei Treffer daneben das echte „Erinnern" übersehen. Nächster Schritt: bei der nächsten „Erinnern"-Seite den Bericht laden, daraus Selektor und Fixture ableiten, dann einengen mit Test („Erinnern" außerhalb des Modals + normale Serie → keine Meldung).

## Prime-Pille bleibt kurz (4.30.8, 13.10.2026)

Daniel (Screenshot 13.10. 18:29): Bei gerissenem Tageslimit lief „⏸ Tageslimit erreicht, weiter ab 02:00 · Titel 202/327 · 450 Seiten gemeldet" über die Pille hinaus. Jetzt zeigt die Pille im Durchgang nur „⏸ 202/327" (ohne Pause „⏹ 202/327"); Grund der Pause, „Titel N/M" und „Seiten gemeldet" stehen im Tooltip (`title`), der Grund zusätzlich als Zeile im Listenkopf (`hinweisAnhaengen`). `vorspann()` in `tageslimit.js` entfällt (einziger Leser war diese Pille). Gemessen mit Playwright gegen `melder.css` (13.10.2026): alter Text 437 px breit bei 1280 px Fenster, bei 360 px Fenster umgebrochen und 47 statt 32 px hoch; neuer Text 90 × 32 px in beiden, `scrollWidth <= clientWidth`. Netflix und Disney+ haben dieselbe Stelle nicht: Ihr Pausengrund steht nie im Knopftext (`AK_TAGESLIMIT` dient dort dem Endgrund im Kasten bzw. dem Netz); ihre Statusknöpfe (Fortschritt, Dreher) sitzen im Kasten und wurden nicht gemessen. Test: `amazon-tageslimit.test.cjs`.

## Drei Befunde aus den Durchgängen vom 13.10.2026 (4.30.9)

Anlass: `daniel-zum-abarbeiten/berichte/durchgaenge-2026-10-13.md`, Abschnitt „Fix nötig“.

- **Disney+: Titel mit Startseiten-Umleitung oder Gebiet-Hinweis ruhen 7 Tage, gemeldet wird nichts (`disney-durchgang.js`, `zurueckstellung`).** Die Wiedervorlage („seit 2026-08-26“) blieb für sechs Titel offen, und jeder Durchgang öffnete sie erneut. Die erste Fassung dieses Abschnitts meldete sie dafür automatisch als „weg“; der Prüfer lehnte das ab (13.10.2026, Entscheidung des Dirigenten): Disney+ nennt drei Gründe für ein Nein (`quellen.md`, „Disney+ sagt auf drei Arten Nein“), die Startseite kann auch „Seite langsam“ oder eine Sitzung sein, und ein falsches „weg“ hielt schon Rooster Fighter zu Unrecht draußen (`datensatz.md`). (Seit 4.31.11 gilt für den Gebiets-Dialog das Gegenteil, siehe unten; Startseiten-Umleitung und Zeitablauf bleiben bei dieser Linie.) Es bleibt also bei der Linie von 4.30.6: **Nichts geht an den Worker**, „nichts da?“ ist ein Klick von Hand. Statt dessen merkt sich der Durchgang die Adresse nur lokal (`localStorage` der Disney+-Seite, Schlüssel `ak-disney-zurueck`, Adresse → Zeit) und öffnet sie 7 Tage lang nicht wieder; danach fragt er neu (Disney+ kann den Titel aufnehmen). Die Wiedervorlage selbst bleibt offen, der Knopf „Anime-Kalender: N offen“ zählt sie weiter. Das Ende nennt sie unter „N zurückgestellt (7 Tage, …)“, im Lauf selbst stehen sie wie bisher mit Grund unter den übersprungenen. Nicht belegt: ob die Startseiten-Umleitung immer „nicht verfügbar“ heißt; das ist nach der Rückstellung ohne Folgen für den Datensatz, kostet im Zweifel eine Woche bis zur nächsten Prüfung.
- **Alte Seite zählt nicht (`seitenStart`).** Nach `oeffne` läuft die alte Seite (mit dem Hinweis bzw. der Startseite) bis zum Seitenwechsel weiter, und `takt` las ihren Zustand für das neue Ziel: Ein Takt in dieser Lücke hätte den nächsten, verfügbaren Titel zurückgestellt (oder den Lauf „von Hand übernommen“ beendet). Jetzt gilt der Zustand nur, wenn das Dokument nach dem Öffnen des Ziels geladen wurde (`Date.now()` beim Laden des Skripts ≥ `seiteSeit`). Die Titelkennung taugt dafür nicht: `/home` hat keine. Die Frist von drei Minuten gilt unabhängig davon. Ein Hänger (`wegFuer` ohne Antwort, `fetch` ohne Frist) entfällt mit dem Meldeweg: `takt` kehrt nur zurück, nachdem der Lauf weitergegangen ist oder endete, und es gibt keinen Zustand, der einen Seitenwechsel überlebt. Tests: `disney-durchgang.test.cjs` (Startseite, Gebiet, 7 Tage knapp davor/danach, alte Seite, Frist von drei Minuten, Verdrahtung; ohne den Fix rot).
- **Netflix-Bericht nennt Gründe und offene Titel.** `selbstUebersprungen` (`melder.js`) ist eine Map Kennung → Grund: „keine Folgenliste in 20 s“ und „Erinnern statt Folgenliste“ (`netflix-erinnern.js`), „nach N Versuchen noch offen“ (bei gerissenem Tageslimit mit dessen Text, `akNetflixGrundOffen`), „fertig“ für abgeschlossene Titel. Der Bericht (`nfBericht().durchgang`) schreibt `uebersprungen` als `[{ reihe, titel, grund }]` statt als Kennungen und führt `offen` als Liste `[{ reihe, titel }]` (dieselbe Rechnung wie die Knopfzahl, `fertig()`), nicht nur `listeGesamt`. Die Bausteine stehen in `netflix-bericht.js`, die aus `melder.js` ausgelagerte Prüflisten- und Staffelauskunft ebenfalls (Umbau-Commit 7d09d55e7, gleiche Werte wie vorher). Tests: `netflix-bericht.test.cjs`, `netflix-erinnern.test.cjs`, `netflix-protokoll.test.cjs`.
- **Prime: „Fehler 429“ auf der letzten Seite zählt nicht als übersprungen.** Ein Frame kennt die 429 sofort, die Seite erst über `chrome.storage`. Kam seine Antwort davor, war `zurueckstellen()` auf der Seite noch falsch und die Staffel stand unter „übersprungen“ (im Sandkasten nachgestellt: „Naruto · Staffel 9“ mit „Fehler: Fehler 429“). Jetzt trägt die Antwort des Frames seine Pause (`limit`, `AK_TAGESLIMIT.rest()`), die Seite übernimmt sie sofort (`AK_TAGESLIMIT.ausFrame()`), stellt die Staffel zurück und zeigt „Tageslimit erreicht, weiter ab …“ als Grund der Seite in der Spur. Nicht belegt: ob die 9 übersprungenen Seiten vom 13.10. (JoJo, Tokyo Ghoul, Captain Tsubasa, Kuroko) dieselbe Ursache hatten; ihr Grund steht nicht im Bericht (die Spur zeigt ab jetzt „Fehler …“ nur, wenn der Frame kein Limit sah). Tests: `tageslimit.test.cjs`, `amazon-durchgang.test.cjs`.

## Netflix-Durchgang: übersprungene Titel bleiben zurückgestellt (4.31.3, 15.10.2026)

Anlass: `daniel-zum-abarbeiten/berichte/netflix-wiederholer-2026-10-15.md` (Yu-Gi-Oh!, Pokémon Sonne & Mond kamen bei jedem „alle durchgehen“ wieder). `selbstUebersprungen` in `melder.js` ist jetzt eine `Map` aus `netflix-zurueckgestellt.js` (`akNetflixZurueckNeu`), deren Einträge zusätzlich mit Ablauf in `chrome.storage.local` liegen (`netflixZurueckgestellt`, `{ Kennung: { grund, bis } }`, je Browser-Profil, kein Worker, keine D1). `has()` kennt die gespeicherten Einträge, daher überspringt `naechsterAuftrag()` sie unverändert; `clear()` beim Start eines Durchgangs leert nur den Arbeitsspeicher. Ablauf: „Erinnern“ mit erkanntem Datum bis zu diesem Tag 00:00 Berlin (ohne Jahr nur ein Datum von heute an; ein vergangenes gilt als unlesbar), ohne lesbares Datum 7 Tage, „keine Folgenliste“ und „nach N Versuchen offen“ 1 Tag, nie mehr als 30 Tage (Prüfer-Befund PR 1285: „Ab 14. Oktober“ am 15.10. hätte sonst bis 2027 gesperrt). Raus fliegt ein Eintrag bei Ablauf, bei Grund „fertig“ und wenn `fertig()` (Worker-Stand) den Titel als gemeldet führt. Die Endanzeige hängt „· N zurückgestellt“ an (nur offene Titel der Prüfliste, die nicht schon namentlich unter „übersprungen“ stehen); findet der Durchgang beim Start keinen Auftrag, aber zurückgestellte offene Titel, heißt der Knopf „alle offenen zurückgestellt“ statt „nichts offen — Seite neu laden“ (`keinAuftrag()`). Nicht belegt: ob „Erinnern“ ein lesbares „Ab …“-Datum trägt (`erscheinungsdatum()` ungemessen); fehlt es, gelten 7 Tage. Eine Rücknahme von Hand gibt es nicht (Speicher löschen oder Ablauf abwarten). Test: `netflix-zurueckgestellt.test.cjs`.

## Prime-Stand aus dem gecachten Briefkasten statt der Token-Liste (4.31.4, 15.10.2026)

`standVomWorker()` (`amazon.js`) holte bei jedem Prime-Seitenaufruf `GET /pruefung?token=…` — die ungecachte Liste der offenen Meldungen (`offenePruefungen()`, `titelzeile-lesen.ts`). Live gemessen (D1-Insights, 15.10.2026 12:40): rund 36.000 gelesene Zeilen je Aufruf, im Prime-Durchgang 70 Aufrufe je Stunde = 2,7 Mio. Zeilen. Jetzt ruft er `?zaehlen=1&nummern=1` ab, wörtlich dieselbe Adresse wie `disney.js` (Edge-Cache zwei Stunden, ein Schlüssel für beide) und rechnet die Einträge in `prime-stand.js` um. Lokal gemessen (miniflare, `meta.rows_read`, Bestand ~10.000 Altzeilen + 26.000 Titelzeilen-Folgen): alt 53.200 Zeilen bei jedem Aufruf, neu 30.761 beim ersten Aufruf je Rechenzentrum und zwei Stunden, danach 0. Preis: Die Antwort trägt keinen Befund und keinen Serientitel; Staffeln aus fremden, noch nicht übernommenen Meldungen stehen deshalb als „✓“ statt 🇩🇪/✕, die eigenen behalten ihren Befund (`akPrimeStandVereinigen()` in `prime-stand.js`, früher `vereinige()` in `amazon.js`, lässt den lokalen Befund vorgehen; die Folgenzahl ist die größere von lokal und Worker, siehe Nachtrag). Die alte Liste endete außerdem nach den 500 ältesten offenen Meldungen aller Anbieter; `?zaehlen=1&nummern=1` hat diese Grenze nicht. Test: `prime-stand.test.cjs`.

Nachtrag (15.10.2026): Auch `briefkastenHolen()` ruft jetzt `?zaehlen=1&nummern=1` statt `?zaehlen=1` — die Antwort mit `nummern=1` trägt jedes Feld der Antwort ohne, mit gleichem Wert (`tools/worker-zaehlen-nummern.test.ts`, in `check:worker`), also ein Cache-Schlüssel statt zwei. Beide (`standVomWorker()` und `briefkastenHolen()`) rufen ohne `cache: 'no-store'` ab: Die Edge hält die Antwort ohnehin 7200 s (`ZAEHLEN_SEKUNDEN`, beim Melden nicht gelöscht), `no-store` holte also nichts Frischeres, nur dieselben 3,2 MB jede Minute neu; so greift der Browser-Cache nach dem max-age der Edge (Test in `prime-stand.test.cjs`). `disney.js` ruft noch mit `no-store` ab. Die eigene Meldung schreibt ihre geladene Folgenzahl lokal nach `erledigt[].folgen` (`akPrimeMeldungEintragen` in `prime-stand.js`), damit „E1–N“ stehen bleibt: der Briefkasten kennt sie bei einheitlicher Staffel nicht (ohne `folge_nr`; Test in `amazon-uebersicht.test.cjs`, Block 2g).

Nachtrag (15.10.2026, CI-Prüfer, 4.31.4): Die Zusammenführung ließ bei `folgen` den Worker-Wert vor dem lokalen gehen: Eine fremde Teilmeldung (höchste `folge_nr` 3) kürzte das lokal gemerkte „E1–12“ der eigenen Meldung auf „E1–3“ (nachgestellt in `prime-stand.test.cjs`, vor dem Fix rot). Jetzt gilt je Staffel das Maximum beider, der Befund (🇩🇪/✕) bleibt der lokale. Die Funktion zog dafür aus `amazon.js` nach `prime-stand.js` (`akPrimeStandVereinigen`, Umbau-Commit af94010c7, unverändert) und ist ohne die große Seite testbar.

## ADN: nur melden, was der Worker je Zeile angenommen hat (4.31.5, 16.10.2026)

Ein Stapel an `/pruefung` antwortet mit HTTP 200 und `{ ok: true, ergebnisse: [{ ok, befund } | { ok: false, status, grund }, …] }`, eine Eintragung je gesendeter Meldung in derselben Reihenfolge (`worker/src/pruefung-stapel.ts`). `adn.js` wertete bisher nur den HTTP-Status aus und zeigte „✓ n gemeldet", auch wenn Zeilen abgelehnt waren. Jetzt zählt nur `ergebnisse[i].ok`; abgelehnte Zeilen bleiben offen, der Kasten nennt Zahl und Grund und sendet sie auf Klick erneut. Fehlt die Ergebnisliste, gilt jede Zeile als abgelehnt. Kennt `?gemeldet=` schon alle Zeilen, geht kein POST raus und der Kasten sagt „schon gemeldet". „Nicht im Angebot" ist eine Einzelmeldung (kein Stapel): dort genügt der HTTP-Status, der Fehlertext des Workers (`error`) steht jetzt im Kasten. Netflix (`melder.js`) liest `ergebnisse[i].ok` bereits.

## Die Erweiterung verändert die Fremdseite nicht: `html.ak-zu` traf den X-Knopf-Stil (4.31.6, 16.10.2026)

Daniel (ADN, 4.31.4): Beim Aus- und Einklappen des Kastens wechselten Logo-Abstand, Badge-Abstände, Zeilenhöhe der Beschreibung und Knopfgrößen der ganzen Seite. **Ursache:** `box.js` setzte beim Einklappen die Klasse `ak-zu` an `<html>`; `melder.css` kannte `.ak-zu` seit dem Übersichtskasten (67f7fdc87) als Stil des X-Knopfs im Dialog (`font-size: 22px; line-height: 1; border: 0; background: none`). Die Regel traf damit das Wurzelelement: eingeklappt hatte `<html>` 22 px und Zeilenhöhe 1, alle rem-Größen der Seite hingen daran. **Klasse (gemessen):** `melder.css` gilt auf allen vier Seiten (Netflix, Disney+, Prime, ADN) und trägt 202 Selektoren, alle mit `.ak-`/`#ak`/`html`-Anfang; von den sechs Wurzelklassen (`ak-eingeklappt`, `ak-durchgang`, `ak-im-player`, `ak-icon-da`, `ak-amazon`, `ak-ruhig`) kollidierte nur `ak-zu`. Das Leck bestand seit 4.24.17 (09.10.2026, #584) auf allen Seiten, ADN zeigte es nur zuerst. **Schluss:** die Wurzelklasse heißt `ak-eingeklappt`, der X-Knopf-Stil gilt nur für `button.ak-zu`, und `extension/html-klassen-kollision.test.cjs` bricht, wenn eine Regel in `melder.css` allein (ohne Vorfahren) auf eine Klasse zielt, die ein Skript an html/body hängt. **Lehre:** Eine Klasse am Wurzelelement ist ein globaler Name; Stilregeln brauchen immer einen Vorfahren, und ein Test mit Fake-`document` sieht keine Stil-Kollision.

**Prüfliste auf ADN:** steht seit 4.31.6 im Kasten wie auf den anderen Anbietern, aber leer: „Prüfliste: leer, ADN meldet je Video" (Daniel, 16.10.2026, Dorohedoro). ADN führt keine Liste (kein `offene-adn.js`); `adn.js` zeichnet nur den gesperrten Knopf (`prueflisteZeigen`) in `.ak-such-fuss-mitte`, Test in `adn.test.cjs`. Eine echte Liste für ADN wäre ein eigener Auftrag.

## Prüfliste nur als letzter Ausweg: kein „Sprache offen“ fällt durch beide Netze (16.10.2026)

**Regel (Daniel, 16.10.2026, gilt für alle Titel):** Die Prüfliste (manueller Weg) kommt nur in Frage, wenn keine Quelle für Deutsch bei diesem Anbieter verlässlich ist; vorher wird die Bestätigung automatisch woanders geholt. Folge: Ein Eintrag „Sprache offen“ ist belegt (Handbeleg, Urteil, „Deutsch laut JustWatch“) **oder** steht auf der Prüfliste — beides nicht ist ein Fehler.

**Anlass:** Murder Drones (Cartoon, Prime Video): oben „Deutsche Fassung laut JustWatch“, beim Anbieter „Sprache offen“, in der Erweiterung nicht auf der Prüfliste zu finden. **Befund:** Der Titel steht auf der Prüfliste (`extension/offene-amazon.js`, Quelle `justwatch`, Stufe `ungeprueft`, seit 11.10.2026, #788); die Erweiterung blendet erledigte Einträge standardmäßig aus (`fertig()` → `standZiele` aus dem Worker: Liste minus Meldungen seit dem Prüfstand), die Suche sieht sie dann nicht. Ob der Worker die Adresse als gemeldet führt, ließ sich ohne Meldungskopie nicht prüfen (kein `LAUF_TOKEN`).

**Warum Murder Drones kein „Deutsch laut JustWatch“ am Anbieter trägt:** Oben stammt aus `Title.dubHinweis` (JustWatch nennt Prime *für die Serie*, `anbieter` ist je Anbieter gefiltert: Flatrate mit `de` unter `audio`). Die Zeile beim Anbieter zeigt nur einen Beleg am Weg (`dub`) oder `dubQuelle: 'justwatch'`; der Bau setzt Letzteres für Prime nur bei Anime (`11-6-jw-vertrauen.ts`, 99,4 % bei n = 468, Test `check-jw-vertrauen-bestand.ts` hält Cartoons ausdrücklich heraus) und bei Cartoons mit mindestens zwei JustWatch-Staffeln je Staffel (`bau/cartoon-wege.ts`). Für Cartoons fehlt die Messung (Stichprobe 50 + 50, siehe oben); 134 Prime-Cartoon-Wege erfüllten die Regel heute, bleiben aber bewusst auf der Prüfliste. Der Widerspruch oben/unten ist damit gewollt, aber nicht erklärt: ob die Zeile beim Anbieter „laut JustWatch“ zeigen soll, wo `dubHinweis` genau diesen Anbieter nennt, ist eine eigene Entscheidung (betrifft mehrere hundert Cartoon-Wege), nicht Teil dieses Wächters.

**Wächter:** `pipeline/lib/sprache-netz.ts` zählt wie die Oberfläche (`streamStatus`: kein `dub`, kein JustWatch-Stand, nicht „nur Untertitel“; je Titel × Anbieter einmal) und ordnet jeden offenen Eintrag einer Klasse zu: `liste` (auf der Prüfliste von Netflix, Prime, Disney+), `geprueft` (Handbeleg/Urteil des Titels oder angesehene Seite, Urteil landete bei einem anderen Titel), `wartet` (nicht genug Folgen erschienen), `ohne-liste` (Anbieter ohne Prüfliste), `ohne-adresse` (Listenanbieter, aber nichts zu öffnen), `luecke` (Listenanbieter mit Adresse, weder Beleg noch Liste). `check-sprache-netz.ts` (`check:logic`) rechnet die Regeln an Fällen nach, darunter Murder Drones; `tools/sprache-netz-bestand-pruefen.mjs` (`check:bestand`, läuft im Bestandsbau über `commit-data.sh`) wird rot bei jeder `luecke` und gibt die Zählung je Klasse und Anbieter aus (`--bericht`: jede Lücke mit Titel). `ohne-liste` und `ohne-adresse` sind nur gezählt, nicht rot: dort gibt es keine Liste, die den Eintrag aufnehmen könnte, und eine Zunahme würde den Bestandsbau sperren.

**Stand 16.10.2026 (820 Einträge „Sprache offen“, Titel × Anbieter):** `liste` 558, `geprueft` 75, `wartet` 5, `luecke` 0, `ohne-liste` 121 (RTL+ 65, WOW 32, Crunchyroll 10, Joyn 8, YouTube 6), `ohne-adresse` 61 (Disney+ 20, Netflix 15, Prime 26). Diese 182 sind die offene Gruppe: kein Beleg, keine Prüfliste, und eine Quelle, der man für Deutsch beim Anbieter voll trauen könnte, gibt es im Repo nicht (JustWatch ist für Cartoons ungemessen, für Netflix nennt es nie einen Ton). **Lehre:** Eine Prüfliste, die nur drei Anbieter und nur Wege mit Adresse kennt, ist kein Netz für „Sprache offen“; wer eine Anzeige „offen“ einführt, muss mit ihr zählen, wer sie beantworten kann.

**Die 61 „ohne Adresse“ (gemessen 16.10.2026, Adressen aus `data/`, `public/data/` und den Terminen; keine Abrufe):** 42 sind Cartoons, deren Weg nur aus TMDB stammt (`url: ''` mit Absicht, `lib/cartoons.ts`); JustWatch hat zu allen 42 keinen Treffer oder kein Angebot beim Anbieter, es gibt nirgends eine Adresse. 19 sind Anime-Wege aus Kalenderterminen (`bau/11-7`). Davon trugen 5 Prime-Wege (Samurai Girls, Samurai Girls 2, Danganronpa, Demon Slayer Swordsmith Village und Hashira Training) die Adresse schon als Bezugsweg „Amazon Prime (Kanal)“ im selben Titel: Lücke im Bau, geschlossen durch `bau/13-1-weg-adresse-bezugsweg.ts` (Wege kommen nach dem nächsten Bestandsbau samt `data:extension-liste` auf die Prüfliste). Mehrdeutig bleiben 3 Demon-Slayer-Titel (zwei Kanäle), ohne jede Adresse 11 (Disney+ nur Suchadresse des Termins, Prime-Kanal-Termine ohne Bezugsweg, Netflix nur Startseite); danach bleiben 56 von 61 ohne Adresse (sechs Wege bekommen eine Adresse, einer davon ist schon geprüft). **RTL+, WOW, Crunchyroll, Joyn, YouTube (121):** die Erweiterung hat nur Inhaltsskripte für Netflix, Amazon, Disney+ und ADN (`manifest.json`); die Prüfliste kann diese Anbieter nicht aufnehmen, ein Bau wäre ein eigenes Vorhaben (Leser je Anbieter), nicht Teil dieser Änderung.

## Netflix-Meldung trägt die Staffel: Nummer und Menütext (4.32.0, 16.10.2026)

Netflix hat **eine Adresse für alle Staffeln**; im Auswahlfeld steht „Staffel N (X Folgen)", die Nummer links in der Folgenliste zählt je Staffel neu, das Kästchen neben „Staffel N:" ist die Altersfreigabe (Daniel, Vinland Saga, The Dangers in My Heart). **Das Wort ist beliebig:** Unicorn Academy heißt „Kapitel 1" (Screenshot 16.10., 21:13), andere „Teil", „Volume", „Season" — gelesen wird die Zahl nach dem ersten Wort, nachdem „(M Folgen)" abgezogen ist (`extension/netflix-staffel.js`, `akNetflixStaffelNr`). Benannte Staffeln („Golden Wind") haben keine Nummer.

- **Erweiterung:** Jede Rohfolge trägt `staffelNr` (Kennungen aus dem Player > Menüeintrag mit genau dieser Folgenzahl > Anzeige im Feld, wenn sie zur Folgenzahl passt; bei zwei Staffeln gleicher Länge ohne Kennungen leer) und `staffelText` = Menüeintrag samt „(M Folgen)". Der Durchlauf öffnet dazu einmal das Staffelmenü (`netflixStaffelnImMenue`). Der Worker legt beide Felder schon ab (`ROH_FELDER`), Test `extension/netflix-staffelwahl.test.cjs` liest die Feldnamen aus `worker/src/pruefung-rohfolgen-speichern.ts`.
- **Bau:** `pipeline/lib/netflix-staffeln.ts` teilt eine Netflix-Adresse nach Staffel (Schlüssel `url#s<N>`) und vergibt `titel_id`: Netflix-Staffel N = unser N-ter Serien-Titel an der Adresse (nach Erstausstrahlung, ohne Film/Special), wenn dessen Folgenzahl genau die des Menüeintrags ist. Geht nur eine Staffel nicht auf, bleibt die Adresse unberührt. Eine so zugeordnete Gruppe ohne Anker belegt die Sprache für den Titel (`unsere: null`), keine Folgennummer wird erfunden. Checks: `check-netflix-staffeln.ts`, `check-netflix-staffel-ablauf.ts`.
- **Nicht gelöst:** Doppelstaffeln (Mushoku Tensei: Netflix-Staffel = zwei unserer Cours, F23) bleiben wie bisher offen; zwei Staffeln gleicher Länge im „Alle Folgen anzeigen" ohne Player-Kennungen bekommen keine Nummer.

**Nachbesserung (16.10.2026, Prüfer zu PR 1390):** `staffelText` trägt die Länge des Menüs (`Staffel 2 (13 Folgen) · von 7`); der Bau ordnet nur zu, wenn unsere Serienzahl an der Adresse genau diese Länge hat — My Hero Academia führt bei uns an der Adresse nur Staffel 1 und 6, Netflix sieben, und Netflix-Staffel 2 (25 Folgen) wäre sonst unsere Staffel 6 geworden. Zeilenzahl und höchste Folgennummer einer Staffel dürfen die Folgenzahl im Text nicht übersteigen (sonst stammen Text und Nummer aus verschiedenen Staffeln). Nummer und Text kommen aus demselben Menüeintrag; das gemerkte Menü gilt nur für die Reihe, aus der es gelesen wurde (`akNetflixMenue`). Gemessen an `public/data/titles.json`: 48 Netflix-Adressen mit mindestens zwei Serien und eindeutigen Jahren, 25 davon mit einer Serie derselben Franchise außerhalb der Adresse — bei diesen entscheidet allein die Menülänge.

**Runde 3 (16.10.2026, Prüfer zu PR 1390):** Die Zuordnung verlangt zusätzlich, dass unsere Folgenzahlen **Position für Position** Netflix' Staffelliste gleichen (`data/anbieter-staffeln.json`, Argument `listen` von `teileNachNetflixStaffel`); fehlt die Liste für die Adresse oder zählt sie nicht lückenlos von 1, bleibt die Adresse unberührt. Grund: Devil May Cry (`81506915`) hat bei uns [12, 8], Netflix [8, 8] — Serienzahl und Menülänge stimmen (2 = 2), und Netflix-Staffel 2 (8 Folgen) wäre sonst die 2025er Serie, unsere Staffel 1 geworden. Gemessen an 53 Netflix-Adressen mit mindestens zwei Serien und Liste: vorher 30 (alle Staffeln gemeldet) bzw. 31 (nur die letzte) zugeordnet, nachher 30 bzw. 30; verloren geht genau Devil May Cry, gewonnen nichts. Die Erweiterung schickt bei benannten Staffeln („Golden Wind") keine Nummer mehr aus unserer Zählung neben Netflix' Text.

## Melde-Knopf nach „gemeldet ✓" gesperrt: `melde-sperre.js` (4.31.7, 16.10.2026)

Daniel (Prime, Arifureta, 21:19/21:22): Nach der Meldung stand „gemeldet ✓", der Knopf blieb klickbar und meldete erneut — Staffel 1 (Deutsch) und Staffel 2 („nicht mehr verfügbar"). **Ursache:** `amazon.js` gab den Knopf 1,2 s nach der Antwort mit `knopf.disabled = false` frei, und `zeichnen()` beschriftet ihn aus ~40 Zweigen neu; die Sperre hing am Zustand der Zweige (`schonGemeldet`, `!nichtAngekommen()`, `!seiteOffen()`), nicht an der Meldung. **Klasse:** von neun Knöpfen, die senden, hatte nur dieser eine die Lücke; ADN und Disney+ setzen den Knopf je Zustand (`klick = null` → gesperrt), Netflix sperrt über `gesendet`, die Listen-Knöpfe („nichts da?", „✕", „Nicht bei Prime — melden") bleiben nach Erfolg `disabled`. **Fix:** `melde-sperre.js` — die Meldung vermerkt den Befund (Adresse + Staffelnummer + Tonurteil), `zeichnen()` legt danach die Sperre an (`disabled`, `aria-disabled`, „gemeldet ✓"), der Klick-Handler ist mit `mitSperre` umhüllt (hält auch einen Klick aus dem Code auf). Frei wird der Knopf bei anderem Befund, oder nach 120 s, wenn der Briefkasten die Meldung nicht kennt (`FRIST_MS`). ADN/Disney+ gehen über `setzeKlick`. **Wächter:** `melde-sperre.test.cjs` spielt den echten Code je Anbieter (zweiter Klick meldet nichts, Frist, Befundwechsel). **Regel:** Wer einen Knopf baut, der sendet, sperrt ihn an der Meldung, nicht am Zustand der Anzeige; Neuzeichnen darf die Sperre nie aufheben. `gemeldetFuerPfad` entfiel — die Marke „gemeldet ✓" trägt jetzt der gesperrte Knopf selbst.

## Das Urteil erreicht auch spät entstandene Wege (17.10.2026)

Bestandsbau rot: `spracheOffenTrotzMeldung` 19 Treffer, erlaubt 7 (12 neue Prime-Wege, sichtbar nach den neuen Urteilen aus `folgen-zuordnung.json`). **Ursache:** `urteilSchliesstLuecken` läuft in Phase 10; JustWatch-Wege (11-2: Trigun, Digimon, Yu-Gi-Oh! Zexal II, Urusei Yatsura) und Termin-Wege (11-7: fünf Demon-Slayer-Titel, Samurai Girls 1/2, Danganronpa) entstehen danach und bekamen das Urteil nie. **Fix:** `urteilSchliesstSpaeteLuecken` in `13-schreiben.ts`, nach der Anreicherung (13-1 setzt `kanal`) und vor dem Kanal-Erbe; ein Termin-Weg mit Urteil verliert `herkunft: 'termin'`. Bau und Prüfung fragen dasselbe Prädikat (`lib/urteil-weg.ts`): kein Ja auf einem Prime-Kanal (Handbeleg-Adresse oder `kanal` am Weg) und keins, wenn alle Termine des Anbieters `sprache` tragen (sonst bricht `deutschNurAusSpracheTermin` ab). Ein gemischtes Urteil (Trigun: einzelne Folgen „nicht verfügbar“, die übrigen deutsch) ist ein Ja: „nicht verfügbar“ sagt nichts über den Ton. **Bilanz** (Bau-Vergleich d06dbfa17 gegen den Fix, Prüfung auf beiden Ausgaben): 19 → 4 (die vier Netflix-Cartoons aus der alten Grenze). **Offen:** Phase 10 wendet das Urteil weiter ohne die Sprach-Termin-Ausnahme an; ein Kanal-Ja aus Rohfolgen behandelt PR 1394.

## „nichts da" nimmt den Titel sofort aus der Liste: Netflix und Disney+ (4.31.9, 21.10.2026)

Daniel (21.10.2026, 03:02): Drei Netflix-Titel (AnoHana, Bakugan, Banana Fish) leiten auf `/browse` um; die Meldung „als nicht bei Netflix gemeldet" ging durch, die Zeile blieb. Bei Disney+ blieb sie nach „nichts da?" ebenfalls stehen. **Ursachen (am Quelltext belegt):** Netflix: `fertig()` liest bei vorhandenem Stand nur `standZieleNetflix`, `frischGemeldetNetflix` und `akNetflixWartet`, nie `erledigt.tot`; `totMelden` trug nichts davon ein. Jetzt trägt `akNetflixTotGemeldet` (`netflix-uebernahme.js`) die Reihe vor dem Speichern ein. Disney+: `?gemeldet=` liefert nur Meldungen mit Folgennummer (`pruefung-gemeldet.ts`, `folge_nr IS NOT NULL`); ein „nein" hat keine, und eine Wiedervorlage (`seit`) zählt ausschließlich diese Paare. Jetzt merkt `disney-weg.js` die eigene Antwort lokal (`localStorage`, Adresse → Zeit, 30 Tage) und gilt sie gegen `seit` (nur eine Antwort nach der Wiedervorlage beantwortet sie). Eine Antwort 503, Netzausfall oder fehlender Token merkt nichts. **Nicht geändert:** der Disney+-Durchgang meldet weiterhin nichts selbst (Entscheidung 13.10.2026, drei Gründe für ein Nein in `quellen.md`); Daniel wünscht es (21.10.2026), das ist eine Umkehr und steht offen. Test: `extension/nichts-da-sofort.test.cjs` (Netflix, Disney+, Gebiets-Dialog). **Offen, Prime:** Suchzeilen kehren nach der Meldung zurück (`inGemeldeteSuchen` false trotz „gemeldet ✓"); Ursache noch nicht belegt.

## Disney+-Durchgang meldet den Gebiets-Dialog (4.31.13, 21.10.2026)

Daniel (21.10.2026, 03:04): Sechs Titel (Aoashi, Chainsaw Man, Children of the Sea, Fire Force S3, One-Punch Man S3, Shield Hero S2) zeigten beim Öffnen „Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar.“; er prüfte alle von Hand, alle nicht da, und erwartete, dass „alle durchgehen“ sie entfernt. **Entscheidung (Dirigent, 21.10.2026, 03:26): Umkehr der Linie vom 13.10.2026.** Der Durchgang meldet jetzt, und nur dann: `takt()` sieht den Dialogtext (`akDisneyGebietGesperrt`, ab 1 s auf der Seite) und ruft den Gebiets-Weg der Seite (`AK_DISNEY.meldeGebiet` → dieselbe Meldung wie „nichts da?“, `akDisneyWegSenden`). Kommt sie an, steht der Titel im Ende unter eigenem Zähler „N als „nicht in deinem Gebiet verfügbar“ gemeldet“ (`info.gebiet`), ist lokal 7 Tage zurückgestellt und fällt dank `disney-weg.js` aus der Liste. Kommt sie nicht an oder wirft der Weg, steht er unter „übersprungen“ mit dem Grund „Meldung kam nicht an“; bleibt die Antwort ganz aus, greift nach 3 Minuten die Seitenfrist („kein Ergebnis nach 3 Minuten“). **Weiter nichts automatisch „weg“:** Startseiten-Umleitung ohne Dialog und „kein Ergebnis nach 3 Minuten“ melden nichts (Gegentest für den Fall, der Rooster Fighter zu Unrecht draußen hielt, `datensatz.md`, 02.10.2026). Die drei möglichen Gründe hinter der Meldung (Standort, Altersfreigabe, Abo, `quellen.md`) bleiben unentschieden; die Notiz der Meldung sagt wie bei „nichts da?“ nur, was Disney+ selbst meldet. Tests: `disney-durchgang.test.cjs` (Gebiets-Fälle async, Gegentests), `nichts-da-sofort.test.cjs` (Gebiets-Weg der Seite).

## Zählregel der Statusanzeige: Hauptzahl = Erweiterungsknopf (4.31.15, 24.10.2026)

Daniel (24.10.2026, seit Tagen): Netflix Pille „46 offen · 27 Titel · 19 ohne Kennung“, Knopf 5 (nach dem Durchgang 0); Disney+ Knopf 1, Pille 27; Prime Knopf 32, Pille 50. **Regel:** Die Hauptzahl der Pille ist `titel` (Titelseiten, die ein Knopf zählt). Suchadressen und Verweise ohne Kennung (`ohneSeite`) zählt kein Knopf; sie stehen im Tooltip. **Bestandteile (Worker-Antwort 24.10.2026, 01:24 Z):** Prime titel 32 + ohneSeite 18 (Knopf 32); Netflix titel 22 + ohne Kennung 19; Disney+ titel 7 + ohne Kennung 20 (Knopf 1, danach 0). **Netflix-Rest:** `durchgang-zaehlung` 01:10 Z `gemessen 5, wartend 22` — die 22 waren gemeldet (Briefkasten deckt jede offene Staffel), der Worker zog nur Meldungen seit dem Prüfstand-Bau ab. Jetzt rechnet der Worker die Deckung (`worker/src/pruefung-gedeckt.ts`, gleiche Regel wie `akNetflixStaffelnGedeckt`) und nimmt gedeckte Ziele aus `ziele`/`titel`; D1: eine Abfrage über die Primärschlüssel der Netflix-Ziele (`SEARCH titel_zeile USING PRIMARY KEY`, höchstens 62 Titelzeilen, kein `json_each` über Folgen). Wächter `tools/worker-netflix-zahl-gleich.test.ts` (in `check:worker`): Worker-Titelzahl = Knopfzahl an denselben Daten, Nichtauskunft, Sitzungsmeldung; Prime/Disney: `titel` ohne Suchen/ohne Kennung. **Offen:** Disney+ rechnet lokal zusätzlich mit `AK_DISNEY_WEG` („nicht in deinem Gebiet“, nur im Browser); ob die 7 Wiedervorlagen darauf beruhen, zeigt erst die Messung nach dem Deploy.

## Lokale Vermerke zählen nur nach dem Prüfstand (4.31.16, 24.10.2026)

Daniel (24.10.2026): „nur auf diesem Rechner“ bei fast jeder Prime-Zeile; Disney+ Laufstatus 7, Knopf 1. Ursache: `?zaehlen=1` liefert `gemeldet` nur seit dem Datenlauf (D1-Budget) und ist danach leer; `nichtAngekommen()` markierte damit jeden lokalen Vermerk, `briefkastenHolen` räumte sie aus. Disney+ rechnete die eigene „nichts da“-Antwort ab `seit` (26.08.), der Worker ab `pruefstandAm`. **Regel:** `akVermerkGilt(zeit, eintragSeit)` in `pruefstand-zeit.js` (Maßstab = Prüfstandzeit, ohne ihn `eintragSeit`); ältere Vermerke gelten als angekommen. Genutzt von `nichtAngekommen()`, `akPrimeAufraeumen()` und `disney-weg.js`. Wächter: `extension/meldestand.test.cjs`. Meldungskopie 24.10. 03:01: 0 Disney+-Meldungen seit 13.10., keine mit `vorhanden = nein` je — bis dahin lag keine „nichts da“-Antwort beim Worker; der Knopf zählte sie aus dem Browserspeicher.

**Zuordnung und Wächter (A1/A2):** Ein „nichts da?“ trägt bei einer Staffel die `titelId`, bei mehreren (Bleach, 4 IDs) keine; dann ordnet der Bau über die Adresse zu (`baueNachUrl`, `pipeline/lib/nach-url.ts`). Am Bestand 24.10.: alle 7 Wiedervorlagen bekommen eine Zuordnung (6 über `titelId`, Bleach über die Adresse, 4 Titel; Probe `node tools/weg-zuordnung-echt.mjs`, liest `public/data`, nicht in der Kette). Wächter: `tools/weg-zuordnung.test.mjs` und `tools/worker-weg-stand.test.ts` (echter Worker, In-Memory-D1: `weg` ohne Folgennummer nach dem Prüfstand erledigt die Wiedervorlage, davor nicht). Lücke: Der Fall „Adresse mit Titelzeile“ ist mitgetestet, aber nicht isoliert, weil die vorab gemeldete Folge selbst schon nach dem Prüfstand liegt.

**Messauflage nach dem Deploy:** Der Weg Knopf → Worker ist live bisher ungemessen (Kopie 24.10.: nie ein `weg` mit `vorhanden = nein`). Daniel antwortet einmal „nichts da?“; danach muss in der Meldungskopie eine Zeile mit `gemeldet_am` > `pruefstandAm` stehen und die Disney+-Pille von 7 auf 6 sinken.

**Absicht „nicht mehr ausräumen“:** Vermerke vor dem Prüfstand (und solche ohne Zeit) räumt `akPrimeAufraeumen` nicht mehr aus, auch wenn der Briefkasten sie nicht führt; `gemeldet` ist nach jedem Datenlauf leer und kann „verworfen“ nicht von „übernommen“ unterscheiden. Folge: ein verworfener Alt-Vermerk bleibt im Speicher (`amazonErledigt`), ohne zu markieren; begrenzt wird nur durch die Liste selbst (Vermerke ohne Eintrag bleiben ebenfalls) und, bei Disney+, die 30-Tage-Frist von `disney-weg.js`.

## Prime: eine gemeldete Suche / Titelseite kehrt nach dem Seitenwechsel nicht zurück (4.31.10, 21.10.2026)

Daniel (21.10.2026, 03:07): Nach „gemeldet ✓" und Zähler 21 → 20 stand der Titel auf der nächsten Seite wieder in der Liste (Die Boonies, Mission Mars, Beyblade Burst). **Beleg:** Diagnose 01:09:35 Z: `lokalErledigt` gesetzt, `inGemeldeteSuchen` false; Meldungskopie (Stand 01:24 Z): die Zeilen 24849–24851 stehen mit `url = such_url` im Briefkasten (01:04 Z), also kam jede Meldung an und wurde richtig gespeichert (der Worker-Mitschnitt zeigte 200). **Ursache:** `istGemeldet()` (Suchen) und `fertig()` (Titelseiten) fragen bei vorhandenem Stand (`?stand=1`, fünf Minuten im Edge-Cache) nur den Stand und `frischGemeldet`; das ist eine Menge im Arbeitsspeicher der Seite und nach jedem Seitenaufruf leer. Der gespeicherte Vermerk (`amazonSuche`, `amazonErledigt[…].zeit`) wurde in diesem Zweig nicht gelesen. Netflix löste das mit einer abgelegten Menge (`frischGemeldetNetflix`), Prime nicht. **Fix:** `prime-such-bruecke.js` — der Vermerk trägt die ISO-Zeit (vorher nur den Tag) und zählt zehn Minuten als Überbrückung (fünf Minuten Cache des Stands plus ein Takt), danach entscheidet wieder der Worker allein. Test `prime-such-bruecke.test.cjs` (neue Seite mit leerem `frischGemeldet`, Stand führt die Adresse; Frist 9/10 Minuten, 2 Stunden, Zukunft, altes Tagesformat, kaputter Vermerk, der Vermerk der anderen Art überbrückt nicht, Rundlauf über `suchAbhaken`). **Teilweise gemeldete Titel:** Wer eine von mehreren Staffeln meldet, sieht den Titel zehn Minuten als erledigt (wie bisher innerhalb der Sitzung); der Worker führt ihn danach weiter. **Nicht behoben:** der Prime-Durchgang meldete laut Daniel „offen (Fehler beim Melden)" für Tokyo Ghoul, Kuroko 3 u. a. — Ursache nicht belegt.

## Prime: regionsgesperrte Folgen sind gelesen, nicht offen (4.31.17, 24.10.2026)

Daniel (21.10. 03:07 und 24.10. 03:37): Beyblade Burst S1 zeigte „27 von 51 Folgen gelesen — für ‚kein Deutsch' fehlen 24“, die 24 Folgen sind gesperrt; im Durchgang vom 24.10. endeten 14 Meldeversuche (Kuroko S3, Beyblade S1–6, Haikyu!! Land vs. Air, Dragon Quest) mit „keine Rückmeldung: ✕ kein Deutsch · 24 gesperrt · melden“. **Zwei Ursachen im Klick-Handler und Knopf (`amazon.js`):** (1) Der Klick verglich nur lesbare Folgen mit der Seitenzahl (`geladen >= sollFolgen`); gesperrte Folgen kommen nie nach, der Handler verweigerte „kein Deutsch“ mit genau dem Text aus Daniels Meldung. (2) Sind **alle** Folgen gesperrt, hatte der Knopf `tot=false` (der Regionszweig galt nur bei `!vollstaendig`, und `vollstaendig` war durch die Abschnittszahl wahr), der Klick kehrte bei `!geladen && !nichtAbrufbar` still zurück: kein Senden, Durchgang nach 15 s „keine Rückmeldung“. **Fix:** `meldungVollstaendig` zählt gesperrte mit (`gesperrteZahl`: größeres von Zählwerk und DOM, nie die Summe); `staffelRegionWeg` gilt bei lauter gesperrten Folgen auch bei vollständiger Liste, der Knopf meldet dann „nicht mehr verfügbar“ (`vorhanden: nein`, wie Chaika S1); die Notiz nennt „N in der Region gesperrt“. Bei teilweise gesperrten Staffeln geht „kein Deutsch“ auf den lesbaren Folgen hinaus. Worker unverändert (`vorhanden: nein` und `rohfolgen` mit gesperrten Folgen sind bekannt). **Klasse:** Netflix (`netflix*.js`) und Disney+ (`disney*.js`) haben keine Sperre je Folge, nur ADN/Netflix-Seitenurteile; Treffer nur Prime. **Test:** `extension/amazon-region-gesperrt.test.cjs` (Fall A 27+24 von 51, Fall B 24 von 24, Gegenfälle mit offenen ungesperrten Folgen, Mahouka 3 von 13).

## Prime: Knopf und Klick eine Regel, jeder Ausstieg nennt den Grund (4.32.1, 24.10.2026)

Daniel (Dragon Quest: Dai): Der Durchgang zählte Dai als „Fehler beim Melden“. **Ursache:** Der Knopf nutzt `istVollstaendig()` (15 s Stillstand gilt als fertig), der Klick `akPrimeMeldungVollstaendig` (`geladen + gesperrt >= soll`). Bei 75 von 99 bot der Knopf „melden“ an, der Klick stieg still aus, `frameSchritt` wartete 15 s und meldete „keine Rückmeldung“. **Regel (Entscheidung):** Ein „kein Deutsch“ aus einem Ausschnitt entsteht nie; deshalb gilt die strengere Seite für beide: `akPrimeMeldungErlaubt` (`prime-region.js`) wird vom Knopf und vom Klick mit denselben Daten gefragt. Deutsch gefunden und „nicht abrufbar“ brauchen keine volle Zahl. **Ausstiege:** Der Klick setzt bei jedem bewussten Ausstieg ohne Senden `letzteMeldung.abgewiesen` (`abweisen()`): Erweiterung neu geladen, schon gemeldet (ok), Staffelwechsel, Seite lädt neu, keine Folge gelesen, Staffel nicht vollständig, Token-Fehler, kein Token. `frameSchritt` meldet dann sofort „nicht gesendet: <Grund>“; „keine Rückmeldung“ gilt nur noch für echtes Ausbleiben. **Wächter:** `extension/prime-meldung-regel.test.cjs` gibt Knopf und Klick (Quelltext-Schnitt) dieselben Eingaben aus einer Tabelle. **Klasse:** Anzeige und Handlung mit zwei getrennten Rechnungen (Regel K9 „eine Entscheidung, eine Funktion“). **Nachbesserung R1:** Auch die Eingabe „nicht abrufbar“ hat eine Quelle (`knopf.dataset.tot`, wie im Klick; vorher las der Knopf `lage.nichtAbrufbar`), die Tabelle spielt beide auseinanderlaufend. Der Durchgang meldet bei gesperrter Lage vor dem Klick sofort „schon gemeldet“ (`mitSperre` schluckt den Klick sonst still). **Bekannt (Hinweis, nicht geändert):** Bei Band-Staffeln (Yu-Gi-Oh Band 2: 48 von 96) ist „kein Deutsch“ nie meldbar, obwohl `fehlen 48` nach Warten klingt – die Seite führt die fehlenden Folgen nicht.

## Prime: Melden vereinigt `gesamt` und `folgen` mit dem Speicher (4.32.4, 24.10.2026)

Beim Melden überschrieb `...wert` die Felder `gesamt` und `folgen` des Speichers: Ein tab mit älterem Eintrag verdrängte eine größere Gesamtzahl und die Folgenzahlen anderer Staffeln aus einem anderen Tab (`staffeln` war schon vereinigt). **Fix:** `akPrimeEintragVereinigen` (`prime-stand.js`): `gesamt` = Maximum, `folgen` und `staffeln` je Staffel vereinigt, bei Streit um dieselbe Staffel gewinnt der Tab. **Wächter:** `prime-stand.test.cjs` (Funktion) und `amazon-melden-vermerk.test.cjs` (echter Klick-Handler, „älterer Tab“).

## Prime: lange Staffeln ehrlich lesen, Abschnittslog (4.32.2, 24.10.2026)

Daniel (Dai B0CGQ64WRN, 99 Folgen; Higurashi Kai S2): Diagnose `…T18-36-24-557Z.json` zeigt fünf Abschnitte, `abschnitte.offen: 0`, aber nur 75 Nummern (1–72 und 98–100). Genau ein Abschnitt à 24 fehlte, galt aber als „geholt“, weil `nachholen()` den Token vor dem Abruf abhakte. **Warum der vierte Abschnitt nichts lieferte, belegt die Diagnose nicht** (Antworten wurden nicht mitgeschrieben); Hypothesen: Abruf schlug fehl, Nummernkollision (zweite Zählung ab 1 überschrieb Folgen), Folgen ohne `episodeNumber`. **Jetzt:** ein Abschnitt gilt erst als geholt, wenn er lesbare Folgen lieferte (höchstens 3 Versuche, danach bleibt er offen); eine Folge mit schon belegter Nummer einer anderen Kennung überschreibt nicht mehr, der Abschnitt zählt als offen; `abschnitte.log` je Abschnitt (Token-Ende, Status, roh, gelesen, ohneNummer, kollisionen, von, bis) landet in der nächsten Diagnose unter `zaehlstand.abschnitte.log`. **Band-Staffeln:** `akPrimeSollFolgen` (prime-region.js) nimmt bei mindestens zwei Abschnitten, alle gelesen (`offen` 0), das Gelesene als Soll statt der Seitenzahl (ZEXAL 96 genannt, 48 erreichbar, „fehlen 48“). Tests: `amazon-viele-abschnitte`, `prime-soll-folgen`, `prime-meldung-regel`. Nicht gelöst, falls die nächste Diagnose Kollision oder fehlende Nummern zeigt: dann ist die Nummernzählung der Seite der nächste Schritt.

## Prime: gemeldete Suche in der Lücke vor dem Stand (4.32.1, 24.10.2026)

Daniel: „Es war einmal …“ stand nach dem Melden wieder in der Liste. **Ursache:** `briefkastenHolen` setzte `briefkastenSuchen` (Zählung, bis 2 h alt) vor dem Laden von `standZiele`. In dieser Lücke hielt `istGemeldet` die frische Suche für nicht geführt und `vermerkVerwerfen` löschte den Vermerk. **Fix:** ein Vermerk innerhalb der Brücke (`akPrimeBruecke`) wird nie verworfen, und `briefkastenSuchen`/`-Seiten`/`-Erwartungen` werden erst gemeinsam mit `standZiele` gesetzt. **Wächter:** `extension/prime-such-vermerk-luecke.test.cjs` lässt das echte `briefkastenHolen` mit angehaltener Stand-Antwort laufen und fragt in der Lücke `istGemeldet`.

## Prime: gemeldete Suche gilt bis zum Prüfstand, nicht nur zehn Minuten (29.10.2026)

Daniel: „Es war einmal …“ erschien nach einer Meldung zu einer anderen Staffel wieder. **Ursache (aus dem Code belegt, Daniels Browserzustand liegt nicht vor):** Der Worker-Stand (`pruefung-stand.ts`) rechnet mit der Titeladresse einer Meldung und kennt die Suchadresse (`such_url`) nicht; wer einen Treffer findet, meldet unter der Titeladresse, die Suche bleibt im Stand bis zum nächsten Datenbau. Den Suchvermerk deckte nur `akPrimeBruecke` (10 min), die Zählung `gemeldeteSuchen` ist bis 2 h alt. Danach galt die Suche in `istGemeldet` als offen und kam beim nächsten Neuzeichnen (nach der nächsten Meldung) zurück; Titelvermerke gelten dagegen bis zum Prüfstand (`akPrimeAufraeumen`). Der Wächter vom 24.10. prüfte nur die Lücke vor dem Stand (Vermerk 3 min alt) und hatte den Vermerk bei 10 und 30 min als „offen“ festgeschrieben. **Fix:** `akPrimeSuchVermerkGilt` (`prime-such-bruecke.js`): ein Suchvermerk gilt, solange er jünger ist als der Prüfstand (`akVermerkGilt`), im Stand-Zweig und im Briefkasten-Zweig von `istGemeldet`. **Zurückgenommen (29.10.2026):** Der Worker zieht `such_url` seit #2330 im Stand ab (`pruefung-stand-suchen.ts`); `akPrimeSuchVermerkGilt` entfiel, Suchen überbrücken wie Titeladressen nur das Cache-Fenster (`akPrimeBruecke`, 10 min), danach entscheidet der Stand allein. Einzige Folge: scheitert der Stand-Abruf, gilt nach 10 min die 2-h-Zählung. **Wächter:** `prime-such-vermerk-luecke.test.cjs` (Vermerk 11/30/59 min mit führendem Stand), `prime-such-bruecke.test.cjs`.

## Disney+: „nichts da?“ kam nach jedem Bau zurück (4.32.5, 24.10.2026)

Daniel (Aoashi, Bleach, Chainsaw Man, Children of the Sea, Fire Force S3, One-Punch Man S3, Shield Hero S2): „alle durchgehen“ räumte die 7 Titel weg, nach dem nächsten Bau standen sie wieder da; Pille 7, Knopf 1. **Ursachen (zwei):**

1. **Das Messdatum des Nein blieb stehen.** Die Antworten kamen an (Meldungskopie 24.10.: `titel_zeile` Fire Force, One-Punch, Shield Hero, Chainsaw 15:29–15:30 UTC, Aoashi 18:32; Worker-Zeilen übernommen). Der Bau verwirft aber einen Beleg, der bis auf `checkedAt` wörtlich vorhanden ist (`neueBelegBloecke`, Solo Leveling 15.09.). Das Nein vom 26.08. blieb also 26.08., die Wiedervorlage („Nein ist 28 Tage alt“, `shared/nein-wiedervorlage.ts`) blieb fällig, und der Worker zählt eine Antwort nur bis zum nächsten Prüfstand (`pruefstandAm`). **Fix:** `pipeline/lib/nein-datum-erneuern.ts` zieht das Datum des vorhandenen Nein-Belegs (`available: false` oder `dub: false`) nach, nie vor ein jüngeres oder gleich altes Ja, nie bei anderem Text/Adresse/Anbieter; angehängt wird nichts. Aufruf in `haengeBelegeAn` (`pipeline/lib/belege-anhaengen.ts`, aus `fetch-pruefungen.ts` ausgelagert). Wächter `pipeline/check-nein-datum.ts` (Fallliste und ein Abruf als Prozess, Attrappe `tools/nein-datum-mock.mjs`).
2. **Die Erweiterung kannte die Prüfstandzeit nicht.** `akPruefstandAm` füllt nur `akGemeldetSeit`, das `frischGemeldet` je Adresse ruft, aber nicht, wenn die Adresse im Gedächtnis steht (30 min). Ohne Zeit galt der lokale Vermerk gegen das Eintragsdatum (26.08.) und damit immer: Knopf 1, Pille (Worker) 7. **Fix:** `briefkastenHolen` holt die Zeit selbst, parallel zum Abruf. Test `extension/disney-stand-memo.test.cjs`.

**Umdatierung (Entscheidung Dirigent, 24.10.2026):** Wird ein Nein (auch ein Handbeleg-Nein) von der Erweiterung wörtlich gleich noch einmal gemessen (Text, Adresse, Anbieter, Kennung gleich), trägt der vorhandene Beleg danach das Browser-Datum. Grund: Das Nein wurde neu gemessen; das alte Datum würde die Wiedervorlage weiter melden. Nicht beschränkt, nur festgehalten. Ja-Schutz rechnet mit `urteilVon` (`pipeline/lib/dub-confirmed.ts`), Ja-Belege im selben Stapel zählen mit.

Offen/Klasse: Prime-Kanal-Nein ohne Urteil (`kanalMessung`) erneuert kein Datum (kein Nein im Sinn von `juengsteNein`). Die 7-Tage-Rückstellung des Durchgangs (`ak-disney-zurueck`) schickt eine abgelaufene Antwort nicht neu.

## Meldekasten nach der Meldung nie leer, Sperre übersteht das Neuladen (4.31.14, 16.10.2026)

Daniel (Prime, 23:27 „Vom Landei zum Schwertheiligen“ Staffel 2; 23:29/23:32 Nukitashi): Nach der Meldung zeigte der Kasten weder Knopf noch „gemeldet ✓“; bei Nukitashi stand ein roter Knopf „gemeldet ✓“, nach Zurück oder Neuladen wieder „kein Deutsch … · melden“. **Ursache:** 4.31.7 nahm `gemeldetFuerPfad` heraus in der Annahme, der gesperrte Knopf trage die Marke selbst. Zwei Zweige von `zeichnenRoh()` blenden den Knopf nach der Meldung aus, ohne eine Marke zu setzen („nicht auf der Prüfliste“, „Staffel gemeldet, keine offen“); `anwenden()` beschriftete dann einen unsichtbaren Knopf. Die Sperre lebte nur im Speicher der Seite. **Klasse:** sieben Stellen setzen `knopf.style.display = 'none'`. Fünf davon liegen in `zeichnenRoh()` hinter der Marke, zwei ließen den Kasten leer, drei setzen die Marke selbst. Die Suchseite und der Player sind ohne Melden. Bei Nukitashi kannte der Worker die Meldung noch nicht, deshalb stand Knopf und Marke doppelt. **Fix:** `meldeSperre.gesperrt()` setzt die Marke (`an = gesperrt || durchFuerPfad === pfad`), und `fuer().zeichnen()` blendet den gesperrten Knopf aus. So steht genau eine Marke, wie vor 4.31.7. Die Befunde liegen in `chrome.storage.local` (`akMeldeSperre`, Meldezeit je Befund) und verfallen nach 24 h (`HALTE_MS`). **Wächter:** `extension/meldekasten.test.cjs` spielt das echte `zeichnenRoh()` je Zweig mit Gegenprobe ohne Sperre. Es sichert zu: Marke steht, Knopf nicht zusätzlich, Klick meldet nicht, und nach dem Neuladen bleibt die Marke. Auf 8554bd97e ist er rot. **Regel:** Wer eine Anzeige auf ein anderes Element verlegt, prüft jeden Zweig, der dieses Element ausblendet. Ein Wächter, der den alten Ausdruck per Regex festschreibt, hält den Fehler fest.

**Nachtrag (Prüfer, 1397):** `sichern()` liest den Speicher vorher und führt zusammen (jüngste Meldezeit je Befund, Verfallenes fällt). Sonst löschte ein zweiter Prime-Tab die Befunde des ersten. Als angekommen gilt eine Meldung nur, wenn der Worker sie führt (`AK_MELDUNG_BELEGT`: Prüflisten-Adresse in `briefkastenAdressen` oder Seitenkennung in `briefkastenSeiten`). `!nichtAngekommen()` war auch ohne Briefkasten-Antwort und für Seiten außerhalb der Prüfliste wahr. Dann hielt die Sperre 24 h, ohne dass etwas belegt war. Jetzt gilt dort die Frist (`FRIST_MS`).

**Nachtrag 2 (Prüfer, 1397, Runde 3):** Die Frist war 120 s, begründet mit „Briefkasten bis zu einer Minute alt“. Seit 12.10.2026 hält die Edge `?zaehlen=1` bis 7200 s (`ZAEHLEN_SEKUNDEN`), eine Meldung leert diesen Cache nicht, und `briefkastenHolen` ersetzt den lokalen Nachtrag. Gemessen 17.10.2026 00:56 (Berlin): `age: 5461`, `cf-cache-status: HIT`, `cache-control: public, max-age=7200`. Nach 120 s las die Sperre deshalb die veraltete Antwort als „nicht da“ und löschte den Befund (Nukitashi, wieder „melden“). Jetzt `FRIST_MS = (7200 + 600) s`; `melde-sperre.test.cjs` sichert `FRIST_MS ≥ ZAEHLEN_SEKUNDEN + 5 min` am Worker-Quelltext. **Regel:** Wer eine Antwort aus einem Cache als „nicht da“ liest, nimmt dessen Höchstalter als Frist, nicht das Abruf-Intervall.

## Prime: Fassungen aus „Weitere Versionen verfügbar“ in der Auswahl (4.32.2, 24.10.2026)

„Fischen Impossible“ hat drei Fassungen (B0GVNJRZCM KiXi-Kanal, B01HRLV328 Kauf/Leihe, B01MSMV5MA Uncut in Prime); die Suche zeigt nur Karten, die Uncut-Fassung fehlte. Jede Detailseite führt die anderen im Hydration-Block (`init.preparations.body.btf.state.containers.<id>[]`, Container „Weitere Versionen verfügbar“, `entities[]`: `titleID`, `title`, `releaseYear`, `runtime`, `variantMessages`, `entitlementCues.focusMessage.message` „Gratiszeitraum“/„Kaufen oder leihen“). `extension/prime-fassungen.js` liest sie (`akPrimeKarten`), die Titelseite zeigt sie samt der eigenen Seite als Auswahl (`erwartungsAuswahl`, nichts vorgekreuzt), Prime zuerst, Kauf, Kanal zuletzt. Fixture: `extension/prime-fassungen.fixture.json` (Ausschnitt der gespeicherten Seite). **Regeln:** Der Block zählt nur, wenn `init.path` auf die Kennung der geöffneten Adresse endet (ein Single-Page-Wechsel lässt den alten Block stehen); „Prime“ im Text gilt bei bestehendem Abo (`Entitled`) vor dem Kanal-Logo, ohne Abo (`Unentitled`) gewinnt das Logo auch bei „Prime Video Channels“ (4.32.5: die Uncut-Fassung trägt „In Prime enthalten.“ und ein Prime-Logo, gemessen an der Kaufseite B01HRLV328, Fixture `prime-fassungen-kauf.fixture.json`), danach das Logo vor dem übrigen Text; `Entitled` allein bleibt neutral („Fassung“). Der Aufruf sitzt im Zweig „weniger als zwei bestätigte Ausgaben“ der Checkliste (`zeigeAuftragshinweis`). Test durch `amazon.js`: `prime-fassungen-lauf.test.cjs`. Die Prime-Probe (Kaufseite) liegt seit 25.10.2026 vor.

## Prime-Kartenabgleich: ß, Umlaute und Karten ohne Untertitel (31.10.2026)

`titelKern` ersetzte ß nicht und löschte Umlaute: „Operation Nussknacker 2: Voll auf die Nüsse“ und die Karte „Operation Nußknacker 2 - Voll auf die Nüsse“ ergaben verschiedene Kerne, das Panel zeigte „Nicht dieser Titel“ ohne Auswahl. Jetzt `ß → ss`, dann `normalize('NFKD')` (ü → u). Zweiter Fall, Teil 1 „Operation: Nussknacker - Auf die Nüsse, fertig, los!“: Prime führt die Karte „Operation Nussknacker“. Der Kopf vor dem Gedankenstrich (`extension/prime-treffer-kopf.js`, zwei Wörter, Kern ab zehn Zeichen) passt auf die Karte ohne Untertitel, aber nur, wenn dieselbe Trefferliste eine durchnummerierte Folgekarte („Name 2 - …") mit demselben Kopf führt (Prüfer Runde 1: sonst wäre „Dragon Ball Z" die Karte zu „Dragon Ball Z - Kampf der Götter"); Teil 2 trägt die Nummer im Kopf und trifft sie nie. Grenze: Ein Spin-off, neben dessen Reihenkarte auch eine „Name 2"-Karte steht, würde so als genau gelesen. Der Rückfall „ähnlich“ nimmt nur noch Karten, deren Kern **am Anfang** des Auftragskerns steht (`startsWith`), nicht mehr jeden Teilstring: „Voll auf die Nüsse“ (Dodgeball, B00HFCZJWU) wurde sonst als Teil des Teil-2-Titels vorgeschlagen. Das Jahr wird nicht verglichen (der Auftrag trägt keines). Der aniSearch-Verweis der Suchaufträge führt auf die Übersicht `/anime/<asId>`; `/episodes` war seit 4.13.1 gewählt, weil die Folgenseite deutsche Folgentitel mit Datum trägt (Commit 82afc54eb). Tests: `amazon-suchseite.test.cjs`.

## Durchgang durch Suchaufträge, Staffel-Auswahl unter einer ASIN, Frame-Tagebuch (31.10.2026, Weg B)

Nur die Erweiterung ändert sich; Worker und D1-Schema bleiben. Neue Dateien: `extension/prime-durchgang-suche.js` (reine Rechnung auf dem Lauf-Objekt), `extension/prime-treffer-kopf.js`.

- **Staffeln einer ASIN (Miraculous):** Das Dropdown führt 24 Staffeln plus „Tagebuch Besonders“ und „Besonders“ unter B0B6HHFR44. Der Plan hielt nur Kennungen und verwarf jede zweite Staffel derselben ASIN. Ein Planeintrag ist jetzt die Kennung (erste Staffel dieser ASIN) oder `<Kennung><Query des seasonLink>` (`?ref_=atv_dp_season_select_sN`); `amazon-leser.js` reicht dafür `link` durch, `frameFertig` zusätzlich `gewaehlt`. Das ist dieselbe Unterscheidung, mit der der Leser Sammel-Kennungen (JoJo) pro Seite trennt (`staffelAusAdresse`). **Nicht gemessen:** Wie die echte Miraculous-Seite die 26 Einträge benennt, wurde von hier aus nicht abgerufen; die Fixture im Test (`amazon-durchgang.test.cjs`) ist nach dem Aufbau der Zexal-Fixture und Daniels Beschreibung gebaut. Zeigt der Durchgang bei Miraculous weniger als 26 Seiten, nennt das Tagebuch des Berichts (`durchgang-plan`) die gefundenen Einträge. Von Hand geöffnete Seiten melden weiter nur die gezeigte Staffel; ein „Alle Staffeln dieser Seite“ ohne Durchgang gibt es nicht.
- **Suchaufträge:** Sind die Titel der Liste durch, öffnet der Lauf die Suchseite als Frame (mit dem deutschen `suchbegriff`). Der Such-Frame liest die Karten (`suchTreffer`, `beurteileTreffer`) und meldet dem Lauf seine **genauen** Treffer plus die von Daniel bestätigte Auswahl (`akPrimeSucheUrteil`, frühestens nach 3 s, bei nicht gelesener Liste Fehlschlag nach 25 s). Der Lauf besucht jeden Treffer wie einen Titel samt Staffeln, **einen Frame zugleich**, weil der Auftrag (`suchauftragMerken`, mit `zielAsin`) nur einmal im Tab-Speicher liegt. Nur „ähnliche“ Treffer oder keiner: nichts wird besucht oder als „nicht bei Prime“ gemeldet, der Auftrag steht benannt auf der Liste „offen (Fehler beim Melden)“ im Schluss. Welcher Treffer zum Titel gehört, entscheidet weiter der Abgleich und der Meldeknopf der Zielseite. **Grenze:** Dass ein Suchauftrag erst nach allen Staffeln geschlossen wird, kann der Worker nicht abbilden (die Erwartung kennt Kennungen, keine Staffeln); schließt der Worker den Auftrag nach der ersten Meldung, laufen die übrigen Staffeln im selben Lauf trotzdem weiter, weil der Lauf seinen Plan führt und nicht `istGemeldet`.
- **Übersicht der Suchseite:** Die Kästen sind vorbefüllt (auch bei „ähnlich“) und dienen als Ausschluss, darüber steht „Alles angehakt – nimm ab, was nicht zum Titel gehört.“ Die Jahreswarnung („Diese Seite ist von …“) entfällt auf Seiten der bestätigten Auswahl (Ribbit: deutsche Fassung 2020, Film von 2014).
- **Runde 1 des Prüfers (31.10.2026):** Der Such-Frame hat eigenen Takt und Zustand (`SUCHE_IM_FRAME`, `sucheFrame`, vor dem Warten auf die Kennung angemeldet): Auf `/s` gibt es nie eine Kennung, das Skript wartet dort bis zu fünf Minuten, und ein Takt am Skriptende wurde nie erreicht. `amazon-durchgang-takt.test.cjs` lädt das ganze Skript auf `/s` und belegt Takt und Antwort. `akPrimePlanEintraege` meldet jeden Eintrag, der nicht in den Plan kommt (keine Kennung, kein Link, gleicher Link), mit Grund in der Plan-Spur und als Warnzeile auf der Handliste („Name · Dropdown: N von M Einträgen nicht unterscheidbar“). Eine gti geht ohne Query in `akPrimeFrameAdresse` und `gtiMerken`; die Handliste nennt den Namen auch bei einer fehlgeschlagenen Suche.
- **Frame-Tagebuch:** Scheitert ein Frame, trägt die Antwort seine letzten acht Knopftexte mit Millisekunden seit Seitenstart (`tagebuch`), die Spur `durchgang-seite` im Bericht zeigt sie.

## Durchgang: Frist mit Marke, Grund in der Liste, Disney+ zurückgestellt (31.10.2026)

Daniel (31.10. 10:07): „Durchgang fertig auf allen 3 Seiten, trotzdem bleiben Titel offen.“ Berichte: Diagnose Amazon, Disney, Netflix vom 31.10.2026.

1. **Fushigi Yûgi New OVA, Staffel 1 (B0CH6KQBJR).** Der Frame schloss nach 74 s mit `ok: false, „Knopf blieb bei: gemeldet ✓“`. Der Abhak-Schlüssel war nicht falsch; die Frist in `frameSchritt` stand **vor** der Prüfung „Knopf zeigt gemeldet“. Kam die Marke erst in der letzten Sekunde (langsame Seite: der Frame lud 14 s nach dem Öffnen), zählte die gemeldete Staffel als gescheitert und stand in `uebersprungen`. Jetzt entscheidet `akPrimeFrist` (`prime-titelseite.js`): zeigt der Knopf „gemeldet“, ist die Seite ok. Was im Frame davor geschah, steht im Bericht nicht (die Frames schreiben kein Tagebuch); belegt ist nur die Reihenfolge im Code und die Meldung im Tagebuch. **Klasse:** jeder Frame mit Frist; Treffer in diesem Lauf: 1 von 94 Seiten (Tagebuch `durchgang-seite`, 2 mit `ok:false`). Test `amazon-durchgang.test.cjs` (Marke kurz vor der Frist; auf dem alten Stand rot mit genau der Meldung aus dem Bericht).
2. **Dragon Quest: The Adventure of Dai (B0CGQ64WRN), 75 von 100 Folgen.** Der Bericht enthält nur den Grund, nicht die Abschnittsliste der Seite (die liegt in der Diagnose der Dai-Seite, nicht in dieser). Ein anderer Weg zum Nachladen ist im Code nicht vorgesehen: `amazon-leser.js` holt die Abschnitte über ihre Tokens (`getDetailWidgets`); ein Abschnitt ohne lesbare Antwort bleibt offen (4.32.2). Ohne Abruf bei Amazon ist die Ursache nicht zu klären. Jetzt zeigt die Liste den Grund samt fehlenden Nummern („von 100 fehlen Folge 73–97“), und die Spur des Durchgangs trägt je Abschnitt eine Zeile (Bereich, gelesen/roh, HTTP-Status, Kollisionen), damit der nächste Bericht die Ursache nennt. Die Endanzeige führt `Titel · Staffel N – Grund` statt der nackten Kennung.
3. **Disney+: „2 Titel / 6 zurückgestellt“ neben „6 offen“.** `disney.js` zählte `offeneEintraege()` ohne die Rückstellung des Durchgangs (`ak-disney-zurueck`, 7 Tage). Jetzt zählt `akDisneyZaehlung` (`disney-durchgang.js`) Zurückgestellte nicht als offen; Die Pille sagt „2 offen · 6 zurückgestellt bis 7.11.“ (frühestes Ende); der Kopf der Liste nennt bei offenen Titeln nur diese („2 Titel zu prüfen“), erst ohne offene steht dort „6 zurückgestellt bis 7.11.“, und die Zeile jedes zurückgestellten Titels trägt das Datum (ohne Grund: Gebiet-Dialog und Startseite sind verschiedene Gründe). `disney-durchgang.js` lädt laut Manifest **vor** `disney.js`, weil dieses die Zählung schon beim Laden aufruft (Chrome hätte sonst „akDisneyZaehlung is not a function“ geworfen; `tools/extension-laden-pruefen.cjs` fing es). Test `disney-zurueckgestellt.test.cjs` (läuft die echte `zeigeUebersicht`; Mutante „Rückstellung nicht lesen“ rot: „8 offen“).

**Zurückgestellt (Ansatzwechsel Daniels, 31.10. 10:24):** Higurashi (Suchauftrag nicht abgehakt, weil die Seite zu einem Listeneintrag einer anderen Staffel gehört und `suchAbhaken` nur bei `ausSuche` lief), die Auswahl der Fassungen (Jahr, Folgen, Hinweiszeile) und Miraculous (eine ASIN, viele Staffeln im Dropdown) gehören in den Umbau „Suchtreffer werden Meldeaufträge“. Der Prime-Durchgang öffnet nur Frames je Staffel-ASIN (`seite.staffeln` mit eigener Kennung); ein Dropdown auf derselben Seite schaltet er nicht (`staffeln: []` im Tagebuch heißt „nichts zu öffnen“). Der Staffelwechsel in `melder.js` gehört Netflix (Netflix-Kennung → Folgenliste) und taugt dafür nicht.

## Die Version der Erweiterung zählt nach dem Merge ein Workflow (25.10.2026)

PRs heben `extension/manifest.json` **nicht** an. Anlass: parallele PRs nahmen je die nächste Nummer (4.32.2 bis 4.32.5) und kollidierten an der einen Zeile; die Merge-Reihenfolge passte nie zur Nummernfolge. Jetzt zählt `.github/workflows/extension-version.yml` nach jedem Push auf `main`, der `extension/**` berührt, die letzte Stelle um eins hoch (`tools/extension-version.mjs`, App-Token wie `bestand-bauen.yml`, Commit „chore(extension): Version gezählt“, Deploy ignoriert `extension/**`). Es zählt nur, wenn die Spanne ausgelieferten Code ändert (nicht `*.test.*`, Fixtures, Markdown) und die Version nicht von Hand angehoben wurde. `tools/pr-vorpruefung.mjs` lehnt einen PR ab, der die Version selbst anhebt. Folge für Texte: Doku-Überschriften und Patch Notes nennen keine Versionsnummer mehr, sie steht erst nach dem Merge fest. Daniel sieht die neue Nummer nach `git pull` und „Neu laden“ in `chrome://extensions`; Diagnosedateien tragen sie weiter (`getManifest().version`).

## Prime: Meldungen vor dem Staffelwechsel-Fix sind unsicher (28.10.2026)

Bis zum 15.09.2026 (Commits cb57345e7, 8d67c2f60) las die Erweiterung nach einem Staffelwechsel ohne Neuladen den Datenblock der alten Staffel; Folgen mehrerer Staffeln landeten unter einer Adresse. Messung an der Meldungskopie vom 24.10.2026: 25 Meldungen auf 20 Seiten vor dem Fix belegt vermischt, 53 Mehrstaffel-Seiten gesamt, 159 Meldungen nicht prüfbar. Wirkung auf `public/data`: keine mehr — die alten Zeilen sind abgehakt (`uebernommen = 1`), kein Weg öffnet sie wieder, und `data/prime-zugeordnet.json` und `data/prime-unzugeordnet.json` führen keine der 20 Adressen; fast alle Folgen (Folgen-ASIN) liegen zudem nach dem Fix mit der richtigen Staffel vor (nur 11 Folgen zweier laufender Staffel-2-Serien neuer als die Altmeldung). Riegel: `pipeline/lib/rohfolgen-staffelmisch.ts` hakt offene Prime-Zeilen mit Staffelangabe, gemeldet vor dem 16.09.2026 und ohne Seitenkennung, ab, statt sie zuzuordnen (heute 15 offene Zeilen aus dem Bungo-Vorfall vom 10.09.). Offen: die Erweiterung hat für den Staffelwechsel nur statische Zusicherungen, keinen Verhaltenstest.

## Prime: Melde-Knopf erschien erst nach 9 s (Miraculous Staffel 20, 31.10.2026)

Diagnose-Tagebuch: erste `antwort` 20:28:12.454, `knopftext` (von leer) erst 20:28:21.179. Ursache: `zeichnen()` in `extension/amazon.js` steigt aus, solange die Zeichenkette `stand` gleich bleibt. Das erste Zeichnen lief vor dem Speicher (`erledigt` leer, `standGeladen` false), `serieBekannt()` war falsch, der Knopf blieb versteckt (kein Text, daher kein Tagebucheintrag). Als der Speicher kam, aenderte sich nichts in `stand` (Zweig `.then` nach `speicherLesen` setzt `letzterStand` nur bei neuer `listenId`), bis `ladeFristReif`/`wartet` nach `GEDULD_MS`/8000 ms kippten: 8 s plus Takt. Fix: `standGeladen` steht in der Zeichenkette (`akPrimeZeichenStand`, `prime-stand.js`); der naechste 500-ms-Takt zeichnet neu. Test: `extension/amazon-knopf-erste-anzeige.test.cjs` (Zeitachse im 500-ms-Takt, Aufruf aus `amazon.js` wird ausgewertet; ohne `standGeladen` im Aufruf rot). **Regel:** Jede Eingabe, die Sichtbarkeit oder Text des Knopfs bestimmt, gehoert in `stand`; ein eigenes `zeichnen()` im Speicher-Zweig brach `amazon-kill-blue.test.cjs` und blieb weg. Die Pruefkette fing es nicht, weil kein Test das Zeichnen vor dem Speicher kennt (Vermutung: die Test-Kulissen liefern den Speicher synchron). Offen: weitere Eingaben ausserhalb von `stand` (`liste`-Auffrischung, `briefkastenErwartungen`) nicht einzeln belegt.
