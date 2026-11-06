# Kitaro: Amazon-Seite B0FX4Q35V2 an zwei Titeln (Stand 04.11.2026)

**Ergebnis:** Die Seite gehört zu **10019697** (Shinsei-ban 2024, polyband). Keine Sammelseite. Der Handbeleg an **130622** (Original 2023) ist der Fehlbeleg.

**Kennzahlen**
- 130622 (Original 2023): Film, 1 Folge, `runtimeMin` 104, kein DE-Titel, keine `deErstausgabe`. aniSearch 16981: 0 Treffer in `anisearch-eintraege.json` und `anisearch-dub-ids.json`. Handbeleg `data/dub-confirmed.yaml` Zeile 10853 (checkedAt 2026-08-31, ohne gti).
- 10019697 (Shinsei-ban 2024): Film, 1 Folge, DE-Titel „The Birth of Kitaro: Das Geheimnis von GeGeGe“, `deErstausgabe` 2025-11-18 polyband. aniSearch 19697: `min` 105, `dub` d, `pub` polyband, `dvon` 2025-11-18. Handbeleg `data/dub-confirmed.yaml` Zeile 36757 (checkedAt 2026-10-16, gti fbdee0cb).
- Seite (Meldungskopie, Stand 03.11.2026 21:42 UTC, bei Abfrage 23,7 h alt): 1 Folge, ASIN B0FX4KDFP7, „The Birth of Kitaro: Das Geheimnis von GeGeGe“, erschienen 18.11.2025, 6324 s (105,4 min), Deutsch + 日本語, gti fbdee0cb.

**Belegkette:** Meldung (Suchadresse mit dem DE-Titel von 10019697) → `data/prime-zugeordnet.json` (Schlüssel `…s?k=The%20Birth%20of%20Kitaro%3A%20Das%20Geheimnis%20von%20GeGeGe`, `titleId` 10019697, `seite` B0FX4Q35V2) → `pipeline/check-gleiche-adresse-bestand.ts:17` liest diese Datei und meldet den Handbeleg an 130622 als Fehlbeleg.

**Keine Sammelseite:** Die Seite hat nur eine Folge und nur einen Titel, `anteile` und `erlaubt` greifen nicht. TMDB 904759 und JustWatch tm1190561 führen beide Titel gleich; die trennen nicht.

**Empfehlung:** Handbeleg 130622 (Zeilen 10853–10859) aus `data/dub-confirmed.yaml` entfernen und in `data/belege-entfernt.yaml` vermerken (Muster PR 2787). In `data/gleiche-adresse-stand.json` `adressen` leeren und `hoechstens` auf 0 setzen (Grenze darf sinken). 10019697 behält den Beleg.

**Sicherheit:** hoch für die Zuordnung zu 10019697 (DE-Titel exakt, Datum 18.11.2025 = polyband-Erstausgabe, Laufzeit 105 gegen aniSearch 105, gti gleich dem Beleg von 10019697). Mittel für das Entfernen ohne Ersatz: ob das Original eine eigene Prime-Seite hat, ist nicht geprüft (Webabruf verboten). 130622 verliert dann seine einzige Prime-Seite.

**Offen:** eigene Prime-Seite des Originals (nur per Web prüfbar); 130622 hat dann kein Prime-Beleg mehr. Laufzeit 105 gegen 104 ist nicht trennscharf (104 aus `titles.json`, Quelle nicht geprüft).
