# Kontrollmessung: Streaming Availability API

Stand 2026-09-02. Erzeugt von `npm run data:motn:check`, **nicht von Hand pflegen**.

Bestand: **1888 Serien** der Quelle, davon **779 Zuordnungen**
zu unseren Einträgen. Davon ließen sich **468** gegen einen unabhängigen Beleg halten
(Handprüfung oder Crunchyroll-Serienseite).

| | Zahl |
|---|---|
| bestätigt (wir ja, Quelle ja) | 151 |
| **widersprochen** (wir nein, Quelle ja) | 0 |
| Quelle schweigt (wir ja, Quelle führt es nicht) | 317 |

**Nur die mittlere Zeile ist ein Widerspruch.** Die untere ist der bekannte Verzug der Quelle:
Sie belegt, was da ist, nie was fehlt (siehe `pipeline/lib/motn.ts`).

**Wie belastbar die Null ist: 19 der 468 Vergleiche standen gegen ein belegtes *Nein*.**
Nur die können überhaupt ein Widerspruch werden — die übrigen messen, ob die Quelle eine
bekannte Synchro auch kennt, nicht ob sie eine erfindet. Die Decke dafür liegt in unserem
eigenen Bestand: Belegte Absagen gibt es kaum, und mehr Anfragen an die Quelle ändern das
nicht. Was diese Messung also sagt, ist „sie hat noch nie deutschen Ton behauptet, wo wir
das Gegenteil belegt haben" — nicht „sie tut es nie".

## Je Anbieter

| Anbieter | verglichen | bestätigt | widersprochen | Quelle schweigt |
|---|---|---|---|---|
| crunchyroll | 219 | 6 | 0 | 213 |
| crunchyroll — Kanal `crunchyrollde` | 95 | 69 | 0 | 26 |
| primevideo | 70 | 44 | 0 | 26 |
| netflix | 56 | 18 | 0 | 38 |
| disneyplus | 19 | 10 | 0 | 9 |
| adn — Kanal `animedigitalde` | 9 | 4 | 0 | 5 |

**Crunchyroll ist hier der Prüfstein, nicht das Ziel.** Für 190 Serien wissen wir aus unserem
eigenen Abruf, ob dort eine deutsche Tonspur liegt — für Netflix wissen wir es fast nirgends
(sieben Handprüfungen, Stand 21.08.2026). Ohne die Crunchyroll-Zeile wäre diese Messung leer.

**Der Prüfstein hängt am Kanal, nicht am Anbieter.** Die Zeile `crunchyroll` und die Zeile
`crunchyroll — Kanal crunchyrollde` messen dieselben Serien und kommen zu ganz verschiedenen
Ergebnissen: Unter dem Anbieter selbst führt die Quelle fast nur `jpn`, unter dem Kanal (das
ist Crunchyroll im Amazon-Abo) steht die deutsche Tonspur. Ein Kanal geht **nie** in den
Datensatz — er hat eine eigene Adresse und ein eigenes Abo. Als Prüfstein taugt er, weil die
Frage dieselbe ist: Gibt es diese Folge auf Deutsch?

Übernommen wird ausschließlich **Netflix**: Die Crunchyroll-Angaben dieser Quelle
widersprechen sich zwischen Serien- und Episodenebene selbst, und für Prime Video und Disney+
fehlt bislang jede Trefferquote.

## Deutscher Ton bei Netflix, aber keine Zuordnung

**52 Serien** trägt die Quelle mit deutschem Netflix-Ton, ohne dass ein Beleg
daraus wird. Fast immer ist es die Folgenrechnung: Die Quelle nummeriert ihre Folgen nicht,
zugeordnet wird über die **Position** in ihrer Liste, und die geht nur auf, wenn die Länge
exakt zu unserer Staffelaufteilung passt. 26 Einträge für 25 Folgen heißen, dass irgendwo ein
Special dazwischenliegt — welches, sagt die Quelle nicht.

Diese Zeilen sind **Handarbeit**, keine Lücke im Abruf. Ein zweiter Abruf bringt dieselbe
Antwort.

