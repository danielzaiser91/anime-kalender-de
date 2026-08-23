# Was jede Quelle kann — und wo sie versagt

**Zweck.** Daniel am 23.08.2026: „meine handarbeit darf überschrieben werden, aber nur wenn die
quelle vertrauenswürdig ist … erkenne genau wie die quellen funktionieren, wo es hoher trust
hat und wo mehrere tage verzögerung zu erwarten sind."

Diese Datei ist die Grundlage für die Rangfolge in `pipeline/build.ts`. Jede Zeile darin trägt
einen **Beleg mit Datum** — keine Einschätzung, keine Plausibilität. Wo nichts belegt ist,
steht „ungeprüft", und ungeprüfte Quellen überschreiben nichts.

**Pflege:** Wird ergänzt, sobald eine Quelle an einem konkreten Fall bestätigt oder widerlegt
wurde. Widerlegtes wird umgeschrieben, nicht gelöscht — der Grund muss lesbar bleiben.

---

## Die Rangfolge in einem Satz

Eine **Messung am Ort** schlägt eine **Meldung des Anbieters**, die schlägt einen
**Aggregator**, der schlägt eine **Ableitung aus dem Namen**. Innerhalb derselben Stufe
gewinnt das jüngere Datum.

---

## Handprüfung (Daniel, `data/dub-confirmed.yaml`)

| | |
|---|---|
| **Was sie belegt** | Tonspur eines Verweises zum Zeitpunkt der Prüfung, je Staffel oder Bereich |
| **Verzug** | keiner — sie misst am Ort |
| **Schwäche** | **Sie altert.** Ein Angebot kann sich ändern, die Prüfung bleibt stehen |
| **Darf überschrieben werden von** | nichts Automatischem, **außer** einer Quelle, die für denselben Anbieter belegt zuverlässig ist **und** ein jüngeres Datum trägt |
| **Stand** | 1.946 Einträge; `npm run check:handbelege` sichert, dass keine davon still verlorengeht |

**Belegt am 23.08.2026:** Daniels Prüfung widerlegte vier automatische „entfernt"-Meldungen
(Digimon Tamers, Gankutsuou, Mayonaka no Occult Koumuin, Mahoutsukai no Yakusoku) — alle vier
lagen weiterhin im Prime-Abo. Ohne seine Prüfung wären vier gültige Verweise gelöscht worden.

---

## Crunchyroll Content-API

| | |
|---|---|
| **Was sie belegt** | Tonspur **je Folge**, Sendezeiten, deutscher Katalog |
| **Verzug** | gering — läuft stündlich, Kalenderdaten am selben Tag |
| **Trust** | **hoch für Anwesenheit** |
| **Schwäche** | **Meldet keinen Rückzug.** Für „Dragon Ball" und „Dragon Ball Z" liefert sie 153 bzw. 291 Folgen, während die Seite „Videos nicht mehr verfügbar" zeigt (Daniel, 22.08.2026) |
| **Zweite Schwäche** | **Regionsabhängig.** Ein Lauf ohne DE-Zugangspaket sah den US-Katalog — 172 Befunde mussten nachgezogen werden |

---

## Streaming Availability API (Movie of the Night)

Die am gründlichsten vermessene Quelle, und die mit den schärfsten Grenzen.

| Kann sie | Beleg |
|---|---|
| **Prime Video, Tonspur je Folge** | „Vom Landei zum Schwertheiligen" St. 2: Folgen 1–6 einzeln mit Datum und `deu`, deckt sich mit unseren Terminen (23.08.2026) |
| **Deutsche Folgentitel** | dieselbe Messung |
| **Zugangsart** `subscription`/`addon`/`buy` | „Naruto Shippuden" bei Prime in allen drei Formen, inklusive Aniverse-Kanal |

**Fallstrick bei den Folgennummern — belegt am 23.08.2026.** Netflix reiht OVAs **als reguläre
Folgen** in die Staffel ein: Bei KONOSUBA Staffel 2 steht „Die Rückkehr der Abenteurer: OVA"
dort als **Folge 11**. Die Streaming Availability API zählt OVAs nicht mit und kommt deshalb
auf 33 Folgen, wo Netflix und wir 35 zählen.

**Keine der beiden Zahlen ist falsch** — sie zählen Verschiedenes. Für den Abgleich heißt das:
Folgennummern der Quelle dürfen **nicht** mit unseren gleichgesetzt werden, und eine
abweichende Gesamtzahl ist für sich genommen kein Fehlerbefund. Verglichen wird über Titel und
Staffel, nicht über die laufende Nummer.

