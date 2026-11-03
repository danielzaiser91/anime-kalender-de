# Disc-Handlinks aus der Anime2You-Amazon-Tabelle (03.11.2026)

Verfahren: `node tools/amazon-tabelle.mjs` gegen 15 Anime2You-Artikel (10 „bei Amazon vorbestellbar“-Tabellen von Mai bis 29.10. plus Einzelartikel; Suche über die WordPress-API von anime2you.de). Gegen die 38 Namenssuchen gehalten (Basis: Zweig von PR 2693).

## Eingetragen (4)

| Slug | Händlerzeile (Artikel) | Link |
|---|---|---|
| sword-of-the-demon-hunter-vol2 | „Sword of the Demon Hunter – Vol. 2“, 20.08., Blu-ray (1018166) | amazon.de/dp/B0H39C7YB5 |
| case-study-of-vanitas-s1-vol2 | „The Case Study of Vanitas – Vol. 2“, 07.08., Blu-ray (1012477) | amazon.de/dp/B0H26MK78J |
| manga-love-story-step-up-gesamtausgabe-ova | „Manga Love Story (Komplettbox)“, 31.07., Blu-ray (1018166) | amazon.de/dp/B0H3CSXQPH |
| memories-2026-11-18 | „Memories“, 19.11., Blu-ray (1044592); Termin 1 Tag später als im Eintrag, passt aber zu `ausgabeAm` 19.11. der aniSearch-Quelle | amazon.de/dp/B0HG4RG4TW |

## Nicht belegbar (Grund)

- Bocchi the Rock Vol. 1, Girls Band Cry Vol. 1, Oshi no Ko S3 Vol. 1/2, Sakamoto Days Vol. 2, Dan Da Dan S2 Vol. 1/2, Yaiba Vol. 1/2, Kamisama Kiss, 2.5 Dimensional Seduction, Afro Samurai, Vampire Princess Miyu, I Parry Everything, Drachenmaid-Steelbook: Sonderausgabe/mehrere Editionen unter einem Tabellennamen, Tabelle nennt die Edition des Termins nicht.
- Sword of the Demon Hunter Vol. 1: kein Tabellentreffer.
- Fate Heaven's Feel 1–3 (Gesamtausgabe): kein Tabellentreffer für diese Ausgabe.
- Princess Principal: durch PR 2693 ohnehin keine Namenssuche mehr (Ratsche-Slug entfernt).
- Pokémon (2 DVD-Boxen), Inazuma Eleven Movie, Gods' Games We Play, Sakamoto Days Teil 2 Vol. 3/4, My Gift Lvl 9999: kein Tabellentreffer.
- auto-* ohne Handeintrag: Isekai Onsen Paradise (Komplettbox, 28.01.2027) und There's No Freaking Way (Komplettbox, 22.10.) haben eindeutige Tabellenzeilen. Ein Handeintrag ersetzt aber den automatischen Termin und ändert dabei Slug, UID in den ICS-Feeds (Kalender-Abos bekämen Doppeltermine), Herkunft und Quellen; im Bau-Vergleich 14 Dateien statt 4 -> nicht umgesetzt. Besser: Bauschritt, der Händlerzeilen als `buyUrl` auch an Auto-Discs hängt (eigener PR).
- Evangelion (Tabelle: „Special Edition“, 05.02.2027; Quelle sagt Komplettbox) und Gantz (Tabelle „Collector's Edition“ 02.10., Eintrag 20.11.): Edition/Termin passen nicht sicher.
- Dan Da Dan 30.09., Toradora!: kein Tabellentreffer.

Ratsche: 38 -> 33 (4 Handlinks, dazu Princess Principal, das durch die EAN aus PR 2693 keine Namenssuche mehr ist; am Kandidaten-Bau mit `check-disc-suchlinks-bestand` gemessen: 33, keine Warnung).
