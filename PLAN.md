# Weg zu einem vollständigen Kalender

Stand 29.08.2026, 17:30 — alle Zahlen aus dem ausgelieferten Datensatz gemessen.

## Wo wir stehen

| | 27.08. | 29.08. früh | 29.08. abends |
|---|---|---|---|
| Titel im Bestand | 2.762 | 2.763 | 2.763 |
| mit belegter deutscher Synchro | 1.276 | 1.349 | 1.349 |
| **Verweise ohne Urteil** | 531 | **193** | **193** |
| **Titel ganz ohne Weg** | — | 1.041 | **498** |
| **davon mit belegter Synchro** | — | 693 | **277** |
| Titel mit Disc-Weg aus dem Archiv | — | 0 | **542** |
| aniSearch-Archivdateien | — | 956 | **2.356** |

**Die Urteilslücke ist in zwei Tagen um zwei Drittel geschrumpft** — von 531 auf
193. Dass die Zahl der Titel *mit* Verweis dabei gesunken ist, gehört dazu und
ist kein Rückschritt: 459 Crunchyroll-Verweise wurden entfernt, weil die Serie
dort nachweislich nicht mehr läuft. Ein toter Link ist schlimmer als keiner.

## Die drei Lücken

### 1. Synchro-Urteile — 193 offene Verweise

| Anbieter | offen | Weg |
|---|---|---|
| Crunchyroll | 63 | Specials und Filme ohne eigenen Block; je Fall eine Entscheidung |
| Prime Video | 58 | Erweiterung, Daniels Prüfliste |
| Netflix | 42 | Erweiterung, ein Klick je Folge |
| YouTube | 22 | Handarbeit, der Titel nennt oft die Fassung |
| ADN | 5 | eine Serie mit gemischten Staffeln |
| Joyn, Disney+ | 3 | Handarbeit |

Crunchyroll ist von 356 auf 63 gefallen — der Rest ist der harte Kern, den die
Messung vom 27.08. schon benannt hat.

### 2. Titel ohne jeden Weg — 498

Die größte inhaltliche Lücke, und sie hat sich an einem Tag **mehr als
halbiert**:

| | früh | abends |
|---|---|---|
| Titel ganz ohne Weg | 1.041 | **498** |
| davon mit belegten deutschen Sprechrollen | 693 | **277** |
| Titel mit Disc-Weg aus dem Archiv | 0 | **542** |

**Was den Unterschied gemacht hat, lag im Haus.** `data/anisearch-raw/`
archiviert die Titelseiten, und deren Abschnitt `<section id="items">` führt
jede Veröffentlichung mit Datum und Artikelseite. Für einen Anime von 2002 ist
das die richtige Antwort auf „wo?": Er lief nie bei einem Streamingdienst, es
gab ihn auf DVD.

**Dazu kam der zweite Fund:** Von 2.616 archivierbaren Seiten lagen nur 956 im
Repo — 1.660 waren verlorengegangen, und der Abruf meldete trotzdem „nichts
nachzuladen", weil seine Warteschlange nur nach dem Alter fragte. Nach zwei
Nachhol-Läufen sind es 2.356; die restlichen 260 holt der Tageslauf.

**Für die 277 mit Synchro und ohne Weg bleibt danach:** Titel, die weder ein
Streamingdienst führt noch je eine deutsche Disc hatten. Dort ist die ehrliche
Antwort „Kein Anbieter bekannt".

### 3. Termine — 1.161 Titel mit Synchro ohne einen einzigen

Von 1.349 Titeln mit belegter Synchro haben 188 einen Kalendereintrag. Der Rest
ist erschienen, bevor eine unserer Quellen ihn kannte; 329 tragen wenigstens ein
„Im Angebot seit" aus MOTN.

**Hier ist wenig zu holen, und das ist gemessen, nicht resigniert:**
Ankündigungen deutscher Synchronfassungen gibt es in keiner maschinenlesbaren
Quelle. Was nicht angekündigt ist, findet kein Lauf.

## Was als Nächstes trägt

1. **Die Anker für die Folgen-Zuordnung.** 150 von 2.615 Titeln haben eine
   aniSearch-Folgenliste. Ohne sie scheitert jede Prime-Meldung an „keine
   Folgentitel vorhanden" — am 29.08. betraf das 42 Adressen mit 4.360 Folgen.
   Der Abruf läuft im Sechs-Sekunden-Takt; 2.465 offene Titel sind rund vier
   Stunden Laufzeit, verteilt über mehrere Läufe.
2. **Die 1.041 Titel ohne Weg**, allen voran die 693 mit belegter Synchro.
   Beginnend bei dem, was das eigene Archiv schon weiß.
3. **Phase 4 des Autonomie-Plans** — der Abzug in `extension/amazon.js`, jetzt
   wo der Weg von der Meldung bis in den Datensatz belegt ist.
4. **Kalender auf Folgen-Ebene** — die Daten liegen, es ist ein Umbau der
   Oberfläche.

## Was 100 % ausschließt

- **Ankündigungen** deutscher Synchronfassungen: keine maschinenlesbare Quelle.
- **Netflix** gibt Tonspuren nur an einen laufenden Player heraus — fünfmal
  gemessen, fünfmal bestätigt.
- **Amazons Kanal-Titel** melden die Sprachen des Kanals, nicht der Folge. Seit
  dem 29.08. erzeugen sie deshalb kein `dub: false` mehr.