| Kann sie **nicht** | Beleg |
|---|---|
| **Aktuelle Folgen** | Folge 7 vom 20.08. war am 23.08. **nicht** bekannt — mindestens 3 Tage Verzug |
| **Erscheinungsdaten** | `availableSince` ist ein **Entdeckungsdatum**. Gegen unsere Termine: Folge 5 exakt, Folge 6 einen Tag früher, Folge 2 **sieben Tage später** |
| **Entfernungen** (`change_type=removed`) | **4 von 4 falsch** (23.08.2026, siehe oben). Wird nur gesammelt, nie angewandt |
| **Crunchyroll** | „Lycoris Recoil": Serienebene `deu`, Folgenebene bei allen 13 Folgen `jpn`, richtig war keines. Dazu `data/motn-messung.md`: **96 von 99 Vergleichen „Quelle schweigt"** |
| **Künftige Titel** (`upcoming`) | 12 Serien für ganz Deutschland, **kein Anime** |

**Regel daraus:** Sie darf `dub: true` für **Netflix, Prime Video und Disney+** setzen, wo noch
nichts steht. Sie setzt **nie** `dub: false`, entfernt **nie** einen Verweis, und liefert
**keine** Termine. Für Crunchyroll wird sie ignoriert.

**Und immer mit `series_granularity=episode`** — ohne den Parameter ist die Angabe eine
Serien-Auskunft und für laufende Staffeln falsch.

---

## TMDB / JustWatch (`watch/providers`)

| | |
|---|---|
| **Was sie belegt** | Zugangsart je Titel und Anbieter: `flatrate`, `rent`, `buy`, `ads` |
| **Trust** | **hoch** — lizenzierte Angabe, das Kerngeschäft der Quelle |
| **Schwäche** | **Keine Tonspuren.** Und keine Staffel-Auflösung |
| **Beleg** | Daniels Prüfung vom 23.08.2026 bestätigte vier Titel als `zugang: abo`, die über diesen Weg entstanden |
| **Pflicht** | Sichtbare Quellenangabe „JustWatch" — steht auf `#/quellen` |

---

## ADN

| | |
|---|---|
| **Was sie belegt** | Sprachcode `vde` **je Folge** — die Quelle sagt es selbst |
| **Trust** | hoch |
| **Schwäche** | kleiner Katalog |

---

## aniSearch

| | |
|---|---|
| **Was sie belegt** | **wo** ein Titel läuft (Abschnitt `#streams`), Disc-Termine (`#items`) |
| **Trust** | hoch für die Zuordnung Titel → Anbieter |
| **Schwäche** | **Nennt keine Sprache je Anbieter.** Wer daraus eine Synchro ableitet, rät |
| **Beleg** | Der Abschnitt `#streams` führt Amazon-Verweise als Streams — die Grundlage für die Korrektur von 360 Verweisen am 23.08.2026 |

---

## Ableitung aus dem Anbieternamen (`shared/zugangsart.ts`)

**Die schwächste Stufe, und sie war nachweislich falsch:** Vor dem 23.08.2026 entschied allein
der Name über die Zugangsart. Bei Prime Video ist das unmöglich richtig — der Dienst führt
Abo-Titel und Kauftitel nebeneinander. Sie gilt nur noch, wo keine gemessene Angabe vorliegt.

---

## Wessen Staffelschnitt gilt — und wie die Folgen zugeordnet werden

Daniels Entscheidung vom 23.08.2026: „wir beziehen schließlich für den kalender die infos von
anisearch bezüglich staffel cover produktionsjahr, originaltitel, synchronsprecher etc. …
deshalb würde es glaub ich sinn machen sich auch bezüglich staffel abgrenzung an anilist (oder
anisearch …) zu halten."

**So ist es umgesetzt.** Cover, Titel, Jahr, Folgenzahl und Sprecher kommen von AniList und
aniSearch; käme die Staffelabgrenzung von Crunchyroll, stünden zwei Wahrheiten in einer Zeile.
**Crunchyroll liefert die Tonspur, nicht die Struktur.**

### Die episodenspezifische Zuordnung

Sein zweiter Vorschlag im selben Zug: „um ganz sicher zu sein, sollten wir echte episoden immer
durchzählen, und erst dann versuchen sie in die muster zu gießen." Genau das tut
`beurteileNachFolgennummern` seit dem 23.08.2026.

