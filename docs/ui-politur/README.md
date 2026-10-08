# UI-Politur, 08.10.2026

Durchsicht der Live-Seite (hell und dunkel, Handy 390 px und Desktop 1366 px) über Woche, Monat, Datenbank, News, Saison,
Detail-Panel, Einstellungen und Abo. Umgesetzt wurden die sichtbarsten Schwächen mit kleinem Aufwand, je Commit eine.
Die Bilder hier zeigen links vorher (Live-Stand), rechts nachher (gebautes `dist/`).

## Umgesetzt

| Bild | Änderung |
|---|---|
| `datenbank-desktop-hell.webp`, `db-hover-desktop-hell.webp` | Datenbank-Kachel: der dunkle Streifen mit Stern, Auge und Teilen lag auf jedem Cover; jetzt erst beim Zeigen oder per Tastatur (wie die Wochen-Kachel), FSK bleibt, ein gesetzter Stern bleibt. Rechts unten: die Filterleiste ohne aktive Filter als Pille statt leerer Leiste über die ganze Breite. |
| `datenbank-handy-dunkel.webp` | Handy: die drei Schalter in einer rollbaren Reihe statt drei Zeilen, das Wort „Sortierung" nur ab `sm`; auf dem Handy nur das Zeichen für Gemerktes, bedient wird im Panel. |
| `db-leer-desktop-dunkel.webp`, `db-leer-handy-hell.webp` | Kein Treffer: ein leiser Kasten mit dem, was helfen kann, und dem Knopf „Auch Anime ohne deutsche Synchro zeigen"; die Zeile „davon 0 Anime und 0 Cartoons" entfällt bei null. |
| `news-handy-dunkel.webp` | News auf dem Handy: die Filterchips rollen seitlich statt vier Zeilen zu füllen. |
| — | Statuspille „Erschienen" neutral wie „abgeschlossen" — der Akzent stand auf fast jeder Kachel; „laufend" und „angekündigt" behalten ihre Farbe. |
| — | Alle Übergänge höchstens 150 ms (Cover-Zoom, Cover-Überblendung, Leisten, Panel-Einfahren); `prefers-reduced-motion` global in `styles.css` statt an einzelnen Stellen. |

## Messung (gedrosseltes Handy, `node tools/archiv/ladegewicht-messung.mjs --lokal=dist --n=3`)

| | vorher (origin/main) | nachher |
|---|---|---|
| CLS | 0 / 0 / 0 | 0 / 0 / 0 |
| LCP (ms) | 1836 / 1792 / 1780 | 1984 / 1892 / 1796 |
| Bytes ohne Bilder (gzip) | 569.373 | 569.959 (+586) |
| TBT (ms) | 686 / 663 / 513 | 815 / 710 / 500 |

LCP und TBT streuen zwischen den Läufen stärker als zwischen den Ständen (gleiches Element „anime·kalender").

## Gesehen, nicht behoben

| Schwäche | Wo | Aufwand |
|---|---|---|
| Pillenfarben außerhalb der Palette: Violett für „Angekündigt" (News, Saison, Panel-Neuigkeiten), Blau/Indigo/Teal für Quelle, nachgetragen, nachgereicht, Pink für „Premiere" (TV-Kasten, Panel), Violett für „Cartoon". Ein Farbsystem je Bedeutung (3–4 Töne auf der Palette) wäre ruhiger. | `NewsView.tsx` `NEWS_FARBE`, `SaisonView.tsx` `STUFE_FARBE`, `detail/neuigkeiten.tsx`, `detail/panel-karte.tsx`, `kalender/TvKasten.tsx`, `db-karte.tsx` | mittel (ein Nachmittag, Entscheidung mit Daniel) |
| Panel auf dem Handy: beim Öffnen steht der Titel halb unter dem oberen Rand (Panel scrollt zur Staffelüberschrift) | `DetailPanel.tsx` | klein, Ursache erst messen |
| Zählzeile + Sortierung auf dem Handy: das Menü steht allein auf einer dritten Zeile | `db-bedienung.tsx` `DbZaehlzeile` | klein |
| Desktop-Kopf: der „?"-Knopf hängt als eigener Kasten am Suchfeld | `Header.tsx`, `Suchfeld.tsx` | klein |
| TV-Kasten: Mini-Cover 24 × 34 px sind kaum zu erkennen | `kalender/TvKasten.tsx` | klein (32 px, dann Spaltenbreite prüfen) |
| Wochen-Kachel ohne Hover-Rückmeldung außer den Knöpfen (Datenbank-Kachel hebt sich) | `kalender/PosterKarte.tsx` | klein |
| Sichtbarer Tastaturfokus nur über den Browser-Standard; `focus-visible` an 7 Stellen | überall | mittel |
| Datenbank-Kachel: Titel 13 px, Nebenzeile 11 px, Pille 10 px — an der unteren Lesbarkeitsgrenze | `db-karte.tsx` | klein, braucht Blick auf Kartenhöhe |
