# Kuratierte Termin-Daten

Jede Datei in diesem Ordner ist eine YAML-Liste von Einträgen. Die Pipeline zieht sich
Metadaten (Genres, Keywords, Cover, Folgenzahl, Studio) automatisch von AniList und
mischt die hier gepflegten deutschen Termine darüber.

**Nur das hier pflegen, was maschinell nicht zu holen ist:** Datum, Uhrzeit, Plattform,
Release-Art, FSK, deutscher Titel.

```yaml
- slug: black-torch                 # Pflicht, eindeutig, kleingeschrieben
  search: Black Torch               # Suchbegriff für AniList (wenn keine ID bekannt)
  anilistId: 123456                 # optional; hat Vorrang vor `search`
  malId: 54321                      # optional
  titleDe: Black Torch              # deutscher Titel; sonst nimmt der Build den englischen
  platform: crunchyroll             # crunchyroll|netflix|primevideo|disneyplus|adn|aniverse|wow|joyn|rtlplus|youtube|disc|kino
  platformUrl: https://…            # optional; sonst nimmt der Build den AniList-Link
  buyUrl: https://…                 # optional; bei Disc sonst Amazon-Suchlink
  releaseType: weekly               # weekly|batch|movie|disc
  fsk: 12                           # optional: 0|6|12|16|18
  publisher: AniMoon Publishing     # nur bei Disc
  edition: Complete Box, Blu-ray    # nur bei Disc
  note: Freitext für Sonderfälle    # optional
  schedule:
    firstEpisodeDate: "2026-07-04"  # ISO, immer in Anführungszeichen
    time: "17:30"                   # Europe/Berlin; weglassen, wenn nicht belegt
    episodeCount: 12                # optional; sonst von AniList
    lastEpisodeDate: "2026-09-20"   # optional; sonst berechnet
    skipDates: ["2026-08-15"]       # optional: Sendepausen
    estimated: true                 # true, wenn das Datum abgeleitet statt bestätigt ist
  sources:                          # Pflicht: woher stammt der Termin?
    - https://www.anisearch.de/news/anime/58458,simulcast-uebersicht-sommer-2026
```

## Regeln

1. **Kein Termin ohne Quelle.** `sources` ist Pflicht, `validate.ts` bricht sonst ab.
2. **Geraten ist nicht gleich belegt.** Wenn das Dub-Datum aus dem Simulcast-Start
   abgeleitet wurde, gehört `estimated: true` dran — die Oberfläche kennzeichnet das.
3. **Uhrzeit lieber weglassen als erfinden.** Ohne `time` zeigt der Kalender
   „Uhrzeit unbekannt" statt einer Falschangabe.
4. Ein Eintrag = eine Staffel. Fortsetzungen bekommen einen eigenen Eintrag mit
   eigenem Slug (`re-zero-s4`, nicht `re-zero`).
