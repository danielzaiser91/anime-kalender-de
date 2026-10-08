# Discord „#db_api": vier Themen, je Titel eines

Jedes Thema: die **Überschrift** als Themenname, der **Text** (Block darunter) 1:1 als erste Nachricht einfügen. Jeder Text ist unter 2.000 Zeichen und steht für sich.
Gegengeprüft am 08.10.2026 gegen die aniSearch-API: Keiner der vier Titel steht in der Titelliste (`/v1/anime/titles`), und die drei mit MAL-Kennung fehlen in `/v1/anime/associated?source=myanimelist` (18.867 Schlüssel).

**Forum-Richtlinien (Screenshot):** klarer Titel ✓ · ein Thema je Beitrag ✓ · Endpunkt und Beispielanfrage mit Antwort ✓ (in jedem Text) · deutsch ist willkommen ✓ · **vor dem Posten im Kanal nach vorhandenen Beiträgen suchen** (das kannst nur du: Suche nach den Titeln, damit kein Duplikat entsteht).

---

## 1 · Yu-Gi-Oh! Capsule Monsters (Kapselmonster) — der ausführliche Fall

**Überschrift:** `Yu-Gi-Oh! Capsule Monsters (Kapselmonster) – TV-Miniserie 2006, 12 Folgen, deutsche Fassung`

```
Hallo zusammen, zu dieser Serie finde ich bei euch keinen Eintrag:

**Yu-Gi-Oh! Capsule Monsters** (deutsch: *Yu-Gi-Oh! Kapselmonster*), TV-Miniserie mit 12 Folgen, Spin-off von Yu-Gi-Oh! Duel Monsters, im Auftrag von 4Kids Entertainment produziert. Erstausstrahlung laut TMDB am 09.09.2006. Keine MAL-Kennung; AniList: https://anilist.co/anime/123074

**Deutsche Fassung vorhanden:**
- Synchronkartei mit deutscher Besetzung (u. a. Sebastian Schulz, Konrad Bösherz, Robin Kahnmeyer): https://www.synchronkartei.de/serie/59171
- Wikipedia: bei RTL II als sechste Staffel der zweiten Yu-Gi-Oh!-Serie ausgestrahlt: https://de.wikipedia.org/wiki/Yu-Gi-Oh!
- Liegt den deutschen Gesamtausgaben als „Kapselmonster-Mini-Serie" (12 Folgen) bei: https://akibapassshop.de/products/23a056-yu-gi-oh-complete-edition-ep-1-224-kapselmonster-bluray, https://dtmshop.dtm.at/YU-GI-OH-Blu-Ray-10Discs-Complete-Edition-Ep-1-224-Kapselmonster/1134797, https://www.amazon.de/Yu-Gi-Oh-Duel-Monsters-Complete-Blu-rays/dp/B0GQHJGFV9

**Auch geführt bei:** TMDB https://www.themoviedb.org/tv/11767 · IMDb https://www.imdb.com/title/tt6540806/ · Rotten Tomatoes https://www.rottentomatoes.com/tv/yu_gi_oh_capsule_monsters/s01

**Endpunkt:** `GET https://api.anisearch.com/v1/anime/titles` (08.10.2026, 200 OK). Suche nach „Capsule Monsters" in allen Titeln und Synonymen: kein Treffer.

Falls ich etwas übersehen habe, sagt Bescheid, sonst ist es eine Lücke. Danke!
```

---

## 2 · Princess Principal Picture Drama

**Überschrift:** `Princess Principal Picture Drama – Special, MAL 36485`

```
Hallo zusammen, zu diesem Titel finde ich bei euch keinen Eintrag:

**Princess Principal Picture Drama**, ein Special zur Serie Princess Principal.
- AniList: https://anilist.co/anime/100519/Princess-Principal-Picture-Drama
- MAL: https://myanimelist.net/anime/36485/Princess_Principal_Picture_Drama

