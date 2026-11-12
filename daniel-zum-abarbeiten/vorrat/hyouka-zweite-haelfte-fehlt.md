# Hyouka: Folgen 13–22 fehlen im Prime-Weg

{eigen · normal · Daten · 12.11.}

Vorab geprüft: `gh pr list --state open --search "Hyouka B0DC75L8BJ"` und `--search "prime-teilseiten"` (12.11.) → keiner offen. PR 2789 (Z wie Zorro) betrifft diesen Fall nicht.

## Befund (Stand main, 12.11.)

- `public/data/titles.json` Hyouka (al 12189): Prime-Weg `B0B5JVJKCD` hat `dubRanges` nur 1–3 und 5–12, die zweite Hälfte fehlt. `public/data/folgen/12189.json` hat dagegen alle 22 Folgentitel (der Bericht nannte 5648; die Datei heißt 12189).
- `data/prime-zugeordnet.json`: zwei Meldungen für 12189. `…/B0B5JVJKCD#0` (Seite B0B5JVJKCD, Folgen 1–3, 5–12 deutsch) und `…/B0B5JVJKCD` (Seite B0DC75L8BJ, Folgen 13–22 deutsch).
- Ursache: `pipeline/lib/prime-teilseiten.ts` `meldungsSeite` (Zeile 33) nimmt bei gesetztem `seite` diese statt der Ablage-Adresse; `ordnePrimeSeiteZu` (Zeile 79ff) sieht für Seite B0B5JVJKCD deshalb nur die erste Meldung. Die zweite gehört zur Seite B0DC75L8BJ, für die Hyouka keinen Weg hat (`dub-confirmed.yaml` führt sie nur als Notiz „Seitenadresse: B0DC75L8BJ“). Ergebnis: Bereiche aus Meldung 1, Folgen 13–22 ungelesen.
- Folge 4 fehlt in Meldung 1 (nicht deutsch gemeldet): eigene Frage.

## Auftrag

Fix in der Zuordnung (Meldungen derselben Ablage-Adresse und desselben Titels zusammenführen oder Weg für B0DC75L8BJ anlegen), Test mit diesem echten Fall (beide Meldungen wörtlich aus `prime-zugeordnet.json`), Bilanz Hyouka vorher/nachher; danach Vorrat `hyouka-folgen-der-zweiten-haelfte` freigeben.
