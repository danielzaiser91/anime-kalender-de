# Antwort an Dominik (aniSearch), Entwurf vom 06.10.2026

Betreff: Re: Quellenlinks an den Beschreibungen

Hallo Dominik,

danke für den genauen Hinweis, den Fehler habe ich gefunden. Bei 210 Beschreibungen lief der Quellenlink noch auf die Suche, bei allen übrigen auf die Titelseite ohne Slug.

Jetzt führt jeder Quellenlink an einer von euch übernommenen Beschreibung direkt auf die kanonische Titelseite, zum Beispiel https://www.anisearch.de/anime/2227,one-piece. Gemessen habe ich das an unserem gebauten Datensatz: 2.495 von 2.495 Links tragen Kennung und Slug, keiner führt mehr auf die Suche.

Die Slugs holen wir über den Endpunkt aus deiner Mail, einmal pro Woche in einem Abruf. Für 135 Titel, bei denen uns die Kennung fehlte, habe ich außerdem eure eigene Zuordnung /v1/anime/associated genutzt. Sie stimmt bei 2.627 von 2.628 Titeln mit unserer überein, in einem Fall hat sie uns korrigiert.

Der aniSearch-Link neben dem Cover und die Quellenübersicht im Panel führen ebenfalls auf die Adresse mit Slug, wo die Beschreibung von euch stammt. Wo sie anderswo herkommt, gehen sie über die Kennung allein, dort leitet aniSearch einmal um. Bei 17 Titeln kennen wir noch keine Kennung, dort steht weiter der Link zur Suche.

Viele Grüße
Daniel

---

Stand der Messung: 06.10.2026, Bestandsbau 18:03 Uhr; Live-Probe One Piece (Pille und Quellenübersicht mit Slug), Gantz und Ranma 1/2 S3 (Kennung ohne Slug).
