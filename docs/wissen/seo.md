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
- **Terminüberschrift und `inLanguage`:** „Alle Termine mit deutscher Synchronisation“ und `inLanguage: de` im JSON-LD stehen nur bei `synchroBelegt` (`termineUeberschrift`, `sprachFeld` in `titel-seite.ts`), sonst „Alle Termine“ und kein Feld. `check-teilseiten.ts` prüft das an jeder gebauten Titelseite (13.10.2026: 1253 Seiten geändert, Zahl der Zählstelle `zaehleBelegte` gleich 2546).
- **Sammelseite `/termine/`:** Überschrift „Alle Termine“, Title „Alle Anime-Termine: Synchro belegt oder angekündigt“, Stand „Deutsche Synchro belegt bei N, bei den übrigen angekündigt oder wahrscheinlich.“ (Texte in `lib/termine-uebersicht.ts`; N zählt mit `synchroBelegt` über `titles.json`, nicht über `titles-core.json`, dem 108 von 781 Termintiteln fehlen, Stand 13.10.2026: 617 statt 724). Sie verspricht nie „mit deutscher Synchro“, weil sie auch Termine unbelegter Titel (56) führt; `check-termine-uebersicht.ts` und `check-teilseiten.ts` prüfen das.

## Vorschaubild der Titelseiten für WhatsApp (03.11.2026)

- **Anlass:** `/t/13052/` (Bright Samurai Soul) zeigte in WhatsApp nur „anime-kalender.de“. `og:image` war der AniList-Banner (291.349 Byte, 1900×400) ohne `og:image:width/height`; WhatsApp zeigt nur Bilder unter ~300 KB mit Maßen.
- **Klasse (Bestand 03.11.2026, `titles.json`, 2.924 Titel):** 2.221 TMDB-Banner in `w1280` (Stichprobe 100–1.141 KB, ein Titel über 1 MB), 626 AniList-Banner/Cover (beliebige Größe, Banner bis 4,75:1), 60 `cover.anime-kalender.de`, 17 ohne Bild. Titel mit Termin nutzten schon das Terminbild (1200×630, Maße); betroffen waren die 2.261 Titel ohne Termin.
- **Entscheidung:** TMDB-Banner in `w780` (780×439, Stichprobe 16 Titel: höchstens 137 KB, Ø 80 KB), alles andere das Standardbild 1200×630 (43 KB); jede Titelseite trägt Maße und `summary_large_image`. Eigene 1200×630-Bilder je Titel (Messung: Ø 70 KB, ~160 MB im Repo, AniList-Banner würden 3× hochskaliert) bleiben verworfen.
- **Wächter:** `vorschauMaengel` (`lib/titel-vorschau.ts`) in `check-teilseiten.ts` und `check-titel-vorschau.ts`: Maße, eigene Domain oder TMDB `w780`, kein „1 Folgen“. Lehre: `check-teilseiten` prüfte nur, dass `og:image` eine `https`-Adresse ist, nie Größe oder Maße.
- **Folge (03.11.2026, `titles.json`, Stand des Arbeitsbaums auf `4e6027b4f`):** Titel ohne TMDB-Banner mit TMDB-Plakat `w500` (278, davon 225 ohne Termin) zeigen das Plakat statt des Standardbilds: 500 × Höhe aus den Originalmaßen in `data/tmdb-poster.json` (`round(500·h/w)`), kleine Karte (`summary`, Hochformat). An allen 278 Plakaten abgerufen: höchstens 183 KB, Maße ohne Abweichung. Standardbild auf den Titelseiten 704 → 479. Bleibt Standard: AniList-Bilder (keine belegten Maße), aniSearch-Cover (nie Hotlink), Titel ohne Bild. Wächter: `vorschauMaengel` gleicht die Breite gegen die Größe im Pfad ab (`w780` ↔ 780, `w500` ↔ 500); `check-teilseiten` verlangt mindestens eine Seite mit Plakat-Vorschau, sonst fehlt die Verdrahtung im Seitenbau.
- **Rest ohne TMDB (04.11.2026, Datenstand `8026d1411`, gebaute Seiten):** 448 Titel mit Cover zeigten trotzdem das Standardbild (Ratsche `STANDARD_TROTZ_COVER_HOECHSTENS` in `check-teilseiten.ts`, darf nur sinken). Ursache bei Bright: Samurai Soul (AniList 135432): ONA mit einer Folge, `lookup` suchte nur `search/tv`, TMDB führt es als Film 839100. Fix: `lookup` fragt nach leerer Serien-Suche für ONA/OVA/Special mit genau einer Folge noch `search/movie` (`koennteFilmSein`). Probe an den 327 Fehlschlägen dieser Art: 134 Film-Treffer (alle mit Plakat); erst der nächste TMDB-Lauf und der Plakat-Lauf tragen sie ein, danach die Grenze nachziehen. Der Rest (vor allem Serien; AniList-Cover 225–460 px und Dateien bis 676 KB, aniSearch-Kopien als WebP) bleibt Standardbild, bis ein Messlauf Maße und Größe je Cover belegt (eigener Auftrag).
- Nach dem Deploy WhatsApp-Cache der Adresse im Facebook-Debugger mit „Scrape Again“ erneuern.

## Prüfungen

- `check:logic` → `pipeline/check-seiten-seo.ts` (Ähnliche Titel, Startseite, Verzeichnis, Brotkrumen, Seitentitel, `lastmod`; Gegenproben).
- Nach dem Bau (`check-teilseiten.ts`): Startseite trägt den Suchbegriff; jede Titelseite der Sitemap ist in höchstens 3 Klicks von der Startseite erreichbar (Breitensuche über `<a href>` in `dist/`, ohne die 651 aus der Messung wäre das rot); `lastmod` nie nach heute und nicht überall derselbe Tag; jede Titelseite hat Brotkrumen.

## Offen

- Landingpages je Anbieter und Saison (Maßnahme 4 der Analyse) sind nicht gebaut.
- Messung der Wirkung in der Search Console 2–4 Wochen nach dem Deploy; danach Verzeichnisseiten einzeln zur Indexierung einreichen.
