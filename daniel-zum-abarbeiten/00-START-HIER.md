# Was zu tun ist

Stand: 2026-08-31 — **erzeugt aus dem ausgelieferten Datensatz**,
nicht von Hand gepflegt. Wer hier eine Zahl ändert, ändert sie am
falschen Ort; sie kommt beim nächsten Lauf zurück.

| # | Aufgabe | Umfang | Zeit je Stück | wozu |
|---|---|---|---|---|
| 1 | Prime Video — Suchseiten | 1 Suchen | ~20 s je Titel | Titel ohne bekannte Produktseite |
| 2 | [Prime Video — Titelseiten](07-primevideo.md) | 21 Adressen, 35 Verweise | ~15 s je Titel | die Erweiterung liest die Tonspuren selbst |
| 3 | [Netflix](06-netflix-rest.md) | 24 Titel, 12 Verweise | ~1 min je Titel | die einzige Quelle für Netflix-Tonspuren |
| 4 | [Crunchyroll](07-crunchyroll.md) | 35 Verweise | ~15 s je Titel | Specials und Filme, die in keinem Block stehen |
| 5 | [YouTube](09-youtube-liste.md) | 16 Verweise | ~30 s je Video | der Videotitel nennt oft schon die Fassung |
| 6 | [Disney+](07-disneyplus.md) | 7 Titel, 1 Verweis | ~30 s je Titel | der Playback-Aufruf liest die Sprachen ohne Wiedergabe |

**Alles außer Nummer 4 und 5 läuft über die Browser-Erweiterung** aus `extension/`.
Sie zeigt auf jeder Anbieterseite, was dort noch offen ist, liest die Tonspuren und
schickt die Meldung ab. Die Listen hier sind zum Nachschlagen, nicht zum Abtippen.

## Was das bringt

Von 2764 Titeln zeigen **497** keinen einzigen Bezugsweg,
**280** davon mit belegter deutscher Synchro. Für die ist die
Antwort auf „wo kann ich das sehen?" heute: nirgends bekannt. Jede Meldung von hier
macht eine davon weniger.

## Zum Nachschlagen, nicht zum Abarbeiten

- [07-alle-anbieter.md](07-alle-anbieter.md) — die Kurzschrift zum Antworten
- [08-arbeitspakete.md](08-arbeitspakete.md) — dieselbe Arbeit in Blöcken
- [10-kinostarts.md](10-kinostarts.md) — Kinotermine, die eine Fassung brauchen
- [12-verpasste-termine.md](12-verpasste-termine.md) — Termine, die ein Anbieter hat verstreichen lassen
- [13-tonspur-verdacht.md](13-tonspur-verdacht.md) — Verweise, denen eine zweite Quelle widerspricht

## Warum hier weniger steht, als es aussieht

Die Zeilen 2 bis 6 oben sind **eine** Menge Verweise, geschnitten nach Anbieter.
Die Sammelliste und die Arbeitspakete zeigen dieselben noch einmal am Stück —
wer alles zusammenzählt, zählt jeden Verweis mehrfach.

Erledigte Anleitungen stehen unter [archiv/](archiv/) und sind kein offener Punkt.
