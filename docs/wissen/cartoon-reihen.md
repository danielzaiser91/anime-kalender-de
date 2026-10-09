# Cartoon-Reihen: belegte Zugehörigkeit aus Wikidata (Recherche + PoC, 09.10.2026)

Anlass (Daniel, 09.10.2026): Cartoon-Titel aus TMDB (negative Kennungen, z. B. „Transformers: War for
Cybertron: Erdaufgang", Kingdom, Rooster Fighter) haben im Panel keine Box „Teile in dieser Reihe". Die
Reihen-Zuordnung (`pipeline/bau/03-reihen.ts`, „Reihen-Zuordnung: 2925 Titel") kennt nur AniList-Titel,
TMDB liefert für Serien keine Reihenbeziehung (`belongs_to_collection` gibt es nur für Filme). Verlangt:
**belegbare Quelle, kein Raten nach Namensanfang.**

Stand der Messung: 09.10.2026, `data/cartoons.json` mit **919** Serien. Nichts davon ist eingehängt; es
gibt keine Datenänderung. PoC-Skripte: `tools/archiv/cartoon-reihen-*.mjs`.

## Ergebnis in einem Absatz

**Wikidata trägt.** Fast alle Cartoons (772 von 919, 84 %) haben dort ein Item über die TMDB-Serienkennung
(Eigenschaft P4983), und die Reihenbeziehungen sind Handarbeit der Wikidata-Redaktion, also belegt. Aus
den Beziehungen entstehen **48 Reihen mit mindestens zwei Cartoons, 130 Titel (14 %)**; von Hand
gegengelesen war keine davon falsch. Der Rest (86 %) bekommt **keine** Box — das ist eine Nichtauskunft,
kein Befund „gehört zu keiner Reihe". Die Lücke ist real (siehe „Was fehlt"): Wikidata kennt die
„War for Cybertron"-Teile Erdaufgang und Kingdom gar nicht, Rooster Fighter nur als Einzelwerk.

## Quellen

| Quelle | Urteil | Beleg |
|---|---|---|
| **Wikidata, SPARQL** (`query.wikidata.org/sparql`) | **trägt**, Hauptquelle | 20 Anfragen, 106 s für alle 919; Lizenz CC0 |
| Wikidata, Suche (`w/api.php?action=wbsearchentities`, `haswbstatement:P4983=…`) | Gegenprobe für Einzelfälle | liefert Items, die der SPARQL-Weg nicht über P4983 findet (Rooster Fighter Q127863698 ohne TMDB-Kennung) |
| Wikipedia (Artikel, Navigationsleisten) | **nur Gegenprobe von Hand**, nicht abrufen | 7 Artikel gegengelesen, siehe unten |
| TMDB `/tv/{id}/external_ids`, `/alternative_titles`, `keywords` | **nicht gemessen** (kein `TMDB_API_KEY` in dieser Sitzung) | `external_ids` brächte IMDb-/TVDB-Kennungen als zweite Brücke zu Wikidata (P345, P4835); `keywords` sind Schlagwörter, keine Reihen |
| TheTVDB, IMDb | **verworfen** | TVDB nur mit Schlüssel und Lizenz; IMDb ohne freie Schnittstelle (Datensätze nur nichtkommerziell). Nicht nötig, weil Wikidata beide Kennungen führt |
| Namensanfang („Ben 10 …", „Marvel's …") | **verworfen** (Daniel) | Gemessen als Lücken-Maß, nicht als Zuordnung: 192 Titel teilen die ersten zwei Wörter mit einem anderen, darunter echte Fehltreffer („The Legend of Korra / Vox Machina / Tarzan", „The Adventures of …", „Marvel's …" mit zehn Serien) |

### Wikidata: Bedingungen im Wortlaut

- **Lizenz:** Strukturierte Daten stehen „under Creative Commons Zero" („released into the public domain";
  `wikidata.org/wiki/Wikidata:Licensing`). Keine Namensnennung nötig, Weitergabe in `public/data` frei.
- **User-Agent:** Pflicht, Form `<Client>/<Version> (<Kontakt>)`; leere oder allgemeine Kennungen
  „may fail with an HTTP 403", Verstöße „may be blocked without notice" (Wikimedia User-Agent Policy). PoC
  sendet `anime-kalender.de-reihen-poc/0.1 (https://anime-kalender.de) node-fetch`.
- **Grenzen des Abfragedienstes** (`mediawiki.org/wiki/Wikidata_Query_Service/User_Manual`): 60 s je Abfrage,
  60 s Rechenzeit je 60 s und Client (Kennung + IP), 5 parallele Abfragen je IP, 30 fehlerhafte je Minute;
  Überschreitung = HTTP 429 mit `Retry-After`, wer das ignoriert, kann gesperrt werden. Große Abfragen per
  POST.
- **robots.txt, namentlich:** `query.wikidata.org/robots.txt` hat `User-agent: *` / `Disallow: /sparql` und
  `/bigdata`; `www.wikidata.org/robots.txt` verbietet `/wiki/Special:EntityData/` (erlaubt nur
  `Special:EntityData/*.<endung>`, also `Q123.json`). **Auslegung:** robots.txt richtet sich an
  Suchmaschinen-Crawler; der Abfragedienst ist ausdrücklich zur programmatischen Nutzung mit User-Agent
  dokumentiert. Das ist eine Auslegung, kein Freibrief — der Abruf bleibt klein (siehe Einbindung), und wenn
  Wikimedia ihn sperrt, ist der Rückweg die Einzelabfrage über `www.wikidata.org/w/api.php`
  (`action=query&list=search&srsearch=haswbstatement:P4983=<id>`; `/w/api.php` steht nicht in den
  Disallow-Zeilen), 919 Einzelanfragen mit Pause.

## Was Wikidata liefert (Eigenschaften)

Je Cartoon: das Item mit `wdt:P4983 "<tmdbId>"`, daran **P179** „Teil der Reihe", **P361** „Teil von",
**P8345** „Medienfranchise", **P155/P156** „folgt auf / gefolgt von", **P144** „basiert auf". Zahlen für die
781 Items (919 Kennungen; 772 mit Item):

| Eigenschaft | Items mit Angabe | Urteil |
|---|---|---|
| P179 + P361 (Reihe, Teil von) | 17 + 14 | sehr zuverlässig, aber selten |
| **P8345 Medienfranchise** | 115 | zuverlässig; breit (Star Wars: 15 Cartoons in einer Reihe) |
| P144 basiert auf | 172 | nur brauchbar, wenn das Ziel selbst ein Cartoon im Bestand ist (Spin-off); sonst meist ein Comic/Spielzeug als Vorlage |
| **P155/P156 folgt/gefolgt** | 78 + 55 | **nicht allein tragfähig:** bei Fernsehserien auch „Nachfolger im Sendeplatz" |

Der Sendeplatz-Fall ist gemessen: Danny Phantom → T.U.F.F. Puppy, Kim Possible ← The Proud Family,
Sanjay and Craig ← Monsters vs. Aliens, The Fairly OddParents → Bunsen is a Beast sind nur Folge im
Programm (Wikipedia „Danny Phantom": T.U.F.F. Puppy erscheint nur als anderes Werk desselben Schöpfers).
Ohne Gegenriegel brächte P155/P156 diese vier falschen Reihen mit.

## PoC: Treffer- und Falschquote

Verfahren (`cartoon-reihen-poc.mjs`, `cartoon-reihen-auswerten.mjs`): alle 919 `tmdbId` in 100er Blöcken
gegen Wikidata, danach die Mitglieder aller gefundenen Hubs (P179/P361/P8345-Ziele, 10 je Abfrage); dann
Union-Find über die gemeinsamen Hubs und die direkten Kanten. Reihen mit nur einem Cartoon zählen nicht.

| Stufe (kumulativ gedacht) | Regel | Reihen ≥ 2 | Titel | von Hand gelesen |
|---|---|---|---|---|
| A | gemeinsamer Hub P179/P361 | 3 | 8 | 3 / 3 richtig |
| **H** | A + P8345 Franchise | 23 | 69 | 23 / 23 richtig |
| B | A + P155/P156 ohne Riegel | 34 | 77 | **4 falsche Reihen** (Sendeplatz) |
| D | H + P155/P156 nur bei **gemeinsamem Wort** der Titel | 37 | 105 | 37 / 37 richtig |
| **E** | D + P144 zwischen zwei Cartoons des Bestands | **48** | **130** | **48 / 48 richtig** |

Trefferquote: **130 von 919 Titeln (14,1 %)** in einer belegten Reihe; 772 (84,0 %) haben überhaupt ein
Wikidata-Item, 294 der 781 Items (37,6 %) tragen irgendeine Beziehung. Falschquote in der Stichprobe: 0 von
48 Reihen (P155/P156 ohne Wortriegel: 4 von 34). **Einschränkung:** „von Hand gelesen" heißt: gegen mein
Sachwissen geprüft und sieben Fälle gegen Wikipedia gelesen (President Curtis → Rick and Morty-Ableger;
Velma → Scooby-Doo; Kamp Koral → SpongeBob-Ableger; Helluva Boss → gleiches Universum wie Hazbin Hotel;
Jessica's Big Little World → Ableger von Craig of the Creek; War-for-Cybertron-Trilogie = Siege,
Earthrise, Kingdom; T.U.F.F. Puppy → kein Ableger). Die übrigen 41 Reihen sind nicht Wikipedia-gelesen.
Der „gemeinsame Wort"-Riegel bei P155/P156 ist eine Namensprüfung **nach** dem Beleg (verwirft
Sendeplatz-Kanten), nicht die Quelle der Zuordnung; er verliert nichts, was eine andere Stufe hielt, ist aber
ein Kompromiss und gehört mit Daniel abgestimmt.

**Stichprobe von 40 Titeln** (die 20 genannten + 20 gleichmäßig aus dem Bestand; `cartoon-reihen-stichprobe.mjs`): 36 mit Wikidata-Item, 19 mit mindestens einer Beziehung, 10 in einer Reihe der
Stufe B (6 in H). Beispiele: Star Wars: The Clone Wars → Star-Wars-Reihe (15 Cartoons); Avatar: Der Herr der
Elemente → Korra + Die sieben Häfen; Castlevania → Nocturne; Steven Universe → Future. Ohne Reihe trotz
Item: Rick and Morty (Item ohne Beziehung, obwohl President Curtis daran hängt), Arcane (Franchise
„League of Legends", aber kein zweiter Cartoon im Bestand), American Dad, Red vs. Blue, X-Men '97.

### Was fehlt (Nichtauskunft, kein Befund)

- **Transformers: War for Cybertron** — das Wikidata-Item der Trilogie trägt nur die Kennung von „Siege"
  (100617, Q65091279); Erdaufgang (117682) und Kingdom (128255) haben **kein Item** (Suche nach dem Titel:
  leer). TMDB führt jeden Teil als eigene Serie, Wikidata als eine. Genau Daniels Beispiel wird von der
  Automatik also **nicht** gelöst.
- **Rooster Fighter** — Wikidata kennt ihn (Q127863698, mit AniList 179813 und MAL 59393), aber als Anime;
  eine Reihe gibt es nicht. Er gehört nach dem Dubletten-PR zu den Animes (siehe unten).
- **Name als Maß der Lücke** (nur gemessen, nie zugeordnet): 192 Cartoons stehen in Namensgruppen, 97
  davon bleiben auch in Stufe E ohne Reihe — darunter echte Reihen (PJ Masks, Looney Tunes, Camp Lazlo,
  Bob's Burgers/Bob's Beach, Talking Tom) und Fehltreffer. Die erreichbare Abdeckung liegt grob bei der
  Hälfte der echten Reihen; der Rest braucht die Handdatei.
- Hub-Mitglieder außerhalb des Cartoon-Bestands: 130 (Filme, Anime, nicht in `cartoons.json`) — nutzlos für
  die Box, nützlich als Wegweiser (siehe Brücke).

### Nebenfund: Wikidata verbindet TMDB mit AniList

16 Cartoons tragen in Wikidata eine AniList- (P8729) oder MAL-Kennung (P4086): u. a. Rooster Fighter (AL
179813), Star Wars: Visions (138060), Ninja Kamui (151639), Terminator Zero (177814), Tekken: Bloodline
(153906), Afro Samurai (1292), Blade Runner: Black Lotus (105931), Scott Pilgrim Takes Off (170206), Bakugan
(108852), Eden (109217). Das ist ein **belegter** Kandidatenweg für den Cartoon→Anime-Umzug des Dubletten-PRs
(`fix/cartoon-anime-dublette`, Bauer a7bfbbc) — Skript `cartoon-reihen-anilist-bruecke.mjs`. Der PR entscheidet
über den Umzug; hier nur als Gegenprobe seiner Liste.

## Entwurf der Einbindung (nicht gebaut)

1. **Abruf** `pipeline/fetch-cartoon-reihen.ts`, im Cartoon-Datenlauf nach `fetch-cartoons.ts`. Liest
   `data/cartoons.json`, fragt Wikidata in 100er Blöcken per POST (UA wie oben, 3 s Pause, `Retry-After`
   achten, 504/429 = Block wiederholen, nach 5 Fehlversuchen **den Block überspringen** und den alten Stand
   dieser Titel behalten). Eine Nichtauskunft löscht nie eine frühere Reihe. Dauer ~2 min, 20 Anfragen.
2. **Stand im Repo:** `data/cartoon-reihen.json` (nicht `data/cache/`): je TMDB-Kennung das Item (`qid`) und
   die Roh-Beziehungen (Hubs mit Namen, Kanten mit Namen) plus Abrufdatum. Das ist die belegbare
   Spur — jede Zuordnung zeigt auf ein Wikidata-Item, das jeder nachlesen kann. Die Gruppenbildung
   passiert im Bau, nicht im Abruf. `data/cache-register.json` bleibt unberührt (nur `data/cache/`); die
   Datei kommt in `tools/quellen-liste.sh` (Dubletten-PR ändert dieselbe Datei, Eintrag erst nach dessen
   Merge, sonst Konflikt).
3. **Handdatei** `data/cartoon-reihen-von-hand.yaml` (Muster `data/reihen-von-hand.yaml`): `ids` + `quelle`
   (Wikipedia-Adresse). Dort stehen die Lücken wie die War-for-Cybertron-Trilogie (117682, 128255, 100617).
   Handbeleg schlägt Wikidata; ein Wikidata-Treffer ist Beleg genug ohne Handeintrag.
4. **Zuordnung — nicht in `03-reihen.ts`.** Diese Phase arbeitet auf der AniList-Map `titles`; Cartoons gibt es
   dort nicht (sie entstehen erst in `schreibeCartoons()`, `05-releases.ts`, nach der Reihenphase). Neues
   Modul `pipeline/bau/cartoon-reihen.ts`: Union-Find über (Hub | Kante | Handeintrag), `franchiseId` =
   kleinste negative Kennung der Gruppe, gesetzt in `schreibeCartoons()` vor dem Schreiben. Negative und
   positive Kennungen kollidieren nie; Cartoon- und AniList-Reihen werden **nicht** verschmolzen (die Box
   zeigt nur, was in `franchises.json` unter derselben Kennung steht). Dafür muss `13-4-zusatzdateien.ts`
   (`fuerReihen`) die Cartoons mitlesen, und `reihen.json` (Worker) bekommt sie automatisch über
   `t.franchiseId`.
5. **Verträglichkeit mit dem Dubletten-PR:** Ein Titel, der als Anime gilt (`data/cartoon-umzug.json`), kommt
   nicht mehr als Cartoon — er darf deshalb weder Glied einer Cartoon-Reihe sein noch eine Reihe stiften.
   Reihenbildung läuft nach dem Herausnehmen dieser Titel, eine Reihe mit weniger als zwei Gliedern fällt
   weg. Dateien, die beide PRs anfassen: `tools/quellen-liste.sh`, `docs/wissen/datensatz.md`,
   `pipeline/bau/13-schreiben.ts` — die Einbindung wird erst nach dem Merge des Dubletten-PRs gebaut; dieser
   PR (nur neue Dokumentdatei + `tools/archiv/`) kollidiert nicht.
6. **Prüfung (Zusicherung):** `check:logic` — (a) Reihe hat ≥ 2 Glieder im Bestand, (b) jedes Glied nennt
   Item oder Handquelle, (c) kein Glied im Umzug, (d) der gemeinsame-Wort-Riegel hält für jede Kante aus
   P155/P156, (e) Untergrenze der Treffer auf dem echten Bestand (Schwelle unten), damit ein stiller Ausfall
   des Abrufs auffällt.

### Empfehlung mit Schwelle

**Bauen, Stufe E**, mit den Riegeln aus der Tabelle (P155/P156 nur bei gemeinsamem Wort) und der Handdatei
für die bekannten Lücken. Schwelle: bei **≥ 40 Reihen / ≥ 110 Titeln** (Stand 09.10.2026: 48 / 130) gilt der
Lauf als gesund; darunter meldet die Prüfung rot, sie wird nie auf den Messwert gesenkt. Erwartung an die
Abdeckung ehrlich sagen: gut 14 % aller Cartoons, etwa die Hälfte der echten Reihen — Rest per Handdatei, bei
Daniels Titeln zuerst (Transformers, Rooster Fighter nach Umzug, Rick and Morty/President Curtis).

Offen, für Daniel: (1) darf der Abruf die Wikidata-Abfrage (robots-Auslegung oben) nutzen, oder soll er den
Einzelweg über `w/api.php` gehen; (2) TMDB-`external_ids` als zweite Brücke braucht den Schlüssel des Laufs,
dort ist sie ein Zusatz (Titel ohne P4983, z. B. wenn Wikidata die TMDB-Kennung nicht führt) — lokal nicht
gemessen.

## Umsetzung (09.10.2026, Zweig `feat/cartoon-reihen`)

Entscheidung statt Entwurf: **kein SPARQL** (robots-Auslegung nicht abgesichert, Rechtsgrauzone). Der Abruf
nutzt die dokumentierten Programmwege — TMDB `/tv/{id}/external_ids` → `wikidata_id`, dann
`www.wikidata.org/w/api.php?action=wbgetentities` in Blöcken à 50. Der Namensriegel bei P155/P156 bleibt als
dokumentierter Kompromiss.

- **Abruf:** `pipeline/fetch-cartoon-reihen.ts` (`npm run data:cartoon-reihen`), im täglichen Lauf nach den
  Cartoons und auf Abruf. Nur neue oder über 30 Tage alte Einträge; ein Block ohne Antwort bleibt offen und
  kommt im nächsten Lauf wieder dran, alte Aussagen werden nie gelöscht. `maxlag=5` mit `Retry-After`; hält
  der Rückstau an (gemessen 09.10.2026: `x-database-lag: 12` über Stunden), geht der fünfte Versuch ohne
  `maxlag` — eine lesende Anfrage je 1,5 s. Ein Block (50 Items) ist ~2,6 MB groß. Ohne `TMDB_API_KEY` holt
  `--qid-datei <json>` die Kennungen stattdessen aus {tmdbId: Q…} (so wurde der Stand lokal gemessen).
- **Stand:** `data/cartoon-reihen.json` (im Repo, in `tools/quellen-liste.sh`). Nicht in
  `data/cache-register.json`: das Register gilt nur für `data/cache/`.
- **Zuordnung:** `pipeline/lib/cartoon-reihen.ts` (reine Logik) und `pipeline/bau/cartoon-reihen.ts`;
  `schreibeCartoons()` setzt `franchiseId` (negativ, kleinste Kennung der Reihe), `franchises.json` nimmt die
  Cartoons mit Reihe auf. `data/cartoon-umzug.json` (Dubletten-PR 521), falls vorhanden, nimmt Titel vor der
  Gruppenbildung heraus.
- **Handdatei:** `data/cartoon-reihen-von-hand.yaml`, erster Eintrag die War-for-Cybertron-Trilogie.
- **Zusicherungen:** `pipeline/check-cartoon-reihen.ts` (in `check:logic`): Fälle aus echten Antworten, jede
  Reihe ≥ 2 Glieder und mit Beleg, kein Cartoon in zwei Reihen, Handreihe mit Adresse; auf dem echten Bestand
  ≥ 40 Reihen und ≥ 110 Cartoons mit Reihe, Trilogie zusammen. Gemessen 09.10.2026: 47 Reihen, 129 Cartoons.
- **Bekannt:** Cartoons ab 2023 ohne belegte Synchro stehen in der Reihenliste hinter dem Schalter „ohne
  Synchro ausblenden" (`ohneBelegteSynchro`), wie bei den Animes.
