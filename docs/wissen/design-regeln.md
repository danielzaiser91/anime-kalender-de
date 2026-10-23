# Design-Regeln der Website (Farbrollen und Zustände)

Festgelegt 13.10.2026 (Fable, Daniels Auftrag: „Orange auf Schwarz ist gut, muss aber überall einheitlich sein“).
Gilt für alles unter `web/src`. Die Werte stehen **an genau einer Stelle**: `web/src/styles.css` (`html.dark` / `html:not(.dark)`,
Tailwind-Namen `bg-ak-…`, `text-ak-…`, `border-ak-…`). Dieses Dokument nennt die Rollen und die Regeln; die Kontrasttabelle unten
erzeugt `node tools/design-kontrast.mjs --schreiben`, und `check:logic` rechnet sie nach.

Mockup aller Rollen und Zustände in beiden Themen: Bühne, Mockup `design-regeln` (`npm run buehne:bilder -- --mockup design`);
Vorher/Nachher der ganzen App und des Filterfensters: Mockups `design-app` und `design-filter`.

## 1. Grundsatz

- **Ein Akzent, Orange** (`--ak-akzent`). Er steht für „hier geht es weiter“: Klickbares mit Gewicht, der gewählte Reiter, Heute, Läuft.
  Keine zweite Markenfarbe. Teal, Violett, Blau, Gold sind **Kennfarben** mit je genau einer Bedeutung (Abschnitt 4), nie Schmuck.
- **Das Thema tragen die Tokens.** Ein `ak-*`-Token hat je Thema einen Wert; neuer Code schreibt nie `dark:`-Paare und nie `slate`/`sky`.
  Die Umbelegung von `slate`/`sky` in `styles.css` ist eine Brücke für Altbestand (26.09.2026) und wird mit den Aufträgen abgebaut.
- **Farbe ist nie das einzige Merkmal.** Gewählt trägt `aria-pressed`/`aria-current`/`aria-selected` und Gewicht oder Füllung, Ausgeschlossen
  ist durchgestrichen und trägt ⊘, Links sind unterstrichen, Deaktiviertes ist blass **und** ohne Zeiger, Fokus hat einen Ring.
- **Kontrast AA**: Text 4,5:1, Zeichen/Ränder/Füllungen 3:1 — nachgerechnet, nicht geschätzt (Abschnitt 3).
- Kein neuer Hex-Wert außerhalb `styles.css`. Ausnahmen: Anbieter- und Flaggenfarben (`detail/pillen.tsx`, `filter/Flagge.tsx`, `shared/types.ts`),
  der Kino-Saal (`.ak-saal-*`, bewusst themenunabhängig).

## 2. Farbrollen