Der Anlass war Golden Kamuy: Crunchyroll führt dort **einen** Block mit 49 durchgezählten
Folgen — das sind unsere Staffeln 1 bis 4. Über Blockgrößen ist nichts zuzuordnen, keine
unserer Staffeln hat 49 Folgen. Über Nummern schon:

```
Crunchyroll : Block 1 → 1–49 deutsch,  Final Season → 50–62 deutsch
wir         : 12+12+12+13+13 = 62      → 1–12, 13–24, 25–36, 37–49, 50–62
```

**Gruppiert wird dabei über `seriesId`, nicht über die Adresse.** Unsere fünf Staffeln hängen
an drei verschiedenen Schreibweisen derselben Serie (`http://…`, `https://…`,
`…/series/GY8DWQN5Y/…`) und kämen über die Adresse nie zusammen — erst zusammen ergeben sie
die Summe, die die Zuordnung braucht.

**Gemessen:** 36 Serien zählen durch, 162 blockweise, 207 haben nur einen Block. Der neue Weg
liefert fünf Urteile, die der alte nicht hat — und **39, bei denen beide Wege unabhängig zum
selben Ergebnis kommen.** Das ist die eigentliche Ausbeute: eine Kreuzvalidierung zweier
Verfahren.

### Was er bewusst nicht kann

| Lage | warum kein Urteil |
|---|---|
| Blöcke beginnen je neu bei 1 (KONOSUBA) | eine Nummer sagt nichts über die Staffel |
| unsere Reihe unvollständig (Fruits Basket) | alles läge verschoben — genau der Fehler von vorhin |
| ein Block ist teils deutsch | die Lage der undeutschen Folgen ist nicht ableitbar |
| ein Block hat **keine** deutsche Folge | er trägt keine Nummern, also ist unbekannt, welchen Abschnitt er belegt — bei Golden Kamuy liegt der OAD-Block sogar **außerhalb** der Zählung (49 → 50) |

Der letzte Punkt heißt konkret: „Free! Staffel 1 und 2 ohne deutsche Fassung" bleibt der
Handprüfung überlassen. Automatisch belegbar ist dort nur die Anwesenheit, nicht die
Abwesenheit.

## Robustheitstest: `npm run check:quellen`

Daniels Auftrag vom 23.08.2026: „jeden anbieter einmal abklopfen, wie es der automatische lauf
machen würde, dann prüfen ob wir genau das bekommen was wir erwarten."

Der Lauf erzeugt für jede Quelle ihr Urteil **mit denselben Funktionen wie der Build** und hält
es gegen `data/dub-confirmed.yaml`. Er kostet kein Kontingent.

| Ausgang | Bedeutung |
|---|---|
| einig | Quelle und Hand sagen dasselbe |
| **falsch positiv** | Quelle sagt deutsch, Hand sagt nein — schleust ein falsches `true` ein |
| **falsch negativ** | Quelle sagt nein, Hand sagt deutsch — **entfernt einen gültigen Verweis** |
| stumm | Quelle sagt nichts, wo die Hand etwas weiß — Verzug, kein Fehler |

**Stand 23.08.2026, 18:00:**

| Quelle | verglichen | einig | Widersprüche | ohne Kontrolle |
|---|---|---|---|---|
| Crunchyroll Content-API | 21 | 100 % | 0 | **411** |
| ADN | 0 | — | 0 | **107** |

**„Keine Widersprüche" ist hier kein Freispruch.** Die Kontrollgruppe ist winzig: 21 geprüfte
Fälle bei Crunchyroll, **keiner** bei ADN — gegen zusammen über fünfhundert Urteile. Deshalb
gibt der Lauf am Ende eine **Stichprobe ohne Handprüfung** aus: Fälle, in denen noch niemand
nachgesehen hat. Das ist dieselbe ungedeckte Richtung wie bei den vier Netflix-Titeln.

### Crunchyroll zählt Specials als Folgen — die Ursache hinter den stummen Fällen

Daniels Prüfung dreier Serien am 23.08.2026, 17:53, hat eine gemeinsame Ursache freigelegt:
**`block.folgen` ist die Zahl der Einträge in Crunchyrolls Folgenliste, nicht die Zahl der
Folgen.** Specials, PVs und Behind-the-Scenes stehen dort mit drin.

