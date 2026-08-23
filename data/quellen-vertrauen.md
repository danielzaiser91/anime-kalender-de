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
