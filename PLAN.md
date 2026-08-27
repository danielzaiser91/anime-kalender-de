# Weg zu einem vollständigen Kalender

Stand 27.08.2026, alle Zahlen aus dem ausgelieferten Datensatz gemessen.

## Wo wir stehen

| | Zahl | seit 26.08. |
|---|---|---|
| Titel im Bestand | 2.762 | ±0 |
| davon mit Anbieter-Verweis | 1.625 | −37 |
| mit belegter deutscher Synchro | 1.276 | +54 |
| Verweise mit Urteil | 1.599 | +93 |
| **Verweise ohne Urteil** | **531** | −145 |
| Titel mit Synchro **und** Termin | 377 | +192 |
| Titel mit „Im Angebot seit" | 329 | neu |
| Releases | 446 | +190 |
| Termine | 888 | ±0 |

## Die drei Lücken

### 1. Synchro-Urteile — 531 offene Verweise

| Anbieter | offen | Weg |
|---|---|---|
| Crunchyroll | 356 | größtenteils **kein** automatischer Weg, siehe unten |
| Prime Video | 123 | 118 davon Suchadressen ohne Titelseite |
| Netflix | 22 | Erweiterung, ein Klick je Folge |
| YouTube | 22 | Handarbeit, der Titel nennt oft die Fassung |
| ADN | 5 | eine Serie mit gemischten Staffeln |
| Joyn, Disney+ | 3 | Handarbeit |

**Crunchyroll aufgeschlüsselt** — und die Aufschlüsselung ist die eigentliche
Auskunft:

| | Zahl | was das heißt |
|---|---|---|
| „Content-API kennt keine Staffel" | 287 | Der deutsche Katalog **führt die Serie nicht**. Das ist ein Befund, kein Fehler — aber laut `CLAUDE.md` kein `dub: false`. |
| Deutsch belegt, Zuordnung offen | 43 | Der Rest nach drei Zuordnungsstufen: Specials und Filme, die in keinem Block stehen. |
| keine Serienkennung | 26 | Alte Slug-Adressen. Die Suche im deutschen Katalog fand am 26.08. für 51 von 391 eine Kennung. |

**Die 118 Prime-Suchadressen sind zu.** Weder MOTN noch TMDB führen echte
Adressen — beides am 27.08. gemessen, beides null Treffer. Es bleibt: Die
Erweiterung liest auf der Suchseite den Treffer, den Daniel anklickt, und meldet
die Adresse. Das ist ein Bau, kein Lauf.

### 2. Titel ohne Verweis — 1.137

**Die MOTN-Brücke ist kleiner als gedacht.** Über TMDB lassen sich 791 Titel auf
eine IMDb-Kennung bringen, 238 davon haben deutschen Ton belegt — aber nur **6**
bekämen dadurch ein neues Urteil. 215 sind längst anderweitig belegt. Der
Bestand von 8.521 Folgen in `data/motn.json` ist real, deckt aber im Wesentlichen
Titel ab, die wir schon kennen.

Die frühere Fassung dieses Plans nannte das den größten Hebel. Das war eine
Schätzung aus einer Gesamtzahl, keine Messung der Schnittmenge.

### 3. Termine — 899 Titel mit Synchro ohne einen einzigen

Von 1.276 Titeln mit Synchro haben 377 einen Termin. Der Rest teilt sich so:

- **329 tragen jetzt ein „Im Angebot seit"** aus MOTN — 190 davon (alle aus
  2026) auch als Kalendereintrag, der Rest nur im Detail-Panel. Das Datum sagt,
  seit wann der Anbieter den Titel listet, nicht wann die deutsche Fassung
  erschien; die Beschriftung sagt das auch.
- **Für die übrigen 570 gibt es keine Quelle.** Sie sind erschienen, bevor
  irgendeine unserer Quellen sie kannte.

## Was als Nächstes trägt

1. ~~**Prime-Suchadressen in der Erweiterung**~~ — **gebaut am 27.08.2026** (3.39).
   Auf einer gelisteten Suchseite steht jetzt, welcher Titel gemeint ist und wie viele
   Folgen unser Bestand dazu führt; der Klick auf den richtigen Treffer trägt den
   Auftrag auf die Titelseite, wo die gewohnte Prüfung läuft. Gemeldet wird unter der
   Suchadresse — die kennt der Datensatz —, und die Übernahme macht daraus den echten
   Verweis. Wartet auf Daniels erste Runde.
2. **Die 43 Crunchyroll-Specials** — Filme und OVAs, die in keinem Block stehen.
   Je Fall eine Entscheidung; automatisch nicht zu klären.
3. **Kalender auf Folgen-Ebene** — die Daten liegen (1.746 AniList-Sprechrollen,
   `dubRanges` an vielen Verweisen). Kein neuer Abruf nötig, aber ein Umbau der
   Oberfläche.

## Was 100 % ausschließt

- **Ankündigungen** deutscher Synchronfassungen gibt es in keiner
  maschinenlesbaren Quelle. Was nicht angekündigt ist, findet kein Lauf.
- **Netflix** gibt Tonspuren nur an einen laufenden Player heraus — fünfmal
  gemessen, fünfmal bestätigt.
- **Amazons Kanal-Titel** melden die Sprachen des Kanals, nicht der Folge.
- **287 Crunchyroll-Serien** führt der deutsche Katalog nicht. Ob sie dort je
  liefen, ist von hier aus nicht zu klären.

Erreichbar ist: **jeder Verweis mit einem Urteil, und jeder Titel mit Synchro
mit mindestens einem Datum.** Am 26.08. waren das 1.506 Urteile und 185 Titel
mit Datum; heute sind es 1.599 und 706 (377 mit Termin, 329 mit „Im Angebot
seit").

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