| Serie | Crunchyroll | tatsächlich (Daniel) |
|---|---|---|
| Food Wars, Staffel 4 | 13 Einträge, 12 deutsch | 12 Folgen + Special „E-EX Hinter den Kulissen", doppelte Laufzeit, ohne Synchro |
| Free!, Staffel 1 | 14 Einträge, 0 deutsch | 12 Folgen + zwei PV |
| Golden Kamuy | 49 Einträge, 49 deutsch | unsere Staffeln 1–4 zusammen (12+12+12+13) |
| Free!, Staffeln 1 und 2 | 0 deutsch | stimmt — dort steht „Synchro **English**" |

Deshalb rechnet die Zuordnung seither mit **zwei** gültigen Zahlen je Block: `folgen` und, bei
kleinem Rest (höchstens zwei Einträge), `deutsch`. Eine Größe, die auch an einem nicht
durchgehend deutschen Block hängt, bleibt gesperrt — ein Dreizehn-Folgen-Eintrag könnte sonst
der `12/13`-Block sein.

**Gemessen gegen Daniels zwölf Belege als Kontrollgruppe:** von 1 getroffenem Fall auf **5, bei
0 falschen**. Urteile insgesamt 432 → 470, im Datensatz 507 → 536 belegte Angaben.

Die sieben weiterhin stummen haben belegte Gründe: Golden Kamuys 49er-Block passt zu keiner
einzelnen unserer Staffeln (andere Staffelteilung), Free! Staffel 1 und 2 wären ein `dub: false`
— das erzeugt dieser Weg grundsätzlich nicht —, und Food Wars' Dreizehn ist zwischen zwei
Blöcken mehrdeutig.

### Was der erste Lauf sofort gefunden hat: Fruits Basket

Die Stichprobe meldete `KEIN dt. | Fruits Basket: 2nd Season | „Fruits Basket (2019)" ohne
deutsche Folge` — der **Grund nannte einen anderen Block als den Titel**. Nachgesehen:

```
Crunchyroll:  „Fruits Basket (2019)" 0/25   „Staffel 2" 25/25   „The Final Season" 13/13
wir        :  „2nd Season" 25 Folgen        „The Final" 13      „prelude" 1
```

Uns fehlt der Eintrag für Staffel 1. Die Reihenzuordnung legt unseren „2nd Season" deshalb an
den **ersten** Block an, die Summe geht auf (25 = 25) — und heraus kommt `dub: false` für eine
Staffel, die dort vollständig deutsch läuft. **Der Verweis wäre entfernt worden.**

Die Zählsperre `unsere.length < staffeln.length` fängt das nicht: drei Einträge, drei Blöcke.
Erst der zweite Block fliegt auf (13 + 1 = 14 statt 25), und dieses Auffliegen galt bisher
nicht rückwirkend — der Code sprang mit `continue` weiter und behielt das bereits gefällte
Urteil.

**Behoben:** Geht ein Block nicht auf, ist die ganze Reihe hinfällig (`return []`); bleiben
eigene Einträge übrig, ebenso. Wirkung: Crunchyroll erzeugt seither **kein einziges
`dub: false` mehr** — alle bisherigen negativen Urteile stammten aus Reihen, die nicht sauber
aufgingen. Bei einem Urteil, das Verweise entfernt, ist das der richtige Preis.

**Dass der Fehler nie sichtbar wurde**, lag allein daran, dass im Build eine frühere Quelle
für „Fruits Basket: 2nd Season" bereits `dub: true` gesetzt hatte und Crunchyroll deshalb
übersprungen wurde. Ein Fehler, den nur die Reihenfolge anderer Quellen deckt, ist kein
behobener Fehler.

## Drei Handprüfungen vom 23.08.2026 — und was sie über beide Seiten sagen

Daniel hat drei Crunchyroll-Fälle im Player geprüft, die aus `change_type=updated` stammten:

| Fall | Quelle (MOTN) | wir vorher | Daniels Befund | Ergebnis |
|---|---|---|---|---|
| **Tokyo Ghoul √A** | seit 18.08. nur `eng, fra, jpn` | `dub: true` | alle vier Reihen deutsch synchronisiert | **MOTN falsch, wir richtig** |
| **KONOSUBA St. 1** | deutsch | **unbekannt** | alle Staffeln deutsch **außer Staffel 3** | **wir hatten eine Lücke** |
| **Witch Watch** | deutsch | `dub: true` | alle 25 Folgen deutsch | beide richtig |

**Tokyo Ghoul ist der dritte Beleg gegen MOTN bei Crunchyroll** — nach „Lycoris Recoil" und der
Kontrollmessung (7 Treffer auf 142 Vergleiche). Die Quelle wird dort weiterhin ignoriert.

