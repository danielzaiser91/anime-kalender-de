# 2 — Drei Crunchyroll-Seiten ansehen

**Zwei Minuten. Entscheidet über 240 Verweise.**

## Was zu tun ist

Drei Seiten öffnen und je eine Frage beantworten: **Sind dort Folgen zu sehen, ja oder nein?**

1. https://www.crunchyroll.com/de/series/G6DQN9KGR/is-it-wrong-to-try-to-pick-up-girls-in-a-dungeon
2. https://www.crunchyroll.com/de/series/GR5V95N8R/acca-13-territory-inspection-dept
3. https://www.crunchyroll.com/de/series/GRNQ2QMQR/junjo-romantica-3

**Antwort in einer Zeile**, in der Kurzform: `1-1 2-x 3-x`
(`1` = Folgen sind da · `x` = keine Folgen, Fehlerseite oder Weiterleitung)

Die Erweiterung wird hier nicht gebraucht — es geht nur darum, **ob** überhaupt etwas da ist.

## Warum das 240 Verweise entscheidet

Der Bestand führt 240 Crunchyroll-Serien mit dem Vermerk „Content-API kennt keine Staffel zu
dieser Kennung". Gemessen am 23.08.2026 mit einem frischen Zugangspaket für den **deutschen**
Katalog, über beide API-Wege:

| Abfrage | Ergebnis |
|---|---|
| Staffeln zur Kennung | 10 von 10: HTTP 200, **null** Staffeln |
| Die Serie selbst | 10 von 10: HTTP 200, **richtiger Titel** |
| Kontrollgruppe (Serien mit Staffeln) | 4 von 4: je eine Staffel |

Die Kennung stimmt also, Crunchyroll kennt die Serie — und der deutsche Katalog führt **keine
abrufbare Folge**. Wenn das stimmt, zeigen 240 Verweise im Kalender auf Seiten ohne Inhalt.

**Warum trotzdem nachgesehen werden muss:** Zwei Wege derselben API sind kein zweiter Beleg.
Und ein Fall macht stutzig — **DanMachi** (der erste Verweis oben) ist eine große, laufende
Reihe. Entweder läuft sie in Deutschland wirklich nicht auf Crunchyroll, oder die Messung
greift bei manchen Serien daneben. Das entscheidet dein Blick.

Fällt die Antwort auf **alle drei `x`**, werden die 240 Verweise entfernt. Ist auch nur einer
`1`, wird die Messung verworfen und neu angesetzt.
