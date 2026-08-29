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

### 1. Synchro-Urteile — 178 offene Verweise

| Anbieter | offen | Weg |
|---|---|---|
| Prime Video | 76 | Erweiterung, Daniels Prüfliste |
| Netflix | 32 | Erweiterung, ein Klick je Folge |
| Crunchyroll | 30 | Titel im Katalog anders benannt — siehe unten |
| YouTube | 22 | Handarbeit, der Titel nennt oft die Fassung |
| ADN | 15 | zwei Adressformen, die nicht zusammenfinden |
| Joyn, Disney+ | 3 | Handarbeit |

**Crunchyroll: 34 von 56 an einem Abend automatisch beantwortet.** Vier Wege,
alle am 29.08.2026 gefunden und in `pipeline/lib/crunchyroll-dub.ts` sowie
`pipeline/fetch-cr-filmbloecke.mjs` beschrieben:

| Weg | gelöst |
|---|---|
| Blockketten — ein Block deckt mehrere Cours | 5 |
| Suche ohne `type=series` — Filme als `movie_listing` | 8 |
| Eigene Filmreihen — „Fairy Tail Movies" | 5 |
| Folgen innerhalb der Serie — Conan-Filme nennen ihre `versions` | 8 |

**Zwei naheliegende Anker tragen dort nicht**, und das ist gemessen: Der
japanische Originaltitel findet nichts (die Suche indiziert nur lokalisierte
Titel), und das Jahr in der Antwort ist das der Aufnahme ins Angebot. Was trägt,
ist das **Kennwort** hinter dem letzten Trenner, mindestens sechs Zeichen.

Die verbleibenden 22 heißen im Katalog anders — „Fruits Basket: Prelude" steht
dort als „-prelude-". Ein Abgleich über Beschreibungstexte wäre der nächste
Schritt und ist kein sicherer Weg mehr.

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
nachzuladen", weil seine Warteschlange nur nach dem Alter fragte. **Seit dem
29.08.2026 abends ist das Archiv vollständig: 2.616 von 2.616.**

**Und damit ist diese Lücke ausgeschöpft.** Von den 498 Titeln, die noch keinen
Weg zeigen, hat **keiner** eine deutsche Disc-Ausgabe im aniSearch-Bestand. Was
automatisch zu holen war, ist geholt; der Rest ist Handarbeit oder gar nicht zu
beantworten.

**Für die 277 mit Synchro und ohne Weg bleibt danach:** Titel, die weder ein
Streamingdienst führt noch je eine deutsche Disc hatten. Dort ist die ehrliche
Antwort „Kein Anbieter bekannt".

### 3. Termine — 1.161 Titel mit Synchro ohne einen einzigen

Von 1.349 Titeln mit belegter Synchro haben 188 einen Kalendereintrag. Der Rest
ist erschienen, bevor eine unserer Quellen ihn kannte; 329 tragen wenigstens ein
„Im Angebot seit" aus MOTN.

**Nachtrag 30.08.2026 — für Discs galt das nicht.** Der Auszug aus dem
aniSearch-Archiv () stammte vom 13.08., als 1.660
Archivdateien fehlten. Nach dem Nachholen findet derselbe Code 160 statt 94
künftige deutsche Ausgaben; im kuratierten Bestand stehen 57 Termine statt 14.

**Für Streaming-Ankündigungen bleibt es dabei:**
Ankündigungen deutscher Synchronfassungen gibt es in keiner maschinenlesbaren
Quelle. Was nicht angekündigt ist, findet kein Lauf.

## Die 15 offenen ADN-Verweise: zwei Adressformen, die nicht zusammenfinden

Gemessen am 29.08.2026. Unser Bestand führt ADN unter **zwei** Adressformen:

| Form | Zahl | passt zum Katalog |
|---|---|---|
| `animationdigitalnetwork.com/de/video/<id>` | 70 | ja |
| `animationdigitalnetwork.de/video/<slug>` | 65 | **nein** |

Der Katalog (`data/adn-catalog.json`, 114 Serien) führt Kennungen, die
Slug-Adressen stammen aus aniSearch. Zehn der fünfzehn offenen Verweise haben
deshalb keinen Anschluss — nicht weil die Auskunft fehlt, sondern weil die
beiden Seiten nicht zusammenfinden.

**Ein Namensabgleich löst vier davon, und drei davon eindeutig:** die drei
One-Piece-Filme, jeweils eine Folge, im Katalog mit `vde: 0`. Das wäre ein
belegtes Nein — und würde den Verweis entfernen.

