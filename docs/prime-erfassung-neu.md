# Prime-Erfassung: Sammeln trennen vom Zuordnen

Stand 28.08.2026. Anlass: 39 Fassungen der Erweiterung an einem Abend (3.44 bis
3.76), fast alle an derselben Wurzel.

## Was heute schiefging — und warum es dieselbe Ursache hat

Die Erweiterung tut auf jeder Prime-Seite drei Dinge gleichzeitig:

1. **Sammeln** — welche Folgen liegen hier, mit welchen Tonspuren?
2. **Zuordnen** — gehört diese Amazon-Staffel zu unserem Eintrag?
3. **Urteilen** — ist das „deutsch", und über wie viele Folgen reicht der Befund?

Schritt 1 ist mechanisch und war nie das Problem. Schritt 3 hängt an Schritt 2.
**Schritt 2 ist die Wurzel praktisch aller heutigen Fehler** — und er ist von der
Seite aus prinzipiell nicht sicher zu entscheiden:

| Fall | Was Amazon zeigt | Was stimmt |
|---|---|---|
| JoJo Stardust Crusaders | „Staffel 3" | Staffel 2 (Amazon zählt Phantom Blood und Battle Tendency getrennt) |
| InuYasha Staffel 2 | Auswahlfeld sagt „The Final Act" | Staffel 2 |
| InuYasha Staffel 4 | Folgen 26, 27, 28 … 105 | 105 ist die durchlaufende Nummer derselben Folge |
| Haikyu Staffel 1 | 44 Folgen | Unser Eintrag hat 25 |
| Pokémon Sonne & Mond | „Staffel 20 Teil 1", daneben „Staffel 2101" | eine Reihe mit 57 „Staffeln" |
| JoJo Staffel 2, 3, 4 | leere Einträge ohne Folgenliste | Amazon-Fehler |
| Captain Tsubasa Junioren | eine Liste mit 91 Folgen | unser Eintrag sind davon 53–91 |
| Halo Legends | ein Film, 1:57 h | bei uns ein ONA mit 9 Teilen |

Jeder dieser Fälle bekam heute eine eigene Regel in der Erweiterung. Die Regeln
widersprechen sich gegenseitig: „mehr Folgen als erwartet heißt falsche Staffel"
gegen „Amazon bündelt Arcs", „Nummer über der Staffelgröße ist ein Ausreißer"
gegen „Amazon zählt durch". Zwei davon haben einander direkt aufgehoben (3.61
gegen 3.74/3.75).

Messbar ist das auch: `extension/amazon.js` hat **5.721 Zeilen** und **48
Zustandsvariablen** auf Modulebene. Die Stellen, die über Staffeln und Zuordnung
entscheiden, verteilen sich über 30 (Staffelnummer), 10 (Listeneintrag), 27
(Trefferurteil) und 21 (Vollständigkeit) Fundstellen.

## Daniels Theorie — und was die Messung dazu sagt

> „wenn wir einfach nur alles sammeln würden und fortlaufend nummerieren würden,
> würden wir uns evtl viele issues ersparen"

**Sie trägt.** Drei Belege:

**Erstens** braucht die Zuordnung eine Auskunft, die es auf der Seite nicht gibt.
Welche AniList-Staffel eine Amazon-Staffel meint, weiß weder Amazon noch die
Erweiterung — nur der Vergleich von Folgentiteln oder Erstausstrahlungsdaten
beantwortet das, und beides steht im Bestand, nicht im Browser.

**Zweitens** ist der Fall selten: Von 533 Prime-Verweisen tragen **29** eine
Staffelangabe im Namen. Für die übrigen 504 ist die Zuordnung trivial, und sie
zahlen heute trotzdem den Preis der Komplexität — jede Regel läuft auf jeder
Seite.

**Drittens** ist das Sammeln umkehrbar, das Urteilen nicht. Eine falsch
zugeordnete Meldung landet als `dub: false` im Bestand und sieht dort aus wie
eine Messung. Wer nur sammelt, kann später neu zuordnen.

