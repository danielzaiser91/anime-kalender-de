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
| **Sendezeiten der deutschen Simuldubs** | [Crunchyroll-Simulcast-Kalender](https://www.crunchyroll.com/de/simulcastcalendar) | ✅ täglich |
| Termine anderer Plattformen, Disc-Releases, Kino | kuratiert in `data/curated/*.yaml` | ✋ Handarbeit |

Der Crunchyroll-Kalender führt deutsche Synchro-Folgen als eigene Einträge mit dem Zusatz
„(Deutsch)" und exakter Uhrzeit — öffentlich, ohne Login, ohne Premium. Genau die Angabe, die
sonst nirgends maschinenlesbar existiert. Der Scraper trägt sie täglich nach und legt neu
aufgetauchte Simuldubs **von selbst** als Termin an; den Staffelstart rechnet er aus der
frühesten gesehenen Folgennummer zurück.

Für alles andere bleibt Handarbeit — die aber klein, weil ein Eintrag eine **Regel** beschreibt
statt jeder einzelnen Folge: Startdatum + Uhrzeit + Folgenzahl → der Build rollt daraus alle
Termine aus.

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
| `npm run data:crunchyroll` | deutsche Sendezeiten aus dem Simulcast-Kalender → `data/crunchyroll.json` |
| `npm run data:build` | alles zusammen → `public/data/` inkl. ICS-Feeds |
| `npm run data:all` | alle drei nacheinander |
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

## Wie sich der Kalender selbst aktualisiert

Eine GitHub Action läuft **täglich um 04:17 UTC** (`.github/workflows/refresh-data.yml`) und
macht der Reihe nach:

1. MyDubList neu ziehen — neue Titel mit belegter Synchro
2. AniList für alle neuen MAL-IDs abfragen — Metadaten, Genres, Keywords, Beziehungen
3. TMDB für kuratierte Titel — FSK und deutsche Anbieter
4. Crunchyroll-Simulcast-Kalender lesen — acht Wochen rückwärts, alle „(Deutsch)"-Einträge
   mit Uhrzeit; neu aufgetauchte Simuldubs werden automatisch zu Terminen
5. Datensatz und ICS-Feeds neu bauen
6. Nur bei tatsächlicher Änderung committen — der Deploy-Workflow zieht dann nach

Fällt eine Quelle aus, bleibt ihr letzter Stand stehen: Der Crunchyroll-Schritt ist
`continue-on-error`, TMDB-Ergebnisse liegen versioniert in `data/tmdb.json`, und gefundene
Sendezeiten werden in `data/crunchyroll.json` fortgeschrieben statt ersetzt — eine
abgeschlossene Staffel verschwindet aus dem Kalender, ihre belegte Uhrzeit bleibt gültig.

Manuell auslösen: Actions → „Daten aktualisieren" → „Run workflow".

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