- **Amazon automatisch abrufen.** Die robots.txt führt 19 namentliche Bot-Blöcke
  mit `Disallow: /` (ClaudeBot, GPTBot, Scrapy, Devin …). Die Prüfliste bleibt
  Handarbeit in Daniels angemeldeter Sitzung.
- **287 Crunchyroll-Serien** führt der deutsche Katalog nicht. Gegenprobe am
  29.08. über die Katalogsuche mit allen Titelschreibweisen: 40 Fälle geprüft,
  **null** doch gefunden (`tools/cr-entfernte-gegenpruefen.mjs`).

---

# Ältere Messungen

## Nachgemessen am 27.08.2026, nach dem Datenbau von 10:34

**Die 43 Crunchyroll-Specials sind 39, und sie zerfallen in zwei Gruppen.** Gemessen am
frisch gebauten Datensatz, nachdem die Einzelserien-Regel gelaufen war:

| Format | Zahl | Was der Fall ist |
|---|---|---|
| TV | 17 | Echte Serien. Der Block trägt einen Zusatz im Namen oder eine andere Folgenzahl |
| MOVIE | 10 | Filme unter der Serienadresse — Fairy Tail Phoenix Priestess, fünf Free!-Filme, zwei Rascal-Filme |
| OVA | 9 | Sonderfolgen, meist mit eigenem Block („OVAs", 2 Folgen, beide deutsch) |
| SPECIAL | 3 | SAO Extra Edition, zwei Tonikawa-Kurzfilme |

**Die Filme und Specials sind kein Fehler, sondern eine offene Frage.** Sie stehen in keinem
Block; dass die Serie an derselben Adresse deutsch läuft, sagt über sie nichts. Genau davor
warnt die Präfix-Regel in `crunchyroll-dub.ts`, und sie hat recht behalten.

**Bei den OVAs zeichnet sich ein Weg ab.** Mob Psycho und Miss Kobayashi führen einen eigenen
Block „OVAs" mit zwei deutschen Folgen, und wir haben dazu genau zwei OVA-Titel. Das ist eine
saubere Zuordnung über Format und Blockname — noch nicht gebaut, aber messbar.

### Geklärt: die 57 „fehlenden" Urteile sind entfernte Neins

Der Bau vom 27.08., 10:34 meldet **625 gesetzte Crunchyroll-Urteile** (597 + 2 + 26), im
ausgelieferten Datensatz stehen **568** — und kein einziges `dub: false`.

Das ist kein Verlust, sondern eine Entscheidung vom 15.08.2026: Ein Verweis mit belegtem
Nein wird entfernt, weil diese Seite eine Frage beantwortet und zwar wo ein Anime auf
**Deutsch** zu sehen ist. Die Stelle steht in `build.ts` und protokolliert sich selbst
(„… Verweise ohne deutsche Synchro entfernt").

`CLAUDE.md` sagte an der Kurzschrift-Tabelle noch „Verweis bleibt mit ✕" — der Stand von
davor. Berichtigt am 27.08.2026, samt der Rechnung oben: Wer Baulog gegen Datensatz hält,
findet dort zwangsläufig weniger Urteile und darf daraus nichts schließen.

## Die 287 Crunchyroll-Serien: gemessen am 27.08.2026, mit Gegenprobe

Daniels Einwand: „wir haben doch einen crunchyroll lauf der mit auth alles
abgrast was crunchy hat, der muss doch alles sehen?"

Er sieht alles, was da ist. **Diese Serien sind nicht da.** Zwei unabhängige
Wege, beide mit einem Token aus Deutschland (`country: DE`):

| | Ergebnis |
|---|---|
| Content-API unter der Kennung aus der Adresse | HTTP 200, **keine einzige Staffel** — 223 Serien |
| Suche im deutschen Katalog nach dem Titel | kein passender Treffer, nur Fuzzy-Rauschen |

Die Gegenprobe entscheidet, und sie hält: Dieselbe Suche findet „Detektiv
Conan" (`GW4HM7NV3`), „Fairy Tail" (`G6DQDD3WR`), „Frieren" (`GG5H5XQX4`) und
„JUJUTSU KAISEN" (`GRDV0019R`) auf Anhieb und exakt. Für „Anohana", „Another"
und „Angels of Death" liefert sie „KONOHANA KITAN", „I Got a Cheat Skill in
Another World" und „Angel's 3Piece!" — die Suche antwortet, sie hat nur nichts
zu bieten.

**Der Suchweg war gebaut, aber nie gelaufen.** `tools/cr-kennungen-suchen.mjs`
existiert seit dem 25.08.2026 und steht in keinem Workflow — er braucht eine
deutsche IP. In `data/crunchyroll-de-kennungen.json` standen **drei** Einträge.
Der Lauf über 309 offene Verweise am 27.08.2026 fand **null** weitere: Wo eine
Kennung fehlt, fehlt auch die Serie.

### Was daraus folgt

Diese Verweise zeigen ins Leere — wer sie anklickt, landet bei „nicht
verfügbar". Das ist schlechter als kein Verweis.

`CLAUDE.md` verlangt für das Entfernen einen **zweiten** Beleg, weil der erste
lange Zeit Crunchyrolls Fehlerseite aus US-Sicht war. Der liegt jetzt vor, und
beide stammen aus Deutschland. Die Entscheidung, ob die 223 Verweise fallen,
gehört trotzdem Daniel: Sie ist nicht umkehrbar, ohne dass ein Katalogabruf sie
zurückbringt.
