# Altfälle Notizseite: Stand 03.11.2026

Basis: `public/data/titles.json` und `data/prime-zugeordnet.json` auf main 245aed0d6, Meldungskopie vom 02.11.2026 03:01 (Tabelle `prime_folge`, Spalten `seiten_kennung`, `staffel_text`, `erschienen`, `titel_id`).
Maßstab je Seite: Staffeltext, Erstjahr und Folgenzahl der gelesenen Seite gegen den Besitzer in `titles.json`. Passt die Seite zum Besitzer und nicht zum Block-Titel, ist der Block falsch (Block entfernt, `data/belege-entfernt.yaml`, sofern die Adresse keinem anderen Beleg oder Weg desselben Titels gehört).

## Abgearbeitet (47 Paare)
Tayo 16 (Seiten Staffel 1–5 gehören je Tayo 1–5, alle Fremdblöcke weg, jede Staffel behält ihren eigenen), My Hero Academia 7 (Seite B0CH24VZJS = „Season 1“, 2016, 13 Folgen), JoJo 2, Index/Railgun 3 (Seiten gekreuzt: Index II hing an Railgun S, Index an Index II, Railgun S an Railgun), Goblin Slayer, Horimiya, Solo Leveling 2, SNAFU TOO!, Junjou Romantica 2, Pokémon, Space/Life, LOGH Seiran, Edens Zero (Seite B0H4834VK9 = Clannad: After Story, 2008/09), Yama no Susume (Seite ist Staffel 3, 2022; der Besitzer „Second Season Specials“ passt dazu auch nicht, Besitz prüfen), Freezing OVA/Vibration (Titel nicht im Bestand).
Bilanz des ersten Stands (`tools/bau-vergleich.mjs 34711702a3b6 2f704bca9236`, davor noch mit Tokyo Ghoul √A und Sylvanian Families): kein Titel verlor Deutsch, `news.json` gleich. Die Bilanz des Endstands steht im PR-Nachtrag.
Besonderheiten: Goblin Slayer (101165): zwei Belege lagen an der Staffel-2-Adresse, gemessen war aber die eigene Seite B0CFKZQ6FN, also nur `url` umgestellt. Babylon (101349) und Arifureta 3 (154473): die Notiz nennt selbst, dass B0G2P8B9N7 „Eine fröhliche Familie“ ist; nur die Angabe „Amazon-Seite“ in der Notiz auf die Seitenadresse des Belegs umgestellt.

## Offen (10 Paare, nicht geraten)
- `10011569@B0DJ4FCM5H` Ribbit: die Seite heißt „Prinz Ribbit“ (1 Folge, 2020), Besitzer laut `titles.json` ist Super Wings (10012621). Vermutlich ist der Besitz falsch, nicht der Beleg. Besitz klären.
- `100240@B0CW5WH6XZ` Tokyo Ghoul:re: Seite „Staffel 3“, 12 Folgen; Besitzer :re 2 (102351). Amazons Staffel 3 wäre :re, dann ist der Beleg richtig und der Besitz falsch. Folgentitel an der Quelle prüfen.
- `108511@B0CJC11GRB` Slime Staffel 2: Seite hat 24 Folgen (Teil 1 und 2), Besitzer ist Teil 2 (116742). Gehört beiden: `sharedWith` an der Seite statt Beleg entfernen.
- `163024@B0GC9MPBHQ`, `163024@B0GXPFJJZK` Captain Tsubasa Junior Youth: Seite mit 91 Folgen (52 + 39), Beleg trägt `teilBereich` 53–91. Geteilte Seite, `sharedWith`/Teilbereichsregel nötig.
- `144932@B0D956JD5Y` Edens Zero S2: Nein-Beleg, Notiz nennt eine andere Seite (0KXOMCNFCKPTA6Z6HNIJ0ESQ9P, Daniels Durchgang), `url` zeigt auf die Clannad-Seite. Vermutlich richtiger Inhalt mit falscher Adresse; Adresse klären.
- `801@B0B8PKXRZ8` GITS 2nd GIG: für die Seite liegen keine Rohfolgen vor, Notiz „Seitenadresse B0B6ZXKKJL, laut Adresse Staffel 2“. Kein Beleg für Besitzer oder Block.
- `-13247@B07XYDCVFK` Sylvanian Families: ausdrückliche Sammelseite (`SAMMELSEITEN` in `pipeline/lib/handbeleg-fremde-adresse.ts`, 187053): ob Cartoon und Anime-Mini-Episoden dasselbe Werk sind, ist offen; Beleg bleibt.
- `20850@B0CW5WH6XZ`, `20850@B0D83P6X34` Tokyo Ghoul √A: die Seiten gehören laut Folgenliste Staffel 1 (2014) bzw. Staffel 3, die Kette √A, :re, :re 2 teilt sich B0D7N68Q5T; das Entfernen drehte im PR-Datenbau den Besitz und machte zwei neue Treffer bei :re. Zusammen mit :re (oben) an der Quelle klären.
Dazu die vier Paare aus PR 2701 (nicht angefasst).

## Sperren ohne Eintrag
Fünf Belege tragen bewusst keine Sperre, weil derselbe Titel an dieser Adresse im Kopf noch einen richtigen Beleg hat (Belege mit Adresse und Notizseite gleich, Probe am 03.11.2026): Railgun S (16049) B0CVFNLP9D 1, Solo Leveling 2 (176496) B0DQTBWY5K 2, JoJo Diamond (21450) B0GXK7RJFW 3, JoJo Golden Wind (102883) B0G1ZD14D3 2, My Hero Academia 4 (104276) B0CC5DX1T7 1. Kennung plus Adresse sperrt sonst den richtigen Beleg. Kommen die Fremdmessungen aus den Meldungen zurück, zeigt es check-handbeleg-notizseite-bestand. Dauerhaft: Sperre mit Notizseite als zweitem Schlüssel.

Meldungskopie: die Auswertung lief auf dem Stand 02.11.2026 03:01 (über 24 h alt, für diese Seiten unkritisch, da Seitenlisten sich nicht ändern); die Climb-Probe in der Nachbesserung lief auf dem frischen Stand 03.11.2026 03:01 mit gleichem Ergebnis.

Climb (14355): B0GP5XXDNT ist die eigene Seite (Staffel 1, Titel 14355); B0GP83RCNX hat in der Kopie keine Titelzuordnung. Gesperrt ist nur die Fremdmessung B0GNH738G2 (Staffel 3).