**Endpunkte** (08.10.2026, je 200 OK):
- `GET /v1/anime/associated?source=myanimelist` → der Schlüssel `36485` fehlt (18.867 Schlüssel insgesamt).
- `GET /v1/anime/titles` → Suche nach „Princess Principal Picture Drama": kein Treffer.

Falls ich etwas übersehen habe, sagt Bescheid, sonst ist es eine Lücke. Danke!
```

---

## 3 · Anohana: The Flower We Saw That Day – Letter to Menma (Menma e no Tegami)

**Überschrift:** `Anohana: The Flower We Saw That Day – Letter to Menma (Menma e no Tegami), MAL 38963`

```
Hallo zusammen, zu diesem Titel finde ich bei euch keinen Eintrag:

**Anohana: The Flower We Saw That Day – Letter to Menma**, ein 12-Minuten-Special vom 22.02.2012 zur Serie (deutscher Serientitel: *AnoHana: Die Blume, die wir an jenem Tag sahen*; einen deutschen Titel des Specials kenne ich nicht). Japanischer Titel: Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai.: Menma e no Tegami
- MAL: https://myanimelist.net/anime/38963
- AniList: https://anilist.co/anime/107342
- IMDb: https://www.imdb.com/title/tt9561688/

**Endpunkte** (08.10.2026, je 200 OK):
- `GET /v1/anime/associated?source=myanimelist` → der Schlüssel `38963` fehlt (18.867 Schlüssel insgesamt).
- `GET /v1/anime/titles` → Suche nach „Menma e no Tegami": kein Treffer.

Falls ich etwas übersehen habe, sagt Bescheid, sonst ist es eine Lücke. Danke!
```

---

## 4 · Yu-Gi-Oh! The Dark Side of Dimensions Special (Eien no Rival)

**Überschrift:** `Yu-Gi-Oh! The Dark Side of Dimensions Special (Eien no Rival), MAL 33997`

```
Hallo zusammen, zu diesem Titel finde ich bei euch keinen Eintrag:

**Yu-Gi-Oh! The Dark Side of Dimensions Special**, ein 26-Minuten-Special, das vor dem Film läuft: Jounouchi und Mokuba fassen Anime und Kartenspiel zusammen und erzählen von der Rivalität zwischen Yuugi und Kaiba. Das Yu-Gi-Oh! Wiki führt zwei Fassungen mit gleichem Anfang und Mittelteil, aber anderem Ende: „just before theatrical release" (Japan, 17.04.2016) und „commemoration" (Japan, 23.04.2016). AniList und MAL führen beide zusammen als ein Special mit einer Folge. Ein deutscher Titel des Specials ist mir nicht bekannt; der Film heißt auch auf Deutsch „Yu-Gi-Oh! The Dark Side of Dimensions". Vollständiger Titel bei AniList: Yu☆Gi☆Oh! The Dark Side of Dimensions Special: Eien no Rival - Yuugi to Kaiba!
- AniList: https://anilist.co/anime/102505/YuGiOh-The-Dark-Side-of-Dimensions-Special-Eien-no-Rival-Yuugi-to-Kaiba
- MAL: https://myanimelist.net/anime/33997
- Yu-Gi-Oh! Wiki („Eternal Rival: Yugi and Kaiba"): https://yugioh.fandom.com/wiki/Eternal_Rival_Yugi_and_Kaiba

**Endpunkte** (08.10.2026, je 200 OK):
- `GET /v1/anime/associated?source=myanimelist` → der Schlüssel `33997` fehlt (18.867 Schlüssel insgesamt).
- `GET /v1/anime/titles` → Suche nach „Eien no Rival": kein Treffer.
- `GET /v1/anime/10086?lang=de` → „Yuu Gi Ou: The Dark Side of Dimensions", Typ Film, 2016, MAL 28771. Die Kennung 10086 ist also der Film selbst, nicht das Special.

Falls ich etwas übersehen habe, sagt Bescheid, sonst ist es eine Lücke. Danke!
```

---

Antwortet aniSearch mit einer Kennung (Adresse `anisearch.de/anime/<ID>,<slug>`), trage ich sie in `data/anisearch-ids-hand.yaml` ein.
