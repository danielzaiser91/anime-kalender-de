# PoC: Welche aniSearch-Felder wir mit abholen sollten (03.10.2026)

Gemessen an gecachten Seiten (`data/anisearch-raw/`, 3.190 Stück) und 25 live abgerufenen Seiten (6,5 s Abstand, eigener User-Agent). Kein Schreiben in den Datensatz.

## 1. Anime-Seite — was wir schon lesen und was nicht

Schon gelesen (`data/anisearch.json`): Sprach-Blöcke samt Marke „Synchronisiert“ und Publisher, Format, Folgen, Laufzeit, Season, Studios, Staff, Vorlage, Webseiten, Synonyme, Inhaltsangabe, Streams.

Auf der Seite vorhanden, bisher nicht gelesen:

| Feld | Befund (Eyeshield 21, ID 3520) | Ersetzt von AniList |
|---|---|---|
| Genres und Tags | Haupt-/Nebengenres und Tags im Seitentext | `genres`, `tags` |
| Cover | `cdn.anisearch.de/images/anime/cover/3/3520_600.webp` | `coverImage` |
| Bewertung | Verteilung in %, „Klarwert 3.60 = 72 %“, Rang in der Toplist | `averageScore` |
| Relationen | Typ (Nebengeschichte, Zusammenfassung, Alternative Version …) und Ziel-ID | `relations` |
| Neuerscheinungen | Disc-Liste mit Artikel-Links | (haben wir schon separat) |
| Trailer | Abschnitt vorhanden, bei diesem Titel leer | `trailer` |
| Charaktere | Namen und Favoritenzahl, **ohne** Sprecher | — |

## 2. Sprecher — eigene Seite `/anime/<id>/seiyuu`

Eigene Seite, ein Abruf mehr je Anime. Eyeshield 21: 234 japanische und **134 deutsche** Sprecher-Einträge (Landesflagge `country/de.webp`). Damit lässt sich AniList bei Sprechern ablösen und zusätzlich belegen, ob es deutsche Sprecher gibt.

## 3. Disc-Artikelseite — das eigentliche Fundstück

Jede der 8.727 Artikelseiten trägt strukturiert: **EAN**, **Sprache** (Tonspuren, z. B. „Deutsch (DTS-HD 2.0), Japanisch“), **Untertitel**, Publisher, Altersfreigabe, Medium, Regionalcode, Umfang, Laufzeit, und **„Enthaltene Titel“ mit aniSearch-Anime-ID und Typ** (TV-Serie, OVA, **Bonus**, Manga).

Hand-Gegenprobe an Fällen, bei denen wir bisher raten mussten:

| Disc | Enthaltene Titel laut aniSearch | Tonspur |
|---|---|---|
| Megalo Box Gesamtausgabe BD (polyband, EAN 4006448365837) | Serie, Bonus „Audio Drama“ (ID 13679 = unser *Megalobox Specials*), Bonus „Six Mix Cosmic: Pilot Edition“ (ID 14059, nicht im Bestand) | Deutsch, Japanisch |
| Dragon Maid Komplettset BD (Kazé, EAN 7630017534002) | Serie, Bonus „Valentinstag und Onsen“ (ID 12765 = unser OVA) | Deutsch, Japanisch |
| 91 Days Gesamtausgabe BD (KSM) | Serie, OVA „Day 13“, Bonus „91 Daze“ | Deutsch, Japanisch |
| Joker Game Gesamtausgabe BD (KSM) | Serie, Bonus „Kuroneko Yoru no Bouken“ (ID 11524 = unser Special) | Deutsch, Japanisch |

Zufallsstichprobe 9 OVA/Special/ONA aus dem Bestand, je bis zu 3 Ausgaben abgerufen: **9 von 9** nennen den Titel unter „Enthaltene Titel“, mit Tonspur-Angabe. Einschränkung: alle 9 trugen schon die Marke „Synchronisiert“, die Stichprobe zeigt also die **Pflege-Dichte**, nicht den Fall ohne Marke. Ob Specials ohne Marke und ohne Liste vorkommen, zeigt erst der volle Lauf.

Randfälle: eine alte DVD-Seite (Es war einmal… das Leben, Vol. 4/6) lieferte keine Produktfelder; „Sprache“ fehlt bei einzelnen Ausgaben (`[?]`). `Untertitel` fehlt bei Rein-Deutsch-Discs (Chibi Maruko Chan).

Die von Gemini genannte EAN 7630017534002 (Dragon Maid Komplettset BD) ist bestätigt; die zweite (…019, DVD) ist ungeprüft.

## 4. Hersteller-Abgleich über die EAN

Als Zweitbeleg sinnvoll, nicht als Hauptweg: Hersteller (Kazé, KSM, peppermint, polyband) haben je eigene Shopseiten ohne einheitliche Schnittstelle; Bonusmaterial steht dort als Freitext. Wir gehen so vor: aniSearch-Artikel liefert EAN, Tonspur und Inhalt; nur wo „Enthaltene Titel“ fehlt oder der Fall strittig ist, wird die EAN an der Herstellerseite von Hand gegengelesen.

## 5. Vorschlag für den Abruf

Beim Lauf je Artikelseite mitnehmen: EAN, Sprache (als Liste Audio, getrennt von Untertiteln), Untertitel, Publisher, Umfang, Enthaltene Titel (ID + Typ). Je Anime zusätzlich: Genres/Tags, Bewertung, Cover, Relationen (mit Typ) und die Sprecherseite. Aufwand Artikelseiten ≈ 14,5 h bei 6 s je Seite; die Reihenfolge zuerst Titel ohne Marke und ohne Handbeleg.
