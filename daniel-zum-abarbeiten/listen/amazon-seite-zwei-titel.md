# Dieselbe Amazon-Seite an zwei Titeln: 0 offene Fälle (Stand 04.11.2026)

Wächter: `pipeline/check-gleiche-adresse-bestand.ts`, Grenze `data/gleiche-adresse-stand.json` (höchstens 0, vorher 9 in PR 2760, 8 vor diesem PR). Belegt aus der Meldungskopie (`prime_folge`, Rohzeilen je Seite vom 03.11.2026), `public/data/titles.json`, `public/data/folgen/` und AniList.

| Seite | Entscheidung | Beleg |
|---|---|---|
| B0B5JVJKCD | Hyouka (12189) und Hyouka OVA (13469) bleiben, als Teilseite erlaubt (`anteile` 12 + 1) | Seite „Staffel 1“ = Folgen 1–12 mit den Titeln aus `folgen/12189.json` plus Folge 13 „OVA“; Staffel 2 liegt unter B0DC75L8BJ |
| B0CG7S59KL | JoJo: Belege mit `available: false` zählen nicht als Beanspruchung | Kopf der Sammelseite ohne Folgen (Notiz 21.09.2026 in `dub-confirmed.yaml`); die Folgen liegen unter B0GX7VDJK3, B0CH1GVRKK, B0G1ZD14D3 |
| B0CGGZVNFS | Beide Belege (Railgun S 16049, Index III 100185) entfernt | Seite „Staffel 3“, 25 Folgen, 2020 = Railgun T (AniList 104462, 25 Folgen); 104462 steht bei „Anime ohne Synchro“, ohne Beleg |
| B0CW5WH6XZ | Beleg bleibt bei Tokyo Ghoul:re (100240), 102351 entfernt | `prime_folge` Seite B0CW5WH6XZ „Staffel 3“: „Start – Jäger“ = `folgen/100240.json` |
| B0D7N68Q5T | Beleg bleibt bei :re 2 (102351), 100240 entfernt | `prime_folge` Seite B0D7N68Q5T „Staffel 4“: „Und noch einmal – Place“ = `folgen/102351.json` |
| B0CVG5M4FP | Beide Belege (Pokémon 527, Sonne & Mond 97634) entfernt | Die 13 Folgentitel „Pikachu in Not!“ bis „Pokémon-Eleganz“ stehen in `folgen/1564.json` = Advanced Generation |
| B0DJ4FCM5H | Beleg bleibt bei Prinz Ribbit (10011569), Super Wings (10012621) entfernt | Eine Folge „Prinz Ribbit“, 5325 s (89 min), 2020 = Film, keine Serienfolge; `youtube-kauf.json` kennt den Film unter diesem Namen |
| B0FX4Q35V2 | Beleg bleibt bei Shinsei-ban (10019697), 130622 entfernt | Folge „The Birth of Kitaro: Das Geheimnis von GeGeGe“, erschienen 18.11.2025 = polyband-Ausgabe, die am Titel 10019697 steht (`deErstausgabe`); 130622 ist laut `datensatz.md` die zweite Fassung desselben Films |

## Seitenabruf nötig

Keiner. Zwei Annahmen, die ein Abruf bestätigen würde, aber nicht blockieren: B0DJ4FCM5H (ob Super Wings eine eigene Folge auf der Seite hat; die Rohzeilen nennen nur den Film) und B0FX4Q35V2 (ob die deutsche Ausgabe die Fassung 2023 oder die Shinsei-ban ist; die Dublette bleibt als Titel bestehen).