| Rolle | Token | Verwendung |
|---|---|---|
| Grund | `ak-grund` | Seite |
| Fläche | `ak-flaeche` | Karten, Panel, Fenster, Eingabefelder |
| Fläche 2 | `ak-flaeche-2` | abgesetzte Flächen (Segmentgruppe, Chip-Grund), Hover auf Fläche |
| Fläche 3 | `ak-flaeche-3` | Hover auf Fläche 2, gedrückter Zustand neutraler Knöpfe |
| Anbieter-Pille | `ak-pille`, `ak-pille-hover` | Fläche der Anbieter-Pille und ihr Hover (dunkel 1,28:1 Unterschied, die graue Zeile `ak-leise` bleibt darauf ≥ 4,5:1; Paare in der Kontrasttabelle); Stellen: `detail/pille.tsx`, `pillen.tsx`, `merken-optik.ts` |
| Rand / Linie | `ak-rand`, `ak-linie` | Rahmen von Karten und Feldern / Trennlinien |
| Text | `ak-text`, `ak-leise`, `ak-sehr-leise` | Haupttext / Nebentext, Beschriftungen / Platzhalter, Zahlen in Chips |
| Akzent | `ak-akzent`, `ak-akzent-hover`, `ak-auf-akzent` | Primärknopf, gewähltes Segment, Heute, Läuft; Text darauf dunkel |
| Akzent als Text | `ak-akzent-text`, `ak-link` | Akzent in Schriftgröße (hell dunkler, 4,5:1); `ak-link` ist derselbe Wert mit Namen |
| Gewählt | `ak-gewaehlt`, `ak-auf-gewaehlt` | genau eins von n (Reiter, Segment, Navigation) — Alias auf Akzent, damit es einmal umstellbar bleibt |
| Fokus | `ak-fokus` | Fokusring, 2 px, 2 px Abstand (`outline`, nicht `ring`) |
| Gut | `ak-gut`, `ak-gut-text`, `ak-gut-grund`, `ak-auf-gut` | belegt, bestätigt, ✓ Deutsch, Erfolg, gewählte Filter-Pille (Rand); `ak-auf-gut` = Text auf der Füllung (hell weiß, dunkel dunkel; 4,5:1) |
| Fehler | `ak-fehler`, `ak-fehler-text`, `ak-fehler-grund`, `ak-auf-fehler` | Fehler, Abbrechen/Beenden, ausgeschlossene Filter-Pille (Rand); `ak-auf-fehler` = Text auf der Füllung; `.ak-immer-dunkel` gibt Flächen, die in beiden Themen dunkel sind (Beleg-Dialog, Trailer-Fenster), alle Rollen der Dunkelfassung, die ein Kind sonst hell erbt (Liste im Abschnitt Werkzeuge) |
| Warnung | `ak-warnung`, `ak-warnung-text`, `ak-warnung-grund` | Warnung, Hinweis mit Handlungsbedarf, Bugfix in den Patch Notes |
| Info | `ak-info`, `ak-info-text`, `ak-info-grund` | erklärende Marke ohne Handlungsbedarf: Nachtrag, Schnellfilter-Band, Neuigkeiten-Marken, „ab 11.10.“-Pille unter „Demnächst“ (nur eine Auskunft über den Start, kein Handlungsbedarf, deshalb Info statt Warnung) |
| TV | `ak-tv`, `ak-tv-grund`, `ak-tv-rand` | nur lineares Fernsehen |
| Katalog | `ak-katalog`, `ak-katalog-text` | nur Katalog-Release |
| Favorit | `ak-favorit`, `ak-favorit-text`, `ak-favorit-rand` | Favoriten-Stern, Favoriten-Rand der Kachel (`ak-favorit-rand`: dunkel wie `ak-favorit`, hell #b07d00 für 3:1 gegen den Seitengrund, 17.10.2026) **und** Disc-Punkt der Neuigkeiten (Gold; die Liste „Was sich getan hat“ färbt Disc ebenfalls gelb; als Punkt `ak-favorit-text`, weil `ak-favorit` hell nur 1,6:1 hat). Die übrigen Punkte der Neuigkeiten und die Chips der News tragen dieselbe Kennfarbe je Art (`web/src/components/news-farben.ts`): neu, Folgen, nachgereicht `ak-gut`; angekündigt, offiziell `ak-info`; Kino, Rhythmus `ak-akzent`; verspätet, nachgetragen `ak-leise` |
| Finale | `ak-finale`, `ak-finale-text` | Staffelfinale (Ring, Fahne, Punkt am Handy): Gelbgrün, Farbton ~98° — 35° neben Favorit-Gold, 60° neben dem Smaragd von `ak-gut` (17.10.2026) |
| Neutrale Marke | `ak-marke` | Fahne „Neu bei <Anbieter>“ (ohne Kennfarbe, in beiden Themen gleich hell); Text darauf `#0d0f14` |
| Heute | `ak-heute` | Grund der Heute-Spalte |

`-text` ist die Variante für Schrift (hell dunkler, dunkel heller), `-grund` die 10–12 % Tönung über `ak-flaeche` für Kästen und Pillen.
Ohne `-text` ist der Wert für Ränder, Punkte, Zeichen und Füllungen gedacht (3:1 gegen Fläche).

## 3. Kontrast (erzeugt)

Vorne auf Hinten, beide Themen; Schwelle 4,5 für Text, 3 für Zeichen, 1,3 für den Kartenrand (Sichtbarkeit, keine AA-Pflicht).
Zwei Bestandswerte verfehlten die Schwelle und wurden am 13.10.2026 korrigiert: `--ak-sehr-leise` dunkel `#7a808c` → `#828894`
(4,4 → 4,9 auf Fläche) und `--ak-akzent` hell `#ff5a36` → `#f54b27` (2,8 → 3,2 auf Grund; dunkel bleibt `#ff5a36`).

<!-- kontrast-tabelle:anfang -->
| Vorne | Hinten | Mindestens | Dunkel | Hell |
|---|---|---|---|---|
| text | grund | 4.5 | 17.0 (#f2f1ee auf #0d0f14) | 16.3 (#15171c auf #f5f4f0) |
| text | flaeche | 4.5 | 15.6 (#f2f1ee auf #151922) | 17.9 (#15171c auf #ffffff) |
| text | flaeche-2 | 4.5 | 14.5 (#f2f1ee auf #1b202a) | 14.8 (#15171c auf #ebe9e3) |
| text | flaeche-3 | 4.5 | 13.2 (#f2f1ee auf #222733) | 13.7 (#15171c auf #e4e1da) |
| leise | grund | 4.5 | 7.3 (#9aa0ab auf #0d0f14) | 6.2 (#555b66 auf #f5f4f0) |
| leise | flaeche | 4.5 | 6.7 (#9aa0ab auf #151922) | 6.8 (#555b66 auf #ffffff) |
| leise | flaeche-2 | 4.5 | 6.2 (#9aa0ab auf #1b202a) | 5.6 (#555b66 auf #ebe9e3) |
| sehr-leise | flaeche | 4.5 | 4.9 (#828894 auf #151922) | 5.5 (#636974 auf #ffffff) |
| leise | pille | 4.5 | 6.1 (#9aa0ab auf #162238) | 6.8 (#555b66 auf #ffffff) |
| leise | pille-hover | 4.5 | 4.7 (#9aa0ab auf #26344f) | 5.6 (#555b66 auf #ebe9e3) |
| akzent-text | grund | 4.5 | 7.5 (#ff7a5c auf #0d0f14) | 5.4 (#b8321a auf #f5f4f0) |
| akzent-text | flaeche | 4.5 | 6.9 (#ff7a5c auf #151922) | 6.0 (#b8321a auf #ffffff) |
| akzent-text | flaeche-2 | 4.5 | 6.4 (#ff7a5c auf #1b202a) | 4.9 (#b8321a auf #ebe9e3) |
| auf-akzent | akzent | 4.5 | 6.2 (#0d0f14 auf #ff5a36) | 5.1 (#15171c auf #f54b27) |
| auf-akzent | akzent-hover | 4.5 | 7.5 (#0d0f14 auf #ff7a5c) | 4.6 (#15171c auf #e8491f) |
| gut-text | flaeche | 4.5 | 10.3 (#4ade9f auf #151922) | 7.0 (#04664a auf #ffffff) |
| gut-text | gut-grund | 4.5 | 8.2 (#4ade9f auf #192f30) | 6.1 (#04664a auf #e6f2ee) |
| fehler-text | flaeche | 4.5 | 9.3 (#fda4af auf #151922) | 7.8 (#a8002c auf #ffffff) |
| fehler-text | fehler-grund | 4.5 | 7.8 (#fda4af auf #31242e) | 6.6 (#a8002c auf #fce8ed) |
| warnung-text | flaeche | 4.5 | 12.2 (#fcd34d auf #151922) | 7.1 (#92400e auf #ffffff) |
| warnung-text | warnung-grund | 4.5 | 9.5 (#fcd34d auf #312d22) | 6.4 (#92400e auf #fbf1e6) |
| info-text | flaeche | 4.5 | 9.8 (#93c5fd auf #151922) | 6.7 (#1d4ed8 auf #ffffff) |
| info-text | info-grund | 4.5 | 8.0 (#93c5fd auf #1e2a3c) | 5.8 (#1d4ed8 auf #e9effd) |
| tv | tv-grund | 4.5 | 8.5 (#3cc7b4 auf #121821) | 5.0 (#0b7568 auf #eaf4f2) |
| favorit-text | flaeche | 4.5 | 10.8 (#f5c542 auf #151922) | 5.4 (#8a6300 auf #ffffff) |
| finale-text | flaeche | 4.5 | 10.0 (#86d93a auf #151922) | 6.1 (#356f0c auf #ffffff) |
| finale | flaeche | 3 | 10.0 (#86d93a auf #151922) | 3.5 (#4a9a12 auf #ffffff) |
| finale | grund | 3 | 11.0 (#86d93a auf #0d0f14) | 3.2 (#4a9a12 auf #f5f4f0) |
| favorit-rand | grund | 3 | 11.8 (#f5c542 auf #0d0f14) | 3.3 (#b07d00 auf #f5f4f0) |
| favorit-rand | flaeche | 3 | 10.8 (#f5c542 auf #151922) | 3.6 (#b07d00 auf #ffffff) |
| katalog-text | flaeche | 4.5 | 6.5 (#a78bfa auf #151922) | 7.1 (#5b3fc4 auf #ffffff) |
| akzent | grund | 3 | 6.2 (#ff5a36 auf #0d0f14) | 3.2 (#f54b27 auf #f5f4f0) |
| akzent | flaeche | 3 | 5.7 (#ff5a36 auf #151922) | 3.5 (#f54b27 auf #ffffff) |
| fokus | grund | 3 | 9.6 (#ff9e85 auf #0d0f14) | 5.4 (#b8321a auf #f5f4f0) |
| fokus | flaeche | 3 | 8.8 (#ff9e85 auf #151922) | 6.0 (#b8321a auf #ffffff) |
| fokus | flaeche-2 | 3 | 8.1 (#ff9e85 auf #1b202a) | 4.9 (#b8321a auf #ebe9e3) |
| auf-gut | gut | 4.5 | 10.0 (#0d0f14 auf #34d399) | 5.5 (#ffffff auf #047857) |
| gut | flaeche | 3 | 9.1 (#34d399 auf #151922) | 5.5 (#047857 auf #ffffff) |
| auf-fehler | fehler | 4.5 | 7.1 (#0d0f14 auf #fb7185) | 4.7 (#ffffff auf #e11d48) |
| fehler | flaeche | 3 | 6.5 (#fb7185 auf #151922) | 4.7 (#e11d48 auf #ffffff) |
| warnung | flaeche | 3 | 10.5 (#fbbf24 auf #151922) | 3.2 (#d97706 auf #ffffff) |
| info | flaeche | 3 | 6.9 (#60a5fa auf #151922) | 5.2 (#2563eb auf #ffffff) |
| rand | flaeche | 1.3 | 1.4 (#2c3240 auf #151922) | 1.5 (#d6d3cb auf #ffffff) |
<!-- kontrast-tabelle:ende -->

## 4. Zustände je Bauteil

Zustände von links nach rechts stärker: Ruhe → Hover → Fokus → Gewählt/Aktiv → Deaktiviert. Hover ändert **eine** Stufe (Fläche eins höher
oder Rand von `rand` auf `leise`), nie Fläche und Rand und Text zugleich; der Übergang bleibt ≤ 150 ms.

| Bauteil | Ruhe | Hover | Fokus (Tastatur) | Gewählt / Aktiv | Deaktiviert |
|---|---|---|---|---|---|
| Primärknopf (Fertig, Filter am Handy, Abonnieren) | `bg-ak-akzent text-ak-auf-akzent` fett | `bg-ak-akzent-hover` | Ring `ak-fokus` | — (ein Primärknopf je Ansicht) | `opacity-45`, kein Zeiger, `aria-disabled` |
| Sekundärknopf (Merken, Teilen, Zurücksetzen) | `border-ak-rand bg-ak-flaeche text-ak-text` | `border-ak-leise bg-ak-flaeche-2` | Ring | gedrückt: `bg-ak-flaeche-3` | wie oben |
| Tertiär / Textknopf (✕, Pfeile, „weitere Schreibweisen“) | `text-ak-leise`, kein Rand | `text-ak-text bg-ak-flaeche-2` (rund) | Ring | — | wie oben |
| Reiter, Segment, Navigation (eins von n) | `text-ak-leise` | `text-ak-text` | Ring | `bg-ak-gewaehlt text-ak-auf-gewaehlt` fett + `aria-pressed`/`aria-current`; Navigation: Unterstrich 2 px `ak-gewaehlt` + `text-ak-text` | wie oben |
| Filter-Pille (mehrere von n, mit Gegenteil) | `border-ak-rand text-ak-text` | `border-ak-leise` | Ring | ja: Rand 2 px `ak-gut`, `bg-ak-gut-grund`, fett; nein: Rand 2 px `ak-fehler`, `text-ak-fehler-text`, durchgestrichen, ⊘ (`filter/pille-zustand.ts`) | wie oben |
| Link im Text | `text-ak-link` unterstrichen | `text-ak-text`, Unterstrich bleibt | Ring | `aria-current` wie Navigation | — |
| Kachel, Karte (Kalender, Datenbank, Saison) | `border-ak-rand bg-ak-flaeche` | `border-ak-leise`, Cover 100 % (Vergangenes) | Ring | geöffnet: Rand `ak-akzent` 2 px (`ring-ak-akzent`) | Vergangenes: Bild 50 %, Text `ak-leise` |
| Listeneintrag (TV-Kasten, Reihe, Suchtreffer, News) | ohne Rand, `text-ak-text` | `bg-ak-flaeche-2` | Ring **innen** (`-outline-offset-2`, sonst wird er abgeschnitten) | `aria-selected` + `bg-ak-flaeche-2` + Marke links 3 px `ak-akzent` | `opacity-45` |
| Schalter (Toggle) | Bahn `ak-rand`, Knauf `ak-flaeche` | Bahn `ak-leise` | Ring | Bahn `ak-akzent`, Knauf `ak-auf-akzent`, `aria-checked` | `opacity-45` |
| Eingabefeld | `border-ak-rand bg-ak-flaeche placeholder:text-ak-sehr-leise` | `border-ak-leise` | `border-ak-akzent` + Ring | — | `opacity-45` |

Fokus (umgesetzt 14.10.2026): **eine** Regel `:focus-visible { outline: 2px solid var(--ak-fokus); outline-offset: 2px }` in `web/src/styles.css` (Layer `base`),
Bauteile setzen nichts und schalten den Umriss nie ab (`tools/design-fokus.test.mjs` in `check:logic`; verboten `outline-none`, `outline-hidden`, `outline-0`, `outline-transparent`, auch mit Präfix); Einträge in Scrollflächen: `focus-visible:-outline-offset-2`,
Karten mit sr-only-Knopf: `has-[.ak-oeffnen:focus-visible]:outline-*`; Ausnahme `tabindex=-1` (nur Skript-Fokus). `ring-*` nicht für Fokus (box-shadow kollidiert mit Rändern und `ak-katalog-glanz`). Deaktiviert: `disabled:opacity-45 disabled:cursor-default`,
immer dieselbe Stufe. Klick-Modus im Filterfenster (Auswählen grün / Ausschließen rot gefüllt) bleibt: die Farbe des Modus ist die Farbe der
Pille, die er erzeugt, und ⊘ ist das zweite Merkmal.

## 5. Statusfarben

| Status | Darstellung |
|---|---|
| Läuft jetzt / Live | Punkt `ak-akzent` mit Puls + Wort „Läuft“; Überschrift `ak-akzent-text` |
| Neu, ungelesen | Punkt `ak-akzent` am Knopf (Patch Notes), Marke „Neu“ `ak-akzent-text` |
| Geschätzt, unsicher, vermutlich | **Text `ak-leise` + Zeichen** („≈“, „Vermutlich“, „?“). Nicht amber — Unsicherheit ist keine Warnung |
| Warnung, Handlungsbedarf | Kasten `bg-ak-warnung-grund border-ak-warnung text-ak-warnung-text`, Zeichen ⚠ oder „Hinweis“ |
| Fehler | `ak-fehler-*`, Zeichen ✕ oder Wortlaut |
| Erfolg, belegt | `ak-gut-*`, Zeichen ✓ |
| Info, Nachtrag | `ak-info-*`, Wort („Nachtrag“, „Schnell“) |
| TV, Katalog, Finale | Kennfarben (`ak-tv`, `ak-katalog`, `ak-finale`; Gold ist seit 17.10.2026 nur noch `ak-favorit`), je genau eine Bedeutung |
| Kino | kein Rot als Kennfarbe (Rot ist Fehler/Ausschluss): Kino-Knopf ist ein Primär- oder Sekundärknopf, der Saal bleibt (`.ak-saal`) |

## 6. Inventur 13.10.2026 (vor der Umstellung) und Abweichungen

Gemessen über `web/src` (225 Dateien): 1.477 Farbklassen-Vorkommen, 372 verschiedene; `slate` 550, `white` 158, `ak-*` 393, `sky` 86, `amber` 83,
`emerald` 69, `rose` 52, `blue`/`indigo`/`violet` 35, `red` 9; 395 `dark:`-Varianten, 159 `hover:`, **7 `focus-visible:`**; harte Hex-Werte in
`.tsx`: 15 × die Tokenwerte `#0d0f14`/`#f2f1ee` abgetippt (Werkzeugleiste, KalenderKopf, PosterKarte, Marken, db-karte), der Rest Anbieter-/Flaggenfarben.
Bilder: Scratchpad `design-regeln/bilder/vorher-*` (Woche, Panel, Filter, Suche, Abo, Patch Notes; 375/1280 px; hell/dunkel).

| Bedeutung | heute | Regel |
|---|---|---|
| Gewählt (eins von n) | fünf Formen: Akzent-Füllung (Woche/Monat), Text-Füllung schwarz/weiß (News-Chips, Patch-Notes-Pillen, Stream/Disc), grüne Füllung (Klick-Modus), Akzent-Unterstrich (Navigation), grüner Rand (Filter-Pillen) | Akzent-Füllung; Navigation Unterstrich; Filter-Pillen grüner Rand (Mehrfachauswahl); Klick-Modus bleibt. Umgesetzt 14.10.2026 (Woche/Monat, News-Chips, Patch-Notes-Pillen, Stream/Disc, Saison-Reiter, Navigation); ebenfalls 14.10.2026: Datumssprung (Monat, Tag) und UND/ODER-Schalter; offen: Panel-Reiter in `folgen-bereich.tsx` (sky/slate, gehört zum Slate/Sky-Abbau; die Reiter der Reihenliste entfielen am 20.10.2026) |
| Fokus | `ring-sky-400` in `ui.tsx` (= `#ff7a5c` in beiden Themen, hell 2,6:1 auf Weiß); Patch Notes eigener Outline; die meisten Knöpfe ohne eigene Regel (Browser-Standard) | ein Ring `ak-fokus`, überall |
| Hover-Fläche | fünf Werte (`ak-flaeche-2`, `white/10`, `slate-100`, `slate-50`, `slate-900/60`) | `ak-flaeche-2`, auf Fläche 2 `ak-flaeche-3`. **Umgesetzt 14.10.2026** (`hover:bg-slate/white/sky`, `dark:hover:`, `hover:brightness` = 0; Pillen mit Anbieterfarbe nehmen `hover:bg-ak-flaeche-2`, Meldungs-Chips der News einen inneren Ring `ak-leise`) |
| Hover-Rand | vier Werte (`ak-leise`, `slate-400`, `white/40`, `ak-akzent`) | `ak-leise`; Akzent nur bei Verweis-Chips im Panel. **Umgesetzt 14.10.2026**; Text bei Hover: `ak-text` (Links, Textknöpfe) |
| Amber | vier Bedeutungen: Warnung/Hinweis, Favoriten-Stern, Bugfix, Sonne im Themaknopf | Warnung; Stern → `ak-favorit-text`; Bugfix → `ak-warnung`; Sonne → `ak-favorit`. **Umgesetzt 14.10.2026** (`amber-` in `web/src` = 0); „Sprache offen“, TBA und „ungeklärt“ sind `ak-leise`; Mond → `ak-info` |
| Rot | `rose` (Ausschluss, Beleg-Dialog, Kino-Knopf) neben `red` (Fehler, Abo beenden) | `ak-fehler`; Kino-Knopf verliert das Rot. **Umgesetzt 14.10.2026** (`rose-`, `red-` = 0); Kino-Knopf ist Sekundärknopf, Kino-Punkt in den Neuigkeiten und Plakette auf dem Cover nehmen den Akzent |
| Grün | Pille gewählt, ✓ Deutsch, Klick-Modus, Feature | `ak-gut` für alle (eine Bedeutung: „ja/belegt“). **Umgesetzt 14.10.2026** (`emerald-` = 0) |
| Blau | Schnellfilter-Band, Nachtrag, Panel-Karte, Neuigkeiten-Marken | `ak-info`. **Umgesetzt 14.10.2026** (`blue-`, `indigo-`, `violet-`, `teal-` = 0): Violett (Nachtrag „Zusage“, „Geplant“, Stufe „angekündigt“, Karten Neuigkeiten/Reihe) ist Info, „angekündigt“ heißt überall Info; Violett bleibt allein `ak-katalog` |
| Deaktiviert | `opacity-30/40/50/60` | `disabled:opacity-45 disabled:cursor-default`. **Umgesetzt 14.10.2026** (`opacity-30/40/50/60` = 0); Zahlen in Chips stehen auf `opacity-70` statt `ak-sehr-leise`, weil `ak-sehr-leise` auf der gewählten dunklen Pille nur 3,9:1 hat (gemessen); noch nicht erschienene Cover (Saison, Reihe) auf `opacity-45` |
| Neutral | `slate` mit `dark:`-Paar an 550 Stellen | `ak-text`/`ak-leise`/`ak-flaeche-*` ohne `dark:` |

## 7. Werkzeuge und Umsetzung

- `tools/design-kontrast.mjs` — Tabelle oben erzeugen und prüfen (in `check:logic`).
- `tools/design-klassen.mjs` — Wächter (14.10.2026): zählt in `web/src` (tsx, ts, css) die alten Muster `slate-`, `sky-`, `amber-`, `emerald-`, `rose-`,
  `red-`, `blue-`, `indigo-`, `violet-`, `teal-`, `orange-`, `yellow-`, `white/`, `black/`, `dark:`, `focus-visible:ring`, `ring-sky`,
  `opacity-30/40/50/60` (Klassenstrings in `.ts` und Regeln in `.css` zählen mit) und Hex-Werte je Dateiart (Schlüssel `Hex in .tsx`, `Hex in .ts`,
  `Hex in .css`; außer `detail/pillen.tsx`, `filter/Flagge.tsx`, `de-flagge.tsx`; `styles.css` zählt nicht; nur gültige Längen 3, 4, 6, 8). Die
  Prüfung vergleicht mit `tools/design-klassen-grenzen.json`; Zahl über der Grenze = Exit 1 (in `check:logic`,
  Gegenprobe `tools/design-klassen.test.mjs`); `--liste` zeigt Datei:Zeile je Muster; `--festschreiben` senkt die Grenzen und läuft nur im
  Bestandsbau (`tools/commit-data.sh`, nur 02 UTC), nie in einem PR; ist die Grenzdatei unlesbar, bricht es mit Exit 1 ab. Startwerte 14.10.2026: `slate-` 564, `dark:` 419, `sky-` 91, `white/` 106, Hex 51 (`.tsx`) / 4 (`.ts`) / 4 (`.css`) u. a.
  Wer eine Fläche auf Tokens umstellt, sieht die Zahl sinken; der nächtliche Bestandsbau schreibt sie fest. Eine Grenze kommt in keinem PR hoch.
- `tools/design-info.test.mjs`, `design-hover.test.mjs`, `design-deaktiviert.test.mjs` (14.10.2026, laufen über `check:workflows` → `tests-alle`) halten `blue-/indigo-/violet-/teal-`, die alten Hover-Paare und `opacity-30/40/50/60` in `web/src` bei null und prüfen, dass Chip und Punkt jeder Meldungsart (`news-farben.ts`) dieselbe Kennfarbe tragen; Helfer: `tools/design-quelle.mjs`. Dunkle Fenster (Beleg-Dialog, Trailer) tragen `.ak-immer-dunkel`; der Block setzt `ak-grund`, `ak-flaeche`, `ak-flaeche-2`, `ak-flaeche-3`, `ak-rand`, `ak-linie`, `ak-text`, `ak-leise`, `ak-sehr-leise`, `ak-akzent-text`, `ak-link`, `ak-fokus`, `ak-fehler`, `ak-fehler-text` auf die Werte von `html.dark`. `tools/design-immer-dunkel.test.mjs` (15.10.2026) streicht jede dieser Zeilen einzeln und setzt sie auf den hellen Wert (muss rot werden: Text-auf-Fläche-Rollen über die Kontrastrechnung in `design-kontrast.mjs`, `rand`/`linie`/`fokus`/`fehler`/`fehler-text` über die Gleichheit mit `html.dark`), prüft Ruhe/Hover der Pille (≥ 1,2:1) und dass `bg-ak-pille`/`hover:bg-ak-pille-hover` an jeder Pillen-Stelle einzeln stehen (`pille.tsx` zweimal plus Hover, `pillen.tsx`, `merken-optik.ts`). Das Kontrastmodell löst, was der Block setzt, gegen den Block auf und, was er nicht setzt, gegen das Hauptthema (so wie der Browser erbt).
- `tools/design-status.test.mjs` (in `check:logic`) hält `amber-`, `emerald-`, `rose-`, `red-` in `web/src` bei null (die Grenzdatei sinkt erst im Bestandsbau) und prüft die Zuordnungen; `tools/ansicht-statusfarben.mjs` (aus `check:ansichten`, Rechner) misst im gebauten Filterfenster und in den Patch Notes, dass gewählt `--ak-gut`, ausgeschlossen `--ak-fehler`, Feature `--ak-gut-text`, Bugfix `--ak-warnung-text` tragen, hell und dunkel.
- Bühne: `web/buehne/ausschnitte/design.tsx` (Rollen und Zustände), Mockups `web/buehne/mockups/design-regeln.tsx`; `Variante.stil` legt
  ein Nachher-Stylesheet über die echte App (`zelle.tsx`).
- Umsetzung in kleinen PRs: `daniel-zum-abarbeiten/vorrat/design-01-…` bis `design-08-…` (Tokens zuerst ohne sichtbare Änderung, dann je Bereich).
- Nach jeder Umstellung: `npm run check:ansichten` und `check:panel`, Screenshots beider Themen im PR.

## 8. Kachel-Rand und Anbieter-Leiste (17.10.2026, Daniel)

- Die Anbieter-Leiste schließt das Cover unten ab (Woche `PosterKarte`, Monat `CoverKnopf`): untere Ecken eckig, Leiste bündig an der Unterkante, ohne Überstand. Ring und Glanz enden darüber (`.ak-ring-oben`, `clip-path` schneidet unten ab; wo die Leiste ein Geschwister ist, Woche und Tageszeile: `.ak-ring-oben-leiste`, 1 px höher, weil die Leiste auf ganze Pixel rundet); die oberen Ecken bleiben rund. Der Goldrand eines Favoriten sitzt dadurch nie unter der Leiste und schiebt sie nicht nach oben.
- Wächter: `tools/kachel-ecken-messen.mjs` (in `check:ansichten-desktop`) misst an Pixeln, beide Themen, Woche, Monat, das Fenster am Monats-Cover (Tageszeile) und die Tageszeile am Handy (360 px, `isMobile`), jede Kachel einmal ohne und einmal mit Favorit: gleiche Unterkante der Leiste (Woche 4 px, Tageszeile 3 px), Leistenfarbe in beiden unteren Ecken, nichts unter der Leiste. Vollständigkeitssperre: endet rot, wenn eine der 8 Ergebniszeilen `{dunkel,hell}/{woche,monat,fenster,handy}` fehlt (`fehlendeZeilen`). Dazu der Klassentest in `pipeline/check-kachel-favorit-render.ts`.
- **Lehre:** „Maße unverändert“ (`getBoundingClientRect`) sagt nichts über einen Rand, der außerhalb der Box liegt (Ring als `box-shadow`) — #1432 maß nur Rechtecke, und niemand sah sich die Kante zwischen Rand und Leiste an. Ein Rand oder Overlay an einer Kachel wird an Pixeln der Unterkante geprüft, mit und ohne Zustand.

## 9. Leistensprung beim Öffnen des Panels (18.10.2026)

Panel, Beleg-Dialog und Filterfenster sperren die Seite mit `overflow: hidden` an `html`; mit klassischer Bildlaufleiste (Windows, 10 bis 17 px) verschwand sie dabei, die Wochenkacheln rückten und wurden breiter. Behoben mit `scrollbar-gutter: stable` auf `html` (`styles.css`, bedingungslos; überlagernde Leisten von Telefonen kosten 0 px, gemessen mit `hasTouch` + `isMobile` 1024 und 393 px. Ein Touch-Gerät mit klassischer Leiste springt so ebenfalls nicht mehr. Handy-Seiten der Werkzeuge (`ansicht-bild.mjs --handy`, `panel-messen.mjs`, `trefferprobe-selbsttest.mjs`) laufen mit `hasTouch` + `isMobile`, sonst reserviert Chromium im Handy-Fenster 10 px); `kino.tsx` sperrt am `body`, das deckt dieselbe Regel. Warum es durchging: Playwright startet Chromium headless mit `--hide-scrollbars`, jede Layoutprüfung sah eine Leiste von 0 px und damit nie einen Sprung. Wächter: `tools/panel-sprung.mjs` (in `check:panel`, mit `ignoreDefaultArgs: ['--hide-scrollbars']`, misst die Wurzelbox, nicht `clientWidth` — das zählt den reservierten Platz nicht mit). Neue Layoutprüfungen mit Breitenbezug brauchen denselben Schalter; außer `ansicht-filterfenster-rechner.mjs` und `panel-sprung.mjs` starten die übrigen 40 Playwright-Werkzeuge in `tools/` ohne ihn (Stand 18.10.2026; nur gemeldet, nicht umgebaut).

## 10. Spuren und Karussells ohne CSS-`scroll-smooth` (20.10.2026)

Eine wischbare Spur (`reihen-spur.tsx`) bekommt kein `scroll-behavior: smooth` im Stylesheet. Es ließe jedes `scrollLeft = …` (Startposition) und jedes `scrollIntoView` gleiten: Die Trefferprobe der Kette (`trefferprobe-browser.mjs`, `check:panel`) misst dann mitten in der Bewegung und meldet Karten als „verdeckt" (PR 1698: Fälle „liegt bei -3445/850 unter nichts"). Gleiten soll nur der Pfeilsprung, mit `scrollBy({ behavior })`, und nicht bei „weniger Bewegung" (`sprungVerhalten` in `reihen-spur-regeln.ts`). Pfeile erscheinen nur mit feinem Zeiger (`pointer-fine:`), am Handy wischt man.
Pixelprobe der Cover-Zustände (gewählt, künftig, gemerkt): Bühne, Mockup `reihen-box` Variante B, `node tools/buehne-reihen-messen.mjs` (nach `npm run buehne:bauen`); kein Teil von `check:vor-commit`.