| unser Titel | Serie laut Quelle | Jahr | Folgen in der Liste | ihr `episodeCount` | Netflix-Folgen mit deutschem Ton |
|---|---|---|---|---|---|
| JoJo’s Bizarre Adventure: Diamond Is Unbreakable | JoJo's Bizarre Adventure | 2012 | 228 | 202 | 191 |
| Pokémon Horizonte | Pokémon Horizons | 2023 | 148 | 147 | 89 |
| The Seven Deadly Sins | The Seven Deadly Sins | 2014 | 96 | = | 76 |
| Shaman King (2021) | SHAMAN KING | 2021 | 52 | = | 52 |
| Aggretsuko | Aggretsuko | 2018 | 50 | = | 50 |
| Sword Art Online | Sword Art Online | 2012 | 96 | = | 49 |
| Fire Force | Fire Force | 2019 | 73 | = | 48 |
| Baki Hanma | Baki Hanma | 2021 | 39 | = | 39 |
| Konosuba: God’s Blessing on This Wonderful World! | KONOSUBA - God's blessing on this wonderful world! | 2016 | 33 | 31 | 33 |
| Naruto Shippuden | Naruto Shippūden | 2007 | 32 | 500 | 32 |
| The Eminence in Shadow | The Eminence in Shadow | 2022 | 32 | = | 32 |
| Frieren: Nach dem Ende der Reise | Frieren: Beyond Journey's End | 2023 | 39 | 38 | 28 |
| Naruto | Naruto | 2002 | 52 | 220 | 26 |
| Ajin: Demi-Human | Ajin | 2016 | 26 | = | 26 |
| Blue Box | Blue Box | 2024 | 26 | = | 25 |
| Witch Watch | Witch Watch | 2025 | 26 | 25 | 25 |
| Fate/Stay Night: Unlimited Blade Works | Fate/stay night [Unlimited Blade Works] | 2014 | 25 | = | 25 |
| Baki-Dou: The Invincible Samurai | BAKI-DOU: The Invincible Samurai | 2026 | 25 | = | 25 |
| The Seven Deadly Sins: Four Knights of the Apocalypse | The Seven Deadly Sins: Four Knights of the Apocalypse | 2023 | 36 | = | 24 |
| Delicious in Dungeon | Delicious in Dungeon | 2024 | 25 | = | 24 |
| T・P Bon | T・P BON | 2024 | 24 | = | 24 |
| Swordgai The Animation | SWORD GAI: The Animation | 2018 | 24 | = | 24 |
| Ghost in the Shell: SAC_2045 | Ghost in the Shell: SAC_2045 | 2020 | 24 | = | 24 |
| Meine Wiedergeburt als Schleim in einer anderen Welt | That Time I Got Reincarnated as a Slime | 2018 | 96 | = | 24 |
| Die Tagebücher der Apothekerin | The Apothecary Diaries | 2023 | 49 | 48 | 24 |
| Fate/Grand Order Absolute Demonic Front: Babylonia | Fate/Grand Order Absolute Demonic Front: Babylonia | 2019 | 21 | = | 21 |
| Great Pretender | Great Pretender | 2020 | 27 | = | 18 |
| Altered Carbon: Resleeved | Altered Carbon | 2018 | 18 | = | 18 |
| Boruto: Naruto Next Generations | Boruto: Naruto Next Generations | 2017 | 293 | = | 15 |
| The Ramparts of Ice | The Ramparts of Ice | 2026 | 15 | = | 14 |
| Rascal Does Not Dream of Bunny Girl Senpai | Rascal Does Not Dream of Bunny Girl Senpai | 2018 | 26 | = | 13 |
| Baki | BAKI | 2018 | 39 | = | 13 |
| The Misfit of Demon King Academy | The Misfit of Demon King Academy | 2020 | 37 | = | 13 |
| Little Witch Academia (TV) | Little Witch Academia | 2017 | 25 | = | 13 |
| The Dangers in My Heart | The Dangers in My Heart | 2023 | 25 | = | 12 |
| BNA | BNA | 2020 | 12 | = | 12 |
| Reincarnated as a Sword | Reincarnated as a Sword | 2022 | 13 | = | 12 |
| Detektiv Conan: The Culprit Hanzawa | Case Closed: The Culprit Hanzawa | 2022 | 12 | = | 12 |
| Konosuba: An Explosion on This Wonderful World! | KONOSUBA – An Explosion on This Wonderful World! | 2023 | 12 | = | 12 |
| Junji Ito Maniac: Japanese Tales of the Macabre | Junji Ito Maniac: Japanese Tales of the Macabre | 2023 | 12 | = | 12 |
| Dan Da Dan | Dan Da Dan | 2024 | 24 | = | 12 |
| Ranma 1/2 (2024) | Ranma1/2 | 2024 | 25 | = | 12 |
| Shiboyugi: Das Phantom-Mädchen im Spiel des Todes | SHIBOYUGI: Playing Death Games to Put Food on the Table | 2026 | 12 | = | 12 |
| Knights of the Zodiac: Saint Seiya Teil 2 | SAINT SEIYA: Knights of the Zodiac | 2019 | 48 | 36 | 12 |
| Devilman Crybaby | Devilman Crybaby | 2018 | 10 | = | 10 |
| Die Pokémon-Concierge | Pokémon Concierge | 2023 | 8 | = | 8 |
| Rilakkumas Abenteuer im Vergnügungspark | Rilakkuma's Theme Park Adventure | 2022 | 8 | = | 8 |
| The Disastrous Life of Saiki K.: Reawakened | The Disastrous Life of Saiki K.: Reawakened | 2019 | 6 | = | 6 |
| Detektiv Conan: Zero’s Tea Time | Case Closed: Zero's Tea Time | 2022 | 7 | 6 | 6 |
| Kakegurui Twin | KAKEGURUI TWIN | 2022 | 6 | = | 6 |
| Mobile Suit Gundam: Requiem for Vengeance | Gundam: Requiem for Vengeance | 2024 | 6 | = | 6 |
| Spriggan | SPRIGGAN | 2022 | 6 | = | 6 |

## Was diese Quelle liefern kann

- `netflix` → netflix
- `prime` → primevideo
- `disney` → disneyplus
- `crunchyroll` → crunchyroll
