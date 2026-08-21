# Kontrollmessung: Streaming Availability API

Stand 2026-08-21. Erzeugt von `npm run data:motn:check`, **nicht von Hand pflegen**.

Bestand: **130 Serien** der Quelle, davon **230 Zuordnungen**
zu unseren Einträgen. Davon ließen sich **143** gegen einen unabhängigen Beleg halten
(Handprüfung oder Crunchyroll-Serienseite).

| | Zahl |
|---|---|
| bestätigt (wir ja, Quelle ja) | 39 |
| **widersprochen** (wir nein, Quelle ja) | 0 |
| Quelle schweigt (wir ja, Quelle führt es nicht) | 104 |

**Nur die mittlere Zeile ist ein Widerspruch.** Die untere ist der bekannte Verzug der Quelle:
Sie belegt, was da ist, nie was fehlt (siehe `pipeline/lib/motn.ts`).

**Wie belastbar die Null ist: 3 der 143 Vergleiche standen gegen ein belegtes *Nein*.**
Nur die können überhaupt ein Widerspruch werden — die übrigen messen, ob die Quelle eine
bekannte Synchro auch kennt, nicht ob sie eine erfindet. Die Decke dafür liegt in unserem
eigenen Bestand: Belegte Absagen gibt es kaum, und mehr Anfragen an die Quelle ändern das
nicht. Was diese Messung also sagt, ist „sie hat noch nie deutschen Ton behauptet, wo wir
das Gegenteil belegt haben" — nicht „sie tut es nie".

## Je Anbieter

| Anbieter | verglichen | bestätigt | widersprochen | Quelle schweigt |
|---|---|---|---|---|
| crunchyroll | 94 | 3 | 0 | 91 |
| crunchyroll — Kanal `crunchyrollde` | 46 | 36 | 0 | 10 |
| adn — Kanal `animedigitalde` | 2 | 0 | 0 | 2 |
| netflix | 1 | 0 | 0 | 1 |

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

## Was diese Quelle liefern kann

- `netflix` → netflix
- `prime` → primevideo
- `disney` → disneyplus
- `crunchyroll` → crunchyroll
