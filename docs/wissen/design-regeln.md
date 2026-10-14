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
| Rand / Linie | `ak-rand`, `ak-linie` | Rahmen von Karten und Feldern / Trennlinien |
| Text | `ak-text`, `ak-leise`, `ak-sehr-leise` | Haupttext / Nebentext, Beschriftungen / Platzhalter, Zahlen in Chips |
| Akzent | `ak-akzent`, `ak-akzent-hover`, `ak-auf-akzent` | Primärknopf, gewähltes Segment, Heute, Läuft; Text darauf dunkel |
| Akzent als Text | `ak-akzent-text`, `ak-link` | Akzent in Schriftgröße (hell dunkler, 4,5:1); `ak-link` ist derselbe Wert mit Namen |
| Gewählt | `ak-gewaehlt`, `ak-auf-gewaehlt` | genau eins von n (Reiter, Segment, Navigation) — Alias auf Akzent, damit es einmal umstellbar bleibt |
| Fokus | `ak-fokus` | Fokusring, 2 px, 2 px Abstand (`outline`, nicht `ring`) |
| Gut | `ak-gut`, `ak-gut-text`, `ak-gut-grund` | belegt, bestätigt, ✓ Deutsch, Erfolg, gewählte Filter-Pille (Rand) |
| Fehler | `ak-fehler`, `ak-fehler-text`, `ak-fehler-grund` | Fehler, Abbrechen/Beenden, ausgeschlossene Filter-Pille (Rand) |
| Warnung | `ak-warnung`, `ak-warnung-text`, `ak-warnung-grund` | Warnung, Hinweis mit Handlungsbedarf, Bugfix in den Patch Notes |
| Info | `ak-info`, `ak-info-text`, `ak-info-grund` | erklärende Marke ohne Handlungsbedarf: Nachtrag, Schnellfilter-Band, Neuigkeiten-Marken |
| TV | `ak-tv`, `ak-tv-grund`, `ak-tv-rand` | nur lineares Fernsehen |
| Katalog | `ak-katalog`, `ak-katalog-text` | nur Katalog-Release |
| Finale | `ak-finale`, `ak-finale-text` | Staffelfinale **und** Favoriten-Stern (Gold = Höhepunkt) |
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
| finale-text | flaeche | 4.5 | 10.8 (#f5c542 auf #151922) | 5.4 (#8a6300 auf #ffffff) |
| katalog-text | flaeche | 4.5 | 6.5 (#a78bfa auf #151922) | 7.1 (#5b3fc4 auf #ffffff) |
| akzent | grund | 3 | 6.2 (#ff5a36 auf #0d0f14) | 3.2 (#f54b27 auf #f5f4f0) |
| akzent | flaeche | 3 | 5.7 (#ff5a36 auf #151922) | 3.5 (#f54b27 auf #ffffff) |
| fokus | grund | 3 | 9.6 (#ff9e85 auf #0d0f14) | 5.4 (#b8321a auf #f5f4f0) |
| fokus | flaeche | 3 | 8.8 (#ff9e85 auf #151922) | 6.0 (#b8321a auf #ffffff) |
| fokus | flaeche-2 | 3 | 8.1 (#ff9e85 auf #1b202a) | 4.9 (#b8321a auf #ebe9e3) |
| gut | flaeche | 3 | 9.1 (#34d399 auf #151922) | 5.5 (#047857 auf #ffffff) |
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
| TV, Katalog, Finale | Kennfarben wie bisher (`ak-tv`, `ak-katalog`, `ak-finale`), je genau eine Bedeutung |
| Kino | kein Rot als Kennfarbe (Rot ist Fehler/Ausschluss): Kino-Knopf ist ein Primär- oder Sekundärknopf, der Saal bleibt (`.ak-saal`) |

## 6. Inventur 13.10.2026 (vor der Umstellung) und Abweichungen

Gemessen über `web/src` (225 Dateien): 1.477 Farbklassen-Vorkommen, 372 verschiedene; `slate` 550, `white` 158, `ak-*` 393, `sky` 86, `amber` 83,
`emerald` 69, `rose` 52, `blue`/`indigo`/`violet` 35, `red` 9; 395 `dark:`-Varianten, 159 `hover:`, **7 `focus-visible:`**; harte Hex-Werte in
`.tsx`: 15 × die Tokenwerte `#0d0f14`/`#f2f1ee` abgetippt (Werkzeugleiste, KalenderKopf, PosterKarte, Marken, db-karte), der Rest Anbieter-/Flaggenfarben.
Bilder: Scratchpad `design-regeln/bilder/vorher-*` (Woche, Panel, Filter, Suche, Abo, Patch Notes; 375/1280 px; hell/dunkel).

| Bedeutung | heute | Regel |
|---|---|---|
| Gewählt (eins von n) | fünf Formen: Akzent-Füllung (Woche/Monat), Text-Füllung schwarz/weiß (News-Chips, Patch-Notes-Pillen, Stream/Disc), grüne Füllung (Klick-Modus), Akzent-Unterstrich (Navigation), grüner Rand (Filter-Pillen) | Akzent-Füllung; Navigation Unterstrich; Filter-Pillen grüner Rand (Mehrfachauswahl); Klick-Modus bleibt |
| Fokus | `ring-sky-400` in `ui.tsx` (= `#ff7a5c` in beiden Themen, hell 2,6:1 auf Weiß); Patch Notes eigener Outline; die meisten Knöpfe ohne eigene Regel (Browser-Standard) | ein Ring `ak-fokus`, überall |
| Hover-Fläche | fünf Werte (`ak-flaeche-2`, `white/10`, `slate-100`, `slate-50`, `slate-900/60`) | `ak-flaeche-2`, auf Fläche 2 `ak-flaeche-3` |
| Hover-Rand | vier Werte (`ak-leise`, `slate-400`, `white/40`, `ak-akzent`) | `ak-leise`; Akzent nur bei Verweis-Chips im Panel |
| Amber | vier Bedeutungen: Warnung/Hinweis, Favoriten-Stern, Bugfix, Sonne im Themaknopf | Warnung; Stern → `ak-finale-text`; Bugfix → `ak-warnung`; Sonne → `ak-finale` |
| Rot | `rose` (Ausschluss, Beleg-Dialog, Kino-Knopf) neben `red` (Fehler, Abo beenden) | `ak-fehler`; Kino-Knopf verliert das Rot |
| Grün | Pille gewählt, ✓ Deutsch, Klick-Modus, Feature | `ak-gut` für alle (eine Bedeutung: „ja/belegt“) |
| Blau | Schnellfilter-Band, Nachtrag, Panel-Karte, Neuigkeiten-Marken | `ak-info` |
| Deaktiviert | `opacity-30/40/50/60` | `opacity-45` |
| Neutral | `slate` mit `dark:`-Paar an 550 Stellen | `ak-text`/`ak-leise`/`ak-flaeche-*` ohne `dark:` |

## 7. Werkzeuge und Umsetzung

- `tools/design-kontrast.mjs` — Tabelle oben erzeugen und prüfen (in `check:logic`).
- Bühne: `web/buehne/ausschnitte/design.tsx` (Rollen und Zustände), Mockups `web/buehne/mockups/design-regeln.tsx`; `Variante.stil` legt
  ein Nachher-Stylesheet über die echte App (`zelle.tsx`).
- Umsetzung in kleinen PRs: `daniel-zum-abarbeiten/vorrat/design-01-…` bis `design-08-…` (Tokens zuerst ohne sichtbare Änderung, dann je Bereich).
- Nach jeder Umstellung: `npm run check:ansichten` und `check:panel`, Screenshots beider Themen im PR.