## Der Plan

### 1. Die Erweiterung sammelt, sie urteilt nicht mehr

Gemeldet wird künftig, was die Seite hergibt — ohne Interpretation:

```
{ asin, serientitel, staffelBeschriftung, staffelPosition,
  folgen: [{ nummer, titel, datum, laufzeit, sprachen }],
  zugang, abos, gemeldetAm }
```

Kein `dub: true|false`, keine Folgenbereiche, keine Staffelzuordnung. Die
Folgentitel und Datumsangaben sind dabei der Schlüssel — sie identifizieren eine
Folge eindeutig, unabhängig von jeder Zählung.

Damit entfallen in der Erweiterung: die Staffelsperre, die Bündelungs-Erkennung,
`beurteileTreffer`s Typ- und Staffelregeln, die Vollständigkeitsprüfung, die
Vermischt-Regel, das Kappen, die Ausreißer-Behandlung. Der Knopf sagt dann nur
noch, was er gerade sieht, und ob er es abgeschickt hat.

### 2. Die Zuordnung passiert im Bau, gegen den Bestand

Dort liegen die Folgentitel und Erstausstrahlungsdaten aus AniList. Eine Folge
wird zugeordnet über — in dieser Reihenfolge:

1. **Erstausstrahlungsdatum** — trennt Staffeln zuverlässig und ist bei Amazon je
   Folge angegeben
2. **Folgentitel** — nach derselben Normalisierung, die schon für Serientitel gilt
3. **Position innerhalb der Liste** — nur als Rückfall, und nur wenn die
   Folgenzahl exakt passt

Was sich nicht zuordnen lässt, wird nicht geraten, sondern in eine Liste
geschrieben: `data/prime-unzugeordnet.json`, mit dem Grund. Das ist der
entscheidende Unterschied zu heute — eine offene Frage bleibt sichtbar, statt zu
einer falschen Antwort zu werden.

### 3. Die Prüfliste bringt mit, was sie schon weiß

`shared/staffel-aus-titel.ts` liegt fertig vor (römische Ziffern, Zahlwörter,
nackte Zahlen, Ordnungszahlen). Der Prüflisten-Bau schreibt künftig je Eintrag:

- `staffel` — aus dem Titel bestimmt, einmal, im Bau
- `folgen` — die erwartete Zahl
- `folgenTitel` — die ersten drei, als Erkennungsmerkmal für die Zuordnung
- `erstesDatum` — die Erstausstrahlung der ersten Folge

Die Erweiterung zeigt das an, damit Daniel die richtige Staffel wählen kann. Sie
entscheidet nichts daraus.

### 4. Reihenfolge

| Schritt | Was | Aufwand |
|---|---|---|
| 1 | Prüfliste um `staffel`, `folgenTitel`, `erstesDatum` erweitern | klein |
| 2 | Worker nimmt das Rohformat an (neue Spalten, altes Format bleibt gültig) | klein |
| 3 | Zuordnung im Bau bauen, mit `prime-unzugeordnet.json` | mittel |
| 4 | Erweiterung auf reines Sammeln umstellen, alte Regeln entfernen | groß |
| 5 | Die 29 Staffel-Titel gegenprüfen und die Reste von Hand klären | klein |

Schritt 4 ist der große — und er wird ein Abzug, kein Anbau: Die
Zuordnungsregeln fliegen raus, sie werden nicht ersetzt.

## Was dabei nicht verloren gehen darf

- **Der Fahrtenschreiber bleibt.** Er hat heute drei Fehler gefunden, die anders
  nicht zu finden waren.
- **Die Schutzfläche bleibt.** Sie hat mit der Zuordnung nichts zu tun.
- **Die bereits gemeldeten Daten bleiben gültig.** Das neue Format kommt
  daneben; der Worker nimmt beide an, bis das alte leer läuft.
- **Kein Urteil ohne Grundlage.** Die Regel aus 3.73 — unter einem Drittel
  gelesener Folgen kein „kein Deutsch" — wandert in den Bau statt zu entfallen.
