# Anime-Kalender DE

Wochenkalender für alle Anime-Releases mit **deutscher Synchronisation** — Streaming und Disc,
mit Plattform, FSK, Genres, Keywords, Google-Calendar-Export und Newsletter.

**Live:** https://danielzaiser91.github.io/anime-kalender-de/

## Warum das Ding so gebaut ist

Es gibt keine offene API, die deutsche Synchro-Termine mit Uhrzeit liefert. Crunchyroll blockt
Bots, aniSearch nennt pro Saison nur Startdaten ohne Uhrzeit, und AnimeSchedule.net meint mit
„Dub" ausschließlich Englisch. Deshalb drei Schichten:

| Schicht | Quelle | Automatisch? |
|---|---|---|
| Hat der Titel überhaupt eine deutsche Synchro? | [MyDubList](https://mydublist.com) (CC BY 4.0) | ✅ täglich |
| Metadaten: Genres, Keywords, Cover, Studio, Folgenzahl, Streaming-Links | [AniList](https://anilist.co) | ✅ täglich |
| FSK und Anbieter in Deutschland | [TMDB](https://www.themoviedb.org) | ✅ täglich |
| **Datum, Uhrzeit, Plattform, Release-Art** | kuratiert in `data/curated/*.yaml` | ✋ Handarbeit |

Die Handarbeit bleibt klein, weil ein Eintrag eine **Regel** beschreibt, nicht jede einzelne Folge:
Startdatum + Wochentag + Uhrzeit + Folgenzahl → der Build rollt daraus alle Termine aus.

Was nicht belegt ist, wird auch nicht behauptet: Termine ohne Bestätigung tragen `estimated: true`
und erscheinen mit `≈`, unbekannte Uhrzeiten stehen als „Zeit offen" da statt als erfundene Zahl.

## Loslegen

```bash
npm install
npm run data:all     # Rohdaten holen + Datensatz bauen (~3 Minuten beim ersten Mal)
npm run dev
```

Für FSK und Anbieterliste eine `.env` nach Vorlage von `.env.example` anlegen und einen
kostenlosen [TMDB-API-Key](https://www.themoviedb.org/settings/api) eintragen. Ohne Key
funktioniert alles andere trotzdem.

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild nach `dist/` |
| `npm run data:fetch` | MyDubList, AniList, TMDB → `data/cache/` |
| `npm run data:build` | Cache + kuratierte Daten → `public/data/` inkl. ICS-Feeds |
| `npm run data:all` | beides nacheinander |
| `npm run data:validate` | prüft die kuratierten YAML-Dateien |
| `npx tsx pipeline/qa-resolve.ts` | zeigt, worauf jeder kuratierte Eintrag aufgelöst wurde |
| `npx tsx pipeline/qa-resolve.ts "Titel"` | AniList-Suche für einen einzelnen Titel |

## Einen Termin ergänzen

1. Passende Datei in `data/curated/` öffnen (oder eine neue anlegen — alle `*.yaml` werden gelesen).
2. Eintrag nach dem Muster in [`data/curated/_SCHEMA.md`](data/curated/_SCHEMA.md) hinzufügen.
   Quelle nicht vergessen, sonst schlägt die Prüfung fehl.
3. `npm run data:validate && npm run data:all`
4. Committen. Der Deploy-Workflow baut die Seite neu.

Wenn du die AniList-ID nicht kennst: `search:` reicht, die Pipeline löst sie einmalig auf und
merkt sich das Ergebnis in `data/curated-ids.json`. Mit `npx tsx pipeline/qa-resolve.ts` danach
prüfen, ob wirklich die richtige Staffel getroffen wurde — bei Fortsetzungen liegt die Suche
gern daneben, dann `anilistId:` fest eintragen.

## Aufbau

```
shared/      Typen, Zeit-/ICS-Logik, Mappings — von Pipeline, Web und Worker gemeinsam genutzt
pipeline/    TS-Skripte: fetch → build → validate
data/        curated/*.yaml (Handarbeit) · curated-ids.json (aufgelöste IDs) · cache/ (nicht im Repo)
public/data/ erzeugter Datensatz + ICS-Feeds, wird mit committet
web/         Vite + React + Tailwind
worker/      Cloudflare Worker für den Newsletter (siehe worker/README.md)
```

## Kalender-Abo

Die Feeds unter `public/data/feeds/` sind normale ICS-Dateien und können direkt in Google
Calendar, Apple Kalender oder Outlook abonniert werden — `all.ics`, je Plattform und je Genre.
Sie aktualisieren sich mit jedem Datenlauf von selbst. Für einen einzelnen Termin gibt es im
Detail-Panel den Knopf „Google Calendar", der ohne Login und ohne API auskommt.

## Quellen und Lizenz

- Dub-Daten: [MyDubList](https://mydublist.com) — CC BY 4.0
- Metadaten: [AniList](https://anilist.co)
- FSK und Anbieter: [TMDB](https://www.themoviedb.org) — dieses Projekt nutzt die TMDB-API,
  ist aber weder von TMDB unterstützt noch zertifiziert
- Termine: [aniSearch](https://www.anisearch.de), [Anime2You](https://www.anime2you.de) —
  Quelle je Eintrag im Detail-Panel verlinkt

Code: MIT. Die kuratierten Termindaten stehen unter CC BY 4.0.
Privates Fan-Projekt, keine Gewähr auf die Termine.
