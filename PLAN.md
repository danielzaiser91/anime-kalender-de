# Weg zu einem vollständigen Kalender

Stand 26.08.2026, alle Zahlen aus dem ausgelieferten Datensatz gemessen.

## Wo wir stehen

| | Zahl |
|---|---|
| Titel im Bestand | 2.762 |
| davon mit Anbieter-Verweis | 1.662 |
| mit belegter deutscher Synchro | 1.222 |
| Verweise ohne Urteil | **676** |
| Titel ganz ohne Verweis | **1.100** |
| Releases | 256 (111 Sammelstart, 92 Disc, 45 wöchentlich, 8 Film) |
| Termine | 888, davon 202 künftig |
| Titel mit Synchro **und** Termin | **185 von 1.222** |

Zwei Zahlen sagen, was fehlt: **676 Verweise ohne Urteil** und **1.037 Titel mit
belegter Synchro, aber ohne einen einzigen Termin**.

## Die drei Lücken

### 1. Synchro-Urteile — 676 offene Verweise

| Anbieter | offen | Weg |
|---|---|---|
| Crunchyroll | 464 | automatisch, siehe unten |
| Prime Video | 122 | Suchadressen ohne Titelseite |
| Disney+ | 36 | erledigt sich mit den 558 Meldungen |
| Netflix | 25 | Erweiterung, Klick je Folge |
| YouTube | 22 | Handarbeit, Titel nennt oft die Fassung |
| ADN | 5 | automatisch aus dem Archiv |
| Joyn | 2 | Handarbeit |

**Crunchyroll ist der große Brocken und zugleich der einfachste.** Der deutsche
Katalog liefert je Folge `versions[].audio_locale`; die Auswertung ordnet aber
noch **blockweise** zu und verweigert bei Unklarheit — zu Recht, denn eine
Serienkennung ist ein Block, kein Werk. Dieselbe Vorsicht kostet 60 Titel ein
Urteil, das in den Daten längst steht: Specials und Filme mit einer Folge lassen
sich keinem Block sicher zuordnen.

Auf Folgen-Ebene entfällt das Problem. Die Frage „gibt es diese Folge auf
Deutsch" beantwortet `versions` ohne jeden Abgleich; die Zuordnung zu unseren
Staffeln braucht es erst danach.

**Prime hat 122 Suchadressen** (`/s?k=…`) statt Titelseiten. Dort kann die
Erweiterung nichts lesen. Es braucht einen Schritt, der aus einer Suchadresse
eine echte macht — oder die Einträge fallen weg.

### 2. Titel ohne Verweis — 1.100

`data/motn.json` hält **8.521 Folgen mit belegtem deutschen Ton**:

| Anbieter | Folgen |
|---|---|
| Netflix | 4.131 |
| Prime Video | 2.588 |
| Disney+ | 1.536 |
| Crunchyroll | 266 |

352 Serien mit deutschem Ton stehen dort, davon **185 ohne Entsprechung oder
Urteil bei uns**. Das ist der größte ungenutzte Bestand im Repo — und er ist
schon bezahlt.

Was fehlt, ist die **Zuordnung**: MOTN führt IMDb-Kennungen, wir AniList. Über
Titel und Jahr geht es grob; sauber wird es über die japanische Erstausstrahlung
(bei Crunchyroll bereits der gemeinsame Anker) oder über TMDB als Brücke, das
beide Kennungen führt.

### 3. Termine — 1.037 Titel ohne einen einzigen

Das ist die größte Lücke, aber die Zahl täuscht: Die meisten dieser Titel sind
**längst erschienen**. Für sie ist kein künftiger Termin nötig, wohl aber ein
Erscheinungsdatum — sonst steht im Kalender ein Titel ohne jede Zeitangabe.

Zu trennen sind deshalb drei Fälle:

- **Läuft gerade** — braucht wöchentliche Termine. Kommen aus dem
  Crunchyroll-Kalender und ADN, sind weitgehend da.
- **Ist erschienen** — braucht ein Datum „im Angebot seit". Für Netflix, Prime
  und Disney+ liegt das in `motn.json`; für Crunchyroll in den Folgendaten
  (`episode_air_date`, mit der bekannten Einschränkung bei Katalogtiteln).
- **Kommt noch** — braucht eine Ankündigung. Hier gibt es keine Automatik: Für
  deutsche Termine existiert keine Schnittstelle, es bleiben Anime2You,
  aniSearch und die Verlage.

## Reihenfolge

1. **Crunchyroll auf Folgen-Ebene** — 464 offene Verweise plus 60 verweigerte
   Urteile, ohne einen einzigen neuen Abruf. Die Daten liegen in
   `data/crunchyroll-raw/`.
2. **MOTN zuordnen** — 8.521 belegte Folgen, 185 Serien ohne Urteil. Braucht die
   Kennungsbrücke, sonst nichts.
3. **Erscheinungsdaten aus MOTN** — dieselbe Brücke, dieselben Daten, füllt die
   zweite der drei Terminarten.
4. **Prime-Suchadressen** — 122 Einträge, die heute niemand prüfen kann.
5. **Kalender auf Folgen-Ebene** — erst dann lässt sich anzeigen, welche Folgen
   deutsch sind. Alles davor liefert die Daten dafür.

## Was 100 % ausschließt

Der letzte Prozentpunkt ist nicht zu holen, und das gehört in den Plan:

- **Ankündigungen** deutscher Synchronfassungen gibt es in keiner
  maschinenlesbaren Quelle. Was nicht angekündigt ist, kann kein Lauf finden.
- **Netflix** gibt Tonspuren nur an einen laufenden Player heraus — ein Klick je
  Folge, fünfmal gemessen, fünfmal bestätigt.
- **Amazons Kanal-Titel** melden die Sprachen des Kanals, nicht der Folge. Ein
  `dub: true` von dort ist ein Hinweis, kein Beleg.

Erreichbar ist: **jeder Verweis mit einem Urteil, und jeder Titel mit Synchro
mit mindestens einem Datum.** Das ist die Messlatte, an der sich der Fortschritt
ablesen lässt — nicht eine Prozentzahl.
