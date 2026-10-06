# Antwort an Dominik (aniSearch), Entwurf vom 06.10.2026

Betreff: Re: Quellenlinks an den Beschreibungen

Hallo Dominik,

danke für den genauen Hinweis, den Fehler habe ich gefunden. Bei 210 Beschreibungen lief der Quellenlink noch auf die Suche, bei allen übrigen auf die Titelseite ohne Slug.

Jetzt führt jeder Quellenlink an einer von euch übernommenen Beschreibung direkt auf die kanonische Titelseite, zum Beispiel https://www.anisearch.de/anime/2227,one-piece. Gemessen habe ich das an unserem gebauten Datensatz: 2.495 von 2.495 Links tragen Kennung und Slug, keiner führt mehr auf die Suche.

Die Slugs holen wir über den Endpunkt aus deiner Mail, einmal pro Woche in einem Abruf. Für 135 Titel, bei denen uns die Kennung fehlte, habe ich außerdem eure eigene Zuordnung /v1/anime/associated genutzt. Sie stimmt bei 2.627 von 2.628 Titeln mit unserer überein, in einem Fall hat sie uns korrigiert.

Der aniSearch-Link neben dem Cover und die Quellenübersicht im Panel führen überall dort auf die Adresse mit Slug, wo wir eine Kennung kennen (stichprobenhaft live geprüft: One Piece, Gantz, Ranma 1/2 Staffel 3). Bei 17 Titeln fehlte uns die Kennung. Zehn davon haben wir mit deinen Hinweisen nachgetragen. Bei Angel Beats! Specials, Pokémon XYZ Specials und Kishibe Rohan (drei Specials, wir führen nur eines) gibt es bei euch mehrere Einträge für unseren einen; dort lasse ich die Zuordnung offen.

Drei Titel finde ich bei euch nicht. Falls ich etwas übersehen habe, sag Bescheid, sonst sind es Lücken:
- Princess Principal Picture Drama (Special zur Serie, auf AniList und MAL geführt)
- Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai.: Menma e no Tegami (Special, IMDb: https://www.imdb.com/title/tt9561688/)
- Yu☆Gi☆Oh! The Dark Side of Dimensions Special: Eien no Rival – Yuugi to Kaiba!, ein 26-Minuten-Special vor dem Film. Die Kennung 10086 ist der Film selbst, nicht das Special.

Dazu zwei Randnotizen: Death Note: Relight 2 (https://www.anisearch.de/anime/5194,death-note-r2-l-o-tsugu-mono) führen wir selbst noch nicht, das holen wir nach. Und Yu-Gi-Oh! Capsule Monsters (Duel Monsters ALEX) hatte nach allem, was ich finde, nie eine japanische Veröffentlichung (4Kids-Produktion, in Deutschland auf RTL II und Tele 5 gelaufen). Dass sie bei euch fehlt, passt dazu.

Viele Grüße
Daniel

---

Stand der Messung: 06.10.2026, Bestandsbau 18:03 Uhr; Live-Probe One Piece, Gantz und Ranma 1/2 S3: Pille mit Slug (Deploy nach dem Bau von 20:08 Uhr).
