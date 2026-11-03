# Altfälle Notizseite: Stand 03.11.2026

Basis: `public/data/titles.json` und `data/prime-zugeordnet.json` auf main 245aed0d6, Meldungskopie vom 02.11.2026 03:01 (Tabelle `prime_folge`, Spalten `seiten_kennung`, `staffel_text`, `erschienen`, `titel_id`).
Maßstab je Seite: Staffeltext, Erstjahr und Folgenzahl der gelesenen Seite gegen den Besitzer in `titles.json`. Passt die Seite zum Besitzer und nicht zum Block-Titel, ist der Block falsch (Block entfernt, `data/belege-entfernt.yaml`, sofern die Adresse keinem anderen Beleg oder Weg desselben Titels gehört).

## Abgearbeitet (50 Paare)
Tayo 16 (Seiten Staffel 1–5 gehören je Tayo 1–5, alle Fremdblöcke weg, jede Staffel behält ihren eigenen), My Hero Academia 7 (Seite B0CH24VZJS = „Season 1“, 2016, 13 Folgen), Tokyo Ghoul √A 2 (Staffel 1 und Staffel 3 sind nicht √A), JoJo 2, Index/Railgun 3 (Seiten gekreuzt: Index II hing an Railgun S, Index an Index II, Railgun S an Railgun), Goblin Slayer, Horimiya, Solo Leveling 2, SNAFU TOO!, Junjou Romantica 2, Pokémon, Space/Life, LOGH Seiran, Edens Zero (Seite B0H4834VK9 = Clannad: After Story, 2008/09), Yama no Susume (Seite ist Staffel 3, 2022; der Besitzer „Second Season Specials“ passt dazu auch nicht, Besitz prüfen), Sylvanian Families, Freezing OVA/Vibration (Titel nicht im Bestand).
Bilanz `tools/bau-vergleich.mjs 34711702a3b6 2f704bca9236` (Protokoll im Scratchpad): 12 Titel ändern Prime-Wege, kein Titel verliert Deutsch, `news.json` gleich (0 Meldungen); SNAFU TOO! `dubConfidence` very-high auf high.
Besonderheiten: Goblin Slayer (101165): zwei Belege lagen an der Staffel-2-Adresse, gemessen war aber die eigene Seite B0CFKZQ6FN, also nur `url` umgestellt. Babylon (101349) und Arifureta 3 (154473): die Notiz nennt selbst, dass B0G2P8B9N7 „Eine fröhliche Familie“ ist; nur die Angabe „Amazon-Seite“ in der Notiz auf die Seitenadresse des Belegs umgestellt.

## Offen (7 Paare, nicht geraten)
- `10011569@B0DJ4FCM5H` Ribbit: die Seite heißt „Prinz Ribbit“ (1 Folge, 2020), Besitzer laut `titles.json` ist Super Wings (10012621). Vermutlich ist der Besitz falsch, nicht der Beleg. Besitz klären.
- `100240@B0CW5WH6XZ` Tokyo Ghoul:re: Seite „Staffel 3“, 12 Folgen; Besitzer :re 2 (102351). Amazons Staffel 3 wäre :re, dann ist der Beleg richtig und der Besitz falsch. Folgentitel an der Quelle prüfen.
- `108511@B0CJC11GRB` Slime Staffel 2: Seite hat 24 Folgen (Teil 1 und 2), Besitzer ist Teil 2 (116742). Gehört beiden: `sharedWith` an der Seite statt Beleg entfernen.
- `163024@B0GC9MPBHQ`, `163024@B0GXPFJJZK` Captain Tsubasa Junior Youth: Seite mit 91 Folgen (52 + 39), Beleg trägt `teilBereich` 53–91. Geteilte Seite, `sharedWith`/Teilbereichsregel nötig.
- `144932@B0D956JD5Y` Edens Zero S2: Nein-Beleg, Notiz nennt eine andere Seite (0KXOMCNFCKPTA6Z6HNIJ0ESQ9P, Daniels Durchgang), `url` zeigt auf die Clannad-Seite. Vermutlich richtiger Inhalt mit falscher Adresse; Adresse klären.
- `801@B0B8PKXRZ8` GITS 2nd GIG: für die Seite liegen keine Rohfolgen vor, Notiz „Seitenadresse B0B6ZXKKJL, laut Adresse Staffel 2“. Kein Beleg für Besitzer oder Block.
Dazu die vier Paare aus PR 2701 (nicht angefasst).

## Sperren ohne Eintrag
13 entfernte Belege tragen eine Adresse, die ein anderer Beleg desselben Titels oder dessen eigener Weg nutzt (`belege-entfernt.yaml` sperrt Kennung+Adresse, das träfe den guten Beleg): My Hero Academia B0CC5DX1T7 (6 Titel), Goblin Slayer, Railgun S, Solo Leveling 2, JoJo ×2, √A. Kommen sie aus den Meldungen zurück, rötet der Wächter (`check-handbeleg-notizseite-bestand`) den Bestand. Dauerhaft: Sperre mit Notizseite als zweitem Schlüssel.
