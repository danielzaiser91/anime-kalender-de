# Was zu tun ist

Stand: 24.08.2026, 01:00 Uhr. Die Zahlen sind gemessen, nicht geschätzt — erzeugt aus dem
ausgelieferten Datensatz.

| # | Aufgabe | Umfang | Zeit | löst |
|---|---|---:|---|---|
| [1](01-prime-video.md) | Prime Video durchgehen | 384 Adressen | ~15 s je Titel | 594 Verweise + 123 aus einer zweiten Quelle |
| [2](02-crunchyroll-stichproben.md) | Drei Crunchyroll-Seiten ansehen | 3 Klicks | 2 min | entscheidet über 240 Verweise |
| [3](03-adn-stichproben.md) | Drei ADN-Seiten ansehen | 3 Klicks | 2 min | kontrolliert 120 Urteile |
| [4](04-youtube-schluessel.md) | YouTube-API-Schlüssel anlegen | einmalig | 5 min | 23 Verweise |
| [5](05-disney-plus.md) | Disney+ durchgehen | 40 Verweise | ~30 s je Titel | 40 Verweise + 44 aus einer zweiten Quelle |
| [6](06-netflix-rest.md) | Netflix-Rest | 4 Adressen | ~1 min je Titel | 25 Verweise |

**Aufgabe 1 lohnt sich vor allen anderen** — sie ist die größte und löst nebenbei eine zweite.
Die Aufgaben 2 und 3 kosten zusammen vier Minuten und entscheiden über 360 Verweise; wer wenig
Zeit hat, macht die zuerst.

## Zum Nachschlagen, nicht zum Abarbeiten

| Datei | was drinsteht |
|---|---|
| [07-alle-anbieter.md](07-alle-anbieter.md) | jeder offene Verweis, nach Anbieter |
| [08-arbeitspakete.md](08-arbeitspakete.md) | dieselbe Liste in Paketen zu 20 Zeilen |
| [09-youtube-liste.md](09-youtube-liste.md) | was die YouTube-Prüfung gefunden hat |
| [10-rtlplus.md](10-rtlplus.md) | Stand der RTL+-Verweise |
| [11-meldungen-ohne-zuordnung.md](11-meldungen-ohne-zuordnung.md) | Meldungen, die keinem Titel zuzuordnen waren |

Alle sechs werden von der Pipeline erzeugt — **nicht von Hand pflegen**, sie werden beim
nächsten Lauf überschrieben.

## Was diese Arbeit bewirkt

Der Kalender führt **2.233 Anbieter-Verweise**. Bei **1.155** steht „🇩🇪 ?": Wir wissen, dass
der Titel dort läuft, aber nicht, ob auf Deutsch. Das ist die Frage, für die es diese Seite
gibt.

| Anbieter | offen | warum keine Automatik |
|---|---:|---|
| Prime Video | 594 | Nutzungsbedingungen untersagen Data Mining |
| Crunchyroll | 464 | Kennungen ohne Staffel — siehe Aufgabe 2 |
| Disney+ | 40 | `robots.txt` sperrt alles |
| Netflix | 25 | `robots.txt` sperrt alles |
| YouTube | 23 | offene Auskunft nennt keine Tonspur |
| ADN | 7 | eine Kennung, fünf Staffeln — siehe Aufgabe 3 |
| Joyn | 2 | keine Quelle |

## Die Erweiterung einrichten (einmalig)

1. Chrome öffnen, `chrome://extensions` aufrufen
2. Oben rechts **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → den Ordner `extension/` aus diesem Repo wählen
4. Rechtsklick aufs Symbol → **Optionen** → das Lauf-Token eintragen

Ohne Token meldet der Knopf „Kein Token — Rechtsklick aufs Symbol, dann Optionen".

**Nach jeder Änderung** muss sie neu geladen werden: `chrome://extensions`, beim Anime-Kalender
auf ⟳. Die Versionsnummer dort ist die Kontrolle, ob die neue Fassung wirklich läuft.

## Wenn etwas nicht stimmt

Auf einer Amazon-Seite, F12 → Konsole:

```javascript
copy(JSON.stringify(window.__akAmazon, null, 1))
```

Das sagt in einem Zug, wie weit der Melder gekommen ist — Fassung, Anläufe, gefundene Kennung,
Zahl der Abschnitte, jeder Abruf mit Status, jeder Fehler. Bei einem Problem ist das die
schnellste Antwort.
