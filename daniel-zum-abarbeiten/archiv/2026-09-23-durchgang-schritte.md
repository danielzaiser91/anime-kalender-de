# Durchgang 23.09.2026, 07:35 — fertige Schritte

Gemessen vorher: Prüfstand kennt nur zwei offene Einträge, und **keiner davon ist ein
Meldeauftrag für Daniel** — Amazon/Fairy Tail wartet auf Stufe 2, Crunchyroll hat keinen
Melder (meine Arbeit, `status.md`). Der Durchgang besteht deshalb aus Entscheidungen.

## 1 · Erweiterung neu laden (Handgriff, 10 Sekunden)

Stand: Erweiterung 4.21.1 liegt seit gestern im Repo (`extension/manifest.json`), Daniel
hat noch 4.21.0 geladen. Neu: Jede Rohfolge trägt `vorhanden`/`ton_de` (Netflix, Disney+).

Frage: `chrome://extensions` öffnen, bei „Anime-Kalender" auf Neu laden — steht danach
4.21.1 unter dem Namen?

Antwort → ich tue: nichts einzutragen, nur bestätigen. Bei „Version steht nicht da": nach
dem Ordner fragen, aus dem die Erweiterung geladen ist.

## 2 · „Fish-Man Island Saga" — eigener Titel oder One Piece?

Fakten: tv.de führt am 28./29.09. vier Sendungen unter „One Piece" (titleId 21), deren
Folgentitel mit „Fish-Man Island Saga: …" beginnen. Unser Bestand hat dafür einen eigenen
Titel: **183423 „One Piece Log: Fish-Man Island Saga"**, 21 Folgen, JP 2024. Das ist die
Neuauflage (Log-Reihe), nicht die durchlaufende Serie.

Frage: Sollen diese Sendungen auf 183423 laufen statt auf One Piece?

- **ja** → `pipeline/lib/tv-termine.ts`: Sendungen, deren Folgentitel mit dem Namen eines
  anderen Titels derselben Reihe beginnen, gehen an diesen Titel. Zusicherung dazu, dann
  Bestandslauf.
- **nein** → Zeile in `status.md` als bewusst verworfen, mit Begründung.

## 3 · Nachtwiederholung kennzeichnen?

Fakten: ProSieben MAXX zeigt One Piece abends der Reihe nach (22.09.: Fg. 772, 773) und
nachts ältere Folgen (23.09. 04:25: Fg. 765, 04:50: Fg. 766). Die Pille nennt dann
„Nächste: Fg. 765 · Mi 04:25" — sachlich richtig, sieht aber nach Rücksprung aus.

Frage: Soll an einer Sendung, deren Folgennummer unter der zuletzt gelaufenen liegt,
„Wiederholung" stehen?

- **ja** → `tvAngabe` vergleicht mit der höchsten bereits gesendeten Nummer und hängt das
  Wort an; Zusicherung in `check:logic`.
- **nein** → Zeile in `status.md`, Punkt zu.

## 4 · Disc-Termin mit der aniSearch-Ausgabe verknüpfen?

Fakten: Der Termin 20.11.2026 bei Dragon Ball Z stammt aus einer Anime2You-Meldung
(Release `auto-813-disc`, keine Adresse). Die passende Ausgabe steht in
`data/disc-ausgaben.json` als „Dragon Ball Z – Box 04/10 (Uncut) [Blu-ray]" mit dem
Platzhalterdatum 31.12.2026 und der Adresse
`https://www.anisearch.de/article/167249,dragon-ball-z-box-04-10-uncut-blu-ray`.

Frage: Soll der Termin die Ausgabe übernehmen — also Name („Box 04/10") und aniSearch-Link
an der Pille, Termin weiterhin aus der Meldung?

- **ja** → Zuordnung im Bau über Titel + nächstliegendes Ausgabedatum, Zusicherung, dass
  kein fremder Titel zugeordnet wird.
- **nein** → Pille bleibt „Kaufausgabe" ohne Ziel.

## 5 · JustWatch-Abgleich für Titel ohne Treffer verbessern?

Fakten: 646 Titel haben bei JustWatch keinen Treffer, 17 davon verlieren dadurch Wege, die
sonst über JustWatch kämen. Ursache ist die Namenssuche (Schreibweisen, Untertitel).

Frage: Soll ich daran arbeiten (Messung, dann besserer Abgleich), oder bleibt es liegen?

- **ja** → eigener Punkt in `status.md`, Messung zuerst.
- **nein** → Punkt streichen.

## 6 · Fairy Tail S1 — bis Stufe 2 liegen lassen?

Fakten: 24 Meldungen zu Fairy Tail S2 (`B0GZJ6DXCS`) liegen im Briefkasten und warten auf
die Zuordnungstabelle. Fairy Tail S1 steht als einziger Meldeauftrag bei Amazon offen.

Frage: Bleibt es dabei, dass du Fairy Tail erst nach Stufe 2 meldest?

- **ja** → nichts tun, Punkt bleibt als 🟡 mit Grund.
- **nein** → ich lege den Auftrag mit Link vor.
