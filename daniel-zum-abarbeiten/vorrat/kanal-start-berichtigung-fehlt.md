# Angel's Egg / Wolf Girl: Berichtigung in news-historie.json fehlt

{eigen · normal · Daten · 12.11.}

Vorab geprüft: `gh pr list --state open --search "Angel's Egg news-historie felder"` (12.11.) → keiner offen. PR 2792 ist gemergt.

## Befund (Stand main, 12.11.)

- `public/data/news.json`: `auto-885-primevideo` (Angel's Egg, 05.11.) hat weiter `jahre: 41`, `discSeitText: "5 Monaten"`, kein `schonKaufbar`; `auto-20701-primevideo` (Wolf Girl, 19.11.) `jahre: 12`.
- Ursache: `pipeline/lib/news-felder-fest.ts` (Kommentar vor `BERICHTIGT`, Zeilen 75–83) nennt als einmalige Berichtigung eine Umstellung in `data/news-historie.json` (`felder`). Dort steht unverändert `{"kanal":"Aniverse","jahre":41,"discSeitText":"5 Monaten"}` bzw. `jahre 12` (PR 2792 hat die Datei nicht angefasst). Die festgehaltenen Felder gewinnen, die Neuberechnung (`ankuendigungJahre`, `news-neu-zeile.ts:54`) greift nur für neue Meldungen.
- Die Ausnahmeliste `BERICHTIGT` erlaubt die Änderung, sie ist also nicht der Grund.

## Auftrag

In `data/news-historie.json` `felder` beider Schlüssel auf `{"kanal":"Aniverse","schonKaufbar":true}` umstellen, News-Delta je Titel (`news.json` Kandidat gegen Basis) als Pflichtzeile, Test über `baueNews` gegen den echten Bestand; danach Vorrat `kanal-start-bei-kaufbarem-titel` freigeben.
