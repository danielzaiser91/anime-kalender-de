# Uhrzeiten beobachten

Stand: 2026-09-02 — **von Hand gepflegt**, anders als die übrigen Listen hier.

## Warum diese Liste

Der Kalender kennt bei fast keinem Streaming-Termin die Uhrzeit. Kein Anbieter
sagt sie öffentlich, und geraten wird sie nicht — dann steht dort „genaue Uhrzeit
unbekannt", und das ist die ehrliche Auskunft.

Beobachten kann man sie trotzdem: einmal vormittags nachsehen, einmal abends,
und das Fenster eingrenzen. Genau so ist die erste Uhrzeit im Bestand entstanden.

## Was schon belegt ist

| Anbieter | Serie | beobachtet | Wie |
|---|---|---|---|
| Prime Video | Vom Landei zum Schwertheiligen II | **18:00** | Daniel am 02.09.2026: um 11:59 war Folge 9 nicht da, um 18:10 schon — „18 uhr vermutlich, vllt auch früher" |

**Diese Uhrzeit steht nur bei dieser Serie im Kalender.** Ob Prime Video seine
Anime immer um dieselbe Zeit freischaltet, ist damit nicht belegt: Es ist eine
Beobachtung an einer Serie an einem Tag. Bestätigt sie sich bei einer zweiten,
wird daraus eine Regel für den Anbieter — bis dahin bleibt sie ein Einzelfall.

## Was als Nächstes zu beobachten wäre

Zwei Griffe je Termin, und der zweite ist der wichtigere:

1. **Vormittags** (etwa 11 bis 12 Uhr) auf die Titelseite sehen: Ist die neue
   Folge da?
2. **Abends** (etwa 18 bis 19 Uhr) noch einmal. Das Fenster dazwischen ist die
   Antwort.

Wer nur einmal nachsieht, weiß hinterher nur, dass sie *irgendwann* kam.

| Datum | Anbieter | Serie | Folge | Adresse |
|---|---|---|---|---|
| 08.09.2026 | Prime Video | The Ghost in the Shell | — | [Titelseite](https://www.amazon.de/s?k=Ghost+in+the+Shell&i=instant-video) |
| 09.09.2026 | Prime Video | Vom Landei zum Schwertheiligen II | 10 | [Titelseite](https://www.amazon.de/Vom-Landei-zum-Schwertheiligen-II/dp/B0H1QXQL33) |
| 16.09.2026 | Prime Video | Vom Landei zum Schwertheiligen II | 11 | [Titelseite](https://www.amazon.de/Vom-Landei-zum-Schwertheiligen-II/dp/B0H1QXQL33) |
| 23.09.2026 | Prime Video | Vom Landei zum Schwertheiligen II | 12 | [Titelseite](https://www.amazon.de/Vom-Landei-zum-Schwertheiligen-II/dp/B0H1QXQL33) |

**Der 09.09. ist der wertvollste Termin**: Trifft die Folge wieder gegen 18 Uhr
ein, ist die Uhrzeit für diese Serie bestätigt. Der 08.09. ist der zweite Prime-
Titel im Bestand mit anstehendem Termin — dort zeigt sich, ob 18 Uhr am Anbieter
hängt oder an der Serie.

## Wohin die Antwort gehört

Uhrzeit einer Serie → `schedule.time` im kuratierten Eintrag
(`data/curated/*.yaml`), mit einer Notiz, woher sie stammt.

Bestätigt sie sich bei mehreren Serien desselben Anbieters, gehört die
Beobachtung zusätzlich in `CLAUDE.md` — dann ist sie eine Regel und keine
Einzelmessung mehr.
