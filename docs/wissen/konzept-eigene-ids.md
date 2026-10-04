# Konzept: eigene Kennungen statt AniList-IDs (Entwurf, 04.10.2026)

Anlass: Daniel zur AniList-Ablösung: „Nein, keine Altlast von AniList, IDs wären ein Rückschritt, denk an neue Animes, kommende, wegfallende, es wäre unnötige Altlast —
denk also über eine neue Lösung nach." Mein früherer Vorschlag („AniList-IDs bleiben Schlüssel, die Felder kommen aus aniSearch") ist damit verworfen.

## Was heute an der AniList-ID hängt

Titel, Releases, Handbelege (`data/dub-confirmed.yaml`), Folgenlisten (`public/data/folgen/<id>.json`), Adressen (`#/datenbank?t=<id>`, Teilen-Seiten), Favoriten
im Browser, Newsletter-Abos, `synchro-historie.json`, `news-historie.json`. Fällt AniList weg, fällt der Schlüssel weg; ein neuer Titel bekäme dort erst eine ID,
wenn AniList ihn führt — kommende Anime fehlen häufig.

## Vorschlag: eine eigene, nie wiederverwendete Kennung (`ak`) mit Quell-Zuordnung

- **Ein Titel bekommt beim ersten Sehen eine fortlaufende eigene Zahl** (`ak`), gespeichert in `data/kennungen.json` (Liste, nur anhängen):
  `{ ak, aniSearch?, anilist?, mal?, tmdb?, status: 'aktiv' | 'zusammengelegt' | 'weg', zuAk? }`.
- **Die Quelle der Titel ist aniSearch** (führt Angekündigtes, hat Folgen- und Reihenangaben). Neue aniSearch-Kennung im Katalog-Lauf → neue `ak`. Externe Kennungen sind
  nur **Zuordnungen** (Attribute), nie Schlüssel; AniList steht dort, bis AniList nicht mehr Quelle ist, und kann dann ersatzlos entfallen.
- **Wegfallende und zusammengelegte Titel verschwinden nicht:** `status` wechselt, `zuAk` verweist auf den Nachfolger; Adressen mit einer alten `ak` leiten weiter.
  Eine `ak` wird nie neu vergeben.
- **Adressen:** `t=<ak>`. Veröffentlichte Adressen (`t=<AniList-ID>`, Teilen-Seiten, Browser-Favoriten) funktionieren über die Zuordnung weiter (Rückwärtskompatibilität
  nur für Veröffentlichtes, mit Datum und Ablauf: Auflösung `anilist → ak` mindestens sechs Monate nach Abschalten von AniList als Quelle, dann entscheiden).
- **Migration einmalig:** `ak` für alle Bestandstitel aus der AniList↔aniSearch-Brücke (`data/anisearch.json`, 2.636 Titel), Handbelege und Dateien einmal von
  `anilistId` auf `ak` umschreiben (Skript mit Vorher/Nachher-Vergleich der Bau-Ausgabe, getrennt von jeder Verhaltensänderung). Titel ohne aniSearch-Zuordnung bekommen
  `ak` und `aniSearch` leer — sichtbar als Lücke statt gestrichen.

## Warum nicht die aniSearch-Kennung als Schlüssel

Sie wäre die kürzeste Lösung, bindet uns aber an eine zweite Quelle mit derselben Schwäche (Zusammenlegungen, Umbenennungen, mögliche Sperre — am 09.08.2026 sperrte
aniSearch uns schon einmal). Eine eigene Zahl kostet eine kleine Tabelle und macht jede Quelle austauschbar.

## Offene Entscheidungen für Daniel

1. Einverstanden mit dem Entwurf (eigene `ak`, aniSearch als Quelle, AniList/MAL/TMDB als Zuordnungen)?
2. Wie lange gelten alte Adressen (`t=<AniList-ID>`) — mein Vorschlag sechs Monate nach der Abschaltung von AniList als Quelle.
3. Zeitpunkt: vor oder nach dem Katalog-Lauf (11.607 Titel hinter dem Toggle bekommen dann gleich eine `ak`)? Mein Vorschlag: **vorher**, damit der Katalog gleich mit
   `ak` ankommt.
