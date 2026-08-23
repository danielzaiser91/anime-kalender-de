# Was zu tun ist

Stand: 23.08.2026, 23:20 Uhr. Sechs Aufgaben, nach Wirkung sortiert.

Jede hat eine eigene Datei mit den genauen Handgriffen. **Die Reihenfolge ist eine Empfehlung,
keine Vorgabe** — nur Aufgabe 1 lohnt sich vor allen anderen, weil sie nebenbei eine zweite
löst.

| # | Aufgabe | Zeit | löst |
|---|---|---|---|
| [1](01-prime-video.md) | Prime Video durchgehen | je Titel ~15 s | 385 Verweise + 123 aus einer zweiten Quelle |
| [2](02-crunchyroll-stichproben.md) | Drei Crunchyroll-Seiten ansehen | 2 min | entscheidet über 240 Verweise |
| [3](03-adn-stichproben.md) | Drei ADN-Seiten ansehen | 2 min | 120 ungeprüfte Urteile |
| [4](04-youtube-schluessel.md) | YouTube-API-Schlüssel anlegen | 5 min | 23 Verweise |
| [5](05-disney-plus.md) | Disney+ durchgehen | je Titel ~30 s | 40 Verweise |
| [6](06-netflix-rest.md) | Netflix-Rest | je Titel ~1 min | 25 Verweise |

## Was diese Arbeit überhaupt bewirkt

Der Kalender führt **2.233 Anbieter-Verweise**. Bei **1.161** steht „🇩🇪 ?" — wir wissen, dass
der Titel dort läuft, aber nicht, ob auf Deutsch. Das ist die Frage, für die es diese Seite
gibt.

Keine öffentliche Quelle beantwortet sie für Prime Video und Disney+. Beide sperren
automatisierte Abrufe, und die eine Schnittstelle, die es gäbe, liefert für sie keine geprüfte
Auskunft. Was bleibt, ist ein Mensch, der hinsieht — und die Erweiterung, die ihm die Arbeit
auf einen Klick verkürzt.

## Die Erweiterung einrichten (einmalig)

1. Chrome öffnen, `chrome://extensions` aufrufen
2. Oben rechts **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → den Ordner `extension/` aus diesem Repo wählen
4. Rechtsklick aufs Symbol → **Optionen** → das Lauf-Token eintragen

Ohne Token meldet der Knopf „Kein Token — Rechtsklick aufs Symbol, dann Optionen".

**Nach jeder Änderung an der Erweiterung** muss sie neu geladen werden: `chrome://extensions`,
beim Anime-Kalender auf ⟳. Die Versionsnummer steht dort; sie ist die Kontrolle, ob die neue
Fassung wirklich läuft.

## Wenn etwas nicht stimmt

Alles, was der Melder tut, steht in der Konsole (F12):

```javascript
copy(JSON.stringify(window.__akAmazon, null, 1))
```

Das sagt in einem Zug, wie weit er gekommen ist — Fassung, Anläufe, gefundene Kennung, Zahl der
Abschnitte, jeder Abruf mit Status, jeder Fehler. Bei einem Problem ist das die schnellste
Antwort; drei Runden Rätselraten haben am 23.08. gezeigt, wie teuer die Alternative ist.