**Der vermeintliche Widerspruch war ein Messfehler — aufgeklärt am 29.08.2026,
23:10.** Die Auswertung suchte in den Katalogfolgen nach `vde`, fand in allen
4.078 nichts und meldete „0 von 113 deutsch" für JoJo. Tatsächlich enthält
`adn-catalog.json` **nur Serien mit deutschen Folgen**, und in ihren `episodes`
stehen **ausschließlich** die deutschen — `episodeAus()` schreibt deshalb kein
`languages`-Feld. Wahr ist also das Gegenteil: **Jede Folge im Katalog ist
deutsch.**

Damit sind die drei One-Piece-Filme belegt (je eine Folge bei uns, je eine im
Katalog, Name exakt) und im Bau umgesetzt. JoJo bleibt offen: 26 Folgen bei uns
gegen 113 im Katalog — das ist die Sammelserie aller Staffeln.

**Der saubere Weg** ist die Auflösung Slug → Kennung an der Quelle. ADN
beantwortet einen fremden Abruf mit HTTP 403 (CloudFront); die vorhandene
API-Anbindung in `fetch-adn.ts` kann es, braucht aber eine Suchfunktion, die es
dort bisher nicht gibt.

## Der Crunchyroll-Bestand ist vollständig — gegengeprüft

Daniels Frage vom 29.08.2026 („wenn der lauf gesamten crunchy bestand hat und
alles sammelt…") ist damit beantwortet, und zwar gemessen statt vermutet. Der
vollständige deutsche Katalog liegt seit demselben Abend im Repo
(`data/cr-katalog-de.json`, 1.591 Einträge):

| | Zahl |
|---|---|
| Katalogeinträge mit deutscher Tonspur | 352 |
| davon Serienkennung schon im Bestand | 331 |
| davon Name im Bestand | 323 |
| **weder noch** | **7** |

Und die sieben sind allesamt keine Lücke:

- **Vier Sammelseiten** — „Detektiv Conan Movies", „Haikyu!! (Synchronfassungen)",
  „Code Geass – Akito the Exiled" (bei uns fünf Einzelteile), „Gosho Aoyama's
  Collection of Short Stories".
- **Einer anders benannt** — „Detektiv Conan Film 29: Der gefallene Engel der
  Autobahn" steht bei uns als „Der gefallene Engel des Highways".
- **Einer kein Anime** — „Crunchyroll Anime Awards 2021" ist eine Preisverleihung.
- **Einer keine japanische Produktion** — „Onyx Equinox" (24 Folgen, deutsche
  Tonspur) ist ein US-Original; AniList führt es nicht, und dieser Bestand baut
  auf AniList auf.

**Was Crunchyroll auf Deutsch anbietet, steht also im Kalender.** Was offen
bleibt, sind Zuordnungsfragen innerhalb bekannter Titel — keine fehlenden Werke.

## Vorzulegen: darf ein gleichnamiger Block ein Nein belegen?

Gemessen am 29.08.2026, spät abends. `beurteileJeBlock` vergleicht den
Blocknamen mit unserem Titel und bildet daraus **nur Ja-Urteile**: Führt der
Block deutsche Folgen, sagt er Ja; führt er keine, sagt er nichts.

**Zwei Fälle wären damit belegbar, und sie stehen heute offen:**

| unser Eintrag | Block im deutschen Katalog |
|---|---|
| Fruits Basket (25 Folgen) | „Fruits Basket (2019)", 25 Folgen, **null deutsch** |
| Bofuri (12 Folgen) | „BOFURI: I Don't Want to Get Hurt…", 12 Folgen, **null deutsch** |

Der Beleggrad ist derselbe, den `beurteile()` für ganze Serien längst nutzt:
Der **deutsche** Katalog kennt den Block und führt keine deutsche Fassung. Die
Staffeln 2 und 3 derselben Adresse bleiben unberührt — das Nein gälte nur dem
Block, dessen Name **und** Folgenzahl passen.

**Nicht gemacht, und zwar bewusst.** Die Zusicherung „ohne deutsche Folgen kein
Urteil" in `check:cr-zuordnung` verbietet es ausdrücklich; sie stammt aus einer
früheren Entscheidung, und ein Nein **entfernt den Verweis**. Zwei Verweise sind
kein Grund, eine Sperre im Alleingang zu kippen, die genau davor schützt.

Kaguya-sama fällt übrigens von selbst heraus: „Love is War" und „Love is War?"
normalisieren auf denselben Namen, und die Eindeutigkeitssperre greift, bevor es
überhaupt zur Frage kommt. Das spricht für die Genauigkeit des Vergleichs.

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