**KONOSUBA war unser eigener Fehler, und er ist behoben.** Der Abruf hatte alles korrekt
erfasst (`deutschImAngebot: true`, Block 1 und 2 je `10/10 deutsch`); verloren ging es erst in
`beurteile()`: Bei fünf Crunchyroll-Blöcken und zwei eigenen Einträgen brach die Zuordnung ab
(`unsere.length < staffeln.length`). Diese Sperre stammt aus dem Gun-Gale-Online-Fehler vom
21.08. und ist berechtigt — sie kostete aber **89 Serien**.

Seit dem 23.08. gibt es einen zweiten, engeren Weg: Trifft die Folgenzahl eines Eintrags
**nur** vollständig deutsche Blöcke und **kein** Block ohne Synchro trägt dieselbe Zahl, ist
die Reihenfolge gleichgültig — das Urteil lautet so oder so `true`. Gemessen: **31 Verweise neu
belegt, 0 umgedreht, 0 Handprüfungen überschrieben**, stumme Fälle von 89 auf 61.

**Bekannte Restlücke:** KONOSUBA Staffel 3 hat laut Daniel keine einzige deutsche Folge, und
unser Block sagt `0/13`. Ein `dub: false` entsteht auf dem neuen Weg trotzdem nicht — dort wird
nur bestätigt, nie verneint. Die Staffel bleibt offen, statt auf einer Vermutung zu stehen.

## Wo die Messung selbst eine Lücke hat

Die Kontrollmessung (`npm run data:motn:check`, Bericht in `data/motn-messung.md`) prüft, ob
die Quelle **widerspricht** — sie prüft nicht, ob sie **recht hat, wo wir nichts wissen**. Und
genau dort liegt der schädliche Irrtum: ein falsches `dub: true` in einem Bereich ohne
Kontrolle fällt niemandem auf.

Stand 23.08.2026 gibt es dafür **vier prüfbare Fälle** — Netflix-Verweise, für die die Quelle
deutschen Ton behauptet und keine Handprüfung vorliegt:

| Quelle sagt | Titel | Adresse |
|---|---|---|
| 33 von 33 Folgen deutsch | KONOSUBA | `netflix.com/title/80131674` |
| 24 von 24 | Ghost in the Shell SAC_2045 | `netflix.com/title/81030224` |
| 12 von 12 | DAN DA DAN | `netflix.com/title/81736884` |
| 8 von 8 | Pokémon Concierge | `netflix.com/pokemonconcierge` |

**Ergebnis, 23.08.2026: alle vier bestätigt.** Daniel hat jeden Titel im Player geöffnet:

| Titel | Quelle sagte | Daniels Befund |
|---|---|---|
| KONOSUBA | 33 von 33 deutsch | „11+11+13 folgen, alle mit deutscher tonspur" |
| Ghost in the Shell SAC_2045 | 24 von 24 | bestätigt |
| DAN DA DAN | 12 von 12 | bestätigt |
| Pokémon Concierge | 8 von 8 | „alle 8 folgen deutsch" |

**Damit steigt der Trust für Netflix** von „widerspricht nicht" auf **„trifft zu, wo wir
nachsehen konnten"** — vier von vier in genau der Richtung, die vorher ungedeckt war. Die
Angaben stehen jetzt als Handprüfung in `data/dub-confirmed.yaml`.

**Nachgetragen 23.08.2026, 16:43:** Auf Nachfrage hat Daniel DAN DA DAN vollständig bestätigt —
„beide staffeln, alle folgen deutsch". Beide Einträge stehen jetzt als Handprüfung. Die Quelle
nannte zwölf Folgen und meinte damit eine der beiden Staffeln; **ihre Zählung deckt eine
Adresse nicht vollständig ab**, wenn dort mehrere Staffeln liegen. Das ist derselbe Fallstrick
wie bei den OVA-Nummern: Die Quelle antwortet auf eine engere Frage, als die Adresse stellt.

## Offene Prüfpunkte

- **101 Verweise mit `zugang: kauf`** aus TMDB/JustWatch: abgeglichen, nicht validiert. Der
  schädliche Irrtum wäre „kauf, obwohl im Abo" — ein Abonnent klickt dann nicht, und es fällt
  nie auf.
- **Was `change_type=removed` wirklich bedeutet** — vermutlich der Wegfall einer
  Katalogzuordnung, nicht der Serie. Wird gesammelt, bis ein Muster erkennbar ist.
