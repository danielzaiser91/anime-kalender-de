# Suchmaschinen: was die Seiten liefern und was gemessen ist

Chronik zu `pipeline/build-share-pages.ts` und `pipeline/lib/{startseite,titel-seite,titel-umfeld,titel-verzeichnis,sitemap-datum,seiten-erreichbar}.ts`. Ältere Befunde zu den Teilen-Seiten (07.09.2026: 62 von 664 Seiten indexiert, `Gefunden – zurzeit nicht indexiert`) stehen als Kommentar an `body()` und im Statusarchiv. Analyse mit Konkurrenz und Suchbegriffen: `daniel-zum-abarbeiten/berichte/seo-analyse-2026-10-13.md`.

## Ausgangsstand 13.10.2026 (Search Console, 07.08.–10.10.2026)

- 3 Klicks, 144 Impressionen, Ø-Position 17,5; „anime kalender“ Position 11,5; „deutscher anime kalender“ kommt unter den 17 Suchanfragen nicht vor.
- 89 Seiten indexiert, 2.775 „Gefunden – zurzeit nicht indexiert“ (Google kennt sie nur aus der Sitemap), 26 gecrawlt, aber nicht indexiert.
- Gebaute Seiten (Messung vor dem Umbau): Sitemap 2.953 Adressen, davon 2 mit `lastmod`; von der Startseite aus sind 651 von 2.951 Titelseiten über Links erreichbar (20 in einem Klick, 631 über `/termine/`). Startseite 13,4 kB (4,8 kB gzip), `/termine/` 120 kB (20,4 kB gzip), `/t/1/` 10,1 kB (4,2 kB gzip).
- Messpunkt danach: dieselben Zahlen 2–4 Wochen nach dem Deploy.

## Was seit 13.10.2026 gebaut wird

- **Startseite:** `<title>` „Deutscher Anime-Kalender: Anime mit deutscher Synchro“, H1 „Deutscher Anime-Kalender“, drei kurze Absätze und die Buchstabenleiste. Der Text steht im `#root`; für Besucher mit JavaScript verdeckt ihn der Ladeschirm, bis die App ihn ersetzt.
- **Die App überschrieb Titel und Beschreibung** jeder Seite beim Start (`applyDocumentLanguage`) mit demselben Text. Google liest nach dem Rendern; die eigenen Angaben der Titelseiten gingen verloren. Seit 13.10.2026 setzt die App nur noch `lang`.
- **A–Z-Verzeichnis:** `/titel/` und `/titel/<buchstabe>/` (`a`–`z`, `0-9`), 27 Seiten, reines HTML. Aufgenommen ist, was die Sitemap anbietet (Anime; Cartoons nur mit `dub: true`). Titel mit Synchro unterhalb der Stufe „stark“ tragen den Vermerk „Synchro erwartet“. Die Startseite verlinkt jeden Buchstaben: jede Titelseite ist zwei Klicks von der Startseite entfernt.
- **Titelseiten:** Brotkrumen (Start › Titel von A bis Z › Buchstabe › Titel, auch als `BreadcrumbList`), fünf „Ähnliche Titel“ (`shared/aehnlich.ts`, dieselbe Funktion wie das Detail-Panel; belegte Synchro vor unbelegter, Faktor 0,6).
- **Title und Beschreibung:** „auf Deutsch“ steht nur bei belegter Synchro (`synchroBelegt` in `shared/titles.ts`: Anime Stufe `high`/`very-high`, Cartoons ein Weg mit `dub: true`). Sonst „<Titel>: Stand der deutschen Synchro“ und der Satz „Deutsche Synchro angekündigt oder wahrscheinlich, noch nicht belegt.“. Vorher stand „Mit deutscher Synchronisation.“ bei jedem Anime.
- **Sitemap `lastmod`** je Titelseite aus den Daten des Titels (`sitemap-datum.ts`), nur wo ein Datum vorliegt. Ein Änderungsdatum je Titel gibt es nicht; `gesehenAm` der Quellen ist fast überall der letzte Lauf und taugt nicht. Ein eigener Stand je Seite (Hash der Seite gegen den Vorbau, committet vom Bestandsbau) wäre genauer und ist nicht gebaut.

## Prüfungen

- `check:logic` → `pipeline/check-seiten-seo.ts` (Ähnliche Titel, Startseite, Verzeichnis, Brotkrumen, Seitentitel, `lastmod`; Gegenproben).
- Nach dem Bau (`check-teilseiten.ts`): Startseite trägt den Suchbegriff; jede Titelseite der Sitemap ist in höchstens 3 Klicks von der Startseite erreichbar (Breitensuche über `<a href>` in `dist/`, ohne die 651 aus der Messung wäre das rot); `lastmod` nie nach heute und nicht überall derselbe Tag; jede Titelseite hat Brotkrumen.

## Offen

- Landingpages je Anbieter und Saison (Maßnahme 4 der Analyse) sind nicht gebaut.
- Messung der Wirkung in der Search Console 2–4 Wochen nach dem Deploy; danach Verzeichnisseiten einzeln zur Indexierung einreichen.
