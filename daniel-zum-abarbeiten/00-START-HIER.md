# Was zu tun ist

Stand: 2026-08-30 — **erzeugt aus dem ausgelieferten Datensatz**,
nicht von Hand gepflegt. Wer hier eine Zahl ändert, ändert sie am
falschen Ort; sie kommt beim nächsten Lauf zurück.

| # | Aufgabe | Umfang | Zeit je Stück | wozu |
|---|---|---|---|---|
| 1 | Prime Video — Suchseiten | 157 Suchen | ~20 s je Titel | Titel ohne bekannte Produktseite |
| 2 | [Prime Video — Titelseiten](07-primevideo.md) | 2 Adressen, 71 Verweise | ~15 s je Titel | die Erweiterung liest die Tonspuren selbst |
| 3 | [Netflix](06-netflix-rest.md) | 2 Titel, 12 Verweise | ~1 min je Titel | die einzige Quelle für Netflix-Tonspuren |
| 4 | [Crunchyroll](07-crunchyroll.md) | 35 Verweise | ~15 s je Titel | Specials und Filme, die in keinem Block stehen |
| 5 | [YouTube](09-youtube-liste.md) | 16 Verweise | ~30 s je Video | der Videotitel nennt oft schon die Fassung |
| 6 | [Disney+](07-disneyplus.md) | 1 Titel, 1 Verweis | ~30 s je Titel | der Playback-Aufruf liest die Sprachen ohne Wiedergabe |

**Alles außer Nummer 4 und 5 läuft über die Browser-Erweiterung** aus `extension/`.
Sie zeigt auf jeder Anbieterseite, was dort noch offen ist, liest die Tonspuren und
schickt die Meldung ab. Die Listen hier sind zum Nachschlagen, nicht zum Abtippen.

## Was das bringt

Von 2764 Titeln zeigen **500** keinen einzigen Bezugsweg,
**276** davon mit belegter deutscher Synchro. Für die ist die
Antwort auf „wo kann ich das sehen?" heute: nirgends bekannt. Jede Meldung von hier
macht eine davon weniger.

## Zum Nachschlagen, nicht zum Abarbeiten

- [07-alle-anbieter.md](07-alle-anbieter.md) — die Kurzschrift zum Antworten
- [08-arbeitspakete.md](08-arbeitspakete.md) — dieselbe Arbeit in Blöcken
- [10-kinostarts.md](10-kinostarts.md) — Kinotermine, die eine Fassung brauchen
